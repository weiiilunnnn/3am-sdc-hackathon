"""Versioned O*NET tasks and Anthropic Economic Index observation lookup.

O*NET supplies US occupation/task definitions. Anthropic provides observed
Claude task penetration and SOC occupation exposure. Neither estimates the
likelihood of replacing a person's skill/job. No live calls on page load.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile

from src.services.storage import connection

ONET_VERSION = "31.0"
ONET_URL = "https://www.onetcenter.org/database.html"
ANTHROPIC_URL = "https://huggingface.co/datasets/Anthropic/EconomicIndex/tree/main/labor_market_impacts"
ANTHROPIC_LICENSE_URL = "https://huggingface.co/datasets/Anthropic/EconomicIndex"
MATCH_VERSION = "onet-anthropic-exact-task-join-v1"

# Editorial keyword links only. They select occupation tasks for closer
# assessment; they are not O*NET classifications or AI-exposure scores.
SKILL_TASK_TERMS = {
    "local:javascript": ("program", "code", "software", "application", "web", "debug", "testing"),
    "local:typescript": ("program", "code", "software", "application", "web", "debug", "testing"),
    "local:sql": ("database", "query", "data", "report"),
    "local:html": ("web", "interface", "page", "layout"),
    "local:css": ("web", "interface", "page", "layout"),
    "local:python-programming": ("program", "code", "software", "application", "script", "debug", "testing"),
    "local:machine-learning": ("model", "machine learning", "algorithm", "statistical", "data", "predict"),
    "local:data-analysis": ("analy", "data", "report", "statistics", "statistical", "visualiz"),
    "local:spreadsheet-analysis": ("spreadsheet", "data", "calculation", "report", "record"),
    "local:statistical-software-development": ("statistical", "software", "data", "algorithm"),
    "local:customer-service": ("customer", "client", "support", "service", "complaint"),
    "local:communication": ("communicat", "present", "explain", "report", "document"),
    "local:project-planning": ("project", "plan", "coordinate", "schedule", "budget"),
    "local:critical-thinking": ("evaluat", "assess", "analy", "review", "investigat"),
    "local:problem-solving": ("solve", "troubleshoot", "problem", "diagnos", "investigat"),
    "local:teamwork": ("collaborat", "coordinat", "team", "consult"),
}


def _task_key(text: str) -> str:
    # Matching exact task descriptions with conservative normalization only.
    # We do not fuzzy-match unlike task statements or silently impute values.
    s = unicodedata.normalize("NFKC", text or "").casefold().strip()
    s = s.replace("’", "'").replace("“", '"').replace("”", '"')
    return " ".join(s.split()).rstrip(".")


def _soc(code: str) -> str:
    return code.strip().split(".", 1)[0]


def _rows(source: bytes) -> list[dict[str, str]]:
    value = source.decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(value)))


def _task_csv(source: bytes, name: str = "O*NET input") -> list[dict[str, str]]:
    # Accept either a standalone Task Statements.csv or the official CSV ZIP.
    if source[:2] == b"PK":
        with ZipFile(io.BytesIO(source)) as z:
            candidates = [x for x in z.namelist() if x.lower().endswith("task statements.csv") or x.lower().endswith("task_statements.csv")]
            if len(candidates) != 1:
                raise ValueError(f"{name}: O*NET ZIP must contain exactly one Task Statements CSV, found {len(candidates)}")
            source = z.read(candidates[0])
    rows = _rows(source)
    if not rows or not {"O*NET-SOC Code", "Task ID", "Task", "Title"}.issubset(rows[0]):
        raise ValueError(f"{name}: O*NET Task Statements CSV headings are missing")
    return rows


def _validated_float(value: str, label: str) -> float:
    try:
        n = float(value)
    except (ValueError, TypeError) as e:
        raise ValueError(f"{label}: invalid numeric value") from e
    if not 0 <= n <= 1 or not (n == n):
        raise ValueError(f"{label}: expected a finite fraction between 0 and 1")
    return n


def import_references(onet_bytes: bytes, penetration_bytes: bytes, exposure_bytes: bytes,
                      *, min_onet: int = 1000, min_anthropic: int = 1000, min_jobs: int = 100,
                      onet_version: str = ONET_VERSION) -> dict:
    """Validate all three files before an atomic SQLite import; do not delete good data on failed refresh."""
    tasks = _task_csv(onet_bytes)
    penetrations = _rows(penetration_bytes)
    jobs = _rows(exposure_bytes)
    if len(tasks) < min_onet or not tasks[0].get("Task"):
        raise ValueError("The O*NET task file is suspiciously small or malformed")
    if len(penetrations) < min_anthropic or not {"task", "penetration"}.issubset(penetrations[0]):
        raise ValueError("Anthropic task_penetration.csv is missing expected columns or rows")
    if len(jobs) < min_jobs or not {"occ_code", "title", "observed_exposure"}.issubset(jobs[0]):
        raise ValueError("Anthropic job_exposure.csv is missing expected columns or rows")
    # A task can occur under multiple occupations, but Anthropic indexes text.
    penetration_index: dict[str, float] = {}
    for row in penetrations:
        key = _task_key(row["task"])
        if not key:
            continue
        n = _validated_float(row["penetration"], "task penetration")
        if key in penetration_index and penetration_index[key] != n:
            raise ValueError("Contradictory Anthropic values for the same normalized task statement")
        penetration_index[key] = n
    indexed: list[tuple] = []
    seen: set[tuple[str, str]] = set()
    matched = 0
    for row in tasks:
        task_id = str(row["Task ID"]).strip()
        code = str(row["O*NET-SOC Code"]).strip()
        task = str(row["Task"]).strip()
        title = str(row["Title"]).strip()
        if not task_id.isdigit() or not code or not task or not title:
            raise ValueError("Invalid O*NET task/occupation row")
        key = (code, task_id)
        if key in seen:
            raise ValueError("Duplicate O*NET occupation/task ID")
        seen.add(key)
        normalized = _task_key(task)
        value = penetration_index.get(normalized)
        if value is not None:
            matched += 1
        indexed.append((code, _soc(code), task_id, title, task, row.get("Task Type", "") or "", normalized, value))
    if matched < 1:
        raise ValueError("No O*NET tasks joined to Anthropic observations; check file versions")
    occupations: list[tuple] = []
    seen_occ: set[str] = set()
    for row in jobs:
        code = _soc(row["occ_code"])
        if not code or code in seen_occ:
            raise ValueError("Invalid or duplicate Anthropic SOC occupation code")
        seen_occ.add(code)
        occupations.append((code, row["title"].strip(), _validated_float(row["observed_exposure"], "occupation exposure")))
    checksums = {"onet": hashlib.sha256(onet_bytes).hexdigest(),
                 "anthropic_tasks": hashlib.sha256(penetration_bytes).hexdigest(),
                 "anthropic_jobs": hashlib.sha256(exposure_bytes).hexdigest()}
    imported_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with connection() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS disruption_reference_meta (id INTEGER PRIMARY KEY CHECK (id=1), payload TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS disruption_reference_tasks (
            soc_code TEXT NOT NULL, soc_major TEXT NOT NULL, task_id TEXT NOT NULL,
            occupation TEXT NOT NULL, task TEXT NOT NULL, task_type TEXT NOT NULL,
            normalized_task TEXT NOT NULL, penetration REAL,
            PRIMARY KEY(soc_code,task_id));
        CREATE INDEX IF NOT EXISTS idx_disruption_reference_tasks_soc ON disruption_reference_tasks(soc_major);
        CREATE TABLE IF NOT EXISTS disruption_reference_occupations (
            soc_major TEXT PRIMARY KEY, title TEXT NOT NULL, observed_exposure REAL NOT NULL);
        """)
        db.execute("BEGIN IMMEDIATE")
        db.execute("DELETE FROM disruption_reference_tasks")
        db.execute("DELETE FROM disruption_reference_occupations")
        db.executemany("""INSERT INTO disruption_reference_tasks
                       (soc_code,soc_major,task_id,occupation,task,task_type,normalized_task,penetration)
                       VALUES (?,?,?,?,?,?,?,?)""", indexed)
        db.executemany("INSERT INTO disruption_reference_occupations VALUES (?,?,?)", occupations)
        meta = {"onet_version": onet_version, "onet_source": ONET_URL,
                "anthropic_source": ANTHROPIC_URL, "match_method": MATCH_VERSION,
                "imported_at": imported_at, "onet_rows": len(indexed),
                "anthropic_task_rows": len(penetrations), "anthropic_job_rows": len(occupations),
                "matched_tasks": matched, "files_sha256": checksums}
        db.execute("INSERT OR REPLACE INTO disruption_reference_meta (id,payload) VALUES (1,?)", (json.dumps(meta),))
    return meta


def reference_status() -> dict:
    try:
        with connection() as db:
            row = db.execute("SELECT payload FROM disruption_reference_meta WHERE id=1").fetchone()
        return {"ready": True, **json.loads(row["payload"])} if row else {"ready": False, "message": "Download and import O*NET and Anthropic datasets"}
    except Exception as e:
        if "no such table" in str(e):
            return {"ready": False, "message": "Reference datasets not yet imported"}
        raise


def occupation_options() -> list[dict]:
    if not reference_status().get("ready"):
        return []
    with connection() as db:
        rows = db.execute("""SELECT t.soc_major, MIN(t.occupation) AS occupation, COUNT(*) AS task_count,
                                   SUM(t.penetration IS NOT NULL) AS matched_count, e.observed_exposure
                             FROM disruption_reference_tasks t
                             LEFT JOIN disruption_reference_occupations e ON t.soc_major=e.soc_major
                             GROUP BY t.soc_major
                             HAVING matched_count >= 3
                             ORDER BY occupation""").fetchall()
    return [{"code":row["soc_major"], "name":row["occupation"], "matched_tasks":int(row["matched_count"]),
             "observed_exposure":row["observed_exposure"]} for row in rows if row["observed_exposure"] is not None]


def occupation_research(occupation_code: str | None, skill: dict) -> dict:
    result = {"status": "not_available", "occupation": None, "tasks": [], "task_matches": 0,
              "source": {"onet": ONET_URL, "anthropic": ANTHROPIC_URL},
              "limitations": "US occupational tasks and Claude usage; not a Malaysia-specific skill replacement risk."}
    if not occupation_code:
        result["status"] = "occupation_needed"
        result["message"] = "Select an occupation for task-level AI usage evidence. A skill alone is not an occupation."
        return result
    if not re.fullmatch(r"\d{2}-\d{4}", occupation_code):
        result["status"] = "occupation_invalid"
        return result
    status = reference_status()
    if not status.get("ready"):
        result["status"] = "sources_not_imported"
        result["message"] = status.get("message")
        return result
    result["source_version"] = status.get("onet_version")
    result["imported_at"] = status.get("imported_at")
    result["reference_sha256"] = status["files_sha256"]
    with connection() as db:
        occ = db.execute("SELECT title,observed_exposure FROM disruption_reference_occupations WHERE soc_major=?", (occupation_code,)).fetchone()
        if not occ:
            result["status"] = "occupation_unknown"
            result["message"] = "No corresponding occupation in the imported Anthropic data"
            return result
        rows = db.execute("""SELECT task_id,task,task_type,penetration FROM disruption_reference_tasks
                             WHERE soc_major=? ORDER BY task_type ASC,task_id ASC""", (occupation_code,)).fetchall()
    result["occupation"] = {"code": occupation_code, "title": occ["title"],
                            "observed_exposure": round(occ["observed_exposure"], 4)}
    terms = SKILL_TASK_TERMS.get(str(skill.get("id", "")), ())
    # For an unknown skill, exact task-token overlap only; conservative, no LLM-guess mapping.
    if not terms:
        tokens = [t for t in re.findall(r"[a-z]{4,}", skill.get("name", "").lower()) if t not in {"with","using","skills","skill"}]
        terms = tuple(tokens)
    if not terms:
        result["status"] = "skill_task_link_missing"
        return result
    matches = []
    for row in rows:
        task_l = row["task"].casefold()
        if row["penetration"] is None or not any(t in task_l for t in terms):
            continue
        matches.append(row)
    # Cap the evidence handed to LLM; sort by O*NET Core task first, without cherry-picking high penetration.
    matches.sort(key=lambda row:(row["task_type"] != "Core",row["task_id"]))
    matches=matches[:8]
    result["task_matches"] = len(matches)
    result["tasks"] = [{"id":f"onet:{occupation_code}:{r['task_id']}", "task":r["task"],
                        "task_type":r["task_type"], "anthropic_task_penetration":round(r["penetration"],4),
                        "source": "O*NET task + Anthropic observed Claude task usage"} for r in matches]
    positive = sum(r["penetration"] > 0 for r in matches)
    # A zero-penetration observation does NOT establish that a task is safe
    # from AI; require positive observed-use evidence before calling an LLM.
    result["positive_usage_tasks"] = positive
    result["status"] = "task_evidence_available" if len(matches) >= 2 and positive >= 1 else "skill_task_link_insufficient"
    return result

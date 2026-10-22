"""Discover conservative skill links from retained source tasks, not pair rules."""

from __future__ import annotations

import hashlib
import json
import re
from collections import defaultdict
from datetime import datetime, timezone

from src.data.ai_capabilities import CAPABILITIES
from src.data.employment_source import SOURCE_ID
from src.data.signal_contexts import role_family_for_title
from src.data.skills_taxonomy import SKILLS
from src.services.employment_service import get_employment_dashboard
from src.services.storage import connection, initialize_database

EXTRACTION_VERSION = "task-evidence-v4"
CONNECTION_VERSION = "dynamic-connections-v1"
TASK_VERBS = re.compile(r"\b(?:build|develop|design|evaluate|test|create|implement|integrate|use|apply|manage|analy[sz]e|automate|improve|deploy|work(?:ing)? with)\b", re.I)
FORBIDDEN_CLAIMS = re.compile(r"\b(?:replac\w*|forecast\w*|predict\w*|rising|growth|declin\w*|correlat\w*|guarantee\w*)\b|\d+\s*%", re.I)


def _json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _hash(value: object) -> str:
    return hashlib.sha256(_json(value).encode()).hexdigest()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _contains(text: str, term: str) -> bool:
    return bool(re.search(r"(?<!\w)" + re.escape(term) + r"(?!\w)", text, re.I))


def _sentences(text: str) -> list[str]:
    return [part.strip() for part in re.split(r"(?<=[.!?;])\s+|(?<=:)\s+", text)
            if 20 <= len(part.strip()) <= 360]


def _skills_in(quote: str, extra_skills: tuple[tuple[str, str], ...] = ()) -> list[dict]:
    found = []
    for skill in SKILLS:
        alias = next((name for name in (skill["name"], *skill["aliases"]) if _contains(quote, name)), None)
        if alias:
            found.append({"id": skill["id"], "name": skill["name"], "observed_term": alias})
    for key, name in extra_skills:
        if _contains(quote, name) and key not in {item["id"] for item in found}:
            found.append({"id": key, "name": name, "observed_term": name})
    return found


def _capabilities_in(quote: str) -> list[dict]:
    return [{"id": key, "name": name, "definition": definition, "observed_term": alias}
            for key, name, definition, aliases in CAPABILITIES
            if (alias := next((term for term in aliases if _contains(quote, term)), None))]


def _source_skills(job, extra_skills: tuple[tuple[str, str], ...] = ()) -> list[dict]:
    names = [(skill["id"], skill["name"], (skill["name"], *skill["aliases"])) for skill in SKILLS]
    names.extend((key, name, (name,)) for key, name in extra_skills)
    found = []
    for key, name, aliases in names:
        matched = next((re.search(r"(?<!\w)" + re.escape(alias) + r"(?!\w)", job.evidence_text, re.I)
                        for alias in aliases if _contains(job.evidence_text, alias)), None)
        if not matched:
            continue
        quote = next((sentence for sentence in _sentences(job.evidence_text) if _contains(sentence, matched.group())), None)
        if quote is None:
            start, end = max(0, matched.start() - 75), min(len(job.evidence_text), matched.end() + 105)
            quote = job.evidence_text[start:end].strip()
        found.append({"id": key, "name": name, "observed_term": matched.group(), "quote": quote})
    return found


def extract_document(job, extra_skills: tuple[tuple[str, str], ...] = ()) -> dict:
    """Exact, same-task extraction; a skill word elsewhere in a posting is insufficient."""
    tasks = []
    for quote in _sentences(job.evidence_text):
        if not TASK_VERBS.search(quote):
            continue
        skills, capabilities = _skills_in(quote, extra_skills), _capabilities_in(quote)
        if skills or capabilities:
            tasks.append({"quote": quote, "skills": skills, "ai_capabilities": capabilities})
    return {"document_id": job.source_job_id, "role_family": role_family_for_title(job.title),
            "source_skills": _source_skills(job, extra_skills), "tasks": tasks[:24],
            "origin": "exact passage extraction"}


def validate_extraction(payload: dict, job) -> dict:
    if not isinstance(payload, dict) or payload.get("document_id") != job.source_job_id or not isinstance(payload.get("tasks"), list):
        raise ValueError("Invalid source extraction.")
    if len(payload["tasks"]) > 24:
        raise ValueError("Too many extracted tasks.")
    if not isinstance(payload.get("source_skills"), list) or len(payload["source_skills"]) > 40:
        raise ValueError("Invalid source skill list.")
    for skill in payload["source_skills"]:
        if not isinstance(skill, dict) or not isinstance(skill.get("quote"), str) or skill["quote"] not in job.evidence_text:
            raise ValueError("Source skill quote is absent.")
        if not _contains(skill["quote"], skill.get("observed_term", "")):
            raise ValueError("Source skill is absent from its quote.")
    for task in payload["tasks"]:
        quote = task.get("quote") if isinstance(task, dict) else None
        if not isinstance(quote, str) or quote not in job.evidence_text or not TASK_VERBS.search(quote):
            raise ValueError("Task passage is not supported by the retained source.")
        for field in ("skills", "ai_capabilities"):
            if not isinstance(task.get(field), list) or len(task[field]) > 12:
                raise ValueError("Invalid extracted capability list.")
            for item in task[field]:
                if not isinstance(item, dict) or not all(isinstance(item.get(key), str) and item[key] for key in ("id", "name", "observed_term")):
                    raise ValueError("Invalid extracted capability.")
                if not _contains(quote, item["observed_term"]):
                    raise ValueError("Capability is absent from its quoted task.")
                if field == "ai_capabilities" and not isinstance(item.get("definition"), str):
                    raise ValueError("AI capability definition is missing.")
    return payload


def _document_payload(job) -> dict:
    return {key: value for key, value in job.model_dump(mode="json").items() if key != "retrieved_at"}


def _candidate_support(extracted: dict, task: dict) -> list[tuple[str, str, dict, dict]]:
    return [(skill["id"], capability["id"], skill, capability)
            for skill in extracted["source_skills"] for capability in task["ai_capabilities"]
            if skill["name"].casefold() != capability["name"].casefold()
            and skill["id"] != capability["id"]]


def _evidence(job, task: dict, skill: dict) -> dict:
    return {"id": f"{SOURCE_ID}:{job.source_job_id}", "document_id": job.source_job_id,
            "title": job.title, "company": job.company, "url": job.source_url,
            "published_at": job.published_at, "source_quote": skill["quote"], "ai_quote": task["quote"],
            "source": "Remote OK"}


def _make_connection(key: tuple[str, str], support: list[tuple], jobs: list,
                     collected_at: str | None, version: str) -> dict:
    direct_support = [row for row in support if _contains(row[1]["quote"], row[2]["observed_term"])]
    if direct_support:
        support = direct_support
    skill = support[0][2]
    capability = support[0][3]
    role_families = sorted({role_family_for_title(job.title) for job, *_ in support if role_family_for_title(job.title)})
    role_jobs = [job for job in jobs if not role_families or role_family_for_title(job.title) in role_families]
    denominator = sum(any(mention.skill_id == key[0] for mention in job.skill_mentions) or
                      _contains(job.evidence_text, skill["observed_term"]) for job in role_jobs)
    distinct = {job.source_job_id: (job, task, source_skill) for job, task, source_skill, _ in support}
    numerator = len(distinct)
    metric = {"kind": "conditional_cooccurrence", "numerator": numerator, "denominator": denominator,
              "unit": "unique postings in this role scope"} if denominator >= numerator and denominator else None
    evidence = [_evidence(job, task, source_skill) for job, task, source_skill in
                sorted(distinct.values(), key=lambda pair: pair[0].published_at, reverse=True)[:4]]
    direct = bool(direct_support)
    verb = TASK_VERBS.search(evidence[0]["ai_quote"])
    task_label = evidence[0]["ai_quote"][verb.start():verb.end()].capitalize() + " work" if verb else "Work in the cited task"
    explanation = (f"A sampled task names {skill['name']} with {capability['name']}. Check the cited work passage."
                   if direct else
                   f"These sampled roles list {skill['name']} and describe {capability['name']} work; the skill's role in that work is an inference.")
    return {"id": _hash(key)[:20], "evidence_version": version, "current_skill_id": key[0],
            "current_skill_name": skill["name"], "ai_skill": {"id": key[1], "name": capability["name"],
            "definition": capability["definition"]}, "relationship": "builds_on", "work_task": task_label,
            "explanation": explanation, "interpretation_origin": "source-grounded template",
            "role_families": role_families, "basis": "same_task_passage" if direct else "same_posting",
            "extraction_version": EXTRACTION_VERSION, "prompt_version": None, "model_version": None,
            "source_document_ids": [item["id"] for item in evidence], "evidence": evidence,
            "metric": metric, "employer_count": len({job.company.strip().casefold() for job, *_ in support}),
            "observation_period": {"from": min(job.published_at for job, *_ in support),
                                   "to": max(job.published_at for job, *_ in support)},
            "source": {"name": "Remote OK", "url": "https://remoteok.com/api", "collected_at": collected_at,
                       "scope": f"Bounded mixed-location remote feed · {len(role_jobs)} postings in this role scope"},
            "limitations": ("The same task passage supports an application of the listed skill, not demand growth, causation, or replacement."
                            if direct else "The postings list the skill and AI work in separate passages. Their pairing does not establish how the skill is used or whether work changes.")}


def process_skill_connections() -> dict:
    """Reuse unchanged document extractions and atomically publish a new evidence version."""
    initialize_database()
    employment = get_employment_dashboard()
    jobs = list({job.source_job_id: job for job in employment.jobs}.values())
    with connection() as db:
        model_keys = [row["cache_key"] for row in db.execute(
            "SELECT cache_key FROM signal_model_extractions WHERE source_id = ? AND extraction_version = ? ORDER BY cache_key",
            (SOURCE_ID, EXTRACTION_VERSION))]
    version = _hash({"documents": sorted((job.source_job_id, _hash(_document_payload(job))) for job in jobs),
                     "versions": [EXTRACTION_VERSION, CONNECTION_VERSION], "model_keys": model_keys})
    with connection() as db:
        db.execute("BEGIN IMMEDIATE")
        state = db.execute("SELECT evidence_version FROM signal_connection_state WHERE id = 1").fetchone()
        if state and state["evidence_version"] == version:
            return {"status": "unchanged", "evidence_version": version}
        support = defaultdict(list)
        processed = 0
        for job in jobs:
            content_hash = _hash(_document_payload(job))
            cached = db.execute("SELECT payload FROM signal_connection_extractions WHERE source_id = ? AND document_id = ? "
                                "AND content_hash = ? AND extraction_version = ?",
                                (SOURCE_ID, job.source_job_id, content_hash, EXTRACTION_VERSION)).fetchone()
            if cached:
                extracted = validate_extraction(json.loads(cached["payload"]), job)
            else:
                extracted = extract_document(job)
                db.execute("INSERT INTO signal_connection_extractions "
                           "(source_id, document_id, content_hash, extraction_version, payload, processed_at) "
                           "VALUES (?, ?, ?, ?, ?, ?)",
                           (SOURCE_ID, job.source_job_id, content_hash, EXTRACTION_VERSION, _json(extracted), _now()))
                processed += 1
            model_rows = db.execute("SELECT payload FROM signal_model_extractions WHERE source_id = ? AND document_id = ? "
                                    "AND content_hash = ? AND extraction_version = ?",
                                    (SOURCE_ID, job.source_job_id, content_hash, EXTRACTION_VERSION)).fetchall()
            tasks = list(extracted["tasks"])
            for row in model_rows:
                model_extraction = validate_extraction(json.loads(row["payload"]), job)
                tasks.extend(task for task in model_extraction["tasks"] if task not in tasks)
            combined = {**extracted, "source_skills": list(extracted["source_skills"])}
            for row in model_rows:
                model_extraction = validate_extraction(json.loads(row["payload"]), job)
                combined["source_skills"].extend(skill for skill in model_extraction["source_skills"]
                                                 if skill not in combined["source_skills"])
            for task in tasks:
                for skill_id, capability_id, skill, capability in _candidate_support(combined, task):
                    support[(skill_id, capability_id)].append((job, task, skill, capability))
        published = 0
        for key, rows in support.items():
            item = _make_connection(key, rows, jobs, employment.last_successful_refresh, version)
            direct = item["basis"] == "same_task_passage"
            if not item["metric"] or not item["evidence"] or (not direct and item["employer_count"] < 2):
                db.execute("INSERT OR REPLACE INTO signal_connection_reviews "
                           "(cache_key, connection_id, evidence_version, status, payload, created_at) "
                           "VALUES (?, ?, ?, 'pending', ?, ?)",
                           (_hash([version, key]), item["id"], version,
                            _json({"reason": "Insufficient same-task or independent-employer support", "candidate": item}), _now()))
                continue
            db.execute("INSERT INTO signal_connections (evidence_version, connection_id, current_skill_id, payload) "
                       "VALUES (?, ?, ?, ?)", (version, item["id"], key[0], _json(item)))
            published += 1
        db.execute("UPDATE signal_connection_state SET evidence_version = ?, processed_at = ?, last_error = NULL WHERE id = 1",
                   (version, _now()))
    return {"status": "processed", "evidence_version": version, "documents_processed": processed,
            "connections": published}


def get_saved_skill_connections() -> tuple[str | None, list[dict]]:
    initialize_database()
    with connection() as db:
        state = db.execute("SELECT evidence_version FROM signal_connection_state WHERE id = 1").fetchone()
        version = state["evidence_version"] if state else None
        rows = db.execute("SELECT payload FROM signal_connections WHERE evidence_version = ?", (version,)).fetchall() if version else []
    return version, [json.loads(row["payload"]) for row in rows]

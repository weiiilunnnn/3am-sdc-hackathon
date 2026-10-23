"""Deduplicated, bounded background discovery requests for uncovered profile skills."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone

from src.data.skills_taxonomy import find_skill_by_id
from src.services.connection_model import enabled, prepare_connection_explanation, prepare_model_extraction
from src.services.signal_employment_service import get_signal_employment_dashboard
from src.services.skill_connections import _contains, get_saved_skill_connections, process_skill_connections
from src.services.storage import connection, initialize_database


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _key(skill_id: str, role: str | None, version: str) -> str:
    return hashlib.sha256(json.dumps([skill_id, role, version], sort_keys=True).encode()).hexdigest()


def queue_discovery_job(skill_id: str, skill_name: str, role: str | None, version: str | None) -> str:
    if not enabled() or not version:
        return "not_configured"
    initialize_database()
    key = _key(skill_id, role, version)
    with connection() as db:
        db.execute("INSERT OR IGNORE INTO signal_discovery_jobs "
                   "(job_key, skill_id, skill_name, role_context, evidence_version, status, created_at, updated_at) "
                   "VALUES (?, ?, ?, ?, ?, 'queued', ?, ?)",
                   (key, skill_id, skill_name[:120], role, version, _now(), _now()))
        row = db.execute("SELECT status FROM signal_discovery_jobs WHERE job_key = ?", (key,)).fetchone()
    return row["status"]


def process_discovery_jobs(batch_limit: int = 2) -> dict:
    if not enabled():
        return {"status": "disabled", "processed": 0}
    initialize_database()
    with connection() as db:
        pending = db.execute("SELECT * FROM signal_discovery_jobs WHERE status = 'queued' "
                             "ORDER BY created_at, job_key LIMIT ?", (max(0, min(batch_limit, 2)),)).fetchall()
    processed = 0
    for row in pending:
        taxonomy = find_skill_by_id(row["skill_id"])
        aliases = (row["skill_name"], *(taxonomy["aliases"] if taxonomy else []))
        candidates = [job for job in get_signal_employment_dashboard().jobs if job.evidence_text and
                      any(_contains(job.evidence_text, alias) for alias in aliases) and
                      any(word in job.evidence_text.casefold() for word in ("ai agent", "llm", "machine learning", "model evaluation", "retrieval"))]
        candidates = candidates[:2]
        outcomes = [prepare_model_extraction(job.source_job_id)["status"] for job in candidates]
        if candidates and all(outcome in {"generated", "cached"} for outcome in outcomes):
            process_skill_connections()
            _, saved = get_saved_skill_connections()
            matching = [item for item in saved if item["current_skill_id"] == row["skill_id"]]
            if matching:
                prepare_connection_explanation(matching[0]["id"])
            status = "processed" if matching else "insufficient_evidence"
        elif not candidates:
            status = "no_source_coverage"
        else:
            status = "deferred"  # A new evidence version can be queued later; no retry loop.
        with connection() as db:
            db.execute("UPDATE signal_discovery_jobs SET status = ?, attempts = attempts + 1, updated_at = ? "
                       "WHERE job_key = ? AND status = 'queued'", (status, _now(), row["job_key"]))
        processed += 1
    return {"status": "processed", "processed": processed}

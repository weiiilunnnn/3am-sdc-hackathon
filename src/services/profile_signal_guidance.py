"""Optional, cached profile-specific wording for directly evidenced AI tasks."""

from __future__ import annotations

import hashlib
import json
import re

from src.services.connection_model import _run, enabled, model_name
from src.services.skill_connections import FORBIDDEN_CLAIMS, get_saved_skill_connections
from src.services.storage import connection, initialize_database
from src.services.trend_experience import get_active_profile

PROMPT_VERSION = "profile-task-guidance-v1"


def _key(profile: dict, item: dict) -> str:
    context = {"occupation": profile["occupation"], "tasks": profile.get("work_tasks", [])[:4],
               "skill": item["current_skill_id"], "ai_skill": item["ai_skill"]["id"],
               "evidence_version": item["evidence_version"], "prompt": PROMPT_VERSION,
               "model": model_name()}
    return hashlib.sha256(json.dumps(context, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def cached_guidance(profile: dict, item: dict) -> dict | None:
    initialize_database()
    with connection() as db:
        row = db.execute("SELECT payload FROM signal_profile_guidance WHERE cache_key = ? AND status = 'supported'",
                         (_key(profile, item),)).fetchone()
    return json.loads(row["payload"]) if row and row["payload"] else None


def queue_guidance(profile: dict, item: dict) -> None:
    if not enabled() or item["basis"] != "same_task_passage":
        return
    initialize_database()
    with connection() as db:
        db.execute("INSERT OR IGNORE INTO signal_profile_guidance "
                   "(cache_key, evidence_version, status, payload, created_at, updated_at) "
                   "VALUES (?, ?, 'queued', ?, datetime('now'), datetime('now'))",
                   (_key(profile, item), item["evidence_version"], json.dumps({
                       "profile": {"occupation": profile["occupation"],
                                   "work_tasks": profile.get("work_tasks", [])[:4]},
                       "connection_id": item["id"]})))


def validate_guidance(output: dict, item: dict) -> dict:
    if not isinstance(output, dict) or output.get("status") not in {"supported", "insufficient_evidence"}:
        raise ValueError("Invalid model status")
    if output["status"] == "insufficient_evidence":
        return {"status": "insufficient_evidence"}
    explanation = output.get("explanation")
    ids = output.get("evidence_ids")
    allowed = {row["id"] for row in item["evidence"]}
    if (not isinstance(explanation, str) or not 40 <= len(explanation) <= 280 or
            FORBIDDEN_CLAIMS.search(explanation) or re.search(r"\b(?:will|must|proves?|guaranteed|all|every)\b", explanation, re.I) or
            not re.search(r"\b(?:may|might|could)\b", explanation, re.I)):
        raise ValueError("Unsupported guidance wording")
    if not isinstance(ids, list) or not ids or any(value not in allowed for value in ids):
        raise ValueError("Guidance cites unknown evidence")
    if item["basis"] != "same_task_passage":
        raise ValueError("A separate-passage pair cannot support task guidance")
    return {"status": "supported", "explanation": explanation.strip(),
            "evidence_ids": list(dict.fromkeys(ids)), "model": model_name()}


def process_guidance_jobs(limit: int = 1) -> dict:
    if not enabled():
        return {"status": "disabled", "processed": 0}
    initialize_database()
    with connection() as db:
        rows = db.execute("SELECT cache_key, payload FROM signal_profile_guidance WHERE status = 'queued' "
                          "ORDER BY created_at, cache_key LIMIT ?", (max(0, min(limit, 1)),)).fetchall()
    _, saved = get_saved_skill_connections()
    by_id = {item["id"]: item for item in saved}
    processed = 0
    for row in rows:
        context = json.loads(row["payload"])
        item = by_id.get(context["connection_id"])
        if item is None or item["basis"] != "same_task_passage":
            status, payload = "stale", None
        else:
            facts = {"profile": context["profile"], "current_skill": item["current_skill_name"],
                     "ai_skill": item["ai_skill"]["name"], "task": item["work_task"],
                     "evidence": [{"id": evidence["id"], "quote": evidence["ai_quote"][:260]}
                                  for evidence in item["evidence"][:2]]}
            call_status, output = _run(facts, (
                "Return JSON: status supported or insufficient_evidence. If supported, give a concise "
                "explanation and evidence_ids. Explain a POSSIBLE application of the person's listed skill "
                "to the quoted AI task in their occupation. Clearly distinguish the posting's observation "
                "from your interpretation. Do not claim the person already has the AI skill, that an employer "
                "uses their skill in this exact way, or that adoption, demand or replacement is proven. "
                "If profile relevance or task linkage is weak, return insufficient_evidence."
            ))
            if call_status != "generated":
                # Budget or provider failure is retried on a later background pass, never during a GET.
                return {"status": call_status, "processed": processed}
            try:
                payload = validate_guidance(output, item)
                status = payload["status"]
            except ValueError:
                status, payload = "rejected", None
        with connection() as db:
            db.execute("UPDATE signal_profile_guidance SET status = ?, payload = ?, updated_at = datetime('now') "
                       "WHERE cache_key = ? AND status = 'queued'",
                       (status, json.dumps(payload) if payload else None, row["cache_key"]))
        processed += 1
    return {"status": "processed", "processed": processed}

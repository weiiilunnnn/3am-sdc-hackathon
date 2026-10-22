"""Versioned, conservative skill connections extracted from saved job passages."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone

from src.data.employment_source import SOURCE_ID
from src.data.signal_contexts import role_family_for_title
from src.data.skill_connection_rules import MAPPING_VERSION, RULES, ConnectionRule
from src.services.employment_service import get_employment_dashboard
from src.services.storage import connection, initialize_database

EXTRACTION_VERSION = "connection-passages-v3"
CONNECTION_VERSION = "supported-connections-v1"
_RULES = {rule.id: rule for rule in RULES}


def _json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _hash(value: object) -> str:
    return hashlib.sha256(_json(value).encode()).hexdigest()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _match(text: str, terms: tuple[str, ...]) -> re.Match[str] | None:
    return next((found for term in terms if (
        found := re.search(r"(?<!\w)" + re.escape(term) + r"(?!\w)", text, re.I)
    )), None)


def _passage(text: str, matched: re.Match[str]) -> str:
    start = max(0, matched.start() - 85)
    end = min(len(text), matched.end() + 125)
    if start and not text[start - 1].isspace():
        boundary = re.search(r"\s", text[start:matched.start()])
        if boundary:
            start += boundary.end()
    if end < len(text) and not text[end].isspace():
        boundaries = list(re.finditer(r"\s", text[matched.end():end]))
        if boundaries:
            end = matched.end() + boundaries[-1].start()
    return text[start:end].strip()


def extract_connection_passages(job) -> list[dict]:
    """Require both concepts in the *same retained description*, then quote both."""
    if not job.evidence_text:
        return []
    matches = []
    for rule in RULES:
        if rule.role_family and role_family_for_title(job.title) != rule.role_family:
            continue
        source = _match(job.evidence_text, rule.source_terms)
        target = _match(job.evidence_text, rule.target_terms)
        if not source or not target:
            continue
        source_quote, target_quote = _passage(job.evidence_text, source), _passage(job.evidence_text, target)
        if source_quote not in job.evidence_text or target_quote not in job.evidence_text:
            continue
        matches.append({
            "rule_id": rule.id, "source_term": source.group(), "ai_term": target.group(),
            "source_quote": source_quote, "ai_quote": target_quote,
            "required_status": None, "role_family": rule.role_family,
            "method": "exact phrase passage extraction",
        })
    return matches


def validate_connection_extraction(payload: dict, evidence_text: str, document_id: str) -> list[dict]:
    """Also validates optional model extractions before they can be retained."""
    if payload.get("document_id") != document_id or not isinstance(payload.get("matches"), list):
        raise ValueError("Extraction document ID or schema is invalid.")
    accepted = []
    for match in payload["matches"]:
        if not isinstance(match, dict) or match.get("rule_id") not in _RULES:
            raise ValueError("Extraction refers to an unknown connection.")
        if match.get("required_status") not in (None, "required", "preferred"):
            raise ValueError("Unsupported requirement status.")
        for key in ("source_quote", "ai_quote"):
            quote = match.get(key)
            if not isinstance(quote, str) or not quote.strip() or quote not in evidence_text:
                raise ValueError("Extraction quote is absent from the normalized source.")
        rule = _RULES[match["rule_id"]]
        if not _match(match["source_quote"], rule.source_terms) or not _match(match["ai_quote"], rule.target_terms):
            raise ValueError("Extraction quote does not support the proposed connection.")
        accepted.append(match)
    return accepted


def _document_payload(job) -> dict:
    return {key: value for key, value in job.model_dump(mode="json").items() if key != "retrieved_at"}


def _evidence(job, match: dict) -> dict:
    return {
        "id": f"{SOURCE_ID}:{job.source_job_id}", "document_id": job.source_job_id,
        "title": job.title, "company": job.company, "url": job.source_url,
        "published_at": job.published_at, "source_quote": match["source_quote"],
        "ai_quote": match["ai_quote"], "source_term": match["source_term"],
        "ai_term": match["ai_term"], "source": "Remote OK",
    }


def _make_connection(rule: ConnectionRule, support: list[tuple], jobs: list, collected_at: str | None,
                     version: str) -> dict:
    # Stable IDs are deduplicated upstream. The conditional metric applies only to a
    # literal source-skill mention, never to the editorial database-task analogy.
    role_jobs = [job for job in jobs if not rule.role_family or role_family_for_title(job.title) == rule.role_family]
    explicit = rule.basis == "same_posting"
    denominator = sum(rule.current_skill_id in {m.skill_id for m in job.skill_mentions} for job in role_jobs) if explicit else None
    metric = {
        "kind": "conditional_cooccurrence", "numerator": len(support),
        "denominator": denominator, "unit": "unique title-matched postings",
        "description": "Postings with both exact passages among those mentioning the existing skill.",
    } if explicit and denominator and denominator >= len(support) else None
    evidence = [_evidence(job, match) for job, match in sorted(
        support, key=lambda pair: pair[0].published_at, reverse=True
    )[:4]]
    return {
        "id": rule.id, "evidence_version": version,
        "current_skill_id": rule.current_skill_id,
        "ai_skill": {"id": rule.ai_skill_id, "name": rule.ai_skill_name, "definition": rule.definition},
        "relationship": rule.relationship, "work_task": rule.task,
        "explanation": rule.explanation, "interpretation_origin": "reviewed template",
        "role_families": [rule.role_family] if rule.role_family else [],
        "basis": rule.basis, "mapping_version": MAPPING_VERSION,
        "extraction_version": EXTRACTION_VERSION, "prompt_version": None, "model_version": None,
        "source_document_ids": [item["id"] for item in evidence],
        "evidence": evidence, "metric": metric,
        "employer_count": len({job.company.strip().casefold() for job, _ in support}),
        "observation_period": {"from": min(job.published_at for job, _ in support),
                               "to": max(job.published_at for job, _ in support)},
        "source": {"name": "Remote OK", "url": "https://remoteok.com/api",
                   "collected_at": collected_at,
                   "scope": (f"Bounded mixed-location remote feed · {len(role_jobs)} title-matched software roles"
                             if rule.role_family else f"Bounded mixed-location remote feed · {len(role_jobs)} retained posts")},
        "limitations": (
            "The database-search connection is an interpretation of a shared data task; the posting does not name the profile skill."
            if rule.basis == "shared_data_task" else
            "These postings show a current skill/task pairing, not a hiring trend or proof that one skill replaces another."
        ),
    }


def process_skill_connections() -> dict:
    """Process changed documents once, then atomically publish saved connections."""
    initialize_database()
    employment = get_employment_dashboard()
    jobs = list({job.source_job_id: job for job in employment.jobs}.values())
    with connection() as db:
        model_keys = [row["cache_key"] for row in db.execute(
            "SELECT cache_key FROM signal_model_extractions WHERE source_id = ? AND extraction_version = ? ORDER BY cache_key",
            (SOURCE_ID, EXTRACTION_VERSION),
        )]
    version = _hash({
        "documents": sorted((job.source_job_id, _hash(_document_payload(job))) for job in jobs),
        "rules": [MAPPING_VERSION, EXTRACTION_VERSION, CONNECTION_VERSION], "model_keys": model_keys,
    })
    with connection() as db:
        db.execute("BEGIN IMMEDIATE")
        state = db.execute("SELECT evidence_version FROM signal_connection_state WHERE id = 1").fetchone()
        if state and state["evidence_version"] == version:
            return {"status": "unchanged", "evidence_version": version}
        now = _now()
        supported: dict[str, list[tuple]] = {rule.id: [] for rule in RULES}
        processed = 0
        for job in jobs:
            content_hash = _hash(_document_payload(job))
            cached = db.execute(
                "SELECT payload FROM signal_connection_extractions WHERE source_id = ? AND document_id = ? "
                "AND content_hash = ? AND extraction_version = ?",
                (SOURCE_ID, job.source_job_id, content_hash, EXTRACTION_VERSION),
            ).fetchone()
            if cached:
                matches = validate_connection_extraction(json.loads(cached["payload"]), job.evidence_text, job.source_job_id)
            else:
                matches = extract_connection_passages(job)
                payload = {"document_id": job.source_job_id, "role_family": role_family_for_title(job.title),
                           "matches": matches, "method": "deterministic", "model_version": None}
                db.execute(
                    "INSERT INTO signal_connection_extractions "
                    "(source_id, document_id, content_hash, extraction_version, payload, processed_at) "
                    "VALUES (?, ?, ?, ?, ?, ?)",
                    (SOURCE_ID, job.source_job_id, content_hash, EXTRACTION_VERSION, _json(payload), now),
                )
                processed += 1
            # Explicit operator-prepared model extractions may add validated passages.
            model_rows = db.execute(
                "SELECT payload FROM signal_model_extractions WHERE source_id = ? AND document_id = ? "
                "AND content_hash = ? AND extraction_version = ?",
                (SOURCE_ID, job.source_job_id, content_hash, EXTRACTION_VERSION),
            ).fetchall()
            for row in model_rows:
                for model_match in validate_connection_extraction(json.loads(row["payload"]), job.evidence_text, job.source_job_id):
                    if model_match["rule_id"] not in {item["rule_id"] for item in matches}:
                        matches.append(model_match)
            for match in matches:
                supported[match["rule_id"]].append((job, match))
        published = 0
        for rule in RULES:
            if not supported[rule.id]:
                continue
            item = _make_connection(rule, supported[rule.id], jobs, employment.last_successful_refresh, version)
            db.execute(
                "INSERT INTO signal_connections (evidence_version, connection_id, current_skill_id, payload) "
                "VALUES (?, ?, ?, ?)",
                (version, rule.id, rule.current_skill_id, _json(item)),
            )
            published += 1
        db.execute(
            "UPDATE signal_connection_state SET evidence_version = ?, processed_at = ?, last_error = NULL WHERE id = 1",
            (version, now),
        )
    return {"status": "processed", "evidence_version": version,
            "documents_processed": processed, "connections": published}


def get_saved_skill_connections() -> tuple[str | None, list[dict]]:
    initialize_database()
    with connection() as db:
        state = db.execute("SELECT evidence_version FROM signal_connection_state WHERE id = 1").fetchone()
        version = state["evidence_version"] if state else None
        rows = db.execute("SELECT payload FROM signal_connections WHERE evidence_version = ?",
                          (version,)).fetchall() if version else []
    return version, [json.loads(row["payload"]) for row in rows]

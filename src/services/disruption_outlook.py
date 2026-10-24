"""Evidence-limited AI skill transformation outlook.

An assessment is a *provisional LLM interpretation of sampled tasks*, not an
observed replacement rate, automation forecast, or validated labour-market index.
Only the selected skill and published source passages are sent to RunPod.
"""
from __future__ import annotations

import hashlib
import json
import re
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field

from src.data.ai_capabilities import CAPABILITIES
from src.data.signal_contexts import role_family_for_profile
from src.data.skills_taxonomy import find_skill_by_id, find_skill_by_label
from src.services.connection_model import _run, model_name
from src.services.session_signal_adapter import SessionSignalProfile, _resolved_skill
from src.services.signal_employment_service import get_signal_employment_dashboard
from src.services.skill_connections import get_saved_skill_connections, _contains
from src.services.storage import connection, initialize_database
from src.services.disruption_reference import occupation_research


CATEGORIES = {"minimal", "assisted", "hybrid", "full", "insufficient_evidence"}
PROMPT_VERSION = "outlook-v2-1-citation-contract"
MAX_EVIDENCE = 3


class DisruptionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    profile: SessionSignalProfile
    skill_id: str = Field(min_length=1, max_length=180)
    occupation_code: str | None = Field(default=None, pattern=r"^\d{2}-\d{4}$")


def _selected(request: DisruptionRequest) -> dict:
    # The profile may contain a verified ESCO URI from CV registration, while
    # the legacy Trend Signal resolver maps only its small local vocabulary.
    # Match the resolver's canonical key first, but also accept the *exact*
    # skill ID attached to a named skill in THIS request's profile. Use the
    # backend-resolved identity downstream; never use an unverified URI to
    # fabricate evidence or to look up unrelated users' data.
    known = {_resolved_skill(item)["key"]: _resolved_skill(item) for item in request.profile.skills}
    selected = known.get(request.skill_id)
    if selected is None:
        for original in request.profile.skills:
            if original.skill_id and original.skill_id == request.skill_id:
                selected = _resolved_skill(original)
                break
    if selected is None:
        raise ValueError("Selected skill is not in this session's profile.")
    return selected


def _aliases(selected: dict) -> tuple[str, ...]:
    taxonomy = find_skill_by_id(selected["id"]) if selected["id"] else find_skill_by_label(selected["name"])
    base = [selected["name"]]
    if taxonomy:
        base.extend(str(alias) for alias in taxonomy.get("aliases", []))
    # Do not count short aliases such as ML alone, which would inflate samples.
    return tuple(dict.fromkeys(a for a in base if len(a.strip()) >= 3))


def _has(text: str, words: tuple[str, ...]) -> bool:
    return any(_contains(text, name) for name in words)


def _capabilities(text: str) -> bool:
    return any(_has(text, tuple(aliases)) for _, _, _, aliases in CAPABILITIES)


def _valid_url(value: str) -> bool:
    p = urlparse(value)
    return p.scheme == "https" and bool(p.hostname) and p.hostname not in {"localhost", "127.0.0.1"}


def _job_evidence(selected: dict, saved: list[dict], role_family: str | None) -> list[dict]:
    """Use publisher-retained quotes, not client-submitted or model-created quotes."""
    candidates = [item for item in saved if selected["id"] and item.get("current_skill_id") == selected["id"]]
    candidates.sort(key=lambda item: (bool(role_family and role_family not in item.get("role_families", [])),
                                      item.get("basis") != "same_task_passage", -(item.get("employer_count") or 0)))
    result: list[dict] = []
    seen: set[str] = set()
    for item in candidates:
        for e in item.get("evidence", []):
            key = str(e.get("id", ""))
            existing = str(e.get("source_quote", "")).strip()[:220]
            ai = str(e.get("ai_quote", "")).strip()[:220]
            url = str(e.get("url", ""))
            if key in seen or not existing or not ai or not _valid_url(url):
                continue
            seen.add(key)
            result.append({
                "id": key, "title": str(e.get("title", "Job posting"))[:100],
                "company": str(e.get("company", ""))[:100], "url": url,
                "skill_passage": existing, "ai_passage": ai,
                "basis": item.get("basis", "same_posting"),
                "within_role_context": bool(role_family and role_family in item.get("role_families", [])),
                "ai_capability": str(item.get("ai_skill", {}).get("name", ""))[:100],
            })
            if len(result) == MAX_EVIDENCE:
                return result
    return result


def _rate(jobs: list, aliases: tuple[str, ...]) -> dict:
    n = len(jobs)
    existing = sum(_has(job.evidence_text, aliases) for job in jobs)
    ai = sum(_capabilities(job.evidence_text) for job in jobs)
    return {"sample": n, "skill_count": existing, "ai_count": ai,
            "skill_share": round(100 * existing / n, 2) if n else 0,
            "ai_share": round(100 * ai / n, 2) if n else 0}


def _chart(aliases: tuple[str, ...], jobs: list, source_id: str) -> dict:
    if not jobs:
        return {"mode": "unavailable", "source": "Himalayas", "reason": "No saved job postings in the local database."}
    # Existing source utility checks for >=60 days of distinct snapshots,
    # period sizes and adequate capability coverage. Still require enough
    # mentions of BOTH selected series before drawing a trend.
    history = None
    if source_id == "remoteok":
        try:
            from src.services.ai_skill_exploration import _history_windows
            history = _history_windows(source_id)
        except (ValueError, KeyError, TypeError):
            history = None
    if history:
        earlier = _rate(list(history[0]), aliases)
        recent = _rate(list(history[1]), aliases)
        if min(earlier["sample"], recent["sample"]) >= 30 and min(
            earlier["skill_count"], recent["skill_count"], earlier["ai_count"], recent["ai_count"]
        ) >= 5:
            return {"mode": "historical", "source": "Himalayas", "label": "Two observed 30-day posting windows",
                    "periods": [{"label": "Earlier period", **earlier}, {"label": "Recent period", **recent}],
                    "caution": "Comparative shares in sampled postings are not proof of replacement or future demand."}
    return {"mode": "snapshot", "source": "Himalayas", "label": "Current saved posting sample",
            "current": _rate(jobs, aliases),
            "caution": "Only one comparable sample is available. These bars are NOT a time trend; the same posting can mention both skills."}


def evidence_for(request: DisruptionRequest) -> dict:
    selected = _selected(request)
    version, saved = get_saved_skill_connections()
    employment = get_signal_employment_dashboard()
    jobs = list({job.source_job_id: job for job in employment.jobs}.values())
    context, _ = role_family_for_profile({"occupation": request.profile.occupation,
                                           "work_tasks": request.profile.work_tasks,
                                           "aspiration": request.profile.aspiration})
    evidence = _job_evidence(selected, saved, context)
    research = occupation_research(request.occupation_code, selected)
    # Same-posting evidence is only co-mention support. Never call it a verified
    # task automation observation or an actual decline in demand.
    return {
        "skill": {"key": selected["key"], "name": selected["name"]},
        "category": None,
        "role_context": context,
        "category_status": "not_assessed" if evidence or research["status"] == "task_evidence_available" else "insufficient_evidence",
        "research": research,
        "evidence": evidence,
        "source": {"name": employment.source.get("name", "Job postings"),
                   "posting_count": len(jobs), "collected_at": employment.last_successful_refresh},
        "chart": _chart(_aliases(selected), jobs, employment.source.get("id", "")),
        "evidence_version": version,
        "method_note": ("O*NET task definitions plus Anthropic observed Claude-usage signals are research evidence, "
                        "not skill-level replacement probabilities. Job posting mentions and RunPod interpretations are provisional."),
    }


def _cache_key(report: dict) -> str:
    # Deliberately excludes occupation, aspiration, work tasks and identifiers
    # from the person's session. Cache a general skill/evidence assessment.
    facts = {"skill": report["skill"]["key"], "role_context": report["role_context"],
             "evidence_version": report["evidence_version"],
             "research": {"occupation": report["research"].get("occupation"),
                          "source_hash": report["research"].get("reference_sha256"),
                          "tasks": [(t["id"], t["anthropic_task_penetration"]) for t in report["research"]["tasks"]]},
             "evidence": [(e["id"], e["basis"], e["skill_passage"], e["ai_passage"]) for e in report["evidence"]],
             "prompt": PROMPT_VERSION, "model": model_name()}
    return hashlib.sha256(json.dumps(facts, sort_keys=True).encode()).hexdigest()


def _get_cached(key: str) -> dict | None:
    initialize_database()
    with connection() as db:
        db.execute("""CREATE TABLE IF NOT EXISTS disruption_assessment_cache
                   (cache_key TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)""")
        row = db.execute("SELECT payload FROM disruption_assessment_cache WHERE cache_key=?", (key,)).fetchone()
    return json.loads(row["payload"]) if row else None


def _store_cached(key: str, data: dict) -> None:
    with connection() as db:
        db.execute("INSERT OR IGNORE INTO disruption_assessment_cache (cache_key,payload) VALUES (?,?)",
                   (key, json.dumps(data, ensure_ascii=False)))


def _safe_text(raw: dict, key: str, maximum: int, *, required: bool = True) -> str:
    val = raw.get(key)
    if not isinstance(val, str) or len(val) > maximum or (required and not val.strip()):
        raise ValueError("Invalid model text field")
    if re.search(r"\b(?:guaranteed|certainly|will replace|proves? replacement|100% chance)\b", val, re.I):
        raise ValueError("Unsupported certain replacement claim")
    return val.strip()


def _validate(raw: object, allowed: set[str]) -> dict:
    if not isinstance(raw, dict) or raw.get("category") not in CATEGORIES:
        raise ValueError("Invalid category")
    category = raw["category"]
    citations = raw.get("evidence_ids")
    if not isinstance(citations, list) or len(citations) > MAX_EVIDENCE or any(
        not isinstance(ref, str) or ref not in allowed for ref in citations
    ):
        raise ValueError("Invalid evidence references")
    if category != "insufficient_evidence" and not citations:
        raise ValueError("An assessment requires a real source ID")
    alternatives = raw.get("alternative_outcomes")
    if not isinstance(alternatives, list) or len(alternatives) != 2 or any(
        not isinstance(a, str) or not a.strip() or len(a) > 170 for a in alternatives
    ):
        raise ValueError("Two plausible uncertainty outcomes are required")
    return {
        "category": category,
        "rationale": _safe_text(raw, "rationale", 280),
        "happening_now": _safe_text(raw, "happening_now", 250),
        "possible_future": _safe_text(raw, "possible_future", 290),
        "adaptation": _safe_text(raw, "adaptation", 220),
        "alternative_outcomes": [v.strip() for v in alternatives],
        "evidence_ids": citations,
        "confidence_label": "Provisional model assessment, not verified automation exposure",
    }


INSTRUCTION = """Assess transformation POTENTIAL for one skill in the supplied
occupation context. Use ONLY the supplied O*NET task texts, Anthropic observed
Claude use, and optional sampled job posting. Do not assume current employment
loss or forecast a replacement date. A task penetration index is NOT a task
replacement probability or direct measurement of what the AI can perform.
Job co-mentions are NOT automation evidence. If the task-to-skill match or AI
capability evidence is weak, use insufficient_evidence, not a forced category.

Return exactly ONE JSON object with these 8 keys, no Markdown or commentary:
- category: exactly one of minimal, assisted, hybrid, full, insufficient_evidence
- rationale: concise source-grounded explanation, 40-200 characters
- happening_now: distinguish observed Claude use from employer adoption, <=170 chars
- possible_future: explicitly conditional, <=180 chars
- adaptation: one specific step building on the skill, <=140 chars
- alternative_outcomes: array of EXACTLY 2 short strings, each <=100 chars
- evidence_ids: array of 1-2 strings COPIED EXACTLY from allowed_evidence_ids
  (zero IDs permitted ONLY for insufficient_evidence)
Never use source names or text in evidence_ids: the values must be exact IDs.
Cite a task ID only if the task is directly relevant; cited task use does not
prove AI capability. Do not copy an ID from anywhere except allowed_evidence_ids.
Never cite more than 3 IDs. Avoid certain language, invented facts or numeric
forecasts. Keep all text brief so the entire JSON fits in the output limit.

Definitions: minimal=limited AI applicability to central work; assisted=AI
helps with tasks people primarily perform; hybrid=some routine components may
be done by AI while humans validate and integrate; full=many well-defined
tasks could be independently completed in suitable conditions. This is not a
verified automation-risk scale. Alternative outcomes are caveats, not separate
headline scenarios."""


def assess(request: DisruptionRequest) -> dict:
    report = evidence_for(request)
    if report["research"]["status"] != "task_evidence_available":
        # A job co-mention doesn't independently demonstrate transformation capability.
        # Require occupational task evidence before making a skill-level category.
        return {**report, "status": "insufficient_evidence", "category": "insufficient_evidence",
                "rationale": report["research"].get("message") or
                "Not enough matched occupational tasks and observed AI-usage evidence for this skill. Select a relevant occupation and check the imported research sources."}
    key = _cache_key(report)
    cached = _get_cached(key)
    if cached is not None:
        return {**report, **cached, "status": "cached"}
    facts = {
        "skill": report["skill"]["name"],
        "role_context": report["role_context"],
        "source_scope": "Bounded sample of remote job postings; not a representative labour market series",
        "occupation": report["research"]["occupation"],
        "occupational_task_evidence": [
            {"id": t["id"], "task": t["task"][:190], "task_type": t["task_type"],
             "observed_claude_task_penetration": t["anthropic_task_penetration"]}
            for t in report["research"]["tasks"][:5]
        ],
        "allowed_evidence_ids": [t["id"] for t in report["research"]["tasks"][:5]] +
            [e["id"] for e in report["evidence"][:1]],
        "job_sample_examples": [
            {"id": e["id"], "basis": e["basis"],
             "existing_skill_passage": e["skill_passage"][:110],
             "ai_task_passage": e["ai_passage"][:110]}
            for e in report["evidence"][:1]
        ],
    }
    # Uses the existing shared RunPod client, token budget and request accounting.
    status, output = _run(facts, INSTRUCTION)
    if status != "generated":
        return {**report, "status": status}
    try:
        validated = _validate(output, {e["id"] for e in report["evidence"][:1]} |
                               {t["id"] for t in report["research"]["tasks"][:5]})
    except ValueError as exc:
        # Disclose a safe class of failure, never the raw RunPod output or
        # untrusted text. Do not relabel a rejected answer as "no evidence".
        error = str(exc)
        reason = (
            "citations_invalid" if "evidence" in error or "source ID" in error else
            "category_invalid" if "category" in error else
            "uncertainties_invalid" if "uncertainty" in error else
            "overclaim" if "replacement claim" in error else
            "explanation_invalid"
        )
        return {**report, "status": "invalid_output", "validation_issue": reason}
    _store_cached(key, validated)
    return {**report, **validated, "status": "generated"}

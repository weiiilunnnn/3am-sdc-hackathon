"""Durable, bounded Career AI jobs. No profiles, prompts or raw outputs persisted."""
import os
import json
import logging
import math
import re
import time
import uuid
from pydantic import ValidationError

from src.models.career_analysis import AnalysisJob, CareerAnalysis
from src.services.storage import connection, initialize_database
from src.services.sources import runpod_api
from src.services.sdg_text import LLM_ENDPOINT_ID
from . import career_analysis as career, pathway_llm

LIFETIME = 300
CACHE_SECONDS = 21600
MAX_ACTIVE = 16
MAX_RECORDS = 256
PENDING = ("submitting", "queued", "in_progress")
MAX_HISTORY = 32
TERMINAL_OUTPUT_CODES = {
    "invalid_output", "unsupported_output", "model_truncated", "invalid_json",
    "invalid_generated_schema", "invalid_esco_grounding", "no_supported_interpretations",
    "unexpected_output_error", "provider_job_failed", "invalid_cache",
}


def _retry_block(row, eligible):
    if not eligible or not os.getenv("RUNPOD_API_KEY") or os.getenv("RUNPOD_API_KEY") == "your-runpod-api-key":
        return "analysis_unavailable"
    if row["error_code"] == "authentication":
        return "configuration_required"
    try:
        history = json.loads(row.get("history_json", "[]"))
        if not isinstance(history, list):
            return "history_unavailable"
        if len(history) >= MAX_HISTORY:
            return "history_capacity"
    except (ValueError, TypeError):
        return "history_unavailable"
    # These failures are recorded only after a terminal provider response.
    # Otherwise wait beyond the remote TTL plus its 5s submission deadline.
    if row["error_code"] not in TERMINAL_OUTPUT_CODES and time.time() < row["created_at"]+LIFETIME+5:
        return "previous_job_may_be_active"
    with connection() as db:
        active = db.execute("SELECT count(*) FROM career_analysis_jobs WHERE status IN ('submitting','queued','in_progress') AND expires_at>?", (time.time(),)).fetchone()[0]
    return "job_capacity" if active >= MAX_ACTIVE else None
log = logging.getLogger(__name__)


def _model_diagnostics(response):
    """Allowlist scalar diagnostics; never include provider content or messages."""
    try:
        output = runpod_api.unwrap_llm_output(response)
    except runpod_api.RunPodRequestError:
        output = {}
    choices = output.get("choices")
    choice = choices[0] if isinstance(choices, list) and choices and isinstance(choices[0], dict) else {}
    reason = choice.get("finish_reason")
    finish = reason if isinstance(reason, str) and reason in {
        "stop", "length", "content_filter", "tool_calls", "function_call"
    } else "other" if reason is not None else None
    usage = output.get("usage")
    if not isinstance(usage, dict):
        usage = response.get("usage")
    tokens = {}
    if isinstance(usage, dict):
        for key in ("prompt_tokens", "completion_tokens", "total_tokens"):
            value = usage.get(key)
            if type(value) in (int, float) and 0 <= value <= 1_000_000_000 and math.isfinite(value):
                tokens[key] = value
    return finish, tokens


def _reject_output(ticket, response, stage, category, exc):
    finish, tokens = _model_diagnostics(response)
    log.warning("career_job_failure job_id=%s stage=%s category=%s exception_class=%s finish_reason=%s token_usage=%s",
                ticket, stage, category, type(exc).__name__, finish, tokens)
    _write(ticket, status="failed", error_code=category)


class NoSupportedInterpretations(ValueError):
    """Valid structure contained no supported output; evidence remains usable."""


def _read(ticket):
    with connection() as db:
        row = db.execute("SELECT * FROM career_analysis_jobs WHERE ticket=?", (ticket,)).fetchone()
    return dict(row) if row else None


def _write(ticket, **values):
    with connection() as db:
        db.execute("UPDATE career_analysis_jobs SET " + ",".join(k+"=?" for k in values) + " WHERE ticket=?",
                   (*values.values(), ticket))


def _view(row, *, cached=False, eligible=False):
    now = time.time()
    if row["status"] in (*PENDING, "completed") and row["expires_at"] <= now:
        _write(row["ticket"], status="expired", error_code="job_expired", result_json=None)
        row = _read(row["ticket"])
    analysis = None
    if row["status"] == "completed":
        try:
            analysis = CareerAnalysis.model_validate_json(row["result_json"])
        except (ValueError, TypeError):
            _write(row["ticket"], status="failed", error_code="invalid_cache", result_json=None)
            row = _read(row["ticket"])
    if analysis and cached:
        analysis = analysis.model_copy(update={"used_cache": True})
    blocked = _retry_block(row, eligible) if row["status"] in ("failed", "expired") else None
    return AnalysisJob(retryable=row["status"] in ("failed", "expired") and blocked is None,
        retry_blocked_reason=blocked, job_id=row["ticket"], evidence_key=row["evidence_key"], status=row["status"],
        expires_at=row["expires_at"], error_code=row["error_code"], analysis=analysis)


def _accept(ticket, response, bundle):
    row = _read(ticket)
    if not row:
        return
    if time.time() >= row["expires_at"]:
        _write(ticket, status="expired", error_code="job_expired", result_json=None)
        return
    result, payload, group_evidence, matched_evidence, _ = bundle
    status = response.get("status")
    if status == "COMPLETED":
        try:
            raw = pathway_llm.parse_result(response)
        except pathway_llm.LLMResponseError as exc:
            stage, category = {
                "model_truncated": ("model_completion", "model_truncated"),
                "model_json": ("json_parsing", "invalid_json"),
            }.get(exc.category, ("output_extraction", "unsupported_output"))
            _reject_output(ticket, response, stage, category, exc)
            return
        except runpod_api.RunPodRequestError as exc:
            _reject_output(ticket, response, "output_extraction", "unsupported_output", exc)
            return
        except Exception as exc:
            _reject_output(ticket, response, "output_extraction", "unexpected_output_error", exc)
            return
        try:
            analysis = career.validate_analysis(raw, result, payload, group_evidence, matched_evidence)
        except ValidationError as exc:
            _reject_output(ticket, response, "generated_schema", "invalid_generated_schema", exc)
            return
        except career.EvidenceGroundingError as exc:
            _reject_output(ticket, response, "evidence_grounding", "invalid_esco_grounding", exc)
            return
        except Exception as exc:
            _reject_output(ticket, response, "evidence_grounding", "unexpected_output_error", exc)
            return
        if analysis.status == "unavailable":
            _reject_output(ticket, response, "supported_interpretations", "no_supported_interpretations",
                           NoSupportedInterpretations())
            return
        _write(ticket, status="completed", error_code=None, result_json=analysis.model_dump_json(),
               expires_at=time.time()+CACHE_SECONDS)
        with career._lock:
            career._cache[result.evidence_key] = (time.monotonic()+CACHE_SECONDS, analysis.model_copy(deep=True))
            while len(career._cache) > 64:
                career._cache.popitem(last=False)
    elif status in ("IN_QUEUE", "IN_PROGRESS"):
        _write(ticket, status="queued" if status == "IN_QUEUE" else "in_progress", poll_after=time.time()+3)
    else:
        _write(ticket, status="failed", error_code="provider_job_failed" if status in
               ("FAILED", "CANCELLED", "TIMED_OUT") else "invalid_provider_status")


def start(request, index):
    bundle = career.prepare_analysis(request, index)
    result, payload, _, _, verified = bundle
    if not verified or not result.groups or not os.getenv("RUNPOD_API_KEY"):
        return AnalysisJob(evidence_key=result.evidence_key, status="unavailable")
    initialize_database()
    now = time.time()
    endpoint = os.getenv("RUNPOD_LLM_ENDPOINT_ID") or LLM_ENDPOINT_ID
    existing = None
    replacing = False
    eligible = bool(result.matched)
    with connection() as db:
        db.execute("BEGIN IMMEDIATE")
        row = db.execute("SELECT * FROM career_analysis_jobs WHERE evidence_key=?", (result.evidence_key,)).fetchone()
        if row:
            existing = dict(row)
            if existing["status"] in (*PENDING, "completed") and existing["expires_at"] <= now:
                existing.update(status="expired", error_code="job_expired", result_json=None)
                db.execute("UPDATE career_analysis_jobs SET status='expired',error_code='job_expired',result_json=NULL WHERE ticket=?", (row["ticket"],))
            if (request.retry_failed and request.retry_job_id == existing["ticket"]
                    and existing["status"] in ("failed", "expired") and _retry_block(existing, eligible) is None):
                active = db.execute("SELECT count(*) FROM career_analysis_jobs WHERE status IN ('submitting','queued','in_progress') AND expires_at>?", (now,)).fetchone()[0]
                if active < MAX_ACTIVE:
                    history = json.loads(existing["history_json"])
                    history.append({k: existing[k] for k in ("ticket", "remote_id", "endpoint", "status", "error_code", "created_at", "expires_at")})
                    ticket = uuid.uuid4().hex
                    db.execute("UPDATE career_analysis_jobs SET ticket=?,endpoint=?,remote_id=NULL,status='submitting',created_at=?,expires_at=?,poll_after=?,error_code=NULL,result_json=NULL,history_json=? WHERE evidence_key=?",
                        (ticket, endpoint, now, now+LIFETIME, now+10, json.dumps(history), result.evidence_key))
                    existing = None
                    replacing = True
        if existing is None and not replacing:
            if request.retry_failed:
                return AnalysisJob(evidence_key=result.evidence_key, status="unavailable", error_code="retry_job_not_found")
            active = db.execute("SELECT count(*) FROM career_analysis_jobs WHERE status IN ('submitting','queued','in_progress') AND expires_at>?", (now,)).fetchone()[0]
            count = db.execute("SELECT count(*) FROM career_analysis_jobs").fetchone()[0]
            if active >= MAX_ACTIVE or count >= MAX_RECORDS:
                return AnalysisJob(evidence_key=result.evidence_key, status="unavailable", error_code="job_capacity")
            ticket = uuid.uuid4().hex
            db.execute("INSERT INTO career_analysis_jobs (evidence_key,ticket,endpoint,remote_id,status,created_at,expires_at,poll_after,error_code,result_json) VALUES (?,?,?,?,?,?,?,?,?,?)",
                (result.evidence_key, ticket, endpoint, None, "submitting", now, now+LIFETIME, now+10, None, None))
    if existing:
        return _view(existing, cached=True, eligible=eligible)
    try:
        body = pathway_llm.request_payload(payload, career.CAREER_INSTRUCTIONS, max_tokens=1500)
        # Bound remote lifetime too, even when the browser closes or loses its poll.
        body["policy"] = {"executionTimeout": LIFETIME*1000, "ttl": LIFETIME*1000}
        response = runpod_api.submit(endpoint, body, timeout=5)
        remote_id = response.get("id")
        if not isinstance(remote_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,200}", remote_id):
            raise ValueError("Invalid provider identity")
        _write(ticket, remote_id=remote_id)
        _accept(ticket, response, bundle)
    except Exception as exc:
        category = pathway_llm.failure_category(exc)
        # Submission could have reached Runpod even when its response was lost.
        # Retain the row: refresh/poll must never submit it again automatically.
        _write(ticket, status="failed", error_code=category if category in
               ("timeout", "authentication", "rate_limit", "transport") else "submission_unknown")
    return _view(_read(ticket), eligible=eligible)


def poll(request, index):
    bundle = career.prepare_analysis(request, index)
    result = bundle[0]
    if result.evidence_key != request.evidence_key:
        raise KeyError("Job evidence does not match")
    initialize_database()
    row = _read(request.job_id)
    if not row or row["evidence_key"] != result.evidence_key:
        raise KeyError("Job not found for this evidence")
    eligible = bool(bundle[4] and result.groups and result.matched)
    view = _view(row, cached=True, eligible=eligible)
    if view.status not in PENDING:
        return view
    now = time.time()
    if row["status"] == "submitting":
        # A dev reload may interrupt the submit after it reached the provider.
        if now > row["created_at"]+10:
            _write(row["ticket"], status="failed", error_code="submission_unknown")
        return _view(_read(row["ticket"]), eligible=eligible)
    # Cross-process polling lease prevents concurrent tabs/reloads flooding status.
    with connection() as db:
        claimed = db.execute("UPDATE career_analysis_jobs SET poll_after=? WHERE ticket=? AND poll_after<=? AND status IN ('queued','in_progress')",
            (now+8, row["ticket"], now)).rowcount
    if not claimed:
        return view
    try:
        response = runpod_api.job_status(row["endpoint"], row["remote_id"], timeout=5)
        if response.get("id", row["remote_id"]) != row["remote_id"]:
            raise ValueError("Provider identity mismatch")
        _accept(row["ticket"], response, bundle)
    except Exception as exc:
        category = pathway_llm.failure_category(exc)
        _write(row["ticket"], status="failed", error_code="provider_unavailable" if category not in
               ("timeout", "authentication", "rate_limit", "transport") else category)
    return _view(_read(row["ticket"]), eligible=eligible)

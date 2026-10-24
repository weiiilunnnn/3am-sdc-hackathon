"""Bounded, in-memory asynchronous CV extraction for Pathwaay registration.

The upload is validated immediately. RunPod runs in a worker thread; the
browser polls a short GET instead of holding a Next.js rewrite open for 90 sec.
The original CV bytes and raw text are never persisted to disk or SQLite.
Job IDs are unguessable, job results expire automatically, and no extracted
profile is saved without user confirmation in the existing frontend.
"""
from __future__ import annotations

from concurrent.futures import Future, ThreadPoolExecutor
import logging
from secrets import token_urlsafe
from threading import Lock
from time import monotonic

from fastapi import APIRouter, HTTPException, Request

from src.services.cv_extractor import MAX_UPLOAD_BYTES, CVExtractionError
from src.services.registration_cv import (
    RegistrationCVError, _looks_like_cv, _text_from_file, extract_registration_text,
)
from src.services.sources.runpod_api import RunPodConfigurationError, RunPodRequestError

router = APIRouter(prefix="/api/profiles")
_log = logging.getLogger(__name__)
_workers = ThreadPoolExecutor(max_workers=2, thread_name_prefix="cv-registration")
_lock = Lock()
_jobs: dict[str, tuple[float, Future]] = {}
_JOB_LIFETIME = 300  # seconds; results are transient, including any parsed PII
_MAX_WORKING = 2
_MAX_JOBS = 8


def _cleanup(now: float) -> None:
    """Caller must hold _lock; purge expired results/finished old jobs."""
    for key, (created, future) in list(_jobs.items()):
        if now - created > _JOB_LIFETIME and future.done():
            _jobs.pop(key, None)
    if len(_jobs) >= _MAX_JOBS:
        for key, (_, future) in sorted(_jobs.items(), key=lambda item: item[1][0]):
            if future.done():
                _jobs.pop(key, None)
                if len(_jobs) < _MAX_JOBS:
                    break


@router.post("/extract-registration-cv-async", status_code=202)
async def start_cv_extraction(request: Request) -> dict:
    if request.headers.get("x-cv-processing-consent", "").casefold() != "true":
        raise HTTPException(status_code=400, detail="Consent is required before sharing CV text with RunPod.")
    filename = request.headers.get("x-filename", "")
    content_type = request.headers.get("content-type", "").split(";", 1)[0].casefold()
    if not filename or len(filename) > 200 or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Select a PDF or DOCX file with a valid filename.")

    chunks, total = [], 0
    async for chunk in request.stream():
        total += len(chunk)
        if total > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="CV must be 2 MB or smaller.")
        chunks.append(chunk)
    try:
        text = _text_from_file(filename, content_type, b"".join(chunks))
    except (CVExtractionError, RegistrationCVError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    finally:
        chunks.clear()
    if not _looks_like_cv(text):
        raise HTTPException(
            status_code=422,
            detail="This document does not have enough recognizable résumé information. Upload a CV or continue manually.",
        )

    with _lock:
        _cleanup(monotonic())
        running = sum(not future.done() for _, future in _jobs.values())
        if running >= _MAX_WORKING or len(_jobs) >= _MAX_JOBS:
            raise HTTPException(status_code=429, detail="CV extraction is busy. Please try again in a moment.")
        job_id = token_urlsafe(24)
        _jobs[job_id] = (monotonic(), _workers.submit(extract_registration_text, text))
    # Only a random job token is returned: no personal CV content in this request.
    return {"job_id": job_id, "status": "processing"}


@router.get("/extract-registration-cv-async/{job_id}")
def cv_extraction_status(job_id: str) -> dict:
    if len(job_id) > 80:
        raise HTTPException(status_code=404, detail="CV extraction was not found or has expired.")
    with _lock:
        _cleanup(monotonic())
        job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(
            status_code=404,
            detail="CV extraction was not found or has expired. Reload the page and upload again.",
        )
    _, future = job
    if not future.done():
        return {"status": "processing"}
    try:
        return {"status": "completed", "result": future.result()}
    except (RegistrationCVError, RunPodConfigurationError, RunPodRequestError) as exc:
        return {"status": "failed", "error": str(exc)}
    except Exception as exc:
        # Never log CV text or model payload in error messages.
        _log.warning("CV extraction worker failed (%s)", type(exc).__name__)
        return {"status": "failed", "error": "CV extraction failed on the server. Try again or use manual registration."}

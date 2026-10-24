"""Bounded in-memory jobs for slow, transient profile skill extraction."""

from __future__ import annotations

from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import dataclass
import threading
import time
import uuid

from src.models.cv import ExtractedSkill
from src.services.skill_extractor import SkillEvidence, extract_profile_skill_candidates

MAX_ACTIVE_JOBS = 2
MAX_RETAINED_JOBS = 100
JOB_RETENTION_SECONDS = 600

_executor = ThreadPoolExecutor(max_workers=MAX_ACTIVE_JOBS, thread_name_prefix="skill-extraction")
_lock = threading.Lock()


@dataclass(frozen=True)
class SkillExtractionJob:
    future: Future[list[ExtractedSkill]]
    created_at: float


_jobs: dict[str, SkillExtractionJob] = {}


class SkillExtractionBusyError(RuntimeError):
    """Raised when the bounded extraction worker is at capacity."""


def _prune_jobs(now: float) -> None:
    expired = [
        job_id
        for job_id, job in _jobs.items()
        if job.future.done() and now - job.created_at > JOB_RETENTION_SECONDS
    ]
    for job_id in expired:
        _jobs.pop(job_id, None)

    while len(_jobs) >= MAX_RETAINED_JOBS:
        completed = [
            (job.created_at, job_id)
            for job_id, job in _jobs.items()
            if job.future.done()
        ]
        if not completed:
            raise SkillExtractionBusyError("Skill extraction is busy. Wait for a current request to finish.")
        _, oldest_id = min(completed)
        _jobs.pop(oldest_id, None)


def submit_skill_extraction(evidence: list[SkillEvidence], *, limit: int) -> str:
    """Start extraction off the request loop and return an opaque polling ID."""
    with _lock:
        now = time.monotonic()
        _prune_jobs(now)
        if sum(not job.future.done() for job in _jobs.values()) >= MAX_ACTIVE_JOBS:
            raise SkillExtractionBusyError("Skill extraction is busy. Wait for a current request to finish.")
        job_id = uuid.uuid4().hex
        future = _executor.submit(extract_profile_skill_candidates, evidence, limit=limit)
        _jobs[job_id] = SkillExtractionJob(future=future, created_at=now)
        return job_id


def get_skill_extraction_job(job_id: str) -> SkillExtractionJob | None:
    with _lock:
        _prune_jobs(time.monotonic())
        return _jobs.get(job_id)

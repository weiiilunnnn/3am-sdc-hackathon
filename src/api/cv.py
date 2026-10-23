"""Synthetic-only CV and AI-assisted profile skill extraction endpoints."""

import logging

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from src.models.cv import CVExtraction, SkillExtractionJobStarted, SkillExtractionJobStatus
from src.services.cv_extractor import CVExtractionError, MAX_UPLOAD_BYTES, extract_synthetic_cv
from src.services.skill_extractor import (
    SkillEvidence,
    SkillExtractionError,
    SkillTaxonomyUnavailableError,
    validate_skill_evidence,
)
from src.services.skill_extraction_jobs import (
    SkillExtractionBusyError,
    get_skill_extraction_job,
    submit_skill_extraction,
)
from src.services.sources.runpod_api import RunPodConfigurationError, RunPodRequestError

router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)


class SkillEvidenceInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    source_id: str | None = Field(default=None, max_length=80)
    source_label: str = Field(min_length=1, max_length=80)
    text: str = Field(min_length=1, max_length=3000)


class ProfileSkillExtractionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    evidence: list[SkillEvidenceInput] = Field(min_length=1, max_length=50)
    limit: int = Field(default=10, ge=1, le=50)


@router.post("/profiles/extract-cv", response_model=CVExtraction)
async def extract_cv(request: Request) -> CVExtraction:
    if request.headers.get("x-synthetic-demo-confirmed", "").casefold() != "true":
        raise HTTPException(status_code=400, detail="Confirm that the uploaded CV is fictional demo data only.")
    filename = request.headers.get("x-filename", "")
    content_type = request.headers.get("content-type", "").split(";", 1)[0].casefold()
    if not filename or len(filename) > 200:
        raise HTTPException(status_code=400, detail="A valid PDF or DOCX filename is required.")

    chunks: list[bytes] = []
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Files must be 2 MB or smaller.")
        chunks.append(chunk)
    try:
        return extract_synthetic_cv(filename, content_type, b"".join(chunks))
    except CVExtractionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post(
    "/profiles/extract-profile-skills",
    response_model=SkillExtractionJobStarted,
    status_code=202,
)
def extract_profile_skills(
    request: Request,
    payload: ProfileSkillExtractionRequest,
) -> SkillExtractionJobStarted:
    if request.headers.get("x-synthetic-demo-confirmed", "").casefold() != "true":
        raise HTTPException(status_code=400, detail="Confirm that the profile contains fictional demo content before AI extraction.")
    try:
        evidence = [
            SkillEvidence(
                evidence_id=f"e{index}",
                source_id=item.source_id,
                source_label=item.source_label,
                text=item.text,
            )
            for index, item in enumerate(payload.evidence)
        ]
        validate_skill_evidence(evidence)
        job_id = submit_skill_extraction(evidence, limit=payload.limit)
        return SkillExtractionJobStarted(job_id=job_id)
    except SkillExtractionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except SkillExtractionBusyError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc


@router.get(
    "/profiles/extract-profile-skills/{job_id}",
    response_model=SkillExtractionJobStatus,
)
def get_profile_skill_extraction_status(job_id: str) -> SkillExtractionJobStatus:
    job = get_skill_extraction_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Skill extraction job was not found or has expired.")
    if not job.future.done():
        return SkillExtractionJobStatus(status="pending")
    try:
        return SkillExtractionJobStatus(status="completed", skills=job.future.result())
    except SkillExtractionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except SkillTaxonomyUnavailableError as exc:
        logger.error("ESCO skill extraction is unavailable: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except RunPodConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except RunPodRequestError as exc:
        logger.warning(
            "RunPod skill extraction failed (category=%s, status=%s, elapsed=%s, timeout=%s): %s",
            exc.category,
            exc.http_status,
            exc.elapsed_seconds,
            exc.timeout_seconds,
            exc,
        )
        raise HTTPException(status_code=502, detail=str(exc)) from exc

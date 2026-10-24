"""Transient resume-to-profile review endpoints. Separate from synthetic-demo CV route."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from src.services.registration_cv import extract_registration_cv, RegistrationCVError
from src.services.esco_skill_mapper import normalise_skill, esco_status
from src.services.cv_extractor import MAX_UPLOAD_BYTES
from src.services.sources.runpod_api import RunPodRequestError, RunPodConfigurationError

router = APIRouter(prefix='/api/profiles')


class NormaliseSkillsRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    skills: list[str] = Field(min_length=1, max_length=40)


@router.get('/esco-status')
def esco_reference_status() -> dict:
    return esco_status()


@router.post('/normalise-registration-skills')
def normalise_registration_skills(payload: NormaliseSkillsRequest) -> dict:
    items = [label.strip() for label in payload.skills]
    if any(not label or len(label) > 100 for label in items):
        raise HTTPException(status_code=422, detail='Skills must contain 1 to 100 characters.')
    return {'skills': [normalise_skill(item) for item in dict.fromkeys(items)], 'esco': esco_status()}


@router.post('/extract-registration-cv')
async def upload_registration_cv(request: Request) -> dict:
    if request.headers.get('x-cv-processing-consent', '').casefold() != 'true':
        raise HTTPException(status_code=400, detail='Consent is required before sharing CV text with RunPod.')
    filename = request.headers.get('x-filename', '')
    content_type = request.headers.get('content-type', '').split(';', 1)[0].casefold()
    if not filename or len(filename) > 200 or '/' in filename or '\\' in filename:
        raise HTTPException(status_code=400, detail='Select a PDF or DOCX file with a valid filename.')
    parts, total = [], 0
    async for chunk in request.stream():
        total += len(chunk)
        if total > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail='CV must be 2 MB or smaller.')
        parts.append(chunk)
    try:
        return extract_registration_cv(filename, content_type, b''.join(parts))
    except RegistrationCVError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RunPodConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except RunPodRequestError as exc:
        # Deliberately do not leak original text or provider payload in errors/logs.
        raise HTTPException(status_code=502, detail=str(exc)) from exc

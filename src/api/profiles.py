"""Skills vocabulary and synthetic profile endpoints."""

from fastapi import APIRouter, HTTPException, Query

from src.data.skills_taxonomy import search_skills, taxonomy_metadata
from src.models.profiles import ProfileInput, ProfileRecord
from src.services.profile_service import (
    UnknownSkillIdError,
    create_profile,
    get_profile,
    list_sample_profiles,
    update_profile,
)

router = APIRouter(prefix="/api")


@router.get("/skills")
def skills(q: str = Query(default="", max_length=100)) -> dict:
    return {"taxonomy": taxonomy_metadata(), "skills": search_skills(q)}


@router.get("/profiles/samples")
def sample_profiles() -> dict:
    return {"synthetic": True, "profiles": list_sample_profiles()}


@router.post("/profiles", response_model=ProfileRecord, status_code=201)
def create_profile_endpoint(profile: ProfileInput) -> ProfileRecord:
    try:
        return create_profile(profile)
    except UnknownSkillIdError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/profiles/{profile_id}", response_model=ProfileRecord)
def get_profile_endpoint(profile_id: str) -> ProfileRecord:
    profile = get_profile(profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found.")
    return profile


@router.put("/profiles/{profile_id}", response_model=ProfileRecord)
def update_profile_endpoint(profile_id: str, profile: ProfileInput) -> ProfileRecord:
    try:
        updated = update_profile(profile_id, profile)
    except UnknownSkillIdError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if updated is None:
        raise HTTPException(status_code=404, detail="Profile not found.")
    return updated

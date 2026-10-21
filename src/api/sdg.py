"""Synthetic SDG role ranking and RunPod-generated explanation endpoints."""

from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException

from src.models.sdg import SDGExplanationRequest, SDGOverviewRequest, SDGRecommendationRequest
from src.services.sdg_model import get_sdg_target, recommend_sdgs
from src.services.sdg_text import generate_sdg_explanation, generate_sdg_overview
from src.services.sources.runpod_api import RunPodRequestError

router = APIRouter(prefix="/api/sdg")


@router.post("/recommendations")
def sdg_recommendations(request: SDGRecommendationRequest) -> dict:
    try:
        return recommend_sdgs(request.role)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/overview")
def sdg_overview(request: SDGOverviewRequest) -> dict:
    payload = request.model_dump()
    cache_key = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    try:
        return generate_sdg_overview(cache_key)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RunPodRequestError as exc:
        status = 503 if "not configured" in str(exc).lower() else 502
        raise HTTPException(status_code=status, detail=str(exc)) from exc


@router.post("/explanation")
def sdg_explanation(request: SDGExplanationRequest) -> dict:
    official_target = get_sdg_target(request.target_code)
    if official_target is None:
        raise HTTPException(status_code=422, detail="Unknown SDG target.")
    if request.target_title != official_target["title"] or request.target_definition != official_target["definition"]:
        raise HTTPException(status_code=422, detail="SDG target text must match the fixed synthetic reference data.")
    cache_key = json.dumps(request.model_dump(), sort_keys=True, ensure_ascii=False)
    try:
        return generate_sdg_explanation(cache_key)
    except RunPodRequestError as exc:
        status = 503 if "not configured" in str(exc).lower() else 502
        raise HTTPException(status_code=status, detail=str(exc)) from exc

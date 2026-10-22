"""Career ranking and synthetic scenario inference endpoints."""

from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException

from src.models.career import CareerProfileRequest
from src.services.career_model import recommend
from src.services.sources.runpod_api import RunPodRequestError, run_sync

router = APIRouter(prefix="/api")


@router.get("/model/info")
def model_info() -> dict[str, str]:
    return {
        "name": "Pathwaay Career Signal Model",
        "version": "synthetic-random-forest-v1",
        "training_data": "synthetic",
        "notice": "Illustrative estimates from synthetic data; not observed labour-market forecasts.",
    }


@router.post("/career/recommendations")
def career_recommendations(request: CareerProfileRequest) -> dict:
    profile = request.model_dump()
    endpoint_id = os.getenv("RUNPOD_ENDPOINT_ID")
    api_key = os.getenv("RUNPOD_API_KEY")
    if endpoint_id and api_key:
        try:
            result = run_sync(endpoint_id, {"input": {"profile": profile}}, timeout=90)
        except RunPodRequestError as exc:
            raise HTTPException(status_code=502, detail="RunPod career inference request failed.") from exc
        output = result.get("output")
        if not isinstance(output, dict):
            raise HTTPException(status_code=502, detail="RunPod returned no career model output.")
        return output
    try:
        return recommend(profile)
    except (RuntimeError, OSError, ValueError) as exc:
        raise HTTPException(status_code=503, detail=f"Career model is unavailable: {exc}") from exc

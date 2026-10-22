"""OpenAlex research-activity trend endpoints."""

from fastapi import APIRouter, HTTPException, Query

from src.services.dosm_service import get_dosm_dashboard, refresh_dosm
from src.services.radar_brief import explain_brief, get_brief

from src.models.trends import ProfileRelevance, TrendDashboard, TrendSourceInfo
from src.services.trend_service import (
    get_dashboard,
    get_demo_dashboard,
    get_history,
    get_profile_relevance,
    get_source_metadata,
    get_topic_metadata,
    refresh_trends,
)

router = APIRouter(prefix="/api/trends")


@router.get("/brief")
def radar_brief(profile_id: str | None = Query(default=None, max_length=80)) -> dict:
    brief = get_brief(profile_id)
    if brief is None:
        raise HTTPException(status_code=404, detail="Profile not found.")
    return brief


@router.post("/brief/explain")
def radar_explanation(profile_id: str | None = Query(default=None, max_length=80)) -> dict:
    explanation = explain_brief(profile_id)
    if explanation is None:
        raise HTTPException(status_code=404, detail="Profile not found.")
    return explanation


@router.get("/malaysia")
def malaysia_context() -> dict:
    return get_dosm_dashboard()


@router.post("/malaysia/refresh")
def refresh_malaysia_context() -> dict:
    try:
        return refresh_dosm()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/topics")
def trend_topics() -> dict:
    return {"topics": get_topic_metadata()}


@router.get("/sources", response_model=list[TrendSourceInfo])
def trend_sources() -> list[TrendSourceInfo]:
    return [get_source_metadata()]


@router.get("", response_model=TrendDashboard)
def trend_dashboard() -> TrendDashboard:
    return get_dashboard()


@router.get("/history")
def trend_history(topic_id: str | None = Query(default=None, max_length=80)) -> dict:
    return {"history": get_history(topic_id)}


@router.post("/refresh", response_model=TrendDashboard)
def refresh_trend_dashboard() -> TrendDashboard:
    return refresh_trends()


@router.get("/demo", response_model=TrendDashboard)
def synthetic_demo() -> TrendDashboard:
    return get_demo_dashboard()


@router.get("/relevance", response_model=ProfileRelevance)
def profile_relevance(profile_id: str = Query(min_length=1, max_length=80)) -> ProfileRelevance:
    relevance = get_profile_relevance(profile_id)
    if relevance is None:
        raise HTTPException(status_code=404, detail="Profile not found.")
    return relevance

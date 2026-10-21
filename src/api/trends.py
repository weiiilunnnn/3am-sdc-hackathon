"""OpenAlex research-activity trend endpoints."""

from fastapi import APIRouter, HTTPException, Query

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

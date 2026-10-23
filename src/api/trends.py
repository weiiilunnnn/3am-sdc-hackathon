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

from src.services.ai_skill_exploration import get_ai_skill_exploration
from src.services.session_signal_adapter import SessionSignalProfile, get_session_connections

from src.services.session_signal_runpod import (
    SessionExplanationRequest, SignalExplanationError, generate_session_explanation,
)

from src.services.session_signal_review import (SessionReviewRequest, SessionReviewError, review_connection)

router = APIRouter(prefix="/api/trends")


@router.post("/session-review")
def review_session_connection(request: SessionReviewRequest) -> dict:
    try:
        return review_connection(request)
    except SessionReviewError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/session-explanation")
def session_explanation(request: SessionExplanationRequest) -> dict:
    try:
        return generate_session_explanation(request)
    except SignalExplanationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/session-connections")
def session_connections(profile: SessionSignalProfile, skill_id: str | None = Query(default=None, max_length=180)) -> dict:
    try:
        return get_session_connections(profile, skill_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/explore-ai-skills")
def explore_ai_skills() -> dict:
    return get_ai_skill_exploration()


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

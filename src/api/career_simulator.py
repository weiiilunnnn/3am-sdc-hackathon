"""Local-demo capability authorization; never accepts arbitrary profile IDs alone."""
import re
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from src.models.career_simulator import Exploration, PlanWrite
from src.services import career_simulator as service
from src.models.chapter_insights import InsightRequest, InsightStart, InsightStatus
from src.services import chapter_insights

router = APIRouter(prefix="/api/v2/career-simulator", tags=["Career Simulator"])


def capability(value: str | None = Header(default=None, alias="X-Career-Simulator-Key")):
    if not value or not re.fullmatch(r"[a-f0-9]{64}", value):
        raise HTTPException(401, "Browser journey capability required")
    return value


@router.get("/config")
def config():
    return service.config()


@router.post("/candidates")
def candidates(request: Exploration, _=Depends(capability)):
    return service.explore(request)


@router.post("/roles/search")
def search(request: Exploration, _=Depends(capability)):
    return service.explore(request, search=True)


@router.post("/roles/detail")
def detail(request: Exploration, _=Depends(capability)):
    return service.explore(request, detail=True)


@router.get("/plan")
def read(profile_id: str = Query(min_length=1, max_length=100), token=Depends(capability)):
    return service.read_plan(profile_id, token)


@router.put("/plan")
def save(request: PlanWrite, token=Depends(capability)):
    return service.save_plan(request, token)


@router.delete("/plan")
def delete(profile_id: str = Query(min_length=1, max_length=100), revision: int = Query(ge=0), plan_id: str | None = Query(default=None, pattern=r"^[a-f0-9]{32}$"), token=Depends(capability)):
    return service.delete_plan(profile_id, revision, token, plan_id)


@router.post("/insights/cache")
def insight_cache(request: InsightRequest, token=Depends(capability)):
    return chapter_insights.cached(request, token)


@router.post("/insights/jobs")
def insight_start(request: InsightStart, token=Depends(capability)):
    return chapter_insights.start(request, token)


@router.post("/insights/jobs/status")
def insight_status(request: InsightStatus, token=Depends(capability)):
    return chapter_insights.poll(request, token)

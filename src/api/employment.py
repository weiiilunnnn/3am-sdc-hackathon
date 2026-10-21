"""Remote-posting snapshot endpoints; reads never trigger external collection."""

from fastapi import APIRouter

from src.data.employment_source import REMOTEOK_SOURCE
from src.models.employment import EmploymentDashboard
from src.services.employment_service import get_employment_dashboard, refresh_employment

router = APIRouter(prefix="/api/employment")


@router.get("/source")
def employment_source() -> dict:
    return REMOTEOK_SOURCE


@router.get("", response_model=EmploymentDashboard)
def employment_dashboard() -> EmploymentDashboard:
    return get_employment_dashboard()


@router.post("/refresh", response_model=EmploymentDashboard)
def refresh_employment_dashboard() -> EmploymentDashboard:
    return refresh_employment()

"""FastAPI backend for the hackathon project."""

import os
import sys
import logging
from contextlib import asynccontextmanager
from pathlib import Path

# Support both `python -m src.main` and `python src/main.py` from the repo root.
if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.environment import load_backend_environment

load_backend_environment()

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from src.api.profiles import router as profile_router
from src.api.trends import router as trend_router
from src.api.employment import router as employment_router
from src.api.cv import router as cv_router
from src.api.registration_cv import router as registration_cv_router
from src.api.registration_cv_async import router as registration_cv_async_router
from src.api.career import router as career_router
from src.api.sdg import router as sdg_router
from src.api.future_roles import router as future_role_router
from src.api.career_simulator import router as career_simulator_router
from src.api.employer import router as employer_router
from src.services.storage import initialize_database
from src.services.future_roles.occupation_index import get_occupation_index
from src.utils import format_greeting, summarize

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_database()
    index = get_occupation_index()
    if index.coverage != "local_full":
        logger.error("Full ESCO skill and occupation index is unavailable: %s", index.warning)
    yield


app = FastAPI(title=os.getenv("PROJECT_NAME", "Hackathon API"), lifespan=lifespan)
app.include_router(registration_cv_router)
app.include_router(registration_cv_async_router)
app.include_router(profile_router)
app.include_router(trend_router)
app.include_router(employment_router)
app.include_router(cv_router)
app.include_router(career_router)
app.include_router(sdg_router)
app.include_router(future_role_router)
app.include_router(career_simulator_router)
app.include_router(employer_router)


class SummarizeRequest(BaseModel):
    values: list[float] = Field(min_length=1, max_length=1000)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "message": format_greeting(app.title)}


@app.get("/api/healthz")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/summarize")
def summarize_values(request: SummarizeRequest) -> dict:
    try:
        return summarize(request.values)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

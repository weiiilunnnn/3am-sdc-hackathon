"""FastAPI backend for the hackathon project."""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from src.api.profiles import router as profile_router
from src.api.trends import router as trend_router
from src.api.employment import router as employment_router
from src.api.cv import router as cv_router
from src.services.storage import initialize_database
from src.utils import format_greeting, summarize


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_database()
    yield


app = FastAPI(title=os.getenv("PROJECT_NAME", "Hackathon API"), lifespan=lifespan)
app.include_router(profile_router)
app.include_router(trend_router)
app.include_router(employment_router)
app.include_router(cv_router)


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

"""FastAPI backend for the hackathon project."""

import os

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from src.utils import format_greeting, summarize

app = FastAPI(title=os.getenv("PROJECT_NAME", "Hackathon API"))


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

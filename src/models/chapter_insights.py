"""Small, capability-scoped requests and strictly bounded model prose."""
from pydantic import ConfigDict, Field
from src.models.career_simulator import Strict

class InsightRequest(Strict):
    profile_id: str = Field(min_length=1, max_length=100)
    milestone_id: str = Field(pattern=r"^[a-f0-9]{32}$")

class InsightStart(InsightRequest):
    retry_failed: bool = False

class InsightStatus(InsightRequest):
    job_id: str = Field(pattern=r"^[a-f0-9]{32}$")

class GeneratedInsight(Strict):
    model_config = ConfigDict(extra="forbid", strict=True, str_strip_whitespace=True)
    why_relevant: str = Field(min_length=10, max_length=500)
    practice: str = Field(min_length=10, max_length=500)
    evidence_of_learning: str = Field(min_length=10, max_length=500)
    evidence_id: str = Field(max_length=30)
    evidence_quote: str = Field(min_length=1, max_length=500)

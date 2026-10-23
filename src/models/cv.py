"""Transient, synthetic-only CV extraction response."""

from pydantic import BaseModel, ConfigDict, Field


class ExtractedSkill(BaseModel):
    model_config = ConfigDict(extra="forbid")

    original_text: str
    canonical_name: str | None
    skill_id: str | None
    resolution: str
    confidence: float | None = Field(default=None, ge=0, le=1)
    evidence: str | None = Field(default=None, max_length=400)
    rationale: str | None = Field(default=None, max_length=500)
    evidence_source: str | None = Field(default=None, max_length=80)
    evidence_record_ids: list[str] = Field(default_factory=list, max_length=20)


class CVExtraction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    synthetic_demo: bool = True
    filename: str
    summary: str | None
    sections: dict[str, list[str]]
    skills: list[ExtractedSkill] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)

"""Transient, synthetic-only CV extraction response."""

from pydantic import BaseModel, ConfigDict, Field


class ExtractedSkill(BaseModel):
    model_config = ConfigDict(extra="forbid")

    original_text: str
    canonical_name: str | None
    skill_id: str | None
    resolution: str


class CVExtraction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    synthetic_demo: bool = True
    filename: str
    summary: str | None
    sections: dict[str, list[str]]
    skills: list[ExtractedSkill] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)

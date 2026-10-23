"""Additive Career Details contract; no scores or learning-pathway mutations."""
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field
from src.models.future_roles import Requirement


class AnalysisRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role_id: str = Field(min_length=1, max_length=200)
    recognised_skill_ids: list[Annotated[str, Field(min_length=1, max_length=200)]] = Field(default_factory=list, max_length=500)
    generate_ai: bool = False


class AnalysisEvidence(BaseModel):
    evidence_id: str
    title: str
    text: str
    url: str


class CapabilityGroup(BaseModel):
    group_id: str
    concept_uri: str
    title: str
    count: int
    mapping_method: str
    concepts: list[Requirement]
    explanation: str


class GapInterpretation(BaseModel):
    group_id: str
    why_relevant: str
    evidence_ids: list[str]


class SkillBridge(BaseModel):
    matched_skill_ids: list[str]
    target_group_id: str
    explanation: str
    evidence_ids: list[str]


class CareerAnalysis(BaseModel):
    schema_version: Literal["1.0"] = "1.0"
    role_id: str
    evidence_key: str
    status: Literal["ready", "partial", "unavailable"] = "unavailable"
    message: str
    groups: list[CapabilityGroup]
    matched: list[Requirement]
    not_evidenced_count: int
    grouping_warning: str | None = None
    assessment: str | None = None
    interpretations: list[GapInterpretation] = Field(default_factory=list)
    bridges: list[SkillBridge] = Field(default_factory=list)
    evidence: list[AnalysisEvidence] = Field(default_factory=list)
    used_cache: bool = False

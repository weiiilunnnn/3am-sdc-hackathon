"""Version 1 JSON contracts. Evidence verification is separate from schema validation."""
from __future__ import annotations

from datetime import date, datetime
import re
from urllib.parse import urlsplit
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, FiniteFloat, StrictInt, field_validator, model_validator

Evidence = Literal["verified", "partially_verified", "unverified", "synthetic"]
Proficiency = Literal["beginner", "intermediate", "advanced", "unknown"]
Direction = Literal["rising", "stable", "declining", "unknown"]
Nonnegative = Annotated[FiniteFloat, Field(ge=0)]
Positive = Annotated[FiniteFloat, Field(gt=0)]


def unique(values: list[str], label: str) -> None:
    if len(values) != len(set(values)):
        raise ValueError(f"Duplicate {label}")


class Contract(BaseModel):
    model_config = ConfigDict(extra="ignore", allow_inf_nan=False)
    schema_version: str

    @field_validator("schema_version")
    @classmethod
    def validate_schema_version(cls, value: str) -> str:
        if not re.fullmatch(r"1\.\d+", value):
            raise ValueError("Unsupported schema version; expected major version 1")
        return value


class Money(BaseModel):
    amount: Nonnegative
    currency: str = Field(pattern=r"^[A-Z]{3}$")


class LearningPreferences(BaseModel):
    hours_per_week: Positive | None = None
    study_days_per_week: Annotated[StrictInt, Field(ge=1, le=7)] = 5
    budget: Money | None = None
    preferred_resource_types: list[Literal["course", "article", "tutorial", "documentation"]] = Field(default_factory=list)


class ProfileSkill(BaseModel):
    skill_id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    proficiency: Proficiency = "unknown"
    self_reported: Literal[True] = True


class UserProfile(Contract):
    profile_id: str = Field(min_length=1, max_length=100)
    is_synthetic: Literal[True]
    education: str | None = None
    experience_years: Nonnegative | None = None
    skills: list[ProfileSkill] = Field(max_length=500)
    interests: list[str] = Field(default_factory=list)
    learning_preferences: LearningPreferences = Field(default_factory=LearningPreferences)
    unresolved_skills: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def ids(self):
        unique([s.skill_id for s in self.skills], "profile skill IDs")
        return self


class Source(BaseModel):
    source_id: str
    evidence_status: Evidence
    source_type: str
    title: str = Field(min_length=1)
    publisher: str = Field(min_length=1)
    url: str | None = None
    license: str | None = None
    license_url: str | None = None
    dataset_version: str | None = None
    native_record_id: str | None = None
    published_at: date | None = None
    observed_at: date | None = None
    accessed_at: date | None = None
    region: str
    supported_claims: list[str]
    redistribution_notes: str | None = None
    transformations: str | None = None

    @field_validator("url", "license_url")
    @classmethod
    def evidence_url(cls, value):
        if value is not None:
            parsed = urlsplit(value)
            if parsed.scheme != "https" or not parsed.hostname or parsed.username or any(c.isspace() for c in value):
                raise ValueError("Evidence URL must be a complete HTTPS URL without credentials")
        return value

    @model_validator(mode="after")
    def evidence_fields(self):
        if self.url is not None and not self.url.startswith("https://"):
            raise ValueError("Evidence URLs must use HTTPS")
        if self.evidence_status == "verified" and (not self.url or not self.accessed_at):
            raise ValueError("Verified evidence needs a URL and verification date")
        return self


class SourceRegistry(Contract):
    sources: list[Source]

    @model_validator(mode="after")
    def ids(self):
        unique([s.source_id for s in self.sources], "source IDs")
        return self


class SkillDefinition(BaseModel):
    skill_id: str
    name: str
    skill_type: Literal["skill", "knowledge", "unknown"] = "unknown"
    aliases: list[str] = Field(default_factory=list)
    source_ids: list[str]
    broader_skill_ids: list[str] = Field(default_factory=list)
    reuse_level: str | None = None


class Requirement(BaseModel):
    skill_id: str
    name: str
    skill_type: Literal["skill", "knowledge", "unknown"] = "unknown"
    requirement: Literal["essential", "optional", "unspecified"]
    source_ids: list[str]


class Occupation(BaseModel):
    role_id: str
    title: str
    description: str
    esco_code: str | None = None
    required_skills: list[Requirement]
    source_ids: list[str]
    region: str
    evidence_status: Evidence
    requirements_complete: bool
    expected_essential_count: Annotated[int, Field(ge=0)]
    aliases: list[str] = Field(default_factory=list)
    status: str = "released"
    language: str = "en"

    @model_validator(mode="after")
    def ids(self):
        unique([s.skill_id for s in self.required_skills], "role requirement IDs")
        return self


class OccupationCatalog(Contract):
    dataset_id: str
    dataset_version: str
    is_synthetic: bool
    occupations: list[Occupation]
    skills: list[SkillDefinition]

    @model_validator(mode="after")
    def ids(self):
        unique([r.role_id for r in self.occupations], "role IDs")
        unique([s.skill_id for s in self.skills], "skill IDs")
        return self


class ObservationPeriod(BaseModel):
    start: date
    end: date
    value: Nonnegative

    @model_validator(mode="after")
    def ordered(self):
        if self.end < self.start:
            raise ValueError("Observation window ends before it starts")
        return self


class TrendSignal(BaseModel):
    signal_id: str
    scope: Literal["role", "skill"]
    role_id: str | None = None
    skill_id: str | None = None
    region: str
    metric: str = Field(min_length=1)
    unit: str = Field(min_length=1)
    period_previous: ObservationPeriod
    period_current: ObservationPeriod
    direction: Direction
    direction_origin: Literal["source", "calculated"] = "source"
    derivation_rule: str = Field(min_length=1)
    comparison_method: str = "owner_defined"
    comparability_confirmed: bool = False
    source_ids: list[str]

    @model_validator(mode="after")
    def target(self):
        if self.scope == "role" and not self.role_id or self.scope == "skill" and not self.skill_id:
            raise ValueError("Signal scope requires its target ID")
        return self


class TrendSnapshot(Contract):
    snapshot_id: str
    is_synthetic: bool
    collected_at: datetime
    source_ids: list[str]
    signals: list[TrendSignal]
    refresh_method: str | None = None
    valid_until: datetime | None = None

    @model_validator(mode="after")
    def times(self):
        if self.collected_at.tzinfo is None or self.valid_until and self.valid_until.tzinfo is None:
            raise ValueError("Trend timestamps must include a timezone")
        unique([s.signal_id for s in self.signals], "signal IDs")
        if self.valid_until and self.valid_until < self.collected_at:
            raise ValueError("Snapshot validity cannot end before collection")
        return self


class ScenarioConfig(Contract):
    scenario_id: str
    version: str
    is_synthetic: bool
    display_label: str
    assumptions: list[str]
    model_method: str
    source_ids: list[str]
    disclaimer: str


class SDGMapping(BaseModel):
    sdg_number: Annotated[int, Field(ge=1, le=17)]
    reason: str = Field(min_length=1)
    source_ids: list[str]
    mapping_owner: str = Field(min_length=1)
    mapping_status: Literal["verified", "proposed", "unknown"]


class SDGMappingSnapshot(Contract):
    snapshot_id: str
    role_sdg_mappings: dict[str, list[SDGMapping]] = Field(default_factory=dict)
    skill_sdg_mappings: dict[str, list[SDGMapping]] = Field(default_factory=dict)


class TimeEstimate(BaseModel):
    value: Nonnegative | None = None
    unit: Literal["hour", "study_day", "study_week"] = "hour"
    basis: Literal["provider_published", "reviewed_app_estimate", "app_rule_of_thumb", "unknown"] = "unknown"
    published_by_provider: bool = False
    rule_id: str | None = None
    notes: str


class PlanningEstimate(BaseModel):
    provider_known_hours: Nonnegative = 0
    reviewed_app_hours: Nonnegative = 0
    fallback_study_days: Nonnegative = 0
    study_days_per_week: Annotated[StrictInt, Field(ge=1, le=7)] = 5
    scheduled_study_days: Nonnegative | None = None
    scheduled_weeks: Nonnegative | None = None
    complete_for_selected_resources: bool = False
    estimate_basis: Literal["provider_hours", "reviewed_app_estimate", "app_rule_of_thumb", "mixed", "unknown"] = "unknown"
    notes: str = "Schedule covers selected materials only, not occupational readiness."


class Resource(BaseModel):
    resource_id: str
    title: str
    provider: str
    url: str
    resource_type: Literal["course", "article", "tutorial", "documentation"]
    covers_skill_ids: list[str]
    prerequisite_skill_ids: list[str] = Field(default_factory=list)
    prerequisite_resource_ids: list[str] = Field(default_factory=list)
    prerequisite_notes: str = ""
    duration_hours: Nonnegative | None = None
    duration_basis: Literal["provider_stated", "estimated_with_method", "unknown"]
    estimated_hours_method: str | None = None
    cost_status: Literal["free", "low_cost", "paid", "unknown"]
    cost: Money | None = None
    access_verified_at: date | None
    source_ids: list[str]
    evidence_status: Evidence
    coverage_note: str = Field(min_length=1)
    access_notes: str
    planning_scope: Literal["short_unit", "bounded_course", "large_collection", "unreviewed"] = "unreviewed"
    scope_review_note: str | None = None
    time_estimate: TimeEstimate | None = None

    @model_validator(mode="after")
    def consistent(self):
        unique(self.covers_skill_ids, "resource coverage IDs")
        unique(self.prerequisite_skill_ids, "prerequisite skill IDs")
        unique(self.prerequisite_resource_ids, "prerequisite resource IDs")
        if not self.url.startswith("https://") or not urlsplit(self.url).hostname:
            raise ValueError("Resource URL must use HTTPS")
        if (self.duration_basis == "unknown") != (self.duration_hours is None):
            raise ValueError("Duration value/basis are inconsistent")
        if self.duration_basis == "estimated_with_method" and not self.estimated_hours_method:
            raise ValueError("Duration estimates need a method")
        if self.cost_status == "free" and self.cost and self.cost.amount != 0:
            raise ValueError("Free resources cannot have a nonzero cost")
        return self


class ResourceCatalog(Contract):
    catalog_version: str
    resources: list[Resource]

    @model_validator(mode="after")
    def ids(self):
        unique([r.resource_id for r in self.resources], "resource IDs")
        return self


class MarketSignalView(BaseModel):
    signal: TrendSignal
    direction: Direction
    status: Literal["available", "unknown", "stale", "unmapped"]
    evidence_status: Evidence
    warnings: list[str] = Field(default_factory=list)


class MarketOutlook(BaseModel):
    direction: Direction = "unknown"
    snapshot_id: str | None = None
    collected_at: datetime | None = None
    evidence_status: Evidence = "unverified"
    freshness_status: Literal["fresh", "stale", "unknown", "synthetic"] = "unknown"
    signals: list[MarketSignalView] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class ScoreBreakdown(BaseModel):
    matched_essential_count: int
    total_essential_count: int
    matched_optional_count: int
    total_optional_count: int


class RequirementCoverage(BaseModel):
    skill_type: Literal["skill", "knowledge", "unknown"]
    matched_essential_count: int
    total_essential_count: int
    coverage_pct: float | None
    source_ids: list[str]


class CompetencyGroup(BaseModel):
    group_id: str
    label: str
    matched_count: int
    total_count: int
    essential_skill_ids: list[str]
    source_ids: list[str]
    mapping_version: str


class CareerMatch(BaseModel):
    role_id: str
    role_title: str
    description: str
    dataset_version: str
    rank_personal_fit: int
    personal_fit_score_pct: float | None
    score_label: str = "Essential skill/knowledge coverage, not employment probability"
    score_breakdown: ScoreBreakdown
    matched_skills: list[Requirement]
    missing_skills: list[Requirement]
    market_outlook: MarketOutlook
    occupation_source_ids: list[str]
    evidence_status: Evidence
    explanation: str
    limitations: list[str]
    sdg_mappings: list[SDGMapping] = Field(default_factory=list)
    skill_sdg_mappings: dict[str, list[SDGMapping]] = Field(default_factory=dict)
    sdg_status: Literal["complete", "partial", "pending"] = "pending"
    pathway_available: bool | None = None
    score_method_version: str = "essential-skill-coverage-v1"
    essential_concept_coverage_pct: float | None = None
    competency_alignment_pct: float | None = None
    display_score_kind: Literal["essential_concept_coverage"] = "essential_concept_coverage"
    score_is_employment_probability: Literal[False] = False
    competency_groups: list[CompetencyGroup] = Field(default_factory=list)
    requirement_type_coverage: list[RequirementCoverage] = Field(default_factory=list)
    priority_gap_skill_ids: list[str] = Field(default_factory=list)
    gap_priority_rule: str = "Alphabetical by canonical label, then canonical ID; not ESCO importance."
    score_limitations: list[str] = Field(default_factory=list)


class MatchResponse(Contract):
    profile_id: str
    profile_fingerprint: str
    occupation_dataset_id: str
    dataset_version: str
    snapshot_id: str | None
    scenario_id: str | None
    scenario_context: ScenarioConfig | None = None
    is_synthetic: bool
    match_method: str = "essential-skill-coverage-v1"
    results: list[CareerMatch]
    unmatched_user_skills: list[str]
    warnings: list[str]
    excluded_roles: list[str] = Field(default_factory=list)
    ranking_basis: Literal["essential_concept_coverage"] = "essential_concept_coverage"
    candidate_role_count: int = 0
    scored_role_count: int = 0


class MatchRequest(Contract):
    profile: UserProfile
    top_k: Annotated[StrictInt, Field(gt=0, le=100)] = 5
    trend_snapshot_id: str | None = None
    trend_snapshot: TrendSnapshot | None = None
    scenario_config: ScenarioConfig | None = None
    sdg_mappings: SDGMappingSnapshot | None = None
    integration_sources: list[Source] = Field(default_factory=list)

    @model_validator(mode="after")
    def snapshot_choice(self):
        unique([s.source_id for s in self.integration_sources], "integration source IDs")
        if self.trend_snapshot_id and self.trend_snapshot:
            raise ValueError("Provide a snapshot ID or an inline snapshot, not both")
        return self


class PathwayRequest(MatchRequest):
    role_id: str


class PathwayPhase(BaseModel):
    phase_id: str
    order: int
    title: str
    target_skill_ids: list[str]
    prerequisite_skill_ids: list[str]
    learning_objectives: list[str]
    resources: list[Resource]
    estimated_hours: float | None
    duration_basis: Literal["provider_stated", "estimated_with_method", "unknown"]
    source_ids: list[str]
    status: Literal["available", "resource_not_found", "blocked"]
    phase_kind: Literal["foundations", "guided_practice", "online_courses", "remaining_gaps"] = "guided_practice"
    planning_estimate: PlanningEstimate | None = None


class PathwayResponse(Contract):
    profile_id: str
    profile_fingerprint: str
    role_id: str
    role_title: str
    dataset_version: str
    is_synthetic: bool
    target_skill_ids: list[str]
    hours_per_week: float | None
    phases: list[PathwayPhase]
    total_known_hours: float
    all_phase_durations_known: bool
    estimated_weeks: int | None
    uncovered_skill_ids: list[str]
    blocked_resource_ids: list[str]
    source_ids: list[str]
    warnings: list[str]
    status: Literal["starter", "covered", "no_documented_gaps", "resource_not_found"]
    coverage_complete: bool = False
    timeline_is_estimated: Literal[True] = True
    planning_estimate: PlanningEstimate | None = None

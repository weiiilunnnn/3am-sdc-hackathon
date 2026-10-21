"""Version 2 compact discovery contracts; legacy coverage/pathway models stay v1."""
from typing import Annotated, Literal
from pydantic import BaseModel, Field, FiniteFloat, StrictInt, model_validator
from .models import UserProfile, Requirement, Source, ScenarioConfig, TrendSnapshot, SDGMappingSnapshot, SDGMapping


class DiscoveryRequest(BaseModel):
    schema_version: Literal['2.0']
    profile: UserProfile
    page_size: Annotated[StrictInt, Field(ge=1, le=25)] = 5
    offset: Annotated[StrictInt, Field(ge=0, le=20000)] = 0
    role_query: str = Field(default='', max_length=100)
    qualification_threshold_pct: Annotated[FiniteFloat, Field(ge=0, le=100)] = 30
    trend_snapshot_id: str | None = None
    trend_snapshot: TrendSnapshot | None = None
    scenario_config: ScenarioConfig | None = None
    sdg_mappings: SDGMappingSnapshot | None = None
    integration_sources: list[Source] = Field(default_factory=list)

    @model_validator(mode='after')
    def snapshot_choice(self):
        if self.trend_snapshot_id and self.trend_snapshot:
            raise ValueError('Provide a snapshot ID or inline snapshot, not both')
        if len({s.source_id for s in self.integration_sources}) != len(self.integration_sources):
            raise ValueError('Duplicate source IDs')
        return self


class RelevanceScore(BaseModel):
    profile_relevance_pct: float | None
    essential_coverage_pct: float | None
    # Explicit compatibility field: still the strict essential fraction.
    personal_fit_score_pct: float | None
    display_kind: Literal['profile_relevance'] = 'profile_relevance'
    method_version: str
    is_hiring_probability: Literal[False] = False
    matched_recognised_skill_count: int
    matched_essential_skill_count: int
    recognised_user_skill_count: int
    qualifying_threshold_pct: float
    informative_skill_ids: list[str]
    weighted_matched_sum: float
    weighted_profile_sum: float
    essential_coverage_numerator: int
    essential_coverage_denominator: int


class DevelopmentArea(BaseModel):
    area_id: str
    title: str
    explanation: str
    not_yet_evidenced_count: int
    supporting_concept_ids: list[str]
    source_ids: list[str]
    mapping_method: Literal['esco_broader_skill_single_parent_v1', 'source_concept_fallback']


class DiscoveryRole(BaseModel):
    role_id: str
    role_title: str
    description: str
    rank: int
    score: RelevanceScore
    qualification_status: Literal['qualified'] = 'qualified'
    qualification_reason: list[str]
    strengths: list[Requirement]
    additional_strength_count: int
    development_areas: list[DevelopmentArea]
    not_evidenced_essential_count: int
    unshown_not_evidenced_count: int
    grouping_warning: str | None
    occupation_source_ids: list[str]
    data_source_status: str
    esco_release: str
    pathway_available: bool
    pathway_coverage_status: Literal['partial_reviewed_resources', 'no_verified_resources', 'no_unevidenced_essentials']
    sdg_mappings: list[SDGMapping] = Field(default_factory=list)
    skill_sdg_mappings: dict[str, list[SDGMapping]] = Field(default_factory=dict)


class DiscoveryResponse(BaseModel):
    schema_version: Literal['2.0'] = '2.0'
    profile_id: str
    profile_fingerprint: str
    dataset_id: str
    esco_release: str
    data_source_status: Literal['local_full', 'local_subset_fallback']
    index_fingerprint: str
    indexed_occupation_count: int
    recognised_user_skill_count: int
    unknown_user_skills: list[str]
    alias_mapping_method: str = 'canonical URI or unambiguous exact preferred/reviewed/provider alternative label; case/whitespace normalised'
    insufficient_evidence: bool
    status: Literal['qualified', 'no_qualifying_roles', 'insufficient_evidence']
    qualification_threshold_pct: float
    scoring_method: str
    scoring_configuration: dict
    discovered_candidate_count: int
    total_qualifying_roles: int
    filtered_qualifying_roles: int
    offset: int
    role_query: str
    next_offset: int | None
    page_size: int
    diagnostic_counts: dict[Literal['qualified', 'below_threshold', 'insufficient_evidence', 'unscorable'], int]
    results: list[DiscoveryRole]
    sources: list[Source]
    warnings: list[str]
    scenario_context: ScenarioConfig | None = None

"""Deterministic essential-concept coverage; market context never changes fit."""
from dataclasses import dataclass
from fractions import Fraction

from .data_repository import supported
from .models import (CareerMatch, MatchResponse, OccupationCatalog, ScenarioConfig,
                     ScoreBreakdown, SDGMappingSnapshot, Source, TrendSnapshot, UserProfile,
                     RequirementCoverage, ResourceCatalog)
from .skills_intake import normalize_profile, profile_fingerprint
from .trend_adapter import adapt_trend_snapshot


@dataclass(frozen=True)
class MatchingConfig:
    top_k: int = 5


def match_roles(profile: UserProfile, occupation_catalog: OccupationCatalog,
                trend_snapshot: TrendSnapshot | None = None, scenario_config: ScenarioConfig | None = None,
                sources: dict[str, Source] | None = None, config: MatchingConfig | None = None,
                sdg_mappings: SDGMappingSnapshot | None = None,
                resources: ResourceCatalog | None = None) -> MatchResponse:
    sources = sources or {}
    config = config or MatchingConfig()
    if isinstance(config.top_k, bool) or not isinstance(config.top_k, int) or not 1 <= config.top_k <= 100:
        raise ValueError("top_k must be an integer from 1 to 100")
    profile = normalize_profile(profile, occupation_catalog)
    have = {s.skill_id for s in profile.skills}
    warnings = ["Synthetic profile; skills are self-reported. Coverage is not a competency assessment.",
                "EU occupational reference; Malaysian hiring demand is not established by this catalogue."]
    if profile.unresolved_skills:
        warnings.append("Unresolved skills were retained but did not contribute to scores.")
    if trend_snapshot and trend_snapshot.is_synthetic:
        warnings.append("Market signals are synthetic test fixtures, not real observations.")
    if scenario_config:
        warnings.append("Scenario assumptions are separate from observations; no numerical scenario transformation is applied.")
        if scenario_config.model_method in ["", "not-yet-defined"] or not supported(scenario_config.source_ids, sources, "scenario_method", synthetic=scenario_config.is_synthetic):
            warnings.append("Scenario method/evidence is pending; this is an illustrative context only.")
    results, excluded = [], []
    reviewed_targets = {sid for r in (resources.resources if resources else [])
                        if r.evidence_status == "verified" and supported(r.source_ids, sources, "skill_mapping")
                        for sid in r.covers_skill_ids}
    if not have:
        warnings.append("Choose at least one recognised skill to calculate matches.")
    for role in occupation_catalog.occupations if have else []:
        if not occupation_catalog.is_synthetic and role.evidence_status != "verified":
            excluded.append(f"{role.title}: occupation verification pending")
            continue
        if not supported(role.source_ids, sources, "occupation", synthetic=occupation_catalog.is_synthetic, native_id=role.role_id):
            excluded.append(f"{role.title}: unsupported occupation evidence")
            continue
        essential = [s for s in role.required_skills if s.requirement == "essential"]
        optional = [s for s in role.required_skills if s.requirement == "optional"]
        if any(not supported(s.source_ids, sources, "role_skill_relationships", synthetic=occupation_catalog.is_synthetic,
                             native_id=role.role_id) for s in role.required_skills):
            excluded.append(f"{role.title}: unsupported requirement evidence; score withheld")
            continue
        complete = role.requirements_complete and len(essential) == role.expected_essential_count
        matched = [s for s in role.required_skills if s.skill_id in have]
        missing = [s for s in role.required_skills if s.skill_id not in have]
        n = sum(s.skill_id in have for s in essential)
        score = round(100 * n / len(essential), 2) if essential and complete else None
        limits = ["All essential skills and knowledge concepts have equal weight.",
                  "Proficiency, interests and experience are not included in this baseline score."]
        if score is None:
            limits.append("Insufficient complete essential-requirement evidence; score unavailable.")
        limits += ["Scores use self-reported skills, not assessed competency.",
                   "Market outlook is not part of personal skill alignment.",
                   "No reviewed competency-domain mapping exists; no alternative alignment score is asserted."]
        types = []
        for kind in ["skill", "knowledge", "unknown"]:
            items = [s for s in essential if s.skill_type == kind]
            if items:
                count = sum(s.skill_id in have for s in items)
                types.append(RequirementCoverage(skill_type=kind, matched_essential_count=count,
                    total_essential_count=len(items), coverage_pct=round(100 * count / len(items), 2) if complete else None,
                    source_ids=sorted({sid for s in items for sid in s.source_ids})))
        priority = sorted((s for s in missing if s.requirement == "essential"),
                          key=lambda s: (s.skill_id not in reviewed_targets, s.name.casefold(), s.skill_id))
        description = (f"Your profile lists {n} of {len(essential)} documented essential concepts. "
            f"{len(essential)-n} essential concepts are not listed. "
            "This measures self-reported requirement coverage, not employment probability.")
        role_maps = sdg_mappings.role_sdg_mappings.get(role.role_id, []) if sdg_mappings else []
        skill_maps = {s.skill_id: sdg_mappings.skill_sdg_mappings.get(s.skill_id, []) for s in role.required_skills} if sdg_mappings else {}
        for mapping in role_maps + [m for maps in skill_maps.values() for m in maps]:
            if mapping.mapping_status == "verified" and not supported(mapping.source_ids, sources, "sdg_mapping"):
                raise ValueError("Verified SDG mappings require reviewed sdg_mapping evidence")
        verified_role = any(m.mapping_status == "verified" for m in role_maps)
        verified_skills = all(any(m.mapping_status == "verified" for m in maps) for maps in skill_maps.values()) if skill_maps else False
        sdg_status = "complete" if verified_role and verified_skills else "partial" if role_maps or any(skill_maps.values()) else "pending"
        results.append(CareerMatch(role_id=role.role_id, role_title=role.title, description=role.description,
            dataset_version=occupation_catalog.dataset_version, rank_personal_fit=0, personal_fit_score_pct=score,
            essential_concept_coverage_pct=score, requirement_type_coverage=types,
            priority_gap_skill_ids=[s.skill_id for s in priority], score_limitations=limits,
            gap_priority_rule="Reviewed resource mappings first, then alphabetical label and canonical ID; not ESCO importance. Prerequisite eligibility is checked in the pathway.",
            score_breakdown=ScoreBreakdown(matched_essential_count=n, total_essential_count=len(essential),
                matched_optional_count=sum(s.skill_id in have for s in optional), total_optional_count=len(optional)),
            matched_skills=matched, missing_skills=missing,
            market_outlook=adapt_trend_snapshot(trend_snapshot, role.role_id, occupation_catalog, sources),
            occupation_source_ids=role.source_ids, evidence_status=role.evidence_status,
            explanation=description, limitations=limits, sdg_mappings=role_maps, skill_sdg_mappings=skill_maps, sdg_status=sdg_status))
    def order(result):
        b = result.score_breakdown
        return (result.personal_fit_score_pct is None,
                -Fraction(b.matched_essential_count, b.total_essential_count) if b.total_essential_count else Fraction(0), result.role_id)
    results.sort(key=order)
    for rank, result in enumerate(results, 1):
        result.rank_personal_fit = rank
    return MatchResponse(schema_version="1.1", profile_id=profile.profile_id, profile_fingerprint=profile_fingerprint(profile),
        occupation_dataset_id=occupation_catalog.dataset_id, dataset_version=occupation_catalog.dataset_version,
        snapshot_id=trend_snapshot.snapshot_id if trend_snapshot else None,
        scenario_id=scenario_config.scenario_id if scenario_config else None, scenario_context=scenario_config,
        is_synthetic=profile.is_synthetic or occupation_catalog.is_synthetic or bool(trend_snapshot and trend_snapshot.is_synthetic), results=results[:config.top_k], unmatched_user_skills=profile.unresolved_skills,
        warnings=warnings, excluded_roles=excluded, candidate_role_count=len(occupation_catalog.occupations),
        scored_role_count=sum(r.personal_fit_score_pct is not None for r in results))

"""Dynamic, evidence-guarded profile relevance; strict coverage stays separate."""
from collections import Counter, defaultdict
from dataclasses import dataclass
from math import fsum, log

from .data_repository import supported
from .discovery_models import DiscoveryResponse, DiscoveryRole, DevelopmentArea, RelevanceScore
from .occupation_index import OccupationIndex
from .skills_intake import normalize_profile, profile_fingerprint


@dataclass(frozen=True)
class RelevanceConfig:
    threshold_pct: float = 30
    optional_strength: float = .4
    informative_max_share: float = .25
    method_version: str = 'profile-relevance-idf-v1'


def development_areas(role, have, index):
    groups, ungrouped = defaultdict(list), 0
    for req in role.required_skills:
        if req.requirement != 'essential' or req.skill_id in have:
            continue
        skill = index.skills[req.skill_id]
        parents = [index.skills[p] for p in skill.broader_skill_ids if p in index.skills
                   and supported(skill.source_ids, index.sources, 'skill_hierarchy', native_id=skill.skill_id)]
        parent = min(parents, key=lambda p: (p.name.casefold(), p.skill_id)) if parents else None
        if parent is None:
            ungrouped += 1
        groups[(parent.skill_id if parent else req.skill_id, bool(parent))].append(req)
    result = []
    for (key, grouped), items in groups.items():
        concept = index.skills[key]
        result.append(DevelopmentArea(area_id=key, title=concept.name,
            explanation=f'{len(items)} documented essential concept(s) not yet evidenced; verify relevance and experience before planning study.',
            not_yet_evidenced_count=len(items), supporting_concept_ids=sorted(x.skill_id for x in items),
            source_ids=sorted({sid for x in items for sid in x.source_ids} | set(concept.source_ids) |
                              {sid for x in items for sid in index.skills[x.skill_id].source_ids}),
            mapping_method='esco_broader_skill_single_parent_v1' if grouped else 'source_concept_fallback'))
    result.sort(key=lambda a: (-a.not_yet_evidenced_count, a.title.casefold(), a.area_id))
    return result[:5], ('Some requirements could not be grouped for display; actual sourced concepts are shown where needed.' if ungrouped else None)


def discover(profile, index: OccupationIndex, *, resources=None, config=None, page_size=5, offset=0,
             role_query='', scenario=None, sdg_mappings=None, response_sources=None):
    config = config or RelevanceConfig()
    if not 0 <= config.threshold_pct <= 100 or not 0 <= config.optional_strength <= 1 or not 0 <= config.informative_max_share <= 1:
        raise ValueError('Invalid relevance configuration')
    if not 1 <= page_size <= 25 or offset < 0:
        raise ValueError('Invalid discovery page')
    profile = normalize_profile(profile, index.catalog, definitions=index.skills, alias_map=index.aliases)
    have = {s.skill_id for s in profile.skills}
    # Never estimate full-population frequencies from the demo shortlist.
    full = index.coverage == 'local_full'
    weights = {sid: 1 + log((index.n + 1) / (index.df.get(sid, 0) + 1)) if full else 1 for sid in sorted(have)}
    denominator = fsum(weights.values())
    candidates = set().union(*(index.reverse.get(sid, set()) for sid in have)) if have else set()
    counts = Counter({s: 0 for s in ['qualified', 'below_threshold', 'insufficient_evidence', 'unscorable']})
    qualified = []
    for rid in sorted(candidates):
        role, edges = index.roles[rid], index.edges[rid]
        essential = {s for s, req in edges.items() if req.requirement == 'essential'}
        matched = sorted(have & edges.keys())
        matched_essential = have & essential
        complete = role.requirements_complete and len(essential) == role.expected_essential_count and bool(essential)
        evidence = supported(role.source_ids, index.sources, 'occupation', synthetic=index.catalog.is_synthetic, native_id=rid) and all(
            supported(req.source_ids, index.sources, 'role_skill_relationships', synthetic=index.catalog.is_synthetic, native_id=rid) for req in edges.values())
        if not evidence or not complete or not denominator:
            counts['unscorable'] += 1
            continue
        informative = [sid for sid in matched if full and index.df.get(sid, 0) / index.n <= config.informative_max_share
                       and index.skills[sid].reuse_level != 'transversal']
        if len(matched) < 2 or not matched_essential or not informative:
            counts['insufficient_evidence'] += 1
            continue
        numerator = fsum(weights[sid] * (1 if edges[sid].requirement == 'essential' else config.optional_strength if edges[sid].requirement == 'optional' else 0) for sid in matched)
        raw = 100 * numerator / denominator
        if raw < config.threshold_pct:
            counts['below_threshold'] += 1
            continue
        counts['qualified'] += 1
        qualified.append((raw, fsum(weights[sid] for sid in sorted(matched_essential)), len(matched), rid, numerator, informative))
    qualified.sort(key=lambda x: (-x[0], -x[1], -x[2], x[3]))
    ranks = {x[3]: i for i, x in enumerate(qualified, 1)}
    query = ' '.join(role_query.casefold().split())
    filtered = [x for x in qualified if not query or any(query in ' '.join(t.casefold().split()) for t in [index.roles[x[3]].title, *index.roles[x[3]].aliases])]
    results, source_ids = [], set()
    reviewed = {sid for r in (resources.resources if resources else []) if r.evidence_status == 'verified' and supported(r.source_ids, index.sources, 'skill_mapping') for sid in r.covers_skill_ids}
    for raw, _, count, rid, numerator, informative in filtered[offset:offset+page_size]:
        role, edges = index.roles[rid], index.edges[rid]
        essential = [x for x in role.required_skills if x.requirement == 'essential']
        matched = sorted((x for x in role.required_skills if x.skill_id in have), key=lambda x: (x.requirement != 'essential', -weights[x.skill_id], x.name.casefold(), x.skill_id))
        areas, warning = development_areas(role, have, index)
        missing = {x.skill_id for x in essential if x.skill_id not in have}
        n = len(essential) - len(missing)
        score = RelevanceScore(profile_relevance_pct=round(raw, 2), essential_coverage_pct=round(100*n/len(essential), 2),
            personal_fit_score_pct=round(100*n/len(essential), 2), method_version=config.method_version,
            matched_recognised_skill_count=count, matched_essential_skill_count=n, recognised_user_skill_count=len(have),
            qualifying_threshold_pct=config.threshold_pct, informative_skill_ids=informative, weighted_matched_sum=numerator,
            weighted_profile_sum=denominator, essential_coverage_numerator=n, essential_coverage_denominator=len(essential))
        maps = sdg_mappings.role_sdg_mappings.get(rid, []) if sdg_mappings else []
        skill_maps = {s: sdg_mappings.skill_sdg_mappings[s] for s in edges if sdg_mappings and s in sdg_mappings.skill_sdg_mappings}
        result = DiscoveryRole(role_id=rid, role_title=role.title, description=role.description, rank=ranks[rid], score=score,
            qualification_reason=[f'{count} distinct listed concepts match, including {n} essential.', f'At least one non-transversal match appears in no more than {config.informative_max_share*100:g}% of the full indexed occupations.', f'Relevance meets the application-defined {config.threshold_pct:g}% threshold.'],
            strengths=matched[:3], additional_strength_count=max(0, len(matched)-3), development_areas=areas,
            not_evidenced_essential_count=len(missing), unshown_not_evidenced_count=len(missing)-sum(a.not_yet_evidenced_count for a in areas), grouping_warning=warning,
            occupation_source_ids=role.source_ids, data_source_status=index.coverage, esco_release=index.catalog.dataset_version,
            pathway_available=True, pathway_coverage_status='no_unevidenced_essentials' if not missing else 'partial_reviewed_resources' if missing & reviewed else 'no_verified_resources',
            sdg_mappings=maps, skill_sdg_mappings=skill_maps)
        source_ids.update(role.source_ids)
        source_ids.update(s for r in result.strengths for s in r.source_ids)
        source_ids.update(s for a in areas for s in a.source_ids)
        source_ids.update(s for m in maps for s in m.source_ids)
        source_ids.update(s for ml in skill_maps.values() for m in ml for s in m.source_ids)
        results.append(result)
    warnings = ['Profile relevance uses listed, self-reported recognised concepts. Omission does not prove absence.',
                'The 30% default, optional weight and specificity guard are application heuristics, not ESCO endorsements or hiring probabilities.',
                'Current job-market demand is not included. ESCO is a European classification, not evidence of Malaysian demand.']
    if not full:
        warnings += [index.warning or 'Limited subset fallback.', 'Full-population frequencies are unavailable: weights are uniform and results cannot pass the informative-match guard. Rebuild the full index to enable qualified discovery.']
    if len(have) < 2:
        warnings.append('Add more recognised, occupationally specific skills for reliable recommendations.')
    if scenario:
        warnings.append('Scenario context is retained; no numerical scenario effect changes personal relevance.')
    no_informative_profile = bool(have) and not any(index.reverse.get(s) and index.skills[s].reuse_level != 'transversal'
        and index.df[s] / index.n <= config.informative_max_share for s in have)
    insufficient = len(have) < 2 or not full or no_informative_profile or bool(candidates) and counts['insufficient_evidence'] == len(candidates)
    return DiscoveryResponse(profile_id=profile.profile_id, profile_fingerprint=profile_fingerprint(profile),
        dataset_id=index.catalog.dataset_id, esco_release=index.catalog.dataset_version, data_source_status=index.coverage,
        index_fingerprint=index.fingerprint, indexed_occupation_count=index.n, recognised_user_skill_count=len(have), unknown_user_skills=profile.unresolved_skills,
        insufficient_evidence=insufficient, status='qualified' if qualified else 'insufficient_evidence' if insufficient else 'no_qualifying_roles',
        qualification_threshold_pct=config.threshold_pct, scoring_method=config.method_version if full else 'profile-relevance-unweighted-fallback-v1',
        scoring_configuration={'idf': '1 + ln((N+1)/(df+1))' if full else 'unavailable; uniform diagnostic weights', 'optional_strength': config.optional_strength,
            'informative_max_share': config.informative_max_share, 'transversal_matches_informative': False, 'frequency_universe_count': index.n if full else None},
        discovered_candidate_count=len(candidates), total_qualifying_roles=len(qualified), filtered_qualifying_roles=len(filtered), offset=offset, role_query=role_query,
        next_offset=offset+page_size if offset+page_size < len(filtered) else None, page_size=page_size, diagnostic_counts=dict(counts),
        results=results, sources=[(response_sources or index.sources)[s] for s in sorted(source_ids) if s in (response_sources or index.sources)], warnings=warnings, scenario_context=scenario)

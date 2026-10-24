"""Bounded local title search; recommendation qualification is never bypassed in v2.

Search scores use the shared IDF/weighted unmatched-penalty display formula.
Only the presentation pool/order differs; these are not qualified recommendations.
"""
from math import fsum, log

from .data_repository import supported
from .discovery_models import RelevanceScore, RoleSearchResponse, RoleSearchResult
from .profile_relevance import RelevanceConfig, development_areas, discover, relevance_percentage
from .skills_intake import normalize_profile


def search_roles(profile, index, *, role_query, page_size=5, offset=0, resources=None,
                 config=None, scenario=None, sdg_mappings=None, response_sources=None):
    config = config or RelevanceConfig()
    query = ' '.join(role_query.casefold().split())
    if not query:
        raise ValueError('A non-empty occupation title is required')
    # Preserve genuine recommendation counts/metadata and the existing scorer.
    baseline = discover(profile, index, resources=resources, config=config,
                        page_size=page_size, scenario=scenario,
                        sdg_mappings=sdg_mappings, response_sources=response_sources)
    profile = normalize_profile(profile, index.catalog, definitions=index.skills, alias_map=index.aliases)
    have = {s.skill_id for s in profile.skills}
    full = index.coverage == 'local_full'
    weights = {sid: 1 + log((index.n + 1) / (index.df.get(sid, 0) + 1)) if full else 1 for sid in sorted(have)}
    denominator = fsum(weights.values())
    found = []
    for rid, role in index.roles.items():
        title = ' '.join(role.title.casefold().split())
        aliases = [' '.join(a.casefold().split()) for a in role.aliases]
        if not supported(role.source_ids, index.sources, 'occupation', synthetic=index.catalog.is_synthetic, native_id=rid):
            continue
        relevance = (0 if title == query else 1 if query in aliases else
                     2 if title.startswith(query) else 3 if query in title else
                     4 if any(a.startswith(query) for a in aliases) else
                     5 if any(query in a for a in aliases) else None)
        if relevance is not None:
            found.append((relevance, title, rid))
    reviewed = {sid for r in (resources.resources if resources else []) if r.evidence_status == 'verified'
                and supported(r.source_ids, index.sources, 'skill_mapping') for sid in r.covers_skill_ids}
    assessments = {}
    for _, _, rid in found:
        role, edges = index.roles[rid], index.edges[rid]
        essential = {s for s, req in edges.items() if req.requirement == 'essential'}
        matched = sorted(have & edges.keys())
        matched_essential = have & essential
        complete = role.requirements_complete and len(essential) == role.expected_essential_count and bool(essential)
        evidence = all(supported(req.source_ids, index.sources, 'role_skill_relationships',
                       synthetic=index.catalog.is_synthetic, native_id=rid) for req in edges.values())
        reason = ('Full-index frequencies are unavailable.' if not full else
                  'No recognised listed skills are available for scoring.' if not denominator else
                  'Complete verified occupation-skill evidence is unavailable.' if not complete or not evidence else None)
        numerator = fsum(weights[sid] * (1 if edges[sid].requirement == 'essential' else config.optional_strength if edges[sid].requirement == 'optional' else 0) for sid in matched)
        raw = relevance_percentage(numerator, denominator, config.unmatched_penalty)
        assessments[rid] = (essential, matched, matched_essential, reason, numerator, raw, complete, evidence)

    def search_order(item):
        _, _, _, reason, _, raw, _, _ = assessments[item[2]]
        # Full-precision backend scores lead; unavailable scores follow real 0%.
        # Existing text relevance/title/URI ordering resolves ties deterministically.
        return (reason is not None, -raw if reason is None else 0, *item)

    found.sort(key=search_order)
    results, source_ids = [], set()
    for rank, (_, _, rid) in enumerate(found[offset:offset + page_size], offset + 1):
        role, edges = index.roles[rid], index.edges[rid]
        essential, matched, matched_essential, reason, numerator, raw, complete, evidence = assessments[rid]
        n = len(matched_essential)
        coverage = round(100 * n / len(essential), 2) if complete and evidence else None
        informative = [sid for sid in matched if full and index.df.get(sid, 0) / index.n <= config.informative_max_share
                       and index.skills[sid].reuse_level != 'transversal']
        score = RelevanceScore(profile_relevance_pct=round(raw, 2) if reason is None else None,
            essential_coverage_pct=coverage, personal_fit_score_pct=coverage, method_version=baseline.scoring_method,
            matched_recognised_skill_count=len(matched), matched_essential_skill_count=n,
            recognised_user_skill_count=len(have), qualifying_threshold_pct=config.threshold_pct,
            informative_skill_ids=informative, weighted_matched_sum=numerator, weighted_profile_sum=denominator,
            essential_coverage_numerator=n, essential_coverage_denominator=len(essential))
        strengths = sorted((edges[s] for s in matched), key=lambda x: (x.requirement != 'essential', -weights[x.skill_id], x.name.casefold(), x.skill_id))
        areas, warning = development_areas(role, have, index)
        missing = essential - have
        maps = sdg_mappings.role_sdg_mappings.get(rid, []) if sdg_mappings else []
        skill_maps = {s: sdg_mappings.skill_sdg_mappings[s] for s in edges if sdg_mappings and s in sdg_mappings.skill_sdg_mappings}
        result = RoleSearchResult(role_id=rid, role_title=role.title, description=role.description, rank=rank,
            score=score, score_unavailable_reason=reason,
            qualification_reason=['Title search result from verified indexed labels; recommendation qualification filters do not apply.',
                                  reason or 'The existing profile-relevance formula is used, including scores below 30%; this is not readiness.'],
            strengths=strengths[:3], additional_strength_count=max(0, len(strengths)-3), development_areas=areas,
            not_evidenced_essential_count=len(missing), unshown_not_evidenced_count=len(missing)-sum(a.not_yet_evidenced_count for a in areas),
            grouping_warning=warning, occupation_source_ids=role.source_ids, data_source_status=index.coverage,
            esco_release=index.catalog.dataset_version, pathway_available=reason is None,
            pathway_coverage_status='no_unevidenced_essentials' if not missing else 'partial_reviewed_resources' if missing & reviewed else 'no_verified_resources',
            sdg_mappings=maps, skill_sdg_mappings=skill_maps)
        source_ids.update(role.source_ids)
        source_ids.update(s for r in result.strengths for s in r.source_ids)
        source_ids.update(s for a in areas for s in a.source_ids)
        source_ids.update(s for m in maps for s in m.source_ids)
        source_ids.update(s for ml in skill_maps.values() for m in ml for s in m.source_ids)
        results.append(result)
    registry = response_sources or index.sources
    return RoleSearchResponse(**{**baseline.model_dump(exclude={'results'}), 'schema_version': '2.1',
        'status': 'search_results' if found else 'no_title_matches', 'role_query': role_query,
        'offset': offset, 'next_offset': offset + page_size if offset + page_size < len(found) else None,
        'total_search_results': len(found), 'results': results,
        'sources': [registry[s] for s in sorted(source_ids) if s in registry]})

"""Existing KW HTTP contracts, registered alongside main's routers."""
import logging
from fastapi import APIRouter, HTTPException, Query
from src.models.future_roles import MatchRequest, MatchResponse, PathwayRequest, PathwayResponse, UserProfile
from src.models.future_role_discovery import DiscoveryRequest, DiscoveryResponse, RoleSearchRequest, RoleSearchResponse
from src.services.future_roles.data_repository import get_catalogues, merge_integration_sources
from src.services.future_roles.future_role_matching import MatchingConfig, match_roles
from src.services.future_roles.personalized_reskilling import build_pathway
from src.services.future_roles.resource_discovery import build_discovered_pathway
from src.services.future_roles.skills_intake import normalize_profile
from src.services.future_roles.workspace_profile import adapt_workspace_profile
from src.services.profile_service import get_profile
from src.services.future_roles.occupation_index import get_occupation_index
from src.services.future_roles.profile_relevance import discover, RelevanceConfig
from src.services.future_roles.role_search import search_roles
from src.services.sources.esco import client as esco_client, EscoError
from src.models.career_analysis import AnalysisRequest, CareerAnalysis
from src.services.future_roles.career_analysis import analyse_career
from src.models.career_analysis import AnalysisJobStart, AnalysisJobStatus, AnalysisJob
from src.services.future_roles import career_jobs

router = APIRouter()


@router.post('/api/v2/roles/analysis/jobs', response_model=AnalysisJob)
def start_career_analysis_job(request: AnalysisJobStart):
    try:
        return career_jobs.start(request, get_occupation_index())
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Occupation not present in the pinned index") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Invalid recognised skills or analysis request") from exc


@router.post('/api/v2/roles/analysis/jobs/status', response_model=AnalysisJob)
def career_analysis_job_status(request: AnalysisJobStatus):
    try:
        return career_jobs.poll(request, get_occupation_index())
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Analysis job not found for this evidence") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Invalid recognised skills or analysis request") from exc


@router.post('/api/v2/roles/analysis', response_model=CareerAnalysis)
def career_analysis(request: AnalysisRequest):
    try:
        return analyse_career(request, get_occupation_index())
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Occupation not present in the pinned index") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def catalogues():
    try:
        return get_catalogues()
    except (ValueError, OSError) as exc:
        logging.getLogger(__name__).error("Reference catalogue failed validation: %s", exc)
        raise HTTPException(status_code=503, detail="Reference data unavailable or invalid. Check the server's catalogue validation log.") from exc


def context(request: MatchRequest, catalogue=None, registry=None):
    bundle = catalogues()
    sources = merge_integration_sources(registry or bundle.sources, request.integration_sources)
    catalogue = catalogue or bundle.occupations
    snapshot = request.trend_snapshot
    if request.trend_snapshot_id:
        snapshot = bundle.snapshots.get(request.trend_snapshot_id)
        if snapshot is None:
            raise ValueError("Unknown trend snapshot ID")
    if request.sdg_mappings:
        if not set(request.sdg_mappings.role_sdg_mappings) <= {r.role_id for r in catalogue.occupations}:
            raise ValueError("Unknown role in SDG mapping")
        if not set(request.sdg_mappings.skill_sdg_mappings) <= {s.skill_id for s in catalogue.skills}:
            raise ValueError("Unknown skill in SDG mapping")
    return bundle, sources, snapshot


@router.get("/api/bootstrap")
def bootstrap() -> dict:
    bundle = catalogues()
    return {
        "schema_version": "1.0", "dataset_id": bundle.occupations.dataset_id,
        "dataset_version": bundle.occupations.dataset_version,
        "skills": [s.model_dump(mode="json") for s in bundle.occupations.skills],
        "roles": [{"role_id": r.role_id, "title": r.title, "source_ids": r.source_ids} for r in bundle.occupations.occupations],
        "profiles": [p.model_dump(mode="json") for p in bundle.profiles],
        "sources": [s.model_dump(mode="json") for s in bundle.sources.values()],
        "trend_snapshots": [{"snapshot_id": s.snapshot_id, "is_synthetic": s.is_synthetic, "collected_at": s.collected_at.isoformat()} for s in bundle.snapshots.values()],
        "integration_status": {"real_trends": "pending", "sdg_mappings": "pending", "scenarios": "pending"},
        "attribution": "This service uses the ESCO classification of the European Commission.",
    }


@router.get("/api/catalogue")
def occupation_catalogue() -> dict:
    return catalogues().occupations.model_dump(mode="json")


@router.get("/api/sources")
def source_registry() -> dict:
    return {"schema_version": "1.0", "sources": [s.model_dump(mode="json") for s in catalogues().sources.values()]}


@router.get("/api/v2/profiles/{profile_id}", response_model=UserProfile)
def workspace_matching_profile(profile_id: str) -> UserProfile:
    saved = get_profile(profile_id)
    if saved is None:
        raise HTTPException(status_code=404, detail="Saved profile not found. Open Profile and save it again.")
    return adapt_workspace_profile(saved, get_occupation_index())


@router.post("/api/profiles/normalize", response_model=UserProfile)
def normalize(request: UserProfile) -> UserProfile:
    return normalize_profile(request, catalogues().occupations)


@router.post("/api/matches", response_model=MatchResponse)
def matching(request: MatchRequest) -> MatchResponse:
    try:
        bundle, sources, snapshot = context(request)
        return match_roles(request.profile, bundle.occupations, snapshot, request.scenario_config, sources,
                           MatchingConfig(request.top_k), request.sdg_mappings, bundle.resources)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/api/pathways", response_model=PathwayResponse)
def pathway(request: PathwayRequest) -> PathwayResponse:
    try:
        index = get_occupation_index()
        bundle, sources, snapshot = context(request, index.catalog, index.sources)
        catalogue = index.catalog
        profile = normalize_profile(request.profile, catalogue, definitions=index.skills, alias_map=index.aliases)
        role = next((r for r in catalogue.occupations if r.role_id == request.role_id), None)
        if role is None:
            raise HTTPException(status_code=404, detail="Role unavailable for this evidence catalogue")
        # Minimal Feature 4 adapter: score only the selected verified record,
        # so a broader catalogue cannot lose it behind the legacy top-100 cap.
        required_ids = {r.skill_id for r in role.required_skills} | {s.skill_id for s in profile.skills}
        catalogue = catalogue.model_copy(update={"occupations": [role], "skills": [index.skills[s] for s in sorted(required_ids)]})
        sources = merge_integration_sources(index.sources, request.integration_sources)
        # The server generates the match; clients cannot forge score/gap arrays.
        matches = match_roles(profile, catalogue, snapshot, request.scenario_config,
                              sources, MatchingConfig(100), request.sdg_mappings, bundle.resources)
        selected = next((r for r in matches.results if r.role_id == request.role_id), None)
        if selected is None:
            raise HTTPException(status_code=404, detail="Role unavailable for this profile or evidence catalogue")
        return build_discovered_pathway(profile, selected, bundle.resources, sources, index)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get('/api/v2/bootstrap')
def discovery_bootstrap():
    from pathlib import Path
    import json
    from src.models.future_roles import UserProfile
    bundle, index = catalogues(), get_occupation_index()
    profiles = list(bundle.profiles)
    extra = Path(__file__).resolve().parents[2] / 'data/demo/discovery_profiles.json'
    if extra.exists():
        profiles += [UserProfile.model_validate(p) for p in json.loads(extra.read_text(encoding='utf-8'))['profiles']]
    ids = {s.skill_id for p in profiles for s in p.skills if s.skill_id in index.skills}
    seeds = sorted(index.skills.values(), key=lambda s: (s.name.casefold(), s.skill_id))[:40]
    ids |= {s.skill_id for s in seeds}
    sources = {sid: s for sid, s in index.sources.items() if not sid.startswith('esco:')}
    for sid in ids:
        for evidence in index.skills[sid].source_ids:
            sources[evidence] = index.sources[evidence]
    return {'schema_version': '2.0', 'dataset_id': index.catalog.dataset_id, 'dataset_version': index.catalog.dataset_version,
        'skills': [index.skills[sid].model_dump(mode='json') for sid in sorted(ids)], 'roles': [],
        'occupation_count': index.n, 'skill_count': len(index.skills), 'profiles': [p.model_dump(mode='json') for p in profiles],
        'sources': [s.model_dump(mode='json') for s in sources.values()], 'trend_snapshots': [],
        'data_source_status': index.coverage, 'coverage_warning': index.warning,
        'integration_status': {'real_trends': 'separate_feature_2', 'sdg_mappings': 'pending', 'scenarios': 'pending'},
        'attribution': 'This service uses the ESCO classification of the European Commission.'}


@router.get('/api/v2/skills')
def search_skills(q: str = Query('', max_length=100), limit: int = Query(40, ge=1, le=40)):
    index = get_occupation_index()
    query = ' '.join(q.casefold().split())
    matches = [s for s in index.skills.values() if not query or any(query in ' '.join(t.casefold().split()) for t in [s.name, *s.aliases])]
    matches.sort(key=lambda s: (s.name.casefold() != query, s.name.casefold(), s.skill_id))
    return {'schema_version': '2.0', 'total': len(matches), 'skills': [s.model_dump(mode='json') for s in matches[:limit]],
            'esco_release': index.catalog.dataset_version, 'data_source_status': index.coverage}


@router.get('/api/v2/roles/detail')
def role_detail(role_id: str = Query(max_length=200)):
    index = get_occupation_index()
    role = index.roles.get(role_id)
    if role is None:
        raise HTTPException(status_code=404, detail='Occupation not present in the pinned index')
    skills = [index.skills[r.skill_id] for r in role.required_skills]
    ids = set(role.source_ids) | {sid for s in skills for sid in s.source_ids}
    return {'role': role.model_dump(mode='json'), 'skills': [s.model_dump(mode='json') for s in skills],
            'sources': [index.sources[sid].model_dump(mode='json') for sid in sorted(ids)], 'data_source_status': index.coverage}


@router.post('/api/v2/matches', response_model=DiscoveryResponse)
def discovery_matching(request: DiscoveryRequest):
    return _discovery_response(request)


@router.post('/api/v2.1/roles/search', response_model=RoleSearchResponse)
def occupation_title_search(request: RoleSearchRequest):
    return _discovery_response(request, title_search=True)


def _discovery_response(request, title_search=False):
    from src.services.future_roles.data_repository import supported
    index, bundle = get_occupation_index(), catalogues()
    try:
        sources = merge_integration_sources(index.sources, request.integration_sources)
        if request.trend_snapshot_id and request.trend_snapshot_id not in bundle.snapshots:
            raise ValueError('Unknown trend snapshot ID')
        if request.sdg_mappings:
            if not set(request.sdg_mappings.role_sdg_mappings) <= index.roles.keys() or not set(request.sdg_mappings.skill_sdg_mappings) <= index.skills.keys():
                raise ValueError('Unknown role or skill in SDG mappings')
            mappings = list(request.sdg_mappings.role_sdg_mappings.values()) + list(request.sdg_mappings.skill_sdg_mappings.values())
            if any(m.mapping_status == 'verified' and not supported(m.source_ids, sources, 'sdg_mapping') for group in mappings for m in group):
                raise ValueError('Verified SDG mappings require registered evidence')
        # Incoming metadata cannot modify the pinned graph/statistics. Trend
        # contracts are retained but deliberately absent from relevance output.
        service = search_roles if title_search else discover
        result = service(request.profile, index, resources=bundle.resources,
            config=RelevanceConfig(threshold_pct=request.qualification_threshold_pct),
            page_size=request.page_size, offset=request.offset, role_query=request.role_query,
            scenario=request.scenario_config, sdg_mappings=request.sdg_mappings, response_sources=sources)
        # Include any permitted synthetic/unverified integration citations too.
        ids = {sid for r in result.results for m in r.sdg_mappings for sid in m.source_ids}
        ids |= {sid for r in result.results for group in r.skill_sdg_mappings.values() for m in group for sid in m.source_ids}
        ids |= set(request.scenario_config.source_ids if request.scenario_config else [])
        result.sources += [sources[sid] for sid in sorted(ids) if sid in sources and sid not in {s.source_id for s in result.sources}]
        return result
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get('/api/esco/lookup')
def official_lookup(kind: str = Query(pattern='^(occupation|skill)$'), uri: str = Query(max_length=200), version: str = 'v1.2.1'):
    index = get_occupation_index()
    try:
        result = esco_client.fetch(kind, version, uri=uri)
        compatible = version == index.catalog.dataset_version
        return {**result, 'data_source_status': 'api_checked' if compatible else 'version_mismatch',
                'compatible_with_matching': compatible, 'matching_release': index.catalog.dataset_version,
                'updates_matching_index': False}
    except EscoError as exc:
        local = index.roles.get(uri) if kind == 'occupation' else index.skills.get(uri)
        return {'data_source_status': 'api_unavailable', 'requested_version': version, 'returned_version': None,
                'matching_release': index.catalog.dataset_version, 'compatible_with_matching': version == index.catalog.dataset_version,
                'record': local.model_dump(mode='json') if local and version == index.catalog.dataset_version else None,
                'local_fallback': bool(local and version == index.catalog.dataset_version), 'error': str(exc), 'updates_matching_index': False}


@router.get('/api/esco/search')
def official_search(kind: str = Query(pattern='^(occupation|skill)$'), q: str = Query(min_length=1, max_length=100),
                    version: str = 'v1.2.1', limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0, le=20000)):
    try:
        result = esco_client.fetch(kind, version, text=q, limit=limit, offset=offset)
        return {**result, 'data_source_status': 'api_checked' if version == get_occupation_index().catalog.dataset_version else 'version_mismatch', 'updates_matching_index': False}
    except EscoError as exc:
        return {'data_source_status': 'api_unavailable', 'requested_version': version, 'returned_version': None, 'error': str(exc), 'record': None, 'updates_matching_index': False}

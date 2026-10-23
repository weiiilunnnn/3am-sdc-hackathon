"""Local, reviewed reference data. No downloads or personal-data persistence."""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
import json
from pathlib import Path

from .models import OccupationCatalog, ResourceCatalog, Source, SourceRegistry, TrendSnapshot, UserProfile

DATA_ROOT = Path(__file__).resolve().parents[1] / "data"


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def supported(source_ids: list[str], sources: dict[str, Source], claim: str,
              *, synthetic: bool = False, native_id: str | None = None) -> bool:
    if not source_ids or any(sid not in sources for sid in source_ids):
        return False
    for sid in source_ids:
        source = sources[sid]
        if source.evidence_status == "verified" and claim in source.supported_claims:
            if native_id is None or source.native_record_id == native_id:
                return True
        if synthetic and source.evidence_status == "synthetic" and "test_fixture_only" in source.supported_claims:
            return True
    return False


def validate_catalogue(catalog: OccupationCatalog, sources: dict[str, Source]) -> None:
    skills = {s.skill_id: s for s in catalog.skills}
    for skill in catalog.skills:
        if not supported(skill.source_ids, sources, "skill_labels", synthetic=catalog.is_synthetic):
            raise ValueError(f"Unsupported skill definition: {skill.skill_id}")
    for role in catalog.occupations:
        if not catalog.is_synthetic and role.evidence_status != "verified":
            raise ValueError(f"Occupation is not verified: {role.role_id}")
        if not catalog.is_synthetic and any(sources[s].dataset_version != catalog.dataset_version for s in role.source_ids if s in sources):
            raise ValueError(f"Occupation source version mismatch: {role.role_id}")
        if not supported(role.source_ids, sources, "occupation", synthetic=catalog.is_synthetic,
                         native_id=role.role_id):
            raise ValueError(f"Unsupported occupation: {role.role_id}")
        for req in role.required_skills:
            if req.skill_id not in skills or req.name != skills[req.skill_id].name:
                raise ValueError(f"Unknown or conflicting requirement: {req.skill_id}")
            if not supported(req.source_ids, sources, "role_skill_relationships",
                             synthetic=catalog.is_synthetic, native_id=role.role_id):
                raise ValueError(f"Unsupported role-skill relationship: {role.role_id} / {req.skill_id}")
        count = sum(s.requirement == "essential" for s in role.required_skills)
        if role.requirements_complete and count != role.expected_essential_count:
            raise ValueError(f"Incomplete requirements: {role.role_id}")


def validate_resources(resources: ResourceCatalog, catalog: OccupationCatalog, sources: dict[str, Source]) -> None:
    skills = {s.skill_id for s in catalog.skills}
    resource_ids = {r.resource_id for r in resources.resources}
    for r in resources.resources:
        if not set(r.covers_skill_ids + r.prerequisite_skill_ids) <= skills:
            raise ValueError(f"Unknown resource skill reference: {r.resource_id}")
        if not set(r.prerequisite_resource_ids) <= resource_ids:
            raise ValueError(f"Unknown prerequisite resource: {r.resource_id}")
        if r.evidence_status == "verified":
            if not any(sources[s].url == r.url and "resource_content" in sources[s].supported_claims
                       for s in r.source_ids if s in sources):
                raise ValueError(f"Resource URL does not match its content evidence: {r.resource_id}")
            for claim in ["resource_content", "skill_mapping"]:
                if not supported(r.source_ids, sources, claim):
                    raise ValueError(f"Missing {claim} provenance: {r.resource_id}")
            if not r.access_verified_at:
                raise ValueError(f"Unverified access: {r.resource_id}")
            if r.duration_basis == "provider_stated" and not supported(r.source_ids, sources, "duration"):
                raise ValueError(f"Unverified provider duration: {r.resource_id}")


@dataclass(frozen=True)
class CatalogueBundle:
    occupations: OccupationCatalog
    resources: ResourceCatalog
    sources: dict[str, Source]
    profiles: list[UserProfile]
    snapshots: dict[str, TrendSnapshot]


def load_catalogues(data_root: Path = DATA_ROOT) -> CatalogueBundle:
    source_list = []
    for filename in ["esco_sources.json", "learning_sources.json", "demo_sources.json", "integration_sources.json"]:
        path = data_root / "sources" / filename
        if path.exists():
            source_list.extend(SourceRegistry.model_validate(read_json(path)).sources)
    sources = {s.source_id: s for s in SourceRegistry(schema_version="1.0", sources=source_list).sources}
    catalog = OccupationCatalog.model_validate(read_json(data_root / "occupations/esco_v1.2.1_en.json"))
    resources = ResourceCatalog.model_validate(read_json(data_root / "resources/catalog_v1.json"))
    validate_catalogue(catalog, sources)
    validate_resources(resources, catalog, sources)
    profiles = [UserProfile.model_validate(p) for p in read_json(data_root / "demo/profiles.json")["profiles"]]
    snapshots = [TrendSnapshot.model_validate(read_json(p)) for p in sorted((data_root / "demo").glob("trend_*.json"))]
    return CatalogueBundle(catalog, resources, sources, profiles, {s.snapshot_id: s for s in snapshots})


@lru_cache(maxsize=1)
def get_catalogues() -> CatalogueBundle:
    return load_catalogues()


def merge_integration_sources(existing: dict[str, Source], incoming: list[Source]) -> dict[str, Source]:
    """HTTP clients cannot grant verification status to new evidence."""
    result = dict(existing)
    for source in incoming:
        if source.source_id in result and source != result[source.source_id]:
            raise ValueError("Integration source IDs cannot override registered evidence")
        if source.evidence_status == "verified" and source.source_id not in result:
            raise ValueError("Register reviewed evidence in data/sources/integration_sources.json first")
        result[source.source_id] = source
    return result

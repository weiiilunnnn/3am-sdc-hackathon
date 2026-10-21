from src.models.future_roles import *


def fixture():
    source = Source(source_id="demo:test", evidence_status="synthetic", source_type="synthetic_fixture",
        title="Fictional test fixture", publisher="Tests", region="unspecified", supported_claims=["test_fixture_only"])
    skills = [SkillDefinition(skill_id="demo:"+s, name=s, source_ids=[source.source_id]) for s in ["python", "sql", "visualization", "extra"]]
    requirements = [Requirement(skill_id=s.skill_id, name=s.name, requirement="essential", source_ids=s.source_ids) for s in skills[:3]]
    role = Occupation(role_id="demo:role", title="Fictional test role", description="Test fixture only", required_skills=requirements,
        source_ids=[source.source_id], region="unspecified", evidence_status="synthetic", requirements_complete=True, expected_essential_count=3)
    catalog = OccupationCatalog(schema_version="1.0", dataset_id="demo:test", dataset_version="demo-v1", is_synthetic=True, occupations=[role], skills=skills)
    profile = UserProfile(schema_version="1.0", profile_id="demo:test", is_synthetic=True, skills=[ProfileSkill(skill_id=s.skill_id, name=s.name) for s in skills[:2]],
        learning_preferences=LearningPreferences(hours_per_week=3, budget=Money(amount=0, currency="MYR")))
    return profile, catalog, {source.source_id: source}


def learning_fixture(targets=None, hours=12):
    targets = targets or ["demo:visualization"]
    source = Source(source_id="test:resource", evidence_status="verified", source_type="provider_course_page",
        title="Fictional test resource - never shipped in app data", publisher="Tests", url="https://example.org/test-fixture",
        accessed_at="2026-10-21", region="unspecified", supported_claims=["resource_content", "skill_mapping", "free_access", "duration"])
    resource = Resource(resource_id="test:course", title="Fictional learning fixture", provider="Tests", url=source.url,
        resource_type="course", covers_skill_ids=targets, duration_hours=hours,
        duration_basis="provider_stated" if hours is not None else "unknown", cost_status="free",
        access_verified_at="2026-10-21", source_ids=[source.source_id], evidence_status="verified",
        coverage_note="Fictional test fixture only", access_notes="Not used by application")
    return ResourceCatalog(schema_version="1.0", catalog_version="test", resources=[resource]), {source.source_id: source}

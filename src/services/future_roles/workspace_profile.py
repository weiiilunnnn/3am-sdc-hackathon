"""Read-only adapter from saved workspace profiles to canonical ESCO profiles."""
from src.data.skills_taxonomy import find_skill_by_id
from src.models.profiles import ProfileRecord
from src.models.future_roles import UserProfile, ProfileSkill
from .occupation_index import OccupationIndex


def adapt_workspace_profile(saved: ProfileRecord, index: OccupationIndex) -> UserProfile:
    skills: dict[str, ProfileSkill] = {}
    unresolved = []
    for skill in saved.skills:
        if skill.taxonomy_source == "ESCO v1.2.1":
            if (
                skill.skill_id
                and skill.skill_id.startswith("http://data.europa.eu/esco/skill/")
                and skill.skill_id in index.skills
            ):
                sid = skill.skill_id
                skills[sid] = ProfileSkill(skill_id=sid, name=index.skills[sid].name,
                                           proficiency=skill.proficiency, self_reported=True)
            else:
                unresolved.append(skill.display_name)
            continue
        labels = [skill.display_name, *skill.input_names]
        local = find_skill_by_id(skill.skill_id) if skill.skill_id and not skill.is_custom else None
        candidates = set()
        for label in labels:
            candidates.update(index.aliases.get(" ".join(label.casefold().split()), set()))
        # Local aliases are a fallback, not extra concepts for an already
        # recognised saved label (abbreviations such as "ML" may be ambiguous).
        if not candidates and local:
            for label in [local["name"], *local["aliases"]]:
                candidates.update(index.aliases.get(" ".join(label.casefold().split()), set()))
        if len(candidates) != 1:
            unresolved.append(skill.display_name)
            continue
        sid = next(iter(candidates))
        # One user skill cannot become several concepts; repeated concepts count once.
        if sid not in skills:
            skills[sid] = ProfileSkill(skill_id=sid, name=index.skills[sid].name,
                                       proficiency=skill.proficiency, self_reported=True)
    return UserProfile(
        schema_version="1.0", profile_id=saved.id, is_synthetic=saved.synthetic_demo,
        education=f"{saved.education_level} · {saved.field_of_study}",
        experience_years=saved.years_experience, skills=list(skills.values()),
        interests=saved.interests, unresolved_skills=sorted(set(unresolved)),
        learning_preferences={
            # The pathway contract requires positive hours; zero means no schedule.
            "hours_per_week": saved.learning_preferences.weekly_hours or None,
            "budget": None if saved.learning_preferences.budget_myr is None else {
                "amount": saved.learning_preferences.budget_myr, "currency": "MYR"},
            "preferred_resource_types": [],
        },
    )

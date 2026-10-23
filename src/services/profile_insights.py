"""Deterministic personal profile checks; never an employability score."""

from src.models.insights import ProfileIndicator, ProfileInsights
from src.models.profiles import ProfileRecord


def _percent(numerator: int, denominator: int) -> float | None:
    return round(numerator / denominator * 100, 1) if denominator else None


def build_profile_insights(profile: ProfileRecord) -> ProfileInsights:
    complete_fields = [
        bool(profile.professional_summary.strip()),
        bool(profile.education),
        bool(profile.field_of_study.strip()),
        bool(profile.current_occupation and profile.current_occupation.strip()) or bool(profile.experience),
        bool(profile.skills),
        bool(profile.interests or profile.transferable_strengths),
        bool(profile.career_aspirations.strip()),
        bool(profile.projects or profile.certifications or profile.achievements),
    ]
    complete_count = sum(complete_fields)
    linked_skills = sum(bool(skill.evidence_record_ids) for skill in profile.skills)
    described_experience = sum(bool(item.description.strip()) for item in profile.experience)
    cv_checks = [
        bool(profile.professional_summary.strip()),
        bool(profile.skills),
        bool(profile.education or profile.experience or profile.projects),
        all(bool(item.description.strip() or item.title.strip()) for item in profile.experience + profile.projects),
    ]

    indicators = [
        ProfileIndicator(
            id="profile-completeness",
            label="Profile information",
            status="available",
            value_percent=_percent(complete_count, len(complete_fields)),
            numerator=complete_count,
            denominator=len(complete_fields),
            interpretation=f"{complete_count} of {len(complete_fields)} optional profile information checks are filled in.",
            limitation="This is an information checklist, not a measure of employability, skill quality, or readiness.",
        ),
        ProfileIndicator(
            id="skill-evidence",
            label="Skills linked to examples",
            status="available" if profile.skills else "not_enough_information",
            value_percent=_percent(linked_skills, len(profile.skills)),
            numerator=linked_skills if profile.skills else None,
            denominator=len(profile.skills) if profile.skills else None,
            interpretation=(
                f"{linked_skills} of {len(profile.skills)} listed skills link to a profile example."
                if profile.skills
                else "Add a skill before this check can be calculated."
            ),
            limitation="Linked examples are self-reported. They are not independently verified.",
        ),
        ProfileIndicator(
            id="experience-descriptions",
            label="Experience descriptions",
            status="available" if profile.experience else "not_enough_information",
            value_percent=_percent(described_experience, len(profile.experience)),
            numerator=described_experience if profile.experience else None,
            denominator=len(profile.experience) if profile.experience else None,
            interpretation=(
                f"{described_experience} of {len(profile.experience)} experience entries include a description."
                if profile.experience
                else "No experience entries are saved; this check is not applicable yet."
            ),
            limitation="The check only looks for non-empty descriptions, not writing quality or accuracy.",
        ),
        ProfileIndicator(
            id="cv-structure",
            label="CV structure checklist",
            status="available",
            value_percent=_percent(sum(cv_checks), len(cv_checks)),
            numerator=sum(cv_checks),
            denominator=len(cv_checks),
            interpretation=f"{sum(cv_checks)} of {len(cv_checks)} basic content-presence checks are met.",
            limitation="This checks saved profile content only. It does not assess a PDF's layout, readability, or hiring outcomes.",
        ),
    ]

    suggestions: list[str] = []
    if not profile.professional_summary:
        suggestions.append("Add a short professional summary in your own words.")
    if profile.skills and not linked_skills:
        suggestions.append("Link one skill to a project, experience, education, or certification example.")
    if profile.experience and described_experience < len(profile.experience):
        suggestions.append("Add a brief description to an experience entry so its context is clearer.")
    if not profile.projects:
        suggestions.append("Add a project if you have one; it can show how you applied a skill.")
    if not suggestions:
        suggestions.append("Review your profile when your skills, experience, or goals change.")

    return ProfileInsights(
        profile_id=profile.id,
        indicators=indicators,
        suggestions=suggestions[:4],
        notice="These are transparent profile-content checks based only on your saved profile. They do not predict career outcomes.",
    )

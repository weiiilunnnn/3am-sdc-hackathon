"""Scheduling conventions kept separate from provider-published hour facts."""
from .models import PlanningEstimate, Resource, TimeEstimate


def resource_time(resource: Resource) -> TimeEstimate:
    # Never trust a prepopulated response estimate over the reviewed catalogue.
    if resource.duration_hours is not None:
        provider = resource.duration_basis == "provider_stated"
        return TimeEstimate(value=resource.duration_hours, unit="hour",
            basis="provider_published" if provider else "reviewed_app_estimate",
            published_by_provider=provider, notes="Provider estimate." if provider else resource.estimated_hours_method or "Reviewed application estimate.")
    if resource.scope_review_note and resource.planning_scope == "short_unit":
        return TimeEstimate(value=1, unit="study_day", basis="app_rule_of_thumb",
            rule_id="short_unit_no_duration_v1", notes="One planned study day for a reviewed discrete unit; not a provider duration or mastery guarantee.")
    if resource.scope_review_note and resource.resource_type == "course" and resource.planning_scope == "bounded_course":
        return TimeEstimate(value=1, unit="study_week", basis="app_rule_of_thumb",
            rule_id="course_no_duration_v1", notes="One planned study week as a scheduling placeholder; not a promise of course completion.")
    return TimeEstimate(notes="Time unavailable: scope is large or lacks a reviewed estimate.")


def plan_time(resources: list[Resource], hours_per_week: float | None, study_days_per_week: int = 5) -> PlanningEstimate:
    if isinstance(study_days_per_week, bool) or not isinstance(study_days_per_week, int) or not 1 <= study_days_per_week <= 7:
        raise ValueError("Study days per week must be between 1 and 7")
    estimates = [resource_time(r) for r in resources]
    provider = sum(t.value for t in estimates if t.basis == "provider_published")
    reviewed = sum(t.value for t in estimates if t.basis == "reviewed_app_estimate")
    fallback = sum(t.value * (study_days_per_week if t.unit == "study_week" else 1)
                   for t in estimates if t.basis == "app_rule_of_thumb")
    known = all(t.value is not None for t in estimates)
    # A sum covering only some selected resources is never a complete schedule.
    convertible = not (provider + reviewed) or hours_per_week is not None and hours_per_week > 0
    weeks = ((provider + reviewed) / hours_per_week if provider + reviewed and hours_per_week else 0) + fallback / study_days_per_week if known and convertible else None
    kinds = {t.basis for t in estimates}
    basis = "unknown" if not known else "mixed" if len(kinds) > 1 else {
        "provider_published": "provider_hours", "reviewed_app_estimate": "reviewed_app_estimate",
        "app_rule_of_thumb": "app_rule_of_thumb"}.get(next(iter(kinds), "provider_published"), "unknown")
    return PlanningEstimate(provider_known_hours=round(provider, 4), reviewed_app_hours=round(reviewed, 4),
        fallback_study_days=fallback, study_days_per_week=study_days_per_week,
        scheduled_weeks=round(weeks, 4) if weeks is not None else None,
        scheduled_study_days=round(weeks * study_days_per_week, 4) if weeks is not None else None,
        complete_for_selected_resources=known, estimate_basis=basis,
        notes=f"Selected materials only. One planned study week = {study_days_per_week} study days. Published/reviewed hours divided by your weekly hours, plus fallback days divided by study days/week. Uncovered gaps are excluded; no job-readiness claim.")

"""Deterministic, prerequisite-aware resource selection from a reviewed catalogue."""
from dataclasses import dataclass
from math import ceil

from .data_repository import supported
from .models import CareerMatch, PathwayPhase, PathwayResponse, ResourceCatalog, Source, UserProfile
from .skills_intake import profile_fingerprint
from .learning_time import plan_time, resource_time


@dataclass(frozen=True)
class PathwayConfig:
    include_optional: bool = False


def build_pathway(profile: UserProfile, selected_career_match: CareerMatch, resources: ResourceCatalog,
                  sources: dict[str, Source], config: PathwayConfig | None = None) -> PathwayResponse:
    config = config or PathwayConfig()
    match = selected_career_match
    if match.personal_fit_score_pct is None:
        raise ValueError("A pathway requires complete, scored role requirements")
    targets = {s.skill_id: s.name for s in match.missing_skills if s.requirement == "essential" or config.include_optional}
    have = {s.skill_id for s in profile.skills}
    preferences = profile.learning_preferences
    budget = preferences.budget
    warnings, blocked = [], set()
    eligible = {}
    for resource in resources.resources:
        if resource.evidence_status != "verified" or not resource.access_verified_at:
            continue
        if not all(supported(resource.source_ids, sources, c) for c in ["resource_content", "skill_mapping"]):
            continue
        if not any(sources[sid].url == resource.url and "resource_content" in sources[sid].supported_claims
                   for sid in resource.source_ids if sid in sources):
            continue
        if resource.cost_status == "free":
            if not supported(resource.source_ids, sources, "free_access"):
                continue
        elif (resource.cost_status not in ["low_cost", "paid"] or not budget or not resource.cost
              or resource.cost.currency != budget.currency or resource.cost.amount > budget.amount):
            continue
        elif not supported(resource.source_ids, sources, "cost"):
            continue
        eligible[resource.resource_id] = resource

    # Dependencies are contextual resource/skill relationships, not ESCO hierarchy edges.
    def closure(rid: str, visiting: set[str], chosen: set[str]):
        if rid in chosen:
            return set(), {}
        if rid in visiting or rid not in eligible:
            raise ValueError("cycle or unavailable prerequisite")
        resource = eligible[rid]
        nodes, edges = {rid}, {rid: set()}
        for dep in resource.prerequisite_resource_ids:
            sub, graph = closure(dep, visiting | {rid}, chosen)
            nodes |= sub
            edges.update(graph)
            # Selected means scheduled, not already studied. Keep the edge
            # even when the prerequisite came from an earlier selection pass.
            edges[rid].add(dep)
        for skill in resource.prerequisite_skill_ids:
            if skill in have:
                continue
            candidates = sorted((r for r in eligible.values() if skill in r.covers_skill_ids),
                                key=lambda r: (r.duration_hours is None, r.duration_hours or 0, r.resource_id))
            found = False
            for candidate in candidates:
                try:
                    sub, graph = closure(candidate.resource_id, visiting | {rid}, chosen)
                    nodes |= sub
                    edges.update(graph)
                    edges[rid].add(candidate.resource_id)
                    found = True
                    break
                except ValueError:
                    continue
            if not found:
                raise ValueError("no eligible prerequisite skill resource")
        return nodes, edges

    remaining, selected, graph = set(targets), set(), {}
    spent: dict[str, float] = {}
    while remaining:
        options = []
        for rid, resource in eligible.items():
            if rid in selected or not remaining.intersection(resource.covers_skill_ids):
                continue
            try:
                nodes, edges = closure(rid, set(), selected)
            except ValueError:
                blocked.add(rid)
                continue
            additions = nodes - selected
            # Budget applies to the whole plan, including prerequisites.
            cost = sum(eligible[n].cost.amount for n in additions if eligible[n].cost)
            if budget and spent.get(budget.currency, 0) + cost > budget.amount:
                continue
            covered = remaining.intersection({s for n in additions for s in eligible[n].covers_skill_ids})
            preferred = resource.resource_type in preferences.preferred_resource_types
            all_known = all(eligible[n].duration_hours is not None for n in additions)
            hours = sum(eligible[n].duration_hours or 0 for n in additions)
            options.append(((-len(covered), -int(preferred), not all_known,
                             resource.resource_origin != "web_discovered", resource.discovery_rank or 0,
                             hours, rid), additions, edges, covered, cost))
        if not options:
            break
        _, additions, edges, covered, cost = min(options, key=lambda option: option[0])
        selected |= additions
        for node, dependencies in edges.items():
            graph.setdefault(node, set()).update(dependencies)
        remaining -= covered
        if budget:
            spent[budget.currency] = spent.get(budget.currency, 0) + cost
    phases, completed = [], set()
    while selected - completed:
        layer = sorted(n for n in selected - completed if graph.get(n, set()) <= completed)
        if not layer:
            blocked |= selected - completed
            warnings.append("Prerequisite cycle detected; affected resources withheld.")
            break
        # Split each dependency layer by learning format; never move a dependent
        # before its prerequisite just to force a fixed phase sequence.
        groups = {}
        for node in layer:
            r = eligible[node]
            kind = ("foundations" if not r.covers_skill_ids else
                    "online_courses" if r.resource_type == "course" else
                    "foundations" if r.resource_type == "article" else "guided_practice")
            groups.setdefault(kind, []).append(r.model_copy(update={"time_estimate": resource_time(r)}))
        for kind in ["foundations", "guided_practice", "online_courses"]:
            items = groups.get(kind, [])
            if not items:
                continue
            addressed = sorted(set(targets).intersection({s for r in items for s in r.covers_skill_ids}))
            durations_known = all(r.duration_hours is not None for r in items)
            phase_number = len(phases) + 1
            phases.append(PathwayPhase(phase_id=f"phase-{phase_number}", order=phase_number,
            title={"foundations": "Foundations", "guided_practice": "Guided Practice", "online_courses": "Online Courses"}[kind],
            phase_kind=kind, planning_estimate=plan_time(items, preferences.hours_per_week, preferences.study_days_per_week),
            target_skill_ids=addressed, prerequisite_skill_ids=sorted({s for r in items for s in r.prerequisite_skill_ids}),
            learning_objectives=[r.coverage_note for r in items], resources=items,
            estimated_hours=round(sum(r.duration_hours or 0 for r in items), 4) if durations_known else None,
            duration_basis="unknown" if not durations_known else "estimated_with_method" if any(r.duration_basis == "estimated_with_method" for r in items) else "provider_stated",
            source_ids=sorted({s for r in items for s in r.source_ids}), status="available"))
        completed.update(layer)
    # Consecutive stages of the same format form one compact roadmap phase.
    # Resource order within a phase retains the topological layer order.
    compact = []
    for phase in phases:
        if compact and compact[-1].phase_kind == phase.phase_kind:
            previous = compact[-1]
            previous.resources.extend(phase.resources)
            previous.target_skill_ids = sorted(set(previous.target_skill_ids + phase.target_skill_ids))
            previous.prerequisite_skill_ids = sorted(set(previous.prerequisite_skill_ids + phase.prerequisite_skill_ids))
            previous.learning_objectives = list(dict.fromkeys(previous.learning_objectives + phase.learning_objectives))
            previous.source_ids = sorted(set(previous.source_ids + phase.source_ids))
            previous.estimated_hours = round(sum(r.duration_hours for r in previous.resources), 4) if all(r.duration_hours is not None for r in previous.resources) else None
            previous.duration_basis = "unknown" if previous.estimated_hours is None else "estimated_with_method" if any(r.duration_basis == "estimated_with_method" for r in previous.resources) else "provider_stated"
            previous.planning_estimate = plan_time(previous.resources, preferences.hours_per_week, preferences.study_days_per_week)
        else:
            phase.order = len(compact) + 1
            phase.phase_id = f"phase-{phase.order}"
            compact.append(phase)
    phases = compact
    delivered = {s for n in completed for s in eligible[n].covers_skill_ids}
    uncovered = sorted(set(targets) - delivered)
    if uncovered:
        phases.append(PathwayPhase(phase_id="uncovered", order=len(phases)+1, title="Next Steps / Remaining Gaps", phase_kind="remaining_gaps",
            target_skill_ids=uncovered, prerequisite_skill_ids=[], learning_objectives=[targets[s] for s in uncovered],
            resources=[], estimated_hours=None, duration_basis="unknown", source_ids=sorted({sid for s in match.missing_skills if s.skill_id in uncovered for sid in s.source_ids}),
            status="resource_not_found"))
        warnings.append(f"No eligible verified route for {len(uncovered)} documented gaps. This is a starter pathway.")
    if blocked:
        warnings.append("Some alternatives have unavailable/cyclic prerequisites or are ineligible; see blocked_resource_ids.")
    known = sum(eligible[n].duration_hours or 0 for n in completed)
    all_known = not uncovered and not (selected - completed) and all(eligible[n].duration_hours is not None for n in completed)
    hours = preferences.hours_per_week
    warnings.append("Resources provide introductory/partial learning support; completion does not establish occupational competency.")
    if completed:
        warnings.append("Prerequisite checks use self-reported skills. Review provider prerequisite notes before studying.")
    schedule = plan_time([eligible[n] for n in sorted(completed)], hours, preferences.study_days_per_week)
    if targets and not completed:
        schedule = schedule.model_copy(update={"scheduled_weeks": None, "scheduled_study_days": None,
                                               "estimate_basis": "unknown"})
    return PathwayResponse(schema_version="1.1", profile_id=profile.profile_id, profile_fingerprint=profile_fingerprint(profile),
        role_id=match.role_id, role_title=match.role_title, dataset_version=match.dataset_version, is_synthetic=profile.is_synthetic,
        target_skill_ids=sorted(targets), hours_per_week=hours, phases=phases, total_known_hours=round(known, 4),
        all_phase_durations_known=all_known, estimated_weeks=ceil(known / hours) if all_known and hours else None,
        uncovered_skill_ids=uncovered, blocked_resource_ids=sorted(blocked),
        source_ids=sorted(set(match.occupation_source_ids) | {s for n in completed for s in eligible[n].source_ids}),
        warnings=warnings, status="no_documented_gaps" if not targets else "resource_not_found" if not completed else "starter" if uncovered else "covered",
        coverage_complete=not uncovered and not (selected - completed), planning_estimate=schedule)

"""Profile-aware presentation of cached, observed signals.

The ranking is a deterministic relevance filter. It is not a prediction model.
"""

from __future__ import annotations

from datetime import datetime, timezone

from src.data.signal_contexts import MAPPING_VERSION, SUPPORTED_CONTEXTS, role_family_for_profile
from src.data.sample_profiles import get_sample_profiles
from src.data.skills_taxonomy import find_skill_by_label, search_skills
from src.services.signal_employment_service import get_employment_dashboard, get_employment_history_summary
from src.services.profile_service import get_profile
from src.services.radar_brief import PRACTICES
from src.services.signal_explanations import get_cached_explanation
from src.services.signal_findings import EXTRACTION_VERSION, get_shared_findings
from src.services.trend_service import SKILL_TOPIC_MAP, get_dashboard


def _sample(sample_id: str) -> dict | None:
    return next((item for item in get_sample_profiles() if item["sample_id"] == sample_id), None)


def _profile_data(sample_id: str | None, profile_id: str | None) -> dict | None:
    if profile_id:
        record = get_profile(profile_id)
        if record is None:
            return None
        return {
            "id": record.id, "label": record.current_occupation or record.field_of_study,
            "occupation": record.current_occupation or record.field_of_study,
            "field_of_study": record.field_of_study, "years_experience": record.years_experience,
            "interests": list(record.interests),
            "work_tasks": list(record.work_activities),
            "aspiration": record.career_aspirations,
            "skills": [{"id": skill.skill_id, "name": skill.display_name} for skill in record.skills],
            "develop": list(record.skills_to_develop), "synthetic": record.synthetic_demo,
        }
    sample = _sample(sample_id or "cs-student")
    if sample is None:
        return None
    return {
        "id": f"sample:{sample['sample_id']}", "label": sample["label"],
        "occupation": sample.get("current_occupation") or sample["field_of_study"],
        "field_of_study": sample["field_of_study"], "years_experience": sample["years_experience"],
        "interests": sample["interests"],
        "work_tasks": sample.get("work_activities", []),
        "aspiration": sample["career_aspirations"],
        "skills": [{"id": skill["skill_id"], "name": skill["name"]} for skill in sample["skills"]],
        "develop": sample["skills_to_develop"], "synthetic": True,
    }


def get_active_profile(sample_id: str | None = None, profile_id: str | None = None) -> dict | None:
    """One profile shape for sample and saved profiles across signal views."""
    return _profile_data(sample_id, profile_id)


def _stale(collected_at: str | None) -> bool:
    if not collected_at:
        return True
    try:
        collected = datetime.fromisoformat(collected_at.replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - collected).total_seconds() > 72 * 60 * 60
    except ValueError:
        return True


def _select_insights(findings: list[dict], profile: dict, reason: str) -> list[dict]:
    known = {skill["id"] for skill in profile["skills"] if skill["id"]}
    goals = {match["id"] for name in profile["develop"] if (match := find_skill_by_label(name))}
    prevalence = [item for item in findings if item["type"] == "posting_prevalence"]
    combinations = [item for item in findings if item["type"] == "skill_cooccurrence"]
    research = [item for item in findings if item["type"] == "research_momentum"]
    prevalence.sort(key=lambda item: (not bool(known.intersection(item["skill_ids"])),
                                      not bool(goals.intersection(item["skill_ids"])), -item["metric"]["numerator"]))
    combinations.sort(key=lambda item: (not bool(known.intersection(item["skill_ids"])), -item["metric"]["numerator"]))
    research.sort(key=lambda item: (not any(topic in SKILL_TOPIC_MAP.get(skill_id, {}) for skill_id in known | goals
                                        for topic in [item["topic_id"]]),
                                    -(item["metric"].get("change_percent") or 0)))
    selected = [group[0] for group in (prevalence, combinations, research) if group][:3]
    for item in selected:
        matched = [skill["name"] for skill in profile["skills"] if skill["id"] in item["skill_ids"]]
        if not matched and item["topic_id"]:
            matched = [skill["name"] for skill in profile["skills"]
                       if item["topic_id"] in SKILL_TOPIC_MAP.get(skill["id"] or "", {})]
        item["why_relevant"] = (
            f"This connects to your listed {', '.join(matched)} skill and {reason}." if matched else
            f"This relates to {reason}; it does not assume you already have or lack the skills shown."
        )
        item["stale"] = _stale(item["source"]["collected_at"])
    return selected


def get_trend_experience(sample_id: str | None = None, profile_id: str | None = None,
                         role_family: str | None = None) -> dict | None:
    profile = _profile_data(sample_id, profile_id)
    if profile is None:
        return None
    inferred_context, context_reason = role_family_for_profile(profile)
    supported = {item["id"]: item for item in SUPPORTED_CONTEXTS}
    if role_family and role_family not in supported:
        return None
    active_context = role_family or inferred_context
    override = bool(role_family and role_family != inferred_context)
    context = {
        "id": active_context, "label": supported[active_context]["label"] if active_context else None,
        "status": "supported" if active_context else "unsupported", "overridden": override,
        "reason": "your selected exploration context" if override else context_reason,
        "mapping_version": MAPPING_VERSION, "available": SUPPORTED_CONTEXTS,
    }
    evidence_version, shared = get_shared_findings(active_context) if active_context else (None, [])
    insights = _select_insights(shared, profile, context["reason"] or "this role context") if active_context else []
    for insight in insights:
        insight["cached_explanation"] = get_cached_explanation(profile, insight)
    research = get_dashboard()
    employment = get_employment_dashboard()
    employment_history = get_employment_history_summary()
    linked: dict[str, list[str]] = {}
    for skill in profile["skills"]:
        for topic_id in SKILL_TOPIC_MAP.get(skill["id"] or "", {}):
            linked.setdefault(topic_id, []).append(f"Your skill: {skill['name']}")
    for name in profile["develop"]:
        taxonomy_skill = find_skill_by_label(name)
        if taxonomy_skill:
            for topic_id in SKILL_TOPIC_MAP.get(taxonomy_skill["id"], {}):
                linked.setdefault(topic_id, []).append(f"Your goal: {name}")

    signals = []
    for topic in research.topics:
        latest = topic.observations[-1] if topic.observations else None
        related_jobs = [job for job in employment.jobs if topic.topic_id in job.topic_ids]
        change = topic.change
        direction = "unavailable"
        if change.status == "available" and change.absolute_change is not None:
            direction = "rising" if change.absolute_change > 0 else "falling" if change.absolute_change < 0 else "flat"
        signals.append({
            "id": topic.topic_id, "name": topic.label,
            "relevance": linked.get(topic.topic_id, []),
            "direction": direction, "research_count": latest.value if latest else None,
            "research_year": latest.period_year if latest else None,
            "change_percent": change.percentage_change if change.status == "available" else None,
            "compared_years": change.compared_years,
            "observations": [{"year": item.period_year, "count": item.value} for item in topic.observations],
            "posting_mentions": len(related_jobs), "posting_sample_size": employment.posting_count,
            "examples": [{"title": job.title, "company": job.company, "url": job.source_url} for job in related_jobs[:2]],
            "action": PRACTICES[topic.topic_id],
            "source_url": topic.source_url,
            "measurement": topic.measurement, "limitations": topic.limitations,
        })
    signals.sort(key=lambda item: (
        not bool(item["relevance"]),
        item["change_percent"] is None,
        -(item["change_percent"] or 0),
        item["name"],
    ))

    counts = {item.skill_id: item for item in employment.skill_counts}
    searchable = []
    seen = set()
    for skill in profile["skills"]:
        key = skill["id"] or skill["name"].casefold()
        if key not in seen:
            found = counts.get(key)
            searchable.append({"id": key, "name": skill["name"], "is_profile_skill": True,
                               "posting_mentions": found.posting_count if found else None,
                               "related_topic_ids": list(SKILL_TOPIC_MAP.get(key, {}))})
            seen.add(key)
    for item in employment.skill_counts:
        if item.skill_id not in seen:
            searchable.append({"id": item.skill_id, "name": item.label, "is_profile_skill": False,
                               "posting_mentions": item.posting_count,
                               "related_topic_ids": list(SKILL_TOPIC_MAP.get(item.skill_id, {}))})
            seen.add(item.skill_id)
    for item in search_skills():
        if item["id"] not in seen:
            searchable.append({"id": item["id"], "name": item["name"], "is_profile_skill": False,
                               "posting_mentions": None,
                               "related_topic_ids": list(SKILL_TOPIC_MAP.get(item["id"], {}))})
            seen.add(item["id"])

    return {
        "profile": profile,
        "context": context, "insights": insights, "evidence_version": evidence_version,
        "processing": {"extraction": f"deterministic phrase matching {EXTRACTION_VERSION}",
                       "mapping_version": MAPPING_VERSION,
                       "page_request_model_inference": False},
        "samples": [{"id": item["sample_id"], "label": item["label"]} for item in get_sample_profiles()],
        "signals": signals, "searchable_skills": searchable,
        "source": {
            "research_name": "OpenAlex", "research_retrieved_at": research.last_successful_refresh,
            "research_status": research.refresh_status,
            "posting_name": "Remote OK", "posting_retrieved_at": employment.last_successful_refresh,
            "posting_status": employment.refresh_status,
            "posting_feed_updated_at": employment.source_feed_updated_at,
            "posting_sample_size": employment.posting_count,
            "posting_url": employment.source["url"],
            "posting_snapshots_saved": employment_history["snapshots"],
            "posting_history_started_at": employment_history["first_collected_at"],
        },
        "method": (
            "Research direction compares adjacent complete publication years for quoted OpenAlex Works searches. "
            "OpenAlex also uses stemming and keyword matching, so these are not strict phrase counts. "
            "The percentage is (latest count − previous count) ÷ previous count, shown only when both years have "
            "at least 10 records. Remote OK counts are mentions in one bounded feed snapshot, not a trend. "
            "Profile links use explicit skill-to-topic rules; linked topics are ordered by observed research "
            "percentage change, not a combined market score. These sources cannot establish that a skill "
            "is declining in employment or will be replaced by AI. Successful posting snapshots are now retained "
            "for later deduplicated comparisons; overlapping feed snapshots alone are not a demand trend."
        ),
    }

"""Profile-aware presentation of cached, observed signals.

The ranking is a deterministic relevance filter. It is not a prediction model.
"""

from __future__ import annotations

from src.data.sample_profiles import get_sample_profiles
from src.data.skills_taxonomy import find_skill_by_label, search_skills
from src.services.employment_service import get_employment_dashboard, get_employment_history_summary
from src.services.profile_service import get_profile
from src.services.radar_brief import PRACTICES
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
        "aspiration": sample["career_aspirations"],
        "skills": [{"id": skill["skill_id"], "name": skill["name"]} for skill in sample["skills"]],
        "develop": sample["skills_to_develop"], "synthetic": True,
    }


def get_trend_experience(sample_id: str | None = None, profile_id: str | None = None) -> dict | None:
    profile = _profile_data(sample_id, profile_id)
    if profile is None:
        return None
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
        "samples": [{"id": item["sample_id"], "label": item["label"]} for item in get_sample_profiles()],
        "signals": signals, "searchable_skills": searchable,
        "source": {
            "research_name": "OpenAlex", "research_retrieved_at": research.last_successful_refresh,
            "research_status": research.refresh_status,
            "posting_name": "Remote OK", "posting_retrieved_at": employment.last_successful_refresh,
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

"""Profile-selected view over saved, shared skill connections."""

from __future__ import annotations

from datetime import datetime, timezone

from src.data.sample_profiles import get_sample_profiles
from src.data.signal_contexts import role_family_for_profile
from src.services.employment_service import get_employment_dashboard
from src.services.skill_connections import get_saved_skill_connections
from src.services.connection_model import get_cached_connection_explanation
from src.services.trend_experience import get_active_profile


def _stale(timestamp: str | None) -> bool:
    if not timestamp:
        return True
    try:
        observed = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - observed).total_seconds() > 72 * 3600
    except ValueError:
        return True


def get_skill_connection_experience(sample_id: str | None = None, profile_id: str | None = None,
                                    skill_id: str | None = None) -> dict | None:
    profile = get_active_profile(sample_id, profile_id)
    if profile is None:
        return None
    evidence_version, saved = get_saved_skill_connections()
    skills = [{**skill, "key": skill["id"] or f"custom:{skill['name'].strip().casefold()}"}
              for skill in profile["skills"]]
    known = {skill["id"] for skill in skills if skill["id"]}
    if skill_id is not None and skill_id not in {skill["key"] for skill in skills}:
        raise ValueError("Selected skill is not listed in this profile.")
    role, _ = role_family_for_profile(profile)
    counts = {item["current_skill_id"]: 0 for item in saved}
    for item in saved:
        if item["current_skill_id"] in known:
            counts[item["current_skill_id"]] += 1
    # Prefer a skill with supported, in-role evidence; retain source profile order for ties.
    def priority(skill: dict) -> tuple[int, int]:
        matches = [item for item in saved if item["current_skill_id"] == skill["id"]]
        return (sum(role in item["role_families"] for item in matches), len(matches))

    default = max(skills, key=priority)["key"] if skills else None
    selected = skill_id or default
    selected_skill = next((item for item in skills if item["key"] == selected), None)
    items = []
    for item in saved:
        if item["current_skill_id"] != (selected_skill["id"] if selected_skill else None):
            continue
        in_role = bool(role and role in item["role_families"])
        task_overlap = bool(set(word.casefold() for task in profile.get("work_tasks", []) for word in task.split())
                            & set(word.casefold() for word in item["work_task"].split()))
        enriched = {**item, "current_skill_name": selected_skill["name"] if selected_skill else "",
                    "in_occupation_scope": in_role, "stale": _stale(item["source"]["collected_at"]),
                    "cached_model_explanation": get_cached_connection_explanation(item),
                    "relevance": (
                        "Your listed skill connects to software-building work in these postings."
                        if in_role else
                        "A connection to your listed skill; the source examples are software roles, not your occupation."
                    )}
        items.append((enriched, task_overlap))
    items.sort(key=lambda pair: (not pair[0]["in_occupation_scope"], not pair[1],
                                 -(pair[0]["employer_count"] or 0), pair[0]["stale"], pair[0]["id"]))
    employment = get_employment_dashboard()
    return {
        "profile": profile, "selected_skill_id": selected, "evidence_version": evidence_version,
        "skills": [{**skill, "connection_count": counts.get(skill["id"], 0)} for skill in skills],
        "connections": [item for item, _ in items[:3]],
        "samples": [{"id": item["sample_id"], "label": item["label"]} for item in get_sample_profiles()],
        "source_state": {"posting_status": employment.refresh_status,
                         "collected_at": employment.last_successful_refresh,
                         "posting_sample_size": employment.posting_count,
                         "cache_fallback": employment.cache_fallback},
        "method": "Exact phrases in retained job descriptions propose a connection. Reviewed mappings describe the possible work implication. Co-occurrence is not correlation, growth, replacement or a requirement for every role.",
    }

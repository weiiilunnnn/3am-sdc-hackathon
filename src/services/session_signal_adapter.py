"""Session-only profile adapter for the shared AI Trend Signal evidence.

Never stores user session fields in SQLite. No demo-profile fallback.
"""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field
from src.data.signal_contexts import role_family_for_profile
from src.data.skills_taxonomy import find_skill_by_id, find_skill_by_label
from src.services.skill_connections import get_saved_skill_connections
from src.services.signal_employment_service import get_signal_employment_dashboard
from src.services.connection_model import get_cached_connection_explanation


class SessionSkill(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=100)
    skill_id: str | None = Field(default=None, max_length=180)


class SessionSignalProfile(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    occupation: str = Field(default="", max_length=120)
    field_of_study: str = Field(default="", max_length=120)
    skills: list[SessionSkill] = Field(min_length=1, max_length=40)
    work_tasks: list[str] = Field(default_factory=list, max_length=12)
    aspiration: str = Field(default="", max_length=240)


# A small, reviewed bridge between exact official ESCO English labels and the
# app's legacy evidence vocabulary. This is NOT an automatic ESCO-to-local
# crosswalk: do not infer equivalence from a shared keyword or arbitrary URI.
# The original ESCO URI remains attached to the user's saved profile.
ESCO_EVIDENCE_LABELS = {
    'python (computer programming)': 'Python programming',
    'perform data analysis': 'Data analysis',
    'analyse data': 'Data analysis',
    'analyze data': 'Data analysis',
    'use machine learning': 'Machine learning',
    'apply machine learning': 'Machine learning',
    'perform machine learning': 'Machine learning',
    'use spreadsheets': 'Spreadsheet analysis',
    'use spreadsheet software': 'Spreadsheet analysis',
    'manage projects': 'Project planning',
    'plan projects': 'Project planning',
    'communicate with others': 'Communication',
    'communicate with customers': 'Customer service',
    'provide customer support': 'Customer service',
    'solve problems': 'Problem solving',
    'think critically': 'Critical thinking',
    'work in teams': 'Teamwork',
    'collaborate in teams': 'Teamwork',
}


def _resolved_skill(skill: SessionSkill) -> dict:
    # Never blindly trust an arbitrary session skill ID. Evidence has legacy
    # local IDs, whereas CV registration uses official ESCO skill identities.
    # Use only exact, reviewed label bridges when looking up evidence.
    label = " ".join(skill.name.casefold().split())
    known = find_skill_by_label(skill.name) or find_skill_by_label(ESCO_EVIDENCE_LABELS.get(label, ""))
    hinted = find_skill_by_id(skill.skill_id) if skill.skill_id else None
    def same_label(taxonomy: dict | None) -> bool:
        return bool(taxonomy and skill.name.casefold() in
                    {str(x).casefold() for x in (taxonomy["name"], *taxonomy["aliases"])})
    resolved = hinted if same_label(hinted) else known
    return {"id": resolved["id"] if resolved else None, "name": skill.name,
            "key": resolved["id"] if resolved else f"custom:{skill.name.strip().casefold()}"}


def get_session_connections(profile: SessionSignalProfile, skill_id: str | None = None) -> dict:
    """Filter previously published evidence by skills from a transient browser session."""
    skills = list({row["key"]: row for row in (_resolved_skill(skill) for skill in profile.skills)}.values())
    if skill_id and skill_id not in {row["key"] for row in skills}:
        raise ValueError("Selected skill is not in the current session profile.")
    context = {
        "occupation": profile.occupation or profile.field_of_study,
        "work_tasks": profile.work_tasks,
        "aspiration": profile.aspiration,
    }
    role, _ = role_family_for_profile(context)
    evidence_version, saved = get_saved_skill_connections()
    direct = [item for item in saved if item.get("basis") == "same_task_passage"]
    counts = {skill["key"]: sum(item["current_skill_id"] == skill["id"] for item in direct)
              for skill in skills}

    # Prefer a supported current skill, but preserve the user's order for ties.
    # Count observed source matches, not verified AI job transitions.
    # Transient session skills are never persisted in SQLite.
    potential_counts = {skill["key"]: sum(item["current_skill_id"] == skill["id"]
                     for item in saved) for skill in skills}
    selected = skill_id or (max(skills, key=lambda skill: sum(row["current_skill_id"] == skill["id"] for row in saved))["key"] if skills else None)
    selected_skill = next((skill for skill in skills if skill["key"] == selected), None)
    results = []
    if selected_skill and selected_skill["id"]:
        for item in direct:
            if item["current_skill_id"] != selected_skill["id"]:
                continue
            in_scope = bool(role and role in item.get("role_families", []))
            cached = get_cached_connection_explanation(item)
            results.append({
                **item, "current_skill_name": selected_skill["name"],
                "in_occupation_scope": in_scope,
                "relevance": (
                    "Evidence is within your occupation group." if in_scope else
                    "Source tasks may be from a different occupation."
                ),
                "cached_model_explanation": cached,
                # Deliberately no queued profile-specific RunPod job: it would
                # persist unconsented session work tasks and occupation.
                "profile_guidance": None, "research_context": None,
            })
    # Separate incidental co-mentions from automatically marked direct passages.
    # None of these is a verified skill transition; LLM review is opt-in.
    candidates = []
    if selected_skill and selected_skill["id"]:
        for item in saved:
            if item["current_skill_id"] != selected_skill["id"] or item.get("basis") != "same_posting":
                continue
            in_scope = bool(role and role in item.get("role_families", []))
            candidates.append({**item, "current_skill_name": selected_skill["name"],
                               "in_occupation_scope": in_scope, "stale": False,
                               "relevance": "Potentially related work; not independently validated.",
                               "cached_model_explanation": None, "profile_guidance": None,
                               "research_context": None})
    candidates.sort(key=lambda item: (not item["in_occupation_scope"],
                                      -(item.get("employer_count") or 0), item["id"]))
    results.sort(key=lambda item: (not item["in_occupation_scope"],
                                   -(item.get("employer_count") or 0), item["id"]))
    source = get_signal_employment_dashboard()
    return {
        "profile": {"id": "session", "occupation": context["occupation"], "synthetic": False},
        "selected_skill_id": selected, "skills": [
            {**skill, "connection_count": counts[skill["key"]], "potential_count": potential_counts[skill["key"]]} for skill in skills
        ],
        "connections": results[:3], "candidates": candidates[:4], "coverage": (
            "supported" if selected and counts.get(selected, 0) else "no_direct_evidence"
        ),
        "evidence_version": evidence_version, "samples": [],
        "source_state": {
            "name": source.source["name"], "posting_sample_size": source.posting_count,
            "collected_at": source.last_successful_refresh, "posting_status": source.refresh_status, "cache_fallback": getattr(source, "cache_fallback", False),
        },
        "method": "Connections must have a cited task passage naming the existing skill and AI work.",
    }

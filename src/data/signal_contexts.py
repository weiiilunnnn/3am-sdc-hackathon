"""Versioned, editorial role/task links; these are not market observations."""

from __future__ import annotations

import re

MAPPING_VERSION = "role-task-v1"
SUPPORTED_CONTEXTS = [
    {"id": "software_engineering", "label": "Software engineering", "tasks": ["Building software", "Developing applications"],
     "topic_ids": ["ai_agents", "rag", "llms"]},
]

_SOFTWARE_TITLE = re.compile(
    r"\b(?:software (?:development )?engineer|(?:backend|frontend|front end|platform|integration|golang) engineer|"
    r"(?:full stack|full-stack|react|python) developer|engineering lead|member of technical staff engineering|developer)\b",
    re.IGNORECASE,
)
_SOFTWARE_PROFILE = re.compile(r"\b(?:software|programming|coding|develop(?:ing)? applications|building software)\b", re.IGNORECASE)


def role_family_for_title(title: str) -> str | None:
    return "software_engineering" if _SOFTWARE_TITLE.search(title) else None


def role_family_for_profile(profile: dict) -> tuple[str | None, str | None]:
    for field, reason in (
        (profile.get("occupation", ""), "your occupation"),
        (" ".join(profile.get("work_tasks", [])), "your stated work activities"),
        (profile.get("aspiration", ""), "your career focus"),
    ):
        if _SOFTWARE_PROFILE.search(field):
            return "software_engineering", reason
    return None, None

"""Small, documented skill vocabulary for the prototype.

ESCO's web service returned HTTP 500 during its announced maintenance on
2026-10-21. The two ESCO entries below were found in the official ESCO search
results as released concepts. The remaining entries are explicitly local
prototype terms and are not presented as ESCO concepts.
"""

from __future__ import annotations

from typing import Any

VOCABULARY_VERSION = "local-seed-v1"
VOCABULARY_REVIEWED_ON = "2026-10-21"
ESCO_CLASSIFICATION_URL = "https://esco.ec.europa.eu/en/classification/skills"
ESCO_API_URL = "https://esco.ec.europa.eu/en/use-esco/use-esco-services-api/esco-web-service-api"
ESCO_REUSE_URL = "https://esco.ec.europa.eu/en/about-esco/faq"


def _local_skill(slug: str, name: str, aliases: list[str]) -> dict[str, Any]:
    return {
        "id": f"local:{slug}",
        "name": name,
        "aliases": aliases,
        "taxonomy_source": "Local prototype vocabulary",
        "esco_uri": None,
        "source_version": VOCABULARY_VERSION,
        "source_url": None,
    }


SKILLS: list[dict[str, Any]] = [
    _local_skill(
        "search-databases",
        "Search databases",
        ["database search", "search database", "searching databases", "consult databases"],
    ),
    _local_skill(
        "statistical-software-development",
        "Develop statistical software",
        ["statistical software development"],
    ),
    _local_skill("python-programming", "Python programming", ["python", "programming in python"]),
    _local_skill("data-analysis", "Data analysis", ["data analytics", "analyse data", "analyze data"]),
    _local_skill("machine-learning", "Machine learning", ["ml"]),
    _local_skill("spreadsheet-analysis", "Spreadsheet analysis", ["spreadsheets", "spreadsheet software"]),
    _local_skill("communication", "Communication", ["written communication", "verbal communication"]),
    _local_skill("problem-solving", "Problem solving", ["problem-solving"]),
    _local_skill("critical-thinking", "Critical thinking", ["critical analysis"]),
    _local_skill("project-planning", "Project planning", ["project management", "planning projects"]),
    _local_skill("teamwork", "Teamwork", ["collaboration", "working in a team"]),
    _local_skill("sustainability-literacy", "Sustainability literacy", ["sustainability", "environmental awareness"]),
    _local_skill("customer-service", "Customer service", ["customer support", "client service"]),
]

_BY_ID = {skill["id"]: skill for skill in SKILLS}


def _normalise_label(value: str) -> str:
    return " ".join(value.casefold().split())


_BY_ALIAS: dict[str, dict[str, Any]] = {}
for _skill in SKILLS:
    for _label in [_skill["name"], *_skill["aliases"]]:
        _BY_ALIAS[_normalise_label(_label)] = _skill


def search_skills(query: str = "") -> list[dict[str, Any]]:
    """Return a copy of the vocabulary, optionally filtered by label."""
    needle = _normalise_label(query)
    found = [
        skill
        for skill in SKILLS
        if not needle
        or needle in _normalise_label(skill["name"])
        or any(needle in _normalise_label(alias) for alias in skill["aliases"])
    ]
    return [dict(skill, aliases=list(skill["aliases"])) for skill in found]


def find_skill_by_id(skill_id: str) -> dict[str, Any] | None:
    skill = _BY_ID.get(skill_id)
    return dict(skill, aliases=list(skill["aliases"])) if skill else None


def find_skill_by_label(label: str) -> dict[str, Any] | None:
    skill = _BY_ALIAS.get(_normalise_label(label))
    return dict(skill, aliases=list(skill["aliases"])) if skill else None


def taxonomy_metadata() -> dict[str, str]:
    return {
        "name": "Local prototype vocabulary",
        "version": VOCABULARY_VERSION,
        "reviewed_on": VOCABULARY_REVIEWED_ON,
        "classification_url": ESCO_CLASSIFICATION_URL,
        "api_url": ESCO_API_URL,
        "reuse_url": ESCO_REUSE_URL,
        "status_note": (
            "ESCO was investigated, but its web service returned HTTP 500 during scheduled maintenance "
            "and the skill pages showed conflicting status. This fallback uses stable local IDs only; "
            "no entry is represented as an ESCO concept."
        ),
    }

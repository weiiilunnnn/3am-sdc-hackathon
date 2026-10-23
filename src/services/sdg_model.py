"""Rank the two best-supported SDGs from the full 17-goal catalog."""

from __future__ import annotations

import csv
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.getenv("PATHWAAY_DATA_DIR", ROOT / "data"))
MAPPING_FILE = DATA_DIR / "synthetic_sdg_skill_mappings.csv"
REFERENCE_FILE = DATA_DIR / "sdg_goal_reference.csv"


@lru_cache(maxsize=1)
def _read_csv(path: Path) -> tuple[dict[str, str], ...]:
    if not path.exists():
        raise RuntimeError(f"Required SDG data file is missing: {path}")
    with path.open(newline="", encoding="utf-8") as handle:
        return tuple(csv.DictReader(handle))


def _normalise_skill(skill: str) -> str:
    return " ".join(skill.casefold().split())


def recommend_sdgs(role: str, profile_skills: list[str] | None = None) -> dict[str, Any]:
    """Rank role mappings, or transparently fall back to exact profile-skill mappings."""
    all_mappings = _read_csv(MAPPING_FILE)
    role_key = _normalise_skill(role)
    mappings = [row for row in all_mappings if _normalise_skill(row["role"]) == role_key]
    mapping_basis = "role"
    if not mappings:
        requested_skills = {_normalise_skill(skill) for skill in profile_skills or [] if skill.strip()}
        matched_rows: dict[tuple[str, str], dict[str, str]] = {}
        for row in all_mappings:
            skill_key = _normalise_skill(row["skill"])
            if skill_key not in requested_skills:
                continue
            key = (skill_key, row["target_code"])
            if key not in matched_rows or float(row["alignment_weight"]) > float(matched_rows[key]["alignment_weight"]):
                matched_rows[key] = row
        mappings = list(matched_rows.values())
        mapping_basis = "profile_skills"
    if not mappings:
        raise ValueError(f"No role-specific SDG mappings or exact current-skill mappings found for role: {role}")

    catalog_rows = _read_csv(REFERENCE_FILE)
    catalog: dict[str, dict[str, Any]] = {}
    for row in catalog_rows:
        goal = catalog.setdefault(row["number"], {
            "number": row["number"],
            "title": row["title"],
            "summary": row["summary"],
            "icon_url": row["icon_url"],
            "targets": [],
        })
        goal["targets"].append({
            "code": row["target_code"],
            "title": row["target_title"],
            "definition": row["target_definition"],
        })
    scores: dict[str, float] = {number: 0.0 for number in catalog}
    skills_by_goal: dict[str, set[str]] = {}
    skill_targets: dict[str, set[str]] = {}
    for row in mappings:
        goal_number = row["target_code"].split(".", 1)[0]
        if goal_number not in catalog:
            continue
        scores[goal_number] = scores.get(goal_number, 0.0) + float(row["alignment_weight"])
        skills_by_goal.setdefault(goal_number, set()).add(row["skill"])
        skill_targets.setdefault(row["skill"], set()).add(row["target_code"])

    ranked_numbers = sorted(
        (number for number, score in scores.items() if score > 0),
        key=lambda number: (-scores[number], int(number)),
    )[:2]
    if not ranked_numbers:
        raise ValueError(f"No supported SDG mappings found for role: {role}")
    max_score = scores[ranked_numbers[0]]
    ranked = []
    for number in ranked_numbers:
        reference = catalog[number]
        targets = reference["targets"][:2]
        ranked.append({
            "number": number,
            "title": reference["title"],
            "summary": reference["summary"],
            "icon_url": reference["icon_url"],
            "relative_fit": round(scores[number] / max_score * 100, 1),
            "mapped_skill_count": len(skills_by_goal[number]),
            "target_codes": [target["code"] for target in targets],
            "targets": targets,
        })

    top_goals = set(ranked_numbers)
    skill_mappings = [
        {"name": skill, "goals": sorted(
            code for code in codes if code.split(".", 1)[0] in top_goals
        )}
        for skill, codes in sorted(skill_targets.items())
    ]
    return {
        "role": role,
        "mapping_basis": mapping_basis,
        "recommended_sdg": ranked_numbers[0],
        "ranked_sdgs": ranked,
        "skill_mappings": skill_mappings,
        "data_notice": (
            "All 17 goals are considered; only goals with role-skill links in this curated synthetic dataset can rank. Relative fit is an illustrative comparison, not a probability or a measure of SDG impact."
            if mapping_basis == "role"
            else "No role-specific mapping is available. These illustrative links use exact matches between current profile skills and skill names in the curated synthetic dataset; they are not occupation-specific evidence, a probability, or a measure of SDG impact."
        ),
    }


def get_sdg_target(code: str) -> dict[str, str] | None:
    """Return the fixed target text from the same reference data used by the UI."""
    for row in _read_csv(REFERENCE_FILE):
        if row["target_code"] == code:
            return {"title": row["target_title"], "definition": row["target_definition"]}
    return None

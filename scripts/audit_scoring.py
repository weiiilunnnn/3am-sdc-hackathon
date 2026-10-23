"""Audit actual canonical ESCO requirements; never assign semantic categories.

The two-type equal-weight candidate is diagnostic only, NOT a production score.
Run before/after catalogue expansion; outputs include every role and persona.
"""
import argparse
from collections import Counter
from fractions import Fraction
import json
from pathlib import Path
import sys
from time import perf_counter

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from src.services.future_roles.data_repository import load_catalogues
from src.services.future_roles.future_role_matching import MatchingConfig, match_roles


def audit():
    bundle = load_catalogues()
    roles = []
    for role in bundle.occupations.occupations:
        essential = [s for s in role.required_skills if s.requirement == "essential"]
        assert len({s.skill_id for s in role.required_skills}) == len(role.required_skills)
        assert len(essential) == role.expected_essential_count and role.requirements_complete
        roles.append({"role_id": role.role_id, "title": role.title,
                      "essential_count": len(essential),
                      "optional_count": sum(s.requirement == "optional" for s in role.required_skills),
                      "essential_types": dict(Counter(s.skill_type for s in essential)),
                      "source_ids": role.source_ids})
    comparisons = []
    started = perf_counter()
    for profile in bundle.profiles:
        response = match_roles(profile, bundle.occupations, sources=bundle.sources, config=MatchingConfig(100))
        for match in response.results:
            all_essential = [s for s in match.matched_skills + match.missing_skills if s.requirement == "essential"]
            typed = []
            for kind in sorted({s.skill_type for s in all_essential}):
                group = [s for s in all_essential if s.skill_type == kind]
                matched = sum(s.skill_id in {x.skill_id for x in match.matched_skills} for s in group)
                typed.append(Fraction(matched, len(group)))
            comparisons.append({"profile_id": profile.profile_id, "role_id": match.role_id,
                "role_title": match.role_title, "rank": match.rank_personal_fit,
                "strict_coverage_pct": match.personal_fit_score_pct,
                "diagnostic_type_balanced_pct": round(float(100 * sum(typed) / len(typed)), 2),
                "adopted_display_pct": match.personal_fit_score_pct})
    return {"dataset_id": bundle.occupations.dataset_id, "dataset_version": bundle.occupations.dataset_version,
        "decision": "Retain strict coverage. Skill/knowledge types are not competency domains; no reviewed domain assignments exist.",
        "diagnostic_formula": "100 * mean(matched / total for each nonempty skill_type); not used by application",
        "aliases": [{"skill_id": s.skill_id, "name": s.name, "aliases": s.aliases} for s in bundle.occupations.skills if s.aliases],
        "roles": roles, "comparisons": comparisons,
        "three_profile_matching_ms": round((perf_counter() - started) * 1000, 3)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default="docs/scoring-audit.json")
    args = parser.parse_args()
    result = audit()
    (ROOT / args.output).write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(f"Audited {len(result['roles'])} roles / {len(result['comparisons'])} profile-role pairs; {result['decision']}")

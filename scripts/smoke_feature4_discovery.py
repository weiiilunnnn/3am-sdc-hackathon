"""Opt-in real-provider smoke check. Ordinary tests must never invoke this mode."""
import argparse
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live", action="store_true", help="Explicitly spend bounded provider credits")
    args = parser.parse_args()
    if not args.live or not all(os.getenv(k) for k in ("TAVILY_API_KEY", "RUNPOD_API_KEY")):
        print("LIVE END-TO-END NOT TESTED: requires --live and both server-side provider keys.")
        return 0
    from src.services.future_roles.data_repository import get_catalogues
    from src.services.future_roles.occupation_index import get_occupation_index
    from src.services.future_roles.profile_relevance import discover
    from src.api.future_roles import pathway
    from src.models.future_roles import PathwayRequest
    index, bundle = get_occupation_index(), get_catalogues()
    audit, pages = [], {}
    for profile in bundle.profiles[:2]:
        ranked = discover(profile, index, resources=bundle.resources, page_size=5)
        seen = {x["role_id"] for x in audit}
        selected = next((r for r in ranked.results if r.role_id not in seen), None)
        if not selected:
            print("No distinct qualified role for a synthetic profile; check skipped.")
            continue
        result = pathway(PathwayRequest(schema_version="1.0", profile=profile, role_id=selected.role_id))
        resources = [r for p in result.phases for r in p.resources if r.resource_origin == "web_discovered"]
        audit.append({"role_id": result.role_id, "status": result.discovery_status,
            "metrics": result.discovery_metrics, "uncovered": len(result.uncovered_skill_ids),
            "resources": [{"url": r.url, "title": r.title, "checked_at": str(r.content_verified_at),
                "mapping_evidence": r.mapping_evidence, "claim_evidence": r.claim_evidence} for r in resources]})
        for r in resources:
            pages[r.url] = r
        print(f"{result.role_title}: {result.discovery_status}; online={len(resources)}; uncovered={len(result.uncovered_skill_ids)}")
        print("Counters:", json.dumps(result.discovery_metrics, sort_keys=True))
    for resource in list(pages.values())[:3]:
        print("Provider page:", resource.title, resource.url, "checked", resource.content_verified_at)
    if len(pages) < 3:
        print(f"Only {len(pages)} distinct eligible provider pages passed checks; fewer than three were available.")
    target = ROOT / ".cache/feature4-live-audit.json"
    target.parent.mkdir(exist_ok=True)
    target.write_text(json.dumps(audit, indent=2), encoding="utf-8")
    print("Evidence audit:", target.relative_to(ROOT))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

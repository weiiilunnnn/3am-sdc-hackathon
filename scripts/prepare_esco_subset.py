"""Fetch the reviewed technology-role ESCO shortlist. Never runs at app startup."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
VERSION = "v1.2.1"
ROLES = {
    "f2b15a0e-e65a-438a-affb-29b9d50b77d1": "software developer",
    "258e46f9-0075-4a2e-adae-1ff0477e0f30": "data scientist",
    "c40a2919-48a9-40ea-b506-1f34f693496d": "web developer",
    "35553663-deab-4d9a-bf22-15c1625d28e8": "artificial intelligence engineer",
    "b11e1742-5e28-4270-b081-b0193d85ee7d": "database developer",
    "bd272aee-adc9-4a06-a15c-a73b4b4a46a7": "ICT application developer",
    "a7c1d23d-aeca-4bee-9a08-5993ed98b135": "ICT system developer",
    "52d5edc9-7902-4cd3-8b06-6bd77c98d440": "ICT system tester",
    "0ab5c12c-c1c1-4772-8345-aa287d0e391d": "ICT test analyst",
    "a6a0b60f-08da-4faa-bf54-942987efb471": "ICT system analyst",
    "fe0fa514-b48d-4a53-9757-a283c0baacf0": "ICT business analyst",
    "64c7d461-152c-477f-a8e2-c2c537e9d617": "ICT network technician",
    "a44a1dc5-be08-4840-8bd5-770c4ac1ca6d": "ICT security technician",
    "aaeec9a7-dc57-4485-890c-86b3eef735f9": "ICT help desk agent",
    "22987b58-dbfa-4ecd-ae3f-82dd209255f6": "green ICT consultant",
}


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def prepare(verified_date: str) -> None:
    occupations, skills, sources, checks = [], {}, [], []
    for uuid, expected in ROLES.items():
        uri = f"http://data.europa.eu/esco/occupation/{uuid}"
        url = "https://ec.europa.eu/esco/api/resource/occupation?" + urlencode(
            {"uri": uri, "language": "en", "selectedVersion": VERSION})
        request = Request(url, headers={"Accept": "application/json", "User-Agent": "3AM-source-audit/1.0"})
        with urlopen(request, timeout=45) as response:
            raw = response.read()
        record = json.loads(raw)
        if record.get("uri") != uri or record.get("title") != expected or record.get("status") != "released":
            raise ValueError(f"Unexpected/obsolete record for {expected}")
        source_id = f"esco:occupation:{uuid}"
        requirements = []
        for relation, importance in [("hasEssentialSkill", "essential"), ("hasOptionalSkill", "optional")]:
            for item in record["_links"].get(relation, []):
                sid, name = item["uri"], item["title"]
                kind = item.get("skillType", "").rsplit("/", 1)[-1] or "unknown"
                skill = skills.setdefault(sid, {"skill_id": sid, "name": name,
                    "skill_type": kind, "aliases": [], "source_ids": []})
                if source_id not in skill["source_ids"]:
                    skill["source_ids"].append(source_id)
                requirements.append({"skill_id": sid, "name": name, "skill_type": kind,
                    "requirement": importance, "source_ids": [source_id]})
        essential_count = sum(r["requirement"] == "essential" for r in requirements)
        if not essential_count or len({r["skill_id"] for r in requirements}) != len(requirements):
            raise ValueError(f"Missing or duplicate relationships: {expected}")
        description = record.get("description", {}).get("en", {})
        if isinstance(description, dict):
            description = description.get("literal", "")
        occupations.append({"role_id": uri, "title": expected, "description": description,
            "esco_code": record.get("code"), "source_ids": [source_id],
            "required_skills": sorted(requirements, key=lambda r: (r["requirement"], r["name"])),
            "region": "EU", "evidence_status": "verified", "requirements_complete": True,
            "expected_essential_count": essential_count})
        sources.append({"source_id": source_id, "evidence_status": "verified",
            "source_type": "occupation_dataset", "title": f"ESCO {VERSION}: {expected}",
            "publisher": "European Commission", "url": url,
            "license": "European Commission reuse conditions (2011/833/EU); ESCO acknowledgement required",
            "license_url": "https://esco.ec.europa.eu/en/about-esco/faq?page=1",
            "dataset_version": VERSION, "native_record_id": uri, "published_at": None,
            "observed_at": None, "accessed_at": verified_date, "region": "EU",
            "supported_claims": ["occupation", "skill_labels", "role_skill_relationships"],
            "redistribution_notes": "English subset; essential/optional semantics preserved. No endorsement implied.",
            "transformations": "English labels/description and complete essential/optional relationships extracted; equal-weight scoring is our own method."})
        checks.append({"source_id": source_id, "checked_at": verified_date,
            "method": "Official version-pinned JSON request; native URI/title/released status and relationship arrays checked",
            "response_sha256": hashlib.sha256(raw).hexdigest(),
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
            "essential_count": essential_count, "optional_count": len(requirements)-essential_count})
        print(f"{expected}: {essential_count} essential; {len(requirements)-essential_count} optional")
    aliases = {"Python (computer programming)": ["Python"], "SQL": ["Structured Query Language"],
        "JavaScript": ["JS"], "computer programming": ["programming"]}
    for skill in skills.values():
        skill["aliases"] = aliases.get(skill["name"], [])
    write_json(ROOT / "data/occupations/esco_v1.2.1_en.json", {"schema_version": "1.0",
        "dataset_id": "esco-tech-shortlist", "dataset_version": VERSION, "is_synthetic": False,
        "occupations": occupations, "skills": sorted(skills.values(), key=lambda s: s["name"])})
    write_json(ROOT / "data/sources/esco_sources.json", {"schema_version": "1.0", "sources": sources})
    write_json(ROOT / "data/sources/esco_verification_log.json", {"schema_version": "1.0", "checks": checks})


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verified-date", default=datetime.now(timezone.utc).date().isoformat())
    prepare(parser.parse_args().verified_date)

"""Generate reproducible synthetic profiles that use KW's ESCO identifiers."""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
import random
import subprocess
from pathlib import Path
from typing import Iterator

ROOT = Path(__file__).resolve().parents[1]
SOURCE_FILES = (
    Path("occupations.csv"),
    Path("skills.csv"),
    Path("essential_relationships.csv"),
    Path("optional_relationships.csv"),
)
ESCO_ATTRIBUTION = (
    "ESCO v1.2.1; European Commission reuse conditions (2011/833/EU). "
    "ESCO acknowledgement required."
)
ESCO_LICENSE_URL = "https://esco.ec.europa.eu/en/about-esco/faq?page=1"


def read_csv_rows(
    filename: Path,
    kw_data_dir: Path | None,
    kw_git_ref: str,
) -> list[dict[str, str]]:
    if kw_data_dir is not None:
        source_path = kw_data_dir / filename
        with source_path.open(encoding="utf-8-sig", newline="") as source:
            return list(csv.DictReader(source))

    git_path = Path("data") / "csv" / filename
    result = subprocess.run(
        ["git", "show", f"{kw_git_ref}:{git_path.as_posix()}"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8-sig",
    )
    return list(csv.DictReader(io.StringIO(result.stdout)))


def field(row: dict[str, str], name: str) -> str:
    value = row.get(name) or row.get(f"\ufeff{name}")
    if not value:
        raise ValueError(f"KW row is missing required field {name!r}")
    return value


def generate_rows(
    occupations: list[dict[str, str]],
    skills: list[dict[str, str]],
    essential_relationships: list[dict[str, str]],
    optional_relationships: list[dict[str, str]],
    count: int,
    seed: int,
) -> Iterator[tuple[dict[str, object], dict[str, object]]]:
    if count < 1:
        raise ValueError("count must be greater than zero")

    occupation_by_id: dict[str, dict[str, str]] = {}
    for occupation in occupations:
        role_id = field(occupation, "role_id")
        if role_id in occupation_by_id:
            raise ValueError(f"Duplicate KW occupation ID: {role_id}")
        occupation_by_id[role_id] = occupation

    skill_by_id: dict[str, dict[str, str]] = {}
    for skill in skills:
        skill_id = field(skill, "skill_id")
        if skill_id in skill_by_id:
            raise ValueError(f"Duplicate KW skill ID: {skill_id}")
        skill_by_id[skill_id] = skill

    def index_relationships(
        relationships: list[dict[str, str]],
    ) -> dict[str, list[str]]:
        indexed: dict[str, list[str]] = {}
        for relationship in relationships:
            role_id = field(relationship, "role_id")
            skill_id = field(relationship, "skill_id")
            if role_id not in occupation_by_id:
                raise ValueError(f"Relationship references unknown occupation ID: {role_id}")
            if skill_id not in skill_by_id:
                raise ValueError(f"Relationship references unknown skill ID: {skill_id}")
            role_skills = indexed.setdefault(role_id, [])
            if skill_id not in role_skills:
                role_skills.append(skill_id)
        return indexed

    essential_by_role = index_relationships(essential_relationships)
    optional_by_role = index_relationships(optional_relationships)
    eligible_roles = sorted(
        role_id for role_id, role_skills in essential_by_role.items() if role_skills
    )
    if not eligible_roles:
        raise ValueError("KW data has no occupations with essential skill relationships")

    all_skill_ids = sorted(skill_by_id)
    rng = random.Random(seed)
    for row_number in range(1, count + 1):
        role_id = rng.choice(eligible_roles)
        essential_ids = essential_by_role[role_id]
        role_skill_ids = set(essential_ids) | set(optional_by_role.get(role_id, []))
        selected_essential_count = rng.randint(1, min(20, len(essential_ids)))
        selected_ids = set(rng.sample(essential_ids, selected_essential_count))

        optional_ids = [
            skill_id
            for skill_id in optional_by_role.get(role_id, [])
            if skill_id not in selected_ids
        ]
        selected_optional_count = rng.randint(0, min(3, len(optional_ids)))
        if selected_optional_count:
            selected_ids.update(rng.sample(optional_ids, selected_optional_count))

        unrelated_skill_count = rng.randint(
            0, min(2, len(all_skill_ids) - len(role_skill_ids))
        )
        added_unrelated_count = 0
        while added_unrelated_count < unrelated_skill_count:
            candidate = rng.choice(all_skill_ids)
            if candidate not in role_skill_ids and candidate not in selected_ids:
                selected_ids.add(candidate)
                added_unrelated_count += 1

        profile_id = f"synthetic-kw-{row_number:06d}"
        profile_skills = [
            {
                "skill_id": skill_id,
                "name": skill_by_id[skill_id]["name"],
                "proficiency": "unknown",
                "self_reported": True,
            }
            for skill_id in sorted(selected_ids)
        ]
        profile: dict[str, object] = {
            "schema_version": "1.0",
            "profile_id": profile_id,
            "is_synthetic": True,
            "education": None,
            "experience_years": None,
            "skills": profile_skills,
            "interests": [],
            "learning_preferences": {
                "hours_per_week": None,
                "study_days_per_week": 5,
                "budget": None,
                "preferred_resource_types": [],
            },
            "unresolved_skills": [],
        }
        target = {
            "profile_id": profile_id,
            "synthetic_target_role_id": role_id,
            "synthetic_target_role_title": occupation_by_id[role_id]["title"],
            "available_essential_skill_count": len(essential_ids),
            "selected_essential_skill_count": selected_essential_count,
            "selected_optional_skill_count": selected_optional_count,
            "unrelated_skill_count": added_unrelated_count,
        }
        yield profile, target


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def create_dataset(
    output_dir: Path,
    count: int,
    seed: int,
    kw_data_dir: Path | None,
    kw_git_ref: str,
) -> dict[str, object]:
    source_data = {
        filename.stem: read_csv_rows(filename, kw_data_dir, kw_git_ref)
        for filename in SOURCE_FILES
    }
    profiles_path = output_dir / "kw_profiles_v1.jsonl.gz"
    targets_path = output_dir / "kw_profile_targets_v1.csv"
    output_dir.mkdir(parents=True, exist_ok=True)

    compressed_profiles = gzip.GzipFile(
        filename=str(profiles_path),
        mode="wb",
        mtime=0,
    )
    with io.TextIOWrapper(
        compressed_profiles,
        encoding="utf-8",
        newline="\n",
    ) as profiles_file:
        with targets_path.open("w", encoding="utf-8", newline="") as targets_file:
            target_fields = [
                "profile_id",
                "synthetic_target_role_id",
                "synthetic_target_role_title",
                "available_essential_skill_count",
                "selected_essential_skill_count",
                "selected_optional_skill_count",
                "unrelated_skill_count",
            ]
            writer = csv.DictWriter(targets_file, fieldnames=target_fields)
            writer.writeheader()
            for profile, target in generate_rows(
                occupations=source_data["occupations"],
                skills=source_data["skills"],
                essential_relationships=source_data["essential_relationships"],
                optional_relationships=source_data["optional_relationships"],
                count=count,
                seed=seed,
            ):
                profiles_file.write(
                    json.dumps(profile, ensure_ascii=False, separators=(",", ":")) + "\n"
                )
                writer.writerow(target)

    revision = None
    if kw_data_dir is None:
        revision_result = subprocess.run(
            ["git", "rev-parse", kw_git_ref],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        revision = revision_result.stdout.strip()

    manifest: dict[str, object] = {
        "dataset_id": "kw-synthetic-profiles-v1",
        "schema_version": "1.0",
        "synthetic": True,
        "profile_count": count,
        "seed": seed,
        "profile_format": "one KW UserProfile JSON object per JSONL line",
        "target_labels_file": targets_path.name,
        "source": {
            "name": "ESCO",
            "version": "1.2.1",
            "kw_git_ref": kw_git_ref if kw_data_dir is None else None,
            "kw_git_revision": revision,
            "license_and_attribution": ESCO_ATTRIBUTION,
            "license_url": ESCO_LICENSE_URL,
            "inputs": [str(Path("data") / "csv" / filename) for filename in SOURCE_FILES],
        },
        "generation_method": (
            "Uniformly sample an occupation with essential skill relationships; select "
            "1-20 essential skills, 0-3 optional skills, and 0-2 skills from the full "
            "ESCO skill catalog that are not linked to that target occupation. "
            "Proficiency and non-skill profile fields are left unknown or empty."
        ),
        "limitations": [
            "All profiles and target-role labels are synthetic and are not real users, "
            "self-reports, observed career outcomes, or representative population samples.",
            "Synthetic target occupations are evaluation labels only and are stored "
            "separately from the KW UserProfile contract.",
            "ESCO occupation-skill relationships are classification data, not job "
            "vacancy, employer demand, or hiring evidence.",
        ],
        "files": {
            profiles_path.name: {"sha256": sha256(profiles_path)},
            targets_path.name: {"sha256": sha256(targets_path)},
        },
    }
    manifest_path = output_dir / "kw_profile_dataset_v1.manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--count", type=int, default=25_000)
    parser.add_argument("--seed", type=int, default=20261022)
    parser.add_argument(
        "--kw-data-dir",
        type=Path,
        help="Path to KW's data/csv directory. Defaults to reading from the Git ref.",
    )
    parser.add_argument(
        "--kw-git-ref",
        default="origin/KW",
        help="Git ref containing KW's data/csv files (default: origin/KW).",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=ROOT / "data" / "synthetic",
    )
    args = parser.parse_args()
    manifest = create_dataset(
        output_dir=args.output_dir,
        count=args.count,
        seed=args.seed,
        kw_data_dir=args.kw_data_dir,
        kw_git_ref=args.kw_git_ref,
    )
    print(
        f"Generated {manifest['profile_count']} synthetic profiles in "
        f"{args.output_dir.resolve()}"
    )
    print(f"Manifest: {(args.output_dir / 'kw_profile_dataset_v1.manifest.json').resolve()}")


if __name__ == "__main__":
    main()

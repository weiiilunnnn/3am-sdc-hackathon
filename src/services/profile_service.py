"""Profile normalisation and SQLite persistence."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from src.data.sample_profiles import get_sample_profiles
from src.data.skills_taxonomy import find_skill_by_id, find_skill_by_label, taxonomy_metadata
from src.models.profiles import NormalizedSkill, ProfileInput, ProfileRecord
from src.services.storage import connection, initialize_database

_PROFICIENCY_RANK = {"unknown": -1, "beginner": 0, "intermediate": 1, "advanced": 2}


class UnknownSkillIdError(ValueError):
    """Raised when a submitted taxonomy identifier is not in the supported snapshot."""


class ProfileConflictError(ValueError):
    """A newer profile must be loaded before saving again."""


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")


def _key(value: str) -> str:
    return " ".join(value.casefold().split())


def normalize_skills(skills: list[Any]) -> list[NormalizedSkill]:
    """Resolve known aliases, preserve unknown input, and merge duplicates."""
    normalized: dict[str, dict[str, Any]] = {}

    for skill in skills:
        raw_name = skill.name.strip()
        if skill.skill_id:
            taxonomy_entry = find_skill_by_id(skill.skill_id)
            if taxonomy_entry is None:
                raise UnknownSkillIdError(f"Unsupported skill identifier: {skill.skill_id}")
        elif skill.force_custom:
            taxonomy_entry = None
        else:
            taxonomy_entry = find_skill_by_label(raw_name)

        if taxonomy_entry:
            skill_id = taxonomy_entry["id"]
            display_name = taxonomy_entry["name"]
            taxonomy_source = taxonomy_entry["taxonomy_source"]
            is_custom = False
            dedupe_key = f"id:{skill_id}"
        else:
            skill_id = None
            display_name = raw_name
            taxonomy_source = "Custom"
            is_custom = True
            dedupe_key = f"custom:{_key(raw_name)}"

        previous = normalized.get(dedupe_key)
        if previous is None:
            normalized[dedupe_key] = {
                "skill_id": skill_id,
                "display_name": display_name,
                "input_names": [raw_name],
                "proficiency": skill.proficiency,
                "taxonomy_source": taxonomy_source,
                "is_custom": is_custom,
                "evidence_record_ids": list(dict.fromkeys(skill.evidence_record_ids)),
            }
            continue

        if raw_name not in previous["input_names"]:
            previous["input_names"].append(raw_name)
        if _PROFICIENCY_RANK[skill.proficiency] > _PROFICIENCY_RANK[previous["proficiency"]]:
            previous["proficiency"] = skill.proficiency
        previous["evidence_record_ids"] = list(
            dict.fromkeys(previous["evidence_record_ids"] + skill.evidence_record_ids)
        )

    return [NormalizedSkill.model_validate(item) for item in normalized.values()]


def _record_from_row(row: Any) -> ProfileRecord:
    payload = json.loads(row["payload"])
    payload.update(id=row["id"], created_at=row["created_at"], updated_at=row["updated_at"])
    return ProfileRecord.model_validate(payload)


def create_profile(profile: ProfileInput, creation_key: str | None = None) -> ProfileRecord:
    initialize_database()
    normalized = normalize_skills(profile.skills)
    now = utc_now()
    profile_id = uuid.uuid5(uuid.NAMESPACE_URL, f"hybrid-profile:{creation_key}").hex if creation_key else uuid.uuid4().hex
    payload = profile.model_dump(mode="json")
    payload["skills"] = [skill.model_dump(mode="json") for skill in normalized]

    with connection() as db:
        db.execute(
            "INSERT OR IGNORE INTO profiles (id, payload, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (profile_id, json.dumps(payload, ensure_ascii=False), now, now),
        )
        row = db.execute("SELECT * FROM profiles WHERE id = ?", (profile_id,)).fetchone()
    # A retried creation recovers the original row; it never overwrites it.
    return _record_from_row(row)


def get_profile(profile_id: str) -> ProfileRecord | None:
    initialize_database()
    with connection() as db:
        row = db.execute("SELECT * FROM profiles WHERE id = ?", (profile_id,)).fetchone()
    return _record_from_row(row) if row else None


def update_profile(profile_id: str, profile: ProfileInput, expected_updated_at: str | None = None) -> ProfileRecord | None:
    initialize_database()
    normalized = normalize_skills(profile.skills)
    with connection() as db:
        existing = db.execute("SELECT created_at, updated_at, payload FROM profiles WHERE id = ?", (profile_id,)).fetchone()
        if not existing:
            return None
        if expected_updated_at is not None and existing["updated_at"] != expected_updated_at:
            raise ProfileConflictError("Profile changed elsewhere. Reload it before saving again.")
        old_skills = json.loads(existing["payload"])["skills"]
        for skill in normalized:
            previous = next((s for s in old_skills if
                (skill.skill_id is not None and s["skill_id"] == skill.skill_id) or
                (skill.skill_id is None and s["skill_id"] is None and _key(s["display_name"]) == _key(skill.display_name))), None)
            if previous:
                skill.input_names = list(dict.fromkeys([*previous["input_names"], *skill.input_names]))
        now = utc_now()
        payload = profile.model_dump(mode="json")
        payload["skills"] = [skill.model_dump(mode="json") for skill in normalized]
        changed = db.execute(
            "UPDATE profiles SET payload = ?, updated_at = ? WHERE id = ? AND updated_at = ?",
            (json.dumps(payload, ensure_ascii=False), now, profile_id, existing["updated_at"]),
        )
        if changed.rowcount != 1:
            raise ProfileConflictError("Profile changed elsewhere. Reload it before saving again.")
        created_at = existing["created_at"]
    return ProfileRecord.model_validate(
        {**payload, "id": profile_id, "created_at": created_at, "updated_at": now}
    )


def list_sample_profiles() -> list[dict[str, Any]]:
    samples = get_sample_profiles()
    for sample in samples:
        sample["taxonomy"] = taxonomy_metadata()
    return samples

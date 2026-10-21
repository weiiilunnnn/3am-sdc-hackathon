"""Replaceable profile normalisation for the React form / teammate intake."""
import hashlib
import json

from .models import OccupationCatalog, ProfileSkill, UserProfile


def profile_fingerprint(profile: UserProfile) -> str:
    payload = profile.model_dump(mode="json")
    payload["skills"] = sorted(payload["skills"], key=lambda s: s["skill_id"])
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()[:20]


def normalize_profile(profile: UserProfile, catalog: OccupationCatalog, *, definitions=None, alias_map=None) -> UserProfile:
    definitions = definitions if definitions is not None else {s.skill_id: s for s in catalog.skills}
    aliases = alias_map
    if aliases is None:
        aliases = {}
        for skill in catalog.skills:
            for label in [skill.name, *skill.aliases]:
                aliases.setdefault(' '.join(label.casefold().split()), set()).add(skill.skill_id)
    normalized, unresolved = {}, list(profile.unresolved_skills)
    for skill in profile.skills:
        sid = skill.skill_id
        if sid not in definitions:
            candidates = aliases.get(' '.join(sid.casefold().split()), set())
            if len(candidates) != 1:
                unresolved.append(skill.name)
                continue
            sid = next(iter(candidates))
        canonical = definitions[sid]
        if sid not in normalized:
            normalized[sid] = ProfileSkill(skill_id=sid, name=canonical.name, proficiency=skill.proficiency)
    return profile.model_copy(update={"skills": list(normalized.values()), "unresolved_skills": sorted(set(unresolved))})

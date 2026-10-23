"""ESCO-owned evidence and one optional, cached GLM interpretation per bundle."""
from collections import OrderedDict
import hashlib
import json
import os
import re
import threading
import time

from pydantic import BaseModel, ConfigDict, Field
from src.models.career_analysis import (AnalysisEvidence, CapabilityGroup, CareerAnalysis,
    GapInterpretation, SkillBridge)
from .data_repository import supported
from .profile_relevance import development_areas
from .pathway_llm import invoke

PROMPT_VERSION = "career-details-esco-v1"
_cache = OrderedDict()
_pending = {}
_lock = threading.Lock()


class StrictOutput(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class GeneratedGap(StrictOutput):
    group_id: str
    why_relevant: str = Field(min_length=10, max_length=260)
    evidence_ids: list[str] = Field(min_length=1, max_length=6)
    evidence_quote: str = Field(min_length=12, max_length=300)


class GeneratedBridge(StrictOutput):
    matched_skill_ids: list[str] = Field(min_length=1, max_length=3)
    target_group_id: str
    explanation: str = Field(min_length=10, max_length=300)
    evidence_ids: list[str] = Field(min_length=2, max_length=8)
    evidence_quote: str = Field(min_length=12, max_length=300)


class GeneratedAnalysis(StrictOutput):
    role_id: str
    groups: list[GeneratedGap] = Field(max_length=5)
    bridges: list[GeneratedBridge] = Field(max_length=3)


def prepare_analysis(request, index):
    role = index.roles.get(request.role_id)
    if role is None:
        raise KeyError("Occupation not present in the pinned index")
    have = set(request.recognised_skill_ids)
    if not have <= index.skills.keys():
        raise ValueError("Only recognised canonical ESCO skill IDs are accepted")
    areas, warning = development_areas(role, have, index, limit=None, include_optional=True)
    edges = index.edges[role.role_id]
    groups = [CapabilityGroup(group_id="G"+hashlib.sha256(f"{a.mapping_method}:{a.area_id}".encode()).hexdigest()[:16],
        concept_uri=a.area_id, title=a.title, count=len(a.supporting_concept_ids),
        mapping_method=a.mapping_method, concepts=[edges[sid] for sid in a.supporting_concept_ids],
        explanation=f"{len(a.supporting_concept_ids)} distinct occupation requirements are not evidenced by this profile; competence has not been assessed.") for a in areas]
    matched = sorted((r for sid, r in edges.items() if sid in have),
        key=lambda r: (r.requirement != "essential", r.name.casefold(), r.skill_id))
    evidence, group_evidence, matched_evidence = [], {}, {}

    def add(title, text, uri):
        eid = f"E{len(evidence)+1}"
        evidence.append(AnalysisEvidence(evidence_id=eid, title=title, text=text, url=uri))
        return eid

    add(role.title, role.description[:1200], role.role_id)
    for group in groups[:5]:
        group_evidence[group.group_id] = [add(r.name,
            f"ESCO occupation {role.title}: {r.name} is a documented {r.requirement} requirement.", r.skill_id)
            for r in group.concepts[:6]]
    for r in matched[:20]:
        matched_evidence[r.skill_id] = add(r.name,
            f"Recognised profile concept {r.name}; documented {r.requirement} requirement for {role.title}. Self-reported, proficiency not assessed.", r.skill_id)
    payload = {"prompt_version": PROMPT_VERSION,
        "occupation": {"role_id": role.role_id, "title": role.title, "description": role.description[:1200]},
        "groups": [{"group_id": g.group_id, "concept_uri": g.concept_uri, "title": g.title,
            "concepts": [r.model_dump(include={"skill_id", "name", "requirement"}) for r in g.concepts[:6]],
            "evidence_ids": group_evidence[g.group_id]} for g in groups[:5]],
        "matched": [r.model_dump(include={"skill_id", "name", "requirement"}) for r in matched[:20]],
        "matched_evidence": matched_evidence, "evidence": [e.model_dump() for e in evidence]}
    fingerprint = {"payload": payload, "recognised_ids": sorted(have), "version": index.catalog.dataset_version,
        "index": index.fingerprint, "all_groups": [(g.group_id, [r.skill_id for r in g.concepts]) for g in groups]}
    key = hashlib.sha256(json.dumps(fingerprint, sort_keys=True).encode()).hexdigest()
    result = CareerAnalysis(role_id=role.role_id, evidence_key=key, groups=groups, matched=matched,
        not_evidenced_count=sum(g.count for g in groups), grouping_warning=warning,
        message="AI analysis not requested. ESCO evidence remains available.", evidence=evidence)
    verified = supported(role.source_ids, index.sources, "occupation", synthetic=index.catalog.is_synthetic, native_id=role.role_id) and all(
        supported(r.source_ids, index.sources, "role_skill_relationships", synthetic=index.catalog.is_synthetic, native_id=role.role_id) for r in edges.values())
    return result, payload, group_evidence, matched_evidence, verified


def _safe_interpretation(text, max_words):
    # All model prose is explicitly conditional inference, never a new factual source.
    if (len(text.split()) > max_words or not re.search(r"\b(may|could)\b", text, re.I)
            or re.search(r"https?://|www\.|[<>\d%]|\b(course|certification|certificate|salary|confidence|guarantee|proficient|proficiency|mastered|readiness)\b|\b(?:high|medium|low)\s+(?:impact|priority)\b", text, re.I)):
        raise ValueError("Unsupported interpretation text")


def validate_analysis(raw, result, payload, group_evidence, matched_evidence):
    generated = GeneratedAnalysis.model_validate(raw)
    if generated.role_id != result.role_id:
        raise ValueError("Unknown role")
    known = {e.evidence_id: e for e in result.evidence}
    allowed_groups = {g["group_id"] for g in payload["groups"]}
    seen, interpretations, bridges = set(), [], []

    def check_quote(ids, quote):
        if len(ids) != len(set(ids)) or not set(ids) <= known.keys() or not any(quote in known[eid].text for eid in ids):
            raise ValueError("Ungrounded evidence reference")

    for item in generated.groups:
        if item.group_id not in allowed_groups or item.group_id in seen or not set(item.evidence_ids) <= set(group_evidence[item.group_id]):
            raise ValueError("Unknown or duplicate group/evidence")
        check_quote(item.evidence_ids, item.evidence_quote)
        _safe_interpretation(item.why_relevant, 40)
        seen.add(item.group_id)
        interpretations.append(GapInterpretation(group_id=item.group_id, why_relevant=item.why_relevant, evidence_ids=item.evidence_ids))
    bridge_keys = set()
    for item in generated.bridges:
        skills = set(item.matched_skill_ids)
        if item.target_group_id not in allowed_groups or len(skills) != len(item.matched_skill_ids) or not skills <= matched_evidence.keys():
            raise ValueError("Unknown bridge skill/group")
        source_ids = {matched_evidence[sid] for sid in skills}
        target_ids = set(group_evidence[item.target_group_id])
        ids = set(item.evidence_ids)
        if not source_ids <= ids or not ids & target_ids or not ids <= source_ids | target_ids:
            raise ValueError("Bridge evidence membership mismatch")
        check_quote(item.evidence_ids, item.evidence_quote)
        _safe_interpretation(item.explanation, 45)
        bridge_key = (tuple(sorted(skills)), item.target_group_id)
        if bridge_key in bridge_keys:
            raise ValueError("Duplicate bridge")
        bridge_keys.add(bridge_key)
        bridges.append(SkillBridge(matched_skill_ids=item.matched_skill_ids, target_group_id=item.target_group_id,
            explanation=item.explanation, evidence_ids=item.evidence_ids))
    complete = seen == allowed_groups
    result = result.model_copy(update={"interpretations": interpretations, "bridges": bridges,
        "status": "ready" if complete else "partial" if interpretations or bridges else "unavailable",
        "message": "AI interpretations are conditional suggestions, not official ESCO mappings."
            if interpretations or bridges else "No supported AI interpretations available. ESCO evidence remains usable."})
    return result


def analyse_career(request, index):
    result, payload, group_evidence, matched_evidence, verified = prepare_analysis(request, index)
    if not request.generate_ai:
        return result
    if not result.groups:
        return result.model_copy(update={"message": "No occupation requirements are unevidenced by the recognised profile. This does not establish job readiness."})
    if not verified or not os.getenv("RUNPOD_API_KEY"):
        return result.model_copy(update={"message": "AI analysis unavailable. Deterministic ESCO groups and skill evidence remain available."})
    key = result.evidence_key
    with _lock:
        old = _cache.get(key)
        if old and old[0] > time.monotonic():
            return old[1].model_copy(deep=True, update={"used_cache": True})
        event = _pending.get(key)
        if event is None and len(_pending) < 16:
            event = _pending[key] = threading.Event()
            leader = True
        else:
            leader = False
    if not leader:
        if event:
            event.wait(9)
        with _lock:
            old = _cache.get(key)
            if old and old[0] > time.monotonic():
                return old[1].model_copy(deep=True, update={"used_cache": True})
        return result.model_copy(update={"message": "AI analysis is busy; ESCO evidence remains available."})
    try:
        try:
            raw = invoke(payload,
                "Return JSON role_id, groups, bridges only. For each supplied group return group_id, why_relevant "
                "(one conditional sentence, under forty words, containing may or could), evidence_ids, evidence_quote "
                "(verbatim excerpt from one referenced evidence text). Do not invent labels, groups, tasks or facts. "
                "For bridges return at most three entries: matched_skill_ids (only supplied matched concepts), target_group_id, "
                "explanation (one conditional learning connection under forty-five words containing may or could), evidence_ids, evidence_quote. "
                "Each bridge must cite evidence for every source skill and at least one target concept. "
                "Decline unsupported links with an empty bridges list. No URLs in prose, scores, numbers, proficiency, "
                "courses, credentials, workplace facts or impact tiers. These are AI inferences, not official skill relations.",
                timeout=8, max_tokens=1500)
            result = validate_analysis(raw, result, payload, group_evidence, matched_evidence)
        except Exception:
            # Never expose raw model/provider bodies, prompts or authentication errors.
            result = result.model_copy(update={"message": "AI analysis unavailable or could not be grounded. ESCO evidence remains available."})
        with _lock:
            _cache[key] = (time.monotonic()+(21600 if result.status != "unavailable" else 60), result.model_copy(deep=True))
            while len(_cache) > 64:
                _cache.popitem(last=False)
        return result
    finally:
        with _lock:
            _pending.pop(key, None)
            event.set()

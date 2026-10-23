"""Opt-in, budget-limited RunPod explanations for WL2 session AI skill connections.

The source evidence is loaded server-side; browsers cannot submit invented source quotes.
No profile PII or generated session explanation is persisted by this service.
"""
from __future__ import annotations

import re
from pydantic import BaseModel, ConfigDict, Field
from src.services.session_signal_adapter import SessionSignalProfile, _resolved_skill
from src.services.skill_connections import get_saved_skill_connections
from src.services.connection_model import _run, enabled


class SessionExplanationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    profile: SessionSignalProfile
    connection_id: str = Field(min_length=10, max_length=80)


class SignalExplanationError(ValueError):
    pass


def generate_session_explanation(request: SessionExplanationRequest) -> dict:
    """Call WL2's existing RunPod client through SH's bounded _run wrapper.

    Network requests happen only when the user explicitly presses Generate.
    The shared SQLite budget is the only persisted effect of this request.
    """
    if not enabled():
        return {"status": "disabled"}
    known_ids = {resolved["id"] for skill in request.profile.skills
                 if (resolved := _resolved_skill(skill))["id"]}
    version, stored = get_saved_skill_connections()
    match = next((item for item in stored if item["id"] == request.connection_id and
                  item.get("basis") == "same_task_passage" and
                  item.get("current_skill_id") in known_ids), None)
    if not match:
        raise SignalExplanationError("Connection does not match a supported skill in this session.")
    # Only a selected skill, optional occupation context and original job quotes go
    # to RunPod; NEVER the full profile, email, names, photographs or CV details.
    citations = []
    for entry in match.get("evidence", [])[:2]:
        quote = str(entry.get("ai_quote") or entry.get("source_quote") or "")[:390]
        if quote:
            citations.append({"id": str(entry.get("id", ""))[:120], "quote": quote})
    if not citations:
        raise SignalExplanationError("There are no source passages to explain.")
    facts = {
        "skill": match["current_skill_name"],
        "ai_capability": match["ai_skill"]["name"],
        "occupation": request.profile.occupation[:100] or request.profile.field_of_study[:100],
        "evidence_version": version,
        "source_passages": citations,
    }
    instruction = (
        "Explain a *possible* AI skill connection using only the supplied facts and quoted job passages. "
        "Never claim these prove replacement, skill transfer, labour-market growth or guaranteed employability. "
        "Return ONLY a JSON object with explanation, learning_gap, next_step and evidence_ids. "
        "Each of the first three must be a concise plain-text string, not an essay or markdown; "
        "evidence_ids must be an array of one or two IDs exactly as provided, with no invented sources. "
        "If the passages do not show a causal relationship, say it is a possible use case and not a proven transition."
    )
    status, output = _run(facts, instruction)
    if status != "generated" or not isinstance(output, dict):
        return {"status": status if status != "generated" else "invalid_output"}
    try:
        lengths = {"explanation": 420, "learning_gap": 320, "next_step": 220}
        texts = {}
        for key, maximum in lengths.items():
            value = output.get(key)
            if not isinstance(value, str) or not value.strip() or len(value) > maximum:
                raise ValueError("missing or oversized generated wording")
            if re.search(r"\b(?:guaranteed|will replace|definitely|proves?|100% certain)\b", value, re.I):
                raise ValueError("overconfident generated wording")
            texts[key] = value.strip()
        ids = output.get("evidence_ids")
        accepted = {citation["id"] for citation in citations}
        if not isinstance(ids, list) or not ids or len(ids) > 2 or not all(isinstance(x, str) and x in accepted for x in ids):
            raise ValueError("invalid evidence attribution")
    except ValueError:
        return {"status": "rejected"}
    return {"status": "generated", **texts, "evidence_ids": ids, "origin": "RunPod GLM"}

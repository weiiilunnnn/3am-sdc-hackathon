"""Evidence-first radar cards; language-model text is optional presentation only."""

from __future__ import annotations

import json
import os
import re

from src.data.skills_taxonomy import find_skill_by_label
from src.services.employment_service import get_employment_dashboard
from src.services.profile_service import get_profile
from src.services.sources.runpod_api import RunPodRequestError, run_sync, unwrap_llm_output
from src.services.trend_service import SKILL_TOPIC_MAP, get_dashboard

PRACTICES = {
    "llms": "Test an LLM on a task you know well; record where its answers fail and how you checked them.",
    "ai_agents": "Build a small tool-using workflow and document its permissions, failure cases, and human checks.",
    "rag": "Prototype retrieval over a small trusted document set and evaluate whether answers cite the right passages.",
    "computer_vision": "Try a small image-classification or detection task and measure errors across different examples.",
    "responsible_ai": "Write an evaluation checklist for accuracy, privacy, bias, and human review on one AI use case.",
}


def get_brief(profile_id: str | None = None) -> dict | None:
    profile = get_profile(profile_id) if profile_id else None
    if profile_id and profile is None:
        return None
    research = get_dashboard()
    employment = get_employment_dashboard()
    profile_skills = {skill.skill_id: skill.display_name for skill in profile.skills if skill.skill_id} if profile else {}
    development_skills = {}
    if profile:
        for requested in profile.skills_to_develop:
            match = find_skill_by_label(requested)
            if match:
                development_skills[match["id"]] = requested
    cards = []
    for topic in research.topics:
        latest = topic.observations[-1] if topic.observations else None
        change = topic.change
        direction = "insufficient_data"
        if change.status == "available" and change.absolute_change is not None:
            direction = "more_research_records" if change.absolute_change > 0 else "fewer_research_records" if change.absolute_change < 0 else "unchanged_research_records"
        matched = [name for skill_id, name in profile_skills.items() if topic.topic_id in SKILL_TOPIC_MAP.get(skill_id, {})]
        to_develop = [name for skill_id, name in development_skills.items() if topic.topic_id in SKILL_TOPIC_MAP.get(skill_id, {})]
        cards.append({
            "topic_id": topic.topic_id,
            "label": topic.label,
            "definition": topic.definition,
            "direction": direction,
            "research_count": latest.value if latest else None,
            "research_year": latest.period_year if latest else None,
            "previous_count": topic.observations[-2].value if len(topic.observations) >= 2 else None,
            "previous_year": topic.observations[-2].period_year if len(topic.observations) >= 2 else None,
            "research_change_percent": change.percentage_change if change.status == "available" else None,
            "research_source_url": topic.source_url,
            "research_retrieved_at": latest.retrieved_at if latest else None,
            "posting_mentions": employment.topic_counts.get(topic.topic_id, 0),
            "posting_denominator": employment.posting_count,
            "posting_source_url": employment.source["url"],
            "posting_retrieved_at": employment.last_successful_refresh,
            "matched_profile_skills": matched,
            "development_profile_skills": to_develop,
            "practice": PRACTICES[topic.topic_id],
        })
    cards.sort(key=lambda card: (not bool(card["matched_profile_skills"] or card["development_profile_skills"]), card["label"]))
    return {
        "profile_id": profile_id,
        "profile_context": {
            "current_occupation": profile.current_occupation,
            "career_aspirations": profile.career_aspirations,
            "skills_to_develop": profile.skills_to_develop,
            "synthetic_demo": profile.synthetic_demo,
        } if profile else None,
        "cards": cards,
        "research_refreshed_at": research.last_successful_refresh,
        "posting_refreshed_at": employment.last_successful_refresh,
        "method": "Research direction compares adjacent complete-year OpenAlex quoted-search counts; provider stemming, keyword matches and changing index coverage can affect those counts. Posting mentions come from one bounded Remote OK feed snapshot. Profile links use explicit local skill-to-topic rules. These are separate signals; no combined demand or future-readiness score is computed.",
    }


def explain_brief(profile_id: str | None = None) -> dict | None:
    brief = get_brief(profile_id)
    if brief is None:
        return None
    if not os.getenv("RUNPOD_API_KEY") or os.getenv("RUNPOD_API_KEY") == "your-runpod-api-key":
        return {"available": False, "reason": "RunPod language-model credentials are not configured.", "summary": None, "model": None}
    cards = [card for card in brief["cards"] if (card["matched_profile_skills"] or card["development_profile_skills"]) and card["research_count"] is not None][:3]
    if not cards:
        return {"available": False, "reason": "A saved profile with mapped skills and cached research data is needed first.", "summary": None, "model": None}
    facts = [{
        "topic": card["label"], "known_skills": card["matched_profile_skills"],
        "skills_to_develop": card["development_profile_skills"],
        "research_direction": card["direction"], "practice": card["practice"],
    } for card in cards]
    payload = {
        "input": {
            "model": "glm-5.3",
            "messages": [
                {"role": "system", "content": (
                    "Write one concise, plain-language sentence explaining why the learner could investigate the supplied topics and practices. "
                    "Use only supplied topic and skill names. Do not make claims about hiring, future demand, salary, employability or guarantees. "
                    "Do not include numbers, dates, statistics or source names. Return JSON only: {\"summary\": \"...\"}."
                )},
                {"role": "user", "content": json.dumps(facts, ensure_ascii=False)},
            ],
            "temperature": 0.1,
            "max_tokens": 140,
            "response_format": {"type": "json_object"},
        }
    }
    try:
        result = run_sync(os.getenv("RUNPOD_LLM_ENDPOINT_ID", "b1dd8hy2hqo1nb"), payload, timeout=60)
        output = unwrap_llm_output(result)
        generated = json.loads(output["choices"][0]["message"]["content"])
        summary = generated["summary"]
        if not isinstance(summary, str) or not 12 <= len(summary) <= 300 or re.search(r"\d|\b(hiring|salary|demand|guarantee|forecast|vacanc(?:y|ies))\b", summary, re.I):
            raise RunPodRequestError("Generated text did not pass the grounded-output check.")
        return {"available": True, "reason": None, "summary": summary, "model": "RunPod GLM-5.3"}
    except (RunPodRequestError, KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError):
        return {"available": False, "reason": "The optional explanation is unavailable. The evidence cards remain usable.", "summary": None, "model": None}

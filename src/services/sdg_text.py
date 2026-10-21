"""Cached, target-grounded SDG text generation through RunPod GLM."""

from __future__ import annotations

import json
import os
from functools import lru_cache
from typing import Any

from src.services.sources.runpod_api import RunPodRequestError, run_sync, unwrap_llm_output

LLM_ENDPOINT_ID = "b1dd8hy2hqo1nb"


def _generate(payload_key: str, *, kind: str) -> dict[str, Any]:
    payload = json.loads(payload_key)
    endpoint_id = os.getenv("RUNPOD_LLM_ENDPOINT_ID", LLM_ENDPOINT_ID)
    is_overview = kind == "overview"
    targets = payload.get("targets", [])
    prompt_payload = payload
    if is_overview:
        targets = [target for target in targets if target["code"].startswith(f"{payload['sdg_number']}.")]
        if not targets:
            raise ValueError("No target definitions were supplied for the selected SDG.")
        prompt_payload = {**payload, "targets": targets}
        instructions = (
            "Return JSON only with main_contribution (string) and target_previews (object mapping every supplied target code to a short string). "
            "Keep the main contribution under 45 words and each preview under 30 words."
        )
        max_tokens = 450
    else:
        target_code = payload["target_code"]
        instructions = (
            "Return JSON only with role_contribution (string) and skill_links (array of objects with skill and explanation strings). "
            "Include exactly one explanation for every supplied skill."
        )
        max_tokens = 500

    system_prompt = (
        "Write concise, grounded career-to-SDG explanations. Treat supplied SDG target names and definitions as fixed facts. "
        "Do not invent official wording, statistics, outcomes, employers, projects, or training providers. Describe only plausible conditional links, use may/could, and state that this is not a guaranteed outcome. "
        "Use each skill's goals list as the mapping: only a skill tagged with the selected target code may be called directly linked; otherwise state that no direct mapping is provided. "
        "For an overview, if no supplied skill is tagged to a target, say there is no direct skill mapping. "
        f"{instructions} No markdown."
    )
    request_payload = {
        "input": {
            "model": "glm-5.3",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(prompt_payload, ensure_ascii=False)},
            ],
            "temperature": 0.2,
            "max_tokens": max_tokens,
            "response_format": {"type": "json_object"},
        }
    }
    result = run_sync(endpoint_id, request_payload, timeout=60)
    output = unwrap_llm_output(result)
    try:
        generated = json.loads(output["choices"][0]["message"]["content"])
        if is_overview:
            previews = generated["target_previews"]
            valid_codes = {target["code"] for target in targets}
            normalized = [
                {"code": code, "explanation": text}
                for code, text in previews.items()
                if code in valid_codes and isinstance(text, str)
            ] if isinstance(previews, dict) else []
            if not isinstance(generated["main_contribution"], str) or {item["code"] for item in normalized} != valid_codes:
                raise ValueError("Generated overview omitted a supplied target.")
            return {
                "sdg_number": payload["sdg_number"],
                "main_contribution": generated["main_contribution"],
                "target_previews": normalized,
                "model": "RunPod GLM-5.3",
            }

        role_contribution = generated["role_contribution"]
        skill_links = generated["skill_links"]
        valid_skills = {skill["name"] for skill in payload["skills"]}
        normalized_links = [
            {"skill": item["skill"], "explanation": item["explanation"]}
            for item in skill_links
            if isinstance(item, dict)
            and item.get("skill") in valid_skills
            and isinstance(item.get("explanation"), str)
        ]
        if not isinstance(role_contribution, str) or {item["skill"] for item in normalized_links} != valid_skills:
            raise ValueError("Generated explanation omitted a supplied skill.")
        return {"role_contribution": role_contribution, "skill_links": normalized_links, "model": "RunPod GLM-5.3"}
    except (KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise RunPodRequestError("RunPod returned an invalid SDG explanation.") from exc


@lru_cache(maxsize=128)
def generate_sdg_overview(payload_key: str) -> dict[str, Any]:
    return _generate(payload_key, kind="overview")


@lru_cache(maxsize=128)
def generate_sdg_explanation(payload_key: str) -> dict[str, Any]:
    return _generate(payload_key, kind="explanation")

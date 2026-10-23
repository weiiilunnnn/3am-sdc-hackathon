"""Optional credential discovery; separate from learning coverage, timing and scoring."""
from collections import OrderedDict
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import threading
import time
from urllib.parse import urlsplit

from src.models.future_roles import CredentialRecommendation, Money
from src.services.sources import tavily_api
from . import pathway_llm
from .resource_verification import provider_url, clean, PROVIDERS

CATALOGUE = Path(__file__).resolve().parents[2] / "data/credentials/catalogue.json"
_cache = OrderedDict()
_lock = threading.Lock()


def mappings(text, skills):
    """Literal ESCO labels/aliases only; never infer readiness or proficiency."""
    folded = " ".join(text.casefold().split())
    result = {}
    for sid, skill in skills.items():
        for label in [skill.name, *skill.aliases]:
            label = " ".join(label.casefold().split())
            if len(label) < 4:
                continue
            found = re.search(r"(?<!\w)" + re.escape(label) + r"(?!\w)", folded)
            if found:
                quote = folded[max(0, found.start()-80):found.end()+100]
                if not re.search(r"\b(not|never|excluding|excludes)\b", quote):
                    result[sid] = quote
                    break
    return result


def verify_credential(hit, page, skills):
    url = provider_url(hit["url"])
    if provider_url(page["url"]) != url:
        raise ValueError("Extraction identity mismatch")
    text = clean(page.get("raw_content", ""))
    heading = re.search(r"(?m)^#\s+([^\n]{3,200})", text)
    if not heading or len(text) < 100 or re.search(r"page not found|access denied|retired|no longer available", text, re.I):
        raise ValueError("Unavailable credential")
    title = heading[1].strip()
    if not re.search(r"certification|certificate|assessment|applied skills", title, re.I) or re.search(r"exam prep|practice test|study guide", title, re.I):
        raise ValueError("Not a credential detail page")
    words = set(re.findall(r"\w+", title.lower()))
    if len(words & set(re.findall(r"\w+", str(hit.get("title", "")).lower()))) / len(words) < .6:
        raise ValueError("Title mismatch")
    body = text[heading.end():]
    # Require an explicit credential outcome, not an exam-preparation article.
    outcome = re.search(r"[^\n.]{0,100}\b(?:earn|awarded|receive|obtain)\b[^\n.]{0,100}\b(?:certification|certificate|credential)\b[^\n.]{0,80}", body, re.I)
    assessment = re.search(r"[^\n.]{0,70}\b(?:exam|assessment|assessed|graded projects)\b[^\n.]{0,150}", body, re.I)
    if not outcome or not assessment or re.search(r"\b(?:not|never|cannot|can't|no)\b", outcome[0], re.I):
        raise ValueError("Credential outcome/assessment unconfirmed")
    mapping = mappings(body, skills)
    if not mapping:
        raise ValueError("No ESCO requirement overlap")
    kind = "certification_exam" if re.search(r"\bexam\b", assessment[0], re.I) else "assessed_course_certificate"
    if "applied skills" in title.lower():
        kind = "skill_assessment"
    evidence = {"credential": outcome[0].strip(), "assessment": assessment[0].strip(),
                **{f"skill:{sid}": quote for sid, quote in mapping.items()}}
    fees = {}
    for field, term in [("exam_fee", "(?:exam|assessment)"), ("certificate_fee", "(?:certificate|certification|credential)")]:
        claim = re.search(rf"\b{term}\s+(?:fee|price|cost)\s*:\s*(USD|MYR|EUR|GBP)\s*(\d+(?:\.\d{{1,2}})?)\b", body, re.I)
        if claim:
            fees[field] = Money(currency=claim[1].upper(), amount=float(claim[2]))
            evidence[field] = claim[0]
    free = re.search(r"\b(?:exam and certificate are free|free (?:verified )?certification|assessment and credential are free)\b", body, re.I)
    if re.search(r"\b(?:fee required|paid certificate|subscription required|free trial)\b", body, re.I):
        free = None
    if free and not any(f.amount > 0 for f in fees.values()):
        evidence["fees"] = free[0]
    else:
        free = None
    prereq = re.search(r"(?im)^prerequisites?\s*:\s*([^\n]{1,240})", body)
    if prereq:
        evidence["prerequisites"] = prereq[0]
    return CredentialRecommendation(credential_id="credential-"+hashlib.sha256(url.encode()).hexdigest()[:16],
        title=title, provider=urlsplit(url).hostname, url=url, credential_type=kind,
        skill_ids=sorted(mapping), assessment_format=assessment[0].strip(),
        prerequisites=prereq[1] if prereq else None, fees_verified_free=bool(free), **fees,
        origin="web_discovered", checked_at=datetime.now(timezone.utc), evidence=evidence, source_urls=[url])


def affordable(item, budget):
    if item.fees_verified_free:
        return True
    if budget is None:
        return True  # Unknown costs are explicitly displayed, never described as free.
    fees = [item.exam_fee, item.certificate_fee]
    return all(f is not None and f.currency == budget.currency for f in fees) and sum(f.amount for f in fees) <= budget.amount


def local_credentials(skills, budget):
    items = []
    for record in json.loads(CATALOGUE.read_text(encoding="utf-8")):
        item = CredentialRecommendation.model_validate(record)
        mapping = mappings(item.title + " " + item.evidence.get("curriculum", ""), skills)
        if mapping and (datetime.now(timezone.utc)-item.checked_at).days <= 180 and affordable(item, budget):
            items.append(item.model_copy(update={"skill_ids": sorted(mapping)}))
    return items


def recommend_credentials(profile, match, index, *, deadline=None):
    # Both existing strengths and missing requirements matter for future assessment.
    requirements = [*match.missing_skills, *match.matched_skills]
    skills = {r.skill_id: index.skills[r.skill_id] for r in requirements if r.skill_id in index.skills}
    payload = {"occupation": match.role_title, "skills": [{"skill_id": sid, "name": s.name} for sid, s in sorted(skills.items())]}
    key = hashlib.sha256(json.dumps([payload, profile.learning_preferences.budget.model_dump() if profile.learning_preferences.budget else None,
        bool(os.getenv("TAVILY_API_KEY")), bool(os.getenv("RUNPOD_API_KEY")), os.getenv("FEATURE4_DYNAMIC_DISCOVERY_ENABLED", "true")], sort_keys=True).encode()).hexdigest()
    # Bound queueing as well as network time; busy callers retain local fallback.
    if not _lock.acquire(timeout=.1):
        return local_credentials(skills, profile.learning_preferences.budget), {"busy": 1, "searches": 0, "extracts": 0, "runpod_calls": 0}, False
    try:
        old = _cache.get(key)
        if old and old[0] > time.monotonic():
            items, metrics = old[1], {**old[2], "searches": 0, "extracts": 0, "runpod_calls": 0}
            return [i.model_copy(deep=True) for i in items], metrics, True
        metrics = {"searches": 0, "extracts": 0, "runpod_calls": 0, "rejected": 0}
        items = local_credentials(skills, profile.learning_preferences.budget)
        if skills and os.getenv("TAVILY_API_KEY") and os.getenv("FEATURE4_DYNAMIC_DISCOVERY_ENABLED", "true").lower() in {"true", "1"}:
            deadline = min(time.monotonic()+12, deadline) if deadline is not None else time.monotonic()+12
            def timeout():
                left = deadline-time.monotonic()
                if left < .25:
                    raise TimeoutError("Credential discovery deadline")
                return min(3, left)
            query = f'{match.role_title[:100]} certification exam skill assessment official'
            if os.getenv("RUNPOD_API_KEY"):
                try:
                    call_timeout = timeout()
                    metrics["runpod_calls"] += 1
                    planned = pathway_llm.invoke(payload, 'Return JSON with only query: a search query for official certification exams or assessed certificates relevant to supplied skills. No URLs or invented credential names.', timeout=call_timeout, max_tokens=180)
                    candidate = planned.get("query")
                    if isinstance(candidate, str) and 5 <= len(candidate) <= 240 and not any(x in candidate.lower() for x in ("http", "www.", "@")):
                        query = candidate
                except Exception:
                    pass  # Deterministic query remains valid without the LLM.
            try:
                call_timeout = timeout()
                metrics["searches"] += 1
                hits = tavily_api.search(query, timeout=call_timeout, include_domains=PROVIDERS).get("results", [])[:4]
                known = {}
                for hit in hits:
                    try:
                        known[provider_url(hit["url"])] = hit
                    except (ValueError, KeyError, TypeError):
                        metrics["rejected"] += 1
                if known:
                    call_timeout = timeout()
                    metrics["extracts"] += 1
                    pages = tavily_api.extract(list(known), timeout=call_timeout).get("results", [])[:4]
                    for page in pages:
                        try:
                            url = provider_url(page["url"])
                            items.append(verify_credential(known[url], page, skills))
                        except (ValueError, KeyError, TypeError):
                            metrics["rejected"] += 1
                online = [i for i in items if i.origin == "web_discovered"]
                if online and os.getenv("RUNPOD_API_KEY"):
                    try:
                        call_timeout = timeout()
                        metrics["runpod_calls"] += 1
                        order = pathway_llm.evaluate([{"resource_id": i.credential_id, "title": i.title,
                            "target_skill_ids": i.skill_ids, "evidence": "\n".join(i.evidence.values())} for i in online], call_timeout)
                        items.sort(key=lambda i: order.index(i.credential_id) if i.credential_id in order else len(order))
                    except Exception:
                        pass  # Server verification is authoritative, even if evaluation fails.
            except Exception:
                pass  # Keep reviewed local entries on provider failure.
        unique = {}
        for item in items:
            if affordable(item, profile.learning_preferences.budget):
                unique.setdefault(item.url, item)  # Preserve reviewed local identity/evidence on duplicate URLs.
        items = sorted(unique.values(), key=lambda i: -len(i.skill_ids))[:3]
        _cache[key] = (time.monotonic()+(86400 if items else 60), items, metrics)
        while len(_cache) > 32:
            _cache.popitem(last=False)
        return [i.model_copy(deep=True) for i in items], metrics, False
    finally:
        _lock.release()

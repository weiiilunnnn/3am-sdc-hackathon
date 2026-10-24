"""Bounded discovery with public-evidence caching; no profile/PII persistence."""
from collections import OrderedDict
from dataclasses import dataclass, field
from datetime import datetime, timezone
import hashlib
import json
import logging
import os
import threading
import time
from urllib.parse import urlsplit
from src.services.sources import tavily_api
from . import pathway_llm
from .resource_verification import provider_url, verify, PROVIDERS, SkillRelevanceError

log = logging.getLogger(__name__)
_lock = threading.Lock()
_cache = OrderedDict()
_pages = OrderedDict()
_pending = {}


def setting(name, default, low, high):
    try:
        return max(low, min(high, int(os.getenv(name, str(default)))))
    except ValueError:
        return default


@dataclass
class Discovery:
    resources: list = field(default_factory=list)
    sources: dict = field(default_factory=dict)
    used_cache: bool = False
    checked_at: datetime | None = None
    metrics: dict = field(default_factory=lambda: {"searches": 0, "extracts": 0, "runpod_calls": 0,
        "verified": 0, "rejected": 0, "cached": 0, "tavily_credits": 0,
        "candidate_urls": 0, "extracted_pages": 0, "evaluations": 0, "evaluation_valid": 0,
        "search_results": 0, "content_verification_failures": 0, "skill_relevance_failures": 0})
    reasons: list[str] = field(default_factory=list)


def cached_copy(data):
    return Discovery(resources=[r.model_copy(deep=True, update={"retrieval_mode": "cached_verified"}) for r in data.resources],
        sources={k: s.model_copy(deep=True) for k, s in data.sources.items()}, used_cache=True, checked_at=data.checked_at,
        metrics={**data.metrics, "searches": 0, "extracts": 0, "runpod_calls": 0, "tavily_credits": 0, "evaluations": 0,
                 "search_results": 0, "candidate_urls": 0, "extracted_pages": 0,
                 "content_verification_failures": 0, "skill_relevance_failures": 0, "rejected": 0,
                 "cached": len(data.resources)}, reasons=list(data.reasons))


def discover_resources(profile, match, index):
    if os.getenv("FEATURE4_DYNAMIC_DISCOVERY_ENABLED", "true").lower() not in {"true", "1"}:
        return Discovery(reasons=["discovery_disabled"])
    gaps = {r.skill_id: index.skills[r.skill_id] for r in match.missing_skills if r.requirement == "essential"}
    if not gaps:
        return Discovery(reasons=["no_documented_gaps"])
    if not os.getenv("TAVILY_API_KEY"):
        return Discovery(reasons=["tavily_unconfigured"])
    query_cap = setting("FEATURE4_MAX_SEARCH_QUERIES", 3, 1, 5)
    url_cap = setting("FEATURE4_MAX_CANDIDATE_URLS", 8, 1, 12)
    ttl = setting("FEATURE4_DISCOVERY_CACHE_TTL_HOURS", 168, 1, 168) * 3600
    deadline = time.monotonic() + setting("FEATURE4_DISCOVERY_DEADLINE_SECONDS", 25, 5, 25)
    payload = {"occupation": {"role_id": match.role_id, "title": match.role_title},
        "missing_skills": [{"skill_id": sid, "name": s.name} for sid, s in sorted(gaps.items())],
        "recognised_skills": [{"skill_id": s.skill_id, "proficiency": s.proficiency} for s in profile.skills],
        "constraints": profile.learning_preferences.model_dump(mode="json")}
    # Public concepts/non-identifying constraints only; no profile IDs/CVs/names.
    key = hashlib.sha256(json.dumps(["curriculum-topics-v2", payload, query_cap, url_cap, os.getenv("RUNPOD_LLM_ENDPOINT_ID"),
        bool(os.getenv("RUNPOD_API_KEY"))], sort_keys=True).encode()).hexdigest()
    with _lock:
        item = _cache.get(key)
        if item and item[0] > time.monotonic():
            _cache.move_to_end(key)
            return cached_copy(item[1])
        if key in _pending:
            event, leader = _pending[key], False
        elif len(_pending) < 16:
            event, leader = threading.Event(), True
            _pending[key] = event
        else:
            return Discovery(reasons=["discovery_busy"])
    if not leader:
        event.wait(max(0, deadline-time.monotonic()))
        with _lock:
            item = _cache.get(key)
            return cached_copy(item[1]) if item and item[0] > time.monotonic() else Discovery(reasons=["discovery_busy"])
    try:
        data = _retrieve(payload, gaps, query_cap, url_cap, deadline, ttl)
        with _lock:
            # Cache failures briefly to avoid charging on repeated refresh/outages.
            _cache[key] = (time.monotonic() + (ttl if data.resources else 60), data)
            while len(_cache) > 32:
                _cache.popitem(last=False)
        return data
    finally:
        with _lock:
            _pending.pop(key, None)
            event.set()


def _retrieve(payload, gaps, query_cap, url_cap, deadline, ttl):
    data = Discovery()
    started = time.monotonic()

    def timeout(cap):
        left = deadline-time.monotonic()
        if left < .25:
            raise TimeoutError("discovery_deadline")
        return min(cap, left)

    def usage(result):
        credits = result.get("usage", {}).get("credits", 0)
        if isinstance(credits, (int, float)) and credits >= 0:
            data.metrics["tavily_credits"] += credits

    try:
        topics = None
        if os.getenv("RUNPOD_API_KEY"):
            stage_started, call_timeout = time.monotonic(), 0.0
            try:
                call_timeout = timeout(12)
                data.metrics["runpod_calls"] += 1
                topics = pathway_llm.plan(payload, query_cap, call_timeout)
            except Exception as exc:
                pathway_llm.report_failure("course_planning", exc, stage_started, call_timeout)
                data.reasons.append("planning_unavailable_deterministic_queries")
        else:
            data.reasons.append("runpod_unconfigured_deterministic_queries")
        if topics is None:
            skills = list(gaps.items())
            topics = [pathway_llm.Topic(target_skill_ids=[sid], query=f"free {s.name[:150]} tutorial course", purpose="Documented essential gap")
                      for sid, s in skills[:query_cap]]
        hits = {}
        for topic in topics:
            try:
                call_timeout = timeout(3)
                data.metrics["searches"] += 1
                result = tavily_api.search(topic.query, timeout=call_timeout, include_domains=PROVIDERS)
                usage(result)
                data.metrics["search_results"] += len(result.get("results", []))
                for hit in result.get("results", [])[:4]:
                    try:
                        url = provider_url(hit["url"])
                        if len(hits) < url_cap:
                            hits.setdefault(url, ({**hit, "original_url": hit["url"], "url": url}, topic.query))
                    except (ValueError, KeyError, TypeError) as exc:
                        data.metrics["rejected"] += 1
                        value = str(hit.get("url", "")) if isinstance(hit, dict) else ""
                        try:
                            host = urlsplit(value).hostname or "invalid"
                        except ValueError:
                            host = "invalid"
                        # Host/hash only: never log query strings, user data, or provider bodies.
                        host = "".join(c for c in host if c.isascii() and (c.isalnum() or c in ".-"))[:150]
                        reason = str(exc) if str(exc) in {"Provider outside reviewed discovery scope", "Not a specific learning page", "Unsafe provider URL", "Non-public provider URL"} else "invalid_candidate_url_or_schema"
                        log.info("course_candidate host=%s url_hash=%s reason=%s", host,
                                 hashlib.sha256(value.encode()).hexdigest()[:12],
                                 reason)
            except Exception:
                data.reasons.append("search_unavailable")
                break
        data.metrics["candidate_urls"] = len(hits)
        waiting, candidates = [], []
        for url, (hit, query) in hits.items():
            with _lock:
                old = _pages.get(url)
            if old and old[0] > time.monotonic() and set(old[1].covers_skill_ids + old[1].related_skill_ids) & gaps.keys():
                resource = old[1].model_copy(deep=True, update={"retrieval_mode": "cached_verified"})
                resource.covers_skill_ids = sorted(set(resource.covers_skill_ids) & gaps.keys())
                resource.related_skill_ids = sorted(set(resource.related_skill_ids) & gaps.keys())
                resource.mapping_evidence = {k: v for k, v in resource.mapping_evidence.items() if k in gaps}
                resource.relevance_notes = {k: v for k, v in resource.relevance_notes.items() if k in gaps}
                candidates.append((resource, old[2].model_copy(deep=True), old[3]))
                data.used_cache = True
                data.metrics["cached"] += 1
            else:
                waiting.append(url)
        if waiting:
            try:
                call_timeout = timeout(5)
                data.metrics["extracts"] += 1
                extracted = tavily_api.extract(waiting, timeout=call_timeout)
                usage(extracted)
                data.metrics["extracted_pages"] = len(extracted.get("results", []))
                for page in extracted.get("results", [])[:url_cap]:
                    try:
                        url = provider_url(page["url"])
                        if url not in hits or url not in waiting:
                            raise ValueError("Unknown extraction URL")
                        hit, query = hits[url]
                        verified = verify(hit, page, gaps, query)
                        candidates.append(verified)
                        with _lock:
                            _pages[url] = (time.monotonic()+ttl, *verified)
                            while len(_pages) > 128:
                                _pages.popitem(last=False)
                    except (ValueError, KeyError, TypeError) as exc:
                        data.metrics["rejected"] += 1
                        data.metrics["skill_relevance_failures" if isinstance(exc, SkillRelevanceError) else "content_verification_failures"] += 1
                        safe_reasons = {"Extraction identity mismatch", "Provider title/content unavailable", "Search/provider title contradiction", "No specific learning content", "Content inaccessible", "No supported curriculum topic for allowed ESCO concepts", "Provider prerequisites need reviewed canonical mapping", "Unknown extraction URL"}
                        log.info("course_verification reason=%s", str(exc) if str(exc) in safe_reasons else "invalid_source_or_schema")
            except Exception:
                data.reasons.append("extraction_unavailable")
        # Duplicate provider results may not duplicate resources/totals.
        candidates = list({r.resource_id: (r, s, evidence) for r, s, evidence in candidates}.values())
        ranking = []
        if candidates and os.getenv("RUNPOD_API_KEY"):
            stage_started, call_timeout = time.monotonic(), 0.0
            try:
                call_timeout = timeout(5)
                data.metrics["runpod_calls"] += 1
                data.metrics["evaluations"] += 1
                ranking = pathway_llm.evaluate([{"resource_id": r.resource_id, "title": r.title,
                    "provider": r.provider, "target_skill_ids": sorted(set(r.covers_skill_ids + r.related_skill_ids)), "evidence": evidence,
                    "cost_status": r.cost_status, "duration_hours": r.duration_hours,
                    "prerequisite_status": r.prerequisite_status} for r, _, evidence in candidates], call_timeout)
                data.metrics["evaluation_valid"] = 1
            except Exception as exc:
                pathway_llm.report_failure("course_evaluation", exc, stage_started, call_timeout)
                data.reasons.append("evaluation_unavailable_deterministic_ranking")
        for resource, source, _ in candidates:
            resource = resource.model_copy(deep=True, update={"discovery_rank": ranking.index(resource.resource_id)
                if resource.resource_id in ranking else len(ranking)})
            data.resources.append(resource)
            data.sources[source.source_id] = source
        data.metrics["verified"] = len(data.resources)
        data.metrics["confirmed_mapping_resources"] = sum(bool(r.covers_skill_ids) for r in data.resources)
        data.metrics["suggested_related_resources"] = sum(bool(r.related_skill_ids) for r in data.resources)
        data.checked_at = max((r.content_verified_at for r in data.resources), default=None)
    except Exception:
        data.reasons.append("discovery_unavailable")
    data.metrics["elapsed_seconds"] = round(time.monotonic()-started, 3)
    log.info("feature4_discovery counters=%s reasons=%s", data.metrics, data.reasons)
    return data


def build_discovered_pathway(profile, match, catalogue, sources, index):
    # The frontend's existing rewrite proxy times out at 30s. Share one bounded
    # online budget instead of adding a separate 12s certification budget after discovery.
    request_deadline = time.monotonic() + 27
    from .personalized_reskilling import build_pathway
    discovery = discover_resources(profile, match, index)
    # Keep reviewed local IDs/prerequisite references intact when a discovered
    # URL is already curated. Source origin never overrides stronger evidence.
    local_urls = {tavily_api.canonical_url(r.url) for r in catalogue.resources}
    dynamic = [r for r in discovery.resources if tavily_api.canonical_url(r.url) not in local_urls]
    pool = catalogue.model_copy(update={"resources": [*dynamic, *catalogue.resources]})
    evidence = {**sources, **discovery.sources}
    result = build_pathway(profile, match, pool, evidence)
    used = [r for phase in result.phases for r in phase.resources]
    alternatives = result.alternative_resources
    discovery.metrics.update(result.discovery_metrics)
    discovery.metrics.update(selected_web_resources=sum(r.resource_origin == "web_discovered" for r in used),
        alternative_web_resources=sum(r.resource_origin == "web_discovered" for r in alternatives))
    log.info("feature4_selection counters=%s", discovery.metrics)
    web = any(r.resource_origin == "web_discovered" for r in used)
    local = any(r.resource_origin == "local_catalogue" for r in used)
    status = "mixed" if web and local else "live_verified" if web else "catalogue_fallback" if local else "no_verified_resources" if discovery.metrics["searches"] else "discovery_unavailable"
    message = {"mixed": "Provider-checked online resources supplemented with reviewed catalogue resources.",
        "live_verified": "Provider-checked online resources selected for your documented skill gaps.",
        "catalogue_fallback": "Online discovery supplied no eligible alternative; showing reviewed local catalogue resources.",
        "no_verified_resources": "No eligible verified resources found; documented gaps remain visible.",
        "discovery_unavailable": "Online discovery unavailable; the local catalogue has no eligible resources for these gaps."}[status]
    if local and not web and not discovery.metrics["searches"]:
        message = "Online discovery unavailable; showing reviewed local catalogue resources."
    if discovery.used_cache and web:
        message = "Previously discovered provider evidence reused. " + message
    if not result.target_skill_ids:
        message = "No documented essential gaps require learning resources. Proficiency remains unassessed."
    if alternatives:
        message += f" {len(alternatives)} additional resources require relevance or affordability review; see alternatives."
    ids = set(result.source_ids) | {sid for p in result.phases for sid in p.source_ids} | {sid for r in alternatives for sid in r.source_ids}
    from .credentials import recommend_credentials
    credentials, credential_metrics, credential_cached = recommend_credentials(profile, match, index, deadline=request_deadline)
    return result.model_copy(update={"discovery_status": status, "discovery_message": message,
        "credentials": credentials, "credential_metrics": credential_metrics, "credential_used_cache": credential_cached,
        "credential_message": "Relevant credentials to consider after preparation; eligibility and proficiency are not assessed." if credentials else
            "No suitable verified certification or assessment found within your budget. Check back later; learning gaps remain unchanged.",
        "discovery_checked_at": discovery.checked_at, "used_cache": discovery.used_cache,
        "sources": [evidence[sid] for sid in sorted(ids) if sid in evidence], "discovery_metrics": discovery.metrics})

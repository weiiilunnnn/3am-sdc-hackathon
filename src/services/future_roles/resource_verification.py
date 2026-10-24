"""Conservative claim checks against extracted provider text, not search snippets."""
import hashlib
import re
from datetime import datetime, timezone
from urllib.parse import urlsplit
from src.models.future_roles import Resource, Source
from src.services.sources.tavily_api import canonical_url

# Only official learning providers initially; no arbitrary-page fetch proxy.
PROVIDERS = ("learn.microsoft.com", "developers.google.com", "docs.python.org", "developer.mozilla.org",
             "freecodecamp.org", "ocw.mit.edu", "open.edu", "skills.google", "kaggle.com")


class SkillRelevanceError(ValueError):
    """Provider content is usable but does not support a target learning topic."""


# Linguistic topic hints, not ESCO equivalence edges. Nonliteral matches are
# suggestions only and never count as confirmed coverage in the planner.
TOPIC_WORDS = {
    **dict.fromkeys(("analyze", "analyse", "analyzing", "analysing", "analytics", "analyses"), "analysis"),
    **dict.fromkeys(("visualize", "visualise", "visualization", "visualisation", "visualizing", "visualising",
                     "charts", "chart", "plot", "plots", "plotting"), "visualisation"),
    **dict.fromkeys(("statistical", "statistic", "statistics"), "statistics"),
    **dict.fromkeys(("datasets", "dataset"), "data"),
    **dict.fromkeys(("query", "queries", "querying"), "query"),
    **dict.fromkeys(("database", "databases"), "database"),
    **dict.fromkeys(("program", "programming", "coding"), "programming"),
    **dict.fromkeys(("predict", "predictive", "predictions", "prediction"), "prediction"),
}
STOP_WORDS = set("a an the and or of to in for with on by using use apply perform carry out work knowledge understand principles fundamentals introduction basic advanced skills techniques tools".split())
DISTINCT_TOPICS = {"visualisation", "statistics", "python", "sql", "javascript"}
LEARNING_CUE = re.compile(r"\b(?:learn\w*|teach\w*|cover\w*|tutorial|module|lesson|objective|practice|exercise|topic|documentation|reference)\b", re.I)
NEGATION = re.compile(r"\b(?:not|never|without|excluding|excludes?|unrelated|no coverage)\b", re.I)


def topic_tokens(value):
    return {TOPIC_WORDS.get(word, word) for word in re.findall(r"[a-z0-9+#]+", value.casefold()) if word not in STOP_WORDS}


def curriculum_relevance(curriculum, gaps):
    confirmed, related, notes = {}, {}, {}
    # Inspect provider prose only. Titles and search snippets cannot establish relevance.
    passages = [p.strip() for p in re.split(r"\n+|(?<=[.!?])\s+", curriculum) if p.strip()]
    passages = [p[i:i+500] for p in passages if not NEGATION.search(p) for i in range(0, len(p), 400)]
    for sid, skill in gaps.items():
        labels = [skill.name, *skill.aliases]
        for passage in passages:
            if not LEARNING_CUE.search(passage) or NEGATION.search(passage):
                continue
            folded = " ".join(passage.casefold().split())
            exact = next((label for label in labels if len(label.strip()) >= 3 and
                re.search(r"(?<!\w)" + re.escape(" ".join(label.casefold().split())) + r"(?!\w)", folded)), None)
            if exact:
                confirmed[sid] = passage[:500]
                notes[sid] = f'Provider curriculum explicitly names "{exact}"; partial learning support, not mastery.'
                break
            content = topic_tokens(passage)
            for label in labels:
                tokens = topic_tokens(label)
                shared = tokens & content
                if (len(shared) >= 2 and len(shared) / max(1, len(tokens)) >= .6) or (tokens and tokens <= DISTINCT_TOPICS and tokens <= content):
                    related[sid] = passage[:500]
                    notes[sid] = (f'Provider curriculum shares learning topics ({", ".join(sorted(shared))}) with "{skill.name}". '
                                  'Suggested related resource; ESCO coverage requires review.')
                    break
        if sid in confirmed:
            related.pop(sid, None)
    return confirmed, related, notes


def clean(text: str, limit: int = 12000) -> str:
    return re.sub(r"[\x00-\x08\x0b-\x1f\x7f]", "", text)[:limit]


def provider_url(url: str) -> str:
    canonical = canonical_url(url)
    p = urlsplit(canonical)
    if not any(p.hostname == h or p.hostname.endswith("." + h) for h in PROVIDERS):
        raise ValueError("Provider outside reviewed discovery scope")
    if not p.path.strip("/") or any(x in p.path.lower() for x in ("/search", "/forum", "/jobs")):
        raise ValueError("Not a specific learning page")
    return canonical


def verify(hit: dict, page: dict, gaps: dict, query: str):
    url = provider_url(hit["url"])
    if provider_url(page["url"]) != url:
        raise ValueError("Extraction identity mismatch")
    text = clean(page.get("raw_content", ""))
    heading = re.search(r"(?m)^#\s+([^\n]{3,200})", text)
    if not heading or len(text) < 100:
        raise ValueError("Provider title/content unavailable")
    title = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", heading[1]).strip()
    if urlsplit(url).hostname == "developers.google.com":
        # Google appends this collection-control text to extracted H1 headings.
        # Remove only that observed UI suffix; keep the existing title-match threshold.
        title = re.split(r"\s+Stay organized with collections\b", title, maxsplit=1)[0]
    title_words = set(re.findall(r"[a-z0-9]+", title.lower())) - {"the", "a", "to", "and", "of"}
    hit_words = set(re.findall(r"[a-z0-9]+", str(hit.get("title", "")).lower()))
    if not title_words or len(title_words & hit_words) / len(title_words) < .6:
        raise ValueError("Search/provider title contradiction")
    if not re.search(r"\b(course|tutorial|documentation|lesson|module|learn|learning)\b", text[:1500], re.I):
        raise ValueError("No specific learning content")
    if re.search(r"(access denied|sign in to (?:view|access)|content unavailable|page not found)", text[:1000], re.I):
        raise ValueError("Content inaccessible")
    # A matching page title alone does not establish curriculum coverage.
    curriculum = re.sub(r"(?m)^#\s+[^\n]*", "", text)
    mappings, related, notes = curriculum_relevance(curriculum, gaps)
    if not mappings and not related:
        raise SkillRelevanceError("No supported curriculum topic for allowed ESCO concepts")
    free = re.search(r"\b(free (?:online )?(?:course|tutorial|learning|access)|(?:course|tutorial|learning content) is free|audit (?:this course )?for free|no payment required)\b", text, re.I)
    if re.search(r"free trial|subscription required|payment required to access", text, re.I):
        free = None
    cost, price, paid = "unknown", None, None
    if free:
        cost = "free"
    else:
        paid = re.search(r"(?:price|cost)\s*[:\-]\s*(USD|MYR|EUR|GBP)\s*(\d+(?:\.\d{1,2})?)", text, re.I)
        if paid:
            cost, price = "paid", {"currency": paid[1].upper(), "amount": float(paid[2])}
    duration = re.search(r"(?:duration|time to complete)\s*[:\-]\s*(\d+(?:\.\d+)?)\s*(hours?|minutes?)\b", text, re.I)
    hours = float(duration[1]) / (60 if duration[2].lower().startswith("minute") else 1) if duration else None
    stamp = datetime.now(timezone.utc)
    rid = "web-" + hashlib.sha256(url.encode()).hexdigest()[:20]
    source_id = rid + "-provider"
    kind = "course" if re.search(r"\bcourse\b", title, re.I) else "tutorial" if re.search(r"\btutorial\b", title, re.I) else "documentation"
    prereq = re.search(r"(?im)^prerequisites?\s*[:\-]\s*([^\n]{1,240})", text)
    if prereq and not re.fullmatch(r"(?:none|no prerequisites|no prior experience(?: required)?)[.!\s]*", prereq[1], re.I):
        # Do not turn an unparsed provider requirement into an empty graph edge.
        # Pre-reviewed catalogue alternatives retain their mapped prerequisites.
        raise ValueError("Provider prerequisites need reviewed canonical mapping")
    source = Source(source_id=source_id, evidence_status="verified", source_type="provider_page",
        title=title, publisher=urlsplit(url).hostname, url=url, accessed_at=stamp.date(), region="Online; restrictions not fully assessed",
        supported_claims=["resource_content"] + (["skill_mapping"] if mappings else [])
                         + (["related_learning_topic"] if related else []) + (["free_access"] if free else [])
                         + (["cost"] if price else []) + (["duration"] if duration else []),
        transformations="Tavily Extract provider markdown; literal curriculum support or conservative linguistic topic suggestions; explicit price/access/duration checks.",
        redistribution_notes="Links and short evidence excerpts only; provider rights retained.")
    resource = Resource(resource_id=rid, title=title, provider=source.publisher, url=url, resource_type=kind,
        covers_skill_ids=sorted(mappings), duration_hours=hours, duration_basis="provider_stated" if hours is not None else "unknown",
        cost_status=cost, cost=price, access_verified_at=stamp.date(), source_ids=[source_id], evidence_status="verified",
        coverage_note="Provider excerpts support listed concepts partially; related topics are suggestions, not confirmed ESCO coverage.",
        access_notes=(free[0] if free else "Price/free access not confirmed.") + " Certificate, login and regional conditions may differ.",
        prerequisite_notes=prereq[1] if prereq else "Not confirmed; review provider requirements before studying.",
        prerequisite_status="provider_stated" if prereq else "unknown",
        resource_origin="web_discovered", retrieval_mode="fresh_search", verification_status="provider_content_verified",
        content_verified_at=stamp, mapping_evidence={**related, **mappings}, related_skill_ids=sorted(related), relevance_notes=notes, discovery_query=query,
        original_url=hit.get("original_url", hit["url"]))
    resource.claim_evidence = {name: match[0] for name, match in
        (("access", free), ("cost", paid), ("duration", duration), ("prerequisites", prereq)) if match}
    # Only concise excerpts enter the LLM/cache, never complete provider pages.
    evidence = "\n".join(resource.mapping_evidence.values())[:2400]
    return resource, source, evidence

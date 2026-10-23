"""Build reusable, evidence-backed findings from the saved source snapshots.

This runs in the background refresh workflow. GET requests only read its output.
"""

from __future__ import annotations

import hashlib
import json
import re
from collections import Counter
from datetime import datetime, timezone

from src.data.signal_employment_source import SKILL_PHRASES, SOURCE_ID
from src.data.signal_contexts import MAPPING_VERSION, SUPPORTED_CONTEXTS, role_family_for_title
from src.services.signal_employment_service import get_employment_dashboard
from src.services.storage import connection, initialize_database
from src.services.trend_service import get_dashboard

EXTRACTION_VERSION = "keyword-evidence-v4"
FINDING_VERSION = "role-insights-v1"
MIN_ROLE_POSTINGS = 8
MIN_SKILL_POSTINGS = 2
SKILL_IDS = {
    "mention:ai", "local:python-programming", "mention:javascript", "mention:typescript",
    "local:machine-learning", "mention:sql", "local:data-analysis", "local:communication",
}
PAIR_CANDIDATES = [
    ("local:python-programming", "mention:ai"),
    ("mention:javascript", "mention:typescript"),
    ("local:python-programming", "local:machine-learning"),
]
LABELS = {skill_id: label for skill_id, label, _ in SKILL_PHRASES}


def _json(value: object) -> str:
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def _hash(value: object) -> str:
    return hashlib.sha256(_json(value).encode("utf-8")).hexdigest()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def validate_excerpt(excerpt: str | None, field: str | None, *, title: str, tags: list[str], evidence_text: str) -> bool:
    if not excerpt:
        return True
    haystacks = {"title": title, "tags": " ".join(tags), "description": evidence_text}
    return bool(field in haystacks and excerpt in haystacks[field])


def _evidence(job, skill_ids: set[str]) -> dict:
    mentions = [mention for mention in job.skill_mentions if mention.skill_id in skill_ids]
    excerpt, field = None, None
    for mention in mentions:
        if mention.excerpt and validate_excerpt(mention.excerpt, mention.excerpt_field, title=job.title,
                                                tags=job.tags, evidence_text=job.evidence_text):
            excerpt, field = mention.excerpt, mention.excerpt_field
            break
        # Older cached snapshots retained title/tags and match terms but not a description excerpt.
        for name, values in (("title", [job.title]), ("tags", job.tags)):
            match = next((value for value in values if any(
                re.search(r"(?<!\w)" + re.escape(term) + r"(?!\w)", value, re.I) for term in mention.terms
            )), None)
            if match:
                excerpt, field = match[:180], name
                break
        if excerpt:
            break
    return {
        "id": f"{SOURCE_ID}:{job.source_job_id}", "title": job.title,
        "company": job.company, "date": job.published_at, "url": job.source_url,
        "source": "Remote OK", "excerpt": excerpt, "excerpt_field": field,
    }


def _support(jobs: list, skill_ids: set[str]) -> list[dict]:
    with_excerpt = sorted(jobs, key=lambda job: (
        not bool(_evidence(job, skill_ids)["excerpt"]), -int(job.published_at[:10].replace("-", ""))
    ))
    return [_evidence(job, skill_ids) for job in with_excerpt[:5]]


def _posting_base(group: list, finding_id: str, headline: str, kind: str, numerator: int, denominator: int, *,
                  skill_ids: list[str], evidence_jobs: list, chart: dict, collected_at: str | None) -> dict:
    return {
        "id": finding_id, "context_id": "software_engineering", "type": kind, "headline": headline,
        "metric": {"numerator": numerator, "denominator": denominator, "unit": "unique postings"},
        "chart": chart, "skill_ids": skill_ids, "topic_id": None,
        "observation_period": {"from": min(job.published_at for job in group), "to": max(job.published_at for job in group)},
        "source": {"name": "Remote OK", "url": "https://remoteok.com/api", "collected_at": collected_at,
                   "scope": f"Remote OK · mixed-location remote postings · {len(group)} title-matched software roles"},
        "evidence": _support(evidence_jobs, set(skill_ids)),
        "employer_count": len({job.company.strip().casefold() for job in evidence_jobs}),
        "coverage": "One bounded feed sample; title-based role grouping and phrase mentions are imperfect. This is not representative of Malaysia or the whole job market.",
        "interpretation": "This is a current posting pattern, not a hiring trend or a skill requirement for every role.",
        "explanation_provenance": "template", "mapping_version": MAPPING_VERSION,
    }


def _build_posting_findings(jobs: list, collected_at: str | None) -> list[dict]:
    group = list({job.source_job_id: job for job in jobs if role_family_for_title(job.title) == "software_engineering"}.values())
    if len(group) < MIN_ROLE_POSTINGS:
        return []
    by_skill = {skill_id: [job for job in group if skill_id in {mention.skill_id for mention in job.skill_mentions}]
                for skill_id in SKILL_IDS}
    counts = Counter({skill_id: len(items) for skill_id, items in by_skill.items()})
    chart_items = [
        {"id": skill_id, "label": LABELS[skill_id], "count": count}
        for skill_id, count in sorted(counts.items(), key=lambda item: (-item[1], LABELS[item[0]]))
        if count >= MIN_SKILL_POSTINGS
    ][:6]
    findings = []
    for skill_id, items in by_skill.items():
        if len(items) < MIN_SKILL_POSTINGS:
            continue
        label = LABELS[skill_id]
        findings.append(_posting_base(
            group, f"prevalence:{skill_id}", f"{label} appears in sampled software roles",
            "posting_prevalence", len(items), len(group), skill_ids=[skill_id], evidence_jobs=items,
            chart={"kind": "bars", "items": chart_items, "highlight_id": skill_id, "max": len(group),
                   "title": "Skill mentions in title-matched software postings", "unit": "unique postings"},
            collected_at=collected_at,
        ))
    for anchor, partner in PAIR_CANDIDATES:
        anchor_jobs = by_skill[anchor]
        both = [job for job in anchor_jobs if partner in {mention.skill_id for mention in job.skill_mentions}]
        if len(anchor_jobs) < 3 or len(both) < MIN_SKILL_POSTINGS:
            continue
        findings.append(_posting_base(
            group, f"cooccurrence:{anchor}:{partner}",
            f"{LABELS[partner]} appears alongside {LABELS[anchor]}",
            "skill_cooccurrence", len(both), len(anchor_jobs), skill_ids=[anchor, partner], evidence_jobs=both,
            chart={"kind": "paired", "items": [
                {"id": "both", "label": f"{LABELS[anchor]} + {LABELS[partner]}", "count": len(both)},
                {"id": "anchor_only", "label": f"{LABELS[anchor]} without {LABELS[partner]}", "count": len(anchor_jobs) - len(both)},
            ], "max": len(anchor_jobs), "title": f"Among software postings mentioning {LABELS[anchor]}", "unit": "unique postings"},
            collected_at=collected_at,
        ))
    return findings


def _build_research_findings(research) -> list[dict]:
    topics = set(SUPPORTED_CONTEXTS[0]["topic_ids"])
    findings = []
    for topic in research.topics:
        if topic.topic_id not in topics or topic.change.status != "available" or len(topic.observations) < 2:
            continue
        previous, latest = topic.observations[-2:]
        if topic.change.percentage_change is None:
            continue
        direction = "rose" if latest.value > previous.value else "fell" if latest.value < previous.value else "were unchanged"
        findings.append({
            "id": f"research:{topic.topic_id}", "context_id": "software_engineering", "type": "research_momentum",
            "headline": f"OpenAlex matches for {topic.label} {direction}",
            "metric": {"numerator": latest.value, "denominator": previous.value, "unit": "research records",
                       "change_percent": topic.change.percentage_change},
            "chart": {"kind": "line", "title": f"OpenAlex matches for {topic.label}", "unit": "research records",
                      "items": [{"year": item.period_year, "count": item.value} for item in topic.observations]},
            "skill_ids": [], "topic_id": topic.topic_id,
            "observation_period": {"from": str(previous.period_year), "to": str(latest.period_year)},
            "source": {"name": "OpenAlex", "url": topic.source_url, "collected_at": latest.retrieved_at,
                       "scope": "OpenAlex Works · comparable complete publication years"},
            "evidence": [{"id": f"openalex:{topic.topic_id}", "title": f"OpenAlex Works query for {topic.label}",
                          "company": None, "date": str(latest.period_year), "url": topic.source_url,
                          "source": "OpenAlex", "excerpt": None, "excerpt_field": None}],
            "employer_count": None,
            "coverage": topic.limitations + " These counts are not job demand or workplace adoption.",
            "interpretation": f"The comparable count changed from {previous.value:,} in {previous.period_year} to {latest.value:,} in {latest.period_year}.",
            "explanation_provenance": "template", "mapping_version": MAPPING_VERSION,
        })
    return findings


def process_shared_findings() -> dict:
    """Refresh local extraction/findings only when cached evidence or rules change."""
    initialize_database()
    employment, research = get_employment_dashboard(), get_dashboard()
    fingerprint = {
        "jobs": [{key: value for key, value in job.model_dump(mode="json").items() if key != "retrieved_at"}
                 for job in employment.jobs],
        "research": [(topic.topic_id, [(item.period_year, item.value) for item in topic.observations])
                     for topic in research.topics],
        "rules": [MAPPING_VERSION, EXTRACTION_VERSION, FINDING_VERSION],
    }
    version = _hash(fingerprint)
    with connection() as db:
        db.execute("BEGIN IMMEDIATE")
        state = db.execute("SELECT evidence_version FROM signal_processing_state WHERE id = 1").fetchone()
        if state and state["evidence_version"] == version:
            return {"status": "unchanged", "evidence_version": version}
        now = _now()
        validated_jobs = []
        for job in employment.jobs:
            record = {key: value for key, value in job.model_dump(mode="json").items() if key != "retrieved_at"}
            content_hash = _hash(record)
            existing = db.execute("SELECT first_seen_at FROM signal_documents WHERE source_id = ? AND document_id = ?",
                                  (SOURCE_ID, job.source_job_id)).fetchone()
            db.execute(
                "INSERT INTO signal_documents (source_id, document_id, content_hash, payload, first_seen_at, last_seen_at) "
                "VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(source_id, document_id) DO UPDATE SET "
                "content_hash = excluded.content_hash, payload = excluded.payload, last_seen_at = excluded.last_seen_at",
                (SOURCE_ID, job.source_job_id, content_hash, _json(record),
                 existing["first_seen_at"] if existing else now, now),
            )
            cached = db.execute(
                "SELECT 1 FROM signal_extractions WHERE source_id = ? AND document_id = ? AND content_hash = ? AND extraction_version = ?",
                (SOURCE_ID, job.source_job_id, content_hash, EXTRACTION_VERSION),
            ).fetchone()
            valid_mentions = [mention for mention in job.skill_mentions if validate_excerpt(
                mention.excerpt, mention.excerpt_field, title=job.title,
                tags=job.tags, evidence_text=job.evidence_text,
            )]
            validated_jobs.append(job.model_copy(update={"skill_mentions": valid_mentions}))
            if not cached:
                mentions = [mention.model_dump(mode="json") for mention in valid_mentions]
                extraction = {"role_family": role_family_for_title(job.title), "skills": mentions,
                              "work_tasks": [], "required_status": None, "method": "deterministic phrase matching"}
                db.execute(
                    "INSERT INTO signal_extractions (source_id, document_id, content_hash, extraction_version, payload, processed_at) "
                    "VALUES (?, ?, ?, ?, ?, ?)",
                    (SOURCE_ID, job.source_job_id, content_hash, EXTRACTION_VERSION, _json(extraction), now),
                )
        findings = _build_posting_findings(validated_jobs, employment.last_successful_refresh)
        findings += _build_research_findings(research)
        for finding in findings:
            finding["evidence_version"] = version
            db.execute("INSERT INTO signal_findings (evidence_version, finding_id, context_id, payload) VALUES (?, ?, ?, ?)",
                       (version, finding["id"], finding["context_id"], _json(finding)))
        db.execute("UPDATE signal_processing_state SET evidence_version = ?, processed_at = ?, last_error = NULL WHERE id = 1",
                   (version, now))
    return {"status": "processed", "evidence_version": version, "findings": len(findings)}


def get_shared_findings(context_id: str) -> tuple[str | None, list[dict]]:
    initialize_database()
    with connection() as db:
        state = db.execute("SELECT evidence_version FROM signal_processing_state WHERE id = 1").fetchone()
        version = state["evidence_version"] if state else None
        if not version:
            return None, []
        rows = db.execute("SELECT payload FROM signal_findings WHERE evidence_version = ? AND context_id = ?",
                          (version, context_id)).fetchall()
    return version, [json.loads(row["payload"]) for row in rows]

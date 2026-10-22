"""Current-sample AI capability prevalence; historical ranking only with coverage."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from src.data.ai_capabilities import CAPABILITIES
from src.data.employment_source import SOURCE_ID
from src.data.signal_contexts import role_family_for_title
from src.services.employment_service import get_employment_dashboard
from src.services.skill_connections import TASK_VERBS, _contains, _sentences, get_saved_skill_connections
from src.services.storage import connection, initialize_database

MIN_PERIOD_POSTS = 30
MIN_MENTIONS = 5
WINDOW_DAYS = 30


def _observed(job, aliases: tuple[str, ...]) -> str | None:
    return next((alias for alias in aliases if _contains(job.evidence_text, alias)), None)


def _passage(job, alias: str) -> str:
    for sentence in _sentences(job.evidence_text):
        if _contains(sentence, alias):
            return sentence[:310]
    lower = job.evidence_text.casefold()
    at = lower.find(alias.casefold())
    return job.evidence_text[max(0, at - 70):at + len(alias) + 130].strip()


def _history_windows() -> tuple[list, list] | None:
    initialize_database()
    with connection() as db:
        snapshots = db.execute("SELECT retrieved_at, payload FROM employment_snapshot_history "
                               "WHERE source_id = ? ORDER BY retrieved_at", (SOURCE_ID,)).fetchall()
    if len(snapshots) < 2:
        return None
    first = datetime.fromisoformat(snapshots[0]["retrieved_at"].replace("Z", "+00:00"))
    last = datetime.fromisoformat(snapshots[-1]["retrieved_at"].replace("Z", "+00:00"))
    if last - first < timedelta(days=60):
        return None
    cutoff = last - timedelta(days=30)
    prior = cutoff - timedelta(days=30)
    collection_dates = [datetime.fromisoformat(row["retrieved_at"].replace("Z", "+00:00")) for row in snapshots]
    if (sum(prior <= date < cutoff for date in collection_dates) < 2 or
            sum(cutoff <= date <= last for date in collection_dates) < 2):
        return None
    dedup = {}
    for snapshot in snapshots:
        for row in json.loads(snapshot["payload"]).get("jobs", []):
            dedup[row["source_job_id"]] = row
    from src.models.employment import EmploymentJob
    jobs = [EmploymentJob.model_validate(row) for row in dedup.values()]
    earlier = [job for job in jobs if prior <= datetime.fromisoformat(job.published_at.replace("Z", "+00:00")) < cutoff]
    recent = [job for job in jobs if cutoff <= datetime.fromisoformat(job.published_at.replace("Z", "+00:00")) <= last]
    return (earlier, recent) if len(earlier) >= MIN_PERIOD_POSTS and len(recent) >= MIN_PERIOD_POSTS else None


def get_ai_skill_exploration() -> dict:
    employment = get_employment_dashboard()
    jobs = list({job.source_job_id: job for job in employment.jobs}.values())
    history = _history_windows()
    capabilities = list(CAPABILITIES)
    known_ids = {item[0] for item in capabilities}
    _, discovered = get_saved_skill_connections()
    for item in discovered:
        ai = item["ai_skill"]
        if ai["id"] not in known_ids:
            capabilities.append((ai["id"], ai["name"], ai["definition"], (ai["name"],)))
            known_ids.add(ai["id"])
    # The source is a small capped feed. Use comparisons only when *both* periods
    # have independent publication-date coverage and adequate skill support.
    if history and not any(min(sum(bool(_observed(job, aliases)) for job in period) for period in history) >= MIN_MENTIONS
                           for _, _, _, aliases in capabilities):
        history = None
    mode = "rising" if history else "most_mentioned"
    result = []
    for key, name, definition, aliases in capabilities:
        observed = [(job, alias) for job in jobs if (alias := _observed(job, aliases))]
        if not observed:
            continue
        earlier_count = recent_count = None
        if history:
            earlier_count = sum(bool(_observed(job, aliases)) for job in history[0])
            recent_count = sum(bool(_observed(job, aliases)) for job in history[1])
            if min(earlier_count, recent_count) < MIN_MENTIONS:
                continue
        evidence = [{"id": f"{SOURCE_ID}:{job.source_job_id}", "title": job.title,
                     "company": job.company, "url": job.source_url, "published_at": job.published_at,
                     "source": "Remote OK", "source_quote": _passage(job, alias),
                     "ai_quote": _passage(job, alias)} for job, alias in observed[:3]]
        tasks = list(dict.fromkeys(sentence for job, alias in observed for sentence in _sentences(job.evidence_text)
                                   if len(sentence) <= 180 and _contains(sentence, alias) and TASK_VERBS.search(sentence)))[:2]
        roles = list(dict.fromkeys(job.title for job, _ in observed))[:3]
        metric = ({"kind": "posting_share_change", "earlier": {"numerator": earlier_count, "denominator": len(history[0]),
                   "from": min(job.published_at for job in history[0]), "to": max(job.published_at for job in history[0])},
                   "recent": {"numerator": recent_count, "denominator": len(history[1]),
                   "from": min(job.published_at for job in history[1]), "to": max(job.published_at for job in history[1])},
                   "percentage_points": round(100 * (recent_count / len(history[1]) - earlier_count / len(history[0])), 2)}
                  if history else {"kind": "posting_prevalence", "numerator": len(observed),
                                   "denominator": len(jobs), "unit": "unique retained remote postings"})
        result.append({"id": key, "name": name, "definition": definition, "roles": roles,
                       "role_families": sorted({role_family_for_title(job.title) for job, _ in observed if role_family_for_title(job.title)}),
                       "tasks": tasks, "metric": metric, "evidence": evidence,
                       "source": {"name": "Remote OK", "collected_at": employment.last_successful_refresh,
                                  "scope": "Bounded mixed-location remote-job sample"}})
    if history:
        result.sort(key=lambda item: (-item["metric"]["percentage_points"], -item["metric"]["recent"]["numerator"], item["name"]))
    else:
        result.sort(key=lambda item: (-item["metric"]["numerator"], item["name"]))
    return {"mode": mode, "title": ("Fastest rising in sampled postings" if history else
                                     "Most mentioned in our remote-job sample"),
            "sample_size": len(jobs), "collected_at": employment.last_successful_refresh,
            "source_scope": "Remote OK · capped mixed-location remote postings",
            "periods": ({"earlier_days": WINDOW_DAYS, "recent_days": WINDOW_DAYS,
                         "earlier_postings": len(history[0]), "recent_postings": len(history[1])} if history else None),
            "items": result[:8]}

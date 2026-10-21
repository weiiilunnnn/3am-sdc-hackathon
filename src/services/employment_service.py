"""Atomic employment snapshot caching, separate from OpenAlex observations."""

from __future__ import annotations

import json
from collections import Counter
from datetime import datetime, timezone
from math import ceil

from src.data.employment_source import REFRESH_SECONDS, REMOTEOK_SOURCE, SOURCE_ID, TOPIC_PHRASES
from src.models.employment import EmploymentDashboard, EmploymentJob, SkillCount
from src.services.sources.base import SourceAdapterError
from src.services.sources.employment_base import EmploymentSource
from src.services.sources.remoteok import RemoteOKSource
from src.services.storage import connection, initialize_database


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _remaining(attempt: str | None) -> int:
    if not attempt:
        return 0
    elapsed = (datetime.now(timezone.utc) - datetime.fromisoformat(attempt.replace("Z", "+00:00"))).total_seconds()
    return max(0, ceil(REFRESH_SECONDS - elapsed))


def get_employment_dashboard(status: str | None = None) -> EmploymentDashboard:
    initialize_database()
    with connection() as db:
        state = db.execute("SELECT * FROM employment_refresh_state WHERE source_id = ?", (SOURCE_ID,)).fetchone()
        cached = db.execute("SELECT payload FROM employment_snapshots WHERE source_id = ?", (SOURCE_ID,)).fetchone()
    data = json.loads(cached["payload"]) if cached else {}
    jobs = [EmploymentJob.model_validate(item) for item in data.get("jobs", [])]
    counts: Counter[str] = Counter()
    labels: dict[str, str] = {}
    for job in jobs:
        for mention in job.skill_mentions:
            counts[mention.skill_id] += 1
            labels[mention.skill_id] = mention.label
    dates = sorted(job.published_at for job in jobs)
    state_status = status or (state["last_status"] if state else "never")
    return EmploymentDashboard(
        source=data.get("source", REMOTEOK_SOURCE), jobs=jobs,
        skill_counts=[SkillCount(skill_id=key, label=labels[key], posting_count=count, share_percent=round(count / len(jobs) * 100, 2))
                      for key, count in sorted(counts.items(), key=lambda pair: (-pair[1], pair[0]))],
        topic_counts={topic: sum(topic in job.topic_ids for job in jobs) for topic in TOPIC_PHRASES},
        posting_count=len(jobs), employer_count=len({job.company.casefold() for job in jobs}),
        location_labels=sorted({job.location for job in jobs if job.location}),
        unknown_location_count=sum(job.location is None for job in jobs),
        published_from=dates[0] if dates else None, published_to=dates[-1] if dates else None,
        source_feed_updated_at=data.get("feed_updated_at"),
        received_records=data.get("received_records", 0), excluded_records=data.get("excluded_records", 0),
        last_successful_refresh=state["last_success_at"] if state else None,
        last_attempt_at=state["last_attempt_at"] if state else None,
        refresh_status=state_status, cooldown_seconds=_remaining(state["last_attempt_at"] if state else None),
        cache_fallback=bool(jobs) and bool(state and state["last_status"] == "failed"),
        error_message=state["last_error"] if state else None,
    )


def refresh_employment(source: EmploymentSource | None = None) -> EmploymentDashboard:
    initialize_database()
    attempted = _now()
    cooling = False
    with connection() as db:
        db.execute("BEGIN IMMEDIATE")
        state = db.execute("SELECT * FROM employment_refresh_state WHERE source_id = ?", (SOURCE_ID,)).fetchone()
        if state and _remaining(state["last_attempt_at"]):
            cooling = True
        else:
            db.execute(
                "INSERT INTO employment_refresh_state (source_id, last_attempt_at, last_status) VALUES (?, ?, 'refreshing') "
                "ON CONFLICT(source_id) DO UPDATE SET last_attempt_at = excluded.last_attempt_at, last_status = 'refreshing', last_error = NULL",
                (SOURCE_ID, attempted),
            )
    if cooling:
        return get_employment_dashboard("cooldown")
    try:
        result = (source or RemoteOKSource()).fetch_snapshot()
        if result.source_id != SOURCE_ID or not result.jobs:
            raise SourceAdapterError("The employment provider returned an incompatible or empty snapshot.")
        payload = json.dumps({
            "source": REMOTEOK_SOURCE,
            "jobs": [job.model_dump(mode="json") for job in result.jobs],
            "feed_updated_at": result.feed_updated_at, "received_records": result.received_records,
            "excluded_records": result.excluded_records,
        }, ensure_ascii=False)
        with connection() as db:
            db.execute("INSERT INTO employment_snapshots (source_id, payload) VALUES (?, ?) ON CONFLICT(source_id) DO UPDATE SET payload = excluded.payload", (SOURCE_ID, payload))
            db.execute("UPDATE employment_refresh_state SET last_success_at = ?, last_status = 'success', last_error = NULL WHERE source_id = ?", (result.retrieved_at, SOURCE_ID))
    except SourceAdapterError as exc:
        with connection() as db:
            db.execute("UPDATE employment_refresh_state SET last_status = 'failed', last_error = ? WHERE source_id = ?", (str(exc), SOURCE_ID))
    return get_employment_dashboard()

"""Atomic employment snapshot caching, separate from OpenAlex observations."""

from __future__ import annotations

import json
from collections import Counter
from datetime import datetime, timezone
from math import ceil

from src.data.signal_employment_source import REFRESH_SECONDS, REMOTEOK_SOURCE, SKILL_PHRASES, SOURCE_ID, TOPIC_PHRASES
from src.data.himalayas_source import HIMALAYAS_SOURCE
from src.models.signal_employment import EmploymentDashboard, EmploymentJob, SkillCount
from src.services.sources.base import SourceAdapterError
from src.services.sources.employment_base import EmploymentSource
from src.services.sources.signal_remoteok import RemoteOKSource
from src.services.sources.himalayas import HimalayasSource
from src.services.storage import connection, initialize_database


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _remaining(attempt: str | None) -> int:
    if not attempt:
        return 0
    elapsed = (datetime.now(timezone.utc) - datetime.fromisoformat(attempt.replace("Z", "+00:00"))).total_seconds()
    return max(0, ceil(REFRESH_SECONDS - elapsed))


def get_employment_dashboard(status: str | None = None, source_id: str = SOURCE_ID) -> EmploymentDashboard:
    initialize_database()
    with connection() as db:
        state = db.execute("SELECT * FROM employment_refresh_state WHERE source_id = ?", (source_id,)).fetchone()
        cached = db.execute("SELECT payload FROM employment_snapshots WHERE source_id = ?", (source_id,)).fetchone()
    data = json.loads(cached["payload"]) if cached else {}
    jobs = [EmploymentJob.model_validate(item) for item in data.get("jobs", [])]
    now = _now()
    jobs = [job for job in jobs if not job.expires_at or job.expires_at > now]
    counts: Counter[str] = Counter({skill_id: 0 for skill_id, _, _ in SKILL_PHRASES}) if jobs else Counter()
    labels: dict[str, str] = {skill_id: label for skill_id, label, _ in SKILL_PHRASES} if jobs else {}
    for job in jobs:
        for mention in job.skill_mentions:
            counts[mention.skill_id] += 1
            labels[mention.skill_id] = mention.label
    dates = sorted(job.published_at for job in jobs)
    state_status = status or (state["last_status"] if state else "never")
    return EmploymentDashboard(
        source=data.get("source", HIMALAYAS_SOURCE if source_id == "himalayas" else REMOTEOK_SOURCE), jobs=jobs,
        skill_counts=[
            SkillCount(skill_id=key, label=labels[key], posting_count=count, share_percent=round(count / len(jobs) * 100, 2))
            for key, count in sorted(counts.items(), key=lambda pair: (-pair[1], labels[pair[0]].casefold()))
        ],
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


def get_employment_history_summary() -> dict[str, str | int | None]:
    """Collection coverage, not a claim about changing skill demand."""
    initialize_database()
    with connection() as db:
        row = db.execute(
            "SELECT COUNT(*) AS snapshots, MIN(retrieved_at) AS first_collected_at, "
            "MAX(retrieved_at) AS last_collected_at "
            "FROM employment_snapshot_history WHERE source_id = ?",
            (SOURCE_ID,),
        ).fetchone()
    return dict(row)


def refresh_employment(source: EmploymentSource | None = None) -> EmploymentDashboard:
    initialize_database()
    source = source or RemoteOKSource()
    source_id = "himalayas" if isinstance(source, HimalayasSource) else SOURCE_ID
    attempted = _now()
    cooling = False
    with connection() as db:
        db.execute("BEGIN IMMEDIATE")
        state = db.execute("SELECT * FROM employment_refresh_state WHERE source_id = ?", (source_id,)).fetchone()
        if state and _remaining(state["last_attempt_at"]):
            cooling = True
        else:
            db.execute(
                "INSERT INTO employment_refresh_state (source_id, last_attempt_at, last_status) VALUES (?, ?, 'refreshing') "
                "ON CONFLICT(source_id) DO UPDATE SET last_attempt_at = excluded.last_attempt_at, last_status = 'refreshing', last_error = NULL",
                (source_id, attempted),
            )
    if cooling:
        return get_employment_dashboard("cooldown", source_id)
    try:
        result = source.fetch_snapshot()
        if result.source_id != source_id or not result.jobs:
            raise SourceAdapterError("The employment provider returned an incompatible or empty snapshot.")
        payload = json.dumps({
            "source": HIMALAYAS_SOURCE if source_id == "himalayas" else REMOTEOK_SOURCE,
            "jobs": [job.model_dump(mode="json") for job in result.jobs],
            "feed_updated_at": result.feed_updated_at, "received_records": result.received_records,
            "excluded_records": result.excluded_records,
        }, ensure_ascii=False)
        with connection() as db:
            db.execute("INSERT INTO employment_snapshots (source_id, payload) VALUES (?, ?) ON CONFLICT(source_id) DO UPDATE SET payload = excluded.payload", (source_id, payload))
            if source_id == SOURCE_ID:
                db.execute(
                    "INSERT OR REPLACE INTO employment_snapshot_history (source_id, retrieved_at, payload) VALUES (?, ?, ?)",
                    (source_id, result.retrieved_at, payload),
                )
            db.execute("UPDATE employment_refresh_state SET last_success_at = ?, last_status = 'success', last_error = NULL WHERE source_id = ?", (result.retrieved_at, source_id))
    except SourceAdapterError as exc:
        with connection() as db:
            db.execute("UPDATE employment_refresh_state SET last_status = 'failed', last_error = ? WHERE source_id = ?", (str(exc), source_id))
    return get_employment_dashboard(source_id=source_id)


def get_signal_employment_dashboard() -> EmploymentDashboard:
    """Prefer the broader attributed remote sample, retaining the old source as fallback."""
    primary = get_employment_dashboard(source_id="himalayas")
    return primary if primary.posting_count else get_employment_dashboard()

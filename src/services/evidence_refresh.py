"""Refresh source caches in the backend without tying retrieval to page visits."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from src.services.dosm_service import get_dosm_dashboard, refresh_dosm
from src.services.employment_service import get_employment_dashboard, refresh_employment
from src.services.sources.himalayas import HimalayasSource
from src.services.trend_service import get_dashboard, refresh_trends
from src.services.signal_findings import process_shared_findings
from src.services.skill_connections import process_skill_connections
from src.services.connection_jobs import process_discovery_jobs

LOG = logging.getLogger(__name__)
CHECK_INTERVAL_SECONDS = 6 * 60 * 60


def _due(timestamp: str | None, interval: timedelta) -> bool:
    if not timestamp:
        return True
    try:
        last = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    except ValueError:
        return True
    return datetime.now(timezone.utc) - last >= interval


def refresh_due_sources() -> None:
    """Poll at source-appropriate intervals; preserve each source's last good cache."""
    sources = (
        ("OpenAlex", get_dashboard, refresh_trends, timedelta(hours=24), "last_attempt_at"),
        ("Remote OK", get_employment_dashboard, refresh_employment, timedelta(hours=24), "last_attempt_at"),
        ("Himalayas", lambda: get_employment_dashboard(source_id="himalayas"),
         lambda: refresh_employment(HimalayasSource()), timedelta(hours=24), "last_attempt_at"),
        ("DOSM", get_dosm_dashboard, refresh_dosm, timedelta(days=7), "retrieved_at"),
    )
    for name, read, refresh, interval, field in sources:
        try:
            state = read()
            timestamp = state.get(field) if isinstance(state, dict) else getattr(state, field)
            if _due(timestamp, interval):
                refresh()
        except Exception:
            LOG.exception("Background refresh failed for %s; cached data remains available", name)
    try:
        process_shared_findings()
    except Exception:
        LOG.exception("Shared finding processing failed; previous findings remain available")
    try:
        process_skill_connections()
    except Exception:
        LOG.exception("Skill connection processing failed; previous connections remain available")
    try:
        process_discovery_jobs()
    except Exception:
        LOG.exception("Queued discovery failed; saved connections remain available")


async def refresh_loop() -> None:
    while True:
        await asyncio.to_thread(refresh_due_sources)
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)

"""Populate evidence on fresh deployments; page requests only read the cache.

A SQLite lease coordinates workers sharing a database. Source adapters retain
last-good snapshots and enforce their own refresh limits. No profile data or
paid model requests are involved in this maintenance job.
"""
from __future__ import annotations

import logging
import json
from pathlib import Path
import os
import threading
import time

from src.services.storage import connection, initialize_database
from src.services.disruption_reference import import_references, reference_status
from src.services.signal_employment_service import refresh_employment
from src.services.sources.himalayas import HimalayasSource
from src.services.skill_connections import process_skill_connections
from src.services.trend_service import refresh_trends

logger = logging.getLogger(__name__)
INTERVAL_SECONDS = 3600


def refresh_signal_evidence() -> dict:
    initialize_database()
    # Claim before network I/O, including on failure, to avoid restart storms.
    with connection() as db:
        db.execute("CREATE TABLE IF NOT EXISTS signal_maintenance (id INTEGER PRIMARY KEY CHECK(id=1), attempted_at REAL NOT NULL)")
        db.execute("BEGIN IMMEDIATE")
        row = db.execute("SELECT attempted_at FROM signal_maintenance WHERE id=1").fetchone()
        now = time.time()
        if row and now - row['attempted_at'] < INTERVAL_SECONDS:
            return {"status": "cooldown"}
        db.execute("INSERT OR REPLACE INTO signal_maintenance VALUES (1, ?)", (now,))

    report = {}
    def run(name, action):
        try:
            logger.info('AI Trend Signal refreshing %s', name)
            report[name] = action()
        except Exception:
            # An unavailable provider must not stop the other independent sources.
            logger.exception("AI Trend Signal %s refresh failed", name)
            report[name] = "failed"

    def references():
        if reference_status().get('ready'):
            return "cached"
        from scripts.refresh_disruption_references import download, ONET_TASKS, ANTHROPIC_TASKS, ANTHROPIC_JOBS
        result = import_references(download(ONET_TASKS), download(ANTHROPIC_TASKS), download(ANTHROPIC_JOBS))
        return {"matched_tasks": result['matched_tasks']}

    def employment():
        result = refresh_employment(HimalayasSource())
        if not result.posting_count:
            result = refresh_employment()  # Existing attributed fallback provider.
        return {"status": result.refresh_status, "postings": result.posting_count}

    run('employment', employment)
    run('connections', process_skill_connections)
    run('research', lambda: refresh_trends().refresh_status)
    run('references', references)
    logger.info("AI Trend Signal maintenance: %s", report)
    return report


def seed_research_cache() -> None:
    """Restore a dated public snapshot only when no research cache exists.

    Keep original source URLs/timestamps and never overwrite fresher observations.
    This is observed OpenAlex data, not the synthetic demo dashboard.
    """
    from src.data.trend_topics import MEASUREMENT, TREND_TOPICS
    from src.models.trends import TrendObservation
    snapshot = json.loads((Path(__file__).resolve().parents[1] / 'data' / 'openalex_snapshot.json').read_text())
    if {t['topic_id'] for t in snapshot['topics']} != {t['id'] for t in TREND_TOPICS}:
        raise ValueError('Bundled research snapshot has an incomplete topic set')
    rows = []
    for topic in snapshot['topics']:
        for raw in topic['observations']:
            obs = TrendObservation.model_validate(raw)
            if obs.data_mode != 'real' or not (obs.source_url or '').startswith('https://api.openalex.org/works?'):
                raise ValueError('Bundled research snapshot is not attributed OpenAlex data')
            rows.append((topic['topic_id'], obs.period_year, obs.value, obs.source_url, MEASUREMENT, obs.retrieved_at))
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        if db.execute('SELECT 1 FROM trend_observations LIMIT 1').fetchone():
            return
        db.executemany('INSERT INTO trend_observations (topic_id, period_year, value, source_url, measurement, retrieved_at) VALUES (?, ?, ?, ?, ?, ?)', rows)
        db.execute("UPDATE trend_refresh_state SET last_success_at = ? WHERE id = 1", (snapshot['retrieved_at'],))


def start_signal_maintenance() -> threading.Event:
    stop = threading.Event()
    if os.getenv('AI_TREND_AUTO_REFRESH', '1').lower() in {'0', 'false', 'no'}:
        return stop

    def worker():
        while not stop.is_set():
            try:
                refresh_signal_evidence()
            except Exception:
                logger.exception('AI Trend Signal maintenance failed')
            stop.wait(INTERVAL_SECONDS)

    seed_research_cache()
    threading.Thread(target=worker, name='signal-evidence', daemon=True).start()
    return stop


if __name__ == '__main__':
    from src.environment import load_backend_environment
    load_backend_environment()
    logging.basicConfig(level=logging.INFO)
    initialize_database()
    seed_research_cache()
    print(json.dumps(refresh_signal_evidence(), indent=2))

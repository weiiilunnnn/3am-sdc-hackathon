"""SQLite storage shared by profile and trend services."""

from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator


def database_path() -> Path:
    configured = os.getenv("APP_DB_PATH")
    if configured:
        return Path(configured)
    return Path(__file__).resolve().parents[1] / "data" / "future_ready.sqlite3"


@contextmanager
def connection() -> Iterator[sqlite3.Connection]:
    path = database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def initialize_database() -> None:
    with connection() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS profiles (
                id TEXT PRIMARY KEY,
                payload TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS career_analysis_jobs (
                evidence_key TEXT PRIMARY KEY,
                ticket TEXT NOT NULL UNIQUE,
                endpoint TEXT NOT NULL,
                remote_id TEXT,
                status TEXT NOT NULL,
                created_at REAL NOT NULL,
                expires_at REAL NOT NULL,
                poll_after REAL NOT NULL,
                error_code TEXT,
                result_json TEXT
            );

            CREATE TABLE IF NOT EXISTS trend_refresh_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                last_attempt_at TEXT,
                last_success_at TEXT,
                last_status TEXT NOT NULL DEFAULT 'never',
                last_error TEXT
            );

            CREATE TABLE IF NOT EXISTS trend_observations (
                topic_id TEXT NOT NULL,
                period_year INTEGER NOT NULL,
                value INTEGER NOT NULL CHECK (value >= 0),
                source_url TEXT NOT NULL,
                measurement TEXT NOT NULL,
                retrieved_at TEXT NOT NULL,
                PRIMARY KEY (topic_id, period_year)
            );

            CREATE TABLE IF NOT EXISTS employment_snapshots (
                source_id TEXT PRIMARY KEY,
                payload TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS employment_refresh_state (
                source_id TEXT PRIMARY KEY,
                last_attempt_at TEXT,
                last_success_at TEXT,
                last_status TEXT NOT NULL DEFAULT 'never',
                last_error TEXT
            );


            CREATE TABLE IF NOT EXISTS employment_snapshot_history (
                source_id TEXT NOT NULL,
                retrieved_at TEXT NOT NULL,
                payload TEXT NOT NULL,
                PRIMARY KEY (source_id, retrieved_at)
            );

            CREATE TABLE IF NOT EXISTS signal_documents (
                source_id TEXT NOT NULL,
                document_id TEXT NOT NULL,
                content_hash TEXT NOT NULL,
                payload TEXT NOT NULL,
                first_seen_at TEXT NOT NULL,
                last_seen_at TEXT NOT NULL,
                PRIMARY KEY (source_id, document_id)
            );

            CREATE TABLE IF NOT EXISTS signal_extractions (
                source_id TEXT NOT NULL,
                document_id TEXT NOT NULL,
                content_hash TEXT NOT NULL,
                extraction_version TEXT NOT NULL,
                payload TEXT NOT NULL,
                processed_at TEXT NOT NULL,
                PRIMARY KEY (source_id, document_id, content_hash, extraction_version)
            );

            CREATE TABLE IF NOT EXISTS signal_findings (
                evidence_version TEXT NOT NULL,
                finding_id TEXT NOT NULL,
                context_id TEXT NOT NULL,
                payload TEXT NOT NULL,
                PRIMARY KEY (evidence_version, finding_id)
            );

            CREATE TABLE IF NOT EXISTS signal_processing_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                evidence_version TEXT,
                processed_at TEXT,
                last_error TEXT
            );

            CREATE TABLE IF NOT EXISTS signal_explanations (
                cache_key TEXT PRIMARY KEY,
                evidence_version TEXT NOT NULL,
                model TEXT NOT NULL,
                payload TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS signal_model_usage (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                requests INTEGER NOT NULL DEFAULT 0,
                tokens INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS signal_connection_extractions (
                source_id TEXT NOT NULL,
                document_id TEXT NOT NULL,
                content_hash TEXT NOT NULL,
                extraction_version TEXT NOT NULL,
                payload TEXT NOT NULL,
                processed_at TEXT NOT NULL,
                PRIMARY KEY (source_id, document_id, content_hash, extraction_version)
            );

            CREATE TABLE IF NOT EXISTS signal_connections (
                evidence_version TEXT NOT NULL,
                connection_id TEXT NOT NULL,
                current_skill_id TEXT NOT NULL,
                payload TEXT NOT NULL,
                PRIMARY KEY (evidence_version, connection_id)
            );

            CREATE TABLE IF NOT EXISTS signal_connection_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                evidence_version TEXT,
                processed_at TEXT,
                last_error TEXT
            );

            CREATE TABLE IF NOT EXISTS signal_connection_explanations (
                cache_key TEXT PRIMARY KEY,
                evidence_version TEXT NOT NULL,
                model TEXT NOT NULL,
                payload TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS signal_model_extractions (
                cache_key TEXT PRIMARY KEY,
                source_id TEXT NOT NULL,
                document_id TEXT NOT NULL,
                content_hash TEXT NOT NULL,
                extraction_version TEXT NOT NULL,
                model TEXT NOT NULL,
                payload TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS signal_connection_reviews (
                cache_key TEXT PRIMARY KEY,
                connection_id TEXT NOT NULL,
                evidence_version TEXT NOT NULL,
                status TEXT NOT NULL,
                payload TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS signal_profile_guidance (
                cache_key TEXT PRIMARY KEY,
                evidence_version TEXT NOT NULL,
                status TEXT NOT NULL,
                payload TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS signal_discovery_jobs (
                job_key TEXT PRIMARY KEY,
                skill_id TEXT NOT NULL,
                skill_name TEXT NOT NULL,
                role_context TEXT,
                evidence_version TEXT NOT NULL,
                status TEXT NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS dosm_snapshot (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                payload TEXT NOT NULL,
                retrieved_at TEXT NOT NULL
            );"""
        )
        db.execute(
            "INSERT OR IGNORE INTO trend_refresh_state (id, last_status) VALUES (1, 'never')"
        )
        db.execute("INSERT OR IGNORE INTO signal_processing_state (id) VALUES (1)")
        db.execute("INSERT OR IGNORE INTO signal_model_usage (id) VALUES (1)")
        db.execute("INSERT OR IGNORE INTO signal_connection_state (id) VALUES (1)")
        # Additive migration: preserve prior Career AI attempts in the same table.
        columns = {row[1] for row in db.execute("PRAGMA table_info(career_analysis_jobs)")}
        if "history_json" not in columns:
            db.execute("ALTER TABLE career_analysis_jobs ADD COLUMN history_json TEXT NOT NULL DEFAULT '[]'")

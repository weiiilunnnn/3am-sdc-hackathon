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

            CREATE TABLE IF NOT EXISTS employer_departments (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE COLLATE NOCASE,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS employer_member_departments (
                member_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
                department_id TEXT NOT NULL REFERENCES employer_departments(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS employer_department_skill_targets (
                department_id TEXT NOT NULL REFERENCES employer_departments(id) ON DELETE CASCADE,
                skill_id TEXT NOT NULL,
                PRIMARY KEY (department_id, skill_id)
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
            """
        )
        db.execute(
            "INSERT OR IGNORE INTO trend_refresh_state (id, last_status) VALUES (1, 'never')"
        )

"""Shared bounded RunPod usage accounting for operator-triggered signal jobs."""

from __future__ import annotations

import os
from math import ceil

from src.services.storage import connection, initialize_database


def reserve_budget(serialized: str, max_output_tokens: int) -> tuple[str, int]:
    reservation = ceil(len(serialized) / 3) + max_output_tokens
    try:
        request_limit = max(0, int(os.getenv("EVIDENCE_LLM_REQUEST_BUDGET", "0")))
        token_limit = max(0, int(os.getenv("EVIDENCE_LLM_TOKEN_BUDGET", "0")))
    except ValueError:
        return "invalid_budget", 0
    initialize_database()
    with connection() as db:
        db.execute("BEGIN IMMEDIATE")
        usage = db.execute("SELECT requests, tokens FROM signal_model_usage WHERE id = 1").fetchone()
        if usage["requests"] >= request_limit or usage["tokens"] + reservation > token_limit:
            return "budget_exhausted", 0
        db.execute("UPDATE signal_model_usage SET requests = requests + 1, tokens = tokens + ? WHERE id = 1",
                   (reservation,))
    return "reserved", reservation


def reconcile_budget(reported: object, reservation: int) -> None:
    if isinstance(reported, dict) and isinstance(reported.get("total_tokens"), int):
        with connection() as db:
            db.execute("UPDATE signal_model_usage SET tokens = MAX(0, tokens + ?) WHERE id = 1",
                       (reported["total_tokens"] - reservation,))

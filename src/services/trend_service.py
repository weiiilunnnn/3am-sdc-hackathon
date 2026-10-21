"""Trend aggregation, controlled refresh, persistence, and profile relevance."""

from __future__ import annotations

from datetime import datetime, timezone
from math import ceil
from typing import Any

from src.data.trend_topics import LIMITATIONS, MEASUREMENT, OPENALEX_SOURCE, TREND_TOPICS
from src.models.trends import (
    ProfileRelevance,
    SkillRelevance,
    TopicRelevance,
    TrendChange,
    TrendDashboard,
    TrendObservation,
    TrendSourceInfo,
    TrendTopicSnapshot,
)
from src.services.profile_service import get_profile
from src.services.sources.base import SourceAdapterError, TrendSource
from src.services.sources.openalex import OpenAlexSource
from src.services.storage import connection, initialize_database

REFRESH_COOLDOWN_SECONDS = 60 * 60
MIN_COMPARABLE_COUNT = 10
HISTORY_YEARS = 5

# These mappings are explanatory links, not career recommendations.
SKILL_TOPIC_MAP: dict[str, dict[str, str]] = {
    "local:machine-learning": {
        "llms": "Machine learning methods are used in research on large language models.",
        "computer_vision": "Computer vision is a major machine-learning research area.",
        "responsible_ai": "Responsible AI research studies the safe and accountable use of AI methods.",
    },
    "local:python-programming": {
        "ai_agents": "Python is one implementation skill used in AI-agent software work.",
        "rag": "Python is commonly used to build retrieval and generation pipelines.",
    },
    "local:search-databases": {
        "rag": "Database search is conceptually related to retrieval systems used in RAG.",
    },
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _empty_change(explanation: str) -> TrendChange:
    return TrendChange(
        status="insufficient_data",
        absolute_change=None,
        percentage_change=None,
        compared_years=None,
        explanation=explanation,
    )


def calculate_change(observations: list[dict[str, Any]]) -> TrendChange:
    """Compare only adjacent complete years and avoid tiny or zero baselines."""
    ordered = sorted(observations, key=lambda item: item["period_year"])
    if len(ordered) < 2:
        return _empty_change("At least two observed periods are required for a comparison.")

    previous, latest = ordered[-2], ordered[-1]
    if latest["period_year"] - previous["period_year"] != 1:
        return _empty_change("The latest observations are not adjacent years; change was not calculated.")
    if previous["value"] == 0 and latest["value"] >= MIN_COMPARABLE_COUNT:
        return TrendChange(
            status="available",
            absolute_change=latest["value"],
            percentage_change=None,
            compared_years=[previous["period_year"], latest["period_year"]],
            explanation=(
                "Absolute change is shown, but percentage change is undefined because the previous "
                "period is zero. Counts describe research activity, not employer demand."
            ),
        )
    if previous["value"] < MIN_COMPARABLE_COUNT or latest["value"] < MIN_COMPARABLE_COUNT:
        return _empty_change(
            f"Both periods need at least {MIN_COMPARABLE_COUNT} matching records to avoid a tiny-sample signal."
        )

    absolute_change = latest["value"] - previous["value"]
    percentage_change = (
        None
        if previous["value"] == 0
        else round((absolute_change / previous["value"]) * 100, 2)
    )
    explanation = "Change in research-activity counts only; this does not measure employer demand."
    if percentage_change is None:
        explanation += " Percentage change is unavailable because the previous period is zero."
    return TrendChange(
        status="available",
        absolute_change=absolute_change,
        percentage_change=percentage_change,
        compared_years=[previous["period_year"], latest["period_year"]],
        explanation=explanation,
    )


def get_source_metadata() -> TrendSourceInfo:
    return TrendSourceInfo(**OPENALEX_SOURCE)


def get_topic_metadata() -> list[dict[str, str]]:
    return [
        {
            "topic_id": topic["id"],
            "label": topic["label"],
            "query": topic["query"],
            "definition": topic["definition"],
            "measurement": MEASUREMENT,
            "limitations": LIMITATIONS,
            "source_name": OPENALEX_SOURCE["name"],
            "source_url": OPENALEX_SOURCE["url"],
        }
        for topic in TREND_TOPICS
    ]


def _state() -> dict[str, Any]:
    initialize_database()
    with connection() as db:
        row = db.execute("SELECT * FROM trend_refresh_state WHERE id = 1").fetchone()
    return dict(row) if row else {
        "last_attempt_at": None,
        "last_success_at": None,
        "last_status": "never",
        "last_error": None,
    }


def _real_topics() -> list[TrendTopicSnapshot]:
    initialize_database()
    with connection() as db:
        rows = db.execute(
            "SELECT topic_id, period_year, value, source_url, retrieved_at "
            "FROM trend_observations ORDER BY topic_id, period_year"
        ).fetchall()

    grouped: dict[str, list[dict[str, Any]]] = {topic["id"]: [] for topic in TREND_TOPICS}
    for row in rows:
        grouped.setdefault(row["topic_id"], []).append(
            {
                "period_year": row["period_year"],
                "value": row["value"],
                "source_url": row["source_url"],
                "retrieved_at": row["retrieved_at"],
            }
        )

    result = []
    end_year = datetime.now(timezone.utc).year - 1
    start_year = max(2021, end_year - HISTORY_YEARS + 1)
    for topic in TREND_TOPICS:
        raw = grouped.get(topic["id"], [])
        observations = [
            TrendObservation(
                period_year=item["period_year"],
                value=item["value"],
                period_label=str(item["period_year"]),
                source_url=item["source_url"],
                retrieved_at=item["retrieved_at"],
                data_mode="real",
            )
            for item in raw
        ]
        change = calculate_change(raw)
        result.append(
            TrendTopicSnapshot(
                topic_id=topic["id"],
                label=topic["label"],
                definition=topic["definition"],
                measurement=MEASUREMENT,
                limitations=LIMITATIONS,
                source_name=OPENALEX_SOURCE["name"],
                source_url=(
                    raw[-1]["source_url"]
                    if raw
                    else OpenAlexSource.build_query_url(topic, start_year, end_year)
                ),
                observations=observations,
                change=change,
                status="available" if observations else "insufficient_data",
            )
        )
    return result


def get_dashboard(
    refresh_status: str | None = None,
    error_message: str | None = None,
    cache_fallback: bool = False,
) -> TrendDashboard:
    state = _state()
    topics = _real_topics()
    has_cache = any(topic.observations for topic in topics)
    last_attempt = _parse_timestamp(state["last_attempt_at"])
    cooldown_seconds = 0
    if last_attempt:
        remaining = REFRESH_COOLDOWN_SECONDS - (
            datetime.now(timezone.utc) - last_attempt
        ).total_seconds()
        cooldown_seconds = max(0, ceil(remaining))
    notice = (
        "Counts describe OpenAlex research activity, not job openings, hiring, or future employment."
    )
    if not has_cache:
        notice += " No live observations are cached yet; use Refresh to request them."
    return TrendDashboard(
        mode="real",
        topics=topics,
        last_successful_refresh=state["last_success_at"],
        last_attempt_at=state["last_attempt_at"],
        refresh_status=refresh_status or state["last_status"],
        cooldown_seconds=cooldown_seconds,
        cache_fallback=cache_fallback,
        error_message=error_message or state["last_error"],
        notice=notice,
    )


def refresh_trends(source: TrendSource | None = None) -> TrendDashboard:
    """Fetch all topics explicitly; persist only an all-topic successful refresh."""
    initialize_database()
    source = source or OpenAlexSource()
    now = datetime.now(timezone.utc)
    now_text = now.isoformat(timespec="seconds").replace("+00:00", "Z")

    cooldown_remaining = 0
    with connection() as db:
        db.execute("BEGIN IMMEDIATE")
        state = db.execute("SELECT * FROM trend_refresh_state WHERE id = 1").fetchone()
        last_attempt = _parse_timestamp(state["last_attempt_at"] if state else None)
        if last_attempt:
            elapsed = (now - last_attempt).total_seconds()
            if elapsed < REFRESH_COOLDOWN_SECONDS:
                cooldown_remaining = max(1, int(REFRESH_COOLDOWN_SECONDS - elapsed))
        if cooldown_remaining == 0:
            db.execute(
                "UPDATE trend_refresh_state SET last_attempt_at = ?, last_status = 'refreshing', last_error = NULL WHERE id = 1",
                (now_text,),
            )
    if cooldown_remaining:
        return get_dashboard(refresh_status="cooldown")

    current_year = now.year
    end_year = current_year - 1
    start_year = max(2021, end_year - HISTORY_YEARS + 1)

    try:
        staged = [
            source.fetch_topic(topic, start_year, end_year)
            for topic in TREND_TOPICS
        ]
        if {item.topic_id for item in staged} != {topic["id"] for topic in TREND_TOPICS}:
            raise SourceAdapterError("The source returned an incomplete topic set.")
        if any(item.source_id != source.source_id for item in staged):
            raise SourceAdapterError("The source returned an unexpected provider identifier.")
    except Exception as exc:
        message = str(exc)[:500] or "The live source could not be refreshed."
        with connection() as db:
            db.execute(
                "UPDATE trend_refresh_state SET last_status = 'failed', last_error = ? WHERE id = 1",
                (message,),
            )
        cached = any(topic.observations for topic in _real_topics())
        return get_dashboard(
            refresh_status="failed",
            error_message=message,
            cache_fallback=cached,
        )

    with connection() as db:
        for result in staged:
            db.execute(
                "DELETE FROM trend_observations WHERE topic_id = ? AND period_year BETWEEN ? AND ?",
                (result.topic_id, start_year, end_year),
            )
            for observation in result.observations:
                db.execute(
                    """
                    INSERT INTO trend_observations
                        (topic_id, period_year, value, source_url, measurement, retrieved_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(topic_id, period_year) DO UPDATE SET
                        value = excluded.value,
                        source_url = excluded.source_url,
                        measurement = excluded.measurement,
                        retrieved_at = excluded.retrieved_at
                    """,
                    (
                        result.topic_id,
                        observation.period_year,
                        observation.value,
                        result.query_url,
                        result.measurement,
                        result.retrieved_at,
                    ),
                )
        db.execute(
            "UPDATE trend_refresh_state SET last_success_at = ?, last_status = 'success', last_error = NULL WHERE id = 1",
            (now_text,),
        )
    return get_dashboard(refresh_status="success")


def _synthetic_dashboard() -> TrendDashboard:
    retrieved = utc_now()
    values = {
        "llms": [(2021, 90), (2022, 130), (2023, 190), (2024, 260), (2025, 340)],
        "ai_agents": [(2021, 160), (2022, 135), (2023, 115), (2024, 90), (2025, 70)],
        "rag": [(2021, 80), (2022, 80), (2023, 80), (2024, 80), (2025, 80)],
        "computer_vision": [(2021, 45), (2022, 60), (2024, 78), (2025, 92)],
        "responsible_ai": [(2025, 4)],
    }
    topics = []
    for topic in TREND_TOPICS:
        raw = [{"period_year": year, "value": value} for year, value in values[topic["id"]]]
        observations = [
            TrendObservation(
                period_year=item["period_year"],
                value=item["value"],
                period_label=str(item["period_year"]),
                source_url=None,
                retrieved_at=retrieved,
                data_mode="synthetic",
            )
            for item in raw
        ]
        topics.append(
            TrendTopicSnapshot(
                topic_id=topic["id"],
                label=topic["label"],
                definition=topic["definition"],
                measurement="Synthetic fixture counts for interface and calculation testing.",
                limitations="Synthetic demonstration only; not observed research data or job-market evidence.",
                source_name="Synthetic demonstration data",
                source_url=None,
                observations=observations,
                change=calculate_change(raw),
                status="available" if observations else "insufficient_data",
            )
        )
    return TrendDashboard(
        mode="synthetic",
        topics=topics,
        last_successful_refresh=None,
        last_attempt_at=None,
        refresh_status="demo",
        cooldown_seconds=REFRESH_COOLDOWN_SECONDS,
        notice="Synthetic demonstration only. These values are not real OpenAlex observations or employment statistics.",
    )


def get_history(topic_id: str | None = None) -> list[dict[str, Any]]:
    topics = _real_topics()
    if topic_id is not None:
        topics = [topic for topic in topics if topic.topic_id == topic_id]
    return [
        {
            "topic_id": topic.topic_id,
            "label": topic.label,
            "observations": [item.model_dump(mode="json") for item in topic.observations],
        }
        for topic in topics
    ]


def get_profile_relevance(profile_id: str) -> ProfileRelevance | None:
    profile = get_profile(profile_id)
    if profile is None:
        return None

    dashboard = get_dashboard()
    topics_by_id = {topic.topic_id: topic for topic in dashboard.topics}
    skills = []
    for skill in profile.skills:
        topic_map = SKILL_TOPIC_MAP.get(skill.skill_id or "", {})
        if not topic_map:
            skills.append(
                SkillRelevance(
                    skill_id=skill.skill_id,
                    skill_name=skill.display_name,
                    status="no_available_signal",
                    explanation="This skill is not covered by the current explicit skill-to-topic map.",
                    topics=[],
                )
            )
            continue

        relevant_topics = []
        for topic_id, explanation in topic_map.items():
            topic = topics_by_id[topic_id]
            latest_year = topic.observations[-1].period_year if topic.observations else None
            relevant_topics.append(
                TopicRelevance(
                    topic_id=topic_id,
                    label=topic.label,
                    explanation=explanation,
                    signal_available=latest_year is not None,
                    latest_period_year=latest_year,
                )
            )
        has_signal = any(item.signal_available for item in relevant_topics)
        skills.append(
            SkillRelevance(
                skill_id=skill.skill_id,
                skill_name=skill.display_name,
                status="matched" if has_signal else "no_available_signal",
                explanation=(
                    "The skill has explicit topic mappings, but no live observations are currently cached."
                    if not has_signal
                    else "These topic links are transparent relevance rules, not ranked career recommendations."
                ),
                topics=relevant_topics,
            )
        )
    return ProfileRelevance(
        profile_id=profile_id,
        skills=skills,
        notice="Topic links are explicit prototype rules. They do not establish job demand or predict career outcomes.",
    )


def get_demo_dashboard() -> TrendDashboard:
    return _synthetic_dashboard()

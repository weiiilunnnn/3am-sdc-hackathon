"""Trend source and dashboard response schemas."""

from typing import Literal

from pydantic import BaseModel


class TrendObservation(BaseModel):
    period_year: int
    value: int
    period_label: str
    source_url: str | None
    retrieved_at: str
    data_mode: Literal["real", "synthetic"]


class TrendChange(BaseModel):
    status: Literal["available", "insufficient_data"]
    absolute_change: int | None
    percentage_change: float | None
    compared_years: list[int] | None
    explanation: str


class TrendTopicSnapshot(BaseModel):
    topic_id: str
    label: str
    definition: str
    measurement: str
    limitations: str
    source_name: str
    source_url: str | None
    observations: list[TrendObservation]
    change: TrendChange
    status: Literal["available", "insufficient_data"]


class TrendDashboard(BaseModel):
    mode: Literal["real", "synthetic"]
    topics: list[TrendTopicSnapshot]
    last_successful_refresh: str | None
    last_attempt_at: str | None
    refresh_status: Literal["never", "refreshing", "success", "failed", "cooldown", "demo"]
    cooldown_seconds: int
    cache_fallback: bool = False
    error_message: str | None = None
    notice: str


class TrendSourceInfo(BaseModel):
    id: str
    name: str
    url: str
    documentation_url: str
    authentication: str
    license: str
    license_url: str
    source_type: str


class TopicRelevance(BaseModel):
    topic_id: str
    label: str
    explanation: str
    signal_available: bool
    latest_period_year: int | None


class SkillRelevance(BaseModel):
    skill_id: str | None
    skill_name: str
    status: Literal["matched", "no_available_signal"]
    explanation: str
    topics: list[TopicRelevance]


class ProfileRelevance(BaseModel):
    profile_id: str
    skills: list[SkillRelevance]
    notice: str

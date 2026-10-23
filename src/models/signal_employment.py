"""Response contracts for the separate employment-posting snapshot."""

from typing import Literal

from pydantic import BaseModel


class SkillMention(BaseModel):
    skill_id: str
    label: str
    terms: list[str]
    fields: list[str]
    excerpt: str | None = None
    excerpt_field: str | None = None


class EmploymentJob(BaseModel):
    source_job_id: str
    source_id: str = "remoteok"
    title: str
    company: str
    location: str | None
    source_url: str
    source_date: str
    source_date_kind: str = "published"
    published_at: str
    retrieved_at: str
    tags: list[str]
    skill_mentions: list[SkillMention]
    topic_ids: list[str]
    evidence_text: str = ""
    expires_at: str | None = None
    eligible_countries: list[str] = []


class SkillCount(BaseModel):
    skill_id: str
    label: str
    posting_count: int
    share_percent: float


class EmploymentDashboard(BaseModel):
    mode: Literal["real"] = "real"
    source: dict[str, str | int]
    jobs: list[EmploymentJob]
    skill_counts: list[SkillCount]
    topic_counts: dict[str, int]
    posting_count: int
    employer_count: int
    location_labels: list[str]
    unknown_location_count: int
    published_from: str | None
    published_to: str | None
    source_feed_updated_at: str | None
    received_records: int
    excluded_records: int
    last_successful_refresh: str | None
    last_attempt_at: str | None
    refresh_status: Literal["never", "refreshing", "success", "failed", "cooldown"]
    cooldown_seconds: int
    cache_fallback: bool
    error_message: str | None

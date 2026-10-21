"""Provider-independent contract for trend sources."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


class SourceAdapterError(RuntimeError):
    """Raised when a provider cannot return validated observations."""


@dataclass(frozen=True)
class Observation:
    period_year: int
    value: int


@dataclass(frozen=True)
class SourceResult:
    source_id: str
    topic_id: str
    query_url: str
    measurement: str
    retrieved_at: str
    observations: tuple[Observation, ...]


class TrendSource(Protocol):
    source_id: str

    def fetch_topic(self, topic: dict, start_year: int, end_year: int) -> SourceResult:
        """Retrieve, validate, and normalize one topic's observations."""

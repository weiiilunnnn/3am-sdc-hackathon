"""Independent contract for employment feed providers."""

from dataclasses import dataclass
from typing import Protocol

from src.models.employment import EmploymentJob


@dataclass(frozen=True)
class EmploymentResult:
    source_id: str
    retrieved_at: str
    feed_updated_at: str | None
    jobs: tuple[EmploymentJob, ...]
    received_records: int
    excluded_records: int


class EmploymentSource(Protocol):
    def fetch_snapshot(self) -> EmploymentResult:
        """Return validated, deduplicated postings and collection metadata."""

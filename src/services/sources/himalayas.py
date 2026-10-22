"""Bounded, attributed Himalayas cursor-feed adapter."""

from __future__ import annotations

import json
import os
import html
from html.parser import HTMLParser
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen

from src.data.himalayas_source import HIMALAYAS_SOURCE, SOURCE_ID
from src.models.employment import EmploymentJob
from src.services.sources.base import SourceAdapterError
from src.services.sources.employment_base import EmploymentResult
from src.services.sources.remoteok import extract_mentions, plain_text

MAX_PAGES = 30
PAGE_SIZE = 20
MAX_BYTES = 2 * 1024 * 1024


class _Blocks(HTMLParser):
    """Keep job-list and paragraph boundaries so evidence does not join unrelated tasks."""

    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
        self.ignored = 0

    def handle_starttag(self, tag: str, attrs: list) -> None:
        if tag in {"script", "style"}:
            self.ignored += 1
        elif tag in {"p", "li", "div", "h1", "h2", "h3", "h4", "br"}:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style"}:
            self.ignored = max(0, self.ignored - 1)
        elif tag in {"p", "li", "div", "h1", "h2", "h3", "h4"}:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self.ignored:
            self.parts.append(data)


def description_text(value: object) -> str:
    if not isinstance(value, str):
        return ""
    parser = _Blocks()
    parser.feed(value[:100_000])
    lines = [" ".join(html.unescape(line).split()) for line in "".join(parser.parts).splitlines()]
    return "\n".join(line for line in lines if line)[:8_000]


def _date(value: object) -> str | None:
    try:
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            return None
        return datetime.fromtimestamp(value, timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    except (ValueError, OverflowError, OSError):
        return None


class HimalayasSource:
    timeout_seconds = 20

    @staticmethod
    def parse_page(payload: object, retrieved_at: str) -> tuple[list[EmploymentJob], str | None, int]:
        if not isinstance(payload, dict) or not isinstance(payload.get("jobs"), list) or len(payload["jobs"]) > PAGE_SIZE:
            raise SourceAdapterError("Himalayas returned an incompatible page.")
        jobs = []
        received = len(payload["jobs"])
        for raw in payload["jobs"]:
            if not isinstance(raw, dict):
                continue
            guid = raw.get("guid")
            parsed = urlparse(guid) if isinstance(guid, str) else None
            if not parsed or parsed.scheme != "https" or parsed.netloc.casefold() != "himalayas.app" or not parsed.path.startswith("/companies/"):
                continue
            title = plain_text(raw.get("title"), 220)
            company = plain_text(raw.get("companyName"), 180)
            published = _date(raw.get("pubDate"))
            expires = _date(raw.get("expiryDate"))
            if not title or not company or not published or not expires or expires <= retrieved_at:
                continue
            if published > retrieved_at:
                continue
            description = description_text(raw.get("description"))
            if len(description) < 200:
                continue
            countries = [str(value)[:80] for value in raw.get("locationRestrictions", []) if isinstance(value, str)] if isinstance(raw.get("locationRestrictions"), list) else []
            categories = [str(value)[:80] for value in raw.get("categories", []) if isinstance(value, str)] if isinstance(raw.get("categories"), list) else []
            mentions, topics = extract_mentions({"title": title, "tags": " ".join(categories), "description": description})
            jobs.append(EmploymentJob(source_job_id=guid, source_id=SOURCE_ID, title=title, company=company,
                                      location=", ".join(countries[:4]) or None, source_url=guid,
                                      source_date=str(raw["pubDate"]), source_date_kind="last_updated", published_at=published,
                                      retrieved_at=retrieved_at, tags=categories[:40], skill_mentions=mentions,
                                      topic_ids=topics, evidence_text=description, expires_at=expires,
                                      eligible_countries=countries))
        cursor = payload.get("nextCursor")
        if cursor is not None and (not isinstance(cursor, str) or len(cursor) > 500):
            raise SourceAdapterError("Himalayas returned an invalid cursor.")
        return jobs, cursor, received

    def fetch_snapshot(self) -> EmploymentResult:
        now = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
        rows: dict[str, EmploymentJob] = {}
        seen_cursors = set()
        cursor = None
        received = 0
        pages = max(1, min(int(os.getenv("HIMALAYAS_MAX_PAGES", str(MAX_PAGES))), MAX_PAGES))
        for _ in range(pages):
            url = HIMALAYAS_SOURCE["url"] + "?limit=20" + ("&cursor=" + quote(cursor, safe="") if cursor else "")
            headers = {"Accept": "application/json", "User-Agent": "CareerOS/0.1 (attributed evidence cache)"}
            if os.getenv("HIMALAYAS_API_KEY"):
                headers["Authorization"] = f"Bearer {os.environ['HIMALAYAS_API_KEY']}"
            request = Request(url, headers=headers)
            try:
                with urlopen(request, timeout=self.timeout_seconds) as response:
                    content = response.read(MAX_BYTES + 1)
                if len(content) > MAX_BYTES:
                    raise SourceAdapterError("Himalayas page exceeded the size limit.")
                payload = json.loads(content)
            except HTTPError as exc:
                raise SourceAdapterError(f"Himalayas returned HTTP {exc.code}.") from exc
            except (URLError, TimeoutError, OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise SourceAdapterError("Himalayas request failed.") from exc
            jobs, next_cursor, count = self.parse_page(payload, now)
            received += count
            for job in jobs:
                rows[job.source_job_id] = job
            if not next_cursor or next_cursor in seen_cursors:
                break
            seen_cursors.add(next_cursor)
            cursor = next_cursor
        if not rows:
            raise SourceAdapterError("Himalayas returned no valid live postings.")
        return EmploymentResult(SOURCE_ID, now, None, tuple(rows.values()), received, received - len(rows))

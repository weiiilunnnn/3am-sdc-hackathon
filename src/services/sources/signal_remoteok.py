"""Bounded Remote OK public-feed adapter; no raw HTML is stored or rendered."""

from __future__ import annotations

import html
import json
import re
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from http.client import HTTPException
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from src.data.signal_employment_source import REMOTEOK_SOURCE, SAMPLE_LIMIT, SKILL_PHRASES, SOURCE_ID, TOPIC_PHRASES
from src.models.signal_employment import EmploymentJob, SkillMention
from src.services.sources.base import SourceAdapterError
from src.services.sources.employment_base import EmploymentResult

MAX_BYTES = 3 * 1024 * 1024
MAX_FEED_ITEMS = 1000


class _Text(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
        self.ignored = 0

    def handle_starttag(self, tag: str, attrs: list) -> None:
        if tag in {"script", "style"}:
            self.ignored += 1

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style"}:
            self.ignored = max(0, self.ignored - 1)

    def handle_data(self, data: str) -> None:
        if not self.ignored:
            self.parts.append(data)


def plain_text(value: object, limit: int) -> str:
    if not isinstance(value, str):
        return ""
    parser = _Text()
    parser.feed(value[:100_000])
    return " ".join(html.unescape(" ".join(parser.parts)).split())[:limit]


def _timestamp(value: object) -> str | None:
    try:
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            date = datetime.fromtimestamp(value, tz=timezone.utc)
        elif isinstance(value, str):
            date = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if date.tzinfo is None:
                return None
        else:
            return None
        return date.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    except (ValueError, TypeError, OverflowError, OSError):
        return None


def _contains(text: str, phrase: str) -> bool:
    return bool(re.search(r"(?<!\w)" + re.escape(phrase) + r"(?!\w)", text, flags=re.IGNORECASE))


def extract_mentions(fields: dict[str, str]) -> tuple[list[SkillMention], list[str]]:
    mentions = []
    for skill_id, label, phrases in SKILL_PHRASES:
        terms = sorted({phrase for phrase in phrases if any(_contains(text, phrase) for text in fields.values())})
        if terms:
            matched_fields = [name for name, text in fields.items() if any(_contains(text, term) for term in terms)]
            excerpt_field = matched_fields[0]
            text = fields[excerpt_field]
            match = next((found for term in terms if (found := re.search(r"(?<!\w)" + re.escape(term) + r"(?!\w)", text, re.I))), None)
            excerpt = None
            if match:
                start, end = max(0, match.start() - 85), min(len(text), match.end() + 85)
                excerpt = text[start:end].strip()
            mentions.append(SkillMention(
                skill_id=skill_id, label=label, terms=terms,
                fields=matched_fields, excerpt=excerpt, excerpt_field=excerpt_field,
            ))
    combined = " ".join(fields.values())
    topics = [topic for topic, phrases in TOPIC_PHRASES.items() if any(_contains(combined, phrase) for phrase in phrases)]
    return mentions, topics


class RemoteOKSource:
    timeout_seconds = 25

    @staticmethod
    def parse_payload(payload: object, retrieved_at: str) -> EmploymentResult:
        if not isinstance(payload, list) or len(payload) > MAX_FEED_ITEMS:
            raise SourceAdapterError("Remote OK returned an invalid or oversized feed.")
        retrieved = datetime.fromisoformat(retrieved_at.replace("Z", "+00:00"))
        jobs: dict[str, EmploymentJob] = {}
        urls: set[str] = set()
        received = 0
        feed_updated = None
        for raw in payload:
            if isinstance(raw, dict) and "legal" in raw:
                feed_updated = _timestamp(raw.get("last_updated"))
                continue
            received += 1
            if not isinstance(raw, dict):
                continue
            raw_id = raw.get("id")
            identifier = str(raw_id) if isinstance(raw_id, (str, int)) and not isinstance(raw_id, bool) else ""
            url = raw.get("url")
            title, company = plain_text(raw.get("position"), 220), plain_text(raw.get("company"), 180)
            published = _timestamp(raw.get("date"))
            source_date = str(raw.get("date"))
            if not published:
                published = _timestamp(raw.get("epoch"))
                source_date = str(raw.get("epoch"))
            if not re.fullmatch(r"[A-Za-z0-9_-]{1,80}", identifier) or not isinstance(url, str) or len(url) > 1500:
                continue
            parsed = urlparse(url)
            if parsed.scheme != "https" or parsed.netloc.casefold() not in {"remoteok.com", "www.remoteok.com"} or not parsed.path.startswith("/remote-jobs/"):
                continue
            if not title or not company or not published:
                continue
            if datetime.fromisoformat(published.replace("Z", "+00:00")) > retrieved + timedelta(days=1):
                continue
            if identifier in jobs or url.casefold() in urls:
                continue
            tags = sorted({plain_text(tag, 80) for tag in raw.get("tags", []) if isinstance(tag, str) and plain_text(tag, 80)})[:40] if isinstance(raw.get("tags"), list) else []
            evidence_text = plain_text(raw.get("description"), 4_000)
            mentions, topics = extract_mentions({
                "title": title,
                "tags": " ".join(tags),
                "description": evidence_text,
            })
            for mention in mentions:
                if mention.excerpt_field == "tags":
                    mention.excerpt = next((tag for tag in tags if any(_contains(tag, term) for term in mention.terms)), None)
            jobs[identifier] = EmploymentJob(
                source_job_id=identifier, title=title, company=company,
                location=plain_text(raw.get("location"), 250) or None,
                source_url=url, source_date=source_date,
                published_at=published, retrieved_at=retrieved_at, tags=tags,
                skill_mentions=mentions, topic_ids=topics, evidence_text=evidence_text,
            )
            urls.add(url.casefold())
        retained = tuple(sorted(jobs.values(), key=lambda item: (item.published_at, item.source_job_id), reverse=True)[:SAMPLE_LIMIT])
        if not retained:
            raise SourceAdapterError("Remote OK returned no valid dated postings. Existing cache was preserved.")
        return EmploymentResult(SOURCE_ID, retrieved_at, feed_updated, retained, received, received - len(retained))

    def fetch_snapshot(self) -> EmploymentResult:
        request = Request(REMOTEOK_SOURCE["url"], headers={
            "Accept": "application/json",
            "User-Agent": "3AM-SDC-Aiversecity/0.1 (attributed remote-posting snapshot)",
        })
        try:
            with urlopen(request, timeout=self.timeout_seconds) as response:
                data = response.read(MAX_BYTES + 1)
            if len(data) > MAX_BYTES:
                raise SourceAdapterError("Remote OK response exceeded the safe size limit.")
            payload = json.loads(data.decode("utf-8"))
        except HTTPError as exc:
            raise SourceAdapterError(f"Remote OK returned HTTP {exc.code}.") from exc
        except (URLError, TimeoutError, OSError, HTTPException) as exc:
            raise SourceAdapterError("Remote OK is unavailable or timed out.") from exc
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise SourceAdapterError("Remote OK returned invalid JSON.") from exc
        now = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
        return self.parse_payload(payload, now)

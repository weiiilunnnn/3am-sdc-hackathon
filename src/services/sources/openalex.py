"""OpenAlex Works API adapter using only the Python standard library."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from src.data.trend_topics import MEASUREMENT, OPENALEX_SOURCE
from src.services.sources.base import Observation, SourceAdapterError, SourceResult


class OpenAlexSource:
    source_id = OPENALEX_SOURCE["id"]
    timeout_seconds = 25

    @staticmethod
    def build_query_url(topic: dict, start_year: int, end_year: int) -> str:
        params = {
            "search": topic["query"],
            "filter": (
                f"from_publication_date:{start_year}-01-01,"
                f"to_publication_date:{end_year}-12-31"
            ),
            "group_by": "publication_year",
            "per_page": "100",
        }
        return f"{OPENALEX_SOURCE['url']}?{urlencode(params)}"

    @staticmethod
    def parse_groups(payload: object, start_year: int, end_year: int) -> tuple[Observation, ...]:
        if not isinstance(payload, dict):
            raise SourceAdapterError("OpenAlex returned a non-object response.")
        groups = payload.get("group_by")
        if not isinstance(groups, list):
            raise SourceAdapterError("OpenAlex response is missing its group_by array.")

        by_year: dict[int, int] = {}
        for item in groups:
            if not isinstance(item, dict):
                raise SourceAdapterError("OpenAlex returned a malformed year bucket.")
            try:
                year = int(item["key"])
                value = int(item["count"])
            except (KeyError, TypeError, ValueError) as exc:
                raise SourceAdapterError("OpenAlex year bucket is missing a valid key or count.") from exc
            if year < start_year or year > end_year or value < 0:
                raise SourceAdapterError("OpenAlex returned an out-of-range year or negative count.")
            if year in by_year and by_year[year] != value:
                raise SourceAdapterError("OpenAlex returned conflicting duplicate year buckets.")
            by_year[year] = value

        return tuple(Observation(period_year=year, value=by_year[year]) for year in sorted(by_year))

    def fetch_topic(self, topic: dict, start_year: int, end_year: int) -> SourceResult:
        query_url = self.build_query_url(topic, start_year, end_year)
        headers = {
            "Accept": "application/json",
            "User-Agent": "3AM-SDC-Hackathon/1.0 (OpenAlex research activity dashboard)",
        }
        api_key = os.getenv("OPENALEX_API_KEY")
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        request = Request(query_url, headers=headers, method="GET")
        try:
            with urlopen(request, timeout=self.timeout_seconds) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            raise SourceAdapterError(f"OpenAlex returned HTTP {exc.code}.") from exc
        except (URLError, TimeoutError) as exc:
            raise SourceAdapterError("OpenAlex is unavailable or the request timed out.") from exc
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise SourceAdapterError("OpenAlex returned invalid JSON.") from exc

        retrieved_at = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
        observations = self.parse_groups(payload, start_year, end_year)
        return SourceResult(
            source_id=self.source_id,
            topic_id=topic["id"],
            query_url=query_url,
            measurement=MEASUREMENT,
            retrieved_at=retrieved_at,
            observations=observations,
        )

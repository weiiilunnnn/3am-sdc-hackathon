import io
import json
import os
import tempfile
import unittest
from copy import deepcopy
from datetime import datetime, timezone
from unittest.mock import patch
from urllib.error import URLError

from src.services.employment_service import get_employment_dashboard, refresh_employment
from src.services.sources.base import SourceAdapterError
from src.services.sources.remoteok import MAX_BYTES, RemoteOKSource, extract_mentions, plain_text
from src.services.storage import connection


def feed():
    return [
        {"legal": "Synthetic test metadata", "last_updated": 1792530000},
        {"id": "test1", "position": "Synthetic Python &amp; LLM Engineer", "company": "Fictional Company",
         "date": "2026-10-20T09:00:00+00:00", "url": "https://remoteok.com/remote-jobs/test1",
         "location": "International remote (synthetic)", "tags": ["Python", "python"],
         "description": "<p>Python and large language models. SQL helpful.</p>"},
        {"id": "test2", "position": "Fictional Customer Support", "company": "Example Employer",
         "date": "2026-10-19T09:00:00Z", "url": "https://remoteok.com/remote-jobs/test2",
         "tags": [], "description": "Customer service and communication."},
    ]


class FakeSource:
    def fetch_snapshot(self):
        return RemoteOKSource.parse_payload(feed(), datetime.now(timezone.utc).isoformat())


class FailingSource:
    def fetch_snapshot(self):
        raise SourceAdapterError("Synthetic provider failure")


class EmploymentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.environment = patch.dict(os.environ, {"APP_DB_PATH": f"{self.temp.name}/employment.sqlite3"})
        self.environment.start()

    def tearDown(self):
        self.environment.stop()
        self.temp.cleanup()

    def test_normalization_mentions_dates_and_no_raw_description(self):
        result = RemoteOKSource.parse_payload(feed(), "2026-10-21T00:00:00Z")
        self.assertEqual(len(result.jobs), 2)
        job = result.jobs[0]
        self.assertEqual(job.title, "Synthetic Python & LLM Engineer")
        self.assertEqual(job.published_at, "2026-10-20T09:00:00Z")
        self.assertEqual(job.source_date, "2026-10-20T09:00:00+00:00")
        self.assertIn("llms", job.topic_ids)
        python = next(mention for mention in job.skill_mentions if mention.skill_id == "local:python-programming")
        self.assertEqual(python.fields, ["title", "tags", "description"])
        self.assertNotIn("description", job.model_dump())
        self.assertIsNone(result.jobs[1].location)

    def test_dedup_invalid_dates_and_external_urls_are_excluded(self):
        payload = feed()
        payload += [deepcopy(payload[1])]
        bad = deepcopy(payload[1]); bad["id"] = "bad"; bad["url"] = "https://untrusted.test/job"
        future = deepcopy(payload[1]); future["id"] = "future"; future["date"] = "2099-01-01T00:00:00Z"
        payload += [bad, future, {"id": "no-date"}]
        result = RemoteOKSource.parse_payload(payload, "2026-10-21T00:00:00Z")
        self.assertEqual(len(result.jobs), 2)
        self.assertEqual(result.received_records, 6)
        self.assertEqual(result.excluded_records, 4)

    def test_word_boundaries_do_not_turn_available_or_rag_into_ai_topics(self):
        mentions, topics = extract_mentions({"title": "Available operations rag collection"})
        self.assertEqual(mentions, [])
        self.assertEqual(topics, [])
        self.assertEqual(plain_text("<script>python</script><p>Fictional text</p>", 100), "Fictional text")

    def test_malformed_and_empty_payload_fail_explicitly(self):
        for payload in ({}, [], [{"legal": "test"}]):
            with self.assertRaises(SourceAdapterError):
                RemoteOKSource.parse_payload(payload, "2026-10-21T00:00:00Z")

    def test_sample_is_bounded_and_null_identifiers_rejected(self):
        payload = []
        for index in range(110):
            job = deepcopy(feed()[1])
            job.update(id=str(index), url=f"https://remoteok.com/remote-jobs/{index}")
            payload.append(job)
        invalid = deepcopy(payload[0])
        invalid.update(id=None, url="https://remoteok.com/remote-jobs/null")
        payload.append(invalid)
        result = RemoteOKSource.parse_payload(payload, "2026-10-21T00:00:00Z")
        self.assertEqual(len(result.jobs), 100)
        self.assertEqual(result.excluded_records, 11)

    def test_http_adapter_with_mocked_json_and_network_failure(self):
        with patch("src.services.sources.remoteok.urlopen", return_value=io.BytesIO(json.dumps(feed()).encode())) as network:
            result = RemoteOKSource().fetch_snapshot()
            self.assertEqual(len(result.jobs), 2)
            self.assertEqual(network.call_args[1]["timeout"], 25)
        with patch("src.services.sources.remoteok.urlopen", side_effect=URLError("offline")):
            with self.assertRaisesRegex(SourceAdapterError, "unavailable"):
                RemoteOKSource().fetch_snapshot()
        with patch("src.services.sources.remoteok.urlopen", return_value=io.BytesIO(b"not-json")):
            with self.assertRaisesRegex(SourceAdapterError, "JSON"):
                RemoteOKSource().fetch_snapshot()
        with patch("src.services.sources.remoteok.urlopen", return_value=io.BytesIO(b"x" * (MAX_BYTES + 1))):
            with self.assertRaisesRegex(SourceAdapterError, "size"):
                RemoteOKSource().fetch_snapshot()

    def test_snapshot_counts_and_cooldown(self):
        self.assertEqual(get_employment_dashboard().posting_count, 0)
        result = refresh_employment(FakeSource())
        self.assertEqual(result.refresh_status, "success")
        self.assertEqual(result.posting_count, 2)
        self.assertEqual(result.employer_count, 2)
        python = next(item for item in result.skill_counts if item.skill_id == "local:python-programming")
        self.assertEqual((python.posting_count, python.share_percent), (1, 50.0))
        machine_learning = next(item for item in result.skill_counts if item.skill_id == "local:machine-learning")
        self.assertEqual((machine_learning.posting_count, machine_learning.share_percent), (0, 0.0))
        self.assertEqual(result.topic_counts["llms"], 1)
        self.assertEqual(result.unknown_location_count, 1)
        self.assertEqual(refresh_employment(FailingSource()).refresh_status, "cooldown")

    def test_failure_preserves_valid_snapshot(self):
        previous = refresh_employment(FakeSource())
        with connection() as db:
            db.execute("UPDATE employment_refresh_state SET last_attempt_at = '2000-01-01T00:00:00Z'")
        failed = refresh_employment(FailingSource())
        self.assertEqual(failed.refresh_status, "failed")
        self.assertTrue(failed.cache_fallback)
        self.assertEqual(failed.jobs, previous.jobs)
        self.assertEqual(failed.last_successful_refresh, previous.last_successful_refresh)
        self.assertTrue(refresh_employment(FailingSource()).cache_fallback)


if __name__ == "__main__":
    unittest.main()

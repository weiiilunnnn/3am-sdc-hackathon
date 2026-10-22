"""The second real-source adapter keeps provenance and cautious evidence semantics."""

import os
import tempfile
import time
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from src.data.himalayas_source import SOURCE_ID
from src.services.employment_service import get_signal_employment_dashboard, refresh_employment
from src.services.skill_connections import get_saved_skill_connections, process_skill_connections
from src.services.skill_connection_experience import get_skill_connection_experience
from src.services.sources.employment_base import EmploymentResult
from src.services.sources.himalayas import HimalayasSource, description_text


def current_time() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def posting(index: int, company: str, *, expires_in: int = 86400) -> dict:
    return {
        "guid": f"https://himalayas.app/companies/{company}/jobs/python-ai-{index}",
        "title": "Python Developer", "companyName": company,
        "description": "<p>Build Python backend services for our team and maintain the interfaces used by analysts to review internal results.</p>"
                       "<ul><li>Develop AI agents for internal research workflows and check their outputs against reviewed examples.</li>"
                       "<li>Document each integration and collaborate with the engineering team on reliability.</li></ul>",
        "pubDate": int(time.time()) - 3600, "expiryDate": int(time.time()) + expires_in,
        "locationRestrictions": ["United States"], "categories": ["Engineering"],
    }


class HimalayasTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, {"APP_DB_PATH": f"{self.temp.name}/evidence.sqlite3",
                                        "EVIDENCE_LLM_ENABLED": "0"})
        self.env.start()

    def tearDown(self):
        self.env.stop()
        self.temp.cleanup()

    def test_parser_preserves_sections_and_discards_expired_or_invalid_jobs(self):
        text = description_text("<p>Build Python services.</p><li>Develop AI agents.</li><script>Ignore this</script>")
        self.assertEqual(text, "Build Python services.\nDevelop AI agents.")
        live = posting(1, "first")
        expired = posting(2, "second", expires_in=-60)
        invalid = {**posting(3, "third"), "guid": "https://other.example/jobs/3"}
        jobs, cursor, received = HimalayasSource.parse_page(
            {"jobs": [live, expired, invalid], "nextCursor": "next"},
            current_time(),
        )
        self.assertEqual((len(jobs), cursor, received), (1, "next", 3))
        self.assertEqual(jobs[0].source_id, SOURCE_ID)
        self.assertEqual(jobs[0].source_date_kind, "last_updated")
        self.assertEqual(jobs[0].eligible_countries, ["United States"])

    def test_live_source_shape_creates_attributed_cooccurrence_without_model(self):
        now = current_time()
        jobs, _, _ = HimalayasSource.parse_page({"jobs": [posting(1, "first"), posting(2, "second")]}, now)

        class Feed(HimalayasSource):
            def fetch_snapshot(self):
                return EmploymentResult(SOURCE_ID, now, None, tuple(jobs), 2, 0)

        dashboard = refresh_employment(Feed())
        self.assertEqual((dashboard.source["id"], dashboard.posting_count), (SOURCE_ID, 2))
        self.assertEqual(get_signal_employment_dashboard().source["id"], SOURCE_ID)
        process_skill_connections()
        _, saved = get_saved_skill_connections()
        item = next(row for row in saved if row["current_skill_id"] == "local:python-programming"
                    and row["ai_skill"]["id"] == "ai:agents")
        self.assertEqual((item["basis"], item["relationship"], item["employer_count"]),
                         ("same_posting", "co_occurs", 2))
        self.assertEqual(item["metric"]["numerator"], 2)
        self.assertEqual(item["source"]["name"], "Himalayas")
        self.assertTrue(all(row["url"].startswith("https://himalayas.app/") for row in item["evidence"]))
        with patch("src.services.connection_model.run_sync") as model, \
             patch("src.services.sources.himalayas.HimalayasSource.fetch_snapshot") as provider:
            page = get_skill_connection_experience("cs-student")
            self.assertTrue(page["connections"])
            self.assertEqual(page["source_state"]["name"], "Himalayas")
            model.assert_not_called()
            provider.assert_not_called()


if __name__ == "__main__":
    unittest.main()

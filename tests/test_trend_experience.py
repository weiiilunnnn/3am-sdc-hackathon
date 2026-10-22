"""The two-page signal view must never invent evidence for a demo profile."""

import os
import tempfile
import unittest
from unittest.mock import patch

from src.services.evidence_refresh import refresh_due_sources
from src.services.employment_service import refresh_employment
from src.services.trend_experience import get_trend_experience
from src.services.trend_service import refresh_trends
from test_employment import FakeSource as FakeEmploymentSource
from test_trends import FakeSource as FakeResearchSource


class TrendExperienceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.environment = patch.dict(os.environ, {"APP_DB_PATH": f"{self.temp.name}/signals.sqlite3"})
        self.environment.start()

    def tearDown(self):
        self.environment.stop()
        self.temp.cleanup()

    def test_profile_links_use_real_cache_and_withhold_unmeasured_change(self):
        empty = get_trend_experience()
        self.assertTrue(empty["profile"]["synthetic"])
        self.assertTrue(all(item["research_count"] is None for item in empty["signals"]))
        self.assertTrue(all(item["direction"] == "unavailable" for item in empty["signals"]))
        self.assertIsNone(next(item for item in empty["searchable_skills"] if item["name"] == "Python programming")["posting_mentions"])

        refresh_trends(FakeResearchSource())
        refresh_employment(FakeEmploymentSource())
        result = get_trend_experience()
        agents = next(item for item in result["signals"] if item["id"] == "ai_agents")
        self.assertIn("Your skill: Python programming", agents["relevance"])
        self.assertEqual(agents["research_count"], 60)
        self.assertEqual(agents["change_percent"], 50.0)
        self.assertEqual(result["source"]["posting_sample_size"], 2)
        self.assertEqual(next(item for item in result["searchable_skills"] if item["name"] == "Python programming")["posting_mentions"], 1)
        self.assertIn("cannot establish", result["method"])

    def test_profiles_change_relevance_and_invalid_profile_is_rejected(self):
        student = get_trend_experience("cs-student")
        administrator = get_trend_experience("admin-worker")
        self.assertNotEqual(student["profile"]["skills"], administrator["profile"]["skills"])
        self.assertNotEqual([item["relevance"] for item in student["signals"]],
                            [item["relevance"] for item in administrator["signals"]])
        self.assertIsNone(get_trend_experience("not-a-sample"))

    def test_background_check_respects_fresh_attempts(self):
        refresh_trends(FakeResearchSource())
        refresh_employment(FakeEmploymentSource())
        with patch("src.services.evidence_refresh.refresh_trends") as research, \
             patch("src.services.evidence_refresh.refresh_employment") as jobs, \
             patch("src.services.evidence_refresh.refresh_dosm") as dosm:
            refresh_due_sources()
        research.assert_not_called()
        jobs.assert_not_called()
        dosm.assert_called_once()

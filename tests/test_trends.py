import os
import tempfile
import unittest
from copy import deepcopy
from unittest.mock import patch

from src.data.sample_profiles import get_sample_profiles
from src.data.trend_topics import TREND_TOPICS
from src.models.profiles import ProfileInput
from src.services.profile_service import create_profile
from src.services.sources.base import Observation, SourceAdapterError, SourceResult
from src.services.sources.openalex import OpenAlexSource
from src.services.storage import connection, initialize_database
from src.services.trend_service import (
    calculate_change,
    get_dashboard,
    get_demo_dashboard,
    get_history,
    get_profile_relevance,
    refresh_trends,
)


def change_rows(rows: list[tuple[int, int]]) -> list[dict[str, int]]:
    return [{"period_year": year, "value": value} for year, value in rows]


class FakeSource:
    source_id = "openalex"

    def __init__(self, fail_at: int | None = None) -> None:
        self.calls = 0
        self.fail_at = fail_at

    def fetch_topic(self, topic: dict, start_year: int, end_year: int) -> SourceResult:
        self.calls += 1
        if self.fail_at == self.calls:
            raise SourceAdapterError("test source failure")
        return SourceResult(
            source_id=self.source_id,
            topic_id=topic["id"],
            query_url=f"https://api.openalex.org/works?search={topic['query']}",
            measurement="Test count of indexed records grouped by publication year.",
            retrieved_at="2026-10-21T00:00:00Z",
            observations=(
                Observation(period_year=2024, value=40),
                Observation(period_year=2025, value=60),
            ),
        )


class TrendTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.previous_db_path = os.environ.get("APP_DB_PATH")
        os.environ["APP_DB_PATH"] = os.path.join(self.temp_dir.name, "trends.sqlite3")
        initialize_database()

    def tearDown(self) -> None:
        if self.previous_db_path is None:
            os.environ.pop("APP_DB_PATH", None)
        else:
            os.environ["APP_DB_PATH"] = self.previous_db_path
        self.temp_dir.cleanup()

    def test_openalex_group_parser_sorts_and_deduplicates_identical_buckets(self) -> None:
        parsed = OpenAlexSource.parse_groups(
            {
                "group_by": [
                    {"key": "2025", "count": 30},
                    {"key": "2024", "count": 20},
                    {"key": "2025", "count": 30},
                ]
            },
            2021,
            2025,
        )
        self.assertEqual([(item.period_year, item.value) for item in parsed], [(2024, 20), (2025, 30)])

    def test_openalex_group_parser_rejects_conflicts_and_invalid_buckets(self) -> None:
        with self.assertRaises(SourceAdapterError):
            OpenAlexSource.parse_groups(
                {"group_by": [{"key": "2024", "count": 1}, {"key": "2024", "count": 2}]},
                2021,
                2025,
            )
        with self.assertRaises(SourceAdapterError):
            OpenAlexSource.parse_groups({"group_by": [{"key": "2030", "count": 1}]}, 2021, 2025)
        with self.assertRaises(SourceAdapterError):
            OpenAlexSource.parse_groups({"group_by": "not-an-array"}, 2021, 2025)

    def test_calculates_increase_decrease_and_stability(self) -> None:
        increase = calculate_change(change_rows([(2024, 50), (2025, 75)]))
        decrease = calculate_change(change_rows([(2024, 80), (2025, 40)]))
        stable = calculate_change(change_rows([(2024, 50), (2025, 50)]))
        self.assertEqual((increase.absolute_change, increase.percentage_change), (25, 50.0))
        self.assertEqual((decrease.absolute_change, decrease.percentage_change), (-40, -50.0))
        self.assertEqual((stable.absolute_change, stable.percentage_change), (0, 0.0))

    def test_zero_baseline_has_absolute_change_but_no_percentage(self) -> None:
        result = calculate_change(change_rows([(2024, 0), (2025, 20)]))
        self.assertEqual(result.status, "available")
        self.assertEqual(result.absolute_change, 20)
        self.assertIsNone(result.percentage_change)
        self.assertIn("undefined", result.explanation)

    def test_missing_period_and_tiny_sample_do_not_produce_change(self) -> None:
        missing = calculate_change(change_rows([(2022, 30), (2024, 45)]))
        tiny = calculate_change(change_rows([(2024, 4), (2025, 8)]))
        one_period = calculate_change(change_rows([(2025, 50)]))
        self.assertEqual(missing.status, "insufficient_data")
        self.assertIsNone(missing.absolute_change)
        self.assertEqual(tiny.status, "insufficient_data")
        self.assertIsNone(tiny.percentage_change)
        self.assertEqual(one_period.status, "insufficient_data")

    def test_refresh_caches_all_topics_and_obeys_cooldown(self) -> None:
        source = FakeSource()
        with patch("src.services.trend_service.REFRESH_COOLDOWN_SECONDS", 3600):
            result = refresh_trends(source)
            self.assertEqual(result.refresh_status, "success")
            self.assertEqual(source.calls, len(TREND_TOPICS))
            self.assertTrue(all(topic.observations for topic in result.topics))
            self.assertTrue(all(item.data_mode == "real" for topic in result.topics for item in topic.observations))
            self.assertEqual(result.topics[0].change.absolute_change, 20)

            second_source = FakeSource()
            cooled = refresh_trends(second_source)
            self.assertEqual(cooled.refresh_status, "cooldown")
            self.assertEqual(second_source.calls, 0)
            self.assertEqual(len(get_history()), len(TREND_TOPICS))

    def test_failed_refresh_preserves_last_real_cache(self) -> None:
        with patch("src.services.trend_service.REFRESH_COOLDOWN_SECONDS", 3600):
            initial = refresh_trends(FakeSource())
            previous_success = initial.last_successful_refresh
            previous_values = [
                [(item.period_year, item.value) for item in topic.observations]
                for topic in initial.topics
            ]
            with connection() as db:
                db.execute(
                    "UPDATE trend_refresh_state SET last_attempt_at = '2020-01-01T00:00:00Z' WHERE id = 1"
                )

            failed = refresh_trends(FakeSource(fail_at=3))
            self.assertEqual(failed.refresh_status, "failed")
            self.assertTrue(failed.cache_fallback)
            self.assertEqual(failed.error_message, "test source failure")
            self.assertEqual(failed.last_successful_refresh, previous_success)
            self.assertEqual(
                [
                    [(item.period_year, item.value) for item in topic.observations]
                    for topic in failed.topics
                ],
                previous_values,
            )

    def test_first_refresh_failure_has_no_fake_real_observations(self) -> None:
        failed = refresh_trends(FakeSource(fail_at=1))
        self.assertEqual(failed.mode, "real")
        self.assertEqual(failed.refresh_status, "failed")
        self.assertFalse(failed.cache_fallback)
        self.assertTrue(all(not topic.observations for topic in failed.topics))

    def test_demo_is_explicit_and_never_mixed_with_real_cache(self) -> None:
        demo = get_demo_dashboard()
        real = get_dashboard()
        self.assertEqual(demo.mode, "synthetic")
        self.assertEqual(demo.refresh_status, "demo")
        self.assertTrue(all(item.data_mode == "synthetic" for topic in demo.topics for item in topic.observations))
        self.assertEqual(real.mode, "real")
        self.assertTrue(all(item.data_mode == "real" for topic in real.topics for item in topic.observations))
        self.assertIn("Synthetic", demo.notice)

    def test_profile_relevance_uses_explicit_mapping_and_reports_unmapped_skill(self) -> None:
        sample = deepcopy(get_sample_profiles()[0])
        sample.pop("sample_id", None)
        sample.pop("label", None)
        sample["skills"] = [
            {"name": "Python programming", "skill_id": "local:python-programming", "proficiency": "beginner"},
            {"name": "Unmapped craft", "skill_id": None, "proficiency": "intermediate"},
        ]
        profile = create_profile(ProfileInput.model_validate(sample))
        relevance = get_profile_relevance(profile.id)
        self.assertEqual(relevance.skills[0].status, "no_available_signal")
        self.assertEqual(len(relevance.skills[0].topics), 2)
        self.assertEqual(relevance.skills[1].status, "no_available_signal")
        self.assertEqual(relevance.skills[1].topics, [])


if __name__ == "__main__":
    unittest.main()

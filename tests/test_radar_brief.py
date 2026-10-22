"""Checks that source comparisons and profile links remain evidence-grounded."""

import io
import os
import tempfile
import unittest
from urllib.parse import parse_qs, urlparse

from openpyxl import Workbook

from src.data.trend_topics import TREND_TOPICS
from src.services.dosm_service import parse_workbook
from src.services.radar_brief import get_brief
from src.services.sources.openalex import OpenAlexSource
from src.services.storage import connection, initialize_database


class RadarBriefTests(unittest.TestCase):
    def test_openalex_uses_exact_phrase(self):
        url = OpenAlexSource.build_query_url(TREND_TOPICS[0], 2021, 2025)
        self.assertEqual(parse_qs(urlparse(url).query)["search"], ['"large language model"'])

    def test_dosm_compares_same_quarter_shares_and_withholds_missing_baseline(self):
        workbook = Workbook()
        sheet = workbook.active
        # The parser expects the year row immediately above Occupation.
        sheet.cell(1, 2, "Table 2")
        sheet.cell(2, 2, "Occupation")
        sheet.cell(1, 11, 2025)
        sheet.cell(1, 15, 2026)
        sheet.cell(2, 11, "Q2")
        sheet.cell(2, 15, "Q2")
        sheet.cell(3, 2, "Jumlah")
        sheet.cell(3, 11, 100)
        sheet.cell(3, 15, 200)
        sheet.cell(4, 2, "Professionals")
        sheet.cell(4, 11, 60)
        sheet.cell(4, 15, 140)
        sheet.cell(5, 2, "Managers")
        sheet.cell(5, 11, 40)
        sheet.cell(5, 15, 50)
        sheet.cell(6, 2, "New group")
        sheet.cell(6, 11, "-")
        sheet.cell(6, 15, 10)
        sheet.cell(7, 2, "Source: DOSM")
        stream = io.BytesIO()
        workbook.save(stream)
        result = parse_workbook(stream.getvalue(), "https://www.dosm.gov.my/example.xlsx")
        self.assertEqual(result["latest_period"], "Q2 2026")
        self.assertEqual(result["groups"][0]["share_point_change"], 10.0)
        self.assertEqual(result["groups"][2]["direction"], "not_comparable")

    def test_empty_evidence_does_not_invent_direction_or_postings(self):
        with tempfile.TemporaryDirectory() as directory:
            previous = os.environ.get("APP_DB_PATH")
            os.environ["APP_DB_PATH"] = f"{directory}/radar.sqlite3"
            try:
                result = get_brief()
                self.assertEqual(len(result["cards"]), len(TREND_TOPICS))
                self.assertTrue(all(card["direction"] == "insufficient_data" for card in result["cards"]))
                self.assertTrue(all(card["posting_denominator"] == 0 for card in result["cards"]))
            finally:
                if previous is None:
                    os.environ.pop("APP_DB_PATH", None)
                else:
                    os.environ["APP_DB_PATH"] = previous

    def test_legacy_unquoted_openalex_cache_is_invalidated(self):
        with tempfile.TemporaryDirectory() as directory:
            previous = os.environ.get("APP_DB_PATH")
            os.environ["APP_DB_PATH"] = f"{directory}/radar.sqlite3"
            try:
                initialize_database()
                with connection() as db:
                    db.execute(
                        "INSERT INTO trend_observations (topic_id, period_year, value, source_url, measurement, retrieved_at) "
                        "VALUES ('llms', 2025, 123, 'https://api.openalex.org/works?search=large+language+model', 'old', '2026-01-01T00:00:00Z')"
                    )
                    db.execute("UPDATE trend_refresh_state SET last_attempt_at = '2026-01-01T00:00:00Z', last_status = 'success' WHERE id = 1")
                initialize_database()
                with connection() as db:
                    self.assertEqual(db.execute("SELECT count(*) FROM trend_observations").fetchone()[0], 0)
                    self.assertIsNone(db.execute("SELECT last_attempt_at FROM trend_refresh_state WHERE id = 1").fetchone()[0])
            finally:
                if previous is None:
                    os.environ.pop("APP_DB_PATH", None)
                else:
                    os.environ["APP_DB_PATH"] = previous

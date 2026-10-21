import io
import json
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError

from src.services.sources.base import SourceAdapterError
from src.services.sources.openalex import OpenAlexSource


class OpenAlexHttpTests(unittest.TestCase):
    def test_valid_mocked_response_and_query(self):
        payload = {"group_by": [{"key": "2024", "count": 20}, {"key": "2025", "count": 40}]}
        with patch("src.services.sources.openalex.urlopen", return_value=io.BytesIO(json.dumps(payload).encode())) as call:
            result = OpenAlexSource().fetch_topic({"id": "llms", "query": "large language model"}, 2024, 2025)
            self.assertEqual([item.value for item in result.observations], [20, 40])
            self.assertIn("group_by=publication_year", result.query_url)
            self.assertEqual(call.call_args[1]["timeout"], 25)

    def test_http_timeout_and_json_failures(self):
        for failure in (URLError("offline"), TimeoutError(), HTTPError("https://example.test", 429, "limited", {}, None)):
            with patch("src.services.sources.openalex.urlopen", side_effect=failure):
                with self.assertRaises(SourceAdapterError):
                    OpenAlexSource().fetch_topic({"id": "llms", "query": "test"}, 2024, 2025)
        with patch("src.services.sources.openalex.urlopen", return_value=io.BytesIO(b"bad json")):
            with self.assertRaisesRegex(SourceAdapterError, "JSON"):
                OpenAlexSource().fetch_topic({"id": "llms", "query": "test"}, 2024, 2025)

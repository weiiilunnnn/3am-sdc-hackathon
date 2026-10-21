"""In-process ASGI integration tests without an extra HTTP-client dependency."""

import asyncio
import json
import os
import tempfile
import unittest
from copy import deepcopy
from unittest.mock import patch

from src.main import app
from src.services.storage import connection, initialize_database


def request(method: str, path: str, payload: object = None) -> tuple[int, object]:
    async def run():
        messages = []
        body = b"" if payload is None else json.dumps(payload).encode()
        scope = {
            "type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1",
            "method": method, "scheme": "http", "path": path.split("?")[0],
            "raw_path": path.split("?")[0].encode(), "root_path": "",
            "query_string": path.partition("?")[2].encode(),
            "headers": [(b"content-type", b"application/json")], "client": ("test", 1),
            "server": ("test", 80), "state": {},
        }
        async def receive():
            return {"type": "http.request", "body": body, "more_body": False}
        async def send(message):
            messages.append(message)
        await app(scope, receive, send)
        status = next(message["status"] for message in messages if message["type"] == "http.response.start")
        data = b"".join(message.get("body", b"") for message in messages if message["type"] == "http.response.body")
        return status, json.loads(data)
    return asyncio.run(run())


class ApiIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.environment = patch.dict(os.environ, {"APP_DB_PATH": f"{self.temp.name}/api.sqlite3"})
        self.environment.start()
        initialize_database()

    def tearDown(self):
        self.environment.stop()
        self.temp.cleanup()

    def draft(self):
        status, data = request("GET", "/api/profiles/samples")
        self.assertEqual(status, 200)
        draft = deepcopy(data["profiles"][0])
        for key in ("label", "sample_id", "taxonomy"):
            draft.pop(key, None)
        return draft

    def test_health_and_legacy_summary_remain_available(self):
        for path in ("/api/health", "/api/healthz"):
            self.assertEqual(request("GET", path)[0], 200)
        self.assertEqual(request("POST", "/api/summarize", {"values": [1, 2, 3]})[0], 200)

    def test_profile_create_reload_edit_and_validation(self):
        draft = self.draft()
        draft["skills"][0]["proficiency"] = "advanced"
        status, created = request("POST", "/api/profiles", draft)
        self.assertEqual(status, 201)
        profile_id = created["id"]
        self.assertEqual(created["skills"][0]["proficiency"], "advanced")
        self.assertEqual(request("GET", f"/api/profiles/{profile_id}"), (200, created))
        draft["career_aspirations"] = "A fully fictional international data role."
        status, edited = request("PUT", f"/api/profiles/{profile_id}", draft)
        self.assertEqual(status, 200)
        self.assertEqual(edited["id"], profile_id)
        self.assertEqual(request("GET", f"/api/profiles/{profile_id}")[1]["career_aspirations"], draft["career_aspirations"])
        draft["synthetic_demo"] = False
        self.assertEqual(request("POST", "/api/profiles", draft)[0], 422)
        draft["synthetic_demo"] = True
        draft["skills"][0]["skill_id"] = "not-a-real-id"
        self.assertEqual(request("POST", "/api/profiles", draft)[0], 422)

    def test_missing_profiles_and_bad_numeric_values(self):
        self.assertEqual(request("GET", "/api/profiles/missing")[0], 404)
        draft = self.draft()
        self.assertEqual(request("PUT", "/api/profiles/missing", draft)[0], 404)
        draft["years_experience"] = -1
        self.assertEqual(request("POST", "/api/profiles", draft)[0], 422)

    def test_blank_and_oversized_list_entries_are_rejected(self):
        for value in ("   ", "x" * 121):
            draft = self.draft()
            draft["interests"] = [value]
            self.assertEqual(request("POST", "/api/profiles", draft)[0], 422)

    def test_employment_refresh_route_and_cache(self):
        from test_employment import FakeSource
        with patch("src.services.employment_service.RemoteOKSource", return_value=FakeSource()):
            status, result = request("POST", "/api/employment/refresh")
            self.assertEqual(status, 200)
            self.assertEqual(result["posting_count"], 2)
            self.assertEqual(result["refresh_status"], "success")
            status, cached = request("GET", "/api/employment")
            self.assertEqual(status, 200)
            self.assertEqual(cached["jobs"], result["jobs"])
            self.assertEqual(request("POST", "/api/employment/refresh")[1]["refresh_status"], "cooldown")

    def test_research_refresh_failure_preserves_cache_and_relevance_route(self):
        from test_trends import FakeSource
        with patch("src.services.trend_service.OpenAlexSource", return_value=FakeSource()):
            status, result = request("POST", "/api/trends/refresh")
            self.assertEqual(status, 200)
            self.assertEqual(result["refresh_status"], "success")
            self.assertEqual(len(result["topics"]), 5)
        with connection() as db:
            db.execute("UPDATE trend_refresh_state SET last_attempt_at = '2000-01-01T00:00:00Z'")
        with patch("src.services.trend_service.OpenAlexSource", return_value=FakeSource(fail_at=1)):
            status, failed = request("POST", "/api/trends/refresh")
            self.assertEqual(status, 200)
            self.assertTrue(failed["cache_fallback"])
            self.assertEqual(failed["topics"], result["topics"])
        _, profile = request("POST", "/api/profiles", self.draft())
        status, relevance = request("GET", f"/api/trends/relevance?profile_id={profile['id']}")
        self.assertEqual(status, 200)
        self.assertEqual(relevance["profile_id"], profile["id"])
        self.assertEqual(request("GET", "/api/trends/relevance?profile_id=missing")[0], 404)

    def test_cached_routes_do_not_contact_providers(self):
        with patch("src.services.sources.openalex.urlopen", side_effect=AssertionError("unexpected network")), patch("src.services.sources.remoteok.urlopen", side_effect=AssertionError("unexpected network")):
            for path in ("/api/skills?q=python", "/api/trends", "/api/trends/topics", "/api/trends/sources", "/api/trends/demo", "/api/trends/history", "/api/employment", "/api/employment/source"):
                self.assertEqual(request("GET", path)[0], 200, path)
            self.assertEqual(request("GET", "/api/employment")[1]["posting_count"], 0)


if __name__ == "__main__":
    unittest.main()

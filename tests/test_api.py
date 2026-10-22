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


def request(
    method: str,
    path: str,
    payload: object = None,
    *,
    raw_body: bytes | None = None,
    extra_headers: list[tuple[bytes, bytes]] | None = None,
) -> tuple[int, object]:
    async def run():
        messages = []
        body = raw_body if raw_body is not None else (b"" if payload is None else json.dumps(payload).encode())
        header_map = {b"content-type": b"application/json"}
        for key, value in extra_headers or []:
            header_map[key.lower()] = value
        headers = list(header_map.items())
        scope = {
            "type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1",
            "method": method, "scheme": "http", "path": path.split("?")[0],
            "raw_path": path.split("?")[0].encode(), "root_path": "",
            "query_string": path.partition("?")[2].encode(),
            "headers": headers, "client": ("test", 1),
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
        insights_status, insights = request("GET", f"/api/profiles/{profile_id}/insights")
        self.assertEqual(insights_status, 200)
        self.assertEqual(insights["indicators"][0]["denominator"], 8)
        self.assertIn("not a measure of employability", insights["indicators"][0]["limitation"])
        self.assertEqual(request("GET", "/api/profiles/missing/insights")[0], 404)
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
            for path in ("/api/skills?q=python", "/api/trends", "/api/trends/topics", "/api/trends/sources", "/api/trends/demo", "/api/trends/history", "/api/trends/brief", "/api/trends/malaysia", "/api/employment", "/api/employment/source"):
                self.assertEqual(request("GET", path)[0], 200, path)
            self.assertEqual(request("GET", "/api/employment")[1]["posting_count"], 0)

    def test_radar_brief_profile_and_optional_explanation(self):
        _, profile = request("POST", "/api/profiles", self.draft())
        status, brief = request("GET", f"/api/trends/brief?profile_id={profile['id']}")
        self.assertEqual(status, 200)
        self.assertEqual(brief["profile_id"], profile["id"])
        self.assertEqual(len(brief["cards"]), 5)
        self.assertEqual(request("GET", "/api/trends/brief?profile_id=missing")[0], 404)
        with patch.dict(os.environ, {"RUNPOD_API_KEY": ""}):
            status, explanation = request("POST", f"/api/trends/brief/explain?profile_id={profile['id']}")
        self.assertEqual(status, 200)
        self.assertFalse(explanation["available"])

    def test_profile_records_survive_round_trip_and_evidence_is_validated(self):
        draft = self.draft()
        draft["projects"] = [{
            "id": "project-1",
            "title": "Fictional community data project",
            "description": "Created a small dashboard.",
            "skill_ids": ["local:data-analysis"],
        }]
        draft["skills"][0]["evidence_record_ids"] = ["project-1"]
        status, saved = request("POST", "/api/profiles", draft)
        self.assertEqual(status, 201)
        self.assertEqual(saved["projects"][0]["id"], "project-1")
        self.assertEqual(saved["skills"][0]["evidence_record_ids"], ["project-1"])
        invalid = self.draft()
        invalid["skills"][0]["evidence_record_ids"] = ["missing-record"]
        self.assertEqual(request("POST", "/api/profiles", invalid)[0], 422)

    def test_cv_extract_requires_synthetic_confirmation_and_parses_docx_in_memory(self):
        from io import BytesIO
        from zipfile import ZIP_DEFLATED, ZipFile

        document = BytesIO()
        xml = (
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            '<w:body><w:p><w:r><w:t>Summary</w:t></w:r></w:p>'
            '<w:p><w:r><w:t>Fictional analyst with an interest in data.</w:t></w:r></w:p>'
            '<w:p><w:r><w:t>Skills</w:t></w:r></w:p>'
            '<w:p><w:r><w:t>Python, Python, Unknown marine robotics</w:t></w:r></w:p>'
            '<w:p><w:r><w:t>Projects</w:t></w:r></w:p>'
            '<w:p><w:r><w:t>Built a fictional reporting project</w:t></w:r></w:p>'
            '</w:body></w:document>'
        )
        with ZipFile(document, "w", ZIP_DEFLATED) as archive:
            archive.writestr("[Content_Types].xml", "<Types/>")
            archive.writestr("word/document.xml", xml)
        headers = [
            (b"content-type", b"application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            (b"x-filename", b"fictional-demo.docx"),
        ]
        path = "/api/profiles/extract-cv"
        self.assertEqual(request("POST", path, raw_body=document.getvalue(), extra_headers=headers)[0], 400)
        headers.append((b"x-synthetic-demo-confirmed", b"true"))
        status, result = request("POST", path, raw_body=document.getvalue(), extra_headers=headers)
        self.assertEqual(status, 200)
        self.assertTrue(result["synthetic_demo"])
        self.assertEqual(result["summary"], "Fictional analyst with an interest in data.")
        self.assertEqual(result["skills"][0]["canonical_name"], "Python programming")
        self.assertEqual(result["skills"][1]["resolution"], "unmatched_user_review_required")
        self.assertEqual(result["sections"]["projects"], ["Built a fictional reporting project"])
        self.assertNotIn("future_ready.sqlite3", str(result))

        large_status, _ = request(
            "POST",
            path,
            raw_body=b"X" * (2 * 1024 * 1024 + 1),
            extra_headers=headers,
        )
        self.assertEqual(large_status, 413)


if __name__ == "__main__":
    unittest.main()

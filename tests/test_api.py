"""In-process ASGI integration tests without an extra HTTP-client dependency."""

import asyncio
import json
import os
import tempfile
import threading
import time
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

    def wait_for_skill_job(self, job_id: str) -> tuple[int, object]:
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            status, result = request("GET", f"/api/profiles/extract-profile-skills/{job_id}")
            if status != 200 or result["status"] == "completed":
                return status, result
            time.sleep(0.01)
        self.fail("Skill extraction job did not finish within the test deadline.")

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
        self.assertEqual(request("POST", "/api/profiles", draft)[0], 201)
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

    def test_ai_skill_extraction_requires_fictional_consent_and_returns_taxonomy_links(self):
        evidence = [{
            "source_id": "project-1",
            "source_label": "Projects",
            "text": "Built a fictional dashboard using Python.",
        }]
        esco_python_id = "http://data.europa.eu/esco/skill/ccd0a1d9-afda-43d9-b901-96344886e14d"
        model_content = json.dumps({
            "skills": [{
                "skill_id": esco_python_id,
                "evidence_id": "e0",
                "evidence": "using Python",
                "reason": "The description explicitly mentions Python.",
            }]
        })
        from src.services.sources.runpod_api import RunPodConfigurationError

        path = "/api/profiles/extract-profile-skills"
        body = {"evidence": evidence}
        self.assertEqual(request("POST", path, body)[0], 400)

        headers = [(b"x-synthetic-demo-confirmed", b"true")]
        with patch(
            "src.services.skill_extractor.run_sync",
            return_value={"output": {"choices": [{"message": {"content": model_content}}]}},
        ) as run_sync:
            status, started = request("POST", path, body, extra_headers=headers)
            self.assertEqual(status, 202)
            self.assertEqual(started["status"], "pending")
            status, result = self.wait_for_skill_job(started["job_id"])
        self.assertEqual(status, 200)
        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["skills"][0]["skill_id"], esco_python_id)
        self.assertEqual(result["skills"][0]["canonical_name"], "Python (computer programming)")
        self.assertEqual(result["skills"][0]["evidence_record_ids"], ["project-1"])
        sent_taxonomy = json.loads(run_sync.call_args.args[1]["input"]["messages"][1]["content"])["taxonomy"]
        self.assertIn(esco_python_id, {skill["skill_id"] for skill in sent_taxonomy})

        with patch("src.services.skill_extractor.run_sync", side_effect=RunPodConfigurationError("RunPod is not configured.")):
            status, started = request("POST", path, body, extra_headers=headers)
            self.assertEqual(status, 202)
            status, error = self.wait_for_skill_job(started["job_id"])
        self.assertEqual(status, 503)
        self.assertIn("RunPod", error["detail"])

        from src.services.sources.runpod_api import RunPodRequestError

        with patch("src.services.skill_extractor.run_sync", side_effect=RunPodRequestError("RunPod rejected the API key (HTTP 401). Check RUNPOD_API_KEY.")):
            status, started = request("POST", path, body, extra_headers=headers)
            self.assertEqual(status, 202)
            status, error = self.wait_for_skill_job(started["job_id"])
        self.assertEqual(status, 502)
        self.assertEqual(error["detail"], "RunPod rejected the API key (HTTP 401). Check RUNPOD_API_KEY.")

    def test_skill_extraction_job_status_and_unknown_job(self):
        with patch(
            "src.services.skill_extraction_jobs.extract_profile_skill_candidates",
            return_value=[],
        ):
            status, started = request(
                "POST",
                "/api/profiles/extract-profile-skills",
                {"evidence": [{"source_label": "Project", "text": "Used Python."}]},
                extra_headers=[(b"x-synthetic-demo-confirmed", b"true")],
            )
            self.assertEqual(status, 202)
            status, completed = self.wait_for_skill_job(started["job_id"])
        self.assertEqual(status, 200)
        self.assertEqual(completed, {"status": "completed", "skills": []})
        self.assertEqual(request("GET", "/api/profiles/extract-profile-skills/not-a-job")[0], 404)

    def test_skill_extraction_jobs_are_bounded_and_report_pending(self):
        started = threading.Event()
        release = threading.Event()

        def hold_job(evidence, *, limit):
            started.set()
            release.wait(5)
            return []

        headers = [(b"x-synthetic-demo-confirmed", b"true")]
        payload = {"evidence": [{"source_label": "Project", "text": "Used Python."}]}
        with patch("src.services.skill_extraction_jobs.extract_profile_skill_candidates", side_effect=hold_job):
            try:
                first_status, first = request("POST", "/api/profiles/extract-profile-skills", payload, extra_headers=headers)
                self.assertEqual(first_status, 202)
                self.assertTrue(started.wait(2))
                pending_status, pending = request("GET", f"/api/profiles/extract-profile-skills/{first['job_id']}")
                self.assertEqual((pending_status, pending["status"]), (200, "pending"))

                second_status, second = request("POST", "/api/profiles/extract-profile-skills", payload, extra_headers=headers)
                self.assertEqual(second_status, 202)
                busy_status, busy = request("POST", "/api/profiles/extract-profile-skills", payload, extra_headers=headers)
                self.assertEqual(busy_status, 429)
                self.assertIn("busy", busy["detail"])
            finally:
                release.set()

            for job in (first, second):
                status, result = self.wait_for_skill_job(job["job_id"])
                self.assertEqual(status, 200)
                self.assertEqual(result["status"], "completed")


if __name__ == "__main__":
    unittest.main()

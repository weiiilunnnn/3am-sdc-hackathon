"""Evidence-backed findings and optional model wording must remain auditable."""

import json
import os
import tempfile
import unittest
from unittest.mock import patch

from src.services.employment_service import refresh_employment
from src.services.signal_explanations import explanation_key, prepare_explanation, validate_generated_wording
from src.services.signal_findings import get_shared_findings, process_shared_findings, validate_excerpt
from src.services.sources.remoteok import RemoteOKSource
from src.services.storage import connection
from src.services.trend_experience import get_trend_experience
from src.services.trend_service import refresh_trends
from test_trends import FakeSource as FakeResearchSource


class SoftwareFeed:
    def fetch_snapshot(self):
        rows = [{"legal": "Synthetic test feed", "last_updated": 1792530000}]
        for index in range(9):
            rows.append({
                "id": f"software-{index}", "position": "Software Engineer", "company": f"Example {index % 4}",
                "date": "2026-10-20T09:00:00Z", "url": f"https://remoteok.com/remote-jobs/software-{index}",
                "tags": ["Python"] if index < 5 else ["JavaScript"],
                "description": "Python and AI systems." if index < 4 else "JavaScript applications.",
            })
        rows.append(dict(rows[1]))  # Repeated ID must not inflate the denominator.
        return RemoteOKSource.parse_payload(rows, "2026-10-21T00:00:00Z")


class SignalFindingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.environment = patch.dict(os.environ, {"APP_DB_PATH": f"{self.temp.name}/signals.sqlite3",
                                                 "EVIDENCE_LLM_ENABLED": "0"})
        self.environment.start()

    def tearDown(self):
        self.environment.stop()
        self.temp.cleanup()

    def populated(self):
        refresh_employment(SoftwareFeed())
        refresh_trends(FakeResearchSource())
        return process_shared_findings()

    def test_role_counts_dedup_and_no_posting_growth_claim(self):
        processed = self.populated()
        self.assertEqual(processed["status"], "processed")
        _, findings = get_shared_findings("software_engineering")
        python = next(item for item in findings if item["id"] == "prevalence:local:python-programming")
        self.assertEqual((python["metric"]["numerator"], python["metric"]["denominator"]), (5, 9))
        pair = next(item for item in findings if item["id"] == "cooccurrence:local:python-programming:mention:ai")
        self.assertEqual((pair["metric"]["numerator"], pair["metric"]["denominator"]), (4, 5))
        self.assertEqual(python["employer_count"], 4)
        self.assertTrue(all(item["type"] != "posting_change" for item in findings))
        self.assertEqual(process_shared_findings()["status"], "unchanged")
        with connection() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM signal_documents").fetchone()[0], 9)
            self.assertEqual(db.execute("SELECT COUNT(*) FROM signal_extractions").fetchone()[0], 9)

    def test_personal_relevance_and_unsupported_profile(self):
        self.populated()
        with patch("src.services.sources.runpod_api.run_sync") as provider:
            student = get_trend_experience("cs-student")
            admin = get_trend_experience("admin-worker")
        provider.assert_not_called()
        self.assertEqual(student["context"]["id"], "software_engineering")
        self.assertEqual(student["insights"][0]["type"], "posting_prevalence")
        self.assertIn("Python", student["insights"][0]["why_relevant"])
        self.assertEqual(admin["context"]["status"], "unsupported")
        self.assertEqual(admin["insights"], [])
        explored = get_trend_experience("admin-worker", role_family="software_engineering")
        self.assertTrue(explored["context"]["overridden"])
        self.assertTrue(explored["insights"])

    def test_exact_excerpt_validation_and_source_hash_cache(self):
        self.populated()
        self.assertTrue(validate_excerpt("Python and AI", "description", title="Role", tags=[], evidence_text="Python and AI systems."))
        self.assertFalse(validate_excerpt("invented quote", "description", title="Role", tags=[], evidence_text="Python and AI systems."))
        with connection() as db:
            row = db.execute("SELECT payload FROM signal_extractions WHERE document_id = 'software-0'").fetchone()
            extraction = json.loads(row["payload"])
        self.assertEqual(extraction["role_family"], "software_engineering")
        self.assertTrue(any(item["excerpt"] and item["excerpt"] in "Python and AI systems. Python" for item in extraction["skills"]))

    def test_older_snapshot_uses_only_retained_title_or_tags_for_excerpt(self):
        self.populated()
        from src.services.signal_findings import _evidence
        from src.services.employment_service import get_employment_dashboard
        job = get_employment_dashboard().jobs[0]
        old_mentions = [mention.model_copy(update={"excerpt": None, "excerpt_field": None}) for mention in job.skill_mentions]
        old_job = job.model_copy(update={"skill_mentions": old_mentions, "evidence_text": ""})
        result = _evidence(old_job, {"local:python-programming", "mention:javascript"})
        self.assertIn(result["excerpt"], [old_job.title, *old_job.tags])
        self.assertIn(result["excerpt_field"], ["title", "tags"])

    def test_operator_model_cache_budget_and_failure_fallback(self):
        self.populated()
        data = get_trend_experience("cs-student")
        profile, finding = data["profile"], data["insights"][0]
        self.assertEqual(prepare_explanation(profile, finding)["status"], "disabled")
        self.assertNotEqual(explanation_key(profile, finding), explanation_key(profile, {**finding, "evidence_version": "new-evidence"}))
        evidence_id = finding["evidence"][0]["id"]
        valid = {"interpretation": "This source example connects the listed skill to the sampled role group.",
                 "evidence_ids": [evidence_id]}
        with self.assertRaises(ValueError):
            validate_generated_wording({**valid, "evidence_ids": ["invented"]}, {evidence_id})
        with patch.dict(os.environ, {"EVIDENCE_LLM_ENABLED": "1", "RUNPOD_LLM_ENDPOINT_ID": "test-endpoint",
                                         "RUNPOD_API_KEY": "test-key", "EVIDENCE_LLM_REQUEST_BUDGET": "1",
                                         "EVIDENCE_LLM_TOKEN_BUDGET": "2000"}):
            with patch("src.services.signal_explanations.run_sync", return_value={"output": {
                "choices": [{"message": {"content": json.dumps(valid)}}], "usage": {"total_tokens": 80}}}) as run:
                generated = prepare_explanation(profile, finding)
                self.assertEqual(generated["status"], "generated")
                self.assertEqual(prepare_explanation(profile, finding)["status"], "cached")
                run.assert_called_once()
            with connection() as db:
                usage = db.execute("SELECT requests, tokens FROM signal_model_usage").fetchone()
            self.assertEqual((usage["requests"], usage["tokens"]), (1, 80))

    def test_model_failure_keeps_template_finding_available(self):
        self.populated()
        data = get_trend_experience("cs-student")
        finding = data["insights"][0]
        with patch.dict(os.environ, {"EVIDENCE_LLM_ENABLED": "1", "RUNPOD_LLM_ENDPOINT_ID": "test-endpoint",
                                         "RUNPOD_API_KEY": "test-key", "EVIDENCE_LLM_REQUEST_BUDGET": "1",
                                         "EVIDENCE_LLM_TOKEN_BUDGET": "2000"}):
            with patch("src.services.signal_explanations.run_sync", side_effect=TimeoutError("test timeout")):
                self.assertEqual(prepare_explanation(data["profile"], finding)["status"], "fallback")
        self.assertEqual(get_trend_experience("cs-student")["insights"][0]["interpretation"], finding["interpretation"])


if __name__ == "__main__":
    unittest.main()

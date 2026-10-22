"""Dynamic connections and exploration use source-backed, non-billable fixtures."""

import json
import os
import tempfile
import unittest
from unittest.mock import patch

from src.services.ai_skill_exploration import get_ai_skill_exploration
from src.services.connection_jobs import process_discovery_jobs, queue_discovery_job
from src.services.connection_model import (
    explanation_key, prepare_connection_explanation, prepare_model_extraction,
    validate_connection_wording, _validated_model_document,
)
from src.services.employment_service import get_employment_dashboard, refresh_employment
from src.services.skill_connection_experience import get_skill_connection_experience
from src.services.skill_connections import (
    extract_document, get_saved_skill_connections, process_skill_connections, validate_extraction,
)
from src.services.sources.remoteok import RemoteOKSource
from src.services.storage import connection


class Feed:
    def fetch_snapshot(self):
        rows = [{"legal": "Synthetic test feed", "last_updated": 1792530000}]
        descriptions = [
            "Data analysis teams build AI agents that prepare reports for human review.",
            "Data analysis teams build AI agents to organize research tasks.",
            "Data analysis guides decisions. Teams build AI agents for customer support.",
            "Python developers build backend systems with ordinary tools.",
        ]
        for index, description in enumerate(descriptions):
            rows.append({"id": f"evidence-{index}", "position": "Software Engineer", "company": f"Employer {index}",
                         "date": "2026-10-20T09:00:00Z", "url": f"https://remoteok.com/remote-jobs/evidence-{index}",
                         "tags": [], "description": description})
        rows.append(dict(rows[1]))
        return RemoteOKSource.parse_payload(rows, "2026-10-21T00:00:00Z")


class SkillConnectionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.environment = patch.dict(os.environ, {"APP_DB_PATH": f"{self.temp.name}/connections.sqlite3",
                                                 "EVIDENCE_LLM_ENABLED": "0"})
        self.environment.start()

    def tearDown(self):
        self.environment.stop()
        self.temp.cleanup()

    def populated(self):
        refresh_employment(Feed())
        process_skill_connections()
        return get_saved_skill_connections()

    def test_absent_from_old_catalogue_is_discovered_and_counted(self):
        version, saved = self.populated()
        item = next(row for row in saved if row["current_skill_id"] == "local:data-analysis"
                    and row["ai_skill"]["id"] == "ai:agents")
        self.assertEqual((item["metric"]["numerator"], item["metric"]["denominator"]), (2, 3))
        self.assertEqual(item["basis"], "same_task_passage")
        self.assertEqual(item["employer_count"], 2)
        self.assertTrue(item["source"]["collected_at"])
        self.assertEqual(process_skill_connections()["status"], "unchanged")
        with connection() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM signal_connection_extractions").fetchone()[0], 4)
        jobs = {job.source_job_id: job for job in get_employment_dashboard().jobs}
        for evidence in item["evidence"]:
            self.assertIn(evidence["source_quote"], jobs[evidence["document_id"]].evidence_text)
            self.assertIn(evidence["ai_quote"], jobs[evidence["document_id"]].evidence_text)
        with patch("src.services.skill_connections.EXTRACTION_VERSION", "next-version"):
            next_run = process_skill_connections()
        self.assertNotEqual(next_run["evidence_version"], version)
        self.assertEqual(next_run["documents_processed"], 4)

    def test_valid_quotes_without_task_link_are_not_enough(self):
        self.populated()
        jobs = get_employment_dashboard().jobs
        separated = next(job for job in jobs if job.source_job_id == "evidence-2")
        extracted = extract_document(separated)
        self.assertTrue(extracted["source_skills"])
        self.assertTrue(extracted["tasks"])
        self.assertFalse(any(any(skill["id"] == "local:data-analysis" for skill in task["skills"])
                             and task["ai_capabilities"] for task in extracted["tasks"]))
        _, saved = get_saved_skill_connections()
        self.assertFalse(any(item["current_skill_id"] == "local:python-programming" for item in saved))
        with self.assertRaises(ValueError):
            validate_extraction({"document_id": separated.source_job_id, "source_skills": [],
                                 "tasks": [{"quote": "Invented quote", "skills": [], "ai_capabilities": []}]}, separated)
        with self.assertRaises(ValueError):
            _validated_model_document({"document_id": separated.source_job_id, "role_family": "software_engineering",
                                       "source_skills": [], "tasks": [{"quote": "Invented quote", "skills": [],
                                       "ai_capabilities": []}]}, separated, separated.evidence_text)

    def test_page_reads_saved_data_and_queue_is_deduplicated(self):
        version, saved = self.populated()
        with patch("src.services.connection_model.run_sync") as provider, patch("src.services.sources.remoteok.RemoteOKSource.fetch_snapshot") as source:
            profile = get_skill_connection_experience("data-graduate", skill_id="local:data-analysis")
            empty = get_skill_connection_experience("cs-student", skill_id="local:python-programming")
            provider.assert_not_called()
            source.assert_not_called()
        self.assertTrue(profile["connections"])
        self.assertEqual(empty["connections"], [])
        with patch.dict(os.environ, {"EVIDENCE_LLM_ENABLED": "1"}):
            first = queue_discovery_job("local:python-programming", "Python programming", "software_engineering", version)
            second = queue_discovery_job("local:python-programming", "Python programming", "software_engineering", version)
        self.assertEqual((first, second), ("queued", "queued"))
        with connection() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM signal_discovery_jobs").fetchone()[0], 1)
        self.assertEqual(process_discovery_jobs()["status"], "disabled")

    def test_page_queues_once_without_calling_model_when_enabled(self):
        self.populated()
        with patch.dict(os.environ, {"EVIDENCE_LLM_ENABLED": "1"}):
            with patch("src.services.connection_model.run_sync") as provider:
                first = get_skill_connection_experience("cs-student", skill_id="local:python-programming")
                second = get_skill_connection_experience("cs-student", skill_id="local:python-programming")
                provider.assert_not_called()
        self.assertEqual((first["coverage"], second["coverage"]), ("queued", "queued"))
        with connection() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM signal_discovery_jobs").fetchone()[0], 1)

    def test_model_review_rejects_unsupported_automation_and_caches(self):
        _, saved = self.populated()
        item = next(value for value in saved if value["current_skill_id"] == "local:data-analysis")
        valid = {"status": "supported", "current_skill_id": item["current_skill_id"],
                 "ai_skill_id": item["ai_skill"]["id"], "relationship": "builds_on",
                 "work_task": item["work_task"],
                 "explanation": "These postings use data analysis in tasks that also describe building AI agents.",
                 "evidence_ids": [item["evidence"][0]["id"]],
                 "limitation": "This is a sampled task relationship, not a market trend."}
        self.assertEqual(validate_connection_wording(valid, item)["status"], "supported")
        with self.assertRaises(ValueError):
            validate_connection_wording({**valid, "relationship": "may_automate_task"}, item)
        with self.assertRaises(ValueError):
            validate_connection_wording({**valid, "evidence_ids": ["invented"]}, item)
        self.assertNotEqual(explanation_key(item), explanation_key({**item, "evidence_version": "new"}))
        self.assertEqual(prepare_connection_explanation(item["id"])["status"], "disabled")
        response = {"output": {"choices": [{"message": {"content": json.dumps(valid)}}],
                               "usage": {"total_tokens": 75}}}
        with patch.dict(os.environ, {"EVIDENCE_LLM_ENABLED": "1", "RUNPOD_LLM_ENDPOINT_ID": "test-endpoint",
                                         "RUNPOD_API_KEY": "test-key", "EVIDENCE_LLM_REQUEST_BUDGET": "1",
                                         "EVIDENCE_LLM_TOKEN_BUDGET": "3000"}):
            with patch("src.services.connection_model.run_sync", return_value=response) as run:
                self.assertEqual(prepare_connection_explanation(item["id"])["status"], "supported")
                self.assertEqual(prepare_connection_explanation(item["id"])["status"], "supported")
                run.assert_called_once()
                self.assertEqual(prepare_model_extraction("evidence-0")["status"], "budget_exhausted")

    def test_model_can_extract_ai_capability_absent_from_alias_vocabulary(self):
        quote = "Data analysis teams build AI orchestration workflows for reports."
        class NovelFeed:
            def fetch_snapshot(self):
                return RemoteOKSource.parse_payload([
                    {"legal": "Synthetic test feed", "last_updated": 1792530000},
                    {"id": "novel-1", "position": "Software Engineer", "company": "Test employer",
                     "date": "2026-10-20T09:00:00Z", "url": "https://remoteok.com/remote-jobs/novel-1",
                     "tags": [], "description": quote},
                ], "2026-10-21T00:00:00Z")
        refresh_employment(NovelFeed())
        process_skill_connections()
        self.assertEqual(get_saved_skill_connections()[1], [])
        model_output = {"document_id": "novel-1", "role_family": "software_engineering",
                        "source_skills": [{"id": "local:data-analysis", "name": "Data analysis",
                                           "observed_term": "Data analysis", "quote": quote}],
                        "tasks": [{"quote": quote, "skills": [], "ai_capabilities": [
                            {"id": "ai:ai-orchestration", "name": "AI orchestration",
                             "observed_term": "AI orchestration", "definition": "Coordinating AI steps in a work process."}]}]}
        response = {"output": {"choices": [{"message": {"content": json.dumps(model_output)}}],
                               "usage": {"total_tokens": 90}}}
        with patch.dict(os.environ, {"EVIDENCE_LLM_ENABLED": "1", "RUNPOD_LLM_ENDPOINT_ID": "test-endpoint",
                                         "RUNPOD_API_KEY": "test-key", "EVIDENCE_LLM_REQUEST_BUDGET": "2",
                                         "EVIDENCE_LLM_TOKEN_BUDGET": "4000"}):
            with patch("src.services.connection_model.run_sync", return_value=response) as run:
                self.assertEqual(prepare_model_extraction("novel-1")["status"], "generated")
                self.assertEqual(prepare_model_extraction("novel-1")["status"], "cached")
                run.assert_called_once()
        _, saved = get_saved_skill_connections()
        self.assertEqual([(item["current_skill_id"], item["ai_skill"]["id"]) for item in saved],
                         [("local:data-analysis", "ai:ai-orchestration")])

    def test_exploration_counts_current_mentions_without_rising_label(self):
        self.populated()
        result = get_ai_skill_exploration()
        self.assertEqual(result["mode"], "most_mentioned")
        self.assertIn("remote-job sample", result["title"])
        agents = next(item for item in result["items"] if item["id"] == "ai:agents")
        self.assertEqual((agents["metric"]["numerator"], agents["metric"]["denominator"]), (3, 4))
        self.assertTrue(all(row["published_at"] and row["url"] for row in agents["evidence"]))
        self.assertIsNone(result["periods"])

    def test_rising_requires_comparable_windows_and_minimum_support(self):
        self.populated()
        base = get_employment_dashboard().jobs[0]
        def window(mentions):
            return [base.model_copy(update={"source_job_id": f"window-{mentions}-{index}",
                                            "evidence_text": "Teams build AI agents for reports." if index < mentions
                                            else "Teams build ordinary reports."}) for index in range(30)]
        with patch("src.services.ai_skill_exploration._history_windows", return_value=(window(5), window(10))):
            rising = get_ai_skill_exploration()
        self.assertEqual(rising["mode"], "rising")
        agents = next(item for item in rising["items"] if item["id"] == "ai:agents")
        self.assertEqual((agents["metric"]["earlier"]["numerator"], agents["metric"]["earlier"]["denominator"]), (5, 30))
        self.assertEqual((agents["metric"]["recent"]["numerator"], agents["metric"]["recent"]["denominator"]), (10, 30))
        self.assertEqual(agents["metric"]["percentage_points"], 16.67)
        with patch("src.services.ai_skill_exploration._history_windows", return_value=(window(1), window(10))):
            sparse = get_ai_skill_exploration()
        self.assertEqual(sparse["mode"], "most_mentioned")

    def test_custom_skill_is_selectable_with_honest_coverage(self):
        self.populated()
        profile = {"id": "saved-demo", "occupation": "Research assistant", "field_of_study": "Research",
                   "skills": [{"id": None, "name": "Interview synthesis"}], "work_tasks": [], "synthetic": True}
        with patch("src.services.skill_connection_experience.get_active_profile", return_value=profile):
            result = get_skill_connection_experience(profile_id="saved-demo", skill_id="custom:interview synthesis")
        self.assertEqual(result["selected_skill_id"], "custom:interview synthesis")
        self.assertEqual(result["connections"], [])
        self.assertEqual(result["coverage"], "not_configured")

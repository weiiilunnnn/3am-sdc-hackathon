"""Small, source-backed connection fixtures; no paid model or network requests."""

import json
import os
import tempfile
import unittest
from unittest.mock import patch

from src.services.connection_model import (explanation_key, prepare_connection_explanation,
                                           prepare_model_extraction, validate_connection_wording,
                                           validate_model_extraction)
from src.services.employment_service import refresh_employment
from src.services.skill_connection_experience import get_skill_connection_experience
from src.services.skill_connections import get_saved_skill_connections, process_skill_connections, validate_connection_extraction
from src.services.sources.remoteok import RemoteOKSource
from src.services.storage import connection


class Feed:
    def fetch_snapshot(self):
        rows = [{"legal": "Synthetic test feed", "last_updated": 1792530000}]
        descriptions = [
            "Python developers build AI agents and test model responses with evaluation criteria.",
            "Python developers build AI agents for backend systems.",
            "Python developers build ordinary backend systems.",
            "A data platform with trusted business context powers AI agents.",
        ]
        for index, description in enumerate(descriptions):
            rows.append({"id": f"evidence-{index}", "position": "Software Engineer", "company": f"Employer {index}",
                         "date": "2026-10-20T09:00:00Z", "url": f"https://remoteok.com/remote-jobs/evidence-{index}",
                         "tags": ["Python"] if index < 3 else [], "description": description})
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

    def test_quotes_counts_cache_and_version(self):
        version, saved = self.populated()
        agents = next(item for item in saved if item["id"] == "python-ai-agents")
        self.assertEqual((agents["metric"]["numerator"], agents["metric"]["denominator"]), (2, 3))
        self.assertEqual(agents["employer_count"], 2)
        self.assertNotIn("replac", agents["explanation"].lower())
        self.assertEqual(process_skill_connections()["status"], "unchanged")
        with connection() as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM signal_connection_extractions").fetchone()[0], 4)
        for item in saved:
            for evidence in item["evidence"]:
                source = next(job for job in Feed().fetch_snapshot().jobs if job.source_job_id == evidence["document_id"])
                self.assertIn(evidence["source_quote"], source.evidence_text)
                self.assertIn(evidence["ai_quote"], source.evidence_text)
        with patch("src.services.skill_connections.EXTRACTION_VERSION", "changed-extraction"):
            result = process_skill_connections()
        self.assertNotEqual(result["evidence_version"], version)
        self.assertEqual(result["documents_processed"], 4)

    def test_profile_selection_empty_and_no_inference_on_read(self):
        self.populated()
        with patch("src.services.connection_model.run_sync") as model, patch("src.services.sources.remoteok.RemoteOKSource.fetch_snapshot") as source:
            student = get_skill_connection_experience("cs-student")
            selected = get_skill_connection_experience("cs-student", skill_id="local:python-programming")
            empty = get_skill_connection_experience("cs-student", skill_id="local:problem-solving")
            admin = get_skill_connection_experience("admin-worker")
            model.assert_not_called()
            source.assert_not_called()
        self.assertEqual(student["selected_skill_id"], "local:python-programming")
        self.assertEqual(len(selected["connections"]), 2)
        self.assertEqual(empty["connections"], [])
        self.assertEqual(admin["selected_skill_id"], admin["skills"][0]["key"])
        self.assertEqual(admin["connections"], [])
        with self.assertRaises(ValueError):
            get_skill_connection_experience("cs-student", skill_id="not-in-profile")

    def test_custom_saved_profile_skill_is_selectable(self):
        self.populated()
        profile = {"id": "saved-demo", "occupation": "Research assistant", "field_of_study": "Research",
                   "skills": [{"id": None, "name": "Interview synthesis"}], "work_tasks": [], "synthetic": True}
        with patch("src.services.skill_connection_experience.get_active_profile", return_value=profile):
            result = get_skill_connection_experience(profile_id="saved-demo", skill_id="custom:interview synthesis")
        self.assertEqual(result["selected_skill_id"], "custom:interview synthesis")
        self.assertEqual(result["skills"][0]["key"], "custom:interview synthesis")
        self.assertEqual(result["connections"], [])

    def test_validation_rejects_invented_passage_and_wording(self):
        _, saved = self.populated()
        item = next(value for value in saved if value["id"] == "python-ai-agents")
        evidence = item["evidence"][0]
        payload = {"document_id": evidence["document_id"], "matches": [{
            "rule_id": item["id"], "source_quote": "Invented Python quote",
            "ai_quote": evidence["ai_quote"], "required_status": None,
        }]}
        with self.assertRaises(ValueError):
            validate_connection_extraction(payload, evidence["source_quote"] + evidence["ai_quote"], evidence["document_id"])
        model_payload = {"document_id": evidence["document_id"], "role_family": "software_engineering",
                         "explicit_skills": [{"name": "Python", "quote": evidence["source_quote"], "status": None}],
                         "work_tasks": [], "matches": []}
        self.assertEqual(validate_model_extraction(model_payload, evidence["source_quote"],
                                                   evidence["document_id"], "software_engineering")["explicit_skills"][0]["name"], "Python")
        with self.assertRaises(ValueError):
            validate_model_extraction({**model_payload, "explicit_skills": [{"name": "Python", "quote": "invented", "status": None}]},
                                      evidence["source_quote"], evidence["document_id"], "software_engineering")
        valid = {"ai_skill_id": item["ai_skill"]["id"], "relationship": item["relationship"],
                 "work_task": item["work_task"], "limitation": item["limitations"],
                 "explanation": "Programming can help build AI tools for multi-step work.",
                 "evidence_ids": [evidence["id"]]}
        self.assertEqual(validate_connection_wording(valid, item)["evidence_ids"], [evidence["id"]])
        with self.assertRaises(ValueError):
            validate_connection_wording({**valid, "explanation": "This skill will replace 90% of jobs."}, item)
        with self.assertRaises(ValueError):
            validate_connection_wording({**valid, "evidence_ids": ["invented"]}, item)
        self.assertNotEqual(explanation_key(item), explanation_key({**item, "evidence_version": "new-version"}))
        self.assertEqual(prepare_connection_explanation(item["id"])["status"], "disabled")

    def test_operator_inference_is_bounded_validated_and_cached(self):
        _, saved = self.populated()
        item = next(value for value in saved if value["id"] == "python-ai-agents")
        evidence_id = item["evidence"][0]["id"]
        valid = {"ai_skill_id": item["ai_skill"]["id"], "relationship": item["relationship"],
                 "work_task": item["work_task"], "limitation": item["limitations"],
                 "explanation": "Python work can support building multi-step AI tools with human checks.",
                 "evidence_ids": [evidence_id]}
        response = {"output": {"choices": [{"message": {"content": json.dumps(valid)}}],
                               "usage": {"total_tokens": 75}}}
        with patch.dict(os.environ, {"EVIDENCE_LLM_ENABLED": "1", "RUNPOD_LLM_ENDPOINT_ID": "test-endpoint",
                                         "RUNPOD_API_KEY": "test-key", "EVIDENCE_LLM_REQUEST_BUDGET": "1",
                                         "EVIDENCE_LLM_TOKEN_BUDGET": "3000"}):
            with patch("src.services.connection_model.run_sync", return_value=response) as run:
                self.assertEqual(prepare_connection_explanation(item["id"])["status"], "generated")
                self.assertEqual(prepare_connection_explanation(item["id"])["status"], "cached")
                run.assert_called_once()
                self.assertEqual(prepare_model_extraction("evidence-0")["status"], "budget_exhausted")
            with connection() as db:
                usage = db.execute("SELECT requests, tokens FROM signal_model_usage").fetchone()
            self.assertEqual((usage["requests"], usage["tokens"]), (1, 75))

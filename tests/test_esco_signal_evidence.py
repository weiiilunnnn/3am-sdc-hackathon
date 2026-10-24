"""Regression tests for exact ESCO-to-legacy-evidence matching."""
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from src.services.session_signal_adapter import SessionSkill, SessionSignalProfile, _resolved_skill, get_session_connections


class EvidenceSkillIdentityTests(unittest.TestCase):
    def test_esco_python_label_maps_to_existing_legacy_evidence_id(self):
        skill = SessionSkill(name="Python (computer programming)",
                             skill_id="http://data.europa.eu/esco/skill/sample-python-id")
        self.assertEqual(_resolved_skill(skill)["key"], "local:python-programming")
        self.assertEqual(_resolved_skill(skill)["name"], "Python (computer programming)")

    def test_esco_data_analysis_label_has_its_reviewed_legacy_key(self):
        self.assertEqual(_resolved_skill(SessionSkill(name="perform data analysis"))["key"], "local:data-analysis")

    def test_additional_reviewed_aliases(self):
        expected = {
            "use machine learning": "local:machine-learning",
            "use spreadsheets": "local:spreadsheet-analysis",
            "manage projects": "local:project-planning",
            "provide customer support": "local:customer-service",
            "solve problems": "local:problem-solving",
            "think critically": "local:critical-thinking",
            "work in teams": "local:teamwork",
            "communicate with others": "local:communication",
        }
        for label, skill_id in expected.items():
            with self.subTest(label=label):
                self.assertEqual(_resolved_skill(SessionSkill(name=label))["key"], skill_id)

    def test_case_whitespace_normalization_and_unknown_protection(self):
        self.assertEqual(_resolved_skill(SessionSkill(name="  USE   MACHINE LEARNING  "))["key"], "local:machine-learning")
        self.assertTrue(_resolved_skill(SessionSkill(name="machine learning ethics"))["key"].startswith("custom:"))

    def test_other_esco_names_do_not_get_random_legacy_matches(self):
        skill = SessionSkill(name="run quantum algorithms", skill_id="local:python-programming")
        self.assertEqual(_resolved_skill(skill)["key"], "custom:run quantum algorithms")

    def test_python_session_shows_existing_published_connections(self):
        def make_link(i, basis):
            return {
                "id": f"fixture-{i}", "current_skill_id": "local:python-programming",
                "basis": basis, "role_families": [], "employer_count": 2,
                "ai_skill": {"id": "ai:agents", "name": "AI agents", "definition": "AI agent capability"},
                "evidence": [{"id": f"posting-{i}", "source_quote": "Python work in a job description",
                              "ai_quote": "AI agents in the same posting", "url": "https://example.org/posting"}],
            }
        published = [make_link(0, "same_task_passage"),
                     make_link(1, "same_task_passage"),
                     make_link(2, "same_posting")]
        source = SimpleNamespace(source={"name": "Himalayas"}, posting_count=597,
                                 last_successful_refresh="2026-10-24", refresh_status="success", cache_fallback=False)
        profile = SessionSignalProfile(skills=[{
            "name": "Python (computer programming)",
            "skill_id": "http://data.europa.eu/esco/skill/sample-python-id",
        }])
        with (patch("src.services.session_signal_adapter.get_saved_skill_connections", return_value=("version1", published)),
              patch("src.services.session_signal_adapter.get_signal_employment_dashboard", return_value=source),
              patch("src.services.session_signal_adapter.get_cached_connection_explanation", return_value=None)):
            response = get_session_connections(profile)
        self.assertEqual(response["source_state"]["posting_sample_size"], 597)
        self.assertEqual(response["skills"][0]["connection_count"], 2)
        self.assertEqual(response["skills"][0]["potential_count"], 3)
        self.assertEqual(len(response["connections"]), 2)
        self.assertEqual(len(response["candidates"]), 1)
        self.assertEqual(response["selected_skill_id"], "local:python-programming")


if __name__ == "__main__":
    unittest.main()

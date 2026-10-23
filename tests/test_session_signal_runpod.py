"""Mocked tests: no real RunPod calls or sensitive input logging."""
import unittest
from unittest.mock import patch
from src.services.session_signal_adapter import SessionSignalProfile
from src.services.session_signal_runpod import SessionExplanationRequest, generate_session_explanation, SignalExplanationError


class RunPodSessionTests(unittest.TestCase):
    def setUp(self):
        self.connection = {
            "id": "test-connection-1234", "current_skill_id": "local:data-analysis",
            "current_skill_name": "Data analysis", "basis": "same_task_passage",
            "ai_skill": {"name": "Machine learning"},
            "evidence": [{"id": "source-1", "ai_quote": "Build ML workflows using data analysis."}],
        }
        self.request = SessionExplanationRequest(
            profile=SessionSignalProfile(occupation="Analyst", skills=[{"name": "Data analysis"}]),
            connection_id="test-connection-1234")

    def test_disabled_prevents_paid_calls(self):
        with patch("src.services.session_signal_runpod.enabled", return_value=False), patch("src.services.session_signal_runpod._run") as llm:
            result = generate_session_explanation(self.request)
        self.assertEqual(result["status"], "disabled")
        llm.assert_not_called()

    def test_unknown_connection_never_calls_llm(self):
        with patch("src.services.session_signal_runpod.enabled", return_value=True), patch(
            "src.services.session_signal_runpod.get_saved_skill_connections", return_value=("v1", [])
        ), patch("src.services.session_signal_runpod._run") as llm:
            with self.assertRaises(SignalExplanationError):
                generate_session_explanation(self.request)
        llm.assert_not_called()

    def test_validated_output_and_minimum_profile_fields(self):
        output = {"explanation": "This could be a related use case.",
                  "learning_gap": "Review machine learning evaluation concepts.",
                  "next_step": "Study a cited ML workflow.", "evidence_ids": ["source-1"]}
        with patch("src.services.session_signal_runpod.enabled", return_value=True), patch(
            "src.services.session_signal_runpod.get_saved_skill_connections", return_value=("v1", [self.connection])
        ), patch("src.services.session_signal_runpod._run", return_value=("generated", output)) as llm:
            result = generate_session_explanation(self.request)
        self.assertEqual(result["status"], "generated")
        facts = llm.call_args.args[0]
        self.assertNotIn("email", str(facts))
        self.assertNotIn("work_tasks", str(facts))
        self.assertEqual(facts["skill"], "Data analysis")

    def test_fabricated_citations_are_rejected(self):
        output = {"explanation": "Possibly relevant.", "learning_gap": "Study models.",
                  "next_step": "Read tutorials.", "evidence_ids": ["fabricated"]}
        with patch("src.services.session_signal_runpod.enabled", return_value=True), patch(
            "src.services.session_signal_runpod.get_saved_skill_connections", return_value=("v1", [self.connection])
        ), patch("src.services.session_signal_runpod._run", return_value=("generated", output)):
            self.assertEqual(generate_session_explanation(self.request)["status"], "rejected")


if __name__ == "__main__":
    unittest.main()

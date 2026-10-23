"""No live RunPod calls: verify session scope and source-anchored model output."""
import unittest
import os
import tempfile
from pathlib import Path
from unittest.mock import patch

from src.services.session_signal_review import (
    SessionReviewError, SessionReviewRequest, review_connection,
)


class TestSessionSignalReview(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        patcher = patch.dict(os.environ, {"APP_DB_PATH": str(Path(temp.name) / "review-tests.sqlite3")})
        patcher.start()
        self.addCleanup(patcher.stop)
        self.item = {
            "id": "connection-1234567890",
            "current_skill_id": "local:data-analysis",
            "current_skill_name": "Data analysis",
            "ai_skill": {"name": "Machine learning"},
            "basis": "same_posting",
            "evidence": [{
                "id": "posting-42", "source_quote": "Perform exploratory data analysis",
                "ai_quote": "Assist in validating machine learning models",
            }],
        }
        self.request = SessionReviewRequest(profile={
            "skills": [{"name": "Data analysis", "skill_id": "local:data-analysis"}],
        }, connection_id=self.item["id"])

    def test_related_workflow_is_labeled_as_model_review_not_truth(self):
        output = {"decision": "related_workflow", "rationale": "These tasks may relate in the role.",
                  "learning_gap": "Model evaluation", "next_step": "Study validation workflows",
                  "evidence_ids": ["posting-42"]}
        with patch("src.services.session_signal_review.get_saved_skill_connections", return_value=("v1", [self.item])), \
             patch("src.services.session_signal_review._run", return_value=("generated", output)) as run:
            result = review_connection(self.request)
        self.assertEqual(result["decision"], "related_workflow")
        self.assertIn("not human validation", result["review_origin"])
        self.assertNotIn("profile", run.call_args.args[0])
        self.assertNotIn("email", str(run.call_args.args[0]))

    def test_cache_reuses_validated_review_without_second_runpod_call(self):
        output = {"decision": "related_workflow", "rationale": "Both tasks may occur in one role.",
                  "learning_gap": "Model validation", "next_step": "Build a model",
                  "evidence_ids": ["posting-42"]}
        with patch("src.services.session_signal_review.get_saved_skill_connections", return_value=("v1", [self.item])), \
             patch("src.services.session_signal_review._run", return_value=("generated", output)) as run:
            first = review_connection(self.request)
            second = review_connection(self.request)
        self.assertEqual(first["status"], "generated")
        self.assertEqual(second["status"], "cached")
        self.assertEqual(run.call_count, 1)

    def test_rejects_invented_evidence_reference(self):
        output = {"decision": "related_workflow", "rationale": "Seems connected.",
                  "learning_gap": "Basics", "next_step": "Try practice",
                  "evidence_ids": ["fabricated"]}
        with patch("src.services.session_signal_review.get_saved_skill_connections", return_value=("v1", [self.item])), \
             patch("src.services.session_signal_review._run", return_value=("generated", output)):
            self.assertEqual(review_connection(self.request)["status"], "rejected")

    def test_cannot_review_other_profile_skill(self):
        with patch("src.services.session_signal_review.get_saved_skill_connections", return_value=("v1", [self.item])), \
             patch("src.services.session_signal_review._run") as run:
            other = SessionReviewRequest(profile={"skills": [{"name": "Teamwork"}]}, connection_id=self.item["id"])
            with self.assertRaises(SessionReviewError):
                review_connection(other)
            run.assert_not_called()

    def test_disabled_or_out_of_budget_never_claims_generated(self):
        with patch("src.services.session_signal_review.get_saved_skill_connections", return_value=("v1", [self.item])), \
             patch("src.services.session_signal_review._run", return_value=("budget_exhausted", None)):
            self.assertEqual(review_connection(self.request)["status"], "budget_exhausted")


if __name__ == "__main__":
    unittest.main()

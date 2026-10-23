"""RunPod-backed skill extraction tests with mocked model responses."""

import json
import unittest
from unittest.mock import patch

from src.services.skill_extractor import (
    SkillEvidence,
    SkillExtractionError,
    extract_profile_skill_candidates,
)
from src.services.sources.runpod_api import RunPodRequestError


class SkillExtractorTests(unittest.TestCase):
    def model_response(self, skills):
        return {
            "output": {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps({"skills": skills}),
                        }
                    }
                ]
            }
        }

    def test_maps_model_candidates_to_known_taxonomy_and_links_exact_evidence(self):
        evidence = [
            SkillEvidence(
                evidence_id="e0",
                source_id="project-1",
                source_label="Projects",
                text="Built a dashboard using Python to analyse survey data.",
            )
        ]
        response = self.model_response([
            {
                "skill_id": "local:python-programming",
                "evidence_id": "e0",
                "evidence": "using Python",
                "reason": "The project description says Python was used.",
            }
        ])

        with patch("src.services.skill_extractor.run_sync", return_value=response) as run_sync:
            candidates = extract_profile_skill_candidates(evidence)

        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0].canonical_name, "Python programming")
        self.assertEqual(candidates[0].skill_id, "local:python-programming")
        self.assertEqual(candidates[0].evidence_record_ids, ["project-1"])
        self.assertEqual(candidates[0].evidence_source, "Projects")
        self.assertIn("local:python-programming", run_sync.call_args.args[1]["input"]["messages"][1]["content"])

    def test_rejects_model_skill_ids_outside_taxonomy(self):
        evidence = [SkillEvidence("e0", None, "Summary", "Used a made-up tool.")]
        response = self.model_response([
            {
                "skill_id": "esco:invented",
                "evidence_id": "e0",
                "evidence": "made-up tool",
                "reason": "Invalid mapping",
            }
        ])

        with patch("src.services.skill_extractor.run_sync", return_value=response):
            with self.assertRaises(RunPodRequestError):
                extract_profile_skill_candidates(evidence)

    def test_rejects_model_evidence_that_is_not_in_the_profile_text(self):
        evidence = [SkillEvidence("e0", None, "Summary", "Worked on a fictional project.")]
        response = self.model_response([
            {
                "skill_id": "local:project-planning",
                "evidence_id": "e0",
                "evidence": "Managed a team of 20",
                "reason": "Unsupported statement",
            }
        ])

        with patch("src.services.skill_extractor.run_sync", return_value=response):
            with self.assertRaises(RunPodRequestError):
                extract_profile_skill_candidates(evidence)

    def test_rejects_empty_or_oversized_evidence_before_model_call(self):
        with patch("src.services.skill_extractor.run_sync") as run_sync:
            with self.assertRaises(SkillExtractionError):
                extract_profile_skill_candidates([])
            with self.assertRaises(SkillExtractionError):
                extract_profile_skill_candidates([SkillEvidence("e0", None, "Project", "x" * 30_001)])
        run_sync.assert_not_called()


if __name__ == "__main__":
    unittest.main()

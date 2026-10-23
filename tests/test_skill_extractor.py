"""RunPod-backed skill extraction tests with mocked model responses."""

import json
import unittest
from unittest.mock import patch

from src.services.skill_extractor import (
    SkillEvidence,
    SkillExtractionError,
    SkillTaxonomyUnavailableError,
    extract_profile_skill_candidates,
)
from src.services.sources.runpod_api import RunPodRequestError

ESCO_PYTHON_ID = "http://data.europa.eu/esco/skill/ccd0a1d9-afda-43d9-b901-96344886e14d"


class SkillExtractorTests(unittest.TestCase):
    def test_blank_endpoint_override_uses_shared_glm_default(self):
        from src.services.sdg_text import LLM_ENDPOINT_ID
        with patch.dict('os.environ', {'RUNPOD_LLM_ENDPOINT_ID':''}), patch('src.services.skill_extractor.run_sync',return_value=self.model_response([])) as call:
            extract_profile_skill_candidates([SkillEvidence('e0',None,'Project','Used Python.')])
        self.assertEqual(call.call_args.args[0],LLM_ENDPOINT_ID)

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

    def test_maps_model_candidates_to_esco_and_links_exact_evidence(self):
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
                "skill_id": ESCO_PYTHON_ID,
                "evidence_id": "e0",
                "evidence": "using Python",
                "reason": "The project description says Python was used.",
            }
        ])

        with patch("src.services.skill_extractor.run_sync", return_value=response) as run_sync:
            candidates = extract_profile_skill_candidates(evidence)

        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0].canonical_name, "Python (computer programming)")
        self.assertEqual(candidates[0].skill_id, ESCO_PYTHON_ID)
        self.assertEqual(candidates[0].taxonomy_source, "ESCO v1.2.1")
        self.assertEqual(candidates[0].evidence_record_ids, ["project-1"])
        self.assertEqual(candidates[0].evidence_source, "Projects")
        sent = json.loads(run_sync.call_args.args[1]["input"]["messages"][1]["content"])
        self.assertLessEqual(len(sent["taxonomy"]), 80)
        self.assertEqual(run_sync.call_args.kwargs["timeout"], 90)
        self.assertEqual(run_sync.call_args.args[1]["input"]["max_tokens"], 1800)
        self.assertIn(ESCO_PYTHON_ID, {skill["skill_id"] for skill in sent["taxonomy"]})
        self.assertTrue(all(skill["skill_id"].startswith("http://data.europa.eu/esco/skill/") for skill in sent["taxonomy"]))

    def test_accepts_json_wrapped_in_a_markdown_code_fence(self):
        response = {
            "output": {
                "choices": [{
                    "message": {
                        "content": '```json\n{"skills":[]}\n```',
                    }
                }]
            }
        }
        with patch("src.services.skill_extractor.run_sync", return_value=response):
            self.assertEqual(
                extract_profile_skill_candidates([SkillEvidence("e0", None, "Project", "Used Python.")]),
                [],
            )

    def test_rejects_truncated_or_malformed_json_explicitly(self):
        response = {
            "output": {
                "choices": [{
                    "message": {
                        "content": '{"skills":[{"skill_id":"incomplete"',
                    }
                }]
            }
        }
        with patch("src.services.skill_extractor.run_sync", return_value=response):
            with self.assertRaisesRegex(RunPodRequestError, "not valid JSON"):
                extract_profile_skill_candidates([SkillEvidence("e0", None, "Project", "Used Python.")])

    def test_discards_out_of_taxonomy_skills_without_losing_valid_candidates(self):
        evidence = [SkillEvidence("e0", None, "Summary", "Used Python in a project.")]
        response = self.model_response([
            {
                "skill_id": "http://data.europa.eu/esco/skill/invented",
                "evidence_id": "e0",
                "evidence": "Python",
                "reason": "Invalid mapping",
            },
            {
                "skill_id": ESCO_PYTHON_ID,
                "evidence_id": "e0",
                "evidence": "Used Python",
                "reason": "The profile explicitly states Python was used.",
            }
        ])

        with patch("src.services.skill_extractor.run_sync", return_value=response):
            candidates = extract_profile_skill_candidates(evidence)

        self.assertEqual([candidate.skill_id for candidate in candidates], [ESCO_PYTHON_ID])

    def test_rejects_when_no_model_candidates_can_be_verified(self):
        evidence = [SkillEvidence("e0", None, "Summary", "Used a made-up tool.")]
        response = self.model_response([
            {
                "skill_id": "http://data.europa.eu/esco/skill/invented",
                "evidence_id": "e0",
                "evidence": "made-up tool",
                "reason": "Invalid mapping",
            }
        ])

        with patch("src.services.skill_extractor.run_sync", return_value=response):
            with self.assertRaisesRegex(RunPodRequestError, "could be verified"):
                extract_profile_skill_candidates(evidence)

    def test_rejects_when_model_evidence_is_not_in_the_profile_text(self):
        evidence = [SkillEvidence("e0", None, "Summary", "Used Python on a fictional project.")]
        response = self.model_response([
            {
                "skill_id": ESCO_PYTHON_ID,
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

    def test_full_ESCO_snapshot_is_required_without_local_fallback(self):
        from types import SimpleNamespace

        fallback = SimpleNamespace(
            coverage="local_subset_fallback",
            catalog=SimpleNamespace(dataset_version="v1.2.1"),
            warning="Full index checksum mismatch",
            skills={},
        )
        with patch("src.services.skill_extractor.get_occupation_index", return_value=fallback), \
             patch("src.services.skill_extractor.run_sync") as run_sync:
            with self.assertRaises(SkillTaxonomyUnavailableError):
                extract_profile_skill_candidates([SkillEvidence("e0", None, "Project", "Used Python.")])
        run_sync.assert_not_called()

    def test_runpod_timeout_has_actionable_message_and_proxy_safe_deadline(self):
        timeout = RunPodRequestError(
            "RunPod request failed.",
            category="timeout",
            elapsed_seconds=22,
            timeout_seconds=22,
        )
        with patch("src.services.skill_extractor.run_sync", side_effect=timeout) as run_sync:
            with self.assertRaisesRegex(RunPodRequestError, "timed out while waiting for RunPod"):
                extract_profile_skill_candidates([SkillEvidence("e0", None, "Project", "Used Python.")])
        self.assertEqual(run_sync.call_args.kwargs["timeout"], 90)


if __name__ == "__main__":
    unittest.main()

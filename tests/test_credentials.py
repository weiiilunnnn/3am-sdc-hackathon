"""Fictional provider fixtures; no real API calls or credentials."""
import os
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from src.models.future_roles import Money, PathwayResponse
from src.services.future_roles import credentials as c
from src.services.future_roles.resource_discovery import build_discovered_pathway, Discovery
from helpers import fixture, learning_fixture
from src.services.future_roles.future_role_matching import match_roles

URL = "https://learn.microsoft.com/credentials/applied-skills/fictional-test/"
TEXT = "# Fictional Visualization Certification\nEarn a certification after passing the exam. Assessment topics cover visualization with charts and exercises. Prerequisites: none\nExam and certificate are free.\n"


class CredentialTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {"TAVILY_API_KEY": "mock-only", "RUNPOD_API_KEY": "", "FEATURE4_DYNAMIC_DISCOVERY_ENABLED": "true"})
        self.env.start(); self.addCleanup(self.env.stop)
        c._cache.clear()
        self.profile, catalogue, self.sources = fixture()
        self.match = match_roles(self.profile, catalogue, sources=self.sources).results[0]
        self.index = SimpleNamespace(skills={s.skill_id: s for s in catalogue.skills if s.skill_id == "demo:visualization"})
        self.hit = {"title": "Fictional Visualization Certification", "url": URL}
        self.search = patch.object(c.tavily_api, "search", return_value={"results": [self.hit]}).start()
        self.extract = patch.object(c.tavily_api, "extract", return_value={"results": [{"url": URL, "raw_content": TEXT}]}).start()
        self.addCleanup(patch.stopall)

    def recommend(self):
        return c.recommend_credentials(self.profile, self.match, self.index)

    def test_verified_online_identity_mapping_fees_and_cache(self):
        items, metrics, cached = self.recommend()
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].origin, "web_discovered")
        self.assertEqual(items[0].skill_ids, ["demo:visualization"])
        self.assertTrue(items[0].fees_verified_free)
        self.assertEqual(items[0].source_urls, [URL])
        self.assertEqual(metrics["searches"], 1)
        self.assertFalse(cached)
        items[0].title = "Mutated client copy"
        again, metrics, cached = self.recommend()
        self.assertTrue(cached)
        self.assertNotEqual(again[0].title, items[0].title)
        self.assertEqual(metrics["searches"], 0)
        self.search.assert_called_once()

    def test_unknown_fees_are_not_free_and_constrained_budget_excludes(self):
        page = {"url": URL, "raw_content": TEXT.replace("Exam and certificate are free.", "Free learning course, certificate fee unknown.")}
        item = c.verify_credential(self.hit, page, self.index.skills)
        self.assertFalse(item.fees_verified_free)
        self.assertIsNone(item.exam_fee)
        self.assertTrue(c.affordable(item, None))
        self.assertFalse(c.affordable(item, Money(amount=0, currency="MYR")))

    def test_separate_fees_currency_and_total_budget(self):
        text = TEXT.replace("Exam and certificate are free.", "Exam fee: USD 10\nCertificate fee: USD 5")
        item = c.verify_credential(self.hit, {"url": URL, "raw_content": text}, self.index.skills)
        self.assertTrue(c.affordable(item, Money(amount=15, currency="USD")))
        self.assertFalse(c.affordable(item, Money(amount=14, currency="USD")))
        self.assertFalse(c.affordable(item, Money(amount=100, currency="MYR")))

    def test_reject_unsupported_unavailable_and_incorrect_provider(self):
        for text in [TEXT.replace("visualization", "unrelated topic"), TEXT.replace("Earn a certification after passing the exam.", "Practice only. No certificate is awarded."), TEXT + "\nCredential retired."]:
            with self.assertRaises(ValueError):
                c.verify_credential(self.hit, {"url": URL, "raw_content": text}, self.index.skills)
        with self.assertRaises(ValueError):
            c.verify_credential(self.hit, {"url": "https://example.org/test", "raw_content": TEXT}, self.index.skills)

    def test_missing_keys_and_unrelated_catalogue_produce_honest_empty(self):
        os.environ["TAVILY_API_KEY"] = ""
        self.assertEqual(self.recommend()[0], [])
        self.search.assert_not_called()

    def test_official_local_python_fallback_only_for_matching_requirements(self):
        os.environ["TAVILY_API_KEY"] = ""
        sid = self.match.missing_skills[0].skill_id
        self.index.skills[sid] = SimpleNamespace(name="Python", aliases=[])
        items, _, _ = self.recommend()
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].origin, "local_catalogue")
        self.assertEqual(items[0].skill_ids, [sid])
        self.assertTrue(items[0].fees_verified_free)
        self.search.assert_not_called()

    def test_provider_outage_preserves_local_fallback(self):
        sid = self.match.missing_skills[0].skill_id
        self.index.skills[sid] = SimpleNamespace(name="Python", aliases=[])
        self.search.side_effect = TimeoutError("mock outage")
        self.assertEqual(self.recommend()[0][0].origin, "local_catalogue")

    def test_runpod_plan_evaluation_and_failure_are_optional(self):
        os.environ["RUNPOD_API_KEY"] = "mock-only"
        with patch.object(c.pathway_llm, "invoke", return_value={"query": "official visualization certification exam"}) as plan, patch.object(c.pathway_llm, "evaluate", return_value=[]) as evaluate:
            items, metrics, _ = self.recommend()
            self.assertEqual(len(items), 1)
            self.assertEqual(metrics["runpod_calls"], 2)
            plan.assert_called_once(); evaluate.assert_called_once()
            self.assertNotIn(self.profile.profile_id, str(plan.call_args))
        c._cache.clear()
        with patch.object(c.pathway_llm, "invoke", side_effect=ValueError("mock invalid JSON")), patch.object(c.pathway_llm, "evaluate", side_effect=TimeoutError("mock outage")):
            self.assertEqual(len(self.recommend()[0]), 1)

    def test_pathway_contract_and_learning_coverage_stay_unchanged(self):
        local, evidence = learning_fixture()
        with patch("src.services.future_roles.resource_discovery.discover_resources", return_value=Discovery()):
            result = build_discovered_pathway(self.profile, self.match, local, self.sources | evidence, self.index)
        validated = PathwayResponse.model_validate(result.model_dump())
        self.assertEqual(len(validated.credentials), 1)
        self.assertEqual(validated.credential_metrics["searches"], 1)
        self.assertTrue(validated.target_skill_ids)
        self.assertNotIn(validated.credentials[0].credential_id, [r.resource_id for p in validated.phases for r in p.resources])


if __name__ == "__main__": unittest.main()

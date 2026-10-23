"""All provider content here is fictional mocked evidence, never live claims."""
import json
import os
import threading
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from unittest.mock import patch
from helpers import fixture, learning_fixture
from src.services.future_roles.future_role_matching import match_roles
from src.services.future_roles import resource_discovery as discovery, pathway_llm
from src.services.future_roles.resource_verification import verify, provider_url
from src.services.sources import runpod_api, tavily_api

URL = "https://learn.microsoft.com/training/modules/fictional-test-only/"
TEXT = "# Visualization tutorial\nThis fictional free course teaches visualization with a practical module and lesson. " \
       "Duration: 2 hours\nPrerequisites: none\nLearning content and exercises cover visualization."


class ResourceDiscoveryTests(unittest.TestCase):
    def setUp(self):
        credential_mock = patch("src.services.future_roles.credentials.recommend_credentials", return_value=([], {}, False))
        credential_mock.start()
        self.addCleanup(credential_mock.stop)
        self.environment = patch.dict(os.environ, {"TAVILY_API_KEY": "mock-only", "RUNPOD_API_KEY": "mock-only",
            "RUNPOD_LLM_ENDPOINT_ID": "mock-glm-only", "RUNPOD_ENDPOINT_ID": "must-not-use-rf",
            "FEATURE4_DYNAMIC_DISCOVERY_ENABLED": "true", "FEATURE4_MAX_SEARCH_QUERIES": "1"})
        self.environment.start()
        self.addCleanup(self.environment.stop)
        with discovery._lock:
            discovery._cache.clear(); discovery._pages.clear(); discovery._pending.clear()
        self.profile, self.catalogue, self.sources = fixture()
        self.match = match_roles(self.profile, self.catalogue, sources=self.sources).results[0]
        self.index = SimpleNamespace(skills={s.skill_id: s for s in self.catalogue.skills})
        self.local, evidence = learning_fixture()
        self.sources |= evidence
        self.text = TEXT
        self.hit = {"url": URL, "title": "Visualization tutorial"}
        self.llm = patch.object(runpod_api, "run_sync", side_effect=self.glm).start()
        self.search = patch.object(tavily_api, "search", side_effect=lambda *a, **k: {"results": [self.hit], "usage": {"credits": 1}}).start()
        self.extract = patch.object(tavily_api, "extract", side_effect=lambda *a, **k: {"results": [{"url": URL, "raw_content": self.text}]}).start()
        self.addCleanup(patch.stopall)

    def glm(self, endpoint, payload, **kwargs):
        self.assertEqual(endpoint, "mock-glm-only")
        self.assertEqual(payload["input"]["model"], "glm-5.3")
        self.assertEqual(payload["input"]["response_format"], {"type": "json_object"})
        data = json.loads(payload["input"]["messages"][1]["content"])
        self.assertNotIn("profile_id", data)
        if "missing_skills" in data:
            output = {"search_topics": [{"target_skill_ids": [data["missing_skills"][0]["skill_id"]],
                "query": "free visualization tutorial", "purpose": "Mock learning test"}]}
        else:
            c = data["candidates"][0]
            output = {"selections": [{"resource_id": c["resource_id"], "covered_skill_ids": c["target_skill_ids"],
                "evidence_quote": c["evidence"][:40], "rationale": "Supported by supplied excerpt"}]}
        return {"output": {"choices": [{"message": {"content": json.dumps(output)}}]}}

    def build(self):
        return discovery.build_discovered_pathway(self.profile, self.match, self.local, self.sources, self.index)

    def test_primary_flow_uses_shared_glm_twice_and_real_shape_sources(self):
        plan = self.build()
        self.assertEqual(plan.discovery_status, "live_verified")
        self.assertEqual(self.llm.call_count, 2)
        resources = [r for p in plan.phases for r in p.resources]
        self.assertEqual(len(resources), 1)
        self.assertEqual(resources[0].url, URL)
        self.assertEqual(resources[0].resource_origin, "web_discovered")
        self.assertEqual(resources[0].duration_hours, 2)
        self.assertEqual(set(resources[0].mapping_evidence), {"demo:visualization"})
        self.assertTrue(set(resources[0].source_ids) <= {s.source_id for s in plan.sources})
        self.assertEqual(self.local.resources[0].resource_origin, "local_catalogue")

    def test_missing_keys_preserve_local_fallback(self):
        os.environ["TAVILY_API_KEY"] = ""
        plan = self.build()
        self.assertEqual(plan.discovery_status, "catalogue_fallback")
        self.llm.assert_not_called(); self.search.assert_not_called()

    def test_missing_runpod_uses_bounded_deterministic_search(self):
        os.environ["RUNPOD_API_KEY"] = ""
        self.assertEqual(self.build().discovery_status, "live_verified")
        self.llm.assert_not_called()
        self.assertEqual(self.search.call_count, 1)

    def test_malformed_or_unavailable_llm_keeps_verified_resources(self):
        for error in [runpod_api.RunPodRequestError("mock outage"), {"output": {}}, {"output": {"choices": [{"message": {"content": "not JSON"}}]}}]:
            discovery._cache.clear(); discovery._pages.clear()
            self.llm.side_effect = error if isinstance(error, Exception) else None
            self.llm.return_value = error
            self.assertEqual(self.build().discovery_status, "live_verified")

    def test_unknown_query_skill_and_invented_fields_rejected(self):
        payload = {"missing_skills": [{"skill_id": "demo:visualization", "name": "visualization"}]}
        for output in [
            {"search_topics": [{"target_skill_ids": ["invented"], "query": "free tutorial", "purpose": "mock"}]},
            {"search_topics": [{"target_skill_ids": ["demo:visualization"], "query": "https://invented.test/course", "purpose": "mock"}]},
            {"search_topics": [], "course_url": "https://invented.test/course"},
        ]:
            with patch.object(pathway_llm, "invoke", return_value=output), self.assertRaises(ValueError):
                pathway_llm.plan(payload, 1, 1)

    def test_hallucinated_candidate_or_quote_rejected(self):
        c = {"resource_id": "known", "target_skill_ids": ["demo:visualization"], "evidence": "This is grounded fictional visualization evidence"}
        for changes in [{"resource_id": "invented"}, {"covered_skill_ids": ["invented"]}, {"evidence_quote": "This quote never appeared anywhere"}]:
            choice = {"resource_id": "known", "covered_skill_ids": ["demo:visualization"],
                      "evidence_quote": c["evidence"], "rationale": "mock", **changes}
            with patch.object(pathway_llm, "invoke", return_value={"selections": [choice]}), self.assertRaises(ValueError):
                pathway_llm.evaluate([c], 1)

    def test_search_quota_and_extraction_outage_fall_back(self):
        for provider in [self.search, self.extract]:
            discovery._cache.clear(); discovery._pages.clear()
            original = provider.side_effect
            provider.side_effect = tavily_api.TavilyError("quota")
            self.assertEqual(self.build().discovery_status, "catalogue_fallback")
            provider.side_effect = original

    def test_irrelevant_blocked_and_title_mismatch_rejected(self):
        for text in ["# Unrelated course\n" + "unrelated content "*20,
                     "# Visualization tutorial\nAccess denied "*10,
                     "# Visualization tutorial\n" + "This free course covers cooking lessons only. "*5]:
            with self.assertRaises(ValueError):
                verify(self.hit, {"url": URL, "raw_content": text}, {"demo:visualization": self.index.skills["demo:visualization"]}, "mock")

    def test_snippet_only_never_verified(self):
        self.extract.side_effect = lambda *a, **k: {"results": []}
        self.assertEqual(self.build().discovery_status, "catalogue_fallback")

    def test_negated_curriculum_mention_is_not_coverage(self):
        self.text = "# Visualization tutorial\n" + "This fictional free course does not cover visualization. "*4
        self.assertEqual(self.build().discovery_status, "catalogue_fallback")

    def test_unknown_price_or_free_trial_excluded_on_zero_budget(self):
        for text in [TEXT.replace("free course", "course"), TEXT + " Subscription required."]:
            discovery._cache.clear(); discovery._pages.clear(); self.text = text
            self.assertEqual(self.build().discovery_status, "catalogue_fallback")

    def test_unknown_duration_remains_unknown(self):
        self.text = TEXT.replace("Duration: 2 hours", "Duration not published")
        self.local.resources = []
        result = self.build()
        self.assertIsNone(result.estimated_weeks)
        self.assertFalse(result.all_phase_durations_known)
        self.assertIsNone(result.planning_estimate.scheduled_weeks)

    def test_partial_online_and_local_resources_are_combined(self):
        self.profile.skills = self.profile.skills[:1]
        self.match = match_roles(self.profile, self.catalogue, sources=self.sources).results[0]
        self.local.resources[0].covers_skill_ids = ["demo:sql"]
        result = self.build()
        self.assertEqual(result.discovery_status, "mixed")
        self.assertTrue(result.coverage_complete)

    def test_no_coverage_stays_uncovered(self):
        self.local.resources = []
        self.extract.side_effect = lambda *a, **k: {"results": []}
        result = self.build()
        self.assertEqual(result.discovery_status, "no_verified_resources")
        self.assertEqual(result.uncovered_skill_ids, ["demo:visualization"])
        self.assertIsNone(result.estimated_weeks)

    def test_duplicate_urls_do_not_double_count_or_break_local_ids(self):
        self.local.resources[0].url = URL
        self.sources["test:resource"].url = URL
        result = self.build()
        used = [r for p in result.phases for r in p.resources]
        self.assertEqual([r.resource_id for r in used], ["test:course"])
        self.assertEqual(result.total_known_hours, 12)

    def test_repeat_and_concurrent_requests_share_evidence_not_profile_state(self):
        first = self.build()
        second = self.build()
        self.assertTrue(second.used_cache)
        self.assertEqual(self.search.call_count, 1)
        second.phases[0].resources[0].title = "Mutated client copy"
        self.assertNotEqual(self.build().phases[0].resources[0].title, "Mutated client copy")
        self.assertEqual(first.profile_id, self.profile.profile_id)
        with discovery._lock:
            discovery._cache.clear(); discovery._pages.clear()
        self.search.reset_mock()
        with ThreadPoolExecutor(max_workers=2) as executor:
            plans = list(executor.map(lambda _: self.build(), range(2)))
        self.assertEqual(self.search.call_count, 1)
        self.assertTrue(any(p.used_cache for p in plans))

    def test_contrasting_profiles_roles_and_constraints_do_not_cross_contaminate(self):
        one = self.build()
        other = self.profile.model_copy(deep=True)
        other.profile_id = "other-fictional-user"
        other.skills = other.skills[:1]
        self.profile = other
        self.match = self.match.model_copy(update={"role_id": "another-fictional-role"})
        two = self.build()
        self.assertEqual(two.profile_id, "other-fictional-user")
        self.assertNotEqual(one.role_id, two.role_id)
        self.assertEqual(self.search.call_count, 2)
        self.assertNotIn(other.profile_id, json.dumps(self.llm.call_args_list, default=str))

    def test_limits_safe_urls_and_failed_cache_expiry(self):
        os.environ["FEATURE4_MAX_SEARCH_QUERIES"] = "500"
        self.assertEqual(discovery.setting("FEATURE4_MAX_SEARCH_QUERIES", 3, 1, 5), 5)
        for url in ["http://learn.microsoft.com/test", "https://localhost/test", "https://127.0.0.1/test",
                    "https://user:pass@learn.microsoft.com/test", "https://learn.microsoft.com.evil.test/course",
                    "https://learn.microsoft.com/", "https://learn.microsoft.com/search?q=test"]:
            with self.assertRaises(ValueError): provider_url(url)
        self.assertEqual(tavily_api.canonical_url(URL + "?utm_source=test#x"), URL)
        self.build()
        with discovery._lock:
            for k, (_, value) in list(discovery._cache.items()): discovery._cache[k] = (0, value)
        self.build()
        self.assertEqual(self.search.call_count, 2)

    def test_explicit_unmapped_prerequisites_are_not_silently_ignored(self):
        self.text = TEXT.replace("Prerequisites: none", "Prerequisites: advanced database administration")
        self.assertEqual(self.build().discovery_status, "catalogue_fallback")

    def test_paid_budget_currency_and_disabled_discovery(self):
        self.text = TEXT.replace("free course", "course") + "\nPrice: USD 10"
        self.assertEqual(self.build().discovery_status, "catalogue_fallback")
        self.profile.learning_preferences.budget.currency = "USD"
        self.profile.learning_preferences.budget.amount = 20
        self.assertEqual(self.build().discovery_status, "live_verified")
        os.environ["FEATURE4_DYNAMIC_DISCOVERY_ENABLED"] = "false"
        before = self.search.call_count
        self.assertEqual(self.build().discovery_status, "catalogue_fallback")
        self.assertEqual(self.search.call_count, before)

    def test_expired_deadline_does_not_make_provider_calls(self):
        result = discovery._retrieve({"missing_skills": []}, self.index.skills, 1, 1, 0, 60)
        self.assertEqual(result.resources, [])
        self.assertEqual(result.metrics["runpod_calls"], 0)
        self.assertEqual(result.metrics["searches"], 0)
        self.llm.assert_not_called(); self.search.assert_not_called()

    def test_tavily_http_bounds_auth_and_redirect_policy(self):
        # Restore the actual adapter while replacing its fixed-host HTTP opener.
        response = unittest.mock.MagicMock()
        response.__enter__.return_value.read.return_value = b'{"results": []}'
        opener = unittest.mock.Mock()
        opener.open.return_value = response
        with patch.object(tavily_api, "build_opener", return_value=opener):
            tavily_api._post("search", {"query": "public topic"}, 2)
            request = opener.open.call_args.args[0]
            self.assertEqual(request.full_url, "https://api.tavily.com/search")
            self.assertEqual(request.get_header("Authorization"), "Bearer mock-only")
            response.__enter__.return_value.read.assert_called_once_with(1_000_001)
            response.__enter__.return_value.read.return_value = b'x' * 1_000_001
            with self.assertRaises(tavily_api.TavilyError): tavily_api._post("extract", {}, 1)
        self.assertIsNone(tavily_api.NoRedirect().redirect_request(None, None, None, None))


if __name__ == "__main__": unittest.main()

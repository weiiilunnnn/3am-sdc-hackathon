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

    def test_scoped_search_and_separate_verification_checkpoints(self):
        from src.services.future_roles.resource_verification import PROVIDERS
        result = self.build()
        self.assertEqual(self.search.call_args.kwargs["include_domains"], PROVIDERS)
        self.assertEqual(result.discovery_metrics["candidate_urls"], 1)
        self.assertEqual(result.discovery_metrics["extracted_pages"], 1)
        self.assertEqual(result.discovery_metrics["evaluations"], 1)
        self.assertEqual(result.discovery_metrics["evaluation_valid"], 1)

    def test_google_collection_controls_are_not_course_title_evidence(self):
        url = "https://developers.google.com/machine-learning/crash-course/numerical-data/normalization"
        heading = "Numerical data: Normalization Stay organized with collections Save and categorize content based on your preferences."
        page = {"url":url, "raw_content":TEXT.replace("Visualization tutorial",heading)}
        hit = {"url":url,"title":"Numerical data: Normalization | Google for Developers"}
        resource, _, _ = verify(hit,page,self.index.skills,"fictional test")
        self.assertEqual(resource.title,"Numerical data: Normalization")
        with self.assertRaisesRegex(ValueError,"title contradiction"):
            verify({**hit,"title":"Unrelated cooking course"},page,self.index.skills,"fictional test")

    def test_planning_and_evaluation_timeouts_are_safe_and_categorised(self):
        self.llm.side_effect = runpod_api.RunPodRequestError("Safe error", category="timeout")
        with self.assertLogs("src.services.future_roles.pathway_llm", level="WARNING") as logs:
            result = self.build()
        self.assertEqual(result.discovery_status, "live_verified")
        self.assertTrue(any("course_planning category=timeout" in line for line in logs.output))
        self.assertTrue(any("course_evaluation category=timeout" in line for line in logs.output))
        self.assertEqual(result.discovery_metrics["evaluation_valid"], 0)

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

    def test_nonliteral_curriculum_becomes_related_alternative_not_esco_coverage(self):
        self.text = "# Visualization tutorial\n" + "Learn to create charts and plots from datasets with practical exercises. " * 2
        plan = self.build()
        self.assertTrue(any(r.resource_id == 'test:course' for p in plan.phases for r in p.resources))
        self.assertEqual(len(plan.alternative_resources),1)
        resource = plan.alternative_resources[0]
        self.assertEqual(resource.covers_skill_ids,[])
        self.assertEqual(resource.related_skill_ids,['demo:visualization'])
        self.assertIn('Suggested related resource',resource.alternative_reason)
        self.assertTrue(all(quote in self.text for quote in resource.mapping_evidence.values()))
        self.assertIn('visualisation',resource.relevance_notes['demo:visualization'])
        source=next(s for s in plan.sources if s.source_id in resource.source_ids)
        self.assertIn('related_learning_topic',source.supported_claims)
        self.assertNotIn('skill_mapping',source.supported_claims)
        self.assertEqual(plan.discovery_metrics['alternative_web_resources'],1)
        self.local.resources=[]
        uncovered=self.build()
        self.assertEqual(uncovered.uncovered_skill_ids,['demo:visualization'])
        self.assertEqual(uncovered.total_known_hours,0)

    def test_unknown_price_reaches_pathway_alternatives_and_preserves_local_plan(self):
        self.text=TEXT.replace('free course','course')
        plan=self.build()
        self.assertEqual(len(plan.alternative_resources),1)
        resource=plan.alternative_resources[0]
        self.assertEqual(resource.cost_status,'unknown');self.assertIsNone(resource.cost)
        self.assertIn('Price not verified',resource.alternative_reason)
        self.assertEqual(plan.total_known_hours,12)
        self.assertEqual(plan.discovery_metrics['pricing_exclusions'],1)
        self.assertEqual(plan.discovery_metrics['displayed_resources'],1)
        self.assertEqual(plan.discovery_metrics['displayed_alternatives'],1)
        self.assertEqual(plan.discovery_metrics['search_results'],1)
        self.assertEqual(plan.discovery_metrics['verified'],1)
        self.assertIn(resource.source_ids[0],{s.source_id for s in plan.sources})
        # No key material or extracted full provider page is exposed by diagnostics.
        self.assertNotIn('mock-only',json.dumps(plan.discovery_metrics))

    def test_strict_paid_budget_shows_honest_alternative_not_affordable_resource(self):
        self.text=TEXT.replace('free course','course')+'\nPrice: USD 99'
        self.profile.learning_preferences.budget.currency='USD'
        self.profile.learning_preferences.budget.amount=10
        plan=self.build()
        resource=plan.alternative_resources[0]
        self.assertEqual(resource.cost_status,'paid');self.assertEqual(resource.cost.amount,99)
        self.assertIn('budget/currency',resource.alternative_reason)
        self.assertTrue(all(r.url != URL for p in plan.phases for r in p.resources))
        self.assertTrue(any(r.resource_id == 'test:course' for p in plan.phases for r in p.resources))

    def test_free_curriculum_remains_free_and_duplicate_alternatives_are_deduplicated(self):
        plan=self.build()
        online=[r for p in plan.phases for r in p.resources if r.resource_origin=='web_discovered']
        self.assertEqual(online[0].cost_status,'free')
        self.assertIn('free_access',next(s for s in plan.sources if s.source_id in online[0].source_ids).supported_claims)
        discovery._cache.clear();discovery._pages.clear()
        self.text=TEXT.replace('free course','course')
        self.search.side_effect=lambda *a,**k:{'results':[self.hit,{**self.hit,'url':URL+'?utm_source=duplicate'}]}
        self.extract.side_effect=lambda *a,**k:{'results':[{'url':URL,'raw_content':self.text}]*2}
        plan=self.build()
        self.assertEqual(len(plan.alternative_resources),1)
        self.assertEqual(plan.discovery_metrics['candidate_urls'],1)

    def test_unrelated_and_inaccessible_pages_have_distinct_failure_counters(self):
        for content,field in [('# Visualization tutorial\n'+'This course teaches cooking recipes and practical kitchen lessons. '*3,'skill_relevance_failures'),
                              ('# Visualization tutorial\n'+'Access denied. '*10,'content_verification_failures')]:
            discovery._cache.clear();discovery._pages.clear();self.text=content
            plan=self.build()
            self.assertEqual(plan.alternative_resources,[])
            self.assertEqual(plan.discovery_metrics[field],1)

    def test_related_topics_do_not_override_negation_or_search_snippet_only(self):
        for curriculum in ('This course does not cover charts or plots.', 'This course teaches cooking only.'):
            self.hit['content']='Learn charts and plots for visualization'
            self.text='# Visualization tutorial\n'+curriculum*5
            with self.assertRaises(ValueError):
                verify(self.hit,{'url':URL,'raw_content':self.text},{'demo:visualization':self.index.skills['demo:visualization']},'mock')

    def test_topic_reordering_uses_provider_evidence_not_invented_equivalence(self):
        from types import SimpleNamespace
        text='# Visualization tutorial\n'+'Learn to analyse datasets in practical exercises and turn findings into useful summaries. '*2
        resource, source, _=verify(self.hit,{'url':URL,'raw_content':text},
            {'fixture:data-analysis':SimpleNamespace(name='perform data analysis',aliases=[])},'mock')
        self.assertEqual(resource.related_skill_ids,['fixture:data-analysis'])
        self.assertEqual(resource.covers_skill_ids,[])
        self.assertTrue(all(value in text for value in resource.mapping_evidence.values()))

    def test_unknown_duration_remains_unknown(self):
        self.text = TEXT.replace("Duration: 2 hours", "Duration not published")
        self.local.resources = []
        result = self.build()
        self.assertIsNone(result.estimated_weeks)
        self.assertFalse(result.all_phase_durations_known)
        self.assertIsNone(result.planning_estimate.scheduled_weeks)

    def test_free_referenced_curriculum_is_not_free_course_access(self):
        # Official Microsoft page retrieved 2026-10-23; a linked curriculum's
        # licensing does not establish this video course's access conditions.
        text = ("# Machine Learning for Beginners\n"
                "Welcome to this course on classical machine learning for beginners! "
                "This course is based on the free, open-source, 26-lesson "
                "[ML For Beginners](https://aka.ms/ml-beginners) curriculum from Microsoft.")
        from types import SimpleNamespace
        url = "https://learn.microsoft.com/en-us/shows/machine-learning-for-beginners"
        resource, source, _ = verify({"url":url,"title":"Machine Learning for Beginners"},
            {"url":url,"raw_content":text},
            {"test:ml":SimpleNamespace(name="machine learning",aliases=[])},"machine learning")
        self.assertEqual(resource.cost_status,"unknown")
        self.assertNotIn("free_access",source.supported_claims)
        self.assertIsNone(resource.duration_hours)

    def test_documentation_is_not_relabelled_as_a_course(self):
        self.hit["title"] = "Visualization documentation"
        page = {"url":URL,"raw_content":TEXT.replace("Visualization tutorial","Visualization documentation")}
        resource, _, _ = verify(self.hit,page,self.index.skills,"fictional test")
        self.assertEqual(resource.resource_type,"documentation")

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

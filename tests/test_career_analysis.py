"""Pinned ESCO grouping with mocked shared Runpod; never spends provider credits."""
from concurrent.futures import ThreadPoolExecutor
import copy
import json
import os
import time
import unittest
from unittest.mock import patch

from src.models.career_analysis import AnalysisRequest
from src.services.future_roles import career_analysis as service
from src.services.future_roles.occupation_index import get_occupation_index
from src.services.future_roles.profile_relevance import development_areas
from src.services.sources import runpod_api


class CareerAnalysisTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.index = get_occupation_index()
        cls.role = next(r for r in cls.index.roles.values() if r.title.casefold() == "data scientist")

    def setUp(self):
        env = patch.dict(os.environ, {"RUNPOD_API_KEY": "mock-only", "RUNPOD_LLM_ENDPOINT_ID": "mock-glm-only", "RUNPOD_ENDPOINT_ID": "must-not-use-rf", "TAVILY_API_KEY": ""})
        env.start(); self.addCleanup(env.stop)
        service._cache.clear(); service._pending.clear()
        self.ids = [r.skill_id for r in self.role.required_skills[:3]]
        self.request = AnalysisRequest(role_id=self.role.role_id, recognised_skill_ids=self.ids, generate_ai=True)
        self.bundle = service.prepare_analysis(self.request, self.index)
        self.raw = self.output(self.bundle)
        self.invoke = patch.object(service, "invoke", return_value=self.raw).start()
        self.addCleanup(patch.stopall)

    @staticmethod
    def output(bundle):
        result, payload, groups, matched, _ = bundle
        evidence = {e.evidence_id: e.text for e in result.evidence}
        raw = {"role_id": result.role_id, "groups": [], "bridges": []}
        for group in payload["groups"]:
            eid = groups[group["group_id"]][0]
            raw["groups"].append({"group_id": group["group_id"], "why_relevant": "Developing this area may help you explore the documented role requirements.", "evidence_ids": [eid], "evidence_quote": evidence[eid]})
        if matched and groups:
            sid, eid = next(iter(matched.items()))
            gid, target_ids = next(iter(groups.items()))
            raw["bridges"] = [{"matched_skill_ids": [sid], "target_group_id": gid,
                "explanation": "Your recognised capability could support learning this related area; further assessment is needed.",
                "evidence_ids": [eid, target_ids[0]], "evidence_quote": evidence[target_ids[0]]}]
        return raw

    def test_complete_unique_grouping_and_legacy_display_unchanged(self):
        result = self.bundle[0]
        expected = {r.skill_id for r in self.role.required_skills if r.skill_id not in self.ids}
        actual = [r.skill_id for g in result.groups for r in g.concepts]
        self.assertEqual(set(actual), expected)
        self.assertEqual(len(actual), len(expected))
        self.assertEqual(len({g.group_id for g in result.groups}), len(result.groups))
        self.assertEqual(result.not_evidenced_count, len(expected))
        self.assertEqual({r.skill_id for r in result.matched}, set(self.ids))
        self.assertTrue(any(r.requirement == "optional" for g in result.groups for r in g.concepts))
        legacy, _ = development_areas(self.role, set(self.ids), self.index)
        self.assertLessEqual(len(legacy), 5)
        for group in legacy:
            self.assertTrue(all(self.index.edges[self.role.role_id][sid].requirement == "essential" for sid in group.supporting_concept_ids))

    def test_evidence_only_is_immediate_and_never_calls_model(self):
        request = self.request.model_copy(update={"generate_ai": False})
        result = service.analyse_career(request, self.index)
        self.assertTrue(result.groups)
        self.assertEqual(result.interpretations, [])
        self.invoke.assert_not_called()

    def test_valid_batched_response_and_identical_request_cached(self):
        result = service.analyse_career(self.request, self.index)
        self.assertEqual(result.status, "ready")
        self.assertTrue(result.bridges)
        self.assertEqual(result.matched, self.bundle[0].matched)
        self.assertEqual(result.groups, self.bundle[0].groups)
        again = service.analyse_career(self.request.model_copy(update={"recognised_skill_ids": list(reversed(self.ids))}), self.index)
        self.assertTrue(again.used_cache)
        self.assertEqual(again.evidence_key, result.evidence_key)
        self.invoke.assert_called_once()
        payload = self.invoke.call_args.args[0]
        self.assertNotIn("profile_id", json.dumps(payload))
        self.assertLessEqual(self.invoke.call_args.kwargs["timeout"], 25)

    def test_profiles_and_evidence_versions_do_not_mix(self):
        first = service.analyse_career(self.request, self.index)
        other = self.request.model_copy(update={"recognised_skill_ids": self.ids[:1]})
        bundle = service.prepare_analysis(other, self.index)
        self.invoke.return_value = self.output(bundle)
        second = service.analyse_career(other, self.index)
        self.assertNotEqual(first.evidence_key, second.evidence_key)
        self.assertEqual(len(second.matched), 1)
        changed = copy.copy(self.index); changed.fingerprint += "-changed"
        self.assertNotEqual(service.prepare_analysis(other, changed)[0].evidence_key, second.evidence_key)
        self.assertEqual(self.invoke.call_count, 2)

    def test_bad_ids_urls_extra_claims_and_quotes_rejected(self):
        mutations = []
        raw = copy.deepcopy(self.raw); raw["groups"][0]["group_id"] = "invented"; mutations.append(raw)
        raw = copy.deepcopy(self.raw); raw["groups"][0]["evidence_ids"] = ["invented"]; mutations.append(raw)
        raw = copy.deepcopy(self.raw); raw["groups"][0]["evidence_quote"] = "fabricated supporting quotation"; mutations.append(raw)
        raw = copy.deepcopy(self.raw); raw["groups"][0]["why_relevant"] = "You may visit https://fake.example for invented information."; mutations.append(raw)
        raw = copy.deepcopy(self.raw); raw["score"] = 100; mutations.append(raw)
        raw = copy.deepcopy(self.raw); raw["role_id"] = "invented"; mutations.append(raw)
        raw = copy.deepcopy(self.raw); raw["groups"].append(raw["groups"][0]); mutations.append(raw)
        raw = copy.deepcopy(self.raw); raw["groups"][0]["why_relevant"] = "This may have high impact in your future work."; mutations.append(raw)
        raw = copy.deepcopy(self.raw); raw["groups"][0]["why_relevant"] = "This requirement guarantees competence in the occupation."; mutations.append(raw)
        raw = copy.deepcopy(self.raw); raw["bridges"][0]["matched_skill_ids"] = [self.bundle[0].groups[0].concepts[0].skill_id]; mutations.append(raw)
        raw = copy.deepcopy(self.raw); raw["bridges"][0]["evidence_ids"] = raw["groups"][0]["evidence_ids"]; mutations.append(raw)
        for raw in mutations:
            with self.assertRaises(ValueError):
                service.validate_analysis(raw, *self.bundle[:4])

    def test_missing_keys_timeout_bad_json_keep_complete_matrix(self):
        os.environ["RUNPOD_API_KEY"] = ""
        result = service.analyse_career(self.request, self.index)
        self.assertEqual(result.status, "unavailable")
        self.assertEqual(result.groups, self.bundle[0].groups)
        self.invoke.assert_not_called()
        os.environ["RUNPOD_API_KEY"] = "mock-only"
        for failure in [TimeoutError("mock timeout"), ValueError("mock bad JSON")]:
            service._cache.clear()
            self.invoke.side_effect = failure
            result = service.analyse_career(self.request, self.index)
            self.assertEqual(result.groups, self.bundle[0].groups)
            self.assertEqual(result.bridges, [])
            self.assertEqual(result.status, "unavailable")

    def test_partial_groups_are_explicit_and_never_drop_matrix_concepts(self):
        raw = copy.deepcopy(self.raw); raw["groups"] = raw["groups"][:1]
        self.invoke.return_value = raw
        result = service.analyse_career(self.request, self.index)
        self.assertEqual(result.status, "partial")
        self.assertEqual(result.not_evidenced_count, self.bundle[0].not_evidenced_count)

    def test_empty_profile_and_all_requirements_truthful(self):
        empty = self.request.model_copy(update={"recognised_skill_ids": []})
        self.invoke.return_value = self.output(service.prepare_analysis(empty, self.index))
        result = service.analyse_career(empty, self.index)
        self.assertEqual(result.matched, [])
        self.assertEqual(result.bridges, [])
        self.assertEqual(result.not_evidenced_count, len(self.role.required_skills))
        all_skills = self.request.model_copy(update={"recognised_skill_ids": list(self.index.edges[self.role.role_id])})
        self.invoke.reset_mock()
        result = service.analyse_career(all_skills, self.index)
        self.assertEqual(result.groups, [])
        self.assertIn("does not establish job readiness", result.message)
        self.invoke.assert_not_called()

    def test_concurrent_identical_requests_share_one_call(self):
        def slow(*args, **kwargs):
            time.sleep(.08)
            return self.raw
        self.invoke.side_effect = slow
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: service.analyse_career(self.request, self.index), range(2)))
        self.assertEqual([r.status for r in results], ["ready", "ready"])
        self.invoke.assert_called_once()

    def test_shared_glm_transport_and_endpoint_conventions(self):
        from src.services.future_roles.pathway_llm import invoke
        with patch.object(service, "invoke", wraps=invoke), patch.object(runpod_api, "run_sync", return_value={"output": {"choices": [{"message": {"content": json.dumps(self.raw)}}]}}) as transport:
            result = service.analyse_career(self.request, self.index)
        self.assertEqual(result.status, "ready")
        endpoint, body = transport.call_args.args
        self.assertEqual(endpoint, "mock-glm-only")
        self.assertEqual(body["input"]["model"], "glm-5.3")
        self.assertEqual(body["input"]["response_format"], {"type": "json_object"})

    def test_blank_override_uses_shared_team_glm_default(self):
        from src.services.future_roles.pathway_llm import invoke
        from src.services.sdg_text import LLM_ENDPOINT_ID
        os.environ["RUNPOD_LLM_ENDPOINT_ID"] = ""
        with patch.object(service, "invoke", wraps=invoke), patch.object(runpod_api, "run_sync", return_value={"output": {"choices": [{"message": {"content": json.dumps(self.raw)}}]}}) as transport:
            result = service.analyse_career(self.request, self.index)
        self.assertEqual(result.status, "ready")
        self.assertEqual(transport.call_args.args[0], LLM_ENDPOINT_ID)


class CareerAnalysisAPITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from fastapi.testclient import TestClient
        from src.main import app
        cls.client = TestClient(app)
        cls.index = get_occupation_index()
        cls.role = next(r for r in cls.index.roles.values() if r.title.casefold() == "data scientist")

    def test_additive_response_and_existing_detail_survive_missing_keys(self):
        before = self.client.get("/api/v2/roles/detail", params={"role_id": self.role.role_id}).json()
        with patch.dict(os.environ, {"RUNPOD_API_KEY": "", "TAVILY_API_KEY": ""}), patch.object(runpod_api, "run_sync", side_effect=AssertionError("No provider call authorised")):
            payload = {"role_id": self.role.role_id, "recognised_skill_ids": [self.role.required_skills[0].skill_id]}
            for ai in [False, True]:
                response = self.client.post("/api/v2/roles/analysis", json={**payload, "generate_ai": ai})
                self.assertEqual(response.status_code, 200)
                data = response.json()
                self.assertEqual(data["status"], "unavailable")
                self.assertEqual(len(data["matched"]), 1)
                self.assertEqual(data["not_evidenced_count"], len(self.role.required_skills)-1)
                self.assertEqual(data["bridges"], [])
        self.assertEqual(before, self.client.get("/api/v2/roles/detail", params={"role_id": self.role.role_id}).json())

    def test_unknown_role_skill_and_extra_payload_rejected(self):
        response = self.client.post("/api/v2/roles/analysis", json={"role_id": "unknown"})
        self.assertEqual(response.status_code, 404)
        for extra in [{"recognised_skill_ids": ["invented"]}, {"profile_name": "unnecessary PII"}]:
            response = self.client.post("/api/v2/roles/analysis", json={"role_id": self.role.role_id, **extra})
            self.assertEqual(response.status_code, 422)


if __name__ == "__main__": unittest.main()

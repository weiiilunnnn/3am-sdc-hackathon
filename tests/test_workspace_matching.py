"""Saved profiles resolve against the real local ESCO index, never invented IDs."""
import os
import tempfile
import unittest
from copy import deepcopy
from unittest.mock import patch

from fastapi.testclient import TestClient
from src.main import app
from src.data.sample_profiles import get_sample_profiles
from src.models.profiles import ProfileInput
from src.services.profile_service import create_profile
from src.services.future_roles.occupation_index import get_occupation_index
from src.services.future_roles.workspace_profile import adapt_workspace_profile


class WorkspaceMatchingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.index = get_occupation_index()
        cls.client = TestClient(app)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.environment = patch.dict(os.environ, {"APP_DB_PATH": os.path.join(self.temp.name, "profiles.sqlite3")})
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.draft = deepcopy(get_sample_profiles()[0])
        for key in ("sample_id", "label", "taxonomy"):
            self.draft.pop(key, None)

    def save(self, skills):
        self.draft["skills"] = skills
        return create_profile(ProfileInput.model_validate(self.draft))

    @staticmethod
    def skill(name, skill_id=None, custom=False):
        return {"name": name, "skill_id": skill_id, "proficiency": "intermediate", "force_custom": custom, "evidence_record_ids": []}

    def test_local_python_alias_maps_to_one_real_concept(self):
        saved = self.save([self.skill("Python programming", "local:python-programming")])
        profile = adapt_workspace_profile(saved, self.index)
        expected = self.index.aliases["python"]
        self.assertEqual(len(expected), 1)
        self.assertEqual({s.skill_id for s in profile.skills}, expected)
        self.assertEqual(profile.skills[0].name, self.index.skills[next(iter(expected))].name)
        self.assertEqual(profile.unresolved_skills, [])

    def test_ambiguous_unknown_and_aspirational_skills_are_not_scored(self):
        saved = self.save([self.skill("SQL", custom=True), self.skill("Fictional unknown skill 123", custom=True)])
        self.assertGreater(len(self.index.aliases["sql"]), 1)
        saved.skills_to_develop = ["Python"]
        profile = adapt_workspace_profile(saved, self.index)
        self.assertEqual(profile.skills, [])
        self.assertEqual(set(profile.unresolved_skills), {"SQL", "Fictional unknown skill 123"})

    def test_duplicate_aliases_count_once_and_zero_hours_do_not_fail_contract(self):
        saved = self.save([self.skill("Python", custom=True), self.skill("programming in Python", custom=True)])
        saved.learning_preferences.weekly_hours = 0
        saved.learning_preferences.budget_myr = 0
        profile = adapt_workspace_profile(saved, self.index)
        self.assertEqual(len(profile.skills), 1)
        self.assertIsNone(profile.learning_preferences.hours_per_week)
        self.assertEqual(profile.learning_preferences.budget.amount, 0)
        self.assertEqual(profile.learning_preferences.budget.currency, "MYR")

    def test_endpoint_reads_updates_and_existing_matching_contract_accepts_result(self):
        saved = self.save([self.skill("Python programming", "local:python-programming")])
        url = f"/api/v2/profiles/{saved.id}"
        original = self.client.get(url)
        self.assertEqual(original.status_code, 200)
        self.draft["skills"].append(self.skill("Machine learning", "local:machine-learning"))
        update = self.client.put(f"/api/profiles/{saved.id}", json=self.draft)
        self.assertEqual(update.status_code, 200)
        adapted = self.client.get(url).json()
        self.assertGreater(len(adapted["skills"]), len(original.json()["skills"]))
        response = self.client.post("/api/v2/matches", json={"schema_version": "2.0", "profile": adapted, "page_size": 5})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["unknown_user_skills"], [])
        self.assertTrue(all(s["skill_id"] in self.index.skills for s in adapted["skills"]))

    def test_missing_saved_profile_is_explicit(self):
        response = self.client.get("/api/v2/profiles/missing")
        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()

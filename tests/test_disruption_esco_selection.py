"""Regression: SH ESCO IDs must be selectable in Main's disruption endpoint.

A profile-supplied URI is accepted ONLY when it is an exact member of that
profile, and it is never implicitly treated as an observed skill transition.
"""
import os
import tempfile
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from src.main import app
from src.services.disruption_outlook import DisruptionRequest, _selected
from src.services.esco_skill_mapper import normalise_skill


class DisruptionESCOSelectionTests(unittest.TestCase):
    def setUp(self):
        mapped = normalise_skill("Python")
        self.assertIsNotNone(mapped["esco_uri"])
        self.name = mapped["canonical_name"]
        self.skill_id = mapped["esco_uri"]
        self.payload = {
            "profile": {
                "occupation": "", "field_of_study": "Computer Science",
                "skills": [{"name": self.name, "skill_id": self.skill_id}],
                "work_tasks": [], "aspiration": "",
            },
            "skill_id": self.skill_id,
            "occupation_code": None,
        }

    def test_raw_esco_id_is_selectable_and_not_assumed_local(self):
        selected = _selected(DisruptionRequest.model_validate(self.payload))
        self.assertEqual(selected["name"], self.name)
        self.assertEqual(selected["key"], "local:python-programming")

    def test_unknown_id_not_in_profile_is_rejected(self):
        payload = dict(self.payload, skill_id="http://data.europa.eu/esco/skill/00000000-0000-0000-0000-000000000000")
        with self.assertRaisesRegex(ValueError, "not in this session"):
            _selected(DisruptionRequest.model_validate(payload))

    def test_disruption_assess_returns_explicit_evidence_status_not_422(self):
        with tempfile.TemporaryDirectory() as tmp, patch.dict(os.environ, {"APP_DB_PATH": tmp + "/app.sqlite3"}):
            with TestClient(app) as client:
                response = client.post("/api/trends/disruption-assess", json=self.payload)
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body["category"], "insufficient_evidence")
        self.assertEqual(body["status"], "insufficient_evidence")


if __name__ == "__main__":
    unittest.main()

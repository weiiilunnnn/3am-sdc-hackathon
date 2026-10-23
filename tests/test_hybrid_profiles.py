"""Hybrid storage uses the existing database and ESCO adapter, with providers off."""
import os
import tempfile
import unittest
from copy import deepcopy
from unittest.mock import patch
from fastapi.testclient import TestClient
from src.main import app
from src.data.sample_profiles import get_sample_profiles


class HybridProfileTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, {"APP_DB_PATH": self.tmp.name + "/app.sqlite3", "RUNPOD_API_KEY": "", "TAVILY_API_KEY": ""})
        self.env.start()
        self.client = TestClient(app)
        self.draft = deepcopy(get_sample_profiles()[0])
        for k in ("sample_id", "label", "taxonomy"):
            self.draft.pop(k, None)
        self.draft.update(synthetic_demo=False, years_experience=None, status="unknown", career_aspirations="",
            skills=[{"name": s, "proficiency": "unknown"} for s in ("Python", "SQL", "Data Analysis")],
            registration_profile={"firstName": "Fixture", "lastName": "Learner", "educationLevel": "Bachelor’s degree", "major": "Computing", "skills": ["Python", "SQL", "Data Analysis"], "cgpa": "3.5"})

    def tearDown(self):
        self.client.close()
        self.env.stop()
        self.tmp.cleanup()

    def create(self, key=None):
        response = self.client.post('/api/profiles', json=self.draft, headers={"Idempotency-Key": key} if key else {})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def test_real_unknown_snapshot_and_esco_ambiguity_roundtrip(self):
        saved = self.create()
        raw = self.client.get('/api/profiles/' + saved['id']).json()
        self.assertFalse(raw['synthetic_demo'])
        self.assertIsNone(raw['years_experience'])
        self.assertEqual(raw['registration_profile']['cgpa'], '3.5')
        self.assertTrue(all(s['proficiency'] == 'unknown' for s in raw['skills']))
        esco = self.client.get('/api/v2/profiles/' + saved['id'])
        self.assertEqual(esco.status_code, 200, esco.text)
        profile = esco.json()
        self.assertFalse(profile['is_synthetic'])
        self.assertEqual(profile['unresolved_skills'], ['SQL'])
        self.assertEqual({s['name'] for s in profile['skills']}, {'Python (computer programming)', 'statistics'})
        matches = self.client.post('/api/v2/matches', json={'schema_version':'2.0','profile':profile})
        self.assertEqual(matches.status_code, 200, matches.text)
        for role in matches.json()['results'][:1]:
            analysis = self.client.post('/api/v2/roles/analysis', json={'role_id':role['role_id'],'recognised_skill_ids':[s['skill_id'] for s in profile['skills']], 'generate_ai':False})
            self.assertEqual(analysis.status_code, 200)
            path = self.client.post('/api/pathways', json={'schema_version':'1.0','profile':profile,'role_id':role['role_id']})
            self.assertEqual(path.status_code, 200, path.text)
            self.assertFalse(path.json()['is_synthetic'])

    def test_retried_creation_never_overwrites_or_duplicates(self):
        key = 'hybrid-test-retry-identity'
        first = self.create(key)
        self.draft['professional_summary'] = 'A changed retry must not overwrite the saved profile.'
        second = self.create(key)
        self.assertEqual(first, second)

    def test_revision_conflict_preserves_evidence_and_newer_data(self):
        first = self.create()
        self.draft['professional_summary'] = 'Updated once.'
        self.draft['skills'][0]['name'] = 'Python programming'
        response = self.client.put('/api/profiles/'+first['id'],json=self.draft,headers={'If-Match':first['updated_at']})
        self.assertEqual(response.status_code, 200)
        self.assertNotEqual(response.json()['updated_at'], first['updated_at'])
        self.assertEqual(response.json()['skills'][0]['input_names'], ['Python', 'Python programming'])
        stale = self.client.put('/api/profiles/'+first['id'],json=self.draft,headers={'If-Match':first['updated_at']})
        self.assertEqual(stale.status_code, 409)
        self.assertEqual(self.client.get('/api/profiles/'+first['id']).json()['professional_summary'], 'Updated once.')

    def test_snapshot_limits_and_bad_values_are_rejected(self):
        self.draft['registration_profile']['photoDataUrl'] = 'https://example.org/photo'
        self.assertEqual(self.client.post('/api/profiles',json=self.draft).status_code,422)
        self.draft['registration_profile'].pop('photoDataUrl')
        self.draft['years_experience'] = -1
        self.assertEqual(self.client.post('/api/profiles',json=self.draft).status_code,422)

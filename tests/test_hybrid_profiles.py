"""Hybrid storage uses the existing database and ESCO adapter, with providers off."""
import os
import tempfile
import time
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

    def wait_for_skill_job(self, job_id):
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            response = self.client.get(f'/api/profiles/extract-profile-skills/{job_id}')
            if response.status_code != 200 or response.json()['status'] == 'completed':
                return response
            time.sleep(0.01)
        self.fail('Skill extraction job did not finish within the test deadline.')

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

    def test_main_email_and_taxonomy_links_preserved_without_bypassing_esco(self):
        snapshot = self.draft['registration_profile']
        snapshot['email'] = 'fictional@example.invalid'
        # Snapshot metadata is retained, never trusted as an ESCO identifier.
        snapshot['skillLinks'] = [{'name':'Python','skill_id':'untrusted-display-id','taxonomy_source':'Local prototype vocabulary'}]
        first = self.create('main-extraction-metadata-test')
        self.assertEqual(first['registration_profile']['email'], snapshot['email'])
        self.assertEqual(first['registration_profile']['skillLinks'], snapshot['skillLinks'])
        profile = self.client.get('/api/v2/profiles/'+first['id']).json()
        self.assertNotIn('untrusted-display-id', [s['skill_id'] for s in profile['skills']])
        self.assertEqual(profile['unresolved_skills'], ['SQL'])
        self.draft['registration_profile']['email'] = 'updated@example.invalid'
        response = self.client.put('/api/profiles/'+first['id'],json=self.draft,headers={'If-Match':first['updated_at']})
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(response.json()['registration_profile']['email'],'updated@example.invalid')

    def test_reviewed_ai_skill_uses_same_profile_and_esco_adapter(self):
        import json
        response = {'output':{'choices':[{'message':{'content':json.dumps({'skills':[
            {'skill_id':'http://data.europa.eu/esco/skill/not-in-taxonomy','evidence_id':'e0',
             'evidence':'using Python','reason':'Invalid taxonomy result.'},
            {'skill_id':'http://data.europa.eu/esco/skill/ccd0a1d9-afda-43d9-b901-96344886e14d','evidence_id':'e0',
             'evidence':'using Python','reason':'Explicit activity in the fictional project.'}]})}}]}}
        with patch('src.services.skill_extractor.run_sync',return_value=response):
            started = self.client.post('/api/profiles/extract-profile-skills',
                headers={'X-Synthetic-Demo-Confirmed':'true'},json={'evidence':[{
                    'source_id':'project-1','source_label':'Projects','text':'Built a chart using Python.'}]})
            self.assertEqual(started.status_code,202,started.text)
            extracted = self.wait_for_skill_job(started.json()['job_id'])
        self.assertEqual(extracted.status_code,200,extracted.text)
        candidate = extracted.json()['skills'][0]
        self.draft['projects'] = [{'id':'project-1','title':'Fictional chart','description':'Built a chart using Python.','skill_ids':[]}]
        # Explicitly reviewed candidate replaces only the matching draft entry.
        self.draft['skills'][0].update(name=candidate['canonical_name'],skill_id=candidate['skill_id'],evidence_record_ids=candidate['evidence_record_ids'])
        saved = self.create('reviewed-ai-hybrid-profile')
        self.assertEqual(len(saved['skills']),3)  # Manual SQL/Data Analysis retained.
        python = next(s for s in saved['skills'] if s['skill_id']==candidate['skill_id'])
        self.assertEqual(python['taxonomy_source'], 'ESCO v1.2.1')
        self.assertEqual(python['evidence_record_ids'],['project-1'])
        esco = self.client.get('/api/v2/profiles/'+saved['id']).json()
        self.assertIn('Python (computer programming)',[s['name'] for s in esco['skills']])
        self.assertEqual(esco['unresolved_skills'],['SQL'])

    def test_esco_skill_search_returns_only_canonical_skill_concepts(self):
        response = self.client.get('/api/v2/skills?q=statistics')
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body['data_source_status'], 'local_full')
        self.assertTrue(body['skills'])
        self.assertTrue(all(skill['skill_id'].startswith('http://data.europa.eu/esco/skill/') for skill in body['skills']))

    def test_esco_skill_search_supports_multiple_terms_in_one_request(self):
        response = self.client.get('/api/v2/skills', params={
            'q': 'Python (computer programming)|perform data analysis|machine learning|communication|solve problems|think critically',
        })
        self.assertEqual(response.status_code, 200, response.text)
        names = {skill['name'] for skill in response.json()['skills']}
        self.assertTrue({
            'Python (computer programming)',
            'perform data analysis',
            'machine learning',
            'communication',
            'solve problems',
            'think critically',
        } <= names)

    def test_skill_extraction_returns_503_when_full_esco_snapshot_is_unavailable(self):
        from types import SimpleNamespace

        fallback = SimpleNamespace(
            coverage='local_subset_fallback',
            catalog=SimpleNamespace(dataset_version='v1.2.1'),
            warning='Full index checksum mismatch',
            skills={},
        )
        with patch('src.services.skill_extractor.get_occupation_index', return_value=fallback), \
             patch('src.services.skill_extractor.run_sync') as run_sync:
            started = self.client.post(
                '/api/profiles/extract-profile-skills',
                headers={'X-Synthetic-Demo-Confirmed': 'true'},
                json={'evidence': [{'source_id': 'p1', 'source_label': 'Project', 'text': 'Used Python.'}]},
            )
            self.assertEqual(started.status_code, 202, started.text)
            response = self.wait_for_skill_job(started.json()['job_id'])
        self.assertEqual(response.status_code, 503, response.text)
        self.assertIn('Verified full ESCO v1.2.1', response.json()['detail'])
        run_sync.assert_not_called()

    def test_runpod_timeout_is_returned_as_actionable_502(self):
        from src.services.sources.runpod_api import RunPodRequestError

        with patch(
            'src.services.skill_extractor.run_sync',
            side_effect=RunPodRequestError('provider timed out', category='timeout', timeout_seconds=90),
        ):
            started = self.client.post(
                '/api/profiles/extract-profile-skills',
                headers={'X-Synthetic-Demo-Confirmed': 'true'},
                json={'evidence': [{'source_id': 'p1', 'source_label': 'Project', 'text': 'Used Python.'}]},
            )
            self.assertEqual(started.status_code, 202, started.text)
            response = self.wait_for_skill_job(started.json()['job_id'])
        self.assertEqual(response.status_code, 502, response.text)
        self.assertIn('timed out while waiting for RunPod', response.json()['detail'])

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

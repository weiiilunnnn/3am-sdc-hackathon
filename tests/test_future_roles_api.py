import unittest
from fastapi.testclient import TestClient
from src.main import app


class APITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.bootstrap = cls.client.get('/api/bootstrap').json()

    def test_existing_routes(self):
        self.assertEqual(self.client.get('/api/health').status_code, 200)
        self.assertEqual(self.client.post('/api/summarize', json={'values': [1, 2, 3]}).json()['average'], 2)

    def test_multiple_profiles_and_role_paths(self):
        first_roles = []
        for p in self.bootstrap['profiles']:
            payload = {'schema_version': '1.0', 'profile': p, 'trend_snapshot_id': 'demo-trend-a'}
            response = self.client.post('/api/matches', json=payload)
            self.assertEqual(response.status_code, 200, response.text)
            matches = response.json()
            self.assertEqual(len(matches['results']), 5)
            first_roles.append(matches['results'][0]['role_id'])
            full = self.client.post('/api/matches', json={**payload, 'top_k': 100}).json()
            self.assertEqual(len(full['results']), 15)
            for match in full['results']:
                response = self.client.post('/api/pathways', json={**payload, 'role_id': match['role_id']})
                self.assertEqual(response.status_code, 200, response.text)
                pathway = response.json()
                self.assertEqual(pathway['role_id'], match['role_id'])
                self.assertEqual(pathway['profile_fingerprint'], matches['profile_fingerprint'])
        self.assertGreater(len(set(first_roles)), 1)

    def test_validation_and_unknown_role(self):
        payload = {'schema_version': '1.0', 'profile': self.bootstrap['profiles'][0]}
        self.assertEqual(self.client.post('/api/matches', json={**payload, 'top_k': 0}).status_code, 422)
        self.assertEqual(self.client.post('/api/matches', json={**payload, 'trend_snapshot_id': 'unknown'}).status_code, 422)
        self.assertEqual(self.client.post('/api/pathways', json={**payload, 'role_id': 'invented'}).status_code, 404)
        payload['profile'] = {**payload['profile'], 'is_synthetic': False}
        self.assertEqual(self.client.post('/api/matches', json=payload).status_code, 422)

    def test_missing_snapshot_empty_and_unknown_skills(self):
        profile = {**self.bootstrap['profiles'][0], 'skills': []}
        self.assertEqual(self.client.post('/api/matches', json={'schema_version': '1.0', 'profile': profile}).json()['results'], [])
        profile['skills'] = [{'skill_id': 'unmapped', 'name': 'unknown skill'}]
        response = self.client.post('/api/matches', json={'schema_version': '1.0', 'profile': profile}).json()
        self.assertEqual(response['unmatched_user_skills'], ['unknown skill'])
        self.assertEqual(response['results'], [])

    def test_contract_docs(self):
        response = self.client.get('/openapi.json')
        self.assertEqual(response.status_code, 200)
        self.assertIn('PathwayResponse', response.json()['components']['schemas'])

    def test_inline_trend_sdg_and_scenario_interfaces(self):
        from src.services.future_roles.data_repository import load_catalogues
        bundle = load_catalogues()
        request = {'schema_version': '1.0', 'profile': self.bootstrap['profiles'][0],
                   'trend_snapshot': bundle.snapshots['demo-trend-b'].model_dump(mode='json'),
                   'scenario_config': {'schema_version': '1.0', 'scenario_id': 'moderate', 'version': 'test-v1',
                       'is_synthetic': True, 'display_label': 'Illustrative test scenario', 'assumptions': [],
                       'model_method': 'not-yet-defined', 'source_ids': ['demo:fixture:001'], 'disclaimer': 'Not a forecast.'},
                   'sdg_mappings': {'schema_version': '1.0', 'snapshot_id': 'test-empty', 'role_sdg_mappings': {}, 'skill_sdg_mappings': {}}}
        response = self.client.post('/api/matches', json=request)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()['scenario_context']['scenario_id'], 'moderate')
        self.assertEqual(response.json()['results'][0]['market_outlook']['direction'], 'declining')
        request['sdg_mappings']['role_sdg_mappings'] = {'invented': []}
        self.assertEqual(self.client.post('/api/matches', json=request).status_code, 422)

    def test_unreviewed_sdg_cannot_claim_verified(self):
        role_id = self.bootstrap['roles'][0]['role_id']
        source_id = self.bootstrap['roles'][0]['source_ids'][0]
        request = {'schema_version': '1.0', 'profile': self.bootstrap['profiles'][0],
            'sdg_mappings': {'schema_version': '1.0', 'snapshot_id': 'test', 'role_sdg_mappings': {
                role_id: [{'sdg_number': 4, 'reason': 'Fictional test rationale', 'source_ids': [source_id],
                           'mapping_owner': 'Test', 'mapping_status': 'verified'}]}}}
        self.assertEqual(self.client.post('/api/matches', json=request).status_code, 422)

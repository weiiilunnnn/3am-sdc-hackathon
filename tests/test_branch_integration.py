"""Integration coverage for main's foundation and the additive KW router."""
import os
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from src.main import app
from src.services import career_model, sdg_model
from src.services.sources.runpod_api import RunPodRequestError


class BranchIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.environment = patch.dict(os.environ, {
            'APP_DB_PATH': str(Path(self.temp.name) / 'app.sqlite3'),
            'RUNPOD_API_KEY': '', 'RUNPOD_ENDPOINT_ID': '',
        })
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.client = TestClient(app)
        self.client.__enter__()
        self.addCleanup(self.client.__exit__, None, None, None)

    def test_lifespan_and_all_route_families_coexist(self):
        self.assertTrue(Path(os.environ['APP_DB_PATH']).exists())
        # FastAPI may retain included routers lazily; inspect its public schema.
        routes = {(method.upper(), path) for path, operations in app.openapi()['paths'].items()
                  for method in operations if method in {'get', 'post', 'put', 'patch', 'delete'}}
        self.assertEqual(len(routes), 40)
        expected = {
            ('GET', '/api/healthz'), ('POST', '/api/profiles'),
            ('POST', '/api/profiles/extract-cv'), ('GET', '/api/trends'),
            ('GET', '/api/employment'), ('POST', '/api/career/recommendations'),
            ('POST', '/api/sdg/recommendations'), ('POST', '/api/matches'),
            ('POST', '/api/pathways'), ('POST', '/api/v2/matches'),
            ('GET', '/api/v2/profiles/{profile_id}'),
            ('POST', '/api/v2.1/roles/search'), ('GET', '/api/esco/lookup'),
        }
        self.assertLessEqual(expected, set(routes))
        self.assertEqual(self.client.get('/api/healthz').json(), {'status': 'ok'})
        self.assertEqual(self.client.get('/api/profiles/samples').status_code, 200)
        self.assertEqual(self.client.get('/api/v2/bootstrap').status_code, 200)

    def test_local_synthetic_career_model_and_both_scenarios_remain_available(self):
        model_dir = Path(self.temp.name) / 'models'
        with patch.object(career_model, 'MODEL_DIR', model_dir), patch.object(career_model, '_model', None):
            response = self.client.post('/api/career/recommendations', json={
                'major': 'data_science', 'skills': ['python', 'sql'],
                'interests': ['analytics'], 'experience_months': 6,
            })
        self.assertEqual(response.status_code, 200, response.text[:300])
        body = response.json()
        self.assertEqual(body['model'], 'synthetic-random-forest-v1')
        self.assertIn('synthetic', body['data_notice'])
        self.assertTrue(body['recommendations'])
        self.assertEqual(set(body['scenario_estimates']), {'moderate', 'fast'})
        self.assertTrue((model_dir / 'role_matcher.joblib').exists())
        self.assertTrue((model_dir / 'skill_forecaster.joblib').exists())

    def test_optional_remote_career_contract_and_failure_are_preserved(self):
        fixture = {'model': 'synthetic-test-fixture', 'recommendations': []}
        with patch.dict(os.environ, {'RUNPOD_API_KEY': 'test-only', 'RUNPOD_ENDPOINT_ID': 'fixture'}):
            with patch('src.api.career.run_sync', return_value={'output': fixture}) as remote:
                response = self.client.post('/api/career/recommendations', json={})
                self.assertEqual(response.json(), fixture)
                remote.assert_called_once()
            with patch('src.api.career.run_sync', side_effect=RunPodRequestError('fixture failure')):
                self.assertEqual(self.client.post('/api/career/recommendations', json={}).status_code, 502)

    def test_sdg_mapping_and_generated_text_keep_reference_validation(self):
        role = next(iter(career_model.ROLE_SKILLS))
        result = self.client.post('/api/sdg/recommendations', json={'role': role})
        self.assertEqual(result.status_code, 200, result.text[:300])
        mapping = result.json()
        self.assertEqual(mapping['role'], role)
        self.assertEqual(mapping['mapping_basis'], 'role')
        self.assertIn('synthetic', mapping['data_notice'])
        code = mapping['skill_mappings'][0]['goals'][0]
        target = sdg_model.get_sdg_target(code)
        payload = {'role': role, 'role_summary': 'Synthetic integration test.',
                   'target_code': code, 'target_title': target['title'],
                   'target_definition': target['definition'],
                   'skills': mapping['skill_mappings'][:1]}
        with patch('src.api.sdg.generate_sdg_explanation', return_value={'fixture': True}) as explanation:
            self.assertEqual(self.client.post('/api/sdg/explanation', json=payload).json(), {'fixture': True})
            bad = self.client.post('/api/sdg/explanation', json={**payload, 'target_title': 'Unverified replacement'})
            self.assertEqual(bad.status_code, 422)
            explanation.assert_called_once()
        overview = {'role': role, 'role_summary': 'Synthetic test.', 'sdg_number': code.split('.')[0],
                    'targets': [{'code': code, **target}], 'skills': payload['skills']}
        with patch('src.api.sdg.generate_sdg_overview', side_effect=RunPodRequestError('not configured')):
            self.assertEqual(self.client.post('/api/sdg/overview', json=overview).status_code, 503)

    def test_sdg_recommendations_use_exact_profile_skills_when_role_is_unmapped(self):
        response = self.client.post('/api/sdg/recommendations', json={
            'role': 'Computer Vision Engineer',
            'skills': [' Python ', 'sql', 'unmapped profile skill'],
        })
        self.assertEqual(response.status_code, 200, response.text[:300])
        result = response.json()
        self.assertEqual(result['mapping_basis'], 'profile_skills')
        self.assertIn('not occupation-specific evidence', result['data_notice'])
        self.assertTrue(result['ranked_sdgs'])
        self.assertTrue({'Python', 'SQL'} <= {item['name'] for item in result['skill_mappings']})
        self.assertNotIn('unmapped profile skill', {item['name'] for item in result['skill_mappings']})

    def test_sdg_recommendations_match_supported_role_titles_case_insensitively(self):
        response = self.client.post('/api/sdg/recommendations', json={'role': 'data scientist'})
        self.assertEqual(response.status_code, 200, response.text[:300])
        self.assertEqual(response.json()['mapping_basis'], 'role')

    def test_sdg_recommendations_reject_skill_based_fallback_without_exact_matches(self):
        response = self.client.post('/api/sdg/recommendations', json={
            'role': 'Computer Vision Engineer',
            'skills': ['Unmapped skill'],
        })
        self.assertEqual(response.status_code, 422)

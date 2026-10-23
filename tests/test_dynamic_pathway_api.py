"""HTTP compatibility and live-index regression; external providers are mocked/off."""
import os
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from src.main import app
from src.services.future_roles.occupation_index import get_occupation_index
from src.services.future_roles.resource_discovery import Discovery


class DynamicPathwayAPITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.boot = cls.client.get('/api/v2/bootstrap').json()

    def test_two_real_index_roles_profiles_keep_contracts_and_fallback(self):
        roles, gaps = set(), []
        with patch.dict(os.environ, {"TAVILY_API_KEY": "", "RUNPOD_API_KEY": ""}):
            for p in self.boot['profiles'][:2]:
                response = self.client.post('/api/v2/matches', json={'schema_version':'2.0','profile':p,'page_size':5})
                self.assertEqual(response.status_code, 200)
                matches = response.json()
                role = next(r['role_id'] for r in matches['results'] if r['role_id'] not in roles)
                roles.add(role)
                path = self.client.post('/api/pathways', json={'schema_version':'1.0','profile':p,'role_id':role})
                self.assertEqual(path.status_code, 200)
                data = path.json()
                self.assertIsInstance(data['credentials'], list)
                self.assertIsInstance(data['credential_metrics'], dict)
                self.assertTrue(data['credential_message'])
                self.assertTrue(all(c['origin'] == 'local_catalogue' and c['source_urls'] for c in data['credentials']))
                self.assertEqual(data['role_id'], role)
                self.assertEqual(data['profile_fingerprint'], matches['profile_fingerprint'])
                self.assertIn(data['discovery_status'], ['catalogue_fallback','discovery_unavailable'])
                self.assertTrue(data['sources'])
                self.assertNotIn('mock-only', path.text)
                self.assertTrue(all(r['resource_origin']=='local_catalogue' for phase in data['phases'] for r in phase['resources']))
                gaps.append(set(data['target_skill_ids']))
        self.assertEqual(len(roles), 2)
        self.assertNotEqual(gaps[0], gaps[1])


if __name__ == '__main__': unittest.main()

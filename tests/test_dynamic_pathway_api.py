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

    def test_unknown_price_alternative_and_its_evidence_survive_api_serialization(self):
        from datetime import datetime, timezone
        from src.models.future_roles import Resource, Source
        profile=self.boot['profiles'][0]
        matches=self.client.post('/api/v2/matches',json={'schema_version':'2.0','profile':profile,'page_size':1}).json()
        role_id=matches['results'][0]['role_id']
        index=get_occupation_index()
        have={s['skill_id'] for s in profile['skills']}
        target=next(s.skill_id for s in index.roles[role_id].required_skills if s.requirement=='essential' and s.skill_id not in have)
        stamp=datetime.now(timezone.utc)
        url='https://learn.microsoft.com/training/modules/fictional-api-test-only/'
        source=Source(source_id='mock-provider',evidence_status='verified',source_type='provider_page',title='Fictional test',
            publisher='Tests',url=url,accessed_at=stamp.date(),region='Mock only',supported_claims=['resource_content','skill_mapping'])
        resource=Resource(resource_id='mock-online',title='Fictional extracted course',provider='Tests',url=url,resource_type='course',
            covers_skill_ids=[target],duration_hours=None,duration_basis='unknown',cost_status='unknown',access_verified_at=stamp.date(),
            source_ids=[source.source_id],evidence_status='verified',coverage_note='Mock evidence only',access_notes='Price not verified',
            resource_origin='web_discovered',content_verified_at=stamp,mapping_evidence={target:'Fictional provider excerpt'})
        with patch('src.services.future_roles.resource_discovery.discover_resources',return_value=Discovery(resources=[resource],sources={source.source_id:source})), \
             patch('src.services.future_roles.credentials.recommend_credentials',return_value=([],{},False)):
            response=self.client.post('/api/pathways',json={'schema_version':'1.0','profile':profile,'role_id':role_id})
        self.assertEqual(response.status_code,200)
        data=response.json()
        self.assertEqual(data['alternative_resources'][0]['cost_status'],'unknown')
        self.assertIn('Price not verified',data['alternative_resources'][0]['alternative_reason'])
        self.assertEqual(data['alternative_resources'][0]['mapping_evidence'],{target:'Fictional provider excerpt'})
        self.assertIn(source.source_id,{s['source_id'] for s in data['sources']})
        self.assertEqual(data['discovery_metrics']['alternative_web_resources'],1)
        self.assertFalse(any(r['resource_id']=='mock-online' for phase in data['phases'] for r in phase['resources']))


if __name__ == '__main__': unittest.main()

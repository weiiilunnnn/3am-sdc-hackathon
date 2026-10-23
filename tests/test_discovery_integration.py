import hashlib
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from src.main import app
from src.services.future_roles.occupation_index import get_occupation_index, load_occupation_index
from src.services.future_roles.data_repository import get_catalogues
from src.services.sources.esco import EscoError


class FullDiscoveryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.index=get_occupation_index();cls.bundle=get_catalogues();cls.client=TestClient(app)

    def test_full_import_counts_relationships_and_sources(self):
        i=self.index
        self.assertEqual(i.coverage,'local_full',i.warning)
        self.assertEqual((i.n,len(i.skills)),(3658,14579))
        self.assertEqual(sum(len(e) for e in i.edges.values()),126051)
        self.assertEqual(sum(len(roles) for roles in i.reverse.values()),126051)
        self.assertTrue(all(r.requirements_complete and r.status=='released' for r in i.roles.values()))
        for role in i.roles.values():
            self.assertEqual(len({r.skill_id for r in role.required_skills}),len(role.required_skills))
            self.assertTrue(all(s.skill_id in i.skills for s in role.required_skills))
            self.assertTrue(all(i.sources[s].dataset_version==i.catalog.dataset_version for s in role.source_ids))
        for skill in i.skills.values():self.assertLessEqual(set(skill.broader_skill_ids),i.skills.keys())

    def test_v2_pagination_sources_and_no_market_payload(self):
        payload={'schema_version':'2.0','profile':self.bundle.profiles[0].model_dump(mode='json'),'page_size':2}
        first=self.client.post('/api/v2/matches',json=payload)
        self.assertEqual(first.status_code,200,first.text[:300]);a=first.json()
        self.assertGreater(a['total_qualifying_roles'],2)
        b=self.client.post('/api/v2/matches',json={**payload,'offset':a['next_offset']}).json()
        self.assertTrue({r['role_id'] for r in a['results']}.isdisjoint(r['role_id'] for r in b['results']))
        source_ids={s['source_id'] for s in a['sources']}
        for r in a['results']:
            self.assertNotIn('market_outlook',r);self.assertNotIn('missing_skills',r)
            self.assertLessEqual(len(r['development_areas']),5)
            self.assertGreaterEqual(r['score']['profile_relevance_pct'],30)
            self.assertLessEqual(set(r['occupation_source_ids']),source_ids)
            for area in r['development_areas']:
                self.assertLessEqual(set(area['source_ids']),source_ids)
                self.assertLessEqual(set(area['supporting_concept_ids']),self.index.skills.keys())

    def test_new_role_pathway_uses_canonical_ids_and_honest_coverage(self):
        payload={'schema_version':'2.0','profile':self.bundle.profiles[0].model_dump(mode='json'),'page_size':25}
        matches=self.client.post('/api/v2/matches',json=payload).json()
        original={r.role_id for r in self.bundle.occupations.occupations}
        selected=next(r for r in matches['results'] if r['role_id'] not in original)
        path=self.client.post('/api/pathways',json={'schema_version':'1.0','profile':payload['profile'],'role_id':selected['role_id']})
        self.assertEqual(path.status_code,200,path.text[:300]);p=path.json()
        self.assertEqual(p['role_id'],selected['role_id'])
        self.assertEqual(p['profile_fingerprint'],matches['profile_fingerprint'])
        self.assertLessEqual(set(p['target_skill_ids']),self.index.skills.keys())
        self.assertFalse(p['coverage_complete']);self.assertIsNone(p['estimated_weeks'])
        for phase in p['phases']:
            self.assertLessEqual({r['resource_id'] for r in phase['resources']},{r.resource_id for r in self.bundle.resources.resources})

    def test_legacy_and_team_interfaces_preserved(self):
        p=self.bundle.profiles[1].model_dump(mode='json')
        old=self.client.post('/api/matches',json={'schema_version':'1.0','profile':p,'top_k':100}).json()
        web=next(r for r in old['results'] if r['role_title']=='web developer')
        self.assertEqual(web['personal_fit_score_pct'],11.54)
        a=self.client.post('/api/v2/matches',json={'schema_version':'2.0','profile':p}).json()
        b=self.client.post('/api/v2/matches',json={'schema_version':'2.0','profile':p,'trend_snapshot_id':'demo-trend-b'}).json()
        self.assertEqual(a['results'],b['results'])
        forged=self.bundle.sources[next(iter(self.bundle.sources))].model_copy(update={'source_id':'forged:verified'}).model_dump(mode='json')
        self.assertEqual(self.client.post('/api/v2/matches',json={'schema_version':'2.0','profile':p,'integration_sources':[forged]}).status_code,422)
        self.assertEqual(self.client.post('/api/v2/matches',json={'schema_version':'1.0','profile':p}).status_code,422)

    def test_offline_and_invalid_manifest_fallback(self):
        with TemporaryDirectory() as temp:
            path=Path(temp)/'absent.gz'
            self.assertEqual(load_occupation_index(path).coverage,'local_subset_fallback')
            path.write_bytes(b'bad')
            path.with_suffix('.manifest.json').write_text(json.dumps({'esco_release':'v1.2.1','language':'en','coverage':'full_api_collection','artifact_sha256':'wrong'}))
            i=load_occupation_index(path)
            self.assertEqual(i.coverage,'local_subset_fallback');self.assertIn('checksum',i.warning)

    def test_official_lookup_failure_cache_and_version_separation(self):
        role=next(iter(self.index.roles))
        with patch('src.api.future_roles.esco_client.fetch',side_effect=EscoError('timeout')):
            x=self.client.get('/api/esco/lookup',params={'kind':'occupation','uri':role}).json()
            self.assertEqual(x['data_source_status'],'api_unavailable');self.assertTrue(x['local_fallback'])
            y=self.client.get('/api/esco/lookup',params={'kind':'occupation','uri':role,'version':'v1.2.0'}).json()
            self.assertFalse(y['local_fallback']);self.assertIsNone(y['record'])
        with patch('src.api.future_roles.esco_client.fetch',return_value={'requested_version':'v1.2.0','returned_version':None,'record':{'uri':role}}):
            x=self.client.get('/api/esco/lookup',params={'kind':'occupation','uri':role,'version':'v1.2.0'}).json()
            self.assertEqual(x['data_source_status'],'version_mismatch');self.assertFalse(x['updates_matching_index'])

    def test_reskilling_preserves_bytes_except_approved_import_relocation(self):
        root = Path(__file__).parents[1]
        baseline = json.loads((root/'docs/future-role-baseline.json').read_text())
        moved = {
            'src/personalized_reskilling.py': 'src/services/future_roles/personalized_reskilling.py',
            'src/learning_time.py': 'src/services/future_roles/learning_time.py',
        }
        for name, expected in baseline['files'].items():
            payload = (root/moved.get(name, name)).read_bytes()
            if name == 'src/frontend/components/PathwayView.tsx':
                self.assertEqual(payload.count(b'from "@/lib/future-role-api"'), 1)
                payload = payload.replace(b'@/lib/future-role-api', b'@/lib/api')
            self.assertEqual(hashlib.sha256(payload).hexdigest(), expected, name)

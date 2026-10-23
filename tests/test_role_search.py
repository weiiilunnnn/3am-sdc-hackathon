"""Full-index title override regression; no network or ESCO refresh."""
from math import fsum, log
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from src.services.future_roles.data_repository import get_catalogues, supported
from src.main import app
from src.services.future_roles.occupation_index import get_occupation_index


class RoleSearchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.index = get_occupation_index()
        cls.profile = get_catalogues().profiles[0].model_dump(mode='json')
        cls.client = TestClient(app)
        cls.role = next(r for r in cls.index.roles.values() if r.title.casefold() == 'data scientist')

    def search(self, query, profile=None, **kwargs):
        with patch('src.api.future_roles.esco_client.fetch', side_effect=AssertionError('Search must stay local')):
            response = self.client.post('/api/v2.1/roles/search', json={
                'schema_version': '2.1', 'profile': profile or self.profile,
                'role_query': query, **kwargs})
        self.assertEqual(response.status_code, 200, response.text[:300])
        return response.json()

    def test_exact_below_threshold_same_formula_sources_and_pathway(self):
        edges = self.index.edges[self.role.role_id]
        matched = next(s for s, edge in edges.items() if edge.requirement == 'optional')
        other = sorted(set(self.index.skills) - edges.keys())[:20]
        ids = [matched, *other]
        profile = {**self.profile, 'skills': [dict(skill_id=s, name=self.index.skills[s].name,
                   proficiency='unknown', self_reported=True) for s in ids]}
        result = self.search(' Data Scientist ', profile)
        first = next(r for r in result['results'] if r['role_id'] == self.role.role_id)
        self.assertEqual(first['qualification_status'], 'search_result')
        weights = {s: 1 + log((self.index.n + 1)/(self.index.df.get(s, 0) + 1)) for s in sorted(ids)}
        expected = round(100 * fsum([weights[matched] * .4]) / fsum(weights.values()), 2)
        self.assertEqual(first['score']['profile_relevance_pct'], expected)
        self.assertGreater(expected, 0)
        self.assertLess(expected, 30)
        self.assertLessEqual(set(first['occupation_source_ids']), {s['source_id'] for s in result['sources']})
        for area in first['development_areas']:
            self.assertLessEqual(set(area['source_ids']), {s['source_id'] for s in result['sources']})
        path = self.client.post('/api/pathways', json={'schema_version': '1.0', 'profile': profile, 'role_id': first['role_id']})
        self.assertEqual(path.status_code, 200, path.text[:200])
        self.assertEqual(path.json()['role_id'], first['role_id'])

    def test_empty_recommendations_unchanged_after_search_and_pagination(self):
        body = {'schema_version': '2.0', 'profile': self.profile, 'page_size': 2}
        before = self.client.post('/api/v2/matches', json=body).json()
        self.search('scientist')
        for query in ['', '   ']:
            after = self.client.post('/api/v2/matches', json={**body, 'role_query': query}).json()
            # The legacy contract echoes the raw query; everything else is identical.
            self.assertEqual({**after, 'role_query': ''}, before)
        self.assertTrue(all(r['score']['profile_relevance_pct'] >= 30 for r in before['results']))
        next_page = self.client.post('/api/v2/matches', json={**body, 'offset': before['next_offset']}).json()
        self.assertTrue({r['role_id'] for r in before['results']}.isdisjoint(r['role_id'] for r in next_page['results']))
        for role in before['results']:
            found = self.search(role['role_title'])
            searched = next(r for r in found['results'] if r['role_id'] == role['role_id'])
            self.assertEqual(searched['score'], role['score'])

    def test_partial_alias_full_index_and_accurate_pagination(self):
        preferred = {' '.join(r.title.casefold().split()) for r in self.index.roles.values()}
        role, alias = next((r, a) for r in self.index.roles.values() for a in r.aliases
                           if ' '.join(a.casefold().split()) not in preferred)
        result = self.search(alias, page_size=25)
        self.assertIn(role.role_id, {r['role_id'] for r in result['results']})
        seen, offset = [], 0
        expected = {r.role_id for r in self.index.roles.values()
                    if any('data' in ' '.join(t.casefold().split()) for t in [r.title, *r.aliases])}
        while True:
            page = self.search('data', offset=offset, page_size=25)
            seen.extend(r['role_id'] for r in page['results'])
            self.assertEqual(page['total_search_results'], len(expected))
            if page['next_offset'] is None:
                break
            offset = page['next_offset']
        self.assertEqual(set(seen), expected)
        self.assertEqual(len(seen), len(expected))

    def test_zero_overlap_unknown_empty_and_unknown_title(self):
        unrelated = next(s for s in self.index.skills if s not in self.index.edges[self.role.role_id])
        profiles = [
            ({**self.profile, 'skills': []}, None),
            ({**self.profile, 'skills': [], 'unresolved_skills': ['zz-unmapped']}, None),
            ({**self.profile, 'skills': [dict(skill_id=unrelated, name=self.index.skills[unrelated].name,
              proficiency='unknown', self_reported=True)]}, 0),
        ]
        for profile, expected in profiles:
            found = next(r for r in self.search('data scientist', profile)['results'] if r['role_id'] == self.role.role_id)
            self.assertEqual(found['score']['profile_relevance_pct'], expected)
            self.assertEqual(bool(found['score_unavailable_reason']), expected is None)
            self.assertEqual(found['pathway_available'], expected is not None)
            if expected == 0:
                path = self.client.post('/api/pathways', json={'schema_version': '1.0',
                    'profile': profile, 'role_id': found['role_id']})
                self.assertEqual(path.status_code, 200, path.text[:200])
        result = self.search('zz-no-real-title-876543')
        self.assertEqual(result['results'], [])
        self.assertEqual(result['total_search_results'], 0)
        self.assertIsNone(result['next_offset'])
        self.assertEqual(result['status'], 'no_title_matches')

    def test_search_contract_bounds(self):
        for override in [{'role_query': '   '}, {'role_query': 'a' * 101}, {'page_size': 26}, {'offset': -1}]:
            response = self.client.post('/api/v2.1/roles/search', json={
                'schema_version': '2.1', 'profile': self.profile, 'role_query': 'data', **override})
            self.assertEqual(response.status_code, 422)

    def test_relevance_sorted_before_pagination_with_all_title_matches(self):
        query = 'engineer'
        expected = {}
        have = {s['skill_id'] for s in self.profile['skills']}
        weights = {s: 1 + log((self.index.n + 1) / (self.index.df.get(s, 0) + 1)) for s in sorted(have)}
        denominator = fsum(weights.values())
        for rid, role in self.index.roles.items():
            if not any(query in ' '.join(t.casefold().split()) for t in [role.title, *role.aliases]):
                continue
            edges = self.index.edges[rid]
            numerator = fsum(weights[s] * (1 if edges[s].requirement == 'essential' else .4)
                             for s in sorted(have & edges.keys()))
            essential = {s for s, edge in edges.items() if edge.requirement == 'essential'}
            assessable = (bool(essential) and role.requirements_complete
                and len(essential) == role.expected_essential_count
                and all(supported(edge.source_ids, self.index.sources, 'role_skill_relationships',
                                  native_id=rid) for edge in edges.values()))
            expected[rid] = 100 * numerator / denominator if assessable else None
        self.assertGreater(len(expected), 25)
        actual, offset = [], 0
        while True:
            result = self.search(query, offset=offset, page_size=25)
            self.assertEqual(result['total_search_results'], len(expected))
            actual.extend(result['results'])
            if result['next_offset'] is None:
                break
            offset = result['next_offset']
        ids = [r['role_id'] for r in actual]
        self.assertEqual(len(ids), len(expected))
        self.assertEqual(set(ids), set(expected))
        ordered = [expected[rid] if expected[rid] is not None else -1 for rid in ids]
        self.assertEqual(ordered, sorted(ordered, reverse=True))
        self.assertEqual([r['rank'] for r in actual], list(range(1, len(actual) + 1)))
        self.assertTrue(any(0 < score < 30 for score in expected.values() if score is not None))
        self.assertTrue(any(score == 0 for score in expected.values()))
        for row in actual:
            value = expected[row['role_id']]
            self.assertEqual(row['score']['profile_relevance_pct'], round(value, 2) if value is not None else None)
        self.assertEqual(self.search(query, page_size=25)['results'], actual[:25])

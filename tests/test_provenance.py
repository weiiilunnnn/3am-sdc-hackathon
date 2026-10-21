import unittest
from src.data_repository import load_catalogues, validate_catalogue, validate_resources, merge_integration_sources
from helpers import fixture


class ProvenanceTests(unittest.TestCase):
    def test_missing_and_wrong_relationship_source(self):
        p, c, s = fixture()
        c.occupations[0].required_skills[0].source_ids = ['missing']
        with self.assertRaises(ValueError):
            validate_catalogue(c, s)

    def test_real_catalogue_complete_and_no_fictional_roles(self):
        b = load_catalogues()
        self.assertFalse(b.occupations.is_synthetic)
        for r in b.occupations.occupations:
            self.assertTrue(r.requirements_complete)
            self.assertTrue(r.role_id.startswith('http://data.europa.eu/esco/occupation/'))
            self.assertEqual(r.expected_essential_count, sum(s.requirement == 'essential' for s in r.required_skills))
            self.assertEqual(len(r.required_skills), len({s.skill_id for s in r.required_skills}))
            if r.title in {'software developer', 'data scientist', 'web developer', 'artificial intelligence engineer', 'database developer'}:
                self.assertTrue(any(set(item.covers_skill_ids).intersection(x.skill_id for x in r.required_skills if x.requirement == 'essential') for item in b.resources.resources))

    def test_missing_resource_and_unknown_foreign_references(self):
        b = load_catalogues()
        b.resources.resources[0].source_ids = ['missing']
        with self.assertRaises(ValueError):
            validate_resources(b.resources, b.occupations, b.sources)

    def test_http_client_cannot_self_verify_sources(self):
        b = load_catalogues()
        source = next(iter(b.sources.values())).model_copy(update={'source_id': 'external:new'})
        with self.assertRaises(ValueError):
            merge_integration_sources(b.sources, [source])

    def test_incomplete_denominator_is_rejected(self):
        _, c, s = fixture()
        c.occupations[0].required_skills.pop()
        with self.assertRaises(ValueError):
            validate_catalogue(c, s)

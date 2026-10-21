import unittest
from pydantic import ValidationError
from src.models import *
from src.data_repository import load_catalogues
from helpers import fixture


class ContractTests(unittest.TestCase):
    def test_round_trip_all_reference_contracts(self):
        b = load_catalogues()
        for obj in [b.occupations, b.resources, b.profiles[0], *b.snapshots.values(), SourceRegistry(schema_version="1.0", sources=list(b.sources.values()))]:
            self.assertEqual(type(obj).model_validate_json(obj.model_dump_json()), obj)

    def test_profile_validation(self):
        p, _, _ = fixture()
        for change in [{"schema_version": "2.0"}, {"is_synthetic": False}, {"skills": [p.skills[0], p.skills[0]]},
                       {"learning_preferences": {"hours_per_week": 0}}, {"learning_preferences": {"hours_per_week": float('nan')}},
                       {"learning_preferences": {"budget": {"amount": -1, "currency": "MYR"}}}]:
            with self.assertRaises(ValidationError):
                UserProfile.model_validate({**p.model_dump(), **change})
        data = p.model_dump()
        data.pop('schema_version')
        with self.assertRaises(ValidationError):
            UserProfile.model_validate(data)

    def test_version_enums_and_timezones(self):
        b = load_catalogues()
        data = b.snapshots['demo-trend-a'].model_dump(mode='json')
        for change in [{"collected_at": "2026-10-21T09:00:00"}, {"collected_at": "bad-date"}, {"schema_version": "1.bad"}]:
            with self.assertRaises(ValidationError):
                TrendSnapshot.model_validate({**data, **change})
        for value in [True, 0, 1.5, -1]:
            with self.assertRaises(ValidationError):
                MatchRequest(schema_version="1.0", profile=b.profiles[0], top_k=value)

    def test_output_contracts_and_mixed_evidence(self):
        from src.future_role_matching import match_roles
        from src.personalized_reskilling import build_pathway
        b = load_catalogues()
        m = match_roles(b.profiles[1], b.occupations, b.snapshots['demo-trend-a'], sources=b.sources)
        w = build_pathway(b.profiles[1], m.results[0], b.resources, b.sources)
        self.assertEqual(MatchResponse.model_validate_json(m.model_dump_json()), m)
        self.assertEqual(PathwayResponse.model_validate_json(w.model_dump_json()), w)
        self.assertTrue(m.is_synthetic)
        self.assertEqual(m.results[0].evidence_status, "verified")
        self.assertEqual(m.results[0].market_outlook.evidence_status, "synthetic")

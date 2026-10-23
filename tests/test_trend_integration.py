from datetime import datetime, timezone
import unittest
from src.services.future_roles.data_repository import load_catalogues
from src.services.future_roles.future_role_matching import match_roles
from src.services.future_roles.trend_adapter import adapt_trend_snapshot


class TrendTests(unittest.TestCase):
    def test_snapshot_change_preserves_fit_and_rank(self):
        b = load_catalogues()
        responses = [match_roles(b.profiles[0], b.occupations, b.snapshots[k], sources=b.sources) for k in ['demo-trend-a', 'demo-trend-b']]
        self.assertEqual([(r.role_id, r.personal_fit_score_pct) for r in responses[0].results], [(r.role_id, r.personal_fit_score_pct) for r in responses[1].results])
        self.assertEqual(responses[0].results[0].market_outlook.direction, 'rising')
        self.assertEqual(responses[1].results[0].market_outlook.direction, 'declining')

    def test_unequal_periods_unknown_and_unmapped_diagnostic(self):
        b = load_catalogues()
        snapshot = b.snapshots['demo-trend-a'].model_copy(deep=True)
        snapshot.signals[0].period_previous.end = snapshot.signals[0].period_previous.end.replace(day=30)
        outlook = adapt_trend_snapshot(snapshot, b.occupations.occupations[0].role_id, b.occupations, b.sources)
        self.assertEqual(outlook.direction, 'unknown')
        self.assertIn('Unequal', outlook.signals[0].warnings[0])
        snapshot.signals[0].role_id = 'unmapped'
        outlook = adapt_trend_snapshot(snapshot, b.occupations.occupations[0].role_id, b.occupations, b.sources)
        self.assertTrue(any('Unmapped' in w for w in outlook.warnings))

    def test_stale_and_missing_evidence(self):
        b = load_catalogues()
        snapshot = b.snapshots['demo-trend-a'].model_copy(deep=True)
        snapshot.valid_until = datetime(2026, 10, 21, 2, tzinfo=timezone.utc)
        outlook = adapt_trend_snapshot(snapshot, b.occupations.occupations[0].role_id, b.occupations, b.sources,
                                      now=datetime(2026, 10, 22, tzinfo=timezone.utc))
        self.assertEqual(outlook.direction, 'unknown')
        self.assertEqual(outlook.signals[0].status, 'stale')
        self.assertEqual(adapt_trend_snapshot(snapshot, b.occupations.occupations[0].role_id, b.occupations, {}).direction, 'unknown')

    def test_source_geography_preserved_no_skill_to_role_inference(self):
        b = load_catalogues()
        snapshot = b.snapshots['demo-trend-a'].model_copy(deep=True)
        snapshot.signals = snapshot.signals[:1]
        snapshot.signals[0].scope = 'skill'
        snapshot.signals[0].skill_id = b.occupations.occupations[0].required_skills[0].skill_id
        snapshot.signals[0].region = 'US'
        outlook = adapt_trend_snapshot(snapshot, b.occupations.occupations[0].role_id, b.occupations, b.sources)
        self.assertEqual(outlook.direction, 'unknown')
        self.assertEqual(outlook.signals[0].signal.region, 'US')

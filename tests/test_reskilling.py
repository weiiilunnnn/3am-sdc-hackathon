import unittest
from src.future_role_matching import match_roles, MatchingConfig
from src.personalized_reskilling import build_pathway
from src.models import ProfileSkill, Money
from src.data_repository import load_catalogues
from helpers import fixture, learning_fixture


class PathwayTests(unittest.TestCase):
    def setup_plan(self, hours=12):
        p, c, s = fixture()
        r, evidence = learning_fixture(hours=hours)
        return p, match_roles(p, c, sources=s).results[0], r, s | evidence

    def test_known_time_and_weekly_capacity(self):
        p, m, r, s = self.setup_plan()
        w = build_pathway(p, m, r, s)
        self.assertEqual(w.estimated_weeks, 4)
        self.assertEqual(w.total_known_hours, 12)
        p.learning_preferences.hours_per_week = 2
        self.assertEqual(build_pathway(p, m, r, s).estimated_weeks, 6)

    def test_unknown_duration_and_absent_resource(self):
        p, m, r, s = self.setup_plan(hours=None)
        w = build_pathway(p, m, r, s)
        self.assertIsNone(w.estimated_weeks)
        self.assertFalse(w.all_phase_durations_known)
        r.resources = []
        w = build_pathway(p, m, r, s)
        self.assertEqual(w.uncovered_skill_ids, ["demo:visualization"])
        self.assertEqual(w.total_known_hours, 0)
        self.assertIsNone(w.estimated_weeks)

    def test_prerequisites_ordered_and_counted_once(self):
        p, m, r, s = self.setup_plan()
        prerequisite = r.resources[0].model_copy(update={"resource_id": "intro", "covers_skill_ids": [], "duration_hours": 2})
        r.resources[0].prerequisite_resource_ids = ["intro"]
        r.resources.append(prerequisite)
        w = build_pathway(p, m, r, s)
        self.assertEqual(w.phases[0].resources[0].resource_id, "intro")
        self.assertEqual(w.total_known_hours, 14)

    def test_cycle_does_not_loop_or_invent(self):
        p, m, r, s = self.setup_plan()
        r.resources[0].prerequisite_resource_ids = [r.resources[0].resource_id]
        w = build_pathway(p, m, r, s)
        self.assertEqual(w.status, "resource_not_found")
        self.assertIn("test:course", w.blocked_resource_ids)

    def test_budget_sources_and_mapping_filter(self):
        p, m, r, s = self.setup_plan()
        r.resources[0].cost_status = "paid"
        r.resources[0].cost = Money(amount=20, currency="MYR")
        self.assertEqual(build_pathway(p, m, r, s).status, "resource_not_found")
        r.resources[0].cost_status = "free"
        r.resources[0].cost = Money(amount=0, currency="MYR")
        self.assertEqual(build_pathway(p, m, r, {}).status, "resource_not_found")
        r.resources[0].covers_skill_ids = ["demo:extra"]
        self.assertEqual(build_pathway(p, m, r, s).status, "resource_not_found")

    def test_no_gaps(self):
        p, c, s = fixture()
        p.skills.append(ProfileSkill(skill_id="demo:visualization", name="visualization"))
        m = match_roles(p, c, sources=s).results[0]
        r, rs = learning_fixture()
        w = build_pathway(p, m, r, s | rs)
        self.assertEqual(w.status, "no_documented_gaps")
        self.assertEqual(w.phases, [])
        self.assertEqual(w.estimated_weeks, 0)

    def test_shared_resource_deduplication(self):
        p, c, s = fixture()
        p.skills = p.skills[:1]
        m = match_roles(p, c, sources=s).results[0]
        r, rs = learning_fixture(["demo:sql", "demo:visualization"], 12)
        w = build_pathway(p, m, r, s | rs)
        self.assertEqual(w.total_known_hours, 12)
        self.assertEqual(sum(len(phase.resources) for phase in w.phases), 1)

    def test_resource_url_must_match_its_evidence(self):
        p, m, r, s = self.setup_plan()
        r.resources[0].url = 'https://example.org/unsupported-other-course'
        self.assertEqual(build_pathway(p, m, r, s).status, 'resource_not_found')

    def test_real_personalised_paths_and_free_resources(self):
        b = load_catalogues()
        role = next(r for r in b.occupations.occupations if r.title == "software developer")
        paths = []
        for p in b.profiles[:2]:
            m = next(m for m in match_roles(p, b.occupations, sources=b.sources, config=MatchingConfig(100)).results if m.role_id == role.role_id)
            paths.append(build_pathway(p, m, b.resources, b.sources))
        self.assertNotEqual(paths[0].target_skill_ids, paths[1].target_skill_ids)
        for w in paths:
            self.assertTrue(w.uncovered_skill_ids)
            self.assertIsNone(w.estimated_weeks)
            for phase in w.phases:
                for resource in phase.resources:
                    self.assertEqual(resource.cost_status, "free")

    def test_total_paid_budget_includes_dependencies(self):
        p, m, r, s = self.setup_plan()
        p.learning_preferences.budget = Money(amount=10, currency="MYR")
        s['test:resource'].supported_claims.append('cost')
        r.resources[0].cost_status = 'paid'
        r.resources[0].cost = Money(amount=6, currency="MYR")
        dep = r.resources[0].model_copy(update={"resource_id": "intro", "covers_skill_ids": [], "prerequisite_resource_ids": []})
        r.resources[0].prerequisite_resource_ids = ['intro']
        r.resources.append(dep)
        self.assertEqual(build_pathway(p, m, r, s).status, "resource_not_found")

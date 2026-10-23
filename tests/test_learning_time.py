import unittest
from src.services.future_roles.learning_time import resource_time, plan_time
from src.services.future_roles.data_repository import load_catalogues
from src.services.future_roles.future_role_matching import match_roles, MatchingConfig
from src.services.future_roles.personalized_reskilling import build_pathway
from src.models.future_roles import LearningPreferences
from helpers import learning_fixture


class LearningTimeTests(unittest.TestCase):
    def resource(self, kind='article', scope='short_unit', hours=None):
        catalog, _ = learning_fixture(hours=hours)
        return catalog.resources[0].model_copy(update={'resource_type': kind, 'planning_scope': scope,
            'scope_review_note': 'Reviewed discrete test fixture scope.'})

    def test_provider_hours_take_priority_and_do_not_become_days(self):
        r = self.resource(hours=6)
        t = resource_time(r)
        self.assertEqual((t.value, t.unit, t.basis), (6, 'hour', 'provider_published'))
        self.assertTrue(t.published_by_provider)

    def test_article_and_discrete_tutorial_one_day(self):
        for kind in ['article', 'tutorial', 'documentation']:
            t = resource_time(self.resource(kind))
            self.assertEqual((t.value, t.unit, t.basis), (1, 'study_day', 'app_rule_of_thumb'))
            self.assertFalse(t.published_by_provider)

    def test_course_one_planned_week_only_if_bounded(self):
        t = resource_time(self.resource('course', 'bounded_course'))
        self.assertEqual((t.value, t.unit), (1, 'study_week'))
        self.assertEqual(plan_time([self.resource('course', 'bounded_course')], 4).fallback_study_days, 5)

    def test_large_or_unreviewed_scope_remains_unknown(self):
        for scope in ['large_collection', 'unreviewed']:
            self.assertIsNone(resource_time(self.resource('course', scope)).value)
        r = self.resource().model_copy(update={'scope_review_note': None})
        self.assertIsNone(resource_time(r).value)

    def test_mixed_conversion_and_subtotals(self):
        r = [self.resource(hours=6), self.resource(), self.resource('course', 'bounded_course')]
        t = plan_time(r, 3)
        self.assertEqual(t.provider_known_hours, 6)
        self.assertEqual(t.fallback_study_days, 6)
        self.assertEqual(t.scheduled_weeks, 3.2)
        self.assertEqual(t.scheduled_study_days, 16)
        self.assertEqual(t.estimate_basis, 'mixed')

    def test_week_convention_configurable(self):
        t = plan_time([self.resource('course', 'bounded_course'), self.resource()], 4, 4)
        self.assertEqual(t.fallback_study_days, 5)
        self.assertEqual(t.scheduled_weeks, 1.25)
        for days in [0, 8, True]:
            with self.assertRaises(ValueError):
                LearningPreferences(study_days_per_week=days)

    def test_no_capacity_does_not_invent_hour_conversion(self):
        self.assertIsNone(plan_time([self.resource(hours=6)], None).scheduled_weeks)
        self.assertEqual(plan_time([self.resource()], None).scheduled_weeks, .2)

    def test_reviewed_app_estimate_separate(self):
        r = self.resource(hours=4).model_copy(update={'duration_basis': 'estimated_with_method', 'estimated_hours_method': 'Test reviewed estimate'})
        t = plan_time([r], 2)
        self.assertEqual(t.provider_known_hours, 0)
        self.assertEqual(t.reviewed_app_hours, 4)
        self.assertEqual(t.scheduled_weeks, 2)

    def test_partial_coverage_unknown_scope_and_order_all_profiles(self):
        b = load_catalogues()
        self.assertGreaterEqual(len(b.resources.resources), 20)
        for p in b.profiles:
            for m in match_roles(p, b.occupations, sources=b.sources, config=MatchingConfig(100)).results:
                w = build_pathway(p, m, b.resources, b.sources)
                completed = set()
                for phase in w.phases:
                    for r in phase.resources:
                        self.assertNotIn(r.resource_id, completed)
                        self.assertLessEqual(set(r.prerequisite_resource_ids), completed)
                        completed.add(r.resource_id)
                        self.assertIsNotNone(r.time_estimate)
                        if r.planning_scope == 'large_collection' and r.duration_hours is None:
                            self.assertIsNone(r.time_estimate.value)
                    if phase.phase_kind == 'online_courses':
                        self.assertTrue(all(r.resource_type == 'course' for r in phase.resources))
                if w.uncovered_skill_ids:
                    self.assertFalse(w.coverage_complete)
                    self.assertIsNone(w.estimated_weeks)
                if not completed and w.target_skill_ids:
                    self.assertIsNone(w.planning_estimate.scheduled_weeks)

import unittest

from src.future_role_matching import MatchingConfig, match_roles
from src.models import ProfileSkill
from src.data_repository import load_catalogues
from src.skills_intake import normalize_profile
from helpers import fixture


class MatchingTests(unittest.TestCase):
    def test_partial_exact_breakdown(self):
        p, c, s = fixture()
        m = match_roles(p, c, sources=s)
        self.assertEqual(m.results[0].personal_fit_score_pct, 66.67)
        self.assertEqual([x.name for x in m.results[0].missing_skills], ["visualization"])
        self.assertTrue(m.is_synthetic)

    def test_full_zero_extra_proficiency(self):
        p, c, s = fixture()
        p.skills += [ProfileSkill(skill_id="demo:visualization", name="visualization")]
        self.assertEqual(match_roles(p, c, sources=s).results[0].personal_fit_score_pct, 100)
        p.skills = [ProfileSkill(skill_id="demo:extra", name="extra", proficiency="advanced")]
        self.assertEqual(match_roles(p, c, sources=s).results[0].personal_fit_score_pct, 0)

    def test_empty_unscorable_and_sources(self):
        p, c, s = fixture()
        self.assertEqual(match_roles(p.model_copy(update={"skills": []}), c, sources=s).results, [])
        c.occupations[0].requirements_complete = False
        self.assertIsNone(match_roles(p, c, sources=s).results[0].personal_fit_score_pct)
        c.occupations[0].requirements_complete = True
        self.assertEqual(match_roles(p, c, sources={}).results, [])

    def test_ties_and_repeatability(self):
        p, c, s = fixture()
        c.occupations += [c.occupations[0].model_copy(update={"role_id": "demo:aaa"})]
        a = match_roles(p, c, sources=s)
        self.assertEqual(a.results[0].role_id, "demo:aaa")
        self.assertEqual(a, match_roles(p, c, sources=s))

    def test_alias_normalisation_and_unknown(self):
        b = load_catalogues()
        p = b.profiles[0].model_copy(deep=True)
        p.skills = [ProfileSkill(skill_id="Python", name="Python"), ProfileSkill(skill_id="nonsense", name="unmapped")]
        normalized = normalize_profile(p, b.occupations)
        self.assertEqual(normalized.skills[0].name, "Python (computer programming)")
        self.assertEqual(normalized.unresolved_skills, ["unmapped"])

    def test_real_personas_differ_and_match_complete_denominators(self):
        b = load_catalogues()
        a, z = [match_roles(p, b.occupations, sources=b.sources) for p in b.profiles[:2]]
        self.assertNotEqual(a.results[0].role_id, z.results[0].role_id)
        all_matches = match_roles(b.profiles[0], b.occupations, sources=b.sources, config=MatchingConfig(100))
        original = {"software developer", "data scientist", "web developer", "artificial intelligence engineer", "database developer"}
        self.assertEqual({r.role_title: r.score_breakdown.total_essential_count for r in all_matches.results if r.role_title in original},
            {"software developer": 24, "data scientist": 63, "web developer": 26, "artificial intelligence engineer": 31, "database developer": 20})
        for value in [0, -1, True, 1.5]:
            with self.assertRaises(ValueError):
                match_roles(b.profiles[0], b.occupations, sources=b.sources, config=MatchingConfig(value))

    def test_score_metadata_preserves_actual_web_fraction_and_all_types(self):
        b = load_catalogues()
        for p in b.profiles:
            response = match_roles(p, b.occupations, sources=b.sources, config=MatchingConfig(100), resources=b.resources)
            self.assertEqual(len(response.results), 15)
            self.assertEqual(response.candidate_role_count, 15)
            for m in response.results:
                self.assertEqual(m.personal_fit_score_pct, m.essential_concept_coverage_pct)
                self.assertIsNone(m.competency_alignment_pct)
                self.assertEqual(m.competency_groups, [])
                self.assertFalse(m.score_is_employment_probability)
                self.assertEqual(sum(x.total_essential_count for x in m.requirement_type_coverage), m.score_breakdown.total_essential_count)
                self.assertEqual(sum(x.matched_essential_count for x in m.requirement_type_coverage), m.score_breakdown.matched_essential_count)
                self.assertEqual(set(m.priority_gap_skill_ids), {x.skill_id for x in m.missing_skills if x.requirement == 'essential'})
            if p.profile_id == 'demo-graduate-b':
                web = next(x for x in response.results if x.role_title == 'web developer')
                self.assertEqual(web.personal_fit_score_pct, 11.54)
                self.assertEqual(web.score_breakdown.matched_essential_count, 3)
                self.assertEqual(web.score_breakdown.total_essential_count, 26)

    def test_baseline_scores_unchanged_after_expansion(self):
        import json
        from pathlib import Path
        old = json.loads((Path(__file__).parents[1] / 'docs/scoring-audit-baseline.json').read_text())
        b = load_catalogues()
        actual = {(p.profile_id, m.role_id): m.personal_fit_score_pct for p in b.profiles
                  for m in match_roles(p, b.occupations, sources=b.sources, config=MatchingConfig(100)).results}
        for row in old['comparisons']:
            self.assertEqual(actual[row['profile_id'], row['role_id']], row['strict_coverage_pct'])

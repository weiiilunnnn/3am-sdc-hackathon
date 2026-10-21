"""Synthetic algorithm fixtures; no invented records enter the real catalogue."""
import math
import unittest
from unittest.mock import patch
from src.models import OccupationCatalog, UserProfile, ProfileSkill, Source
from src.occupation_index import OccupationIndex
from src.profile_relevance import discover, RelevanceConfig


def fixture():
    source = Source(source_id='fixture', evidence_status='synthetic', source_type='unit_fixture',
        title='Synthetic graph', publisher='Test', region='unspecified', supported_claims=['test_fixture_only'])
    skills = [{'skill_id': 'demo:'+x, 'name': x, 'skill_type':'skill', 'aliases':['Alias A'] if x=='a' else [],
               'source_ids':['fixture'], 'reuse_level':'transversal' if x.startswith('generic') else 'occupation-specific'}
              for x in ['a','b','c','generic1','generic2','unrelated']]
    roles = []
    for i in range(12):
        req = [('a','essential'),('b','optional'),('c','essential')] if i==0 else [('generic1','essential'),('generic2','essential')]
        roles.append({'role_id':f'demo:R{i:02}', 'title':f'Synthetic role {i}', 'description':'Unit fixture only',
            'required_skills':[{'skill_id':'demo:'+n,'name':n,'requirement':kind,'source_ids':['fixture']} for n,kind in req],
            'source_ids':['fixture'],'region':'unspecified','evidence_status':'synthetic','requirements_complete':True,
            'expected_essential_count':sum(k=='essential' for _,k in req)})
    catalog = OccupationCatalog(schema_version='1.0',dataset_id='unit-graph',dataset_version='test',is_synthetic=True,occupations=roles,skills=skills)
    index = OccupationIndex(catalog, {'fixture':source}, 'local_full')
    profile = UserProfile(schema_version='1.0',profile_id='synthetic',is_synthetic=True,
        skills=[ProfileSkill(skill_id='demo:a',name='a'),ProfileSkill(skill_id='demo:b',name='b')])
    return profile,index


class DiscoveryTests(unittest.TestCase):
    def test_idf_optional_weight_and_distinct_coverage(self):
        p,i=fixture(); r=discover(p,i)
        self.assertEqual(r.total_qualifying_roles,1)
        s=r.results[0].score
        self.assertEqual(s.profile_relevance_pct,70)
        self.assertEqual(s.essential_coverage_pct,50)
        self.assertEqual(s.personal_fit_score_pct,50)
        self.assertAlmostEqual(s.weighted_profile_sum,2*(1+math.log(13/2)))
        self.assertEqual(r.discovered_candidate_count,1)

    def test_threshold_boundary(self):
        p,i=fixture()
        self.assertEqual(discover(p,i,config=RelevanceConfig(threshold_pct=70)).total_qualifying_roles,1)
        r=discover(p,i,config=RelevanceConfig(threshold_pct=70.001))
        self.assertEqual(r.total_qualifying_roles,0)
        self.assertEqual(r.diagnostic_counts['below_threshold'],1)

    def test_empty_single_specific_and_aliases_are_not_qualified(self):
        p,i=fixture()
        for skills in [[],p.skills[:1],[p.skills[0],ProfileSkill(skill_id='Alias A',name='Alias A')]]:
            p.skills=skills
            r=discover(p,i)
            self.assertEqual(r.total_qualifying_roles,0)
            self.assertTrue(r.insufficient_evidence)

    def test_generic_and_optional_only_safeguards(self):
        p,i=fixture()
        p.skills=[ProfileSkill(skill_id='demo:'+s,name=s) for s in ['generic1','generic2']]
        self.assertEqual(discover(p,i).total_qualifying_roles,0)
        p,i=fixture();i.catalog.occupations[0].required_skills[0].requirement='optional'
        i.catalog.occupations[0].expected_essential_count=1
        i=OccupationIndex(i.catalog,i.sources,'local_full')
        self.assertEqual(discover(p,i).total_qualifying_roles,0)

    def test_unrelated_recognised_skills_affect_denominator(self):
        p,i=fixture();before=discover(p,i).results[0].score.profile_relevance_pct
        p.skills.append(ProfileSkill(skill_id='demo:unrelated',name='unrelated'))
        after=discover(p,i).results[0].score.profile_relevance_pct
        self.assertLess(after,before)

    def test_ties_pagination_and_raw_sort(self):
        p,i=fixture()
        second=i.catalog.occupations[0].model_copy(deep=True,update={'role_id':'demo:R01'})
        i.catalog.occupations[1]=second
        i=OccupationIndex(i.catalog,i.sources,'local_full')
        first=discover(p,i,page_size=1)
        self.assertEqual(first.results[0].role_id,'demo:R00')
        self.assertEqual(first.next_offset,1)
        self.assertEqual(discover(p,i,page_size=1,offset=1).results[0].role_id,'demo:R01')
        second.required_skills[0].requirement='optional';second.required_skills[1].requirement='essential'
        i=OccupationIndex(i.catalog,i.sources,'local_full')
        with patch('src.profile_relevance.log',side_effect=[0,.000001]):
            r=discover(p,i)
        self.assertEqual(r.results[0].role_id,'demo:R01')
        self.assertEqual(r.results[0].score.profile_relevance_pct,r.results[1].score.profile_relevance_pct)

    def test_incomplete_evidence_unscorable_and_fallback_does_not_fake_idf(self):
        p,i=fixture();i.roles['demo:R00'].requirements_complete=False
        r=discover(p,i)
        self.assertEqual(r.diagnostic_counts['unscorable'],1)
        p,i=fixture();i.coverage='local_subset_fallback'
        r=discover(p,i)
        self.assertEqual(r.total_qualifying_roles,0)
        self.assertIsNone(r.scoring_configuration['frequency_universe_count'])

    def test_unknowns_spacing_and_no_upstream_call(self):
        p,i=fixture();p.skills[0]=ProfileSkill(skill_id='  Alias    A ',name='alias')
        p.skills.append(ProfileSkill(skill_id='typo',name='typo'))
        with patch('src.esco_api.client.fetch',side_effect=AssertionError('No network in matching')):
            r=discover(p,i)
        self.assertEqual(r.unknown_user_skills,['typo'])
        self.assertEqual(r.recognised_user_skill_count,2)
        self.assertEqual(r.total_qualifying_roles,1)

    def test_compact_concept_fallback_and_full_internal_graph(self):
        p,i=fixture();r=discover(p,i)
        self.assertLessEqual(len(r.results[0].development_areas),5)
        area=r.results[0].development_areas[0]
        self.assertEqual(area.supporting_concept_ids,['demo:c'])
        self.assertEqual(area.mapping_method,'source_concept_fallback')
        self.assertNotIn('missing_skills',r.results[0].model_dump())
        self.assertEqual(len(i.roles['demo:R00'].required_skills),3)

"""Isolated demo profiles, real pinned ESCO, no external provider requests."""
import json
import os
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch
from fastapi import HTTPException
from fastapi.testclient import TestClient
from src.main import app
from src.models.profiles import ProfileInput
from src.models.career_simulator import Exploration, PlanWrite
from src.services.profile_service import create_profile, list_sample_profiles
from src.services import career_simulator as service
from src.services.future_roles.occupation_index import get_occupation_index
from src.services.storage import connection


class CareerSimulatorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.index=get_occupation_index()
        assert cls.index.coverage=='local_full', 'Install the pinned full ESCO index for compatibility tests'
        cls.start=next(r for r in cls.index.roles.values() if r.title=='data scientist')

    def setUp(self):
        temp=tempfile.TemporaryDirectory();self.addCleanup(temp.cleanup)
        self.env=patch.dict(os.environ,{'APP_DB_PATH':temp.name+'/test.sqlite3','RUNPOD_API_KEY':'','TAVILY_API_KEY':''})
        self.env.start();self.addCleanup(self.env.stop)
        sample=list_sample_profiles()[0]
        sample={k:v for k,v in sample.items() if k not in {'sample_id','label','taxonomy'}}
        self.profile=create_profile(ProfileInput.model_validate(sample))
        self.key='a'*64
        self.headers={'X-Career-Simulator-Key':self.key}
        self.client=TestClient(app)
        self.addCleanup(self.client.close)
        query=Exploration(profile_id=self.profile.id,from_role_id=self.start.role_id,route=[self.start.role_id])
        self.candidates=service.explore(query,self.index)['results']
        self.target=self.candidates[0]
        self.draft={'profile_id':self.profile.id,'revision':0,'route':[self.start.role_id,self.target['role_id']],
                    'accepted':True,'chapters':[],'milestones':[]}

    def save(self, **changes):
        if changes.get('revision',0)>0 and 'plan_id' not in changes:
            changes['plan_id']=service.read_plan(self.profile.id,self.key,self.index)['plan']['plan_id']
        return service.save_plan(PlanWrite.model_validate({**self.draft,**changes}),self.key,self.index)['plan']

    def test_candidates_real_sources_overlap_and_original_profile_gaps(self):
        have={s.skill_id for s in service.profile(self.profile.id,self.index).skills}
        for candidate in self.candidates:
            target=self.index.roles[candidate['role_id']]
            shared=service.essential(target)&service.essential(self.start)
            self.assertEqual(candidate['overlap_count'],len(shared));self.assertGreater(len(shared),0)
            self.assertEqual(set(candidate['not_evidenced_essential_skill_ids']),service.essential(target)-have)
            self.assertEqual(candidate['relation_method'],service.METHOD)
            self.assertTrue(all(s in self.index.sources for s in candidate['source_ids']))
            self.assertTrue(all(url.startswith('https://') or url.startswith('http://data.europa.eu/esco/') for url in candidate['source_urls']))
        counts=[r['overlap_count'] for r in self.candidates]
        self.assertEqual(counts,sorted(counts,reverse=True));self.assertLessEqual(len(counts),6)

    def test_search_aspiration_and_no_cycles_or_invented_ids(self):
        request=Exploration(profile_id=self.profile.id,from_role_id=self.start.role_id,route=[self.start.role_id],query='nurse')
        results=service.explore(request,self.index,search=True)['results']
        self.assertTrue(results)
        for r in results:
            if r['overlap_count']==0:self.assertEqual(r['evidence_kind'],'user_selected_aspiration')
        for route in [[self.start.role_id]*2,['invented']]:
            with self.assertRaises((HTTPException,ValueError)):self.save(route=route)

    def test_one_plan_update_reload_and_optimistic_conflict(self):
        first=self.save()
        second=self.save(revision=first['revision'])
        self.assertEqual(first['plan_id'],second['plan_id']);self.assertEqual(second['revision'],2)
        self.assertEqual(service.read_plan(self.profile.id,self.key)['plan']['revision'],2)
        with self.assertRaises(HTTPException) as failure:self.save(revision=1)
        self.assertEqual(failure.exception.status_code,409)
        with connection() as db:self.assertEqual(db.execute('SELECT count(*) FROM career_simulator_plans').fetchone()[0],1)

    def test_concurrent_first_create_and_update_cannot_lose_changes(self):
        service.initialize()
        def attempt():
            try:return self.save()['revision']
            except HTTPException as error:return error.status_code
        with ThreadPoolExecutor(max_workers=3) as pool:results=list(pool.map(lambda _:attempt(),range(3)))
        self.assertEqual(sorted(results),[1,409,409])

    def test_capability_is_required_and_different_browsers_cannot_read_update_delete(self):
        self.save()
        url='/api/v2/career-simulator/plan?profile_id='+self.profile.id
        self.assertEqual(self.client.get(url).status_code,401)
        self.assertEqual(self.client.get(url,headers={'X-Career-Simulator-Key':'invalid'}).status_code,401)
        other={'X-Career-Simulator-Key':'b'*64}
        self.assertIsNone(self.client.get(url,headers=other).json()['plan'])
        self.assertFalse(self.client.delete(url+'&revision=1',headers=other).json()['deleted'])
        with connection() as db:
            row=db.execute('SELECT * FROM career_simulator_plans').fetchone()
            self.assertNotIn(self.key,json.dumps(dict(row)))
        self.assertEqual(self.client.put('/api/v2/career-simulator/plan',headers=other,json={**self.draft,'revision':1}).status_code,409)

    def test_skill_provenance_and_removed_role_reconciliation_preserve_goals_breaks(self):
        req=self.target['requirements'][0]
        entries=[{'id':'1'*32,'kind':'skill','title':'Client title ignored','order':0,'role_id':self.target['role_id'],'skill_id':req['skill_id']},
                 {'id':'2'*32,'kind':'goal','title':'My explicitly selected goal','order':1},
                 {'id':'3'*32,'kind':'break','title':'My break','order':2,'notes':'Self-authored'}]
        saved=self.save(milestones=entries)
        self.assertEqual(saved['milestones'][0]['title'],req['name'])
        edited=self.save(revision=1,route=[self.start.role_id],accepted=False,milestones=entries)
        self.assertEqual(edited['milestones'][0]['review_status'],'needs_review')
        self.assertEqual(edited['milestones'][1]['title'],entries[1]['title'])
        self.assertEqual(edited['milestones'][2]['notes'],'Self-authored')
        self.assertEqual(service.read_plan(self.profile.id,self.key)['plan']['milestones'],edited['milestones'])

    def test_unknown_skill_dates_duplicates_and_limits_rejected(self):
        invalids=[{'milestones':[{'id':'1'*32,'kind':'skill','title':'Unknown','order':0,'role_id':self.target['role_id'],'skill_id':'invented'}]},
                  {'milestones':[{'id':'1'*32,'kind':'goal','title':'x','order':0,'start_date':'2026-02-30'}]},
                  {'milestones':[{'id':'1'*32,'kind':'break','title':'x','order':0,'start_date':'2026-03-01','end_date':'2026-02-01'}]},
                  {'milestones':[{'id':'1'*32,'kind':'goal','title':'x'*161,'order':0}]},
                  {'route':list(self.index.roles)[:5]}]
        for data in invalids:
            with self.subTest(data=list(data)),self.assertRaises((HTTPException,ValueError)):self.save(**data)
        with patch.dict(os.environ,{'CAREER_SIMULATOR_MAX_DESTINATION_STEPS':'1'}):
            self.assertEqual(service.config(self.index)['max_destination_steps'],1)
            with self.assertRaises(HTTPException):self.save(route=list(self.index.roles)[:3])

    def test_missing_index_and_changed_evidence_retain_user_plan(self):
        self.save()
        old=self.index.fingerprint
        with patch.object(self.index,'fingerprint','changed'):
            self.assertTrue(service.read_plan(self.profile.id,self.key,self.index)['plan']['evidence_changed'])
            with self.assertRaises(HTTPException):self.save(revision=1)
        self.assertEqual(self.index.fingerprint,old)
        with patch.object(self.index,'coverage','local_subset_fallback'):
            self.assertIsNotNone(service.read_plan(self.profile.id,self.key,self.index)['plan'])
            with self.assertRaises(HTTPException):service.explore(Exploration(profile_id=self.profile.id),self.index)

    def test_delete_only_plan_and_no_new_provider_calls(self):
        with patch('urllib.request.urlopen',side_effect=AssertionError('No external calls')):
            saved=self.save()
            self.assertTrue(service.delete_plan(self.profile.id,1,self.key,saved['plan_id'])['deleted'])
            self.assertIsNone(service.read_plan(self.profile.id,self.key)['plan'])
            self.assertIsNotNone(service.profile(self.profile.id,self.index))

    def test_duplicate_milestones_and_cross_profile_scope_are_not_merged(self):
        entry={'id':'1'*32,'kind':'goal','title':'User goal','order':0}
        with self.assertRaises(ValueError):self.save(milestones=[entry,entry])
        first=self.save(milestones=[entry])
        sample={k:v for k,v in list_sample_profiles()[1].items() if k not in {'sample_id','label','taxonomy'}}
        second=create_profile(ProfileInput.model_validate(sample))
        self.assertIsNone(service.read_plan(second.id,self.key,self.index)['plan'])
        self.assertEqual(service.read_plan(self.profile.id,self.key,self.index)['plan']['plan_id'],first['plan_id'])

    def test_maximum_path_and_lowered_configuration_do_not_silently_truncate(self):
        route=[self.start.role_id]+[r['role_id'] for r in self.candidates[:3]]
        self.assertEqual(len(route),4)
        saved=self.save(route=route)
        with patch.dict(os.environ,{'CAREER_SIMULATOR_MAX_DESTINATION_STEPS':'1'}):
            loaded=service.read_plan(self.profile.id,self.key,self.index)['plan']
            self.assertTrue(loaded['over_limit']);self.assertEqual(loaded['route'],saved['route'])
            with self.assertRaises(HTTPException):self.save(revision=1,route=route)

    def test_read_evidence_change_is_nonmutating_and_save_failure_is_atomic(self):
        self.save()
        with connection() as db:before=db.execute('SELECT payload FROM career_simulator_plans').fetchone()[0]
        with patch.object(self.index,'fingerprint','new-reviewed-index'):
            service.read_plan(self.profile.id,self.key,self.index)
        with connection() as db:self.assertEqual(db.execute('SELECT payload FROM career_simulator_plans').fetchone()[0],before)
        with patch('src.services.career_simulator.json.dumps',side_effect=RuntimeError('Mock save failure')):
            with self.assertRaises(RuntimeError):self.save(revision=1)
        self.assertEqual(service.read_plan(self.profile.id,self.key,self.index)['plan']['revision'],1)

    def test_deleted_recreated_journey_cannot_be_overwritten_by_old_tab(self):
        old=self.save()
        service.delete_plan(self.profile.id,1,self.key,old['plan_id'])
        new=self.save()
        self.assertNotEqual(old['plan_id'],new['plan_id'])
        with self.assertRaises(HTTPException):self.save(revision=1,plan_id=old['plan_id'])
        with self.assertRaises(HTTPException):service.delete_plan(self.profile.id,1,self.key,old['plan_id'])

    def test_insertion_anchor_persists_and_legacy_milestones_remain_compatible(self):
        milestone={'id':'1'*32,'kind':'goal','title':'User goal','order':0,'after_id':'role:'+self.start.role_id}
        saved=self.save(milestones=[milestone])
        loaded=service.read_plan(self.profile.id,self.key,self.index)['plan']
        self.assertEqual(loaded['milestones'][0]['after_id'],milestone['after_id'])
        legacy={k:v for k,v in milestone.items() if k!='after_id'}
        updated=self.save(revision=saved['revision'],milestones=[legacy])
        self.assertIsNone(updated['milestones'][0]['after_id'])

    def test_cyclic_insertion_anchors_are_rejected(self):
        one={'id':'1'*32,'kind':'goal','title':'One','order':0,'after_id':'2'*32}
        two={'id':'2'*32,'kind':'goal','title':'Two','order':1,'after_id':'1'*32}
        with self.assertRaises(ValueError):PlanWrite.model_validate({**self.draft,'milestones':[one,two]})
        with self.assertRaises(ValueError):PlanWrite.model_validate({**self.draft,'milestones':[{**one,'after_id':one['id']}]})


if __name__=='__main__':unittest.main()

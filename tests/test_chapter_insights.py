"""Mocked shared Runpod only; isolated existing SQLite and real pinned ESCO."""
import json
import os
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch
from fastapi import HTTPException
from tests import test_career_simulator as fixtures
from src.models.chapter_insights import InsightRequest, InsightStart, InsightStatus
from src.services import chapter_insights as insights
from src.services.sources import runpod_api
from src.services.storage import connection

class ChapterInsightTests(unittest.TestCase):
    setUpClass=classmethod(fixtures.CareerSimulatorTests.setUpClass.__func__)
    save=fixtures.CareerSimulatorTests.save

    def setUp(self):
        fixtures.CareerSimulatorTests.setUp(self)
        self.env2=patch.dict(os.environ,{'RUNPOD_API_KEY':'mock-secret-not-a-real-key','RUNPOD_LLM_ENDPOINT_ID':'mock-llm'})
        self.env2.start();self.addCleanup(self.env2.stop)
        self.goal={'id':'1'*32,'kind':'goal','title':'Build a portfolio','order':0,'notes':'private-note-token','after_id':'role:'+self.start.role_id}
        self.saved=self.save(milestones=[self.goal])
        self.request=InsightRequest(profile_id=self.profile.id,milestone_id=self.goal['id'])
        self.submit=patch.object(runpod_api,'submit',return_value={'id':'mock-remote','status':'IN_QUEUE'}).start()
        self.status=patch.object(runpod_api,'job_status').start()
        self.addCleanup(patch.stopall)

    def raw(self,ctx=None):
        ctx=ctx or insights.context(self.request,self.key,self.index)
        return {'why_relevant':'This chapter could support a practical exploration of the selected path.',
                'practice':'You could choose a small task and reflect on the result.',
                'evidence_of_learning':'You could keep a short note about what you learned.',
                'evidence_id':ctx['payload']['basis']['id'],'evidence_quote':ctx['payload']['basis']['quote']}

    def complete(self,raw=None):
        return {'id':'mock-remote','status':'COMPLETED','output':{'choices':[{'finish_reason':'stop','message':{'content':json.dumps(self.raw() if raw is None else raw)}}]}}

    def poll(self,ticket):
        with connection() as db:db.execute('UPDATE chapter_insight_jobs SET poll_after=0 WHERE ticket=?',(ticket,))
        return insights.poll(InsightStatus(**self.request.model_dump(),job_id=ticket),self.key,self.index)

    def test_async_completion_persistence_cache_and_no_duplicate_submissions(self):
        initial=insights.cached(self.request,self.key,self.index)
        self.assertEqual(initial['status'],'idle');self.submit.assert_not_called()
        queued=insights.start(self.request,self.key,self.index)
        self.assertEqual(queued['status'],'queued')
        self.status.return_value=self.complete()
        completed=self.poll(queued['job_id'])
        self.assertEqual(completed['status'],'completed');self.assertEqual(completed['analysis']['evidence_quote'],self.goal['title'])
        self.assertTrue(insights.cached(self.request,self.key,self.index)['used_cache'])
        self.assertTrue(insights.start(self.request,self.key,self.index)['used_cache'])
        self.assertEqual(self.submit.call_count,1);self.assertEqual(self.status.call_count,1)
        payload=self.submit.call_args.args[1]
        self.assertEqual(payload['input']['model'],'glm-5.3');self.assertEqual(payload['input']['temperature'],.2)
        self.assertEqual(payload['policy']['ttl'],300000)
        with connection() as db:
            row=db.execute('SELECT * FROM chapter_insight_jobs').fetchone()
            self.assertIsNotNone(row['result_json']);self.assertNotIn('private-note-token',row['result_json'])

    def test_missing_credentials_returns_local_guidance_without_provider_calls(self):
        with patch.dict(os.environ,{'RUNPOD_API_KEY':''}):result=insights.start(self.request,self.key,self.index)
        self.assertEqual(result['status'],'unavailable');self.assertFalse(result['configured']);self.assertTrue(result['fallback']['practice'])
        self.submit.assert_not_called()

    def test_submission_timeout_is_not_automatically_retried(self):
        self.submit.side_effect=runpod_api.RunPodRequestError('private-provider-body',category='timeout')
        with self.assertLogs(insights.log,level='WARNING') as logs:result=insights.start(self.request,self.key,self.index)
        self.assertEqual(result['error_code'],'timeout');self.assertIsNone(result['analysis'])
        self.assertNotIn('private-provider-body',' '.join(logs.output))
        insights.start(self.request,self.key,self.index);self.poll(result['job_id'])
        self.assertEqual(self.submit.call_count,1);self.status.assert_not_called()

    def test_context_changes_invalidate_cache_and_reject_stale_jobs_without_submission(self):
        queued=insights.start(self.request,self.key,self.index)
        self.save(revision=self.saved['revision'],milestones=[{**self.goal,'notes':'Changed intention'}])
        changed=insights.cached(self.request,self.key,self.index)
        self.assertNotEqual(changed['fingerprint'],queued['fingerprint']);self.assertEqual(changed['status'],'idle')
        with self.assertRaises(HTTPException):self.poll(queued['job_id'])
        self.assertEqual(self.submit.call_count,1);self.status.assert_not_called()

    def test_other_capabilities_cannot_read_or_poll_insights(self):
        queued=insights.start(self.request,self.key,self.index)
        with self.assertRaises(HTTPException):insights.cached(self.request,'b'*64,self.index)
        with self.assertRaises(HTTPException):insights.poll(InsightStatus(**self.request.model_dump(),job_id=queued['job_id']),'b'*64,self.index)
        self.assertEqual(self.submit.call_count,1)

    def test_skill_evidence_is_verified_and_quotes_remain_verbatim(self):
        role=self.index.roles[self.target['role_id']];requirement=role.required_skills[0]
        skill={'id':'2'*32,'kind':'skill','title':requirement.name[:160],'order':0,'role_id':role.role_id,'skill_id':requirement.skill_id}
        self.save(revision=self.saved['revision'],milestones=[skill])
        self.request=InsightRequest(profile_id=self.profile.id,milestone_id=skill['id'])
        ctx=insights.context(self.request,self.key,self.index)
        self.submit.return_value=self.complete(self.raw(ctx))
        result=insights.start(self.request,self.key,self.index)
        self.assertEqual(result['status'],'completed');self.assertEqual(result['source']['kind'],'esco_requirement')
        self.assertEqual(result['analysis']['evidence_quote'],ctx['payload']['basis']['quote'])
        self.assertIn(requirement.skill_id,result['source']['source_urls']);self.assertTrue(result['source']['source_ids'])

    def test_invalid_schema_grounding_and_wording_are_safe_failures(self):
        for change,expected in [({'why_relevant':'You have guaranteed proficiency 100%'},'invalid_wording'),
                                ({'practice':'You have a portfolio and could publish it.'},'unsupported_personal_assertion'),
                                ({'evidence_quote':'Invented claim'},'invalid_evidence_reference'),
                                ({'evidence_id':'invented-source'},'invalid_evidence_reference'),
                                ({'unexpected':'raw-secret-token'},'invalid_schema')]:
            with self.subTest(expected=expected):
                with connection() as db:
                    db.execute("DROP TABLE IF EXISTS chapter_insight_jobs")
                self.submit.return_value=self.complete({**self.raw(),**change})
                with self.assertLogs(insights.log,level='WARNING') as logs:result=insights.start(self.request,self.key,self.index)
                self.assertEqual(result['error_code'],expected);self.assertIsNone(result['analysis'])
                safe=json.dumps(result)+' '.join(logs.output)
                for secret in ('mock-secret-not-a-real-key','raw-secret-token','private-note-token','Invented claim'):
                    self.assertNotIn(secret,safe)

    def test_explicit_retry_of_confirmed_terminal_failure_and_cached_deduplication(self):
        self.submit.return_value=self.complete({**self.raw(),'practice':'You could practise 3 tasks.'})
        with self.assertLogs(insights.log,level='WARNING') as logs:
            failed=insights.start(self.request,self.key,self.index)
        self.assertTrue(failed['retryable']);self.assertIsNone(failed['retry_at'])
        self.assertIn('field=practice',' '.join(logs.output))
        insights.start(self.request,self.key,self.index)
        self.assertEqual(self.submit.call_count,1)
        retry=InsightStart(**self.request.model_dump(),retry_failed=True)
        self.submit.return_value=self.complete()
        done=insights.start(retry,self.key,self.index)
        self.assertEqual(done['status'],'completed');self.assertNotEqual(done['job_id'],failed['job_id'])
        self.assertTrue(insights.start(retry,self.key,self.index)['used_cache'])
        self.assertEqual(self.submit.call_count,2)

    def test_legacy_completed_validation_failure_is_explicitly_retryable(self):
        queued=insights.start(self.request,self.key,self.index)
        with connection() as db:
            db.execute("UPDATE chapter_insight_jobs SET status='failed',error_code='invalid_grounding' WHERE ticket=?",(queued['job_id'],))
        self.assertTrue(insights.cached(self.request,self.key,self.index)['retryable'])
        self.submit.return_value=self.complete()
        done=insights.start(InsightStart(**self.request.model_dump(),retry_failed=True),self.key,self.index)
        self.assertEqual(done['status'],'completed');self.assertEqual(self.submit.call_count,2)

    def test_explicit_retry_cannot_duplicate_active_or_uncertain_submission(self):
        retry=InsightStart(**self.request.model_dump(),retry_failed=True)
        queued=insights.start(retry,self.key,self.index)
        self.assertEqual(insights.start(retry,self.key,self.index)['job_id'],queued['job_id'])
        with connection() as db:
            db.execute("UPDATE chapter_insight_jobs SET status='failed',error_code='timeout' WHERE ticket=?",(queued['job_id'],))
        guarded=insights.start(retry,self.key,self.index)
        self.assertFalse(guarded['retryable']);self.assertIsNotNone(guarded['retry_at'])
        self.assertEqual(self.submit.call_count,1)
        with connection() as db:created=db.execute('SELECT created_at FROM chapter_insight_jobs').fetchone()[0]
        with patch.object(insights.time,'time',return_value=created+306):
            insights.start(retry,self.key,self.index)
        self.assertEqual(self.submit.call_count,2)

    def test_unknown_provider_status_keeps_duplicate_guard(self):
        self.submit.return_value={'id':'mock-remote','status':'UNKNOWN'}
        result=insights.start(self.request,self.key,self.index)
        self.assertEqual(result['error_code'],'unsupported_provider_response')
        self.assertFalse(result['retryable'])
        insights.start(InsightStart(**self.request.model_dump(),retry_failed=True),self.key,self.index)
        self.assertEqual(self.submit.call_count,1)

    def test_prompt_matches_personal_assertion_guard_without_rewriting_quotes(self):
        for phrase in ('you are','you have','you want','your salary','your family','evidence_quote','verbatim'):
            self.assertIn(phrase,insights.INSTRUCTIONS)
        self.assertIn('all three explanatory fields',insights.INSTRUCTIONS)

    def test_truncation_bad_json_and_supported_wrappers(self):
        response=self.complete();response['output']['choices'][0]['finish_reason']='length';self.submit.return_value=response
        with self.assertLogs(insights.log,level='WARNING'):result=insights.start(self.request,self.key,self.index)
        self.assertEqual(result['status'],'failed')
        with connection() as db:db.execute('DELETE FROM chapter_insight_jobs')
        response=self.complete();response['output']['choices'][0]['message']['content']='not-json';self.submit.return_value=response
        with self.assertLogs(insights.log,level='WARNING'):self.assertEqual(insights.start(self.request,self.key,self.index)['error_code'],'invalid_output')
        with connection() as db:db.execute('DELETE FROM chapter_insight_jobs')
        response=self.complete();response['output']=[{'result':response['output']}];self.submit.return_value=response
        self.assertEqual(insights.start(self.request,self.key,self.index)['status'],'completed')

    def test_poll_leases_and_expiry_do_not_submit_or_flood(self):
        queued=insights.start(self.request,self.key,self.index)
        self.status.return_value={'id':'mock-remote','status':'IN_PROGRESS'}
        running=self.poll(queued['job_id']);self.assertEqual(running['status'],'in_progress')
        request=InsightStatus(**self.request.model_dump(),job_id=queued['job_id'])
        insights.poll(request,self.key,self.index);self.assertEqual(self.status.call_count,1)
        with connection() as db:created=db.execute('SELECT created_at FROM chapter_insight_jobs').fetchone()[0]
        with patch.object(insights.time,'time',return_value=created+301):
            self.assertEqual(insights.poll(request,self.key,self.index)['status'],'expired')
            insights.start(self.request,self.key,self.index)
        self.assertEqual(self.submit.call_count,1);self.assertEqual(self.status.call_count,1)

    def test_concurrent_starts_share_one_job(self):
        insights.initialize()
        with ThreadPoolExecutor(max_workers=2) as pool:jobs=list(pool.map(lambda _:insights.start(self.request,self.key,self.index),range(2)))
        self.assertEqual(jobs[0]['job_id'],jobs[1]['job_id']);self.assertEqual(self.submit.call_count,1)

    def test_api_cache_is_safe_and_requires_capability(self):
        body=self.request.model_dump()
        response=self.client.post('/api/v2/career-simulator/insights/cache',json=body,headers=self.headers)
        self.assertEqual(response.status_code,200);self.assertEqual(response.json()['status'],'idle')
        self.assertEqual(self.client.post('/api/v2/career-simulator/insights/jobs',json=body).status_code,401)
        self.submit.assert_not_called()

    def test_cached_valid_insights_remain_available_without_credentials(self):
        self.submit.return_value=self.complete()
        self.assertEqual(insights.start(self.request,self.key,self.index)['status'],'completed')
        with patch.dict(os.environ,{'RUNPOD_API_KEY':''}):
            result=insights.start(self.request,self.key,self.index)
        self.assertTrue(result['used_cache']);self.assertIsNotNone(result['analysis']);self.assertEqual(self.submit.call_count,1)

    def test_exact_numeric_goal_quote_and_anchored_neighbor_context_are_preserved(self):
        self.save(revision=self.saved['revision'],milestones=[{**self.goal,'title':'Build a 3D portfolio'}])
        ctx=insights.context(self.request,self.key,self.index)
        self.assertEqual(ctx['payload']['nearby_role_ids'],self.draft['route'])
        self.submit.return_value=self.complete(self.raw(ctx))
        result=insights.start(self.request,self.key,self.index)
        self.assertEqual(result['status'],'completed');self.assertEqual(result['analysis']['evidence_quote'],'Build a 3D portfolio')

if __name__=='__main__':unittest.main()

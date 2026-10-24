"""Isolated SQLite and mocked providers only; no inference credits consumed."""
import json
import copy
import os
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch, MagicMock

from src.models.career_analysis import AnalysisJobStart, AnalysisJobStatus
from src.services.future_roles import career_jobs as jobs, career_analysis as career
from src.services.future_roles.occupation_index import get_occupation_index
from src.services.sources import runpod_api
from src.services.storage import connection
import test_career_analysis as analysis_tests

REAL_SUBMIT = runpod_api.submit
REAL_STATUS = runpod_api.job_status


class CareerJobTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.index = get_occupation_index()
        cls.role = next(r for r in cls.index.roles.values() if r.title.casefold() == 'data scientist')

    def setUp(self):
        folder = tempfile.TemporaryDirectory(); self.addCleanup(folder.cleanup)
        env = patch.dict(os.environ, {'APP_DB_PATH': folder.name+'/jobs.sqlite3',
            'RUNPOD_API_KEY':'mock-secret-only','RUNPOD_LLM_ENDPOINT_ID':'mock-endpoint','TAVILY_API_KEY':''})
        env.start(); self.addCleanup(env.stop)
        self.request = AnalysisJobStart(role_id=self.role.role_id,
            recognised_skill_ids=[r.skill_id for r in self.role.required_skills[:3]])
        self.bundle = career.prepare_analysis(self.request,self.index)
        self.raw = analysis_tests.CareerAnalysisTests.output(self.bundle)
        self.submit = patch.object(runpod_api,'submit',return_value={'id':'remote-private-id','status':'IN_QUEUE'}).start()
        self.status = patch.object(runpod_api,'job_status',return_value=self.complete()).start()
        self.addCleanup(patch.stopall)
        career._cache.clear()

    def complete(self, raw=None):
        return {'id':'remote-private-id','status':'COMPLETED','output':{'choices':[{
            'finish_reason':'stop','message':{'content':json.dumps(self.raw if raw is None else raw)}}]}}

    def start(self):
        request = self.request
        if request.retry_failed and not request.retry_job_id:
            from src.services.storage import initialize_database
            initialize_database()
            with connection() as db:
                row = db.execute('SELECT ticket FROM career_analysis_jobs WHERE evidence_key=?', (self.bundle[0].evidence_key,)).fetchone()
            request = request.model_copy(update={'retry_job_id': row['ticket'] if row else None, 'retry_failed': bool(row)})
        return jobs.start(request,self.index)

    def poll(self, job):
        with connection() as db:
            db.execute('UPDATE career_analysis_jobs SET poll_after=0')
        request = AnalysisJobStatus(**self.request.model_dump(exclude={'retry_failed', 'retry_job_id'}),
            job_id=job.job_id,evidence_key=job.evidence_key)
        return jobs.poll(request,self.index)

    def test_success_preserves_original_payload_validation_and_cache(self):
        job = self.start()
        self.assertEqual(job.status,'queued')
        body = self.submit.call_args.args[1]
        self.assertEqual(body['input']['max_tokens'],1500)
        self.assertEqual(body['input']['model'],'glm-5.3')
        self.assertEqual(json.loads(body['input']['messages'][1]['content']),self.bundle[1])
        self.assertIn(career.CAREER_INSTRUCTIONS,body['input']['messages'][0]['content'])
        done = self.poll(job)
        self.assertEqual(done.status,'completed')
        self.assertEqual(len(done.analysis.interpretations),len(self.raw['groups']))
        self.assertEqual(len(done.analysis.bridges),1)
        self.assertIn(job.evidence_key,career._cache)
        self.assertTrue(self.start().analysis.used_cache)
        self.submit.assert_called_once()
        self.assertNotIn('remote-private-id',done.model_dump_json())
        self.assertNotIn('mock-secret-only',done.model_dump_json())

    def test_refresh_reload_and_duplicate_starts_never_resubmit(self):
        import importlib
        first = self.start()
        career._cache.clear()  # Simulate process-local cache lost on dev reload.
        importlib.reload(jobs)
        again = self.start()
        self.assertEqual(first.job_id,again.job_id)
        with ThreadPoolExecutor(max_workers=4) as pool:
            rows=list(pool.map(lambda _: self.start(),range(4)))
        self.assertTrue(all(r.job_id==first.job_id for r in rows))
        self.submit.assert_called_once()

    def test_concurrent_first_submissions_are_deduplicated(self):
        from src.services.storage import initialize_database
        initialize_database()
        with ThreadPoolExecutor(max_workers=4) as pool:
            rows=list(pool.map(lambda _: self.start(),range(4)))
        self.assertEqual(len({r.job_id for r in rows}),1)
        self.submit.assert_called_once()

    def test_in_progress_and_poll_throttling(self):
        self.status.return_value={'status':'IN_PROGRESS'}
        job=self.start(); update=self.poll(job)
        self.assertEqual(update.status,'in_progress')
        req=AnalysisJobStatus(role_id=self.request.role_id,recognised_skill_ids=self.request.recognised_skill_ids,
            job_id=job.job_id,evidence_key=job.evidence_key)
        jobs.poll(req,self.index)
        self.status.assert_called_once()
        self.submit.assert_called_once()

    def test_invalid_json_and_evidence_never_enter_success_cache(self):
        for invalid in ['not-json', {**self.raw,'groups':[{**self.raw['groups'][0],'evidence_ids':['invented']}]}]:
            job=self.start()
            self.request=self.request.model_copy(update={'retry_failed':False})
            response=self.complete(invalid)
            if isinstance(invalid,str):response['output']['choices'][0]['message']['content']=invalid
            self.status.return_value=response
            self.assertEqual(self.poll(job).status,'failed')
            self.assertNotIn(job.evidence_key,career._cache)
            self.assertEqual(self.start().status,'failed')
            self.request=self.request.model_copy(update={'retry_failed':True})
        self.assertEqual(self.submit.call_count,2)

    def test_completion_failure_stages_are_typed_and_safe(self):
        sentinel='PRIVATE_PROMPT_CV_EVIDENCE_AUTH_SECRET'
        cases=[]
        cases.append(({'status':'COMPLETED'},'output_extraction','unsupported_output','RunPodRequestError'))
        cases.append(({'status':'COMPLETED','output':sentinel},'output_extraction','unsupported_output','RunPodRequestError'))
        cases.append(({'status':'COMPLETED','output':{}},'output_extraction','unsupported_output','LLMResponseError'))
        for choice in [None, {}, {'message':{}}, {'message':{'content':[sentinel]}}]:
            cases.append(({'status':'COMPLETED','output':{'choices':[choice]}},'output_extraction','unsupported_output','LLMResponseError'))
        bad_json=self.complete();bad_json['output']['choices'][0]['message']['content']=sentinel
        cases.append((bad_json,'json_parsing','invalid_json','LLMResponseError'))
        truncated=self.complete();truncated['output']['choices'][0]['finish_reason']='length'
        truncated['output']['choices'][0]['message']['content']=sentinel
        cases.append((truncated,'model_completion','model_truncated','LLMResponseError'))
        schema={**self.raw,'private_extra_field':sentinel}
        cases.append((self.complete(schema),'generated_schema','invalid_generated_schema','ValidationError'))
        grounding=copy.deepcopy(self.raw);grounding['groups'][0]['evidence_ids']=['unknown']
        cases.append((self.complete(grounding),'evidence_grounding','invalid_esco_grounding','EvidenceGroundingError'))
        quotation=copy.deepcopy(self.raw);quotation['groups'][0]['evidence_quote']=sentinel
        cases.append((self.complete(quotation),'evidence_grounding','invalid_esco_grounding','EvidenceGroundingError'))
        cases.append((self.complete({'role_id':self.role.role_id,'groups':[],'bridges':[]}),
                      'supported_interpretations','no_supported_interpretations','NoSupportedInterpretations'))
        for response,stage,code,exception in cases:
            with self.subTest(stage=stage,case=len(str(response))):
                self.request=self.request.model_copy(update={'retry_failed':True})
                job=self.start();self.status.return_value=response
                with self.assertLogs(jobs.log,level='WARNING') as logs:failed=self.poll(job)
                self.assertEqual(failed.error_code,code)
                self.assertEqual(failed.status,'failed');self.assertIsNone(failed.analysis)
                self.assertNotIn(job.evidence_key,career._cache)
                text='\n'.join(logs.output)
                self.assertIn('job_id='+job.job_id,text)
                self.assertIn('stage='+stage,text)
                self.assertIn('category='+code,text)
                self.assertIn('exception_class='+exception,text)
                for secret in [sentinel,'mock-secret-only','remote-private-id','Traceback']:
                    self.assertNotIn(secret,text);self.assertNotIn(secret,failed.model_dump_json())

    def test_failure_telemetry_allows_only_known_finish_and_numeric_usage(self):
        response=self.complete();response['output']['choices'][0]['finish_reason']='PRIVATE_FINISH_SECRET'
        response['output']['choices'][0]['message']['content']='PRIVATE_CONTENT'
        response['output']['usage']={'prompt_tokens':100,'completion_tokens':1500,'total_tokens':1600,
                                    'api_key':'PRIVATE_KEY','raw_prompt':'PRIVATE_PROMPT'}
        job=self.start();self.status.return_value=response
        with self.assertLogs(jobs.log,level='WARNING') as logs:self.poll(job)
        text='\n'.join(logs.output)
        self.assertIn('finish_reason=other',text)
        self.assertIn("'completion_tokens': 1500",text)
        self.assertNotIn('PRIVATE_',text)
        for bad in ['PRIVATE_TOKEN',True,float('nan'),float('inf'),-1,10**100]:
            response['output']['usage']={'completion_tokens':bad}
            self.assertEqual(jobs._model_diagnostics(response)[1],{})
        response['output']['usage']=None
        response['usage']={'completion_tokens':1500,'private':'DO_NOT_LOG'}
        self.assertEqual(jobs._model_diagnostics(response)[1],{'completion_tokens':1500})

    def test_known_truncation_finish_and_token_counts_are_logged(self):
        response=self.complete();response['output']['choices'][0]['finish_reason']='length'
        response['output']['usage']={'completion_tokens':1500}
        job=self.start();self.status.return_value=response
        with self.assertLogs(jobs.log,level='WARNING') as logs:self.poll(job)
        self.assertIn('finish_reason=length','\n'.join(logs.output))
        self.assertIn("'completion_tokens': 1500",'\n'.join(logs.output))

    def test_valid_supported_wrappers_continue_to_cache_without_failure_logs(self):
        from src.services.storage import initialize_database
        initialize_database()
        output=self.complete()['output']
        for wrapper in [output,{'result':output},[output],[{'result':output}]]:
            with connection() as db:db.execute('DELETE FROM career_analysis_jobs')
            career._cache.clear();job=self.start()
            self.status.return_value={'status':'COMPLETED','output':wrapper}
            with self.assertNoLogs(jobs.log,level='WARNING'):done=self.poll(job)
            self.assertEqual(done.status,'completed')
            self.assertIn(job.evidence_key,career._cache)

    def test_unexpected_exception_is_sanitized_without_guessing_its_cause(self):
        job=self.start()
        with patch.object(career,'validate_analysis',side_effect=RuntimeError('PRIVATE_EXCEPTION_CONTENT')):
            with self.assertLogs(jobs.log,level='WARNING') as logs:failed=self.poll(job)
        self.assertEqual(failed.error_code,'unexpected_output_error')
        self.assertIn('exception_class=RuntimeError','\n'.join(logs.output))
        self.assertNotIn('PRIVATE_EXCEPTION_CONTENT','\n'.join(logs.output))

    def test_api_exposes_only_safe_failure_code(self):
        from fastapi.testclient import TestClient
        from src.main import app
        response=self.complete({**self.raw,'unexpected':'PRIVATE_MODEL_INPUT'})
        self.status.return_value=response
        with TestClient(app) as client:
            job=client.post('/api/v2/roles/analysis/jobs',json=self.request.model_dump()).json()
            with connection() as db:db.execute('UPDATE career_analysis_jobs SET poll_after=0')
            with self.assertLogs(jobs.log,level='WARNING') as logs:
                reply=client.post('/api/v2/roles/analysis/jobs/status',json={
                    **self.request.model_dump(exclude={'retry_failed', 'retry_job_id'}),
                    'job_id':job['job_id'],'evidence_key':job['evidence_key']})
            self.assertEqual(reply.status_code,200)
            self.assertEqual(reply.json()['error_code'],'invalid_generated_schema')
            self.assertIsNone(reply.json()['analysis'])
            self.assertNotIn('PRIVATE_MODEL_INPUT',reply.text)
            self.assertNotIn('PRIVATE_MODEL_INPUT','\n'.join(logs.output))

    def test_failed_expired_lost_and_bad_provider_jobs_are_terminal(self):
        job=self.start(); self.status.return_value={'status':'FAILED','error':'private output'}
        failed=self.poll(job)
        self.assertEqual(failed.status,'failed')
        self.assertNotIn('private output',failed.model_dump_json())
        self.assertEqual(self.start().job_id,job.job_id)
        with connection() as db:db.execute('UPDATE career_analysis_jobs SET status=\'queued\',expires_at=0')
        self.assertEqual(self.poll(job).status,'expired')
        self.submit.assert_called_once()

    def test_submit_timeout_is_not_retried_on_refresh(self):
        self.submit.side_effect=runpod_api.RunPodRequestError('private',category='timeout')
        first=self.start(); again=self.start()
        self.assertEqual(first.status,'failed'); self.assertEqual(again.job_id,first.job_id)
        self.assertEqual(first.error_code,'timeout'); self.submit.assert_called_once()

    def test_status_network_failure_is_terminal_without_resubmission(self):
        job=self.start();self.status.side_effect=TimeoutError('private')
        result=self.poll(job)
        self.assertEqual(result.status,'failed');self.assertEqual(result.error_code,'timeout')
        self.start();self.submit.assert_called_once()

    def test_lost_job_and_mismatched_provider_identity_are_safe(self):
        job=self.start()
        self.status.return_value={'id':'different-job','status':'COMPLETED'}
        self.assertEqual(self.poll(job).status,'failed')
        self.assertEqual(self.start().status,'failed')
        self.submit.assert_called_once()

    def test_invalid_persisted_cache_is_not_exposed(self):
        job=self.start()
        with connection() as db:db.execute("UPDATE career_analysis_jobs SET status='completed',result_json='not-json'")
        view=self.start()
        self.assertEqual(view.status,'failed');self.assertEqual(view.error_code,'invalid_cache')
        self.assertIsNone(view.analysis);self.submit.assert_called_once()

    def test_no_completion_accepted_beyond_overall_lifetime(self):
        job=self.start()
        with connection() as db:db.execute('UPDATE career_analysis_jobs SET expires_at=0')
        jobs._accept(job.job_id,self.complete(),self.bundle)
        self.assertEqual(jobs._read(job.job_id)['status'],'expired')
        self.assertNotIn(job.evidence_key,career._cache)

    def test_explicit_retry_rotates_ticket_but_normal_refresh_never_does(self):
        job=self.start();self.status.return_value={'status':'FAILED'};self.poll(job)
        self.assertEqual(self.start().job_id,job.job_id)
        self.request=self.request.model_copy(update={'retry_failed':True})
        retry=self.start()
        self.assertNotEqual(retry.job_id,job.job_id);self.assertEqual(self.submit.call_count,2)

    def test_unknown_and_cross_profile_tickets_cannot_fetch_output(self):
        job=self.start()
        request=AnalysisJobStatus(role_id=self.request.role_id,recognised_skill_ids=[],
            job_id=job.job_id,evidence_key=job.evidence_key)
        with self.assertRaises(KeyError):jobs.poll(request,self.index)
        request=request.model_copy(update={'recognised_skill_ids':self.request.recognised_skill_ids,'job_id':'0'*32})
        with self.assertRaises(KeyError):jobs.poll(request,self.index)
        self.status.assert_not_called()

    def test_retry_is_ticket_bound_atomic_and_keeps_private_history(self):
        job=self.start();self.status.return_value={'status':'FAILED'}
        self.assertTrue(self.poll(job).retryable)
        request=self.request.model_copy(update={'retry_failed':True,'retry_job_id':job.job_id})
        # Even if a replacement immediately fails, stale clicks cannot replace it again.
        self.submit.return_value={'id':'second-private-id','status':'FAILED'}
        with ThreadPoolExecutor(max_workers=4) as pool:
            rows=list(pool.map(lambda _: jobs.start(request,self.index),range(4)))
        self.assertEqual(self.submit.call_count,2)
        self.assertEqual(len({r.job_id for r in rows}),1)
        self.assertNotEqual(rows[0].job_id,job.job_id)
        history=json.loads(jobs._read(rows[0].job_id)['history_json'])
        self.assertEqual(history[0]['ticket'],job.job_id)
        self.assertEqual(history[0]['remote_id'],'remote-private-id')
        self.assertEqual(history[0]['error_code'],'provider_job_failed')
        self.assertIsNone(jobs._read(job.job_id))
        for row in rows:
            self.assertNotIn('private-id',row.model_dump_json())
            self.assertNotIn('history_json',row.model_dump_json())
        # A normal refresh still cannot retry this new failure.
        self.assertEqual(self.start().job_id,rows[0].job_id)
        self.assertEqual(self.submit.call_count,2)

    def test_retry_requires_current_ticket_and_never_replaces_pending_or_complete(self):
        job=self.start()
        request=self.request.model_copy(update={'retry_failed':True,'retry_job_id':job.job_id})
        self.assertEqual(jobs.start(request,self.index).job_id,job.job_id)
        done=self.poll(job)
        self.assertFalse(done.retryable)
        self.assertTrue(jobs.start(request,self.index).analysis.used_cache)
        self.submit.assert_called_once()
        jobs._write(job.job_id,status='failed',error_code='invalid_json')
        for ticket in (None,'0'*32):
            self.assertEqual(jobs.start(request.model_copy(update={'retry_job_id':ticket}),self.index).job_id,job.job_id)
        self.submit.assert_called_once()

    def test_retry_eligibility_blocks_uncertain_providers_configuration_and_capacity(self):
        job=self.start()
        for code,reason in [('timeout','previous_job_may_be_active'),('submission_unknown','previous_job_may_be_active'),
                            ('authentication','configuration_required')]:
            jobs._write(job.job_id,status='failed',error_code=code)
            view=self.start()
            self.assertFalse(view.retryable);self.assertEqual(view.retry_blocked_reason,reason)
            request=self.request.model_copy(update={'retry_failed':True,'retry_job_id':job.job_id})
            self.assertEqual(jobs.start(request,self.index).job_id,job.job_id)
        jobs._write(job.job_id,status='expired',error_code='job_expired',created_at=0)
        self.assertTrue(self.start().retryable)
        with patch.object(jobs,'MAX_ACTIVE',0):
            self.assertEqual(self.start().retry_blocked_reason,'job_capacity')
            self.assertFalse(jobs.start(request,self.index).retryable)
        with patch.dict(os.environ,{'RUNPOD_API_KEY':''}):
            self.assertFalse(self.poll(job).retryable)
        jobs._write(job.job_id,history_json='{}')
        self.assertEqual(self.start().retry_blocked_reason,'history_unavailable')
        jobs._write(job.job_id,history_json=json.dumps([{}]*jobs.MAX_HISTORY))
        self.assertEqual(self.start().retry_blocked_reason,'history_capacity')
        self.submit.assert_called_once()

    def test_old_database_history_column_is_migrated_without_losing_jobs(self):
        job=self.start()
        with connection() as db: db.execute('ALTER TABLE career_analysis_jobs DROP COLUMN history_json')
        from src.services.storage import initialize_database
        initialize_database()
        self.assertEqual(jobs._read(job.job_id)['history_json'],'[]')
        self.assertEqual(self.start().job_id,job.job_id)
        self.submit.assert_called_once()

    def test_missing_credentials_preserve_deterministic_evidence(self):
        with patch.dict(os.environ,{'RUNPOD_API_KEY':''}):self.assertEqual(self.start().status,'unavailable')
        result=career.analyse_career(self.request.model_copy(update={'generate_ai':False}),self.index)
        self.assertEqual(result.groups,self.bundle[0].groups)
        self.submit.assert_not_called()

    def test_interrupted_submission_stays_terminal_after_reload(self):
        job=self.start()
        with connection() as db:db.execute("UPDATE career_analysis_jobs SET status='submitting',created_at=0,remote_id=NULL")
        self.assertEqual(self.poll(job).error_code,'submission_unknown')
        self.start();self.submit.assert_called_once()

    def test_bounded_capacity_never_submits(self):
        with patch.object(jobs,'MAX_RECORDS',0):self.assertEqual(self.start().error_code,'job_capacity')
        self.submit.assert_not_called()

    def test_short_shared_async_transport(self):
        response=MagicMock();response.__enter__.return_value.read.return_value=b'{"id":"job-1","status":"IN_QUEUE"}'
        with patch.object(runpod_api,'urlopen',return_value=response) as call:
            REAL_SUBMIT('mock-endpoint',{'input':{}},timeout=5)
            self.assertEqual(call.call_args.args[0].get_method(),'POST')
            self.assertTrue(call.call_args.args[0].full_url.endswith('/run'))
            REAL_STATUS('mock-endpoint','job-1',timeout=5)
            self.assertEqual(call.call_args.args[0].get_method(),'GET')
            self.assertIsNone(call.call_args.args[0].data)
            self.assertTrue(call.call_args.args[0].full_url.endswith('/status/job-1'))
        with self.assertRaises(runpod_api.RunPodRequestError):REAL_STATUS('mock','../../health')

    def test_additive_api_contract(self):
        from fastapi.testclient import TestClient
        from src.main import app
        with TestClient(app) as client:
            job=client.post('/api/v2/roles/analysis/jobs',json=self.request.model_dump())
            self.assertEqual(job.status_code,200)
            body={**self.request.model_dump(exclude={'retry_failed', 'retry_job_id'}),'job_id':job.json()['job_id'],'evidence_key':job.json()['evidence_key']}
            with connection() as db:db.execute('UPDATE career_analysis_jobs SET poll_after=0')
            done=client.post('/api/v2/roles/analysis/jobs/status',json=body)
            self.assertEqual(done.status_code,200);self.assertEqual(done.json()['status'],'completed')
            body['job_id']='0'*32
            self.assertEqual(client.post('/api/v2/roles/analysis/jobs/status',json=body).status_code,404)

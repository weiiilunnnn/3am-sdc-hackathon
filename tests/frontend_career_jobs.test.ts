import assert from "node:assert/strict";
import test from "node:test";
import { awaitCareerAnalysis, type AnalysisJob } from "../src/frontend/lib/career-analysis-job";
import type { CareerAnalysis } from "../src/frontend/lib/career-analysis";

const inputs = {role_id:"fixture-role",recognised_skill_ids:["fixture-skill"]};
const evidence = "fixture-evidence";
const analysis = {role_id:inputs.role_id,evidence_key:evidence,status:"ready",interpretations:[],bridges:[]} as unknown as CareerAnalysis;
const job = (status: AnalysisJob["status"], changes: Partial<AnalysisJob> = {}): AnalysisJob => ({
  job_id:"opaque-ticket",evidence_key:evidence,status,poll_after_ms:3000,
  expires_at:null,error_code:null,analysis:status==="completed"?analysis:null,...changes,
});
const sleep = async () => {};

test("queued then running then complete submits once and only polls status", async () => {
  const calls: string[] = []; const responses=[job("queued"),job("in_progress"),job("completed")];
  const result=await awaitCareerAnalysis(inputs,evidence,new AbortController().signal,async (path,payload) => {
    calls.push(path);
    if (calls.length>1) assert.deepEqual(payload,{...inputs,job_id:"opaque-ticket",evidence_key:evidence});
    return responses.shift()!;
  },sleep);
  assert.equal(result,analysis);
  assert.deepEqual(calls,["/api/v2/roles/analysis/jobs","/api/v2/roles/analysis/jobs/status","/api/v2/roles/analysis/jobs/status"]);
});

test("refresh retrieves same pending ticket without frontend resubmission during polls", async () => {
  for(let refresh=0;refresh<2;refresh++) {
    let calls=0;
    await awaitCareerAnalysis(inputs,evidence,new AbortController().signal,async () => ++calls===1?job("queued"):job("completed"),sleep);
    assert.equal(calls,2); // Backend start dedup is separately tested with durable SQLite.
  }
});

test("terminal states retain deterministic fallback and stop", async () => {
  for(const status of ["failed","expired","unavailable"] as const) {
    let calls=0;
    const result=await awaitCareerAnalysis(inputs,evidence,new AbortController().signal,async()=>{calls++;return job(status);},sleep);
    assert.equal(result,null);assert.equal(calls,1);
  }
});

test("unmount or profile change aborts further status requests", async () => {
  const controller=new AbortController();let calls=0;
  const result=await awaitCareerAnalysis(inputs,evidence,controller.signal,async()=>{calls++;return job("queued");},async()=>controller.abort());
  assert.equal(result,null);assert.equal(calls,1);
});

test("outdated evidence and wrong-role completed results are ignored", async () => {
  for(const response of [job("completed",{evidence_key:"other"}),job("completed",{analysis:{...analysis,role_id:"other"}})]) {
    assert.equal(await awaitCareerAnalysis(inputs,evidence,new AbortController().signal,async()=>response,sleep),null);
  }
});

test("status network errors stop without submitting another inference", async () => {
  let calls=0;
  await assert.rejects(awaitCareerAnalysis(inputs,evidence,new AbortController().signal,async()=>{
    if(++calls===1)return job("queued");throw new Error("Offline");
  },sleep),/Offline/);
  assert.equal(calls,2);
});

test("overall polling and provider expiry are bounded", async () => {
  let clock=0,calls=0;
  assert.equal(await awaitCareerAnalysis(inputs,evidence,new AbortController().signal,async()=>{calls++;return job("queued");},async()=>{clock+=300_000;},()=>clock),null);
  assert.equal(calls,1);
  assert.equal(await awaitCareerAnalysis(inputs,evidence,new AbortController().signal,async()=>job("queued",{expires_at:1}),sleep,()=>2000),null);
});

test("explicit retry binds the failed ticket once and reuses normal polling", async () => {
  const payloads: unknown[]=[]; const seen: string[]=[];
  const result=await awaitCareerAnalysis(inputs,evidence,new AbortController().signal,async (_path,payload)=>{
    payloads.push(payload);return payloads.length===1?job("queued",{job_id:"replacement"}):job("completed");
  },sleep,Date.now,{retryJobId:"failed-ticket",onJob:j=>seen.push(j.status)});
  assert.equal(result,analysis);
  assert.deepEqual(payloads,[{...inputs,retry_failed:true,retry_job_id:"failed-ticket"},
    {...inputs,job_id:"replacement",evidence_key:evidence}]);
  assert.deepEqual(seen,["queued","completed"]);
});

test("failed refreshes never retry, and failed explicit retries do not loop", async () => {
  for(const retryJobId of [undefined,"failed-ticket"]) {
    let calls=0;let terminal: AnalysisJob | undefined;
    await awaitCareerAnalysis(inputs,evidence,new AbortController().signal,async (_path,payload)=>{
      calls++;assert.equal((payload as {retry_failed?:boolean}).retry_failed,retryJobId?true:undefined);
      return job("failed",{retryable:true});
    },sleep,Date.now,{retryJobId,onJob:j=>terminal=j});
    assert.equal(calls,1);assert.equal(terminal?.retryable,true);
  }
});

test("aborted retry and wrong evidence never publish stale job updates", async () => {
  const controller=new AbortController();let updates=0;
  await awaitCareerAnalysis(inputs,evidence,controller.signal,async()=>{
    controller.abort();return job("completed");
  },sleep,Date.now,{retryJobId:"old",onJob:()=>updates++});
  await awaitCareerAnalysis(inputs,evidence,new AbortController().signal,async()=>job("failed",{evidence_key:"other"}),
    sleep,Date.now,{onJob:()=>updates++});
  assert.equal(updates,0);
});

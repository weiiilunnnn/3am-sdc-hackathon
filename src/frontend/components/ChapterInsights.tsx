"use client";
import { useEffect, useRef, useState } from "react";
import { simulatorRequest } from "@/lib/career-simulator";
import { careerHref } from "@/lib/future-role-session";

type Prose={why_relevant:string;practice:string;evidence_of_learning:string};
type InsightJob={status:string;job_id:string|null;fingerprint:string;analysis:(Prose&{evidence_id:string;evidence_quote:string})|null;
 source:{kind:string;quote:string;source_urls:string[]};fallback:Prose;configured:boolean;used_cache:boolean;retryable?:boolean;error_code:string|null;retry_at:number|null};
const pending=(job:InsightJob|null)=>!!job&&["submitting","queued","in_progress"].includes(job.status);
export default function ChapterInsights({kind,milestoneId,profileId,capability,contextKey,ready,roleId,notes}:{
 kind:"goal"|"skill";milestoneId:string;profileId:string;capability:string;contextKey:string;ready:boolean;roleId?:string|null;notes?:string;
}){
 const generation=useRef(0);
 const [job,setJob]=useState<InsightJob|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [clock,setClock]=useState(()=>Date.now()/1000);
 useEffect(()=>{
  generation.current++;setJob(null);setError("");setBusy(false);if(!ready||!profileId||!capability)return;
  const controller=new AbortController();setBusy(true);
  void simulatorRequest<InsightJob>(capability,"/insights/cache","POST",{profile_id:profileId,milestone_id:milestoneId},controller.signal)
   .then(result=>{if(!controller.signal.aborted)setJob(result);})
   .catch(()=>{if(!controller.signal.aborted)setError("Saved insights are unavailable. Local guidance remains available.");})
   .finally(()=>{if(!controller.signal.aborted)setBusy(false);});
  return()=>{controller.abort();generation.current++;};
 },[profileId,capability,milestoneId,contextKey,ready]);
 useEffect(()=>{
  if(!ready||!pending(job)||!job?.job_id)return;
  const controller=new AbortController();const timer=setTimeout(()=>{
   void simulatorRequest<InsightJob>(capability,"/insights/jobs/status","POST",{profile_id:profileId,milestone_id:milestoneId,job_id:job.job_id},controller.signal)
    .then(result=>{if(!controller.signal.aborted)setJob(result);})
    .catch(()=>{if(!controller.signal.aborted){setJob({...job,status:"unavailable"});setError("Could not check the request. Generate insights can safely resume the existing job.");}});
  },8000);
  return()=>{clearTimeout(timer);controller.abort();};
 },[job,ready,capability,profileId,milestoneId,contextKey]);
 useEffect(()=>{
  if(!job?.retry_at)return;
  const timer=setTimeout(()=>setClock(Date.now()/1000),Math.max(0,job.retry_at*1000-Date.now())+50);
  return()=>clearTimeout(timer);
 },[job?.retry_at]);
 async function generate(){
  if(busy||pending(job)||!ready)return;
  const epoch=generation.current;setBusy(true);setError("");
  try{const result=await simulatorRequest<InsightJob>(capability,"/insights/jobs","POST",{profile_id:profileId,milestone_id:milestoneId,retry_failed:!!job&&["failed","expired","unavailable"].includes(job.status)});if(epoch===generation.current)setJob(result);}
  catch{if(epoch===generation.current)setError("AI insights are unavailable. Local guidance remains available.");}
  finally{if(epoch===generation.current)setBusy(false);}
 }
 const fallback=job?.fallback??{why_relevant:kind==="skill"?"Review this skill's documented role requirement below.":"This chapter records a goal you chose for your journey.",
  practice:kind==="skill"?"You could practise with a small task and record what you learn.":"Choose one practical next action toward this goal.",
  evidence_of_learning:"You could keep notes or a work sample to review your progress."};
 const prose=job?.analysis??fallback;
 const failureMessage=job?.error_code?({
  invalid_grounding:"The model response failed evidence or wording validation.",
  invalid_wording:"The model used wording that does not meet the explanation rules.",
  unsupported_personal_assertion:"The model made an unsupported personal assertion.",
  invalid_evidence_reference:"The model changed or misreferenced the supplied evidence.",
  invalid_schema:"The model returned an invalid explanation structure.",
  invalid_output:"The model returned an unreadable or incomplete response.",
  authentication:"Runpod rejected the backend credentials. Check endpoint access.",
  provider_terminal_failure:"Runpod reported that the job failed.",
 } as Record<string,string>)[job.error_code]??"AI insights are unavailable.":"AI insights are unavailable.";
 const waitingForRetry=!job?.retryable&&!!job?.retry_at&&Math.max(clock,Date.now()/1000)<job.retry_at;
 return <section className="sim-chapter-insights" aria-label="Chapter insights">
  <div className="sim-insights-heading"><h4>{job?.analysis?"AI-generated suggestions":"Local guidance"}</h4>
   {job?.used_cache&&<span className="sim-context-badge">Saved AI insights</span>}</div>
  <p className="sim-insights-disclosure">Suggestions are possibilities, not proof of competence or knowledge of your personal motivations.</p>
  <div className="sim-insights-grid">{[["Why this chapter may help",prose.why_relevant],[kind==="skill"?"What you could practise":"A possible next action",prose.practice],["Evidence you could keep",prose.evidence_of_learning]].map(([title,text])=><div key={title}><h4>{title}</h4><p>{text}</p></div>)}</div>
  {job?.source&&<div className="sim-insights-source"><strong>{job.source.kind==="esco_requirement"?"Verified ESCO relationship":"Your selected goal"}</strong><p>{job.source.quote}</p>
   {job.source.source_urls.map((url,i)=><a key={url} href={url} target="_blank" rel="noopener noreferrer">Source {i+1}</a>)}</div>}
  {notes&&<p className="sim-insights-notes">Your notes: {notes}</p>}
  {kind==="skill"&&roleId&&<a href={`${careerHref(roleId)}/pathway`}>Explore learning resources</a>}
  {!job?.analysis&&<div className="sim-insights-generate"><p>Generate optional insights using this chapter, its notes and nearby occupation titles. This sends that context to the shared Runpod model.</p>
   <button type="button" onClick={()=>void generate()} disabled={!ready||!profileId||!capability||busy||pending(job)||job?.configured===false||waitingForRetry}>{pending(job)?"Generating insights...":busy?"Loading insights...":job?.retryable?"Retry insights":"Generate insights"}</button>
   {!ready&&<p>Save this chapter and review any flagged ESCO evidence before generating insights.</p>}
   {job?.configured===false&&<p>AI is not configured. Local guidance remains available.</p>}
   {job&&["failed","expired","unavailable"].includes(job.status)&&<p role="status">{failureMessage} Local guidance remains available.{job.retryable?" You can retry explicitly; no new job is submitted automatically.":""}{waitingForRetry?" Wait for the previous request's lifetime to end before trying again.":""}</p>}
  </div>}
  {pending(job)&&<p role="status">The request is running in the background. You can continue using the page.</p>}
  {error&&<p role="status">{error}</p>}
 </section>;
}

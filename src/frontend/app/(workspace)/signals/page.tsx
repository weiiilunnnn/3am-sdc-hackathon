"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRegistrationProfile } from "../profile-workspace";
import type { PathwaayRegistrationProfile } from "@/lib/pathwaay-profile";
import "./ai-trend-v5.css";
import DisruptionOutlook from "./DisruptionOutlook";

type ProfileRequest = { occupation: string; field_of_study: string; skills: {name:string;skill_id:string|null}[]; work_tasks:string[]; aspiration:string };
type Skill = { id:string|null; key:string; name:string; connection_count:number; potential_count?:number };
type Evidence = { id:string; title:string; company:string; url:string; published_at:string; source_quote:string; ai_quote:string; source:string };
type Connection = { id:string; current_skill_id:string; current_skill_name:string; ai_skill:{id:string;name:string;definition:string}; basis:"same_posting"|"same_task_passage"; work_task:string; evidence:Evidence[]; employer_count?:number; source:{name:string;collected_at:string|null;scope:string} };
type Experience = { selected_skill_id:string|null; skills:Skill[]; connections:Connection[]; candidates?:Connection[]; source_state:{name:string;posting_sample_size:number;collected_at:string|null}; method:string; profile:{occupation:string} };
type Review = {status:string;decision?:"related_workflow"|"unrelated"|"insufficient";rationale?:string;learning_gap?:string;next_step?:string;review_origin?:string};
type Topic = { topic_id:string;label:string; source_url:string|null; observations:{period_year:number;value:number}[];change:{status:string;percentage_change:number|null;compared_years:number[]|null} };
type Research = {topics:Topic[];refresh_status:string;last_successful_refresh:string|null;error_message?:string|null};
type JobSkill = {id:string;name:string;definition:string;metric:{kind:string;numerator?:number;denominator?:number;percentage_points?:number;earlier?:{numerator:number;denominator:number};recent?:{numerator:number;denominator:number}};roles:string[];evidence:Evidence[];tasks:string[]};
type Jobs = {mode:string;sample_size:number;source_scope:string;items:JobSkill[]};

function pack(profile:PathwaayRegistrationProfile):ProfileRequest {
  return {
    occupation:profile.experiences?.find((v)=>v.title.trim())?.title.trim().slice(0,120) || "",
    field_of_study:profile.major.trim().slice(0,120),
    skills:profile.skills.map((name)=>({ name:name.trim(),skill_id:profile.skillLinks?.find((x)=>x.name.trim().toLowerCase()===name.trim().toLowerCase())?.skill_id ?? null })).filter((x)=>x.name).slice(0,40),
    work_tasks:profile.workActivities.split(/[\n;,]+/).map((x)=>x.trim()).filter(Boolean).slice(0,12),
    aspiration:profile.aspiration.slice(0,240),
  };
}
function compact(n:number) { return new Intl.NumberFormat(undefined,{notation:"compact",maximumFractionDigits:1}).format(n); }
function fullDate(value:string|null) {if(!value)return "Not refreshed";const dt=new Date(value);return Number.isFinite(dt.getTime())?dt.toLocaleDateString(undefined,{month:"short",year:"numeric",day:"numeric"}):value;}
function Icon({name,size=20}:{name:"spark"|"arrow"|"close"|"book"|"trend"|"code"|"database"|"check"|"up",size?:number}) {
  const paths:Record<string,ReactNode>={
    spark:<><path d="m12 2 1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9Z"/><path d="m19 17 .7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7Z"/></>,
    arrow:<><path d="M4 12h16m-7-7 7 7-7 7"/></>,close:<path d="m5 5 14 14M19 5 5 19"/>,
    book:<><path d="M4 5c3-1 6-.5 8 1v14c-2-1.5-5-2-8-1Zm8 1c2-1.5 5-2 8-1v14c-3-1-6-.5-8 1"/></>,
    trend:<><path d="m3 17 6-6 4 3 7-8"/><path d="M15 6h5v5"/></>,
    code:<><path d="m8 7-5 5 5 5m8-10 5 5-5 5M14 4l-4 16"/></>,
    database:<><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 4 18 4 18 0V5M3 12c0 4 18 4 18 0"/></>,
    check:<><path d="m4 12 5 5L20 6"/></>,up:<><path d="M7 17 17 7M8 7h9v9"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
function ResearchChart({topic}:{topic:Topic}) {
  const points=[...topic.observations].sort((a,b)=>a.period_year-b.period_year);
  if(points.length<2)return <div className="v5-chart-empty">Waiting for comparable annual publication data.</div>;
  const maximum=Math.max(...points.map(p=>p.value),1),minimum=Math.min(...points.map(p=>p.value));
  const range=Math.max(maximum-minimum,1);
  const xy=points.map((p,i)=>[32+(i/(points.length-1))*632,174-((p.value-minimum)/range)*126] as const);
  return <div className="v5-chart" aria-label={`OpenAlex publication observations for ${topic.label}`}>
    <svg viewBox="0 0 696 212" role="img" aria-label={`${topic.label} publications by year: ${points.map(p=>`${p.period_year} ${p.value}`).join(', ')}`}>
      {[0,1,2,3].map(i=><line key={i} x1="32" y1={48+i*42} x2="664" y2={48+i*42} className="v5-gridline"/>)}
      <polyline points={xy.map(pair=>pair.join(",")).join(" ")} fill="none" stroke="#7ee4ae" strokeWidth="3.6" strokeLinejoin="round" strokeLinecap="round"/>
      {xy.map((pair,i)=><circle key={points[i].period_year} cx={pair[0]} cy={pair[1]} r="5" stroke="#08261d" strokeWidth="2" fill="#b0facb"/>)}
      {points.map((p,i)=><text key={p.period_year} x={xy[i][0]} y="205" textAnchor="middle" className="v5-axis-label">{p.period_year}</text>)}
    </svg>
    <div className="v5-chart-footer"><span>{points[0].period_year}: {points[0].value.toLocaleString()} publications</span><span>{points.at(-1)?.period_year}: {points.at(-1)?.value.toLocaleString()} publications</span></div>
  </div>;
}

export default function SignalsPage(){
  const {profile,loading:profileLoading}=useRegistrationProfile();
  const request=useMemo(()=>profile?pack(profile):null,[profile]);
  const fingerprint=JSON.stringify(request);
  const [view,setView]=useState<"personal"|"explore"|"disruption">("personal");
  const [personal,setPersonal]=useState<Experience|null>(null),[selected,setSelected]=useState<string|null>(null);
  const [personalBusy,setPersonalBusy]=useState(false),[personalError,setPersonalError]=useState("");
  const [allSkills,setAllSkills]=useState(false),[opened,setOpened]=useState<Connection|null>(null);
  const [reviews,setReviews]=useState<Record<string,Review>>({}),[reviewErrors,setReviewErrors]=useState<Record<string,string>>({});
  const reviewsStarted=useRef(new Set<string>());
  const [research,setResearch]=useState<Research|null>(null),[researchBusy,setResearchBusy]=useState(false),[researchError,setResearchError]=useState("");
  const [jobs,setJobs]=useState<Jobs|null>(null),[jobsBusy,setJobsBusy]=useState(false),[jobsError,setJobsError]=useState("");
  const researchRefreshed=useRef(false);
  const [topicId,setTopicId]=useState<string|null>(null),[jobSelected,setJobSelected]=useState<string|null>(null);
  const dialog=useRef<HTMLDialogElement|null>(null);
  const latestRequest=useRef<AbortController|null>(null);
  const pendingReview=opened && !reviews[opened.id] && !reviewErrors[opened.id];

  const loadPersonal=useCallback(async(ctrl:AbortController,skill?:string)=>{
    if(!request?.skills.length)return;
    const query=skill?`?skill_id=${encodeURIComponent(skill)}`:"";
    const resp=await fetch(`/api/trends/session-connections${query}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(request),cache:"no-store",signal:ctrl.signal});
    if(!resp.ok)throw Error(`Evidence request failed (HTTP ${resp.status}).`);
    const data=await resp.json() as Experience;
    if(!ctrl.signal.aborted){setPersonal(data);setSelected(data.selected_skill_id);}
  },[fingerprint]);
  useEffect(()=>{
    latestRequest.current?.abort();const ctrl=new AbortController();latestRequest.current=ctrl;
    setPersonal(null);setSelected(null);setPersonalError("");setReviews({});setReviewErrors({});reviewsStarted.current.clear();
    if(!request?.skills.length){setPersonalBusy(false);return()=>ctrl.abort();}
    setPersonalBusy(true);
    void loadPersonal(ctrl).catch((e:unknown)=>{if(!ctrl.signal.aborted)setPersonalError(e instanceof Error?e.message:"Evidence unavailable");}).finally(()=>{if(!ctrl.signal.aborted)setPersonalBusy(false);});
    return()=>ctrl.abort();
  },[loadPersonal,fingerprint]);
  async function chooseSkill(skill:string){
    if(skill===selected||!request)return;
    latestRequest.current?.abort();const ctrl=new AbortController();latestRequest.current=ctrl;
    setSelected(skill);setPersonalBusy(true);setPersonalError("");
    try{await loadPersonal(ctrl,skill);}catch(e){if(!ctrl.signal.aborted)setPersonalError(e instanceof Error?e.message:"Evidence unavailable");}
    finally{if(!ctrl.signal.aborted)setPersonalBusy(false);}
  }
  useEffect(()=>{
    if(view!=="explore")return;
    if(!jobs){const ctrl=new AbortController();setJobsBusy(true);
      void fetch("/api/trends/explore-ai-skills",{signal:ctrl.signal}).then(async(r)=>{if(!r.ok)throw Error("Job evidence unavailable");return await r.json() as Jobs;}).then(result=>{if(!ctrl.signal.aborted)setJobs(result);}).catch((e:unknown)=>{if(!ctrl.signal.aborted)setJobsError(e instanceof Error?e.message:"Job evidence unavailable");}).finally(()=>{if(!ctrl.signal.aborted)setJobsBusy(false);});
      return()=>ctrl.abort();}
  },[view,jobs]);
  useEffect(()=>{
    if(view!=="explore"||research)return;
    let active=true;setResearchBusy(true);setResearchError("");
    async function load(){
      try{
        let r=await fetch("/api/trends",{cache:"no-store"});if(!r.ok)throw Error(`OpenAlex status unavailable (${r.status})`);
        let result=await r.json() as Research;
        if(!result.topics.some(t=>t.observations.length)&&!researchRefreshed.current){
          researchRefreshed.current=true;
          r=await fetch("/api/trends/refresh",{method:"POST",cache:"no-store"});
          if(!r.ok)throw Error(`OpenAlex refresh failed (HTTP ${r.status})`);
          result=await r.json() as Research;
        }
        if(active){setResearch(result);if(!result.topics.some(t=>t.observations.length)&&result.error_message)setResearchError(result.error_message);}
      }catch(e){if(active)setResearchError(e instanceof Error?e.message:"Research data unavailable");}
      finally{if(active)setResearchBusy(false);}
    }
    void load();return()=>{active=false;};
  },[view,research]);
  function openEvidence(item:Connection){setOpened(item);}
  function closeEvidence(){dialog.current?.close();setOpened(null);}
  useEffect(()=>{if(opened&&!dialog.current?.open)dialog.current?.showModal();},[opened]);
  const review=useCallback(async(item:Connection,allowRetry=false)=>{
    if(!request||(!allowRetry&&reviewsStarted.current.has(item.id)))return;
    reviewsStarted.current.add(item.id);setReviewErrors(old=>{const next={...old};delete next[item.id];return next;});
    try{
      const r=await fetch("/api/trends/session-review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({profile:request,connection_id:item.id}),cache:"no-store"});
      if(!r.ok)throw Error(`RunPod review failed (HTTP ${r.status}).`);
      const result=await r.json() as Review;
      if(result.status!=="generated"&&result.status!=="cached")throw Error(`Model review unavailable: ${result.status.replace(/_/g," ")}.`);
      setReviews(old=>({...old,[item.id]:result}));
    }catch(e){setReviewErrors(old=>({...old,[item.id]:e instanceof Error?e.message:"Model review unavailable."}));}
  },[fingerprint]);
  useEffect(()=>{if(opened)void review(opened);},[opened,review]);

  const active=personal?.skills.find(s=>s.key===selected);
  const orderedSkills=[...(personal?.skills??[])].sort((a,b)=>(b.potential_count??b.connection_count)-(a.potential_count??a.connection_count));
  const visibleSkills=allSkills?orderedSkills:orderedSkills.slice(0,7);
  const connections=[...(personal?.connections??[]),...(personal?.candidates??[])];
  const distinct=new Map(connections.map(x=>[x.id,x]));
  const related=[...distinct.values()];
  const selectedTopic=research?.topics.find(t=>t.topic_id===topicId)??research?.topics.find(t=>t.observations.length>0)??research?.topics[0];
  const topicRows=[...(research?.topics??[])].sort((a,b)=>{
    const aValid=a.change.status==="available"&&a.change.percentage_change!==null;
    const bValid=b.change.status==="available"&&b.change.percentage_change!==null;
    return Number(bValid)-Number(aValid) || (b.change.percentage_change??-Infinity)-(a.change.percentage_change??-Infinity);
  });
  const maxMention=Math.max(1,...(jobs?.items??[]).map(item=>item.metric.numerator??item.metric.recent?.numerator??0));
  const selectedJob=jobs?.items.find(item=>item.id===jobSelected);
  const currentReview=opened?reviews[opened.id]:undefined;
  const errorReview=opened?reviewErrors[opened.id]:undefined;

  return <main className="v5-page">
    <div className="v5-glow" aria-hidden="true"/>
    <div className="v5-wrap">
      <header className="v5-heading"><p className="v5-eyebrow"><span className="v5-signal-dot"/> AI TREND SIGNAL</p><h1>{view==="personal"?"Your skills. New possibilities.":view==="explore"?"Where AI is moving.":"How might AI change your work?"}</h1><p className="v5-intro">{view==="personal"?"Discover AI-related work that connects with what you already know.":view==="explore"?"Follow AI research activity and examine the capabilities appearing in real job descriptions.":"Explore one evidence-limited transformation assessment, job-posting signals and a practical adaptation step."}</p></header>
      <nav className="v5-tabs" aria-label="AI Trend Signal views"><button type="button" className={view==="personal"?"active":""} aria-current={view==="personal"?"page":undefined} onClick={()=>{setView("personal");setJobSelected(null);}}>For your skills</button><button type="button" className={view==="explore"?"active":""} aria-current={view==="explore"?"page":undefined} onClick={()=>{closeEvidence();setView("explore");}}>Explore AI skills</button><button type="button" className={view==="disruption"?"active":""} aria-current={view==="disruption"?"page":undefined} onClick={()=>{closeEvidence();setView("disruption");}}>Disruption outlook</button></nav>
      {view==="personal"&&<div className="v5-personal">
        {profileLoading&&<p className="v5-status">Reading your profile…</p>}
        {!profileLoading&&!profile&&<section className="v5-empty"><h2>Build your skill profile first.</h2><p>These pathways are based on the skills you enter during registration.</p><Link href="/register">Start registration <Icon name="arrow"/></Link></section>}
        {!profileLoading&&profile&&!request?.skills.length&&<section className="v5-empty"><h2>Add your first skill.</h2><Link href="/profile">Edit profile <Icon name="arrow"/></Link></section>}
        {personal&&<div className="v5-personal-layout">
          <aside className="v5-skill-rail"><div className="v5-rail-title"><span className="v5-eyebrow">YOUR SKILL SET</span><Link href="/profile" aria-label="Edit your profile">Edit ↗</Link></div>
            <h2>Start here.</h2><p>Select an existing skill to find potentially related AI work.</p>
            <div className="v5-skill-buttons">{visibleSkills.map(s=><button key={s.key} type="button" className={selected===s.key?"selected":""} aria-pressed={selected===s.key} onClick={()=>void chooseSkill(s.key)}><span>{s.name}</span><small aria-label={`${s.potential_count??s.connection_count} potential links`}>{s.potential_count??s.connection_count}</small></button>)}</div>
            {orderedSkills.length>7&&<button type="button" className="v5-text-action" onClick={()=>setAllSkills(!allSkills)}>{allSkills?"Show fewer skills":`Show all ${orderedSkills.length} skills`} ↓</button>}
            <p className="v5-rail-note">Numbers are observed candidate links, not verified career transitions.</p>
          </aside>
          <section className="v5-pathways" aria-label="AI pathway exploration">
            <div className="v5-pathways-head"><div><span className="v5-eyebrow">POTENTIAL CONNECTIONS</span><h2>{active?.name??"Your skills"}<span className="v5-soft"> in the AI era</span></h2></div><div className="v5-number"><strong>{active?.potential_count??related.length}</strong><small>possible links</small></div></div>
            {personalBusy&&<p className="v5-status">Finding source-backed connections…</p>}
            {personalError&&<p role="alert" className="v5-error">{personalError}</p>}
            {!personalBusy&&selected===personal.selected_skill_id&&related.length>0&&<><div className="v5-pathway-flow"><div className="v5-from"><span>YOUR SKILL</span><strong>{active?.name}</strong></div><div className="v5-flow-line"><span/><Icon name="arrow" size={26}/></div><div className="v5-to"><span>AI-RELATED WORK</span><strong>{related.length} candidate {related.length===1?"link":"links"}</strong></div></div>
              <div className="v5-connection-list">{related.map((item,i)=><button type="button" className="v5-connection-row" key={item.id} onClick={()=>openEvidence(item)}><span className="v5-row-index">{String(i+1).padStart(2,"0")}</span><span className="v5-row-main"><strong>{item.ai_skill.name}</strong><small>{item.basis==="same_task_passage"?"Same-passage match · unreviewed":"Same-role mention · relationship unreviewed"}</small></span><span className="v5-row-icon"><Icon name="up"/></span></button>)}</div>
              <p className="v5-tiny-context">Select a pathway to see a short AI review, a practical next step, and the original job evidence.</p></>}
            {!personalBusy&&selected===personal.selected_skill_id&&!related.length&&<section className="v5-soft-empty"><Icon name="spark" size={28}/><h3>No supported pathway in this sample yet</h3><p>The sampled descriptions don't establish a useful connection for this skill. That doesn't mean it has no AI applications.</p></section>}
          </section></div>}
        {personal&&<footer className="v5-footnote"><Icon name="database" size={16}/>{personal.source_state.name} · {personal.source_state.posting_sample_size} saved postings · {fullDate(personal.source_state.collected_at)}<details><summary>How matches are found</summary><p>{personal.method} Candidate matches are not proof that a transition is possible.</p></details></footer>}
      </div>}
      {view==="disruption"&&<DisruptionOutlook profile={request}/>}
      {view==="explore"&&<div className="v5-explore">
        <section className="v5-research-section"><div className="v5-section-title"><div><p className="v5-eyebrow"><Icon name="trend" size={17}/> OPENALEX · RESEARCH ACTIVITY</p><h2>AI research momentum</h2><p>Compare completed years of publications for selected AI research topics.</p></div><span className="v5-source-pill">Research ≠ hiring</span></div>
          {researchBusy&&<p className="v5-status">Loading research observations from OpenAlex…</p>}
          {researchError&&<p role="status" className="v5-error">{researchError}</p>}
          {research&&<div className="v5-research-layout"><div className="v5-featured-chart"><div className="v5-chart-label"><div><span className="v5-eyebrow">PUBLICATION HISTORY</span><h3>{selectedTopic?.label??"AI research"}</h3></div>{selectedTopic?.change.status==="available"&&selectedTopic.change.percentage_change!==null&&<span className="v5-change">{selectedTopic.change.percentage_change>=0?"+":""}{selectedTopic.change.percentage_change.toFixed(1)}% <small>YoY</small></span>}</div>
            {selectedTopic?<ResearchChart topic={selectedTopic}/>:<div className="v5-chart-empty">No topics available.</div>}
            <div className="v5-chart-source">{selectedTopic?.source_url?<a href={selectedTopic.source_url} target="_blank" rel="noreferrer">View OpenAlex query ↗</a>:"Source: OpenAlex"}<span>Refreshed {fullDate(research.last_successful_refresh)}</span></div></div>
            <div className="v5-topic-list"><h3>Explore topics</h3><p>Ranked by comparable year-over-year research growth when available.</p>{topicRows.map(t=><button type="button" key={t.topic_id} className={selectedTopic?.topic_id===t.topic_id?"selected":""} onClick={()=>setTopicId(t.topic_id)}><span>{t.label}</span><strong>{t.change.status==="available"&&t.change.percentage_change!==null?`${t.change.percentage_change>=0?"+":""}${t.change.percentage_change.toFixed(0)}%`:"—"}</strong></button>)}</div></div>}
          {!researchBusy&&!research&&<section className="v5-soft-empty"><p>No saved OpenAlex research observations. An initial refresh was attempted; check API status or try again later.</p></section>}
          <p className="v5-section-note">Annual publication counts indicate activity in selected research queries, not growth in job vacancies, skill demand or skill replacement.</p>
        </section>
        <section className="v5-job-section"><div className="v5-section-title"><div><p className="v5-eyebrow"><Icon name="database" size={17}/> HIMALAYAS · JOB POSTINGS</p><h2>AI capabilities mentioned at work</h2><p>Observed capability mentions in a bounded remote-job sample—not a measured growth ranking.</p></div><span className="v5-source-pill">{jobs?.sample_size??"—"} postings</span></div>
          {jobsBusy&&<p className="v5-status">Reading job evidence…</p>}{jobsError&&<p role="status" className="v5-error">{jobsError}</p>}
          {jobs&&<div className="v5-job-layout"><div className="v5-bars" role="list" aria-label="AI capabilities ranked by mentions">{jobs.items.map((item,i)=>{const mentions=item.metric.numerator??item.metric.recent?.numerator??0;return <button type="button" role="listitem" key={item.id} onClick={()=>setJobSelected(item.id)} className={jobSelected===item.id?"selected":""}><span className="v5-rank">{String(i+1).padStart(2,"0")}</span><span className="v5-bar-body"><span className="v5-bar-heading"><strong>{item.name}</strong><small>{item.metric.kind==="posting_prevalence"?`${mentions} mentions`:`${item.metric.percentage_points??"—"} pp change`}</small></span><span className="v5-bar-track"><span style={{width:`${Math.max(2,(mentions/maxMention)*100)}%`}}/></span></span><Icon name="arrow" size={17}/></button>;})}</div>
          <aside className="v5-job-detail"><span className="v5-eyebrow">ROLE EVIDENCE</span><h3>{selectedJob?.name??"Choose a capability"}</h3><p>{selectedJob?.definition??"Select any bar to inspect example work from the saved postings."}</p>{selectedJob&&<><div className="v5-example-role"><small>EXAMPLE SOURCE</small><strong>{selectedJob.evidence[0]?.title??"Job posting"}</strong><p>{selectedJob.evidence[0]?.ai_quote??"No excerpt available"}</p>{selectedJob.evidence[0]?.url&&<a href={selectedJob.evidence[0].url} rel="noreferrer" target="_blank">Read original posting ↗</a>}</div></>}</aside></div>}
          <p className="v5-section-note">Himalayas data are sampled advertisements. Counts refer only to the retained postings and do not measure changes in the wider job market.</p>
        </section>
      </div>}
    </div>
    {opened&&<dialog ref={dialog} className="v5-modal" aria-labelledby="v5-modal-title" onClose={()=>setOpened(null)}><div className="v5-modal-content"><header className="v5-modal-header"><p className="v5-eyebrow"><Icon name="spark" size={16}/> AI SKILL EXPLORATION</p><button type="button" className="v5-close" aria-label="Close details" onClick={closeEvidence}><Icon name="close"/></button><h2 id="v5-modal-title">{opened.current_skill_name} <span>→</span> {opened.ai_skill.name}</h2><p>{opened.basis==="same_posting"?"These skills appear in the same job description; their relationship needs interpretation.":"These terms share a passage, but that alone does not prove a transferable skill."}</p></header>
      <div className="v5-modal-body"><section className="v5-review"><div className="v5-review-icon"><Icon name="spark" size={24}/></div><div><span className="v5-eyebrow">WHAT THIS COULD MEAN</span>{pendingReview&&<div className="v5-generating" role="status"><span className="v5-loader"/> Reviewing cited evidence with RunPod…</div>}{currentReview&&<><p className="v5-review-decision">{currentReview.decision==="related_workflow"?"Possible related work":currentReview.decision==="unrelated"?"Not a supported connection":"Insufficient evidence"}</p><p>{currentReview.rationale}</p></>}{errorReview&&<div role="status" className="v5-review-error"><p>{errorReview}</p><button type="button" onClick={()=>{reviewsStarted.current.delete(opened.id);void review(opened,true);}}>Try review again</button></div>}</div></section>
      {currentReview?.decision==="related_workflow"&&<section className="v5-next"><Icon name="book" size={22}/><div><span className="v5-eyebrow">YOUR NEXT STEP</span><h3>{currentReview.next_step||"Explore a relevant project"}</h3>{currentReview.learning_gap&&<p>{currentReview.learning_gap}</p>}</div></section>}
      <details className="v5-sources"><summary><span><Icon name="database" size={20}/> Read original job evidence</span><span>Expand +</span></summary><div className="v5-sources-inner">{opened.evidence.slice(0,3).map(src=><article key={src.id}><a target="_blank" rel="noreferrer" href={src.url}>{src.title} ↗</a><p className="v5-source-company">{src.company} · {src.source}</p><small>EXISTING SKILL MENTION</small><blockquote>{src.source_quote}</blockquote><small>AI-RELATED TASK MENTION</small><blockquote>{src.ai_quote}</blockquote></article>)}</div></details>
      <p className="v5-modal-disclaimer">RunPod provides an automated interpretation of cited descriptions, not verified career advice. Job co-mentions and publication trends cannot prove skill replacement or career outcomes.</p></div></div></dialog>}
  </main>;
}

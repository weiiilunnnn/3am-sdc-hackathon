"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import "./disruption-outlook.css";

type ProfileRequest = {
  occupation: string;
  field_of_study: string;
  skills: { name: string; skill_id: string | null }[];
  work_tasks: string[];
  aspiration: string;
};
type Evidence = {
  id: string;
  title: string;
  company: string;
  url: string;
  skill_passage: string;
  ai_passage: string;
  basis: "same_posting" | "same_task_passage";
  ai_capability: string;
};
type Counts = { sample: number; skill_count: number; ai_count: number; skill_share: number; ai_share: number };
type ChartData = {
  mode: "snapshot" | "historical" | "unavailable";
  label?: string;
  current?: Counts;
  periods?: ({ label: string } & Counts)[];
  caution?: string;
  reason?: string;
};
type ResearchEvidence = {
  status: string;
  message?: string;
  occupation: {code:string;title:string;observed_exposure:number} | null;
  tasks: {id:string;task:string;task_type:string;anthropic_task_penetration:number}[];
  task_matches: number;
  source_version?: string;
  imported_at?: string;
  limitations: string;
  source: {onet:string;anthropic:string};
};
type Occupation = {code:string;name:string;matched_tasks:number};

 type Report = {
  skill: { key: string; name: string };
  research?: ResearchEvidence;
  category: "minimal" | "assisted" | "hybrid" | "full" | "insufficient_evidence" | null;
  category_status?: string;
  source: { name: string; posting_count: number; collected_at: string | null };
  chart: ChartData;
  evidence: Evidence[];
  status?: string;
  rationale?: string;
  happening_now?: string;
  possible_future?: string;
  adaptation?: string;
  alternative_outcomes?: string[];
  evidence_ids?: string[];
  confidence_label?: string;
  method_note?: string;
  validation_issue?: string;
};

const LABELS: Record<Exclude<Report["category"],null>, string> = {
  minimal: "Minimal transformation potential",
  assisted: "Assisted transformation potential",
  hybrid: "Hybrid transformation potential",
  full: "Full transformation potential",
  insufficient_evidence: "Insufficient evidence",
};

const levels = ["minimal", "assisted", "hybrid", "full"] as const;
const SORT_RANK: Record<Exclude<Report["category"],null>, number> = {
  minimal: 1, assisted: 2, hybrid: 3, full: 4, insufficient_evidence: -1,
};
const STATUS_LABELS: Record<string,string> = {
  budget_exhausted: "Local RunPod usage limit reached; this is not your RunPod credit balance.",
  unconfigured: "RunPod isn't configured in the backend environment.",
  disabled: "RunPod assessments are disabled in the backend environment.",
  invalid_budget: "The local RunPod budget configuration is invalid.",
  input_too_large: "This skill has too much evidence to assess in one request.",
  invalid_output: "RunPod returned an answer that did not pass the required format or citation checks. No category was assigned.",
  fallback: "RunPod could not complete an assessment. Other saved evidence is still available.",
};
const SUCCESS = new Set(["generated", "cached", "insufficient_evidence"]);
// Deduplicate requests across Next/React Strict Mode mounts; don't bill twice for a
// single browser action just because a development effect ran more than once.
const inflight = new Map<string, Promise<Report>>();
function fetchOne(profile:ProfileRequest, skill_id:string,occupation_code:string): Promise<Report> {
  const payload = JSON.stringify({profile,skill_id,occupation_code:occupation_code || null});
  const pending = inflight.get(payload);
  if (pending) return pending;
  const job = fetch("/api/trends/disruption-assess", {
    method:"POST",headers:{"Content-Type":"application/json"},
    body:payload,cache:"no-store",
  }).then(async response=>{
    if(!response.ok)throw new Error(`Assessment request failed (HTTP ${response.status}).`);
    return await response.json() as Report;
  });
  inflight.set(payload,job);
  void job.finally(()=>{if(inflight.get(payload)===job)inflight.delete(payload);}).catch(()=>{});
  return job;
}

type ContextMatch = { occupation: Occupation | null; basis: "experience" | "aspiration" | "education" | "skills" | "unmatched" };

// Choose a task-research context from existing profile fields. This is a
// proxy for interpreting occupational TASK data, not a claim that the user
// holds this job. No separate occupation question is needed for common profiles.
function occupationSuggestion(profile:ProfileRequest|null, options:Occupation[]):ContextMatch {
  const none:ContextMatch={occupation:null,basis:"unmatched"};
  if(!profile || !options.length) return none;
  const clean=(value:string)=>value.toLowerCase().replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
  const byName=(name:string):Occupation|null=>{
    const key=clean(name);
    return options.find(o=>clean(o.name)===key) ?? null;
  };
  const choose=(names:string[]):Occupation|null=>{
    for(const name of names){const match=byName(name);if(match)return match;}
    return null;
  };
  const recognized=(raw:string):Occupation|null=>{
    const text=clean(raw);
    if(!text)return null;
    const exact=byName(text) ?? byName(text.replace(/\b(internship|intern|junior|senior|lead|associate|assistant|trainee)\b/g," ").replace(/\s+/g," ").trim());
    if(exact)return exact;
    // Keep terms specific, and test more specialized roles first.
    const terms: { pattern:RegExp; names:string[] }[]=[
      {pattern:/\b(cyber.?security|information security|soc analyst|security analyst)\b/,names:["Information Security Analysts"]},
      {pattern:/\b(network|networking|network support|network technician)\b/,names:["Computer Network Support Specialists"]},
      {pattern:/\b(it support|information technology support|help.?desk|technical support|desktop support|support technician|computer support|system administrator|systems administrator)\b/,names:["Computer User Support Specialists","Computer Network Support Specialists"]},
      {pattern:/\b(data scientist|data science|machine learning engineer|ml engineer)\b/,names:["Data Scientists"]},
      {pattern:/\b(data analyst|data analytics|business intelligence|bi analyst|analytics analyst)\b/,names:["Business Intelligence Analysts","Data Scientists"]},
      {pattern:/\b(software engineer|software developer|full.?stack|front.?end developer|back.?end developer|application developer|web developer)\b/,names:["Software Developers","Web Developers"]},
      {pattern:/\b(computer programmer|python programmer|programming)\b/,names:["Computer Programmers","Software Developers"]},
      {pattern:/\b(ux designer|ui designer|interface designer|product designer)\b/,names:["Web and Digital Interface Designers"]},
      {pattern:/\b(financial analyst|investment analyst|equity analyst)\b/,names:["Financial and Investment Analysts"]},
      {pattern:/\b(marketing analyst|market research|digital marketing|marketing specialist)\b/,names:["Market Research Analysts and Marketing Specialists"]},
      {pattern:/\b(business analyst|operations analyst|management analyst)\b/,names:["Management Analysts","Business Intelligence Analysts"]},
    ];
    for(const t of terms){if(t.pattern.test(text)){const result=choose(t.names);if(result)return result;}}
    return null;
  };
  // An experience title is the strongest available profile signal, followed
  // by a stated career aspiration. Neither is treated as verified employment.
  for(const [raw,basis] of [[profile.occupation,"experience"],[profile.aspiration,"aspiration"]] as const){
    const occupation=recognized(raw || "");
    if(occupation)return {occupation,basis};
  }
  const field=clean(profile.field_of_study||"");
  // Education supplies a *study context* when no occupation was recognized.
  // It is not used to assert the user's actual profession.
  if(/\b(data analysis|data analytics|data science|statistics|statistical|business analytics)\b/.test(field)){
    const occupation=choose(["Data Scientists","Business Intelligence Analysts"]);
    if(occupation)return {occupation,basis:"education"};
  }
  if(/\b(computer science|software engineering|computer engineering|informatics)\b/.test(field)){
    const occupation=choose(["Software Developers","Computer Programmers"]);
    if(occupation)return {occupation,basis:"education"};
  }
  if(/\b(information technology|information systems|networking)\b/.test(field)){
    const occupation=choose(["Computer User Support Specialists","Computer Network Support Specialists"]);
    if(occupation)return {occupation,basis:"education"};
  }
  const names=new Set(profile.skills.map(s=>clean(s.name)));
  const has=(...words:string[])=>words.some(w=>names.has(w));
  if(has("data analysis","data analytics") && has("machine learning","python programming","statistics")){
    const occupation=choose(["Data Scientists","Business Intelligence Analysts"]);
    if(occupation)return {occupation,basis:"skills"};
  }
  if(has("python programming") && has("software development","machine learning","programming")){
    const occupation=choose(["Software Developers","Computer Programmers"]);
    if(occupation)return {occupation,basis:"skills"};
  }
  return none;
}

// Explanations define the four *potential* categories; assignment uses task evidence,
// not a hard-coded skill lookup or job-replacement probability.
const CATEGORY_MEANING: Record<(typeof levels)[number], string> = {
  minimal: "AI has limited applicability to the central tasks of this work context.",
  assisted: "AI mainly supports tasks while people remain responsible for performing and checking the work.",
  hybrid: "AI may handle some routine task components; people remain essential for decisions, integration and quality checks.",
  full: "Many well-defined tasks could potentially be completed by AI under suitable conditions, with human oversight still relevant.",
};

// Scenario illustration: conceptual task emphasis, never a job-demand forecast.
// No percentages, employment projections, dates, or source-data values are invented.
function FutureIllustration({category}:{category:(typeof levels)[number]}) {
  const shape={minimal:{existing:70,ai:79},assisted:{existing:92,ai:57},hybrid:{existing:110,ai:36},full:{existing:123,ai:20}}[category];
  return <div className="ado-v3-future-chart" role="group" aria-label="Conceptual illustration of possible shift toward AI-enabled tasks, not a forecast">
    <svg viewBox="0 0 480 170" role="img" aria-label="Illustrative task emphasis: routine existing work may shift and AI-enabled work may expand; no measured percentages">
      <line x1="32" x2="462" y1="140" y2="140" stroke="#436c5b" strokeWidth="1"/>
      <line x1="32" x2="32" y1="18" y2="140" stroke="#436c5b" strokeWidth="1"/>
      {[46,94].map(y=><line key={y} x1="33" x2="462" y1={y} y2={y} stroke="#2b5543" strokeDasharray="3 7" />)}
      <path d={`M36 44 C170 44 255 ${shape.existing-10} 452 ${shape.existing}`} fill="none" stroke="#8aaeff" strokeWidth="3" strokeDasharray="7 5" strokeLinecap="round" />
      <path d={`M36 120 C160 112 287 ${shape.ai+10} 452 ${shape.ai}`} fill="none" stroke="#6be5ac" strokeWidth="3" strokeDasharray="7 5" strokeLinecap="round" />
      <text x="36" y="159" fill="#a4c5b4" fontSize="11">Present</text>
      <text x="452" y="159" fill="#a4c5b4" fontSize="11" textAnchor="end">Possible future</text>
    </svg>
    <div className="ado-v3-legend"><span><i className="ado-dot blue"/> Routine work emphasis</span><span><i className="ado-dot mint"/> AI-enabled work emphasis</span></div>
    <p className="ado-v3-illustration-note"><strong>Concept only — not measured data or a forecast.</strong> Dashed curves illustrate a possible task-mix change associated with this category, not a decline in employment or demand for {category === "full" ? "any skill" : "the skill"}.</p>
  </div>;
}

const fmt = (n:number) => `${n.toFixed(1)}%`;

function TrendChart({chart,skill}:{chart:ChartData;skill:string}) {
  if(chart.mode==="unavailable") return <div className="ado-graph-empty">{chart.reason ?? "No saved job-posting data yet."}</div>;
  if(chart.mode==="historical" && chart.periods?.length===2) {
    const [a,b]=chart.periods;
    const y=(n:number)=>122-(n/100)*95;
    return <div className="ado-graph" role="group" aria-label="Observed skill and AI mentions across two historical samples">
      <svg viewBox="0 0 540 165" width="100%" role="img" aria-label={`${skill}: ${a.skill_share}% earlier and ${b.skill_share}% recent; AI capabilities: ${a.ai_share}% earlier and ${b.ai_share}% recent`}>
        {[0,25,50,75,100].map(n=><g key={n}><line x1="60" y1={y(n)} x2="502" y2={y(n)} stroke="currentColor" opacity=".1" strokeDasharray="3 5"/><text x="53" y={y(n)+4} fontSize="11" fill="currentColor" textAnchor="end" opacity=".7">{n}%</text></g>)}
        <polyline points={`90,${y(a.skill_share)} 470,${y(b.skill_share)}`} stroke="#7eabf8" fill="none" strokeWidth="3"/>
        <polyline points={`90,${y(a.ai_share)} 470,${y(b.ai_share)}`} stroke="#69dfaa" fill="none" strokeWidth="3"/>
        {[{x:90,d:a},{x:470,d:b}].map(({x,d})=><g key={x}><circle cx={x} cy={y(d.skill_share)} r="5" fill="#7eabf8"/><circle cx={x} cy={y(d.ai_share)} r="5" fill="#69dfaa"/></g>)}
        <text x="90" y="153" textAnchor="middle" fontSize="11" fill="currentColor">Earlier sample</text>
        <text x="470" y="153" textAnchor="middle" fontSize="11" fill="currentColor">Recent sample</text>
      </svg>
      <p className="ado-graph-helper">Each period contains {a.sample} and {b.sample} retained postings, respectively.</p>
    </div>;
  }
  const sample=chart.current;
  if(!sample || sample.sample===0)return <div className="ado-graph-empty">No eligible saved job postings.</div>;
  const bars=[{label:skill,value:sample.skill_share,count:sample.skill_count,color:"blue"},{label:"AI capability mentions",value:sample.ai_share,count:sample.ai_count,color:"mint"}];
  return <div className="ado-snapshot" aria-label="Current posting mention shares, not a historical trend">
    {bars.map(b=><div className="ado-bar" key={b.color}>
      <div className="ado-bar-label"><span>{b.label}</span><strong>{fmt(b.value)}</strong></div>
      <div className="ado-bar-track"><div className={`ado-bar-fill ${b.color}`} style={{width:`${b.value}%`}}/></div>
      <small>{b.count} of {sample.sample} retained postings</small>
    </div>)}
  </div>;
}

export default function DisruptionOutlook({profile}:{profile:ProfileRequest|null}) {
  const fingerprint=JSON.stringify(profile);
  const skills=useMemo(()=>{
    const known = new Map<string,{key:string;name:string}>();
    for (const skill of profile?.skills ?? []) {
      const name = skill.name.trim();
      if (!name) continue;
      const key = skill.skill_id ?? `custom:${name.toLowerCase()}`;
      if (!known.has(key)) known.set(key,{key,name});
    }
    return [...known.values()];
  },[fingerprint]);
  const [selected,setSelected]=useState("");
  const [reports,setReports]=useState<Record<string,Report>>({});
  const [errors,setErrors]=useState<Record<string,string>>({});
  const [progress,setProgress]=useState(0);
  const [running,setRunning]=useState(false);
  const [stoppedMessage,setStoppedMessage]=useState("");
  const [sort,setSort]=useState<"descending"|"ascending">("descending");
  const [occupations,setOccupations]=useState<Occupation[]>([]);
  const [occupationCode,setOccupationCode]=useState("");
  const [contextBasis,setContextBasis]=useState<ContextMatch["basis"]>("unmatched");
  const [retrying,setRetrying]=useState(false);
  const [sourcesReady,setSourcesReady]=useState<boolean|null>(null);
  useEffect(()=>{
    let active=true;
    void fetch("/api/trends/disruption-occupations",{cache:"no-store"})
      .then(r=>{if(!r.ok)throw Error("Occupation reference API unavailable");return r.json();})
      .then((data:{source_status:{ready:boolean};occupations:Occupation[]})=>{
        if(!active)return;
        setSourcesReady(Boolean(data.source_status?.ready));
        setOccupations(data.occupations||[]);
        const suggestion=occupationSuggestion(profile,data.occupations||[]);
        setOccupationCode(suggestion.occupation?.code??"");
        setContextBasis(suggestion.basis);
      }).catch(()=>{if(active)setSourcesReady(false);});
    return()=>{active=false;};
  },[fingerprint]);
  const active=skills.some(s=>s.key===selected)?selected:(skills[0]?.key??"");
  const report=reports[active];
  const category=report?.category;
  const showAssessment=Boolean(category && report?.rationale);
  const chart=report?.chart;

  // Assess each profile skill automatically, sequentially (never one concurrent
  // LLM request per row). Stop on budget/auth problems; never auto-retry failures.
  useEffect(()=>{
    let cancelled=false;
    setReports({});setErrors({});setProgress(0);setStoppedMessage("");
    // A missing O*NET match must never blank the entire feature. The API can
    // still return real job-posting observations with an honest evidence status.
    if(!profile || !skills.length || sourcesReady===null){
      setRunning(false);return()=>{cancelled=true;};
    }
    setRunning(true);
    const MAX_AUTOMATIC_SKILLS = 12; // Prevent unexpectedly charging for a 40-skill profile.
    async function loadAll(){
      for(const [i,skill] of skills.entries()){
        if(cancelled)break;
        if(i>=MAX_AUTOMATIC_SKILLS){
          if(!cancelled)setStoppedMessage(`Automatic analysis is limited to ${MAX_AUTOMATIC_SKILLS} skills per view for cost control. Other skills remain unassessed.`);
          break;
        }
        try{
          const result=await fetchOne(profile!,skill.key,occupationCode);
          if(cancelled)break;
          setReports(prev=>({...prev,[skill.key]:result}));
          if(result.status && !SUCCESS.has(result.status)){
            const message=STATUS_LABELS[result.status] ?? `Assessment unavailable: ${result.status}`;
            setErrors(prev=>({...prev,[skill.key]:message}));
            if(["budget_exhausted","disabled","unconfigured","invalid_budget"].includes(result.status)){
              setStoppedMessage(message+" Automatic assessments have stopped to avoid repeated requests.");
              setProgress(i+1);
              break;
            }
          }
        }catch(e){
          if(cancelled)break;
          setErrors(prev=>({...prev,[skill.key]:e instanceof Error?e.message:"Assessment unavailable."}));
          setStoppedMessage("Couldn't connect to the assessment API. Automatic analysis has stopped; try refreshing after fixing the server.");
          setProgress(i+1);
          break;
        }
        if(!cancelled)setProgress(i+1);
      }
      if(!cancelled)setRunning(false);
    }
    void loadAll();
    return()=>{cancelled=true;};
  },[fingerprint,occupationCode,sourcesReady]);

  const ordered=useMemo(()=>[...skills].sort((a,b)=>{
    const aCategory=reports[a.key]?.category;
    const bCategory=reports[b.key]?.category;
    const ar=aCategory ? SORT_RANK[aCategory] : -2;
    const br=bCategory ? SORT_RANK[bCategory] : -2;
    // Insufficient evidence and unfinished cases must not be framed as low risk.
    const aUnknown=ar<0, bUnknown=br<0;
    if(aUnknown!==bUnknown)return aUnknown?1:-1;
    if(aUnknown&&bUnknown)return a.name.localeCompare(b.name);
    return sort==="ascending" ? ar-br || a.name.localeCompare(b.name) : br-ar || a.name.localeCompare(b.name);
  }),[skills,reports,sort]);

  const selectedName = skills.find(s=>s.key===active)?.name ?? "Your skill";
  const validCategory = category && category!=="insufficient_evidence" ? category : null;
  const categoryMeaning = validCategory ? CATEGORY_MEANING[validCategory] : null;
  const canAssess = Boolean(profile && sourcesReady!==null);
  const selectedError = errors[active];
  const retry = () => {
    if(!profile)return;
    setRetrying(true);
    void fetchOne(profile,active,occupationCode).then(result=>{
      setReports(prev=>({...prev,[active]:result}));
      setErrors(prev=>{
        const copy={...prev};
        if(result.status && !SUCCESS.has(result.status))copy[active]=STATUS_LABELS[result.status]??"Assessment unavailable";
        else delete copy[active];
        return copy;
      });
    }).catch(()=>setErrors(prev=>({...prev,[active]:"Unable to contact assessment API."}))).finally(()=>setRetrying(false));
  };

  return <div className="ado-root ado-v3">
    <header className="ado-v3-intro">
      <div><p className="v5-eyebrow">AI DISRUPTION OUTLOOK</p><h2>Your skills. Your future.</h2>
        <p>Explore how AI could reshape your work—and which capabilities could help you adapt.</p></div>
      <span className="ado-method">Potential, not job-loss risk</span>
    </header>
    {!profile || !skills.length ? <section className="ado-empty"><h3>Add skills in My Profile</h3><p>This assessment uses skills already in your profile.</p><Link href="/profile">Open My Profile ↗</Link></section> : <>
      <div className="ado-v3-layout">
        <aside className="ado-v3-sidebar" aria-label="Your skills">
          <div className="ado-v3-sidebar-head"><p className="v5-eyebrow">YOUR SKILLS</p><h3>Skills at a glance</h3>
            <p>Choose one to explore its future outlook.</p></div>
          <label className="ado-v3-sort">Sort skills<select value={sort} onChange={(e:{target:{value:string}})=>setSort(e.target.value as "ascending"|"descending")}>
            <option value="descending">Highest potential first</option><option value="ascending">Lowest potential first</option>
          </select></label>
          {running && <p className="ado-progress" role="status"><span className="ado-progress-spinner"/> Assessing {progress} / {Math.min(skills.length,12)}</p>}
          <nav className="ado-v3-skill-list" aria-label="Select a skill">
            {ordered.map(skill=>{
              const item=reports[skill.key];
              const label=item?.category && item.category!=="insufficient_evidence" ? item.category : item?.category === "insufficient_evidence" ? "Not enough evidence" : errors[skill.key] ? "Unavailable" : running ? "Assessing…" : "Not assessed";
              return <button key={skill.key} type="button" className={`ado-v3-skill-item ${active===skill.key?"selected":""}`} aria-pressed={active===skill.key} onClick={()=>setSelected(skill.key)}>
                <span className="ado-v3-skill-name">{skill.name}</span>
                <span className={`ado-v3-skill-status ${item?.category??"pending"}`}>{label}</span>
              </button>;
            })}
          </nav>
          {stoppedMessage&&<p className="ado-v3-warning" role="status">{stoppedMessage}</p>}
          <div className="ado-v3-context">
            <p className="v5-eyebrow">PROFILE CONTEXT</p>
            <strong>{occupations.find(o=>o.code===occupationCode)?.name || "Using available skill evidence"}</strong>
            <p>{occupationCode
              ? contextBasis==="experience" ? "Task-research context from your profile's work-experience title—not a verified current occupation."
              : contextBasis==="aspiration" ? "Task-research context from your career aspiration—not a verified current occupation."
              : contextBasis==="education" ? "Provisional task-research context inferred from your field of study; this isn't your claimed job."
              : "Provisional task-research context inferred from your skill set; this isn't your claimed job."
              : "No reliable occupation mapping was available. You can still explore job mentions and saved evidence; unsupported transformation categories are withheld."}</p>
            {sourcesReady===false&&<p className="ado-v3-warning">O*NET / Anthropic data are not available in this local database.</p>}
          </div>
        </aside>
        <main className="ado-v3-main" aria-label="Selected skill future outlook">
          <div className="ado-v3-selection"><div><p className="v5-eyebrow">YOUR SELECTED SKILL</p><h3>{selectedName}</h3></div><Link href="/profile/edit">Edit your skills ↗</Link></div>
          {selectedError&&<div className="ado-error" role="status">{selectedError}
            {report?.validation_issue&&<span> Reason: {{citations_invalid:"Citation mismatch",category_invalid:"Invalid category",uncertainties_invalid:"Uncertainty statements invalid",overclaim:"Unsupported certainty",explanation_invalid:"Invalid explanation"}[report.validation_issue]??"Malformed response"}.</span>}
            {report?.status==="invalid_output"&&!running&&<button type="button" disabled={retrying} onClick={retry}>{retrying?"Retrying…":"Retry assessment ↻"}</button>}
          </div>}
          {!report ? <section className="ado-v3-pending" role="status"><p className="v5-eyebrow">TRANSFORMATION POTENTIAL</p><h3>{canAssess && running?"Assessing this skill…":"Assessment not completed"}</h3>
            <p>{running?"Checking your saved sources and profile context…":sourcesReady===false?"Your research data is unavailable; job-posting evidence can still be inspected when the API responds.":"This assessment was not completed, but your profile does not need to be re-entered."}</p></section> : <>
            <section className="ado-v3-level" aria-label="AI disruption potential">
              <div className="ado-v3-level-head"><div><p className="v5-eyebrow">AI TRANSFORMATION POTENTIAL</p>
                <h3>{category ? LABELS[category] : "Not assessed"}</h3></div>
                {validCategory&&<span className="ado-v3-level-rank">Level {SORT_RANK[validCategory]} of 4</span>}
              </div>
              <p className="ado-v3-category-explainer">{categoryMeaning ?? (category==="insufficient_evidence"?"There is not enough applicable task evidence to assign a level. This does not mean minimal disruption.":"A level cannot be displayed until the assessment completes successfully.")}</p>
              <div className="ado-v3-meter" role="img" aria-label={validCategory?`Qualitative level ${SORT_RANK[validCategory]} of four, ${LABELS[validCategory]}; not a statistical probability`:"No qualitative transformation level assigned"}>
                {levels.map((level,index)=><span key={level} className={validCategory && index <= SORT_RANK[validCategory]-1?"filled":""} aria-hidden="true" />)}
              </div>
              <div className="ado-v3-meter-labels"><span>Minimal</span><span>Assisted</span><span>Hybrid</span><span>Full</span></div>
              {showAssessment&&<p className="ado-v3-rationale"><b>Why this category?</b> {report.rationale}</p>}
              <small>Qualitative task-transformation potential · Not a measured likelihood of replacement</small>
            </section>
            <section className="ado-v3-scenario" aria-label="Your future scenario">
              <div className="ado-v3-scenario-title"><span className="v5-eyebrow">YOUR FUTURE SCENARIO</span>
                <h3>{validCategory?`${validCategory.charAt(0).toUpperCase()+validCategory.slice(1)} transformation: what could change?`:"A future scenario cannot yet be assessed"}</h3>
                <p>One evidence-informed possible outlook—not a guaranteed prediction.</p>
              </div>
              {validCategory && showAssessment ? <>
                <div className="ado-v3-scenario-body">
                  <div className="ado-v3-scenario-narrative">
                    <article><span className="ado-v3-step-index">01</span><div><h4>What's happening now?</h4><p>{report.happening_now || "No verified current-use summary was provided."}</p></div></article>
                    <article><span className="ado-v3-step-index">02</span><div><h4>What might happen next?</h4><p>{report.possible_future || "A future implication was not supported by the assessment."}</p></div></article>
                  </div>
                  <div className="ado-v3-chart-panel"><div className="ado-v3-chart-top"><strong>Possible shift in task emphasis</strong><span>Illustration</span></div>
                    <FutureIllustration category={validCategory}/></div>
                </div>
                <div className="ado-v3-next"><div><span className="v5-eyebrow">YOUR NEXT STEP</span><h4>How to stay relevant</h4></div><p>{report.adaptation || "Review the tasks and learning opportunities most relevant to your work."}</p></div>
              </> : <p className="ado-v3-not-ready">{category==="insufficient_evidence"?(report.rationale??"We couldn't find enough reliable task evidence for this context."):"The model did not return a validated scenario. Evidence is still available below."} We won't invent a future prediction.</p>}
            </section>
            <section className="ado-v3-observed" aria-label="Observed job-posting data"><div className="ado-section-head"><div><span className="v5-eyebrow">OBSERVED JOB-MARKET SIGNAL</span>
              <h3>{chart?.mode==="historical"?"Recorded skill-mention trends":"Current job-posting mentions"}</h3></div><span className="ado-sample-size">{report.source.posting_count} postings</span></div>
              {chart&&<TrendChart chart={chart} skill={report.skill.name}/>}
              <div className="ado-key"><span><i className="ado-dot blue"/> Your skill</span><span><i className="ado-dot mint"/> AI capabilities</span></div>
              <p className="ado-caption">{chart?.caution??chart?.reason} Source: {report.source.name}. {chart?.mode==="snapshot"?"One sample only: these bars are NOT a historical trend or a prediction.":""}</p>
            </section>
            <details className="ado-details"><summary>Evidence, limitations and alternative outcomes <span>Expand +</span></summary><div className="ado-details-content">
              <p className="ado-caption">{report.method_note}</p>
              {report.alternative_outcomes?.length===2&&<div className="ado-alternatives"><strong>Other plausible outcomes (uncertainty)</strong>{report.alternative_outcomes.map((a,i)=><p key={i}>{i+1}. {a}</p>)}</div>}
              {report.research && <section className="ado-research"><h4>Occupation tasks and observed AI use</h4>
                <p>Context: {report.research.occupation?.title??"Not matched"}. O*NET {report.research.source_version??"reference"}. Task penetration is NOT a replacement probability.</p>
                {report.research.tasks.slice(0,6).map(t=><article className="ado-evidence" key={t.id}><strong>{t.task}</strong><span>Anthropic observed task-penetration index: {t.anthropic_task_penetration.toFixed(3)}</span></article>)}
                <p className="ado-caption">{report.research.limitations} <a href={report.research.source.onet} target="_blank" rel="noreferrer">O*NET ↗</a> · <a href={report.research.source.anthropic} target="_blank" rel="noreferrer">Anthropic Economic Index ↗</a></p>
                <p className="ado-caption">Attribution: O*NET {report.research.source_version??"31.0"} Database © US Department of Labor/ETA, CC BY 4.0; task selection modified by Pathwaay (no USDOL/ETA endorsement). Anthropic Economic Index data, CC BY.</p>
              </section>}
              <h4>Original job-advertisement evidence</h4>
              {report.evidence.length?report.evidence.map(e=><article className="ado-evidence" key={e.id}><strong>{e.title} · {e.company}</strong><span>{e.basis==="same_task_passage"?"Same task passage":"Same posting only · not a verified skill transition"}</span><p><b>Existing skill:</b> {e.skill_passage}</p><p><b>AI work:</b> {e.ai_passage}</p><a href={e.url} target="_blank" rel="noreferrer">Read source ↗</a></article>):<p>No matching cited job passages are saved for this skill.</p>}
            </div></details>
          </>}
        </main>
      </div>
    </>}
    <p className="ado-footer">The category is a provisional assessment of task transformation, not the probability of losing a job. Illustrative future curves are not measured demand trends. O*NET, Anthropic and sampled job postings have different geographic and methodological limitations.</p>
  </div>;
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageIntro, ProfileGate } from "../WorkspaceStates";
import { useRegistrationProfile, useSavedProfile } from "../profile-workspace";
import type { StoredProfile } from "@/lib/api";
import type { PathwaayRegistrationProfile } from "@/lib/pathwaay-profile";
import { EMPTY_CV_DETAILS, filledCvEntry, normalizeCvDetails, safeCvUrl, type CvEntry } from "@/lib/cv-profile";
import "./cv-v2.css";

type Template = "classic" | "modern" | "graduate";
type SectionId = "summary" | "education" | "experience" | "projects" | "skills" | "certifications" | "awards" | "volunteering" | "languages" | "publications";
type ResumeRecord = CvEntry;
type Section = { id: SectionId; title: string; text?: string; tags?: string[]; records?: ResumeRecord[] };
type Prefs = { template: Template; hidden: SectionId[]; excluded: string[]; order: SectionId[]; summaryOverride: string | null; descriptions: Record<string,string> };
const SECTION_TITLES: Record<SectionId,string> = {
  summary: "Professional summary", education: "Education", experience: "Experience", projects: "Projects", skills: "Skills",
  certifications: "Certifications", awards: "Awards & achievements", volunteering: "Volunteering", languages: "Languages", publications: "Publications",
};
const DEFAULT_ORDER: SectionId[] = ["summary","experience","education","projects","skills","certifications","awards","volunteering","languages","publications"];
const GRADUATE_ORDER: SectionId[] = ["summary","education","skills","projects","experience","certifications","awards","volunteering","languages","publications"];
const templates: {id:Template;name:string;description:string}[] = [
  {id:"classic",name:"Professional Classic",description:"Traditional · ATS-conscious"},
  {id:"modern",name:"Modern Minimal",description:"Clean · subtle accent"},
  {id:"graduate",name:"Graduate & Technical",description:"Education · projects first"},
];
const defaultPrefs = ():Prefs => ({template:"classic",hidden:[],excluded:[],order:[...DEFAULT_ORDER],summaryOverride:null,descriptions:{}});
const record = (id:string,title:string,organization:string,period:string,description:string,url=""): ResumeRecord => ({id,title,organization,period,description,url});
const text = (v:string|undefined|null) => (v??"").trim();
function recordsPresent(records: ResumeRecord[]):ResumeRecord[] {return records.filter(filledCvEntry);}

function buildSections(p:PathwaayRegistrationProfile, settings:Prefs):Section[] {
  const extra=normalizeCvDetails(p.cvDetails);
  const mainEducation=record("education:primary",[text(p.educationLevel),text(p.major)].filter(Boolean).join(" · "),text(p.university),text(extra.graduationDate),[
    text(p.cgpa)?`CGPA: ${text(p.cgpa)}`:"",text(p.educationRecord)
  ].filter(Boolean).join("\n"));
  const summary=settings.summaryOverride===null?text(p.profileSummary):text(settings.summaryOverride);
  const legacy = (id:string,content:string):ResumeRecord[] => text(content)?[record(`${id}:legacy`,"","","",content)]:[];
  const dedupe = (values:string[]) => [...new Set(values.map((s)=>s.trim()).filter(Boolean))];
  const groups:Section[]=[
    {id:"summary",title:SECTION_TITLES.summary,text:summary},
    {id:"education",title:SECTION_TITLES.education,records:recordsPresent([
      ...(mainEducation.title||mainEducation.organization?[mainEducation]:[]),...extra.additionalEducation
    ])},
    {id:"experience",title:SECTION_TITLES.experience,records:recordsPresent(p.experiences.map((item)=>record(`experience:${item.id}`,item.title,item.company,item.timeframe,item.description)))},
    {id:"projects",title:SECTION_TITLES.projects,records:recordsPresent([...extra.projects,...legacy("projects",p.projects)])},
    {id:"skills",title:SECTION_TITLES.skills,tags:dedupe(p.skills)},
    {id:"certifications",title:SECTION_TITLES.certifications,records:recordsPresent([...extra.certifications,...legacy("certifications",p.certifications)])},
    {id:"awards",title:SECTION_TITLES.awards,records:recordsPresent([...extra.awards,...legacy("awards",p.schoolAwards),...legacy("achievements",p.achievements)])},
    {id:"volunteering",title:SECTION_TITLES.volunteering,records:recordsPresent([...extra.volunteering,...legacy("volunteering",p.volunteering)])},
    {id:"languages",title:SECTION_TITLES.languages,tags:dedupe(extra.languages.split(/[,;\n]+/))},
    {id:"publications",title:SECTION_TITLES.publications,records:recordsPresent(extra.publications)},
  ];
  return groups;
}
function hasContent(section: Section) {return Boolean(section.text?.trim() || section.tags?.length || section.records?.length);}
function settingsFrom(value:unknown):Prefs {
  const base=defaultPrefs();
  if (!value || typeof value!=="object" || Array.isArray(value))return base;
  const row=value as Record<string,unknown>;
  const validIds=new Set(DEFAULT_ORDER);
  const ids=(v:unknown):SectionId[]=>Array.isArray(v)?[...new Set(v.filter((id):id is SectionId=>typeof id==="string"&&validIds.has(id as SectionId)))]:[];
  const order=ids(row.order);
  const descriptions:Record<string,string>={};
  if (row.descriptions&&typeof row.descriptions==="object"&&!Array.isArray(row.descriptions)) {
    for (const [key,v] of Object.entries(row.descriptions)) if(typeof v==="string"&&key.length<=150)descriptions[key]=v.slice(0,12000);
  }
  return {template:row.template==="modern"||row.template==="graduate"?row.template:"classic",
    hidden:ids(row.hidden),excluded:Array.isArray(row.excluded)?row.excluded.filter((v):v is string=>typeof v==="string").slice(0,300):[],
    order:[...order,...DEFAULT_ORDER.filter((id)=>!order.includes(id))],summaryOverride:typeof row.summaryOverride==="string"?row.summaryOverride.slice(0,5000):null,descriptions};
}

/** Preserve the backend's older fictional-profile fallback without inventing contact details. */
function fromSaved(p:StoredProfile):PathwaayRegistrationProfile {
  return {
    firstName:"",lastName:"",email:"",educationLevel:p.education_level?.replaceAll("_"," ")??"",university:"",
    major:p.field_of_study??"",cgpa:"",schoolAwards:"",educationRecord:"",
    experiences:p.experience.map((entry)=>({id:entry.id,title:entry.title,company:entry.organization??"",timeframe:entry.period??"",description:entry.description})),
    skills:p.skills.map((skill)=>skill.display_name),projects:"",certifications:"",achievements:"",volunteering:"",
    interests:"",workActivities:"",strengths:"",skillsToDevelop:"",aspiration:p.career_aspirations??"",
    profileSummary:p.professional_summary??"",weeklyHours:"",learningBudget:"",learningMode:"",
    cvDetails:{...EMPTY_CV_DETAILS,
      additionalEducation:p.education.map((entry)=>record(entry.id,entry.title,entry.organization??"",entry.period??"",entry.description)),
      projects:p.projects.map((entry)=>record(entry.id,entry.title,entry.organization??"",entry.period??"",entry.description)),
      certifications:p.certifications.map((entry)=>record(entry.id,entry.title,entry.organization??"",entry.period??"",entry.description)),
      awards:p.achievements.map((entry)=>record(entry.id,entry.title,entry.organization??"",entry.period??"",entry.description))},
  };
}

function ResumeDescription({value}:{value:string}) {
  const lines=value.split(/\n+/).map((line)=>line.trim().replace(/^[-•]\s*/,"")).filter(Boolean);
  if (!lines.length)return null;
  return lines.length===1?<p className="cv2-record-description">{lines[0]}</p>:<ul className="cv2-bullets">{lines.map((line,i)=><li key={i}>{line}</li>)}</ul>;
}
function ResumePage({profile,settings,sections}:{profile:PathwaayRegistrationProfile;settings:Prefs;sections:Section[]}) {
  const extra=normalizeCvDetails(profile.cvDetails);
  const fullName=[text(profile.firstName),text(profile.lastName)].filter(Boolean).join(" ") || "Professional Profile";
  const contacts=[
    {label:text(profile.email),href:profile.email?`mailto:${profile.email}`:null},
    {label:extra.phone,href:null},{label:extra.location,href:null},
    ...(["linkedin","github","portfolio"] as const).map((key)=>{
      const href=safeCvUrl(extra[key]);
      const hostname=href?new URL(href).hostname.replace(/^www\./, ""):"";
      const pathname=href?new URL(href).pathname.replace(/\/$/, ""):"";
      return {label:href?`${hostname}${pathname}`:"",href};
    }),
  ].filter((item)=>item.label);
  const order=(settings.template==="graduate"&&settings.order.join("|")===DEFAULT_ORDER.join("|")?GRADUATE_ORDER:settings.order);
  const ordered=order.map((key)=>sections.find((section)=>section.id===key)).filter((section):section is Section=>Boolean(section&&hasContent(section)&&!settings.hidden.includes(section.id)&&(!section.records||section.records.some((entry)=>!settings.excluded.includes(entry.id)))));
  return <article className={`cv2-paper cv2-template-${settings.template}`} aria-label="CV document preview">
    <header className="cv2-paper-header"><h2>{fullName}</h2>
      {profile.major?.trim()&&<p className="cv2-paper-role">{profile.major}</p>}
      {contacts.length>0&&<div className="cv2-contacts">{contacts.map((item,i)=><span key={`${item.label}-${i}`}>{item.href?<a href={item.href}>{item.label}</a>:item.label}</span>)}</div>}
    </header>
    {ordered.map((section)=><section className="cv2-section" key={section.id} aria-label={section.title}>
      <h3>{section.title}</h3>
      {section.text&&<p className="cv2-summary">{section.text}</p>}
      {section.tags&&<p className="cv2-skills">{section.tags.join("  ·  ")}</p>}
      {section.records?.filter((entry)=>!settings.excluded.includes(entry.id)).map((entry)=><div className="cv2-record" key={entry.id}>
        {(entry.title||entry.organization||entry.period)&&<div className="cv2-record-top"><div>
          {entry.title&&<strong>{entry.title}</strong>}
          {entry.organization&&<p>{entry.organization}</p>}
        </div>{entry.period&&<span>{entry.period}</span>}</div>}
        <ResumeDescription value={settings.descriptions[entry.id]??entry.description}/>
        {safeCvUrl(entry.url)&&<a className="cv2-record-url" href={safeCvUrl(entry.url)!}>{entry.url}</a>}
      </div>)}
    </section>)}
    {ordered.length===0&&<p className="cv2-placeholder">Your CV is empty. Add some information in My Profile or re-enable a hidden section.</p>}
  </article>;
}

function CvEditor({profile}:{profile:PathwaayRegistrationProfile}) {
  const key=`pathwaay.cv.v2:${profile.firstName}:${profile.lastName}:${profile.major}`;
  const [settings,setSettings]=useState<Prefs>(defaultPrefs);
  const [ready,setReady]=useState(false);
  const [editing,setEditing]=useState<string|null>(null);
  const [showAll,setShowAll]=useState(false);
  useEffect(()=>{
    setReady(false);
    try {const raw=sessionStorage.getItem(key);setSettings(raw?settingsFrom(JSON.parse(raw)):defaultPrefs());}
    catch {setSettings(defaultPrefs());}
    setReady(true);
  },[key]);
  useEffect(()=>{if(ready)try{sessionStorage.setItem(key,JSON.stringify(settings));}catch{/* Private browsing or storage full. */}},[settings,ready,key]);
  const allSections=useMemo(()=>buildSections(profile,settings),[profile,settings]);
  const visible=allSections.filter(hasContent);
  const ordered=(settings.template==="graduate"&&settings.order.join("|")===DEFAULT_ORDER.join("|")?GRADUATE_ORDER:settings.order);
  const edit=(value:Partial<Prefs>)=>setSettings((p)=>({...p,...value}));
  const move=(id:SectionId,direction:number)=>{
    const order=[...ordered],i=order.indexOf(id),next=i+direction;
    if(i<0||next<0||next>=order.length)return;
    [order[i],order[next]]=[order[next],order[i]];edit({order});
  };
  const available=allSections.filter((s)=>hasContent(s));
  const missing=allSections.filter((s)=>!hasContent(s));
  const issues=[!profile.email?"Add an email address":"",!profile.firstName&&!profile.lastName?"Add your name":"",!visible.some((s)=>s.id==="experience")&&!visible.some((s)=>s.id==="projects")?"Add an experience or project to strengthen the CV":""].filter(Boolean);
  return <div className="cv2-studio">
    <div className="cv2-toolbar no-print"><div><span className="cv2-eyebrow">LIVE PROFILE CONNECTION</span><h2>Build your CV</h2><p>Profile updates flow into this preview. CV-specific choices remain separate.</p></div>
      <button type="button" className="button" onClick={()=>window.print()}>Print / Save as PDF ↗</button></div>
    <div className="cv2-workspace">
      <aside className="cv2-sidebar no-print" aria-label="CV settings">
        <div className="cv2-panel"><h3>01 / Choose your layout</h3><div className="cv2-templates">
          {templates.map((template)=><button type="button" key={template.id} className={`cv2-template-option ${settings.template===template.id?"active":""}`} aria-pressed={settings.template===template.id} onClick={()=>edit({template:template.id})}>
            <span className={`cv2-template-symbol cv2-symbol-${template.id}`} aria-hidden="true"><i/><i/><i/></span><span><strong>{template.name}</strong><small>{template.description}</small></span>
          </button>)}
        </div></div>
        <div className="cv2-panel"><div className="cv2-panel-top"><h3>02 / Sections</h3><Link href="/profile/edit#cv-profile-details">Edit profile ↗</Link></div>
          <p className="cv2-subtle">Empty sections stay out of the exported CV. Use the arrows to adjust the order.</p>
          {[...available].sort((a,b)=>ordered.indexOf(a.id)-ordered.indexOf(b.id)).map((section)=><div className="cv2-section-control" key={section.id}>
            <label><input type="checkbox" checked={!settings.hidden.includes(section.id)} onChange={(e)=>edit({hidden:e.target.checked?settings.hidden.filter((x)=>x!==section.id):[...settings.hidden,section.id]})}/><span>{section.title}</span></label>
            <div><button type="button" aria-label={`Move ${section.title} up`} onClick={()=>move(section.id,-1)}>↑</button><button type="button" aria-label={`Move ${section.title} down`} onClick={()=>move(section.id,1)}>↓</button></div>
          </div>)}
          {missing.length>0&&<button className="cv2-show-missing" type="button" aria-expanded={showAll} onClick={()=>setShowAll(!showAll)}>{showAll?"Hide":"View"} {missing.length} empty sections ↓</button>}
          {showAll&&missing.map((section)=><div className="cv2-missing" key={section.id}>{section.title}<Link href="/profile/edit#cv-profile-details">Add to profile ↗</Link></div>)}
        </div>
        <div className="cv2-panel"><h3>03 / Edit CV wording</h3><p className="cv2-subtle">These edits change only this CV, not your profile.</p>
          <label className="cv2-edit-label">Professional summary
            <textarea rows={4} value={settings.summaryOverride===null?profile.profileSummary:settings.summaryOverride} onChange={(e)=>edit({summaryOverride:e.target.value})}/>
          </label>
          {settings.summaryOverride!==null&&<button type="button" className="cv2-inline-button" onClick={()=>edit({summaryOverride:null})}>Use profile summary</button>}
          {allSections.filter((section)=>section.records?.length).map((section)=><details className="cv2-record-options" key={section.id}><summary>{section.title} · select entries</summary>
            {section.records?.map((entry)=><div className="cv2-record-control" key={entry.id}>
              <label><input type="checkbox" checked={!settings.excluded.includes(entry.id)} onChange={(e)=>edit({excluded:e.target.checked?settings.excluded.filter((id)=>id!==entry.id):[...settings.excluded,entry.id]})}/><span>{entry.title||entry.organization||entry.description.slice(0,55)||"Untitled entry"}</span></label>
              <button type="button" className="cv2-inline-button" onClick={()=>setEditing(editing===entry.id?null:entry.id)}>{editing===entry.id?"Close":"Edit CV text"}</button>
              {editing===entry.id&&<div className="cv2-edit-record"><textarea rows={4} aria-label={`Edit ${entry.title||"entry"} for this CV`} value={settings.descriptions[entry.id]??entry.description} onChange={(e)=>edit({descriptions:{...settings.descriptions,[entry.id]:e.target.value}})}/>
                <button type="button" className="cv2-inline-button" onClick={()=>{const descriptions={...settings.descriptions};delete descriptions[entry.id];edit({descriptions});}}>Restore profile wording</button>
              </div>}
            </div>)}
          </details>)}
        </div>
        {issues.length>0&&<div className="cv2-panel cv2-quality"><h3>CV checklist</h3>{issues.map((issue)=><p key={issue}>○ {issue}</p>)}<Link href="/profile/edit">Complete your profile ↗</Link></div>}
        <p className="cv2-sidebar-note">Saved in this browser session. Your registration and AI Trend Signal are unchanged.</p>
      </aside>
      <div className="cv2-preview"><div className="cv2-preview-label no-print"><span>LIVE PREVIEW · A4</span><span>{visible.length} filled sections · {visible.filter((s)=>!settings.hidden.includes(s.id)).length} enabled</span></div>
        <ResumePage profile={profile} settings={settings} sections={allSections}/>
        <div className="cv2-print-tip no-print">Use Print / Save as PDF. For the cleanest result, choose A4 and turn off browser headers and footers.</div>
      </div>
    </div>
  </div>;
}

export default function CVStudioPage() {
  const saved=useSavedProfile();
  const registration=useRegistrationProfile();
  const profile=registration.profile??(saved.profile?fromSaved(saved.profile):null);
  const loading=registration.loading || (!registration.profile&&saved.loading);
  return <main className="page-wrap cv-studio-page cv2-page">
    <div className="no-print"><PageIntro kicker="CV STUDIO · YOUR PROFILE, BEAUTIFULLY PRESENTED" title={<>One profile.<br/>A CV that stays current.</>} description="Choose a professional template, hide or reorder sections, and adjust wording without changing your underlying profile." index="DOCUMENT STUDIO / 05"/></div>
    {loading?<ProfileGate loading error="" onRetry={()=>{}}/>:profile?<CvEditor profile={profile}/>:<ProfileGate loading={false} error={saved.error||"Create a profile to start your CV."} onRetry={()=>void saved.reload()}/>}
  </main>;
}

"use client";
import { useEffect, useRef, useState } from "react";
import { emptyTiming, timeline, insertChapters, removeChapter, type Draft, type Milestone, type Role, type Timing } from "@/lib/career-simulator";
import { RoleEvidence } from "./CareerLandscape";
import ChapterInsights from "./ChapterInsights";
import SkillPicker from "./SkillPicker";
import ChapterStepper, { chapterType, selectedWaypoint } from "./ChapterStepper";
import SimulatorIcon, { type SimulatorIconKind } from "./SimulatorIcon";

import { displayOccupationTitle, displayTimelineSkill } from "@/lib/career-display";

const categories=["Study again","Family planning","Relocation","Care for family","Hobbies","Start a side business","Return to work","Build emergency savings","Custom goal"];
const categoryIcons:SimulatorIconKind[]=["study","family","relocation","family","hobbies","business","return","savings","goal"];
type Item=ReturnType<typeof timeline>[number];
export default function LifeChapterDesigner({draft,roles,onChange,disabled=false,evidenceChanged=false,profileId="",capability="",insightsReady=false}: {draft:Draft;roles:Record<string,Role>;onChange:(draft:Draft)=>void;disabled?:boolean;evidenceChanged?:boolean;profileId?:string;capability?:string;insightsReady?:boolean}) {
  const [selected,setSelected]=useState("");const [editor,setEditor]=useState<{kind:"skill"|"goal"|"break"|"career";id?:string}|null>(null);
  const [insertion,setInsertion]=useState<string|null>(null);
  const unlocked=draft.accepted && draft.route.length>=2;
  const nodes=timeline(draft,roles);const index=Math.max(0,nodes.findIndex(n=>n.id===selected));const node=nodes[index];
  const waypoint=selectedWaypoint(nodes,index,insertion);
  function selectDot(id:string){setInsertion(id);setSelected(id);}
  function navigate(delta:number){
    const stop=waypoint.stops[Math.max(0,Math.min(waypoint.stops.length-1,waypoint.current+delta))];if(!stop)return;
    if(stop.kind==="dot")selectDot(stop.id);else{setInsertion(null);setSelected(stop.id);}
  }
  const editItem=editor?.id?nodes.find(n=>n.id===editor.id):undefined;
  function remove() {
    if(!node || node.kind==="career")return;
    onChange(removeChapter(draft,node.id));setSelected("");setInsertion(null);
  }
  return <section className="sim-panel" id="life-chapter-designer" aria-labelledby="designer-heading">
    <header><span className="sim-eyebrow">02 / YOUR LEARNING AND LIFE PLAN</span><h2 id="designer-heading">Life Chapter Designer</h2>
      <p>Choose your own skills, goals, breaks and timing. Planning is not assessed competence or an employment forecast.</p></header>
    {!unlocked?<p className="sim-locked">Choose at least one career transition above to unlock your timeline.{draft.milestones.length>0&&" Your existing entries are retained while you edit the path."}</p>:<>
      <div className="sim-timeline-shell">
        <div className="sim-designer-toolbar"><div className="sim-designer-tools">
            <button className="sim-icon-button" disabled={disabled||insertion!==null} aria-label="Edit selected milestone" onClick={()=>node&&setEditor({kind:node.kind,id:node.id})}><SimulatorIcon kind="edit"/></button>
            <button className="sim-icon-button" disabled={disabled||insertion!==null||node?.kind==="career"} aria-label="Remove selected milestone" onClick={remove}><SimulatorIcon kind="remove"/></button>
            {insertion!==null&&nodes.some(n=>n.id===insertion)&&<button className="sim-add-chapter" disabled={disabled} onClick={()=>setEditor({kind:"goal"})}><SimulatorIcon kind="plus"/>Add Life Chapter</button>}
          </div>
        </div>
        <div className="sim-timeline-stage"><div className="sim-timeline-navigation"><button className="sim-icon-button" aria-label="Previous milestone" onClick={()=>navigate(-1)} disabled={waypoint.current===0}><SimulatorIcon kind="left"/></button>
          <p>{node?.kind==="career"?displayOccupationTitle(node.title):node?.kind==="skill"?displayTimelineSkill(node.title):node?.title}{node&&<span className="sim-navigation-type">{chapterType(node.kind)}</span>}</p>
          <button className="sim-icon-button" aria-label="Next milestone" onClick={()=>navigate(1)} disabled={waypoint.current===waypoint.stops.length-1}><SimulatorIcon kind="right"/></button></div>
          <ChapterStepper nodes={nodes} index={index} onSelect={id=>{setInsertion(null);setSelected(id);}} insertion={insertion} onInsert={selectDot} reviewIds={new Set(nodes.filter(n=>n.kind==="skill"&&(evidenceChanged||!draft.route.slice(1).includes(n.role_id??""))).map(n=>n.id))}/>

        </div>
      </div>
      {insertion!==null&&<button type="button" className="sim-insertion-hint" onClick={()=>{if(insertion)selectDot(insertion);}}>Add a chapter at the selected dot.</button>}
      {node && insertion===null && <article className="sim-chapter-detail" aria-label="Selected milestone details"><div className="sim-context-heading"><span className="sim-context-icon"><SimulatorIcon kind={node.kind}/></span><div><span className="sim-eyebrow">{node.kind==="career"?"CAREER CONTEXT / YOUR CHOSEN STAGE":node.kind==="skill"?"DOCUMENTED SKILL / YOUR LEARNING INTENTION":"LIFE CHAPTER / YOUR ENTRY"}</span>
        <h3>{node.kind==="career"?displayOccupationTitle(node.title):node.kind==="skill"?displayTimelineSkill(node.title):node.title}</h3></div><span className="sim-context-badge">{node.kind==="career"?"Chosen occupation":node.kind==="skill"?"Skill-development goal":node.kind==="goal"?"Personal goal":"Planned break"}</span></div>
        {(node.kind==="goal"||node.kind==="skill")?<ChapterInsights key={node.id} kind={node.kind} milestoneId={node.id} profileId={profileId} capability={capability} ready={insightsReady&&!disabled&&(node.kind!=="skill"||(!evidenceChanged&&draft.route.slice(1).includes(node.role_id??"")))} roleId={node.role_id} notes={node.notes} contextKey={JSON.stringify([draft.route,draft.chapters,draft.milestones])}/>:<div className="sim-context-facts"><div><span className="sim-eyebrow">TIMELINE CONTEXT</span><h4>{node.kind==="career"?"Your selected career path":"Your personal plan"}</h4><p>{node.kind==="career"?"This occupation is a stage you chose to explore, not an assertion of employment or career readiness.":"This chapter records your chosen intention and timing."}</p></div>
          <div><span className="sim-eyebrow">{node.kind==="career"?"OCCUPATIONAL EVIDENCE":"YOUR NOTES"}</span><h4>{node.kind==="career"?`ESCO ${roles[node.role_id]?.dataset_version??"evidence unavailable"}`:node.notes?"Your chapter notes":"No notes added"}</h4><p>{node.kind==="career"?roles[node.role_id]?.description:node.notes}</p></div></div>}
        {node.kind==="career"&&node.notes&&<p>{node.notes}</p>}
        {node.start_date && <p>Your dates: {node.start_date}{node.end_date?` to ${node.end_date}`:""}</p>}
        {node.relative_year!==null && <p>Your chosen relative year: {node.relative_year}</p>}
        {node.duration_months!==null && <p>Your planned duration: {node.duration_months} months</p>}
        {node.kind==="career" && roles[node.role_id] && <RoleEvidence role={roles[node.role_id]}/>}
        {node.kind==="skill" && <>{!draft.route.slice(1).includes(node.role_id??"")&&<p>Needs review — originating occupation removed from active path. This entry is retained.</p>}
          <p>Originating occupation: {displayOccupationTitle(roles[node.role_id??""]?.title??node.role_id??"")}</p>
          <a href={node.skill_id??undefined} target="_blank" rel="noopener noreferrer">ESCO skill source ↗</a></>}
        <div className="sim-actions">
          {node.kind==="skill" && <button disabled={disabled} onClick={()=>onChange({...draft,milestones:draft.milestones.map(m=>m.id===node.id?{...m,kind:"goal",role_id:null,skill_id:null}:m)})}>Retain as personal goal</button>}
        </div>
      </article>}
    </>}
    {editor && <MilestoneEditor key={`${editor.kind}:${editor.id??"new"}`} kind={editor.kind} item={editItem} draft={draft} roles={roles} onTab={kind=>setEditor({kind})} onClose={()=>setEditor(null)} onSave={(items,timing)=>{
      if(editor.kind==="career" && editItem?.kind==="career" && timing)onChange({...draft,chapters:draft.chapters.map(c=>c.role_id===editItem.role_id?{...c,...timing}:c)});
      else {
        const ids=new Set(items.map(m=>m.id));
        if(!editor.id&&insertion)onChange(insertChapters(draft,insertion,items));
        else onChange({...draft,milestones:[...draft.milestones.filter(m=>!ids.has(m.id)),...items].sort((a,b)=>a.order-b.order).map((m,i)=>({...m,order:i}))});
        setSelected(items.at(-1)?.id??selected);
      }
      setInsertion(null);setEditor(null);
    }}/>}
  </section>;
}

function MilestoneEditor({kind,item,draft,roles,onTab,onClose,onSave}:{kind:"career"|"skill"|"goal"|"break";item?:Item;draft:Draft;roles:Record<string,Role>;onTab:(kind:"goal"|"break"|"skill")=>void;onClose:()=>void;onSave:(items:Milestone[],timing?:Timing)=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [title,setTitle]=useState(item?.title??"");const [notes,setNotes]=useState(item?.notes??"");
  const start=item?.start_date??"",end=item?.end_date??"";
  const year=item?.relative_year===null||item?.relative_year===undefined?"":String(item.relative_year);
  const [duration,setDuration]=useState(item?.duration_months?String(item.duration_months):"");
  const [choices,setChoices]=useState<string[]>([]);const [skill,setSkill]=useState(item?.kind==="skill"?`${item.role_id}|${item.skill_id}`:"");
  const [error,setError]=useState("");
  const skills=draft.route.slice(1).flatMap(id=>(roles[id]?.requirements??[]).filter(r=>r.not_evidenced || (item?.kind==="skill" && item.skill_id===r.skill_id && item.role_id===id)).map(r=>({roleId:id,...r})));
  const uniqueSkills=Array.from(new Set(skills.map(s=>s.skill_id))).map(id=>skills.find(s=>s.skill_id===id&&`${s.roleId}|${s.skill_id}`===skill)??skills.find(s=>s.skill_id===id)!);
  useEffect(()=>{dialog.current?.showModal();return()=>dialog.current?.close();},[]);
  function submit(event:React.FormEvent) {
    event.preventDefault();setError("");
    if((end && (!start || end<start)) || (start && year)){setError("Use coherent dates, or a relative year without a start date.");return;}
    const timing:Timing={notes,start_date:start||null,end_date:end||null,relative_year:year===""?null:Number(year),duration_months:duration===""?null:Number(duration)};
    if(kind==="career"){onSave([],timing);return;}
    const [roleId,skillId]=skill.split("|");const documented=skills.find(s=>s.roleId===roleId && s.skill_id===skillId);
    const titles=kind==="skill"?[documented?.name??""]:item?[title.trim()]:[...choices,...(title.trim()?[title.trim()]:[])];
    if(!titles.length || titles.some(t=>!t)){setError("Choose a documented skill or enter a title.");return;}
    const existing=new Set(draft.milestones.filter(m=>m.id!==item?.id).map(m=>`${m.kind}:${m.title.toLowerCase()}`));
    if(titles.some(t=>existing.has(`${kind}:${t.toLowerCase()}`)) || new Set(titles.map(t=>t.toLowerCase())).size!==titles.length){setError("That milestone is already on your timeline.");return;}
    onSave(titles.map((t,i)=>({...timing,id:item?.id??crypto.randomUUID().replaceAll("-",""),kind,title:t,
      order:item?.order??Math.max(-1,...draft.milestones.map(m=>m.order))+i+1,role_id:kind==="skill"?roleId:null,skill_id:kind==="skill"?skillId:null,after_id:item?.kind!=="career"?item?.after_id??null:null,category:choices.includes(t)?t:"custom"})));
  }
  return <dialog className="sim-modal" ref={dialog} onCancel={onClose} aria-labelledby="milestone-editor-heading">
    <form onSubmit={submit}><header><div><h3 id="milestone-editor-heading">{item?"Edit":"Add"} {kind==="career"?"chapter":kind==="skill"?"skill":"a life chapter"}</h3><p>Choose what belongs on your personal timeline.</p></div><button type="button" className="sim-icon-button" onClick={onClose} aria-label="Close milestone editor"><SimulatorIcon kind="close"/></button></header>
      {!item&&kind!=="career"&&<div className="sim-chapter-tabs" role="tablist" aria-label="Chapter type">{(["goal","skill"] as const).map((value,i)=><button type="button" role="tab" id={`chapter-${value}-tab`} aria-controls="chapter-editor-content" aria-selected={kind===value} key={value} onClick={()=>onTab(value)} onKeyDown={e=>{
        if(!["ArrowLeft","ArrowRight","Home","End"].includes(e.key))return;e.preventDefault();
        const next=e.key==="Home"?0:e.key==="End"?1:(i+1)%2;
        onTab((["goal","skill"] as const)[next]);requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>(".sim-chapter-tabs [aria-selected=true]")?.focus());
      }}>{value==="goal"?"Goals":"Skills"}</button>)}</div>}
      <div className="sim-modal-body" id="chapter-editor-content" role={!item&&kind!=="career"?"tabpanel":undefined} aria-labelledby={!item&&kind!=="career"?`chapter-${kind}-tab`:undefined}>
      {kind==="skill"?<><SkillPicker options={uniqueSkills.map(s=>({value:`${s.roleId}|${s.skill_id}`,label:displayTimelineSkill(s.name)}))} value={skill} onChange={setSkill}/>{!skills.length&&<p>No documented requirements available for the selected path.</p>}</>:kind!=="career"?<>
        {kind==="goal"&&!item&&<fieldset className="sim-goal-options"><legend className="sr-only">Optional goal categories — nothing is preselected</legend>{categories.map((c,i)=><label key={c} className={choices.includes(c)?"is-selected":""}><input type="checkbox" checked={choices.includes(c)} onChange={()=>setChoices(old=>old.includes(c)?old.filter(x=>x!==c):[...old,c])}/><span className="sim-option-icon"><SimulatorIcon kind={categoryIcons[i]}/></span><span><strong>{c}</strong><small>Goal</small></span></label>)}</fieldset>}
        <label>{kind==="break"?"Break title":"Custom goal title"}<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={160} required={kind==="break"||!!item}/></label></>:null}
      <label>Your notes<textarea value={notes} onChange={e=>setNotes(e.target.value)} maxLength={2000}/></label>
      <div className="sim-editor-grid">
        <label>Duration in months (optional)<input type="number" min={1} max={1200} value={duration} onChange={e=>setDuration(e.target.value)}/></label></div>
      {error&&<p role="alert">{error}</p>}</div><footer className="sim-modal-footer"><button type="button" onClick={onClose}>Cancel</button><button type="submit"><SimulatorIcon kind="plus"/>{item?"Save changes":"Add to Timeline"}</button></footer>
    </form>
  </dialog>;
}

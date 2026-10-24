"use client";
import { useEffect, useState } from "react";
import CareerBranchGraph from "./CareerBranchGraph";
import SimulatorIcon from "./SimulatorIcon";
import { displayTimelineSkill } from "@/lib/career-display";
import { simulatorRequest, type Role, type Draft, type Config } from "@/lib/career-simulator";

export function RoleEvidence({role}: {role:Role}) {
  return <details className="sim-evidence"><summary>Why suggested? &amp; Sources</summary>
    <p>{role.explanation}</p><p>Method: essential skill ID intersection. No hiring or promotion probability.</p>
    <p>{role.shared_essential_skills.length} shared essential skills: {role.shared_essential_skills.map(s=>displayTimelineSkill(s.name)).join(", ")||"None documented"}</p>
    <p>{role.not_evidenced_essential_skill_ids.length} essential requirements not yet evidenced by your original recognised profile.</p>
    <ul>{role.requirements.filter(r=>r.requirement==="essential" && r.not_evidenced).map(r=><li key={r.skill_id}>{displayTimelineSkill(r.name)} <small>{r.skill_id}</small></li>)}</ul>
    <p>ESCO {role.dataset_version} · Official source records</p>
    <a href={role.role_id} target="_blank" rel="noopener noreferrer">ESCO occupation ↗</a>
    {role.source_urls.map(url=><a key={url} href={url} target="_blank" rel="noopener noreferrer">Source ↗</a>)}
  </details>;
}

export default function CareerLandscape({draft,config,roles,profileId,capability,onPath,onAccept,disabled=false}: {
  draft:Draft;config:Config;roles:Record<string,Role>;profileId:string;capability:string;
  onPath:(route:string[])=>void;onAccept:()=>void;disabled?:boolean;
}) {
  const [branches,setBranches]=useState<Record<string,Role[]>>({});
  const [query,setQuery]=useState("");
  const [results,setResults]=useState<Role[]>([]);
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const [search,setSearch]=useState({query:"",offset:0,revision:0,explicit:false});
  const routeKey=JSON.stringify(draft.route);
  useEffect(()=>{
    if(!config.available)return;
    const controller=new AbortController();
    const path=JSON.parse(routeKey) as string[];
    const prefix=path;
    if(!prefix.length && !search.explicit){setResults([]);setBusy(false);return;}
    if(path.length>=config.max_destination_steps+1){setResults([]);setBusy(false);return;}
    setBusy(true);setError("");
    void simulatorRequest<{results:Role[];next_offset:number|null}>(capability,search.explicit?"/roles/search":"/candidates","POST",{
      profile_id:profileId,from_role_id:prefix.at(-1)??null,route:prefix,query:search.query,offset:0,sort:"overlap",
    },controller.signal).then(data=>{if(!controller.signal.aborted){setResults(data.results);setBranches(old=>({...old,[JSON.stringify(prefix)]:data.results}));}})
      .catch(()=>{if(!controller.signal.aborted){setResults([]);setError("Occupation evidence could not be loaded. Your selected path is preserved.");}})
      .finally(()=>{if(!controller.signal.aborted)setBusy(false);});
    return()=>controller.abort();
  },[routeKey,config.available,config.max_destination_steps,capability,profileId,search]);
  const capped=draft.route.length>=config.max_destination_steps+1;
  function choose(role:Role, step=draft.route.length) {
    if(capped && step>=draft.route.length)return;
    const prefix=draft.route.slice(0,step);
    onPath(draft.route[step]===role.role_id?prefix:[...prefix,role.role_id]);setQuery("");setSearch({query:"",offset:0,revision:search.revision+1,explicit:false});
  }
  return <section className="sim-panel" id="career-landscape" aria-labelledby="landscape-heading">
    <header><span className="sim-eyebrow">01 / EXPLORE POSSIBILITIES</span><h2 id="landscape-heading">Career Landscape</h2>
      <p>Connections are calculated from shared documented skills, not verified career progressions.</p></header>
    {!config.available && <p role="alert">Full ESCO evidence is unavailable. Restore the pinned index to explore. Your saved plan is retained.</p>}
    {draft.route.length>0 && <div className="sim-actions">
      <button type="button" disabled={disabled} aria-label="Restart career path (keep personal entries)" title="Restart career path (keep personal entries)" onClick={()=>{onPath([]);setQuery("");setSearch(s=>({...s,query:"",explicit:false,revision:s.revision+1}));}}><SimulatorIcon kind="return"/></button>
      {draft.route.length>=2 && <button type="button" disabled={disabled||!config.available} onClick={onAccept}>{draft.accepted?"Career path selected":"Use this career path"}</button>}
    </div>}
    {capped && <p role="status">Maximum {config.max_destination_steps} career steps selected — click a selected card to deselect it and explore another route.</p>}
    {!capped && <>
      <form onSubmit={event=>{event.preventDefault();setSearch({query:query.trim(),offset:0,revision:search.revision+1,explicit:true});}} className="sim-search">
        <label>{draft.route.length?"Search a destination occupation":"Choose my starting occupation"}
          <input aria-label="Search ESCO occupations" value={query} onChange={e=>setQuery(e.target.value)} maxLength={100} disabled={disabled||!config.available} /></label>
        <button disabled={disabled||!config.available||busy}>Search occupations</button>
      </form>
      {busy && <p role="status">Loading documented occupations…</p>}{error && <p role="alert">{error}</p>}
      {!busy && !results.length && (draft.route.length>0||search.explicit) && <p>No related occupations found here. Search a real ESCO occupation to choose an aspiration.</p>}
    </>}
    <CareerBranchGraph route={draft.route} roles={roles} branches={branches} results={results} disabled={disabled||!config.available}
      onChoose={choose}/>
  </section>;
}

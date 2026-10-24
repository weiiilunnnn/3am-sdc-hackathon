"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useCareerSimulator } from "@/lib/use-career-simulator";
import { changePath, simulatorRequest, type Role } from "@/lib/career-simulator";
import CareerLandscape from "./CareerLandscape";
import LifeChapterDesigner from "./LifeChapterDesigner";
import { displayOccupationTitle } from "@/lib/career-display";

export default function CareerSimulator() {
  const state=useCareerSimulator();const [roles,setRoles]=useState<Record<string,Role>>({});
  const [context,setContext]=useState<Role|null>(null);
  const ids=JSON.stringify([...new Set([...state.draft.route,...state.draft.milestones.map(m=>m.role_id).filter((id):id is string=>!!id)])]);
  const routeKey=JSON.stringify(state.draft.route);
  useEffect(()=>{
    if(!state.ready || !state.config?.available)return;
    const controller=new AbortController();const path=JSON.parse(routeKey) as string[];
    const load=async()=>{
      const all=await Promise.all((JSON.parse(ids) as string[]).map(async id=>{
        const at=path.indexOf(id);
        try{return (await simulatorRequest<{role:Role}>(state.capability,"/roles/detail","POST",{
          profile_id:state.profileId,role_id:id,from_role_id:at>0?path[at-1]:null},controller.signal)).role;}catch{return null;}
      }));
      if(!controller.signal.aborted)setRoles(Object.fromEntries(all.filter((r):r is Role=>!!r).map(r=>[r.role_id,r])));
    };
    void load();return()=>controller.abort();
  },[ids,routeKey,state.ready,state.config?.available,state.capability,state.profileId]);
  useEffect(()=>{
    if(!state.ready||!state.config?.available)return;
    const id=new URLSearchParams(window.location.search).get("role_id");if(!id)return;
    const controller=new AbortController();
    void simulatorRequest<{role:Role}>(state.capability,"/roles/detail","POST",{profile_id:state.profileId,role_id:id},controller.signal)
      .then(data=>{if(!controller.signal.aborted)setContext(data.role);}).catch(()=>{});
    return()=>controller.abort();
  },[state.ready,state.config?.available,state.capability,state.profileId]);
  return <main className="career-simulator" data-testid="career-simulator">
    <div className="sim-intro"><span className="sim-eyebrow">PATHWAAY / EXPLORE · CHOOSE · PLAN</span><h1>AI Career Transition Simulator</h1>
      <p>Explore career possibilities using documented skills, then shape a learning and life timeline around your choices.</p>
      <p>Occupational data: ESCO. Suggested connections are calculated skill overlap, not hiring or promotion predictions.</p>
    </div>
    <p className="sr-only" role="status" aria-live="polite">{state.status}</p>
    {state.blocked&&<div className="sim-save-error" role="alert"><p>{state.status}</p><button type="button" onClick={state.retrySave}>Retry saving current revision</button></div>}
    {!state.ready&&<p role="status">{state.status}</p>}
    {!state.ready?<p>Use your existing saved profile. <Link href="/profile">Open My Profile</Link></p>:<>
      {state.plan?.over_limit&&<p role="alert">Your saved path exceeds the new configured cap. It has not been truncated; edit the path before saving.</p>}
      {state.plan?.evidence_changed&&<p role="alert">Evidence changed — review your plan. <button onClick={()=>{if(window.confirm("I have reviewed the updated ESCO evidence. Save my plan against this version?"))state.setDraft(d=>({...d,acknowledge_evidence_change:true}));}}>Confirm evidence review</button></p>}
      {context&&<p>Optional destination context: {displayOccupationTitle(context.title)}. Choose your starting occupation explicitly above; this is not asserted as your current job.
        <button disabled={!state.draft.route.length||state.draft.route.includes(context.role_id)||state.draft.route.length>=(state.config?.max_destination_steps??0)+1} onClick={()=>{
          state.setDraft(d=>changePath(d,[...d.route,context.role_id]));setContext(null);
        }}>Explore as a destination</button></p>}
      {state.config&&<CareerLandscape draft={state.draft} config={state.config} roles={roles} profileId={state.profileId} capability={state.capability}
        disabled={state.status==="Saving…"} onPath={route=>{
          state.setDraft(d=>changePath(d,route));
        }} onAccept={()=>state.setDraft(d=>({...d,accepted:true}))}/ >}
      <LifeChapterDesigner profileId={state.profileId} capability={state.capability} insightsReady={state.ready&&!state.dirty&&!state.blocked} draft={state.draft} roles={roles} onChange={state.setDraft} disabled={state.status==="Saving…"} evidenceChanged={state.plan?.evidence_changed}/>
    </>}
  </main>;
}

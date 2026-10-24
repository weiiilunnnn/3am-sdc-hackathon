"use client";
import { useEffect, useRef, useState } from "react";
import { PROFILE_KEY } from "../app/(workspace)/profile-workspace";
import { asDraft, browserCapability, emptyDraft, simulatorRequest, SimulatorError, type Draft, type Envelope, type Plan, type Config } from "./career-simulator";

export function useCareerSimulator() {
  const [profileId,setProfileId]=useState(""); const [capability,setCapability]=useState("");
  const [config,setConfig]=useState<Config|null>(null); const [plan,setPlan]=useState<Plan|null>(null);
  const [draft,setDraft]=useState<Draft>(emptyDraft); const [status,setStatus]=useState("Loading…");
  const [ready,setReady]=useState(false);const [tick,setTick]=useState(0);
  const generation=useRef(0), revision=useRef(0), acknowledged=useRef(""), flight=useRef(false), stopped=useRef(false);
  const current=useRef(draft);current.current=draft;
  const dirty=ready && JSON.stringify(draft)!==acknowledged.current;
  useEffect(()=>{
    const guard=(e:BeforeUnloadEvent)=>{if(JSON.stringify(current.current)!==acknowledged.current && ready){e.preventDefault();e.returnValue="";}};
    const leaving=(event:MouseEvent)=>{
      const anchor=(event.target as Element)?.closest?.("a");
      if(anchor && anchor.target!=="_blank" && !anchor.getAttribute("href")?.startsWith("#") && ready && JSON.stringify(current.current)!==acknowledged.current &&
        !window.confirm("Leave with unsaved journey edits? Choose Cancel to stay and finish saving.")){event.preventDefault();event.stopPropagation();}
    };
    window.addEventListener("beforeunload",guard);document.addEventListener("click",leaving,true);
    return()=>{window.removeEventListener("beforeunload",guard);document.removeEventListener("click",leaving,true);};
  },[ready]);
  useEffect(()=>{
    let active=true;
    async function initialize() {
      try {
        const id=localStorage.getItem(PROFILE_KEY)??""; const key=browserCapability();
        if(!id){setStatus("Save a profile first to create your journey.");return;}
        const data=await simulatorRequest<Envelope>(key,`/plan?profile_id=${encodeURIComponent(id)}`);
        if(!active)return;
        setProfileId(id);setCapability(key);setConfig(data.config);setPlan(data.plan);
        const next=asDraft(data.plan);acknowledged.current=JSON.stringify(next);revision.current=data.plan?.revision??0;
        setDraft(next);setReady(true);setStatus(data.plan?"Saved":"Choose your starting occupation.");
      } catch {if(active)setStatus("Could not restore your journey. Your browser capability and saved data have not been reset.");}
    }
    void initialize();
    return()=>{active=false;generation.current++;};
  },[]);
  useEffect(()=>{
    if(!ready || !dirty || stopped.current || !config?.available || (plan?.evidence_changed && !draft.acknowledge_evidence_change))return;
    setStatus("Unsaved changes");
    const timer=setTimeout(()=>{
      if(flight.current)return;
      if(localStorage.getItem(PROFILE_KEY)!==profileId){stopped.current=true;setStatus("Profile changed — reload to avoid mixing journeys. Your draft is retained here.");return;}
      flight.current=true; const epoch=generation.current; const snapshot=JSON.stringify(draft);
      setStatus("Saving…");
      void simulatorRequest<Envelope>(capability,"/plan","PUT",{...draft,plan_id:plan?.plan_id??null,profile_id:profileId,revision:revision.current}).then(data=>{
        if(epoch!==generation.current)return;
        revision.current=data.plan!.revision;setPlan(data.plan);setConfig(data.config);
        if(JSON.stringify(current.current)===snapshot){const next=asDraft(data.plan);acknowledged.current=JSON.stringify(next);setDraft(next);setStatus("Saved");}
        else {acknowledged.current=snapshot;setStatus("Unsaved changes");}
      }).catch(error=>{
        if(epoch!==generation.current)return;
        stopped.current=true;setStatus(error instanceof SimulatorError && error.status===409?"Conflict — your edits are still on this page.":"Couldn't save — changes are still on this page.");
      }).finally(()=>{flight.current=false;if(epoch===generation.current)setTick(n=>n+1);});
    },650);
    return()=>clearTimeout(timer);
  },[draft,dirty,ready,capability,profileId,config,plan,tick]);
  async function reload() {
    if(flight.current)return;
    if(!window.confirm("Reload the server journey? Your current edits will be kept in a downloadable review copy first."))return;
    const blob=new Blob([JSON.stringify(current.current,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="career-journey-review.json";a.click();URL.revokeObjectURL(url);
    try {
      const data=await simulatorRequest<Envelope>(capability,`/plan?profile_id=${encodeURIComponent(profileId)}`);
      generation.current++;stopped.current=false;revision.current=data.plan?.revision??0;
      const next=asDraft(data.plan);acknowledged.current=JSON.stringify(next);setDraft(next);setPlan(data.plan);setConfig(data.config);setStatus(data.plan?"Saved":"Journey not yet saved");
    } catch {setStatus("Couldn't reload — your edits are still on this page.");}
  }
  async function reset() {
    if(flight.current || !window.confirm("Delete only this journey, including all goals, skills and breaks? Your profile remains."))return;
    flight.current=true;stopped.current=true;setStatus("Saving…");
    try {
      await simulatorRequest(capability,`/plan?profile_id=${encodeURIComponent(profileId)}&revision=${revision.current}${plan?`&plan_id=${plan.plan_id}`:""}`,"DELETE");
      generation.current++;stopped.current=false;revision.current=0;const next=emptyDraft();acknowledged.current=JSON.stringify(next);
      setDraft(next);setPlan(null);setStatus("Journey reset");
    } catch {setStatus("Could not reset. Reload for review; your journey has not been discarded locally.");}
    finally {flight.current=false;setTick(n=>n+1);}
  }
  return {profileId,capability,config,plan,draft,setDraft,status,ready,dirty,reload,reset,
    retrySave:()=>{stopped.current=false;setTick(n=>n+1);}, blocked:stopped.current};
}

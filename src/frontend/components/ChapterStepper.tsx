"use client";
import { useEffect, useRef, type CSSProperties } from "react";
import type { timeline } from "@/lib/career-simulator";
import { displayOccupationTitle, displayTimelineSkill } from "@/lib/career-display";
import SimulatorIcon from "./SimulatorIcon";

type Chapter=ReturnType<typeof timeline>[number];
export function chapterType(kind:Chapter["kind"]) {
  return {career:"Job",skill:"Skill",goal:"Goal",break:"Break"}[kind];
}
export function chapterStops(nodes:Chapter[],withDots=true){
 return nodes.flatMap(node=>withDots?[{kind:"node" as const,id:node.id},{kind:"dot" as const,id:node.id}]:[{kind:"node" as const,id:node.id}]);
}
export function selectedWaypoint(nodes:Chapter[],index:number,insertion:string|null,withDots=true){
 const stops=chapterStops(nodes,withDots);
 const current=Math.max(0,stops.findIndex(stop=>stop.id===(insertion??nodes[index]?.id)&&stop.kind===(insertion?"dot":"node")));
 return {stops,current,progress:stops.length>1?current/(stops.length-1)*100:0};
}
export default function ChapterStepper({nodes,index,onSelect,reviewIds=new Set<string>(),insertion=null,onInsert}:{
  nodes:Chapter[];index:number;onSelect:(id:string)=>void;reviewIds?:Set<string>;insertion?:string|null;onInsert?:(id:string)=>void;
}) {
  const viewport=useRef<HTMLDivElement>(null),active=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    const frame=viewport.current,button=active.current;if(!frame||!button)return;
    const box=frame.getBoundingClientRect(),item=button.getBoundingClientRect();
    if(item.left<box.left)frame.scrollLeft-=box.left-item.left;
    else if(item.right>box.right)frame.scrollLeft+=item.right-box.right;
  },[index,nodes.length,insertion]);
  if(!nodes.length)return null;
  const {stops,current,progress}=selectedWaypoint(nodes,index,insertion,!!onInsert);
  return <div ref={viewport} className="sim-stepper-viewport">
    <div className={`sim-stepper${onInsert?" has-insertion":""}`} style={{"--sim-step-count":nodes.length} as CSSProperties}>
      <div className="sim-stepper-track" role="progressbar" aria-label="Selected timeline position" aria-valuemin={0} aria-valuemax={Math.max(0,stops.length-1)} aria-valuenow={current}>
        <span className="sim-stepper-fill" style={{width:`${progress}%`}}/>
      </div>
      <ol className="sim-timeline" aria-label="Your career and life timeline">{nodes.map((node,i)=><li key={node.id}>
        <button ref={i===index&&insertion===null?active:undefined} data-stop-index={onInsert?i*2:i} type="button" aria-pressed={i===index&&insertion===null} aria-current={i===index&&insertion===null?"step":undefined}
          onClick={()=>onSelect(node.id)} className={`sim-node sim-${node.kind}${i<=index?" is-reached":" is-future"}`}>
          <span className="sim-node-circle"><SimulatorIcon kind={node.kind}/></span>
          <strong>{node.kind==="career"?displayOccupationTitle(node.title):node.kind==="skill"?displayTimelineSkill(node.title):node.title}</strong>
          <span className="sim-node-type">{chapterType(node.kind)}</span>
          {node.notes&&<span className="sim-node-subtitle">{node.notes}</span>}
          {reviewIds.has(node.id)&&<em>Needs review — evidence or chosen path changed</em>}
        </button>
        {onInsert&&<button type="button" ref={insertion===node.id?active:undefined} data-stop-index={i*2+1} className={`sim-insert-dot${insertion===node.id?" is-active":""}`} aria-label={`Add chapter after ${node.kind==="career"?displayOccupationTitle(node.title):node.kind==="skill"?displayTimelineSkill(node.title):node.title}`} aria-current={insertion===node.id?"step":undefined} aria-pressed={insertion===node.id} onClick={()=>onInsert(node.id)}><span aria-hidden="true"/></button>}
      </li>)}</ol>
    </div>
  </div>;
}

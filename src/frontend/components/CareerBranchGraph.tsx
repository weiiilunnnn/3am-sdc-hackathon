"use client";
import { useEffect, useRef, useState } from "react";
import type { Role } from "@/lib/career-simulator";
import { displayOccupationTitle } from "@/lib/career-display";


type View = {scale:number;x:number;y:number};
export function zoomGraph(view:View,factor:number,point:{x:number;y:number}):View {
  const scale=Math.max(.08,Math.min(2.5,view.scale*factor));
  const ratio=scale/view.scale;
  return {scale,x:point.x-(point.x-view.x)*ratio,y:point.y-(point.y-view.y)*ratio};
}
type Node = {id:string;role?:Role;selected:boolean;step:number};
export default function CareerBranchGraph({route,roles,branches,results,disabled,onChoose}:{
  route:string[];roles:Record<string,Role>;branches:Record<string,Role[]>;results:Role[];disabled:boolean;
  onChoose:(role:Role,step:number)=>void;
}) {
  const board=useRef<HTMLDivElement>(null);const [lines,setLines]=useState<{d:string;selected:boolean}[]>([]);
  const viewport=useRef<HTMLDivElement>(null);
  const [view,setView]=useState<View>({scale:.61,x:0,y:0});const viewRef=useRef(view);viewRef.current=view;
  const pointers=useRef(new Map<number,{x:number;y:number}>());const dragged=useRef(false);
  function fit() {
    const root=board.current,frame=viewport.current;if(!root||!frame)return;
    const scale=.61;
    setView({scale,x:(frame.clientWidth-root.offsetWidth*scale)/2,y:(frame.clientHeight-root.offsetHeight*scale)/2});
  }
  function zoom(factor:number,point?:{x:number;y:number}) {
    const frame=viewport.current;if(!frame)return;
    setView(old=>zoomGraph(old,factor,point??{x:frame.clientWidth/2,y:frame.clientHeight/2}));
  }
  const columns:Node[][]=[];
  if(!route.length)columns.push((results.length?results:branches["[]"]??[]).map(role=>({id:role.role_id,role,selected:false,step:0})));
  else {
    for(let step=0;step<=route.length;step++) {
      const options=branches[JSON.stringify(route.slice(0,step))]??[];
      const selected=route[step];
      // Keep the discovery order: choosing a card changes its state, not its row.
      const col:Node[]=options.filter(r=>!route.slice(0,step).includes(r.role_id)).map(role=>({
        id:role.role_id,role:role.role_id===selected?roles[selected]??role:role,selected:role.role_id===selected,step,
      }));
      // Restored paths may not have their earlier discovery pages in this browser.
      if(selected&&!col.some(n=>n.id===selected))col.push({id:selected,role:roles[selected],selected:true,step});
      if(col.length)columns.push(col);
    }
  }
  const structure=JSON.stringify(columns.map(c=>c.map(n=>[n.id,n.selected,n.role?.title])));
  useEffect(()=>{
    const root=board.current;if(!root)return;
    const measure=()=>{
      const base=root.getBoundingClientRect();const scale=viewRef.current.scale;const nodes=new Map(Array.from(root.querySelectorAll<HTMLElement>("[data-graph-node]")).map(el=>[el.dataset.graphNode!,el.getBoundingClientRect()]));
      const paths:{d:string;selected:boolean}[]=[];
      columns.forEach((col,i)=>{
        if(!i)return;
        const parent=columns[i-1].find(n=>n.selected);if(!parent)return;
        const start=nodes.get(JSON.stringify([parent.step,parent.id]));if(!start)return;
        col.filter(n=>n.selected).forEach(n=>{const end=nodes.get(JSON.stringify([n.step,n.id]));if(!end)return;
          const x1=(start.right-base.left)/scale,y1=(start.top-base.top+start.height/2)/scale,x2=(end.left-base.left)/scale,y2=(end.top-base.top+end.height/2)/scale;
          const bend=(x2-x1)/2;
          paths.push({d:`M ${x1} ${y1} C ${x1+bend} ${y1}, ${x2-bend} ${y2}, ${x2} ${y2}`,selected:n.selected});
        });
      });setLines(paths);fit();
    };
    const observer=new ResizeObserver(measure);observer.observe(root);
    if(viewport.current)observer.observe(viewport.current);
    root.querySelectorAll("[data-graph-node]").forEach(el=>observer.observe(el));measure();
    return()=>observer.disconnect();
  },[structure]);
  useEffect(()=>{
    const frame=viewport.current;if(!frame)return;
    const wheel=(event:WheelEvent)=>{
      if(!event.ctrlKey)return;
      event.preventDefault();const box=frame.getBoundingClientRect();
      zoom(Math.exp(-event.deltaY*.01),{x:event.clientX-box.left,y:event.clientY-box.top});
    };
    frame.addEventListener("wheel",wheel,{passive:false});
    return()=>frame.removeEventListener("wheel",wheel);
  },[structure]);
  if(!columns.some(c=>c.length))return null;
  return <div className="sim-graph-container">
    <div className="sim-zoom-controls" aria-label="Landscape zoom controls">
      <button type="button" aria-label="Zoom out" disabled={view.scale<=.08} onClick={()=>zoom(1/1.25)}>−</button>
      <output aria-label="Zoom level">{Math.round(view.scale*100)}%</output>
      <button type="button" aria-label="Zoom in" disabled={view.scale>=2.5} onClick={()=>zoom(1.25)}>+</button>
      <button type="button" onClick={fit}>Fit view</button>
    </div>
    <p className="sim-canvas-help" id="sim-canvas-help">Click a card to select or deselect it. Pinch to zoom; drag the background to move. Keyboard: + / − to zoom, arrow keys to move, zero to fit.</p>
    <div ref={viewport} className="sim-graph-scroll" role="region" aria-label="Branching occupation landscape" aria-describedby="sim-canvas-help" tabIndex={0}
      onKeyDown={event=>{
        if(event.target!==event.currentTarget)return;
        const direction:Record<string,[number,number]>={ArrowLeft:[40,0],ArrowRight:[-40,0],ArrowUp:[0,40],ArrowDown:[0,-40]};
        if(event.key==="+"||event.key==="="){event.preventDefault();zoom(1.25);}
        else if(event.key==="-"){event.preventDefault();zoom(1/1.25);}
        else if(event.key==="0"){event.preventDefault();fit();}
        else if(direction[event.key]){event.preventDefault();const [x,y]=direction[event.key];setView(old=>({...old,x:old.x+x,y:old.y+y}));}
      }}
      onPointerDown={event=>{
        if(event.button!==0)return;
        if(!pointers.current.size)dragged.current=false;
        pointers.current.set(event.pointerId,{x:event.clientX,y:event.clientY});
        if(!(event.target as HTMLElement).closest(".sim-graph-card,button,a,details"))event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event=>{
        const previous=pointers.current.get(event.pointerId);if(!previous)return;
        const current={x:event.clientX,y:event.clientY};
        if(pointers.current.size===2){
          const other=[...pointers.current.entries()].find(([id])=>id!==event.pointerId)![1];
          const before=Math.hypot(previous.x-other.x,previous.y-other.y),after=Math.hypot(current.x-other.x,current.y-other.y);
          const box=event.currentTarget.getBoundingClientRect();
          if(before>0)zoom(after/before,{x:(other.x+current.x)/2-box.left,y:(other.y+current.y)/2-box.top});
          dragged.current=true;
        }else if(event.currentTarget.hasPointerCapture(event.pointerId)){
          const dx=current.x-previous.x,dy=current.y-previous.y;
          if(dx||dy){setView(old=>({...old,x:old.x+dx,y:old.y+dy}));dragged.current=true;}
        }
        pointers.current.set(event.pointerId,current);
      }}
      onPointerLeave={event=>{if(!event.currentTarget.hasPointerCapture(event.pointerId))pointers.current.delete(event.pointerId);}}
      onPointerUp={event=>pointers.current.delete(event.pointerId)} onPointerCancel={event=>pointers.current.delete(event.pointerId)}
      onLostPointerCapture={event=>pointers.current.delete(event.pointerId)}
      onClickCapture={event=>{if(dragged.current){event.preventDefault();event.stopPropagation();dragged.current=false;}}}>
    <div ref={board} className="sim-branch-board" style={{transform:`translate(${view.x}px, ${view.y}px) scale(${view.scale})`}}>
      <svg className="sim-graph-edges" aria-hidden="true">{lines.map((line,i)=><path key={i} d={line.d} className={line.selected?"is-selected":""}/>)}</svg>
      {columns.map((col,i)=><div className="sim-graph-column" key={i} role="group" aria-label={i===0?"Starting occupation":"Destination choices"}>
        {col.map(n=><article key={n.id} data-step={n.step} data-graph-node={JSON.stringify([n.step,n.id])} className={`sim-graph-card ${n.selected?"sim-route-card is-selected":"sim-candidate"} ${n.step===0&&n.selected?"is-root":""}`}>
          <button type="button" className="sim-card-choice" aria-pressed={n.selected} aria-label={`${n.selected?"Deselect":"Choose"} ${displayOccupationTitle(n.role?.title??"occupation")}`} disabled={disabled||!n.role}
            onClick={()=>n.role&&onChoose(n.role,n.step)}>
          <span className="sim-graph-card-meta"><span>{n.selected?n.step===0?"CHOSEN START":"CHOSEN DESTINATION":"ESCO OCCUPATION"}</span>
            {n.step>0&&n.role&&<span title="Shared essential skill IDs">{n.role.overlap_count} shared</span>}</span>
          <span className="sim-card-title">{displayOccupationTitle(n.role?.title??"Occupation evidence unavailable")}</span>
          {n.selected?<span className="sim-selected-tag">Your Selected Path</span>:<span className="sim-card-description">{n.role?.evidence_kind==="documented_skill_overlap"?"Shared-skill suggestion":"Your choice · exploratory aspiration"}</span>}
          </button>

        </article>)}
      </div>)}
    </div>
    </div>
  </div>;
}

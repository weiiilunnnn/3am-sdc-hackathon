"use client";
import { useEffect, useId, useRef, useState } from "react";
export type SkillOption={value:string;label:string};
export default function SkillPicker({options,value,onChange}:{options:SkillOption[];value:string;onChange:(value:string)=>void}){
 const id=useId(),root=useRef<HTMLDivElement>(null),list=useRef<HTMLDivElement>(null);
 const [open,setOpen]=useState(false),[query,setQuery]=useState(""),[active,setActive]=useState(0);
 const filtered=options.filter(o=>o.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
 const selected=options.find(o=>o.value===value);
 useEffect(()=>{if(open)list.current?.querySelector('[data-active="true"]')?.scrollIntoView({block:"nearest"});},[active,open,query]);
 const choose=(option:SkillOption)=>{onChange(option.value);setOpen(false);setQuery("");};
 return <div ref={root} className="sim-skill-picker" onBlur={e=>{if(!root.current?.contains(e.relatedTarget as Node))setOpen(false);}}>
  <label htmlFor={id}>Skill</label>
  <div className="sim-skill-picker-field"><input id={id} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-options`} aria-required="true"
   aria-activedescendant={open&&filtered[active]?`${id}-option-${active}`:undefined} placeholder="Search or choose a skill" autoComplete="off"
   value={open?query:selected?.label??""} onFocus={()=>{setOpen(true);setQuery("");setActive(0);}}
   onChange={e=>{setQuery(e.target.value);setActive(0);setOpen(true);}}
   onKeyDown={e=>{
    if(e.key==="Escape"&&open){e.preventDefault();e.stopPropagation();setOpen(false);return;}
    if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();if(!open){setOpen(true);setQuery("");setActive(0);}else setActive(i=>Math.max(0,Math.min(filtered.length-1,i+(e.key==="ArrowDown"?1:-1))));}
    else if(open&&(e.key==="Home"||e.key==="End")){e.preventDefault();setActive(e.key==="Home"?0:Math.max(0,filtered.length-1));}
    else if(open&&e.key==="Enter"){e.preventDefault();if(filtered[active])choose(filtered[active]);}
   }}/><span aria-hidden="true">&#8964;</span></div>
  {open&&<div ref={list} className="sim-skill-options" id={`${id}-options`} role="listbox" aria-label="Skills">
   {filtered.map((option,i)=><button type="button" tabIndex={-1} role="option" id={`${id}-option-${i}`} key={option.value} aria-selected={option.value===value} data-active={i===active}
    onMouseDown={e=>e.preventDefault()} onClick={()=>choose(option)}>{option.label}</button>)}
   {!filtered.length&&<p role="status">No matching skills.</p>}
  </div>}
 </div>;
}

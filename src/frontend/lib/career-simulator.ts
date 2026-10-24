export type Timing = { start_date: string | null; end_date: string | null; relative_year: number | null; duration_months: number | null; notes: string };
export type Chapter = Timing & {role_id: string};
export type Milestone = Timing & {id: string; kind: "skill" | "goal" | "break"; title: string; order: number; role_id: string | null; skill_id: string | null; category: string; after_id?: string | null; review_status?: string; source_ids?: string[]; requirement?: string | null};
export type Draft = {route: string[]; accepted: boolean; chapters: Chapter[]; milestones: Milestone[]; acknowledge_evidence_change: boolean};
export type Plan = Draft & {plan_id: string; revision: number; created_at: string; updated_at: string; evidence_changed: boolean; over_limit: boolean};
export type Config = {max_destination_steps: number; candidate_limit: number; coverage: string; dataset_version: string; available: boolean; security_mode: string};
export type Requirement = {skill_id: string; name: string; requirement: string; not_evidenced: boolean; source_ids: string[]; source_urls: string[]};
export type Role = {role_id: string; title: string; description: string; requirements: Requirement[]; shared_essential_skills: {skill_id: string; name: string}[]; overlap_count: number; not_evidenced_essential_skill_ids: string[]; explanation: string; source_urls: string[]; dataset_version: string; evidence_kind: string};
export type Envelope = {config: Config; plan: Plan | null};
export const emptyTiming = (): Timing => ({start_date:null,end_date:null,relative_year:null,duration_months:null,notes:""});
export const emptyDraft = (): Draft => ({route:[],accepted:false,chapters:[],milestones:[],acknowledge_evidence_change:false});
export function inputMilestone(m: Milestone): Milestone {
  // Explicit allowlist: server origin/provenance/review metadata is never edited.
  return {id:m.id,kind:m.kind,title:m.title,order:m.order,role_id:m.role_id,skill_id:m.skill_id,category:m.category,after_id:m.after_id??null,
    start_date:m.start_date,end_date:m.end_date,relative_year:m.relative_year,duration_months:m.duration_months,notes:m.notes};
}
export function asDraft(p: Plan | null): Draft {
  return p ? {route:p.route,accepted:p.accepted,chapters:p.route.map(role_id=>p.chapters.find(c=>c.role_id===role_id)??{...emptyTiming(),role_id}),milestones:p.milestones.map(inputMilestone),acknowledge_evidence_change:false} : emptyDraft();
}
export function changePath(draft: Draft, route: string[]): Draft {
  return {...draft,route,accepted:false,chapters:route.map(role_id=>draft.chapters.find(c=>c.role_id===role_id)??{...emptyTiming(),role_id})};
}
export function timeline(draft: Draft, roles: Record<string,Role>) {
  const career = draft.route.map((role_id,i)=>({id:`role:${role_id}`,kind:"career" as const,title:roles[role_id]?.title??"Occupation evidence unavailable",order:i,
    ...emptyTiming(),...draft.chapters.find(c=>c.role_id===role_id),role_id,review_status:roles[role_id]?"active":"needs_review"}));
  // Placement is explicit; legacy dates remain metadata and never invent positions.
  const personal=[...draft.milestones].sort((a,b)=>a.order-b.order);
  const known=new Set([...career,...personal].map(n=>n.id));
  const children=new Map<string|null,Milestone[]>();
  for(const item of personal){
    const anchor=item.after_id&&known.has(item.after_id)&&item.after_id!==item.id?item.after_id:null;
    children.set(anchor,[...(children.get(anchor)??[]),item]);
  }
  const combined: (typeof career[number] | Milestone)[]=[];const visited=new Set<string>();
  function append(item:typeof combined[number]){
    if(visited.has(item.id))return;
    visited.add(item.id);combined.push(item);for(const child of children.get(item.id)??[])append(child);
  }
  for(const item of career)append(item);
  for(const item of children.get(null)??[])append(item);
  for(const item of personal)append(item); // Retain orphaned legacy entries safely.
  return combined;
}
export function insertChapters(draft:Draft,afterId:string,items:Milestone[]):Draft {
  const nodes=timeline(draft,{}),at=nodes.findIndex(n=>n.id===afterId);
  if(at<0)return draft;
  const ordered=nodes.filter((n):n is Milestone=>n.kind!=="career");
  const offset=nodes.slice(0,at+1).filter(n=>n.kind!=="career").length;
  const additions=items.map((item,i)=>({...item,after_id:i?items[i-1].id:afterId}));
  ordered.splice(offset,0,...additions);
  return {...draft,milestones:ordered.map((m,order)=>({...m,order}))};
}
export function removeChapter(draft:Draft,id:string):Draft {
  const nodes=timeline(draft,{}),at=nodes.findIndex(n=>n.id===id);
  const anchor=at>0?nodes[at-1].id:null;
  return {...draft,milestones:draft.milestones.filter(m=>m.id!==id).map(m=>m.after_id===id?{...m,after_id:anchor}:m)};
}
export function browserCapability() {
  const name="pathwaay.career-simulator-capability";
  const stored=localStorage.getItem(name);
  if(stored && /^[a-f0-9]{64}$/.test(stored))return stored;
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,"0")).join("");
  localStorage.setItem(name,token);return token;
}
export class SimulatorError extends Error { constructor(public status:number,message:string){super(message);} }
export async function simulatorRequest<T>(key:string,path:string,method="GET",body?:unknown,signal?:AbortSignal):Promise<T> {
  const response=await fetch(`/api/v2/career-simulator${path}`,{method,signal,cache:"no-store",
    headers:{"X-Career-Simulator-Key":key,...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
  if(!response.ok)throw new SimulatorError(response.status,response.status===409?"Conflict — keep your edits and reload for review.":"Could not load or save this journey. Check your inputs and connection.");
  return response.json();
}

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
import { changePath, insertChapters, removeChapter, emptyDraft, emptyTiming, timeline, asDraft, type Role, type Config, type Milestone } from "../src/frontend/lib/career-simulator";
import CareerLandscape from "../src/frontend/components/CareerLandscape";
import LifeChapterDesigner from "../src/frontend/components/LifeChapterDesigner";
import ChapterStepper, { selectedWaypoint } from "../src/frontend/components/ChapterStepper";
import ChapterInsights from "../src/frontend/components/ChapterInsights";
import SkillPicker from "../src/frontend/components/SkillPicker";
import { displayTimelineSkill } from "../src/frontend/lib/career-display";

test("timeline skill labels capitalise every word while preserving technical names",()=>{
  assert.equal(displayTimelineSkill("analysis of data with python and sql"),"Analysis Of Data With Python And SQL");
  assert.equal(displayTimelineSkill("JavaScript and SQL"),"JavaScript And SQL");
});
import CareerBranchGraph, { zoomGraph } from "../src/frontend/components/CareerBranchGraph";
const requireFrontend=createRequire(new URL("../src/frontend/package.json",import.meta.url));
const {createElement}=requireFrontend("react");const {renderToStaticMarkup}=requireFrontend("react-dom/server");
const config={max_destination_steps:3,candidate_limit:6,coverage:"local_full",dataset_version:"v1.2.1",available:true,security_mode:"browser_capability_demo"} as Config;
const role={role_id:"https://example.org/role",title:"Synthetic test occupation",description:"Test source description",requirements:[],shared_essential_skills:[],overlap_count:0,not_evidenced_essential_skill_ids:[],source_urls:[],dataset_version:"v1.2.1",evidence_kind:"user_selected_aspiration",explanation:"User-selected aspiration"} as Role;

test("designer is locked for no route or start only, without fake timeline milestones",()=>{
  for(const route of [[],[role.role_id]]){
    const html=renderToStaticMarkup(createElement(LifeChapterDesigner,{draft:{...emptyDraft(),route,accepted:true},roles:{},onChange:()=>{}}));
    assert.match(html,/Choose at least one career transition/);assert.doesNotMatch(html,/sim-timeline|Year 1|Financial Readiness/);
  }
});
test("accepted path unlocks horizontal sourced chapters with no invented dates or goals",()=>{
  const draft=changePath(emptyDraft(),["start",role.role_id]);draft.accepted=true;
  const html=renderToStaticMarkup(createElement(LifeChapterDesigner,{draft,roles:{[role.role_id]:role},onChange:()=>{}}));
  for(const text of ["Previous milestone","Next milestone","Selected timeline position","Job"])assert.ok(html.includes(text),text);
  assert.doesNotMatch(html,/Year 3|Selected progress|RM 3,000|readiness score|Add documented skill|Starting point|Viewing milestone|Timing not set|Your chosen career stage|Your personal goal/);
});
test("path changes preserve entries and chapter timing without mutating old state",()=>{
  const milestone={...emptyTiming(),id:"a".repeat(32),kind:"goal",title:"User goal",order:0,role_id:null,skill_id:null,category:"custom"} as Milestone;
  const draft={...emptyDraft(),route:["start","old"],accepted:true,milestones:[milestone],chapters:[{...emptyTiming(),role_id:"start",notes:"Retain"}]};
  const next=changePath(draft,["start","new"]);
  assert.deepEqual(next.milestones,[milestone]);assert.equal(next.chapters[0].notes,"Retain");assert.equal(next.accepted,false);
  assert.equal(draft.accepted,true);assert.equal(next.chapters[1].start_date,null);
});
test("timeline retains career path and stable undated ordering",()=>{
  const draft=changePath(emptyDraft(),["start",role.role_id]);
  draft.milestones=[{...emptyTiming(),id:"b",kind:"break",title:"User break",order:1,role_id:null,skill_id:null,category:"custom"},
    {...emptyTiming(),id:"a",kind:"goal",title:"User goal",order:0,role_id:null,skill_id:null,category:"custom"}];
  assert.deepEqual(timeline(draft,{}).map(n=>n.id),["role:start",`role:${role.role_id}`,"a","b"]);
});
test("landscape uses server path cap and omits removed role details",()=>{
  const draft=changePath(emptyDraft(),[role.role_id,"b","c","d"]);
  const html=renderToStaticMarkup(createElement(CareerLandscape,{draft,config,roles:{[role.role_id]:role},profileId:"fixture",capability:"test",onPath:()=>{},onAccept:()=>{}}));
  assert.match(html,/Maximum 3 career steps selected/);assert.doesNotMatch(html,/Role details|sim-graph-card-details/);
  assert.doesNotMatch(html,/9,842|High Confidence|similar profiles|Search occupations/);
});
test("save input omits computed provenance, retains user content",()=>{
  const draft=asDraft({...emptyDraft(),milestones:[{...emptyTiming(),id:"a",kind:"skill",title:"Sourced",order:0,role_id:"r",skill_id:"s",category:"custom",origin:"esco_requirement",source_ids:["evidence"],review_status:"needs_review"}]} as never);
  assert.equal(draft.milestones[0].skill_id,"s");assert.equal(draft.milestones[0].source_ids,undefined);
  assert.equal("origin" in draft.milestones[0],false);
});
test("Career Simulator is the last primary navigation item",()=>{
  const source=readFileSync(new URL("../src/frontend/app/PathwaayRibbon.tsx",import.meta.url),"utf8");
  assert.match(source,/href: "\/role-matching"[^\n]*\n\s*\{ href: "\/career-simulator", label: "Career Simulator" \},\s*\]/);
});

test("dated milestones retain ordering without the removed lower action buttons",()=>{
  const draft=changePath(emptyDraft(),["start",role.role_id]);draft.accepted=true;
  draft.milestones=[{...emptyTiming(),id:"dated",kind:"goal",title:"Test dated goal",order:0,role_id:null,skill_id:null,category:"custom",start_date:"2027-01-01"}];
  assert.equal(timeline(draft,{}).at(-1)?.id,"dated");
  const html=renderToStaticMarkup(createElement(LifeChapterDesigner,{draft,roles:{[role.role_id]:role},onChange:()=>{}}));
  assert.doesNotMatch(html,/>Move earlier<|>Move later<|>Remove milestone<|>Edit selected milestone<|>Edit stage timing/);
});

test("branch cards preserve selected path and show sibling choices in connected columns",()=>{
  const sibling={...role,role_id:"https://example.org/sibling",title:"Synthetic sibling"};
  const html=renderToStaticMarkup(createElement(CareerBranchGraph,{route:["start",role.role_id],roles:{[role.role_id]:role},
    branches:{'["start"]':[role,sibling]},results:[],disabled:false,onChoose:()=>{}}));
  assert.match(html,/Branching occupation landscape/);assert.match(html,/sim-graph-edges/);
  assert.equal((html.match(/data-graph-node=/g)??[]).length,3);
  assert.match(html,/aria-label="Choose Synthetic Sibling"/);assert.match(html,/CHOSEN DESTINATION/);
});


test("zoom preserves its focal point and clamps its supported range",()=>{
 const view={scale:.5,x:10,y:20},point={x:200,y:150},next=zoomGraph(view,2,point);
 assert.equal(next.scale,1);
 assert.equal((point.x-view.x)/view.scale,(point.x-next.x)/next.scale);
 assert.equal((point.y-view.y)/view.scale,(point.y-next.y)/next.scale);
 assert.equal(zoomGraph(view,100,point).scale,2.5);
 assert.equal(zoomGraph(view,.001,point).scale,.08);
});
test("cards expose toggle state and landscape omits removed controls",()=>{
 const html=renderToStaticMarkup(createElement(CareerBranchGraph,{route:[],roles:{},branches:{},results:[role],disabled:false,onChoose:()=>{}}));
 assert.match(html,/aria-pressed="false"/);assert.doesNotMatch(html,/is-selected|Select role|Change this step/);
 for(const label of ["Zoom in","Zoom out","Fit view"])assert.ok(html.includes(label));
 assert.match(html,/aria-label="Zoom level">61%/);
 const selected=renderToStaticMarkup(createElement(CareerLandscape,{draft:changePath(emptyDraft(),[role.role_id]),config,roles:{[role.role_id]:role},profileId:"fixture",capability:"test",onPath:()=>{},onAccept:()=>{}}));
 assert.match(selected,/Deselect Synthetic Test Occupation/);assert.match(selected,/Restart career path/);
 assert.doesNotMatch(selected,/Go back one step|Cancel replacement|More occupations|<select|Start over/);
});


test("landscape displays title case and a selected-path tag without role details",()=>{
 const html=renderToStaticMarkup(createElement(CareerBranchGraph,{route:[role.role_id],roles:{[role.role_id]:{...role,title:"ict operations manager"}},branches:{},results:[],disabled:false,onChoose:()=>{}}));
 assert.match(html,/ICT Operations Manager/);assert.match(html,/class="sim-selected-tag">Your Selected Path/);
 assert.doesNotMatch(html,/Role details|sim-graph-card-details|Why suggested/);
 assert.equal(role.title,"Synthetic test occupation");
});


test("selecting a non-first card retains discovery order and supports restored selections",()=>{
 const other={...role,role_id:"https://example.org/first",title:"First occupation"};
 const props={roles:{[role.role_id]:role},branches:{'["start"]':[other,role]},results:[],disabled:false,onChoose:()=>{}};
 const render=(route:string[])=>renderToStaticMarkup(createElement(CareerBranchGraph,{...props,route}));
 const ids=(html:string)=>[...html.matchAll(/data-graph-node="([^"]*)"/g)].map(m=>m[1]);
 assert.deepEqual(ids(render(["start"])),ids(render(["start",role.role_id])));
 const restored=renderToStaticMarkup(createElement(CareerBranchGraph,{...props,branches:{},route:[role.role_id]}));
 assert.match(restored,/Deselect Synthetic Test Occupation/);
 const source=readFileSync(new URL("../src/frontend/components/CareerSimulator.tsx",import.meta.url),"utf8");
 assert.doesNotMatch(source,/Change this path\?/);
});


test("five real chapters fill progress exactly to the fourth node and expose chapter types",()=>{
 const draft=changePath(emptyDraft(),["start",role.role_id]);
 draft.milestones=["skill","goal","break"].map((kind,i)=>({...emptyTiming(),id:`m${i}`,kind,title:`User ${kind}`,order:i,role_id:null,skill_id:null,category:"custom"})) as Milestone[];
 const nodes=timeline(draft,{});
 const html=renderToStaticMarkup(createElement(ChapterStepper,{nodes,index:3,onSelect:()=>{}}));
 assert.equal((html.match(/aria-pressed=/g)??[]).length,5);
 assert.match(html,/aria-valuemax="4" aria-valuenow="3"/);assert.match(html,/width:75%/);
 assert.equal((html.match(/is-reached/g)??[]).length,4);assert.equal((html.match(/is-future/g)??[]).length,1);
 for(const type of ["Job","Skill","Goal","Break"])assert.ok(html.includes(type));
 assert.doesNotMatch(html,/Timing not set|Your personal goal|Your chosen career stage/);
 const first=renderToStaticMarkup(createElement(ChapterStepper,{nodes:[],index:0,onSelect:()=>{}}));assert.equal(first,"");
 const source=readFileSync(new URL("../src/frontend/components/LifeChapterDesigner.tsx",import.meta.url),"utf8");
 assert.doesNotMatch(source,/window.confirm/);
});


test("dot insertion persists relative placement, multi-add order and child retention on deletion",()=>{
 let draft=changePath(emptyDraft(),["start","target"]);
 const item=(id:string,title:string)=>({...emptyTiming(),id,kind:"goal",title,order:0,role_id:null,skill_id:null,category:"custom"}) as Milestone;
 draft=insertChapters(draft,"role:start",[item("a","First"),item("b","Second")]);
 assert.deepEqual(timeline(draft,{}).map(n=>n.id),["role:start","a","b","role:target"]);
 draft=insertChapters(draft,"a",[item("c","Between")]);
 assert.deepEqual(timeline(draft,{}).map(n=>n.id),["role:start","a","c","b","role:target"]);
 const restored=asDraft({...draft,plan_id:"fixture"} as never);
 assert.deepEqual(timeline(restored,{}).map(n=>n.id),timeline(draft,{}).map(n=>n.id));
 draft=removeChapter(draft,"a");
 assert.deepEqual(timeline(draft,{}).map(n=>n.id),["role:start","c","b","role:target"]);
 const orphan=changePath(draft,["different","target"]);
 assert.equal(timeline(orphan,{}).filter(n=>n.kind!=="career").length,2);
});
test("insertion dots are selectable and tags follow the node title",()=>{
 const draft=changePath(emptyDraft(),["start","target"]);
 const html=renderToStaticMarkup(createElement(ChapterStepper,{nodes:timeline(draft,{}),index:0,onSelect:()=>{},onInsert:()=>{},insertion:"role:start"}));
 assert.equal((html.match(/class="sim-insert-dot/g)??[]).length,2);
 assert.match(html,/Add chapter after/);assert.ok(html.indexOf("<strong>")<html.indexOf('class="sim-node-type"'));
});


test("progress indexes nodes and insertion dots as alternating equal stops",()=>{
 const draft=changePath(emptyDraft(),["start","target"]),nodes=timeline(draft,{});
 const first=selectedWaypoint(nodes,0,null),dot=selectedWaypoint(nodes,0,"role:start"),second=selectedWaypoint(nodes,1,null),end=selectedWaypoint(nodes,1,"role:target");
 assert.deepEqual(first.stops.map(s=>s.kind),["node","dot","node","dot"]);
 assert.equal(first.progress,0);assert.equal(dot.current,1);assert.ok(Math.abs(dot.progress-100/3)<1e-9);
 assert.equal(second.current,2);assert.equal(end.progress,100);
});
test("custom skill picker shows only skill names and retains canonical choice values",()=>{
 const html=renderToStaticMarkup(createElement(SkillPicker,{options:[{value:"role|skill",label:"Python"}],value:"role|skill",onChange:()=>{}}));
 assert.match(html,/role="combobox"/);assert.match(html,/value="Python"/);
 assert.doesNotMatch(html,/<select|Statistician|optional/);
});


test("chapter insights are opt-in with local guidance and no mastery claims",()=>{
 const html=renderToStaticMarkup(createElement(ChapterInsights,{kind:"goal",milestoneId:"a".repeat(32),profileId:"fixture",capability:"mock",contextKey:"fixture",ready:false}));
 assert.match(html,/Local guidance/);assert.match(html,/Generate insights/);assert.match(html,/disabled=""/);
 assert.match(html,/sends that context to the shared Runpod model/);assert.doesNotMatch(html,/AI-generated suggestions/);
});
test("skill names use presentation title case without altering canonical labels",()=>{
 const draft=changePath(emptyDraft(),["start",role.role_id]);
 draft.milestones=[{...emptyTiming(),id:"skill",kind:"skill",title:"identify statistical patterns",order:0,role_id:role.role_id,skill_id:"s",category:"custom"}];
 const html=renderToStaticMarkup(createElement(ChapterStepper,{nodes:timeline(draft,{}),index:2,onSelect:()=>{}}));
 assert.match(html,/Identify Statistical Patterns/);assert.equal(draft.milestones[0].title,"identify statistical patterns");
});

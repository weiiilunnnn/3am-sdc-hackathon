"use client";

import { type MouseEvent, type RefObject, useEffect, useRef, useState } from "react";
import WorkspaceNav from "../WorkspaceNav";
import "./trend-signals.css";

type Skill = { id: string | null; key: string; name: string; connection_count: number };
type Evidence = {
  id: string; title: string; company: string; url: string; published_at: string;
  source_quote: string; ai_quote: string; source: string;
};
type Connection = {
  id: string; current_skill_id: string; current_skill_name: string;
  ai_skill: { id: string; name: string; definition: string };
  relationship: "builds_on" | "changes_workflow" | "may_automate_task";
  work_task: string; explanation: string; interpretation_origin: string;
  relevance: string; in_occupation_scope: boolean; stale: boolean;
  basis: "same_posting" | "same_task_passage";
  metric: { numerator: number; denominator: number; unit: string } | null;
  employer_count: number; evidence: Evidence[]; limitations: string;
  observation_period: { from: string; to: string };
  source: { name: string; collected_at: string | null; scope: string };
  cached_model_explanation: { explanation: string; model: string; limitation: string } | null;
};
type Experience = {
  profile: { id: string; occupation: string; synthetic: boolean };
  selected_skill_id: string | null; skills: Skill[]; connections: Connection[];
  samples: { id: string; label: string }[];
  source_state: { posting_status: string; collected_at: string | null; posting_sample_size: number; cache_fallback: boolean };
  method: string; coverage: string;
};
type ExploreItem = {
  id: string; name: string; definition: string; roles: string[]; tasks: string[];
  metric: { kind: "posting_prevalence"; numerator: number; denominator: number; unit: string } |
    { kind: "posting_share_change"; earlier: { numerator: number; denominator: number; from: string; to: string };
      recent: { numerator: number; denominator: number; from: string; to: string }; percentage_points: number };
  evidence: Evidence[]; source: { name: string; collected_at: string | null; scope: string };
};
type Exploration = { mode: "most_mentioned" | "rising"; title: string; sample_size: number;
  collected_at: string | null; source_scope: string; items: ExploreItem[] };
function date(value: string | null) {
  if (!value) return "not collected";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
function relationshipLabel(value: Connection["relationship"]) {
  return value === "builds_on" ? "Builds on your skill" : value === "changes_workflow" ? "Changes the workflow" : "May automate a task";
}
function Arrow() { return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 16h23m-8-8 8 8-8 8" /></svg>; }

function ConnectionCard({ item, onOpen }: { item: Connection; onOpen: (event: MouseEvent<HTMLButtonElement>) => void }) {
  return <article className="evolution-card">
    <div className="evolution-card-top"><span>{relationshipLabel(item.relationship)}</span><span>{item.stale ? "Older saved source" : item.source.name + " · " + date(item.source.collected_at)}</span></div>
    <div className="evolution-pair"><span>{item.current_skill_name}</span><Arrow /><strong>{item.ai_skill.name}</strong></div>
    <p>{item.explanation}</p>
    {!item.in_occupation_scope && <small className="evolution-scope">These source roles may be outside this profile’s occupation.</small>}
    <button type="button" className="evolution-evidence-action" onClick={onOpen}>View evidence <span aria-hidden="true">↗</span></button>
  </article>;
}
function EvidenceDrawer({ item, dialogRef, onClose }: {
  item: Connection | null; dialogRef: RefObject<HTMLDialogElement | null>; onClose: () => void;
}) {
  if (!item) return null;
  const metric = item.metric;
  return <dialog ref={dialogRef} className="evolution-drawer" aria-labelledby="evolution-drawer-title" onClose={onClose}>
    <div className="evolution-drawer-inner">
      <header className="evolution-drawer-head"><div><span>Evidence for this connection</span><h2 id="evolution-drawer-title">{item.current_skill_name} <span aria-hidden="true">→</span> {item.ai_skill.name}</h2></div><button type="button" className="evolution-close" aria-label="Close evidence" onClick={() => dialogRef.current?.close()}>×</button></header>
      <div className="evolution-drawer-body">
        <section><h3>What this AI skill involves</h3><p>{item.ai_skill.definition}</p></section>
        <section><h3>How it connects to your work</h3><p>{item.explanation}</p><small>{item.cached_model_explanation ? `Evidence-reviewed model interpretation · ${item.cached_model_explanation.model}` : "Source-grounded observation · not a forecast"}</small></section>
        {metric && <section className="evolution-measure"><h3>What this sample measures</h3><div className="evolution-measure-line"><strong>{metric.numerator} of {metric.denominator}</strong><span>{metric.unit} mentioning the existing skill also contain both supporting passages.</span></div><div className="evolution-measure-bars" role="img" aria-label={`${metric.numerator} of ${metric.denominator} unique postings have both passages; ${metric.denominator - metric.numerator} mention the existing skill without this connection`}><div><span>Both passages</span><i><b style={{ width: `${metric.numerator / metric.denominator * 100}%` }} /></i><strong>{metric.numerator}</strong></div><div><span>Existing skill only</span><i><b style={{ width: `${(metric.denominator - metric.numerator) / metric.denominator * 100}%` }} /></i><strong>{metric.denominator - metric.numerator}</strong></div></div><p>One posting snapshot, not a trend or statistical correlation. {item.employer_count} distinct {item.employer_count === 1 ? "employer" : "employers"} support this connection.</p></section>}
        {!metric && <p className="evolution-unmeasured">No defensible pairing count is available for this task-level connection.</p>}
        <section className="evolution-sources"><h3>Original source passages</h3><p className="evolution-observation">Published {date(item.observation_period.from)}–{date(item.observation_period.to)} · collected {date(item.source.collected_at)}</p><ul>{item.evidence.map((row) => <li key={row.id}><a href={row.url} target="_blank" rel="noreferrer">{row.title} ↗</a><small>{row.company} · {row.source} · {date(row.published_at)}</small><div className="evolution-quotes"><blockquote><span>Existing skill or task</span>“{row.source_quote}”</blockquote><blockquote><span>AI work</span>“{row.ai_quote}”</blockquote></div></li>)}</ul></section>
        <div className="evolution-limits"><strong>What this does not establish</strong><p>{item.cached_model_explanation?.limitation || item.limitations}</p><p>{item.source.scope}. Interpretations are not an employer-wide requirement.</p></div>
      </div>
    </div>
  </dialog>;
}

function ExploreDrawer({ item, dialogRef, onClose }: {
  item: ExploreItem | null; dialogRef: RefObject<HTMLDialogElement | null>; onClose: () => void;
}) {
  if (!item) return null;
  return <dialog ref={dialogRef} className="evolution-drawer" aria-labelledby="explore-drawer-title" onClose={onClose}>
    <div className="evolution-drawer-inner">
      <header className="evolution-drawer-head"><div><span>Observed in the remote-job sample</span><h2 id="explore-drawer-title">{item.name}</h2></div><button type="button" className="evolution-close" aria-label="Close evidence" onClick={() => dialogRef.current?.close()}>×</button></header>
      <div className="evolution-drawer-body">
        <section><h3>What it involves</h3><p>{item.definition}</p></section>
        <section><h3>Where it appears</h3><p>{item.roles.join(" · ")}</p></section>
        <section className="evolution-measure"><h3>Posting sample</h3>{item.metric.kind === "posting_prevalence" ?
          <><div className="evolution-measure-line"><strong>{item.metric.numerator} of {item.metric.denominator}</strong><span>unique retained remote postings mention this capability.</span></div><div className="evolution-measure-bars" role="img" aria-label={`${item.metric.numerator} of ${item.metric.denominator} postings mention ${item.name}`}><div><span>Mentions</span><i><b style={{ width: `${item.metric.numerator / item.metric.denominator * 100}%` }} /></i><strong>{item.metric.numerator}</strong></div></div></> :
          <p>{item.metric.earlier.numerator} of {item.metric.earlier.denominator} postings ({date(item.metric.earlier.from)}–{date(item.metric.earlier.to)}); {item.metric.recent.numerator} of {item.metric.recent.denominator} ({date(item.metric.recent.from)}–{date(item.metric.recent.to)}). {item.metric.percentage_points > 0 ? "+" : ""}{item.metric.percentage_points} percentage points.</p>}
          <p>Remote-job sample only; a mention does not establish skill demand or adoption.</p></section>
        {item.tasks.length > 0 && <section><h3>Work tasks mentioned</h3><ul className="evolution-task-list">{item.tasks.map((task) => <li key={task}>{task}</li>)}</ul></section>}
        <section className="evolution-sources"><h3>Original passages</h3><p className="evolution-observation">Collected {date(item.source.collected_at)}</p><ul>{item.evidence.map((row) => <li key={row.id}><a href={row.url} target="_blank" rel="noreferrer">{row.title} ↗</a><small>{row.company} · {date(row.published_at)}</small><div className="evolution-quotes"><blockquote>“{row.ai_quote}”</blockquote></div></li>)}</ul></section>
        <div className="evolution-limits"><strong>Source scope</strong><p>{item.source.scope}. This sample is not a global or Malaysian labour-market estimate.</p></div>
      </div>
    </div>
  </dialog>;
}

export default function SignalsPage() {
  const [ready, setReady] = useState(false), [sampleId, setSampleId] = useState("cs-student"), [savedId, setSavedId] = useState("");
  const [useSaved, setUseSaved] = useState(false), [samples, setSamples] = useState<{ id: string; label: string }[]>([]);
  const [data, setData] = useState<Experience | null>(null), [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [opened, setOpened] = useState<Connection | null>(null);
  const [view, setView] = useState<"personal" | "explore">("personal");
  const [explore, setExplore] = useState<Exploration | null>(null), [exploreLoading, setExploreLoading] = useState(false);
  const [exploreError, setExploreError] = useState(""), [openedExplore, setOpenedExplore] = useState<ExploreItem | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const requestRef = useRef<AbortController | null>(null), dialogRef = useRef<HTMLDialogElement>(null), openerRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("aiversecity.synthetic-profile-id");
      if (saved) setSavedId(saved);
      const sample = localStorage.getItem("pathwaay.sample-id");
      if (sample) setSampleId(sample);
      if (saved && localStorage.getItem("pathwaay.profile-mode") === "saved") setUseSaved(true);
    } catch { /* Default sample remains available. */ }
    setReady(true);
  }, []);
  useEffect(() => { const onScroll = () => setScrolled(window.scrollY > 16); window.addEventListener("scroll", onScroll, { passive: true }); return () => window.removeEventListener("scroll", onScroll); }, []);
  useEffect(() => {
    if (view !== "explore" || explore) return;
    const controller = new AbortController();
    setExploreLoading(true); setExploreError("");
    fetch("/api/trends/explore-ai-skills", { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error("The saved source sample is unavailable."); return response.json() as Promise<Exploration>; })
      .then((result) => { if (!controller.signal.aborted) setExplore(result); })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setExploreError(reason instanceof Error ? reason.message : "Exploration is unavailable."); })
      .finally(() => { if (!controller.signal.aborted) setExploreLoading(false); });
    return () => controller.abort();
  }, [view, explore]);
  useEffect(() => {
    if (!ready) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setData(null); setSelectedSkillId(null); setError(""); setLoading(true);
    const params = new URLSearchParams(useSaved && savedId ? { profile_id: savedId } : { sample_id: sampleId });
    fetch(`/api/trends/connections?${params}`, { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(response.status === 404 ? "That saved profile is unavailable. Select a sample profile to continue." : "Saved evidence could not be loaded."); return response.json() as Promise<Experience>; })
      .then((result) => { if (!controller.signal.aborted) { setData(result); setSamples(result.samples); setSelectedSkillId(result.selected_skill_id); } })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Saved evidence could not be loaded."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [ready, sampleId, savedId, useSaved]);
  function chooseSkill(skillId: string) {
    if (!data || selectedSkillId === skillId) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    dialogRef.current?.close();
    setSelectedSkillId(skillId); setError(""); setLoading(true);
    const params = new URLSearchParams(useSaved && savedId ? { profile_id: savedId, skill_id: skillId } : { sample_id: sampleId, skill_id: skillId });
    fetch(`/api/trends/connections?${params}`, { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error("This skill’s saved connections could not be loaded."); return response.json() as Promise<Experience>; })
      .then((result) => { if (!controller.signal.aborted) setData(result); })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Saved evidence could not be loaded."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
  }
  function changeProfile(choice: string) {
    dialogRef.current?.close(); requestRef.current?.abort(); setData(null); setOpened(null); setSelectedSkillId(null);
    setUseSaved(choice === "saved"); if (choice !== "saved") setSampleId(choice);
    try { localStorage.setItem("pathwaay.profile-mode", choice === "saved" ? "saved" : "sample"); if (choice !== "saved") localStorage.setItem("pathwaay.sample-id", choice); } catch { /* Selection remains active. */ }
  }
  function openEvidence(item: Connection, event: MouseEvent<HTMLButtonElement>) { openerRef.current = event.currentTarget; setOpened(item); }
  function openExploreEvidence(item: ExploreItem, event: MouseEvent<HTMLButtonElement>) { openerRef.current = event.currentTarget; setOpenedExplore(item); }
  useEffect(() => { if ((opened || openedExplore) && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal(); }, [opened, openedExplore]);
  function closeEvidence() { setOpened(null); setOpenedExplore(null); openerRef.current?.focus(); }
  function chooseView(next: "personal" | "explore") { dialogRef.current?.close(); setOpened(null); setOpenedExplore(null); setView(next); }
  const activeSkill = data?.skills.find((skill) => skill.key === selectedSkillId);
  const showConnections = !loading && data?.selected_skill_id === selectedSkillId;
  return <main className="shell evolution-page"><div className="ambient-layer" aria-hidden="true" /><WorkspaceNav active="signals" scrolled={scrolled} />
    <header className="evolution-header"><div><p className="evolution-kicker">AI TREND SIGNALS</p><h1>Your skills in the AI era</h1><p>Start with a skill you know. See the AI work it may connect to, then inspect the sources.</p>{view === "personal" && data && <div className="evolution-profile-line"><span>{data.profile.occupation}</span><span>{data.profile.synthetic ? "Fictional demo profile" : "Saved profile"}</span></div>}</div>{view === "personal" && <label className="evolution-profile-picker" htmlFor="evolution-profile">Demo profile<select id="evolution-profile" value={useSaved ? "saved" : sampleId} onChange={(event) => changeProfile(event.target.value)}>{savedId && <option value="saved">My saved demo profile</option>}{(samples.length ? samples : [{ id: "cs-student", label: "Computer science student" }]).map((sample) => <option key={sample.id} value={sample.id}>{sample.label}</option>)}</select></label>}</header>
    <div className="evolution-view-tabs" role="tablist" aria-label="AI trend signal views"><button type="button" role="tab" aria-controls="personal-signals" aria-selected={view === "personal"} className={view === "personal" ? "active" : ""} onClick={() => chooseView("personal")}>For your skills</button><button type="button" role="tab" aria-controls="explore-signals" aria-selected={view === "explore"} className={view === "explore" ? "active" : ""} onClick={() => chooseView("explore")}>Explore AI skills</button></div>
    <div id="personal-signals" role="tabpanel" hidden={view !== "personal"}>
      {data && <section className="evolution-skills" aria-labelledby="evolution-skill-title"><div><h2 id="evolution-skill-title">Choose a skill you already have</h2><p>These come from the selected profile.</p></div><div className="evolution-chips">{data.skills.map((skill) => <button type="button" key={skill.key} aria-pressed={selectedSkillId === skill.key} className={selectedSkillId === skill.key ? "active" : ""} onClick={() => chooseSkill(skill.key)}>{skill.name}{skill.connection_count > 0 && <span aria-label={`${skill.connection_count} supported connections`}>{skill.connection_count}</span>}</button>)}</div></section>}
      {loading && <div className="evolution-loading" role="status" aria-label="Loading supported connections"><span /><span /></div>}
      {error && <div className="evolution-error" role="alert"><strong>Connections are unavailable.</strong><p>{error}</p>{!data && <button type="button" onClick={() => changeProfile("cs-student")}>Use computer science sample</button>}</div>}
      {showConnections && data && <section className="evolution-results" aria-labelledby="evolution-results-title"><div className="evolution-results-title"><div><h2 id="evolution-results-title">{activeSkill ? `Where ${activeSkill.name} connects` : "Your skill connections"}</h2><p>Supported links from the saved source sample. These are possible work applications, not forecasts.</p></div><span>{data.connections.length} supported {data.connections.length === 1 ? "connection" : "connections"}</span></div>
        {data.connections.length ? <div className="evolution-grid">{data.connections.map((item) => <ConnectionCard key={item.id} item={item} onOpen={(event) => openEvidence(item, event)} />)}</div> : <div className="evolution-empty"><h3>No supported AI connection for this skill yet.</h3><p>{data.coverage === "queued" ? "Evidence review is queued for this skill. " : ""}The saved sample does not yet support a work-change claim. This does not mean the skill has no future use.</p></div>}
      </section>}
      {data && <footer className="evolution-footer"><span>{data.source_state.cache_fallback ? "Using the last successful source · " : ""}Remote OK collected {date(data.source_state.collected_at)} · {data.source_state.posting_sample_size} retained posts</span><details><summary>How connections are checked</summary><p>{data.method} Exact supporting passages and dates appear in each evidence panel. RunPod is only used in bounded background work when configured.</p></details></footer>}
    </div>
    <div id="explore-signals" role="tabpanel" hidden={view !== "explore"}>
      {exploreLoading && <div className="evolution-loading" role="status" aria-label="Loading AI skills"><span /><span /></div>}
      {exploreError && <div className="evolution-error" role="alert">{exploreError}</div>}
      {explore && <section className="evolution-results" aria-labelledby="explore-title"><div className="evolution-results-title"><div><h2 id="explore-title">{explore.title}</h2><p>{explore.source_scope} · collected {date(explore.collected_at)}. Mentions are not a labour-market forecast.</p></div><span>{explore.items.length} observed skills</span></div>
        {explore.items.length ? <div className="evolution-explore-list">{explore.items.map((item) => <article className="evolution-explore-row" key={item.id}><div><h3>{item.name}</h3><p>{item.definition}</p><small>{item.roles.slice(0, 2).join(" · ")}</small></div><div className="evolution-explore-stat">{item.metric.kind === "posting_prevalence" ? <><strong>{item.metric.numerator} / {item.metric.denominator}</strong><span>postings</span><i aria-hidden="true"><b style={{ width: `${item.metric.numerator / item.metric.denominator * 100}%` }} /></i></> : <><strong>{item.metric.percentage_points > 0 ? "+" : ""}{item.metric.percentage_points} pp</strong><span>{item.metric.recent.numerator}/{item.metric.recent.denominator} recent</span></>}</div><button type="button" className="evolution-evidence-action" onClick={(event) => openExploreEvidence(item, event)}>View evidence <span aria-hidden="true">↗</span></button></article>)}</div> : <div className="evolution-empty"><h3>No measured AI skills yet.</h3><p>The saved postings do not contain enough explicit AI-skill mentions for this view.</p></div>}
      </section>}
    </div>
    <EvidenceDrawer item={opened} dialogRef={dialogRef} onClose={closeEvidence} />
    <ExploreDrawer item={openedExplore} dialogRef={dialogRef} onClose={closeEvidence} />
  </main>;
}

"use client";

import { type MouseEvent, type RefObject, useEffect, useRef, useState } from "react";
import WorkspaceNav from "../WorkspaceNav";
import "./trend-signals.css";

type Skill = { id: string | null; key: string; name: string; connection_count: number };
type Evidence = {
  id: string; title: string; company: string; url: string; published_at: string;
  date_kind?: string; source_quote: string; ai_quote: string; source: string;
};
type Connection = {
  id: string; current_skill_id: string; current_skill_name: string;
  ai_skill: { id: string; name: string; definition: string };
  relationship: "builds_on" | "changes_workflow" | "may_automate_task" | "co_occurs";
  work_task: string; explanation: string; interpretation_origin: string;
  relevance: string; in_occupation_scope: boolean; stale: boolean;
  basis: "same_posting" | "same_task_passage";
  metric: { numerator: number; denominator: number; unit: string } | null;
  employer_count: number; evidence: Evidence[]; limitations: string;
  observation_period: { from: string; to: string };
  source: { name: string; collected_at: string | null; scope: string; date_kind?: string };
  cached_model_explanation: { explanation: string; model: string; limitation: string } | null;
  profile_guidance: { explanation: string; evidence_ids: string[]; model: string } | null;
  research_context: { topic: string; observations: { year: number; count: number }[];
    source_url: string; measurement: string; limitations: string } | null;
};
type Experience = {
  profile: { id: string; occupation: string; synthetic: boolean };
  selected_skill_id: string | null; skills: Skill[]; connections: Connection[];
  samples: { id: string; label: string }[];
  source_state: { name: string; posting_status: string; collected_at: string | null; posting_sample_size: number; cache_fallback: boolean };
  method: string; coverage: string;
};
type ExploreItem = {
  id: string; name: string; definition: string; roles: string[]; tasks: string[];
  metric: { kind: "posting_prevalence"; numerator: number; denominator: number; unit: string } |
    { kind: "posting_share_change"; earlier: { numerator: number; denominator: number; from: string; to: string };
      recent: { numerator: number; denominator: number; from: string; to: string }; percentage_points: number };
  evidence: Evidence[]; source: { name: string; collected_at: string | null; scope: string; date_kind?: string };
};
type Exploration = { mode: "most_mentioned" | "rising"; title: string; sample_size: number;
  collected_at: string | null; source_scope: string; items: ExploreItem[] };
function date(value: string | null) {
  if (!value) return "not collected";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
function Arrow() { return <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 16h23m-8-8 8 8-8 8" /></svg>; }

function ConnectionCard({ item, onOpen }: { item: Connection; onOpen: (event: MouseEvent<HTMLButtonElement>) => void }) {
  return <article className="evolution-card">
    <div className="evolution-card-top"><span>Possible task link</span><span>{item.stale ? "Older saved source" : item.source.name + " · " + date(item.source.collected_at)}</span></div>
    <div className="evolution-pair"><span>{item.current_skill_name}</span><Arrow /><strong>{item.ai_skill.name}</strong></div>
    <div className="evolution-card-explanation"><span className="evolution-interpretation-label">Task example in {item.evidence[0]?.title || "a cited role"} · {item.evidence.length} {item.evidence.length === 1 ? "source" : "sources"}</span><p>{item.profile_guidance?.explanation || item.work_task}</p>{!item.in_occupation_scope && <small className="evolution-scope">This job example may be outside your occupation.</small>}</div>
    <button type="button" className="evolution-evidence-action" onClick={onOpen}>View evidence <span aria-hidden="true">↗</span></button>
  </article>;
}
function EvidenceDrawer({ item, dialogRef, onClose }: {
  item: Connection | null; dialogRef: RefObject<HTMLDialogElement | null>; onClose: () => void;
}) {
  if (!item) return null;
  const research = item.research_context;
  return <dialog ref={dialogRef} className="evolution-drawer" aria-labelledby="evolution-drawer-title" onClose={onClose}>
    <div className="evolution-drawer-inner">
      <header className="evolution-drawer-head"><div><span>Evidence for this connection</span><h2 id="evolution-drawer-title">{item.current_skill_name} <span aria-hidden="true">→</span> {item.ai_skill.name}</h2></div><button type="button" className="evolution-close" aria-label="Close evidence" onClick={() => dialogRef.current?.close()}>×</button></header>
      <div className="evolution-drawer-body">
        <section><h3>What this AI task involves</h3><p>{item.ai_skill.definition}</p></section>
        <section className="evolution-guidance"><h3>{item.profile_guidance ? "What this could mean for your work" : "What the passage supports"}</h3><p>{item.profile_guidance?.explanation || item.explanation}</p><small>{item.profile_guidance ? `Model interpretation · ${item.profile_guidance.model} · checked against cited evidence` : "A profile-specific interpretation has not been reviewed; this is a source observation."}</small>{!item.in_occupation_scope && <small>The cited role may be outside your occupation.</small>}</section>
        <section className="evolution-sources"><h3>Job-task evidence</h3><p className="evolution-observation">{item.source.name} · {item.source.date_kind === "last_updated" ? "listings updated" : "published"} {date(item.observation_period.from)}–{date(item.observation_period.to)} · collected {date(item.source.collected_at)}</p><ul>{item.evidence.map((row) => <li key={row.id}><a href={row.url} target="_blank" rel="noreferrer">{row.title} ↗</a><small>{row.company} · {row.source} · {row.date_kind === "last_updated" ? "updated " : "published "}{date(row.published_at)}</small><blockquote className="evolution-task-quote">“{row.ai_quote}”</blockquote></li>)}</ul></section>
        {research && <section className="evolution-research"><h3>Research activity: {research.topic}</h3><p>OpenAlex indexed works matching this topic by publication year. This does not measure job demand.</p><div className="evolution-research-years">{research.observations.slice(-5).map((row) => <div key={row.year}><span>{row.year}</span><strong>{row.count.toLocaleString()}</strong></div>)}</div><a href={research.source_url} target="_blank" rel="noreferrer">View OpenAlex query ↗</a><small>{research.limitations}</small></section>}
        <div className="evolution-limits evolution-conclusion"><strong>Conclusion & evidence limits</strong><p>{item.cached_model_explanation?.limitation || item.limitations}</p><p>{item.source.scope}. This is a snapshot of source passages, not proof of causation, skill replacement, demand growth or an employer-wide requirement. {item.employer_count} distinct {item.employer_count === 1 ? "employer" : "employers"} contributed support.</p>{!item.in_occupation_scope && <p>These source roles may be outside the selected profile’s occupation.</p>}</div>
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
        <section><h3>AI capability definition (reference vocabulary)</h3><p>{item.definition}</p></section>
        <section><h3>Where it appears</h3><p>{item.roles.join(" · ")}</p></section>
        <section className="evolution-measure"><h3>Observed mentions</h3>{item.metric.kind === "posting_prevalence" ?
          <><div className="evolution-measure-line"><strong>{item.metric.numerator} of {item.metric.denominator}</strong><span>unique retained remote postings mention this capability.</span></div><div className="evolution-measure-bars" role="img" aria-label={`${item.metric.numerator} of ${item.metric.denominator} postings mention ${item.name}`}><div><span>Mentions</span><i><b style={{ width: `${item.metric.numerator / item.metric.denominator * 100}%` }} /></i><strong>{item.metric.numerator}</strong></div></div></> :
          <p>{item.metric.earlier.numerator} of {item.metric.earlier.denominator} postings ({date(item.metric.earlier.from)}–{date(item.metric.earlier.to)}); {item.metric.recent.numerator} of {item.metric.recent.denominator} ({date(item.metric.recent.from)}–{date(item.metric.recent.to)}). {item.metric.percentage_points > 0 ? "+" : ""}{item.metric.percentage_points} percentage points.</p>}
          </section>
        {item.tasks.length > 0 && <section><h3>Work tasks mentioned</h3><ul className="evolution-task-list">{item.tasks.map((task) => <li key={task}>{task}</li>)}</ul></section>}
        <section className="evolution-sources"><h3>Original passages</h3><p className="evolution-observation">Collected {date(item.source.collected_at)}</p><ul>{item.evidence.map((row) => <li key={row.id}><a href={row.url} target="_blank" rel="noreferrer">{row.title} ↗</a><small>{row.company} · {row.date_kind === "last_updated" ? "updated " : "published "}{date(row.published_at)}</small><div className="evolution-quotes"><blockquote>“{row.ai_quote}”</blockquote></div></li>)}</ul></section>
        <div className="evolution-limits evolution-conclusion"><strong>Conclusion & data limits</strong><p>{item.source.scope}. The sampled postings show mentions, not measured global or Malaysian demand, adoption, growth or decline.</p></div>
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
    <header className="evolution-header"><div><p className="evolution-kicker">AI TREND SIGNALS</p><h1>AI tasks related to your skills</h1><p>Choose a skill from your profile. See a possible work application and the job passage behind it.</p>{view === "personal" && data && <div className="evolution-profile-line"><span>{data.profile.occupation}</span><span>{data.profile.synthetic ? "Fictional demo profile" : "Saved profile"}</span></div>}</div>{view === "personal" && <label className="evolution-profile-picker" htmlFor="evolution-profile">Demo profile<select id="evolution-profile" value={useSaved ? "saved" : sampleId} onChange={(event) => changeProfile(event.target.value)}>{savedId && <option value="saved">My saved demo profile</option>}{(samples.length ? samples : [{ id: "cs-student", label: "Computer science student" }]).map((sample) => <option key={sample.id} value={sample.id}>{sample.label}</option>)}</select></label>}</header>
    <div className="evolution-view-tabs" role="tablist" aria-label="AI trend signal views"><button type="button" role="tab" aria-controls="personal-signals" aria-selected={view === "personal"} className={view === "personal" ? "active" : ""} onClick={() => chooseView("personal")}>For your skills</button><button type="button" role="tab" aria-controls="explore-signals" aria-selected={view === "explore"} className={view === "explore" ? "active" : ""} onClick={() => chooseView("explore")}>Explore AI skills</button></div>
    <div id="personal-signals" role="tabpanel" hidden={view !== "personal"}>
      {data && <section className="evolution-skills" aria-labelledby="evolution-skill-title"><div><h2 id="evolution-skill-title">Choose a skill you already have</h2><p>These come from the selected profile.</p></div><div className="evolution-chips">{data.skills.map((skill) => <button type="button" key={skill.key} aria-pressed={selectedSkillId === skill.key} className={selectedSkillId === skill.key ? "active" : ""} onClick={() => chooseSkill(skill.key)}>{skill.name}{skill.connection_count > 0 && <span aria-label={`${skill.connection_count} supported connections`}>{skill.connection_count}</span>}</button>)}</div></section>}
      {loading && <div className="evolution-loading" role="status" aria-label="Loading supported connections"><span /><span /></div>}
      {error && <div className="evolution-error" role="alert"><strong>Connections are unavailable.</strong><p>{error}</p>{!data && <button type="button" onClick={() => changeProfile("cs-student")}>Use computer science sample</button>}</div>}
      {showConnections && data && <section className="evolution-results" aria-labelledby="evolution-results-title"><div className="evolution-results-title"><div><h2 id="evolution-results-title">{activeSkill ? `Where ${activeSkill.name} connects` : "Your skill connections"}</h2><p>Each link has an exact job-task passage naming both skills. It is a possible application, not a prediction.</p></div><span>{data.connections.length} task-level {data.connections.length === 1 ? "link" : "links"}</span></div>
        {data.connections.length ? <div className="evolution-grid">{data.connections.map((item) => <ConnectionCard key={item.id} item={item} onOpen={(event) => openEvidence(item, event)} />)}</div> : <div className="evolution-empty"><h3>No task-level link in the saved sample yet.</h3><p>{data.coverage === "queued" ? "Evidence review is queued for this skill. " : ""}We found no job passage that clearly names this skill with an AI task. This does not mean the skill has no future use.</p></div>}
      </section>}
      {data && <footer className="evolution-footer"><span>{data.source_state.cache_fallback ? "Using the last successful source · " : ""}{data.source_state.name} collected {date(data.source_state.collected_at)} · {data.source_state.posting_sample_size} retained posts</span><details><summary>How connections are checked</summary><p>{data.method} Exact supporting passages and dates appear in each evidence panel. RunPod is only used in bounded background work when configured.</p></details></footer>}
    </div>
    <div id="explore-signals" role="tabpanel" hidden={view !== "explore"}>
      {exploreLoading && <div className="evolution-loading" role="status" aria-label="Loading AI skills"><span /><span /></div>}
      {exploreError && <div className="evolution-error" role="alert">{exploreError}</div>}
      {explore && <section className="evolution-results" aria-labelledby="explore-title"><div className="evolution-results-title"><div><h2 id="explore-title">{explore.title}</h2><p>{explore.source_scope} · collected {date(explore.collected_at)}. Select a capability to inspect the original postings.</p></div><span>{explore.items.length} observed skills</span></div>
        {explore.items.length ? <div className="evolution-explore-list">{explore.items.map((item) => <article className="evolution-explore-row" key={item.id}><div><h3>{item.name}</h3><p className="evolution-explore-definition">{item.definition}</p><small>{item.roles.slice(0, 2).join(" · ")}</small></div><div className="evolution-explore-stat">{item.metric.kind === "posting_prevalence" ? <><strong>{item.metric.numerator} / {item.metric.denominator}</strong><span>postings</span><i aria-hidden="true"><b style={{ width: `${item.metric.numerator / item.metric.denominator * 100}%` }} /></i></> : <><strong>{item.metric.percentage_points > 0 ? "+" : ""}{item.metric.percentage_points} pp</strong><span>{item.metric.recent.numerator}/{item.metric.recent.denominator} recent</span></>}</div><button type="button" className="evolution-evidence-action" onClick={(event) => openExploreEvidence(item, event)}>View evidence <span aria-hidden="true">↗</span></button></article>)}</div> : <div className="evolution-empty"><h3>No measured AI skills yet.</h3><p>The saved postings do not contain enough explicit AI-skill mentions for this view.</p></div>}
      </section>}
    </div>
    <EvidenceDrawer item={opened} dialogRef={dialogRef} onClose={closeEvidence} />
    <ExploreDrawer item={openedExplore} dialogRef={dialogRef} onClose={closeEvidence} />
  </main>;
}

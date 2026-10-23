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
type ResearchObservation = { period_year: number; value: number };
type ResearchTopic = { topic_id: string; label: string; source_url: string | null;
  observations: ResearchObservation[]; change: { status: string; percentage_change: number | null; compared_years: number[] | null } };
type ResearchDashboard = { topics: ResearchTopic[]; last_successful_refresh: string | null; cache_fallback: boolean };
type RankedResearch = { id: string; label: string; sourceUrl: string; previous: ResearchObservation;
  latest: ResearchObservation; growth: number };
function rankResearch(data: ResearchDashboard | null): RankedResearch[] {
  if (!data) return [];
  return data.topics.flatMap((topic) => {
    const years = topic.change.compared_years;
    if (topic.change.status !== "available" || !years || years.length !== 2 ||
        topic.change.percentage_change === null || !topic.source_url) return [];
    const previous = topic.observations.find((row) => row.period_year === years[0]);
    const latest = topic.observations.find((row) => row.period_year === years[1]);
    return previous && latest ? [{ id: topic.topic_id, label: topic.label, sourceUrl: topic.source_url,
      previous, latest, growth: topic.change.percentage_change }] : [];
  }).sort((a, b) => b.growth - a.growth);
}
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
    <div className="evolution-card-explanation"><span className="evolution-interpretation-label">{item.evidence[0]?.title || "Cited role"}</span><p>{item.work_task}</p></div>
    <button type="button" className="evolution-evidence-action" onClick={onOpen}>View evidence <span aria-hidden="true">↗</span></button>
  </article>;
}
function EvidenceDrawer({ item, dialogRef, onClose }: {
  item: Connection | null; dialogRef: RefObject<HTMLDialogElement | null>; onClose: () => void;
}) {
  if (!item) return null;
  return <dialog ref={dialogRef} className="evolution-drawer" aria-labelledby="evolution-drawer-title" onClose={onClose}>
    <div className="evolution-drawer-inner">
      <header className="evolution-drawer-head"><div><span>Evidence for this connection</span><h2 id="evolution-drawer-title">{item.current_skill_name} <span aria-hidden="true">→</span> {item.ai_skill.name}</h2></div><button type="button" className="evolution-close" aria-label="Close evidence" onClick={() => dialogRef.current?.close()}>×</button></header>
      <div className="evolution-drawer-body">
        <section><h3>About the AI task</h3><p>{item.ai_skill.definition}</p></section>
        <section className="evolution-guidance"><h3>For your work</h3><p>{item.profile_guidance?.explanation || "Wait for RunPod LLM text"}</p>{item.profile_guidance && <small>RunPod interpretation · checked against cited evidence</small>}</section>
        <section className="evolution-sources"><h3>Job evidence</h3><p className="evolution-observation">{item.source.name} · collected {date(item.source.collected_at)}</p><ul>{item.evidence.map((row) => <li key={row.id}><a href={row.url} target="_blank" rel="noreferrer">{row.title} ↗</a><small>{row.company} · {row.date_kind === "last_updated" ? "updated " : "published "}{date(row.published_at)}</small><blockquote className="evolution-task-quote">“{row.ai_quote}”</blockquote></li>)}</ul></section>
        <div className="evolution-limits evolution-conclusion"><strong>What the evidence means</strong><p>{item.in_occupation_scope ? "This job task names both skills" : "This job task names both skills, but may be outside your occupation"}. It shows a possible application, not a prediction of your career or wider job demand.</p></div>
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
  const [explore, setExplore] = useState<ResearchDashboard | null>(null), [exploreLoading, setExploreLoading] = useState(false);
  const [exploreError, setExploreError] = useState("");
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
    fetch("/api/trends", { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error("Saved research counts are unavailable."); return response.json() as Promise<ResearchDashboard>; })
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
  useEffect(() => { if (opened && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal(); }, [opened]);
  function closeEvidence() { setOpened(null); openerRef.current?.focus(); }
  function chooseView(next: "personal" | "explore") { dialogRef.current?.close(); setOpened(null); setView(next); }
  const activeSkill = data?.skills.find((skill) => skill.key === selectedSkillId);
  const showConnections = !loading && data?.selected_skill_id === selectedSkillId;
  const rankedResearch = rankResearch(explore);
  const maxGrowth = Math.max(1, ...rankedResearch.map((row) => Math.max(row.growth, 0)));
  return <main className="shell evolution-page"><div className="ambient-layer" aria-hidden="true" /><WorkspaceNav active="signals" scrolled={scrolled} />
    <header className="evolution-header"><div><p className="evolution-kicker">AI TREND SIGNALS</p><h1>{view === "personal" ? "Your skills in the AI era" : "Explore AI research"}</h1><p>{view === "personal" ? "See how a skill you know connects to AI work." : "See which tracked topics gained research attention."}</p>{view === "personal" && data && <div className="evolution-profile-line"><span>{data.profile.occupation}</span><span>{data.profile.synthetic ? "Fictional demo profile" : "Saved profile"}</span></div>}</div>{view === "personal" && <label className="evolution-profile-picker" htmlFor="evolution-profile">Demo profile<select id="evolution-profile" value={useSaved ? "saved" : sampleId} onChange={(event) => changeProfile(event.target.value)}>{savedId && <option value="saved">My saved demo profile</option>}{(samples.length ? samples : [{ id: "cs-student", label: "Computer science student" }]).map((sample) => <option key={sample.id} value={sample.id}>{sample.label}</option>)}</select></label>}</header>
    <div className="evolution-view-tabs" role="tablist" aria-label="AI trend signal views"><button type="button" role="tab" aria-controls="personal-signals" aria-selected={view === "personal"} className={view === "personal" ? "active" : ""} onClick={() => chooseView("personal")}>For your skills</button><button type="button" role="tab" aria-controls="explore-signals" aria-selected={view === "explore"} className={view === "explore" ? "active" : ""} onClick={() => chooseView("explore")}>Explore AI skills</button></div>
    <div id="personal-signals" role="tabpanel" hidden={view !== "personal"}>
      {data && <section className="evolution-skills" aria-labelledby="evolution-skill-title"><h2 id="evolution-skill-title">Choose your skill</h2><div className="evolution-chips">{data.skills.map((skill) => <button type="button" key={skill.key} aria-pressed={selectedSkillId === skill.key} className={selectedSkillId === skill.key ? "active" : ""} onClick={() => chooseSkill(skill.key)}>{skill.name}{skill.connection_count > 0 && <span aria-label={`${skill.connection_count} supported connections`}>{skill.connection_count}</span>}</button>)}</div></section>}
      {loading && <div className="evolution-loading" role="status" aria-label="Loading supported connections"><span /><span /></div>}
      {error && <div className="evolution-error" role="alert"><strong>Connections are unavailable.</strong><p>{error}</p>{!data && <button type="button" onClick={() => changeProfile("cs-student")}>Use computer science sample</button>}</div>}
      {showConnections && data && <section className="evolution-results" aria-labelledby="evolution-results-title"><div className="evolution-results-title"><h2 id="evolution-results-title">{activeSkill ? `Where ${activeSkill.name} connects` : "Your skill connections"}</h2><span>{data.connections.length} {data.connections.length === 1 ? "connection" : "connections"}</span></div>
        {data.connections.length ? <div className="evolution-grid">{data.connections.map((item) => <ConnectionCard key={item.id} item={item} onOpen={(event) => openEvidence(item, event)} />)}</div> : <div className="evolution-empty"><h3>No task-level link in the saved sample yet.</h3><p>{data.coverage === "queued" ? "Evidence review is queued for this skill. " : ""}We found no job passage that clearly names this skill with an AI task. This does not mean the skill has no future use.</p></div>}
      </section>}
      {data && <footer className="evolution-footer"><span>{data.source_state.cache_fallback ? "Last saved sample · " : ""}{data.source_state.name} · {date(data.source_state.collected_at)} · {data.source_state.posting_sample_size} posts</span><details><summary>How connections are checked</summary><p>{data.method}</p></details></footer>}
    </div>
    <div id="explore-signals" role="tabpanel" hidden={view !== "explore"}>
      {exploreLoading && <div className="evolution-loading" role="status" aria-label="Loading AI skills"><span /><span /></div>}
      {exploreError && <div className="evolution-error" role="alert">{exploreError}</div>}
      {explore && <section className="evolution-results evolution-research" aria-labelledby="explore-title"><div className="evolution-results-title"><h2 id="explore-title">Research publication growth</h2><span>{rankedResearch.length} tracked topics</span></div>
        {rankedResearch.length ? <div className="evolution-research-chart" role="list" aria-label="OpenAlex research publications ranked by growth">{rankedResearch.map((row) => <div className="evolution-research-row" role="listitem" key={row.id}><div className="evolution-research-heading"><h3>{row.label}</h3><strong>{row.growth > 0 ? "+" : ""}{Math.round(row.growth)}%</strong></div><div className="evolution-research-track" aria-hidden="true"><span style={{ width: `${Math.max(1, Math.max(0, row.growth) / maxGrowth * 100)}%` }} /></div><div className="evolution-research-detail"><span>{row.previous.period_year}: {row.previous.value.toLocaleString()} → {row.latest.period_year}: {row.latest.value.toLocaleString()} publications</span><a href={row.sourceUrl} target="_blank" rel="noreferrer">OpenAlex query ↗</a></div></div>)}</div> : <div className="evolution-empty"><h3>No comparable research years available.</h3><p>The saved OpenAlex data cannot support a year-to-year comparison yet.</p></div>}
        <footer className="evolution-research-footer"><span>{explore.cache_fallback ? "Last saved OpenAlex result" : "OpenAlex"} · refreshed {date(explore.last_successful_refresh)}</span><p>Publication counts for selected search topics; not a measure of job demand or skill use. Topics can overlap.</p></footer>
      </section>}
    </div>
    <EvidenceDrawer item={opened} dialogRef={dialogRef} onClose={closeEvidence} />
  </main>;
}

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
  basis: "same_posting" | "shared_data_task";
  metric: { numerator: number; denominator: number; unit: string } | null;
  employer_count: number; evidence: Evidence[]; limitations: string;
  observation_period: { from: string; to: string };
  source: { name: string; collected_at: string | null; scope: string };
  cached_model_explanation: { explanation: string; model: string } | null;
};
type Experience = {
  profile: { id: string; occupation: string; synthetic: boolean };
  selected_skill_id: string | null; skills: Skill[]; connections: Connection[];
  samples: { id: string; label: string }[];
  source_state: { posting_status: string; collected_at: string | null; posting_sample_size: number; cache_fallback: boolean };
  method: string;
};
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
    {!item.in_occupation_scope && <small className="evolution-scope">Evidence comes from software roles, outside this profile’s occupation.</small>}
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
        <section><h3>How it connects to your work</h3><p><strong>{item.work_task}.</strong> {item.cached_model_explanation?.explanation || item.explanation}</p><small>{item.cached_model_explanation ? `Optional AI wording · ${item.cached_model_explanation.model}` : "Reviewed interpretation · not a forecast"}</small></section>
        {metric && <section className="evolution-measure"><h3>What this sample measures</h3><div className="evolution-measure-line"><strong>{metric.numerator} of {metric.denominator}</strong><span>{metric.unit} mentioning the existing skill also contain both supporting passages.</span></div><div className="evolution-measure-bars" role="img" aria-label={`${metric.numerator} of ${metric.denominator} unique postings have both passages; ${metric.denominator - metric.numerator} mention the existing skill without this connection`}><div><span>Both passages</span><i><b style={{ width: `${metric.numerator / metric.denominator * 100}%` }} /></i><strong>{metric.numerator}</strong></div><div><span>Existing skill only</span><i><b style={{ width: `${(metric.denominator - metric.numerator) / metric.denominator * 100}%` }} /></i><strong>{metric.denominator - metric.numerator}</strong></div></div><p>One posting snapshot, not a trend or statistical correlation. {item.employer_count} distinct {item.employer_count === 1 ? "employer" : "employers"} support this connection.</p></section>}
        {!metric && <p className="evolution-unmeasured">No defensible pairing count is available for this task-level connection.</p>}
        <section className="evolution-sources"><h3>Original source passages</h3><p className="evolution-observation">Published {date(item.observation_period.from)}–{date(item.observation_period.to)} · collected {date(item.source.collected_at)}</p><ul>{item.evidence.map((row) => <li key={row.id}><a href={row.url} target="_blank" rel="noreferrer">{row.title} ↗</a><small>{row.company} · {row.source} · {date(row.published_at)}</small><div className="evolution-quotes"><blockquote><span>Existing skill or task</span>“{row.source_quote}”</blockquote><blockquote><span>AI work</span>“{row.ai_quote}”</blockquote></div></li>)}</ul></section>
        <div className="evolution-limits"><strong>What this does not establish</strong><p>{item.limitations}</p><p>{item.source.scope}. The work implication is a reviewed interpretation, not an employer-wide requirement.</p></div>
      </div>
    </div>
  </dialog>;
}

export default function SignalsPage() {
  const [ready, setReady] = useState(false), [sampleId, setSampleId] = useState("cs-student"), [savedId, setSavedId] = useState("");
  const [useSaved, setUseSaved] = useState(false), [samples, setSamples] = useState<{ id: string; label: string }[]>([]);
  const [data, setData] = useState<Experience | null>(null), [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [opened, setOpened] = useState<Connection | null>(null);
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
  const activeSkill = data?.skills.find((skill) => skill.key === selectedSkillId);
  const showConnections = !loading && data?.selected_skill_id === selectedSkillId;
  return <main className="shell evolution-page"><div className="ambient-layer" aria-hidden="true" /><WorkspaceNav active="signals" scrolled={scrolled} />
    <header className="evolution-header"><div><p className="evolution-kicker">AI TREND SIGNALS</p><h1>Your skills in the AI era</h1><p>Start with a skill you know. See the AI work it may connect to, then inspect the sources.</p>{data && <div className="evolution-profile-line"><span>{data.profile.occupation}</span><span>{data.profile.synthetic ? "Fictional demo profile" : "Saved profile"}</span></div>}</div><label className="evolution-profile-picker" htmlFor="evolution-profile">Demo profile<select id="evolution-profile" value={useSaved ? "saved" : sampleId} onChange={(event) => changeProfile(event.target.value)}>{savedId && <option value="saved">My saved demo profile</option>}{(samples.length ? samples : [{ id: "cs-student", label: "Computer science student" }]).map((sample) => <option key={sample.id} value={sample.id}>{sample.label}</option>)}</select></label></header>
    {data && <section className="evolution-skills" aria-labelledby="evolution-skill-title"><div><h2 id="evolution-skill-title">Choose a skill you already have</h2><p>These come from the selected profile.</p></div><div className="evolution-chips">{data.skills.map((skill) => <button type="button" key={skill.key} aria-pressed={selectedSkillId === skill.key} className={selectedSkillId === skill.key ? "active" : ""} onClick={() => chooseSkill(skill.key)}>{skill.name}{skill.connection_count > 0 && <span aria-label={`${skill.connection_count} supported connections`}>{skill.connection_count}</span>}</button>)}</div></section>}
    {loading && <div className="evolution-loading" role="status" aria-label="Loading supported connections"><span /><span /></div>}
    {error && <div className="evolution-error" role="alert"><strong>Connections are unavailable.</strong><p>{error}</p>{!data && <button type="button" onClick={() => changeProfile("cs-student")}>Use computer science sample</button>}</div>}
    {showConnections && data && <section className="evolution-results" aria-labelledby="evolution-results-title"><div className="evolution-results-title"><div><h2 id="evolution-results-title">{activeSkill ? `Where ${activeSkill.name} connects` : "Your skill connections"}</h2><p>Supported links from the saved source sample. These are possible work applications, not forecasts.</p></div><span>{data.connections.length} supported {data.connections.length === 1 ? "connection" : "connections"}</span></div>
      {data.connections.length ? <div className="evolution-grid">{data.connections.map((item) => <ConnectionCard key={item.id} item={item} onOpen={(event) => openEvidence(item, event)} />)}</div> : <div className="evolution-empty"><h3>No supported AI connection for this skill yet.</h3><p>We found no saved job passages strong enough to explain a link. Try another listed skill; this does not mean the skill has no future use.</p></div>}
    </section>}
    {data && <footer className="evolution-footer"><span>{data.source_state.cache_fallback ? "Using the last successful source · " : ""}Remote OK collected {date(data.source_state.collected_at)} · {data.source_state.posting_sample_size} retained posts</span><details><summary>How connections are checked</summary><p>{data.method} Exact supporting passages and dates appear in each evidence panel. Model wording is optional and never runs when this page opens.</p></details></footer>}
    <EvidenceDrawer item={opened} dialogRef={dialogRef} onClose={closeEvidence} />
  </main>;
}

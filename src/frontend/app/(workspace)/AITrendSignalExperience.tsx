"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRegistrationProfile } from "./profile-workspace";
import type { PathwaayRegistrationProfile } from "@/lib/pathwaay-profile";
import "./ai-trend-signal.css";

type Source = { id: string; title: string; company: string; url: string; source: string;
  source_quote?: string; ai_quote?: string; published_at?: string };
type Connection = { id: string; current_skill_name: string; ai_skill: { id: string; name: string; definition: string };
  evidence: Source[]; cached_model_explanation?: { explanation: string } | null; relevance?: string };
type Skill = { id: string | null; key: string; name: string; connection_count: number };
type SignalResponse = { selected_skill_id: string | null; skills: Skill[]; connections: Connection[];
  source_state: { name: string; posting_sample_size: number; posting_status: string } };
type ExploreItem = { id: string; name: string; definition: string; roles: string[]; tasks: string[];
  metric: { kind: string; numerator?: number; denominator?: number }; evidence: Source[] };
type ExploreResponse = { title: string; sample_size: number; source_scope: string; items: ExploreItem[] };
type Guidance = { status: string; explanation?: string; learning_gap?: string; next_step?: string };
export type AISignalView = "personal" | "explore" | "evidence";

function getRequest(profile: PathwaayRegistrationProfile) {
  return {
    // WL2 registration doesn't establish a current occupation. Don't guess one.
    occupation: "", field_of_study: profile.major.slice(0, 120),
    skills: profile.skills.slice(0, 40).map((name) => ({
      name, skill_id: profile.skillLinks?.find((item) => item.name.toLowerCase() === name.toLowerCase())?.skill_id ?? null,
    })).filter((skill) => skill.name.trim()),
    work_tasks: profile.workActivities.split(/[;\n,]+/).map((task) => task.trim()).filter(Boolean).slice(0, 12),
    aspiration: profile.aspiration.slice(0, 240),
  };
}
function secure(url: string | undefined): string | null {
  return url && /^https:\/\/[a-z0-9]/i.test(url) ? url : null;
}
function SourceCard({ source }: { source: Source }) {
  return <article className="ats-source-card" key={source.id}>
    <div className="ats-source-top"><div><strong>{source.title}</strong><span>{source.company} · {source.source}</span></div>
      {secure(source.url) && <a href={secure(source.url)!} target="_blank" rel="noopener noreferrer">Original job ↗</a>}
    </div>
    {source.source_quote && source.source_quote !== source.ai_quote && <div className="ats-quote"><span>SKILL PASSAGE</span><p>{source.source_quote}</p></div>}
    {(source.ai_quote || source.source_quote) && <div className="ats-quote"><span>AI / TASK PASSAGE</span><p>{source.ai_quote || source.source_quote}</p></div>}
  </article>;
}
function EvidenceModal({ name, sources, close }: { name: string; sources: Source[]; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = ref.current;
    node?.showModal();
    return () => { if (node?.open) node.close(); };
  }, []);
  return <dialog className="ats-dialog" ref={ref} onClose={close} aria-label={`Evidence for ${name}`}>
    <div className="ats-modal-header"><div><span className="ats-eyebrow">SUPPORTING EVIDENCE</span><h2>{name}</h2></div>
      <button type="button" className="ats-close" aria-label="Close" onClick={() => ref.current?.close()}>×</button></div>
    <div className="ats-modal-body">{sources.map((source) => <SourceCard key={source.id} source={source}/>)}
      {!sources.length && <p>No original passages were retained for this item.</p>}
      <p className="ats-footer-note">These are examples from sampled remote jobs, not proof of skill transferability or career outcomes.</p>
    </div>
  </dialog>;
}

export default function AITrendSignalExperience({ view }: { view: AISignalView }) {
  const { profile, loading: profileLoading } = useRegistrationProfile();
  const payload = useMemo(() => profile ? getRequest(profile) : null, [profile]);
  const fingerprint = JSON.stringify(payload);
  const [personal, setPersonal] = useState<SignalResponse | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [explore, setExplore] = useState<ExploreResponse | null>(null);
  const [personalLoading, setPersonalLoading] = useState(false);
  const [exploreLoading, setExploreLoading] = useState(false);
  const [personalError, setPersonalError] = useState("");
  const [exploreError, setExploreError] = useState("");
  const [opened, setOpened] = useState<{ name: string; sources: Source[] } | null>(null);
  const [guidance, setGuidance] = useState<Record<string, Guidance>>({});
  const [inferenceBusy, setInferenceBusy] = useState<string | null>(null);
  const [inferenceError, setInferenceError] = useState<Record<string, string>>({});
  const skillRequestRef = useRef<AbortController | null>(null);

  const loadPersonal = useCallback(async (signal: AbortSignal, skillKey?: string) => {
    if (!payload?.skills.length) return null;
    const response = await fetch(`/api/trends/session-connections${skillKey ? `?skill_id=${encodeURIComponent(skillKey)}` : ""}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal, cache: "no-store",
    });
    if (!response.ok) throw new Error("Could not load skill connections from the evidence cache.");
    return await response.json() as SignalResponse;
  }, [fingerprint]);

  useEffect(() => {
    if (!payload?.skills.length || (view !== "personal" && view !== "evidence")) return;
    const controller = new AbortController();
    skillRequestRef.current = controller;
    setPersonalLoading(true); setPersonalError(""); setPersonal(null); setSelectedSkill(null); setGuidance({});
    loadPersonal(controller.signal).then((result) => {
      if (!controller.signal.aborted && result) { setPersonal(result); setSelectedSkill(result.selected_skill_id); }
    }).catch((error: unknown) => { if (!controller.signal.aborted) setPersonalError(error instanceof Error ? error.message : "Unable to load results."); })
      .finally(() => { if (!controller.signal.aborted) setPersonalLoading(false); });
    return () => controller.abort();
  }, [view, loadPersonal, fingerprint]);

  useEffect(() => {
    if ((view !== "explore" && view !== "evidence") || explore) return;
    const controller = new AbortController();
    setExploreLoading(true); setExploreError("");
    fetch("/api/trends/explore-ai-skills", { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("AI skill evidence is unavailable.");
      return await response.json() as ExploreResponse;
    }).then((result) => { if (!controller.signal.aborted) setExplore(result); })
      .catch((error: unknown) => { if (!controller.signal.aborted) setExploreError(error instanceof Error ? error.message : "Unable to load AI skills."); })
      .finally(() => { if (!controller.signal.aborted) setExploreLoading(false); });
    return () => controller.abort();
  }, [view, explore]);

  async function chooseSkill(key: string) {
    if (!payload) return;
    skillRequestRef.current?.abort();
    const controller = new AbortController(); skillRequestRef.current = controller;
    setSelectedSkill(key); setPersonalLoading(true); setPersonalError(""); setGuidance({});
    try {
      const result = await loadPersonal(controller.signal, key);
      if (!controller.signal.aborted && result) setPersonal(result);
    } catch (error) { if (!controller.signal.aborted) setPersonalError(error instanceof Error ? error.message : "Unable to load this skill."); }
    finally { if (!controller.signal.aborted) setPersonalLoading(false); }
  }

  async function generateGuidance(connection: Connection) {
    if (!payload) return;
    setInferenceBusy(connection.id);
    setInferenceError((prior) => ({ ...prior, [connection.id]: "" }));
    try {
      const response = await fetch("/api/trends/session-explanation", {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ profile: payload, connection_id: connection.id }),
      });
      if (!response.ok) throw new Error(response.status === 422 ? "This connection could not be validated for guidance." : "RunPod generation is unavailable.");
      const result = await response.json() as Guidance;
      if (result.status !== "generated") throw new Error(`RunPod: ${result.status.replace(/_/g, " ")}.`);
      setGuidance((prior) => ({ ...prior, [connection.id]: result }));
    } catch (error) { setInferenceError((prior) => ({ ...prior, [connection.id]: error instanceof Error ? error.message : "RunPod is unavailable." })); }
    finally { setInferenceBusy(null); }
  }

  const activeSkill = personal?.skills.find((skill) => skill.key === selectedSkill);
  const evidence = useMemo(() => {
    const sources = new Map<string, Source>();
    for (const item of personal?.connections || []) for (const source of item.evidence || []) sources.set(source.id, source);
    for (const item of explore?.items || []) for (const source of item.evidence || []) sources.set(source.id, source);
    return [...sources.values()].slice(0, 16);
  }, [personal, explore]);

  return <main className="ats-page">
    <header className="ats-header"><span className="ats-eyebrow">AI TREND SIGNAL</span>
      <h1>{view === "personal" ? "Your skills in the AI era." : view === "explore" ? "Explore AI skills." : "Source-backed evidence."}</h1>
      <p>{view === "personal" ? "See potential connections between your skills and AI tasks." : view === "explore" ? "Discover AI capabilities mentioned in sampled job postings." : "Read original job passages used in AI skill analysis."}</p>
    </header>

    {view === "personal" && (profileLoading ? <p className="ats-state" role="status">Loading session profile…</p> : !profile ?
      <section className="ats-state"><h2>Complete registration first</h2><p>Your skills are taken from this browser session.</p><Link className="ats-primary" href="/register">Start registration →</Link></section> : !payload?.skills.length ?
      <section className="ats-state"><h2>Add your skills</h2><p>Add at least one existing skill to your profile.</p><Link className="ats-primary" href="/profile">Edit profile →</Link></section> : <>
        <div className="ats-section-heading"><div><span className="ats-eyebrow">BASED ON YOUR PROFILE</span><h2>Select a skill</h2></div><Link href="/profile">Edit profile ↗</Link></div>
        <div className="ats-skill-row">{(personal?.skills || payload.skills.map((skill) => ({ key: skill.skill_id || `custom:${skill.name.trim().toLowerCase()}`, name: skill.name, connection_count: 0 }))).map((skill) =>
          <button key={skill.key} type="button" className={`ats-skill-chip${selectedSkill === skill.key ? " active" : ""}`} onClick={() => void chooseSkill(skill.key)} aria-pressed={selectedSkill === skill.key}>{skill.name}</button>)}</div>
        {personalLoading && <p className="ats-state" role="status">Reading saved evidence…</p>}
        {personalError && <p className="ats-error" role="alert">{personalError}</p>}
        {!personalLoading && personal && <><div className="ats-section-heading ats-result-head"><div><span className="ats-eyebrow">POSSIBLE AI APPLICATIONS</span>
          <h2>{activeSkill ? `Where ${activeSkill.name} connects` : "Your AI connections"}</h2></div>
          <small>{personal.source_state.name} · {personal.source_state.posting_sample_size} sampled jobs</small></div>
          {personal.connections.length ? <div className="ats-grid">{personal.connections.map((item) => <article className="ats-card" key={item.id}>
            <span className="ats-eyebrow">YOUR SKILL → AI</span><h3>{item.current_skill_name}<span className="ats-arrow"> ↗ </span>{item.ai_skill.name}</h3>
            <p>{item.ai_skill.definition}</p>
            <div className="ats-card-detail"><strong>How it may relate to your work</strong><p>{guidance[item.id]?.explanation || item.cached_model_explanation?.explanation || "Wait for RunPod LLM text"}</p></div>
            <div className="ats-card-detail"><strong>What to learn next</strong><p>{guidance[item.id]?.learning_gap || "Wait for RunPod LLM text"}</p>
              {guidance[item.id]?.next_step && <p className="ats-next-step">Next: {guidance[item.id].next_step}</p>}</div>
            {inferenceError[item.id] && <p className="ats-error" role="status">{inferenceError[item.id]}</p>}
            <div className="ats-card-actions"><button type="button" className="ats-primary" disabled={inferenceBusy !== null} onClick={() => void generateGuidance(item)}>
              {inferenceBusy === item.id ? "Generating…" : "Generate with RunPod"}</button>
              <button type="button" onClick={() => setOpened({ name: item.ai_skill.name, sources: item.evidence })}>View {item.evidence.length} sources ↗</button></div>
          </article>)}</div> : <section className="ats-state"><h3>No supported connection found in this sample</h3><p>The current job sample may not cover this skill. This is not proof that the skill has no AI applications.</p></section>}
        </>}
      </>)}

    {view === "explore" && <>{exploreLoading && <p className="ats-state" role="status">Loading AI skills…</p>}
      {exploreError && <p className="ats-error" role="alert">{exploreError}</p>}
      {explore && <><div className="ats-section-heading"><div><span className="ats-eyebrow">OBSERVED AI CAPABILITIES</span><h2>{explore.title}</h2></div><small>{explore.source_scope}</small></div>
        {explore.items.length ? <div className="ats-grid">{explore.items.map((item) => <article className="ats-card" key={item.id}>
          <span className="ats-eyebrow">AI CAPABILITY</span><h3>{item.name}</h3><p>{item.definition}</p>
          {item.tasks[0] && <div className="ats-card-detail"><strong>Example task</strong><p>{item.tasks[0]}</p></div>}
          <div className="ats-card-actions"><span>{item.metric.kind === "posting_prevalence" ? `${item.metric.numerator ?? 0} postings mentioning this capability` : "Compared across periods"}</span>
            <button type="button" onClick={() => setOpened({ name: item.name, sources: item.evidence })}>View evidence ↗</button></div>
        </article>)}</div> : <section className="ats-state">No AI skills have been collected yet.</section>}</>}
    </>}

    {view === "evidence" && <>{(exploreLoading || personalLoading) && <p className="ats-state" role="status">Loading original sources…</p>}
      {exploreError && <p className="ats-error" role="alert">{exploreError}</p>}
      {!exploreLoading && <><div className="ats-section-heading"><div><span className="ats-eyebrow">SOURCE LINKS AND QUOTATIONS</span>
        <h2>Original job evidence</h2></div><small>Sample of cited job advertisements</small></div>
        {evidence.length ? <div className="ats-evidence-list">{evidence.map((source) => <SourceCard key={source.id} source={source}/>)}</div> : <p className="ats-state">No saved job passages yet. Refresh the AI Trend Signal evidence snapshot.</p>}
      </>}
    </>}
    <footer className="ats-disclaimer">Evidence is from a capped remote-job sample, not a forecast or proof of skill replacement. AI-generated guidance may be incomplete; check original sources.</footer>
    {opened && <EvidenceModal name={opened.name} sources={opened.sources} close={() => setOpened(null)} />}
  </main>;
}

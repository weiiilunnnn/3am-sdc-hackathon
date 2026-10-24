"use client";
import { useId, useRef, useState } from "react";
import type { CapabilityGroup, CareerAnalysis } from "@/lib/career-analysis";
import { displaySkillLabel as label } from "@/lib/career-display";
import Icon, { capabilityIcon, type CareerIconKind } from "./CareerAnalysisIcon";

const officialLink = (value: string) => /^https?:\/\/(?:data\.europa\.eu|ec\.europa\.eu)\//.test(value);
const conceptCount = (count: number) => `${count} ${count === 1 ? "Concept" : "Concepts"}`;
const iconTile = (kind: CareerIconKind) => <span className="capability-icon"><Icon kind={kind} /></span>;

function Heading({ id, icon, title, subtitle }: { id: string; icon: CareerIconKind; title: string; subtitle: string }) {
  return <header className="analysis-card-heading">{iconTile(icon)}<div><h2 id={id}>{title}</h2><p>{subtitle}</p></div></header>;
}

function CapabilityTile({ group }: { group: CapabilityGroup }) {
  return <article className="matrix-capability">
    <div className="capability-tile-heading">{iconTile(capabilityIcon(group.title))}<div><h3>{label(group.title)}</h3></div></div>
    <p className="matrix-concept-label">Concepts:</p>
    <div className="chips">{group.concepts.slice(0, 2).map(c => <span className="chip" key={c.skill_id}>{label(c.name)}</span>)}</div>
  </article>;
}

function Evidence({ ids, analysis, interpretation }: { ids: string[]; analysis: CareerAnalysis; interpretation: string }) {
  return <details className="sources interpretation-sources"><summary>AI Interpretation &amp; Sources</summary><p className="small">{interpretation}</p><p className="micro muted">Potential interpretation, not an official ESCO mapping.</p>
    <ul>{ids.map(id => analysis.evidence.find(e => e.evidence_id === id)).filter(e => !!e).map(e => <li key={e.evidence_id}>
      {officialLink(e.url) ? <a href={e.url} target="_blank" rel="noopener noreferrer">{label(e.title)} ↗</a> : label(e.title)}<small>{e.text}</small>
    </li>)}</ul>
  </details>;
}

export type AnalysisPanelProps = { analysis: CareerAnalysis | null; busy?: boolean; error?: string; hasProfile?: boolean; occupationSourceUrl?: string; retryable?: boolean; retrying?: boolean; onRetry?: () => void };
export default function CareerAnalysisPanels(props: AnalysisPanelProps) {
  // Retain expansion during progressive AI loading; reset only for new evidence.
  return <Panels key={props.analysis?.evidence_key ?? "pending"} {...props} />;
}
function Panels({ analysis, busy = false, error = "", hasProfile = true, occupationSourceUrl, retryable = false, retrying = false, onRetry }: AnalysisPanelProps) {
  const [tab, setTab] = useState<"matched" | "missing">("missing");
  const [visible, setVisible] = useState({ matched: 4, missing: 4 });
  const prefix = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const fallback = hasProfile ? "Loading ESCO skill evidence…" : "Save a recognised skills profile to view personalised evidence.";
  const noGaps = analysis && !analysis.groups.length;
  const noMatched = analysis && !analysis.matched.length;
  const aiUnavailable = analysis && !busy && (error || analysis.status === "unavailable");
  const matrixGroups: CapabilityGroup[] = !analysis ? [] : tab === "missing" ? analysis.groups : analysis.matched.map(skill => ({ group_id: skill.skill_id, concept_uri: skill.skill_id, title: skill.name, count: 1, concepts: [skill], mapping_method: "source_concept_fallback", explanation: "" }));
  const remaining = Math.max(0, matrixGroups.length - visible[tab]);
  let bridgeState: [string, string] = ["AI Skill Connections Aren't Available Yet", "Your verified skill evidence is still available below."];
  if (!analysis) bridgeState = [busy ? "Preparing Skill Connections" : "Skill Evidence Needed", fallback];
  else if (noGaps) bridgeState = ["No Unevidenced Target Capabilities", "All documented requirements are represented in the recognised profile."];
  else if (noMatched) bridgeState = ["No Recognised Skills Match This Role Yet", "Review the role requirements against your saved profile."];
  else if (busy) bridgeState = ["Preparing Potential Skill Connections", "Your verified skill evidence is already available below."];
  else if (analysis.status === "ready" || analysis.status === "partial") bridgeState = ["No Supported Connections Were Returned", "This does not mean you have no transferable skills. Explore your verified evidence below."];
  return <section className="career-analysis-stack" data-testid="career-skills-analysis" aria-label="Skills analysis">
    <section className="career-analysis-card" aria-labelledby={`${prefix}-gap`}>
      <Heading id={`${prefix}-gap`} icon="target" title="Skill Gap Impact Analysis" subtitle="Why These Capability Gaps Matter for This Role" />
      {busy && <p className="analysis-ai-status" role="status">Preparing AI interpretation…</p>}
      {aiUnavailable && !noGaps && <p className="analysis-ai-status">AI analysis unavailable · Showing ESCO source skills</p>}
      {analysis ? <><div className="capability-grid gap-capability-grid">{analysis.groups.slice(0, 4).map(group => {
        const interpretation = analysis.interpretations.find(i => i.group_id === group.group_id);
        return <article className="gap-capability" key={group.group_id}><div className="capability-tile-heading">{iconTile(capabilityIcon(group.title))}<div><h3>{label(group.title)}</h3><span className="concept-count">{conceptCount(group.count)}</span></div></div>
          <p className="capability-copy">{interpretation?.why_relevant ?? `Explore ${group.concepts.slice(0, 2).map(c => label(c.name)).join(" and ")}.`}</p>
        </article>;
      })}</div>{noGaps && <p className="small analysis-neutral">No occupation requirements are unevidenced by this recognised profile.</p>}
      {analysis.groups.length > 4 && <p className="analysis-footnote"><Icon kind="info" />Explore More in Skill Evidence Matrix</p>}</> : <p className="small analysis-neutral">{error || fallback}</p>}
      {occupationSourceUrl && officialLink(occupationSourceUrl) && <p className="gap-section-source"><a href={occupationSourceUrl} target="_blank" rel="noopener noreferrer">Source: ESCO Occupational Skills ↗</a></p>}
    </section>
    <section className="career-analysis-card" aria-labelledby={`${prefix}-bridges`}>
      <Heading id={`${prefix}-bridges`} icon="bridge" title="Transferable Skills Mapping" subtitle="How Your Current Skills Can Support New Capabilities" />
      {!!analysis?.bridges.length ? <div className="bridge-grid">{analysis.bridges.slice(0, 3).map((bridge, i) => {
        const target = analysis.groups.find(g => g.group_id === bridge.target_group_id);
        return <article className="bridge-capability" key={i}>
          <div className="skill-bridge"><div className="chips">{bridge.matched_skill_ids.map(id => <span className="chip positive" key={id}>{label(analysis.matched.find(s => s.skill_id === id)?.name ?? "")}</span>)}</div><span className="bridge-arrow" aria-hidden="true">→</span><span className="bridge-target">{iconTile(capabilityIcon(target?.title ?? ""))}{label(target?.title ?? "")}</span></div>
          <p className="capability-copy">{bridge.explanation}</p><span className="potential-label">Potential Learning Connection · AI-Inferred</span><Evidence ids={bridge.evidence_ids} analysis={analysis} interpretation={bridge.explanation} />
        </article>;
      })}</div> : <div className="analysis-neutral bridge-empty">{iconTile("bridge")}<div><h3>{bridgeState[0]}</h3><p>{bridgeState[1]}</p>{analysis && hasProfile && !noGaps && !noMatched && onRetry && (retrying || (retryable && !busy)) && <button type="button" className="secondary retry-career-analysis" disabled={retrying || busy} onClick={onRetry}>{retrying ? "Preparing AI analysis..." : "Retry AI Analysis"}</button>}</div></div>}
    </section>
    <section className="career-analysis-card" aria-labelledby={`${prefix}-matrix`}>
      <Heading id={`${prefix}-matrix`} icon="grid" title="Skill Evidence Matrix" subtitle="What Your Profile Shows—and What Is Not Yet Evidenced" />
      <div className="evidence-tabs" role="tablist" aria-label="Skill evidence status">{(["matched", "missing"] as const).map((value, i) => <button type="button" key={value} ref={element => { tabs.current[i] = element; }}
        role="tab" id={`${prefix}-${value}-tab`} aria-controls={`${prefix}-panel`} aria-selected={tab === value} tabIndex={tab === value ? 0 : -1}
        onClick={() => setTab(value)} onKeyDown={event => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - i;
          setTab(next === 0 ? "matched" : "missing"); tabs.current[next]?.focus();
        }}>{value === "matched" ? `Matched (${analysis?.matched.length ?? "—"})` : `Not Evidenced (${analysis?.not_evidenced_count ?? "—"})`}</button>)}</div>
      <div role="tabpanel" tabIndex={0} id={`${prefix}-panel`} aria-labelledby={`${prefix}-${tab}-tab`}>
        {!analysis ? <p className="small analysis-neutral">{error || fallback}</p> : <>
          <div className="capability-grid matrix-capability-grid">{matrixGroups.slice(0, visible[tab]).map(group => <CapabilityTile group={group} key={group.group_id} />)}</div>
          {!matrixGroups.length && <p className="small analysis-neutral">{tab === "missing" ? "No unevidenced requirements documented." : "No recognised profile concepts match this occupation."}</p>}
          {remaining > 0 && <button type="button" className="explore-capabilities" aria-controls={`${prefix}-panel`} onClick={() => setVisible(n => ({ ...n, [tab]: n[tab] + 4 }))}><Icon kind="plus" /><span>Explore {remaining} More {tab === "missing" ? "Capability Groups" : "Matched Concepts"}</span><Icon kind="chevron" /></button>}
        </>}
      </div>
      <p className="analysis-footnote matrix-footnote"><Icon kind="info" />Grouped for Clarity—Explore More When Needed</p>
    </section>
    <details className="about-career-analysis"><summary>About This Analysis</summary>
      <p className="small">Not Evidenced means unsupported by the recognised profile, not confirmed lack of competence. Matched concepts are self-reported, not assessed proficiency. Profile Relevance is separate from essential coverage and job readiness.</p>
      <p className="small">ESCO supplies requirements, relationships, groups and distinct concept counts. Groups are ordered by count, then official label and URI, not importance or impact. Individual concepts remain separate when no verified broader parent is available.</p>
      <p className="small">AI interpretations and potential learning connections are conditional suggestions. Source citations support documented requirements, not official skill equivalence, verified workplace impact or hiring outcomes.</p>
      {analysis?.grouping_warning && <p className="small">{analysis.grouping_warning}</p>}
    </details>
  </section>;
}

"use client";
import { useId, useState } from "react";
import type { DiscoveryRole, Source } from "@/lib/contracts";
import SourceLinks from "./SourceLinks";

export default function CareerCard({ match: m, sources, onSelect, busy }: { match: DiscoveryRole; sources: Source[]; onSelect: () => void; busy: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const descriptionId = useId();
  const score = m.score;
  return <article className="career-card discovery-card" data-testid="career-card">
    <div className="career-top"><div><p className="eyebrow">MATCH {String(m.rank).padStart(2, "0")} <span className="tiny-tag">ESCO · VERIFIED</span></p><h3>{m.role_title}</h3></div><div className="score"><strong>{score.profile_relevance_pct?.toFixed(2) ?? "—"}%</strong><span>Profile relevance</span></div></div>
    <div className="coverage-track" role="progressbar" aria-label="Profile relevance, not readiness or hiring probability" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score.profile_relevance_pct ?? undefined}><span style={{ width: `${score.profile_relevance_pct ?? 0}%` }} /></div>
    <p className="coverage-caption">{score.matched_recognised_skill_count} relevant listed skills · {score.matched_essential_skill_count} essential<span>Self-reported · not hiring probability</span></p>
    <div className="description-block"><p id={descriptionId} data-testid="role-description" className={`small muted ${expanded ? "" : "description-clamped"}`}>{m.description}</p><button type="button" className="text-button description-toggle" aria-controls={descriptionId} aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>{expanded ? "Show less" : "Read more"}<span className="sr-only"> about {m.role_title}</span></button></div>
    <p className="mini-heading">✓ RECOGNISED STRENGTHS</p><div className="chips strength-chips">{m.strengths.map(s => <span className="chip positive" key={s.skill_id}>{s.name}</span>)}{m.additional_strength_count > 0 && <span className="chip">+{m.additional_strength_count}</span>}</div>
    <div className="development-areas"><p className="mini-heading">↗ AREAS TO EXPLORE · NOT YET EVIDENCED</p>
      {m.development_areas.map(area => <details className="development-area" key={`${area.mapping_method}:${area.area_id}`}><summary><span>{area.title}</span><span className="area-count">{area.not_yet_evidenced_count}</span></summary><p className="small muted">{area.explanation}</p><p className="micro">{area.mapping_method === "source_concept_fallback" ? "Actual documented concept; semantic grouping unavailable." : "ESCO broader-skill relationship; one parent chosen by the application for compact display."}</p><SourceLinks ids={area.source_ids} sources={sources} label="Source for this area" /><p className="record-id micro">Supporting concept IDs: {area.supporting_concept_ids.join(", ")}</p></details>)}
      {m.unshown_not_evidenced_count > 0 && <p className="micro">{m.unshown_not_evidenced_count} additional essential concepts are not yet evidenced; the complete graph remains available for backend audit.</p>}
      {m.grouping_warning && <p className="micro">{m.grouping_warning}</p>}
    </div>
    <div className="card-footer"><span className="micro">{m.pathway_coverage_status === "no_verified_resources" ? "No verified pathway resources available yet for this role" : "Reviewed starter resources · coverage may be incomplete"}</span><button className="secondary" disabled={busy || !m.pathway_available} onClick={onSelect}>Explore pathway <span aria-hidden="true">→</span></button></div>
    <details className="role-details"><summary>Why this match?</summary>{m.qualification_reason.map(t => <p className="small" key={t}>{t}</p>)}
      <p className="micro">Based on how your listed, recognised skills relate to this ESCO occupation; not a measure of readiness or hiring probability.</p>
      <p className="small">Profile relevance: weighted overlap {score.weighted_matched_sum.toFixed(3)} / {score.weighted_profile_sum.toFixed(3)}. The backend uses full precision to rank.</p>
      <p className="small">Documented essential coverage: {score.essential_coverage_numerator} / {score.essential_coverage_denominator} = {score.essential_coverage_pct?.toFixed(2) ?? "unavailable"}%. This is separate from profile relevance; unmentioned concepts are not confirmed deficiencies.</p>
      <p className="micro">Method: {score.method_version} · ESCO {m.esco_release} · {m.data_source_status}. Current job-market demand is not included.</p>
      <SourceLinks ids={[...m.occupation_source_ids, ...m.strengths.flatMap(s => s.source_ids)]} sources={sources} label="Occupation & matching-skill sources" />
      {(m.sdg_mappings.length > 0 || Object.keys(m.skill_sdg_mappings).length > 0) && <details><summary>Supplied SDG mappings</summary>{[...m.sdg_mappings, ...Object.values(m.skill_sdg_mappings).flat()].map((s, i) => <div key={i}><p className="small">SDG {s.sdg_number}: {s.reason} ({s.mapping_status})</p><SourceLinks ids={s.source_ids} sources={sources} /></div>)}</details>}
    </details>
  </article>;
}

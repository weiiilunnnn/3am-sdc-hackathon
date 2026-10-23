"use client";
import Link from "next/link";
import { useId, useState } from "react";
import type { RoleDetail, RoleResult } from "@/lib/future-role-session";
import Icon from "./CareerAnalysisIcon";
import RadialProfileRelevance from "./RadialProfileRelevance";

type Props = { role: RoleDetail["role"]; match: RoleResult | null; hasProfile: boolean; scoring: boolean; sourceUrl?: string; pathwayHref: string };

export default function CareerOverview({ role, match, hasProfile, scoring, sourceUrl, pathwayHref }: Props) {
  const [expanded, setExpanded] = useState(false);
  const descriptionId = useId();
  const canExplore = hasProfile && !!match?.pathway_available && !scoring;
  const officialSource = sourceUrl && /^https?:\/\/(?:data\.europa\.eu|ec\.europa\.eu)\//.test(sourceUrl);
  return <section className="career-overview career-dashboard-overview" data-testid="career-overview" data-role-id={role.role_id} aria-label="Career overview">
    <div className="career-overview-information">
      <p className="eyebrow">CAREER DETAILS · ESCO</p>
      <div className="overview-role-heading"><span className="overview-role-icon"><Icon kind="occupation" /></span><h1>{role.title}</h1></div>
      <div className="description-block"><p id={descriptionId} data-testid="role-description" className={`small ${expanded ? "" : "description-clamped"}`}>{role.description}</p><button className="text-button description-toggle" aria-controls={descriptionId} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? "Show less" : "Read more"}<span className="sr-only"> about {role.title}</span><span aria-hidden="true"> {expanded ? "⌃" : "⌄"}</span></button></div>
      {match?.qualification_status === "search_result" && <p className="micro muted">Search result; recommendation qualification filters do not apply.</p>}
      {scoring && <p role="status">Loading the backend profile score...</p>}
      {!hasProfile && <p className="notice small">Complete your profile to see personalised matches. This verified occupation is shown without a profile-based assessment.</p>}
      {match && "score_unavailable_reason" in match && match.score_unavailable_reason && <p className="notice small">{match.score_unavailable_reason}</p>}
      <dl className="overview-facts">
        {hasProfile && match && <>
          {typeof match.score.matched_recognised_skill_count === "number" && <div className="overview-fact"><span className="overview-fact-icon"><Icon kind="grid" /></span><div><dt>Matched Profile Concepts</dt><dd>{match.score.matched_recognised_skill_count}</dd></div></div>}
          {typeof match.not_evidenced_essential_count === "number" && <div className="overview-fact"><span className="overview-fact-icon"><Icon kind="target" /></span><div><dt>Essential Concepts Not Evidenced</dt><dd>{match.not_evidenced_essential_count}</dd></div></div>}
        </>}
        {officialSource && <div className="overview-fact overview-source"><span className="overview-fact-icon"><Icon kind="globe" /></span><div><dt>ESCO Occupation Source</dt><dd><a href={sourceUrl} target="_blank" rel="noopener noreferrer">View Source ↗</a></dd></div></div>}
      </dl>
    </div>
    <div className="career-overview-assessment"><RadialProfileRelevance value={hasProfile ? match?.score.profile_relevance_pct ?? null : null} /></div>
    <footer className="overview-pathway-footer">{canExplore ? <Link className="overview-pathway-link" href={pathwayHref}>Explore Pathway <span aria-hidden="true">↗</span></Link> : <span className="overview-pathway-link" role="link" aria-disabled="true">Explore Pathway <span aria-hidden="true">↗</span></span>}</footer>
  </section>;
}

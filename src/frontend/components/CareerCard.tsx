"use client";
import Link from "next/link";
import type { RoleResult } from "@/lib/future-role-session";
import { careerHref, updateRoleSession } from "@/lib/future-role-session";
import ProfileRelevance from "./ProfileRelevance";
import { displayOccupationTitle } from "@/lib/career-display";

export default function CareerCard({ match, busy = false }: { match: RoleResult; busy?: boolean }) {
  const title = displayOccupationTitle(match.role_title);
  const hasEscoSource = match.occupation_source_ids.length > 0 && !!match.esco_release;
  return <article className="career-card horizontal-career-card" data-testid="career-card">
    <div className="career-card-information">
      <div className="occupation-tags">
        {match.qualification_status === "qualified" && <span className="occupation-tag recommendation-tag">Profile-Based Recommendation</span>}
        {hasEscoSource && <span className="occupation-tag esco-tag">ESCO Occupation</span>}
      </div>
      <h3>{title}</h3>
      <p className="career-card-description">{match.description || "Occupation description unavailable."}</p>
      <div className="career-card-strengths"><p className="mini-heading">Recognised strengths</p>
        {match.strengths.length ? <div className="chips">{match.strengths.slice(0, 3).map(skill => <span className="chip positive" key={skill.skill_id}>{skill.name}</span>)}</div> : <p className="small muted">No listed skill overlap is evidenced.</p>}
      </div>
      {match.occupation_source_ids.length > 0 && <p className="career-card-source"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-3H4V4Zm16 0h-4a3 3 0 0 0-3 3v14a4 4 0 0 1 4-3h3V4Z" /></svg>ESCO {match.esco_release} · Source in Career Details</p>}
    </div>
    <div className="career-card-relevance">
      <ProfileRelevance value={match.score.profile_relevance_pct} />
      <div className="compact-card-actions"><Link className="secondary" href={careerHref(match.role_id)} aria-disabled={busy} onClick={event => { if (busy) event.preventDefault(); else updateRoleSession({ scrollY: window.scrollY }); }}>Explore More<span aria-hidden="true"> →</span><span className="sr-only"> about {title}</span></Link></div>
    </div>
  </article>;
}

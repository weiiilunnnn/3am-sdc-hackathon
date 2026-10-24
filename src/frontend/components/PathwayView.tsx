import type { Bootstrap, Pathway } from "@/lib/contracts";
import { duration, planningTime } from "@/lib/future-role-api";
import SourceLinks from "./SourceLinks";
import PathwayIcon from "./PathwayIcon";
import PathwayResourceCard from "./PathwayResourceCard";
import CredentialRecommendations from "./CredentialRecommendations";

export default function PathwayView({ pathway: p, data }: { pathway: Pathway; data: Bootstrap }) {
  const name = (id: string) => data.skills.find(s => s.skill_id === id)?.name ?? id;
  const count = p.phases.reduce((n, phase) => n + phase.resources.length, 0);
  const resourceTitle = (id: string) => p.phases.flatMap(phase => phase.resources).find(r => r.resource_id === id)?.title;
  const schedule = p.planning_estimate;
  const sources = [...new Map([...data.sources, ...(p.sources ?? [])].map(s => [s.source_id, s])).values()];
  return <section className="pathway-view" data-testid="pathway-view">
    <div className="pathway-hero"><span className="badge light-badge">PERSONALISED STARTER PATHWAY</span><h2>{p.role_title}</h2>
      <div className="pathway-metrics"><div><strong>{p.target_skill_ids.length}</strong><span>targeted gaps</span></div><div><strong>{count}</strong><span>learning resources</span></div><div><strong>{planningTime(schedule)}</strong><span>selected materials only</span></div></div>
      <p className="small timing-label">Known provider hours: {schedule?.provider_known_hours ? duration(schedule.provider_known_hours) : "none published for selected materials"}{!!schedule?.reviewed_app_hours && ` · Reviewed app hours: ${duration(schedule.reviewed_app_hours)}`}{!!schedule?.fallback_study_days && ` · App fallback: ${schedule.fallback_study_days} study days`}</p>
      <p className="micro">{p.hours_per_week ? `${p.hours_per_week} hours/week` : "Weekly hours not supplied"} · {schedule?.study_days_per_week ?? 5} planned study days/week · Completion does not establish job readiness.</p></div>
    {p.discovery_message && <p className="notice small" data-testid="discovery-notice">{p.discovery_message}</p>}
    {p.status === "no_documented_gaps" && <p className="notice small">All documented essential concepts are listed. Assessed proficiency and hiring readiness remain unverified.</p>}
    <div className={`pathway-timeline ${p.phases.some(phase => phase.phase_kind !== "remaining_gaps") ? "" : "no-learning-phases"}`}><div className="phase-list">{p.phases.filter(phase => phase.phase_kind !== "remaining_gaps").map(phase => <article className={`phase ${phase.status !== "available" ? "incomplete" : ""}`} key={phase.phase_id}>
      <div className="phase-number">{String(phase.order).padStart(2, "0")}</div><div className="phase-content">
        <div className="pathway-phase-heading"><PathwayIcon kind={phase.phase_kind === "foundations" ? "book" : phase.phase_kind === "online_courses" ? "monitor" : phase.phase_kind === "guided_practice" ? "code" : "book"} /><h3>{phase.phase_kind === "remaining_gaps" ? "Remaining Learning Gaps" : phase.title}</h3></div>
        <p className="phase-meta">{phase.target_skill_ids.length} {phase.status === "available" ? "supported target gaps" : "uncovered requirements"} · {phase.resources.length} resources{phase.status === "available" && phase.planning_estimate?.scheduled_weeks != null && phase.planning_estimate.scheduled_weeks > 0 && ` · ${planningTime(phase.planning_estimate)}`}</p>
        {phase.status !== "available" ? <details className="remaining-gaps"><summary>Additional resources needed ({phase.target_skill_ids.length})</summary><p className="small muted">These requirements remain in your skills gap. No eligible reviewed route is currently available.</p><div className="requirement-scroll chips">{phase.target_skill_ids.map(id => <span className="chip" key={id}>{name(id)}</span>)}</div><SourceLinks ids={phase.source_ids} sources={sources} label="Required concept evidence" /></details> : <>
          {phase.resources.map(r => <PathwayResourceCard key={r.resource_id} resource={r} earlierTitles={r.prerequisite_resource_ids.map(resourceTitle).filter((title): title is string => !!title)} />)}
          <details><summary>Phase objectives & evidence</summary><div className="chips">{phase.target_skill_ids.map(id => <span className="chip" key={id}>{name(id)}</span>)}</div>{phase.learning_objectives.map((t, i) => <p className="small" key={i}>{t}</p>)}<SourceLinks ids={phase.source_ids} sources={sources} /></details>
        </>}
      </div></article>)}</div>
    {p.uncovered_skill_ids.length > 0 && <section className="remaining-gaps" aria-label="Remaining Learning Gaps"><p className="small muted">{p.uncovered_skill_ids.length} gaps still need learning resources</p></section>}
    {!!p.alternative_resources?.length && <section aria-label="Additional learning resources" className="pathway-alternatives">
      <h3>Additional Learning Resources</h3>
      <p className="small muted">Review relevance and pricing with the provider. These alternatives are not included in the affordable plan, gap coverage or time estimates.</p>
      {p.alternative_resources.map(resource => <PathwayResourceCard key={resource.resource_id} resource={resource} earlierTitles={[]} />)}
    </section>}
    <CredentialRecommendations pathway={p} skillName={name} /></div>
    {p.warnings.filter(warning => !/^No eligible verified route for \d+ documented gaps\. This is a starter pathway\.$/.test(warning)).map((warning, i) => <p className="notice small" key={i}>{warning}</p>)}
    {p.blocked_resource_ids.length > 0 && <p className="notice small">Unavailable alternatives: {p.blocked_resource_ids.join(", ")}</p>}

  </section>;
}

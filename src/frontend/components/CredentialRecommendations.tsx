import { checkedDate, moneyLabel, supportedText } from "@/lib/pathway-presentation";
import PathwayIcon from "./PathwayIcon";
import type { Pathway } from "@/lib/contracts";

export default function CredentialRecommendations({ pathway, skillName }: { pathway: Pathway; skillName: (id: string) => string }) {
  return <section className="phase" aria-labelledby="credentials-heading" data-testid="credential-section">
    <div className="phase-number" aria-hidden="true">{String(pathway.phases.filter(p => p.phase_kind !== "remaining_gaps").length + 1).padStart(2, "0")}</div><div className="phase-content">
      <div className="pathway-phase-heading"><PathwayIcon kind="award" /><h3 id="credentials-heading">Certifications &amp; Skill Assessments</h3></div>
      <p className="small muted">{pathway.credential_message ?? "No verified credential recommendations available for this pathway."}</p>
      {pathway.credential_used_cache && <p className="micro">Previously checked credential information reused.</p>}
      {(pathway.credentials ?? []).map(c => {
        const date = checkedDate(c.checked_at);
        const supported = !!c.evidence?.credential && c.source_urls.length > 0;
        const local = supported && c.origin === "local_catalogue" && !!date;
        const provider = supported && supportedText(c.provider);
        const kind = supported ? {certification_exam: "Certification exam", assessed_course_certificate: "Assessed course certificate", skill_assessment: "Skill assessment credential"}[c.credential_type] : undefined;
        const assessment = supported && (local || c.evidence.assessment) ? supportedText(c.assessment_format) : null;
        const prerequisites = supported && (local || c.evidence.prerequisites) ? supportedText(c.prerequisites) : null;
        const free = supported && c.fees_verified_free && (local || !!c.evidence.fees);
        const examFee = free ? "Free" : supported && (local || c.evidence.exam_fee) ? moneyLabel(c.exam_fee) : null;
        const certificateFee = free ? "Free" : supported && (local || c.evidence.certificate_fee) ? moneyLabel(c.certificate_fee) : null;
        const origin = c.origin === "local_catalogue" ? "Reviewed catalogue" : c.origin === "web_discovered" ? "Discovered online" : null;
        return <article className="resource-card pathway-resource" key={c.credential_id} data-resource-icon={kind ? "award" : "book"}>
          <span className="pathway-resource-icon"><PathwayIcon kind={kind ? "award" : "book"} /></span><div className="pathway-resource-body">
            {(provider || kind) && <p className="mini-heading">{[provider, kind].filter(Boolean).join(" · ")}</p>}
            <h4><a href={c.url} target="_blank" rel="noopener noreferrer">{c.title} ↗</a></h4>
            {(origin || date) && <p className="micro">{[origin, date ? `Checked ${date}` : null].filter(Boolean).join(" · ")}</p>}
            <div className="chips">{c.skill_ids.map(id => <span className="chip" key={id}>{skillName(id)}</span>)}</div>
            <div className="credential-facts">
              {assessment && <p className="small">Assessment: {assessment}</p>}
              {prerequisites && <p className="small">Prerequisites: {prerequisites}</p>}
              {examFee && <p className="small">Exam fee: {examFee}</p>}
              {certificateFee && <p className="small">Certificate fee: {certificateFee}</p>}
            </div>
          </div>
        </article>;
      })}
      <p className="micro muted">Optional opportunities after preparation. Requirements, fees and availability can change. A practice assessment alone does not award certification. Credential fees are separate from pathway learning costs; completing a credential does not establish job readiness.</p>
    </div>
  </section>;
}

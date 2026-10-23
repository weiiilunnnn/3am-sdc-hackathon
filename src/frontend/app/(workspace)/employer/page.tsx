"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageIntro } from "../WorkspaceStates";
import {
  ApiError,
  assignEmployerMember,
  createEmployerDepartment,
  generateEmployerLearningPlan,
  getEmployerDashboard,
  getSkills,
  setEmployerDepartmentTargets,
  type EmployerLearningPlan,
  type EmployerMember,
  type EmployerTeamDashboard,
  type SkillOption,
} from "@/lib/api";

type DepartmentFilter = "all" | "unassigned" | string;

function employerRequestError(reason: unknown, fallback: string) {
  if (reason instanceof ApiError && reason.status >= 500) {
    return `The Employer API returned HTTP ${reason.status}. Check the FastAPI terminal; if it is not running, start it from the repository root with: python -m uvicorn src.main:app --host 127.0.0.1 --port 8080 --reload`;
  }
  return reason instanceof Error ? reason.message : fallback;
}

function coverageClass(value: number | null) {
  if (value === null) return "employer-coverage-empty";
  if (value >= 70) return "employer-coverage-high";
  if (value >= 35) return "employer-coverage-medium";
  return "employer-coverage-low";
}

export default function EmployerPage() {
  const [dashboard, setDashboard] = useState<EmployerTeamDashboard | null>(null);
  const [skills, setSkills] = useState<SkillOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentFilter>("all");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [targetSkillIds, setTargetSkillIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [plan, setPlan] = useState<EmployerLearningPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getEmployerDashboard();
      setDashboard(result);
      setSelectedDepartment((current) => current !== "all" && current !== "unassigned" && result.departments.some((item) => item.id === current) ? current : "all");
      setSelectedMemberId((current) => result.members.some((item) => item.id === current) ? current : result.members[0]?.id ?? "");
    } catch (reason) {
      setError(employerRequestError(reason, "Employer team data could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let live = true;
    getSkills().then((response) => { if (live) setSkills(response.skills); })
      .catch((reason: unknown) => { if (live) setActionError(employerRequestError(reason, "The local skill vocabulary could not be loaded.")); });
    void refresh();
    return () => { live = false; };
  }, [refresh]);

  const selectedDepartmentRecord = dashboard?.departments.find((item) => item.id === selectedDepartment) ?? null;
  useEffect(() => {
    setTargetSkillIds(selectedDepartmentRecord?.target_skill_ids ?? []);
  }, [selectedDepartmentRecord?.id, selectedDepartmentRecord?.target_skill_ids.join("|")]);

  const visibleMembers = useMemo(() => {
    if (!dashboard) return [];
    if (selectedDepartment === "unassigned") return dashboard.members.filter((item) => !item.department_id);
    if (selectedDepartment === "all") return dashboard.members;
    return dashboard.members.filter((item) => item.department_id === selectedDepartment);
  }, [dashboard, selectedDepartment]);
  const selectedMember = dashboard?.members.find((item) => item.id === selectedMemberId) ?? null;
  const selectedMemberGaps = selectedMember && selectedMember.department_id
    ? (dashboard?.departments.find((item) => item.id === selectedMember.department_id)?.skill_coverage ?? [])
      .filter((item) => !selectedMember.skills.some((skill) => skill.skill_id === item.skill_id))
    : [];
  const teamGaps = dashboard?.members.filter((member) => {
    if (!member.department_id) return false;
    const targets = dashboard.departments.find((item) => item.id === member.department_id)?.skill_coverage ?? [];
    return targets.some((target) => !member.skills.some((skill) => skill.skill_id === target.skill_id));
  }).length ?? 0;

  async function submitDepartment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!departmentName.trim()) return;
    setSaving(true);
    setActionError("");
    try {
      const created = await createEmployerDepartment(departmentName.trim());
      setDepartmentName("");
      await refresh();
      setSelectedDepartment(created.id);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "The department could not be created.");
    } finally {
      setSaving(false);
    }
  }

  async function changeMemberDepartment(memberId: string, departmentId: string) {
    setSaving(true);
    setActionError("");
    try {
      await assignEmployerMember(memberId, departmentId || null);
      await refresh();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "The department assignment could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function saveTargets() {
    if (!selectedDepartmentRecord) return;
    setSaving(true);
    setActionError("");
    try {
      await setEmployerDepartmentTargets(selectedDepartmentRecord.id, targetSkillIds);
      await refresh();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Department skill targets could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function requestLearningPlan(member: EmployerMember) {
    setPlan(null);
    setPlanError("");
    setPlanLoading(true);
    try {
      setPlan(await generateEmployerLearningPlan(member.id));
    } catch (reason) {
      setPlanError(reason instanceof Error ? reason.message : "The AI learning plan could not be generated.");
    } finally {
      setPlanLoading(false);
    }
  }

  return <main className="page-wrap employer-page">
    <PageIntro kicker="EMPLOYER VIEW · WORKFORCE SKILLS" title={<>See the gaps.<br />Build what’s next.</>} description="Review synthetic-demo profiles from the shared database, group them into employer-defined departments, and compare current skills with targets you set." index="WORKFORCE VIEW / 06" />
    <div className="employer-notice" role="note"><strong>Prototype access:</strong> {dashboard?.data_notice ?? "This view has no HR authentication or company-level access control. It is not ready for real employee data."}</div>

    {loading && <div className="panel state-panel"><div className="skeleton" aria-label="Loading team profiles" /><p role="status">Loading synthetic team profiles…</p></div>}
    {!loading && error && <div className="panel state-panel"><p className="message error" role="alert">{error}</p><button className="button secondary" type="button" onClick={() => void refresh()}>Try again</button></div>}
    {!loading && dashboard && <>
      <section className="employer-summary-grid" aria-label="Workforce summary">
        <article className="panel employer-summary-card"><span>TEAM PROFILES</span><strong>{dashboard.member_count}</strong><small>Synthetic demo records</small></article>
        <article className="panel employer-summary-card"><span>DEPARTMENTS</span><strong>{dashboard.departments.length}</strong><small>Employer-defined groups</small></article>
        <article className="panel employer-summary-card"><span>UNASSIGNED</span><strong>{dashboard.unassigned_count}</strong><small>Profiles still need a group</small></article>
        <article className="panel employer-summary-card"><span>WITH TARGET GAPS</span><strong>{teamGaps}</strong><small>Compared with entered targets</small></article>
      </section>

      <section className="panel employer-controls">
        <div className="employer-controls-heading"><div><span className="page-kicker"><span className="kicker-dot" /> TEAM STRUCTURE</span><h2>Departments and target skills</h2><p>Create groups, assign profiles and define the skills your team needs.</p></div></div>
        <form className="employer-create-department" onSubmit={(event) => void submitDepartment(event)}>
          <label className="field"><span className="label-text">New department</span><input aria-label="New department name" value={departmentName} onChange={(event) => setDepartmentName(event.target.value)} maxLength={80} placeholder="e.g. Data & Insights" /></label>
          <button className="button small" type="submit" disabled={saving || departmentName.trim().length < 2}>Create department</button>
        </form>
        <label className="field employer-filter"><span className="label-text">View team</span><select value={selectedDepartment} onChange={(event) => setSelectedDepartment(event.target.value)}><option value="all">All profiles ({dashboard.member_count})</option><option value="unassigned">Unassigned ({dashboard.unassigned_count})</option>{dashboard.departments.map((item) => <option value={item.id} key={item.id}>{item.name} ({item.member_count})</option>)}</select></label>

        {selectedDepartmentRecord && <div className="employer-target-editor">
          <div><h3>{selectedDepartmentRecord.name} · target skills</h3><p>Targets are entered by the employer; coverage is the share of assigned profiles listing that skill.</p></div>
          <div className="employer-target-options">{skills.map((skill) => <label key={skill.id}><input type="checkbox" checked={targetSkillIds.includes(skill.id)} onChange={(event) => setTargetSkillIds((current) => event.target.checked ? [...current, skill.id] : current.filter((id) => id !== skill.id))} /><span>{skill.name}</span></label>)}</div>
          <button className="button secondary small" type="button" disabled={saving} onClick={() => void saveTargets()}>Save target skills</button>
        </div>}
        {actionError && <p className="message error" role="alert">{actionError}</p>}
      </section>

      {selectedDepartmentRecord && <section className="panel employer-heatmap-section" aria-labelledby="employer-heatmap-title">
        <div className="section-heading"><span className="section-no">01</span><div><h2 id="employer-heatmap-title">Skills-gap heatmap · {selectedDepartmentRecord.name}</h2><p>Coverage is based on self-reported skill records, not an assessment or role benchmark.</p></div></div>
        {selectedDepartmentRecord.skill_coverage.length
          ? <div className="table-scroll"><table className="employer-heatmap"><caption>Department target-skill coverage across assigned profiles</caption><thead><tr><th scope="col">Target skill</th><th scope="col">Profiles with skill</th><th scope="col">Coverage</th><th scope="col">Gap to target</th></tr></thead><tbody>{selectedDepartmentRecord.skill_coverage.map((item) => <tr key={item.skill_id}>
            <th scope="row">{item.skill_name}</th><td>{item.members_with_skill} / {item.member_count}</td>
            <td><span className={`employer-coverage ${coverageClass(item.coverage_percent)}`}>{item.coverage_percent === null ? "No members" : `${item.coverage_percent}%`}</span></td>
            <td>{item.gap_percent === null ? "—" : `${item.gap_percent}%`}</td>
          </tr>)}</tbody></table></div>
          : <p className="message info">Choose target skills above to calculate department coverage and gaps.</p>}
      </section>}

      <div className="employer-team-layout">
        <section className="panel employer-members-section" aria-labelledby="employer-members-title">
          <div className="section-heading"><span className="section-no">02</span><div><h2 id="employer-members-title">Team profiles</h2><p>{visibleMembers.length} profile{visibleMembers.length === 1 ? "" : "s"} in this view.</p></div></div>
          {visibleMembers.length ? <div className="employer-member-list">{visibleMembers.map((member, index) => <article className={`employer-member-card${member.id === selectedMemberId ? " selected" : ""}`} key={member.id}>
            <button type="button" className="employer-member-open" onClick={() => { setSelectedMemberId(member.id); setPlan(null); setPlanError(""); }}>
              <span className="employer-member-number">PROFILE {String(index + 1).padStart(2, "0")}</span>
              <strong>{member.current_occupation || member.field_of_study || "Profile"}</strong>
              <span>{member.field_of_study} · {member.years_experience} years experience</span>
              <small>{member.skills.length} current skills · {member.department_name ?? "Unassigned"}</small>
            </button>
            <label className="employer-assignment"><span>Department</span><select aria-label={`Assign profile ${index + 1} to department`} value={member.department_id ?? ""} disabled={saving} onChange={(event) => void changeMemberDepartment(member.id, event.target.value)}><option value="">Unassigned</option>{dashboard.departments.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          </article>)}</div> : dashboard.member_count === 0
            ? <p className="message info">No saved synthetic profiles are available in this database yet. <Link href="/profile">Create or save a demo profile</Link>, then return here and reload to assign it to a department.</p>
            : <p className="message info">No profiles are in this group.</p>}
        </section>

        <section className="panel employer-member-detail" aria-labelledby="employer-detail-title">
          <div className="section-heading"><span className="section-no">03</span><div><h2 id="employer-detail-title">Profile detail</h2><p>Current skills, evidence coverage and self-reported development interests.</p></div></div>
          {!selectedMember ? <p className="message info">Select a team profile to inspect its skills.</p> : <>
            <div className="employer-detail-meta"><span>{selectedMember.field_of_study}</span><span>{selectedMember.department_name ?? "Unassigned"}</span><span>{selectedMember.status.replaceAll("_", " ")}</span></div>
            <h3>Current skills <small>self-reported proficiency</small></h3>
            {selectedMember.skills.length ? <ul className="employer-current-skills">{selectedMember.skills.map((skill) => <li key={`${skill.skill_id ?? skill.name}-${skill.name}`}><span><strong>{skill.name}</strong><small>{skill.skill_id ?? "Custom entry"} · {skill.evidence_record_count ? `${skill.evidence_record_count} linked record(s)` : "No linked evidence record"}</small></span><b>{skill.proficiency}</b></li>)}</ul> : <p className="message info">No current skills recorded.</p>}
            <p className="employer-evidence-note">Evidence coverage: {selectedMember.evidence_coverage_percent === null ? "not available (no skills recorded)" : `${selectedMember.evidence_coverage_percent}% of current skills have at least one linked profile record`}. This is a record-link count, not an AI confidence or proficiency score.</p>
            <h3>Self-reported skills to develop</h3>
            {selectedMember.skills_to_develop.length ? <div className="employer-interest-tags">{selectedMember.skills_to_develop.map((item) => <span key={item}>{item}</span>)}</div> : <p className="employer-muted">No development interests recorded.</p>}
            <h3>Target skill gaps</h3>
            {selectedMember.department_id
              ? selectedMemberGaps.length ? <ul className="employer-gap-list">{selectedMemberGaps.map((item) => <li key={item.skill_id}>{item.skill_name}<small>Department target · not currently listed in this profile</small></li>)}</ul> : <p className="employer-muted">No gaps against the current department targets.</p>
              : <p className="employer-muted">Assign this profile to a department to compare it with target skills.</p>}
            <button className="button employer-plan-button" type="button" disabled={planLoading || !selectedMember.department_id || selectedMemberGaps.length === 0} onClick={() => void requestLearningPlan(selectedMember)}>
              {planLoading ? "Generating learning plan…" : "Generate AI learning plan"}
            </button>
            {!selectedMember.department_id && <p className="employer-muted">Assign a department with target skills to enable the plan.</p>}
            {planError && <p className="message error" role="alert">{planError}</p>}
            {plan && <div className="employer-learning-plan" aria-live="polite">
              <span className="page-kicker"><span className="kicker-dot" /> AI-GENERATED · {plan.model}</span>
              <h3>Tailored learning plan</h3><p>{plan.summary}</p>
              <ol>{plan.steps.map((step) => <li key={`${step.skill_name}-${step.title}`}><strong>{step.title}</strong><span>{step.skill_name} · {step.resource_type} · {step.duration_hours} hours</span><p>{step.activity}</p></li>)}</ol>
              <small>{plan.notice}</small>
            </div>}
          </>}
        </section>
      </div>
    </>}
    <p className="employer-back-link"><Link href="/login">← Back to sign in</Link></p>
  </main>;
}

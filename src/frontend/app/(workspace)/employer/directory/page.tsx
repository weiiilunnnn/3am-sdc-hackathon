"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageIntro } from "../../WorkspaceStates";
import { ApiError, getEmployerDashboard, type EmployerMember, type EmployerTeamDashboard } from "@/lib/api";

function loadError(reason: unknown) {
  if (reason instanceof ApiError && reason.status >= 500) {
    return `The Employer API returned HTTP ${reason.status}. Check that FastAPI is running on port 8080.`;
  }
  return reason instanceof Error ? reason.message : "The company directory could not be loaded.";
}

export default function EmployerDirectoryPage() {
  const [dashboard, setDashboard] = useState<EmployerTeamDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("all");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setDashboard(await getEmployerDashboard());
    } catch (reason) {
      setError(loadError(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const members = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return (dashboard?.members ?? []).filter((member) => {
      const inDepartment = department === "all"
        || (department === "unassigned" ? member.department_id === null : member.department_id === department);
      const searchable = [
        member.current_occupation ?? "",
        member.field_of_study,
        member.department_name ?? "",
        ...member.skills.map((skill) => skill.name),
      ].join(" ").toLocaleLowerCase();
      return inDepartment && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [dashboard, department, query]);

  function memberTitle(member: EmployerMember) {
    return member.current_occupation || member.field_of_study || "Demo profile";
  }

  return <main className="page-wrap employer-page employer-directory-page">
    <PageIntro kicker="EMPLOYER VIEW · PEOPLE DIRECTORY" title={<>Your people,<br />at a glance.</>} description="Browse synthetic profiles in the shared demo database. Search by role, study area, department or listed skill." index="DIRECTORY / 02" />
    <div className="employer-notice" role="note"><strong>Demo directory:</strong> Only fictional profiles are shown. No HR authentication or company-level access control is implemented.</div>
    {loading && <div className="panel state-panel"><p role="status">Loading synthetic team profiles…</p></div>}
    {!loading && error && <div className="panel state-panel"><p className="message error" role="alert">{error}</p><button className="button secondary" type="button" onClick={() => void refresh()}>Try again</button></div>}
    {!loading && dashboard && <>
      <section className="panel employer-directory-controls" aria-label="Directory filters">
        <label className="field"><span className="label-text">Search profiles</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Role, study area or skill" /></label>
        <label className="field"><span className="label-text">Department</span><select value={department} onChange={(event) => setDepartment(event.target.value)}><option value="all">All profiles ({dashboard.member_count})</option><option value="unassigned">Unassigned ({dashboard.unassigned_count})</option>{dashboard.departments.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.member_count})</option>)}</select></label>
      </section>
      <section className="employer-directory-results" aria-label="Directory results" aria-live="polite">
        <p className="employer-directory-count">{members.length} profile{members.length === 1 ? "" : "s"} shown</p>
        {members.length ? <div className="employer-directory-grid">{members.map((member, index) => <article className="panel employer-directory-card" key={member.id}>
          <span className="employer-member-number">DEMO PROFILE {String(index + 1).padStart(2, "0")}</span>
          <h2>{memberTitle(member)}</h2>
          <p>{member.field_of_study} · {member.years_experience} years experience</p>
          <div className="employer-detail-meta"><span>{member.department_name ?? "Unassigned"}</span><span>{member.status.replaceAll("_", " ")}</span></div>
          <p className="employer-directory-skills"><strong>{member.skills.length} listed skills</strong>{member.skills.length ? ` · ${member.skills.map((skill) => skill.name).join(", ")}` : ""}</p>
        </article>)}</div> : dashboard.member_count === 0
          ? <div className="panel employer-directory-empty"><h2>No demo people in the directory yet</h2><p>Company X is set up as a demo company profile. Save a fictional team profile to the shared database to add a person to this directory.</p><Link className="button secondary" href="/profile">Create a demo person profile</Link></div>
          : <p className="panel employer-directory-empty" role="status">No profiles match these filters. Try a different search or department.</p>}
      </section>
    </>}
  </main>;
}

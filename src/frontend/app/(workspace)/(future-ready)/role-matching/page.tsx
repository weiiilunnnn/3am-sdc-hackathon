"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { request } from "@/lib/future-role-api";
import { initialiseRoleProfile, mergeRoleReference, updateRoleSession, useFutureRoleSession, type RoleResults } from "@/lib/future-role-session";
import CareerCard from "@/components/CareerCard";
import FutureRoleShell from "@/components/FutureRoleShell";
import ScenarioNotice from "@/components/ScenarioNotice";

export default function RoleMatching() {
  const session = useFutureRoleSession();
  const { profile, bootstrap: data, results: matches } = session;
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inflight = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  async function load() {
    setError(""); setReady(false);
    try { await initialiseRoleProfile(); setReady(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Reference data unavailable."); }
  }
  useEffect(() => { void load(); return () => { inflight.current?.abort(); if (timer.current) clearTimeout(timer.current); }; }, []);
  useEffect(() => {
    inflight.current?.abort(); if (timer.current) clearTimeout(timer.current);
    if (!profile) setBusy(false);
    if (ready && profile && (!matches || matches.role_query.trim() !== session.query.trim())) void calculate(0, session.query);
    return () => { inflight.current?.abort(); };
  }, [ready, profile]);
  useEffect(() => { if (matches) { const id = requestAnimationFrame(() => window.scrollTo(0, session.scrollY)); return () => cancelAnimationFrame(id); } }, [ready]);
  async function calculate(offset = 0, query = session.query) {
    if (!profile) return;
    if (timer.current) clearTimeout(timer.current);
    inflight.current?.abort(); const controller = new AbortController(); inflight.current = controller;
    query = query.trim(); setBusy(true); setError("");
    try {
      const result = await request<RoleResults>(query ? "/api/v2.1/roles/search" : "/api/v2/matches", { schema_version: query ? "2.1" : "2.0", profile, page_size: 5, offset, role_query: query }, controller.signal);
      if (!controller.signal.aborted) {
        const results = offset && matches && matches.role_query === result.role_query && matches.schema_version === result.schema_version ? { ...result, results: [...matches.results, ...result.results] } as RoleResults : result;
        updateRoleSession({ results, ...(!query && !offset && result.schema_version === "2.0" ? { recommendations: result } : {}) });
        mergeRoleReference([], result.sources);
      }
    } catch (e) { if (!controller.signal.aborted) { updateRoleSession({ results: null }); setError(e instanceof Error ? e.message : "Matching failed."); } }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  function changeQuery(value: string) {
    if (timer.current) clearTimeout(timer.current);
    inflight.current?.abort(); updateRoleSession({ query: value, scrollY: 0 }); setError("");
    if (!profile) return;
    setBusy(true);
    if (!value.trim()) {
      if (session.recommendations) updateRoleSession({ results: session.recommendations });
      void calculate(0, "");
    } else timer.current = setTimeout(() => void calculate(0, value), 300);
  }
  const search = matches?.schema_version === "2.1";
  const count = matches && "total_search_results" in matches ? matches.total_search_results : matches?.total_qualifying_roles;
  return <FutureRoleShell>
    <section className="intro-section"><div><p className="eyebrow">AIVERSECITY · FUTURE-READY WORKFORCE</p><h1>Build on what you know.<br /><em>Explore where you could go.</em></h1><p className="intro-copy">Discover sourced occupations and explore a learning path to your next step.</p></div></section>
    <section className="results-panel role-results-panel" aria-label="Future-Role Matching">
      <div className="results-heading"><div><p className="eyebrow">FUTURE-ROLE MATCHING</p><h2>{search ? "Search results" : "Recommended for you"}</h2><p className="small muted">Profile relevance is not readiness or hiring probability. {search ? "Sorted by backend profile relevance; recommendation filters do not apply." : "Personalised recommendations retain their existing qualification rules."}</p></div></div>
      {error && <div role="alert" className="error-panel compact">{error}<button className="text-button" onClick={() => void (ready ? calculate() : load())}>Try again</button></div>}
      {!ready && !error && <p role="status">Loading verified reference data...</p>}
      {ready && !profile && <div className="empty-state"><h3>Complete your profile to see personalised matches</h3><p>Save your skills on the Profile page, then return here for personalised matches.</p><Link className="secondary" href="/profile">Go to your profile</Link></div>}
      {ready && profile && <p className="micro notice">{profile.is_synthetic ? `Synthetic profile: ${profile.profile_id}` : "Current skills profile"}</p>}
      <form className="catalogue-toolbar role-search-toolbar" onSubmit={e => { e.preventDefault(); void calculate(); }}>
        <label htmlFor="occupation-search">Search occupations</label><div className="role-search-input-row">
          <input id="occupation-search" type="search" maxLength={100} value={session.query} disabled={!ready || !profile} onChange={e => changeQuery(e.target.value)} />
          <button type="submit" className="secondary role-search-submit" aria-label="Search roles" title="Search roles" disabled={busy || !profile}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg></button>
        </div>
      </form>
      {data && <p className="micro muted" data-testid="index-status">ESCO {data.dataset_version} · {data.occupation_count} indexed occupations · {data.data_source_status}</p>}
      {data?.coverage_warning && <p className="notice small">{data.coverage_warning}</p>}
      {matches?.scenario_context && data && <ScenarioNotice context={matches.scenario_context} sources={data.sources} />}
      {busy && <p role="status">Comparing your skills against verified requirements...</p>}
      {matches && <div aria-live="polite" aria-busy={busy}>
        <p className="small result-count">{count} {search ? "title search results" : "qualifying occupations"}</p>
        {matches.unknown_user_skills.length > 0 && <p className="notice">Unresolved skills, excluded from scoring: {matches.unknown_user_skills.join(", ")}</p>}
        {!matches.results.length && <div className="empty-state"><h3>{search ? "No occupations found" : matches.insufficient_evidence ? "Add more specific skills" : "No qualifying roles found"}</h3><p>{search ? "No indexed preferred title or official alternative label matches this search." : "The recommendation threshold and evidence safeguards have not been lowered to force results."}</p></div>}
        <div className="compact-results-grid">{matches.results.map(role => <CareerCard key={role.role_id} match={role} busy={busy} />)}</div>
        {matches.next_offset !== null && <button className="secondary see-more" disabled={busy} onClick={() => void calculate(matches.next_offset!, matches.role_query)}>{search ? "Show more search results" : "Show more qualifying roles"}</button>}
      </div>}
    </section>
  </FutureRoleShell>;
}

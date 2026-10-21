"use client";
import { useEffect, useRef, useState } from "react";
import type { Bootstrap, DiscoveryResponse, RoleSearchResponse, Pathway, Profile, Skill, Source } from "@/lib/contracts";
import { request } from "@/lib/future-role-api";
import ProfileIntake from "@/components/ProfileIntake";
import CareerCard from "@/components/CareerCard";
import PathwayView from "@/components/PathwayView";
import ScenarioNotice from "@/components/ScenarioNotice";

export default function Home() {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [matches, setMatches] = useState<DiscoveryResponse | RoleSearchResponse | null>(null);
  const [pathway, setPathway] = useState<Pathway | null>(null);
  const [roleQuery, setRoleQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pathBusy, setPathBusy] = useState(false);
  const [tab, setTab] = useState<"matches" | "pathway">("matches");
  const inflight = useRef<AbortController | null>(null);
  const pathInflight = useRef<AbortController | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recommendations = useRef<DiscoveryResponse | null>(null);
  const isSearch = matches?.schema_version === "2.1";
  const resultCount = matches && "total_search_results" in matches ? matches.total_search_results : matches?.total_qualifying_roles;
  async function load() {
    setLoading(true); setError("");
    try { const result = await request<Bootstrap>("/api/v2/bootstrap"); setData(result); setProfile(result.profiles[0]); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not reach the service."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); return () => { if (searchTimer.current) clearTimeout(searchTimer.current); inflight.current?.abort(); pathInflight.current?.abort(); }; }, []);
  function changeProfile(next: Profile) { if (searchTimer.current) clearTimeout(searchTimer.current); recommendations.current = null; inflight.current?.abort(); pathInflight.current?.abort(); setBusy(false); setPathBusy(false); setMatches(null); setPathway(null); setTab("matches"); setError(""); setProfile(next); setRoleQuery(""); }
  async function calculate(offset = 0, query = roleQuery) {
    if (!profile) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    query = query.trim();
    inflight.current?.abort(); pathInflight.current?.abort();
    const controller = new AbortController(); inflight.current = controller;
    setBusy(true); setPathBusy(false); setError(""); setPathway(null); setTab("matches");
    try { const result = await request<DiscoveryResponse | RoleSearchResponse>(query ? "/api/v2.1/roles/search" : "/api/v2/matches", { schema_version: query ? "2.1" : "2.0", profile, page_size: 5, offset, role_query: query }, controller.signal); if (!controller.signal.aborted) { if (!query && !offset && result.schema_version === "2.0") recommendations.current = result; setMatches(previous => offset && previous && previous.schema_version === result.schema_version && previous.role_query === result.role_query ? { ...result, results: [...previous.results, ...result.results] } as typeof result : result); mergeReference([], result.sources); } }
    catch (e) { if (!controller.signal.aborted) { setMatches(null); setError(e instanceof Error ? e.message : "Matching failed."); } }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  function changeQuery(value: string) {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    inflight.current?.abort(); pathInflight.current?.abort();
    setRoleQuery(value); setBusy(true); setPathBusy(false); setError("");
    if (!value.trim()) {
      if (recommendations.current) setMatches(recommendations.current);
      void calculate(0, "");
    } else searchTimer.current = setTimeout(() => void calculate(0, value), 300);
  }
  async function selectRole(roleId: string) {
    if (!profile || !matches) return;
    pathInflight.current?.abort(); const controller = new AbortController(); pathInflight.current = controller;
    setPathBusy(true); setError(""); setPathway(null);
    try { const [result, detail] = await Promise.all([request<Pathway>("/api/pathways", { schema_version: "1.0", profile, role_id: roleId, scenario_config: matches.scenario_context }, controller.signal), request<{skills: Skill[]; sources: Source[]}>(`/api/v2/roles/detail?role_id=${encodeURIComponent(roleId)}`, undefined, controller.signal)]); if (!controller.signal.aborted) { mergeReference(detail.skills, detail.sources); setPathway(result); setTab("pathway"); document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth", block: "start" }); } }
    catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Pathway unavailable."); }
    finally { if (!controller.signal.aborted) setPathBusy(false); }
  }
  function mergeReference(skills: Skill[], sources: Source[] = []) {
    setData(current => current ? { ...current, skills: [...new Map([...current.skills, ...skills].map(s => [s.skill_id, s])).values()], sources: [...new Map([...current.sources, ...sources].map(s => [s.source_id, s])).values()] } : current);
  }
  return <div className="app-shell">
    <header className="app-header"><a className="brand" href="/role-matching" aria-label="3AM FutureReady home"><span className="brand-mark" aria-hidden="true">↗</span><span>Future<span className="brand-accent">Ready</span><small>BY TEAM 3AM</small></span></a><div className="header-right"><span className="header-label">YOUR SKILLS. YOUR NEXT CHAPTER.</span><span className="demo-pill"><span />SYNTHETIC PROFILES ONLY</span></div></header>
    <main className="app-main"><section className="intro-section"><div><p className="eyebrow">AIVERSECITY · FUTURE-READY WORKFORCE</p><h1>Build on what you know.<br /><em>Explore where you could go.</em></h1><p className="intro-copy">Understand your skills, discover relevant technology roles, and find a sourced learning path to your next step.</p></div><div className="intro-art" aria-hidden="true"><span className="orbit orbit-one" /><span className="orbit orbit-two" /><div className="growth-bars"><span /><span /><span /><span /></div><span className="art-arrow">↗</span><span className="art-caption">LEARNING MOVES YOU FORWARD</span></div></section>
    <div className="journey"><span><b>01</b> Your starting skills</span><i aria-hidden="true">→</i><span><b>02</b> Discover role matches</span><i aria-hidden="true">→</i><span><b>03</b> Plan your learning</span></div>
    {loading ? <div className="loading-state" role="status"><span className="spinner" />Loading verified reference data…</div> : !data || !profile ? <div className="error-panel" role="alert"><h2>We couldn’t load the reference data</h2><p>{error}</p><button className="primary" onClick={load}>Try again</button></div> : <div className="workspace-grid">
      <ProfileIntake onSkillsLoaded={mergeReference} data={data} profile={profile} onChange={changeProfile} onSubmit={() => void calculate()} busy={busy} />
      <section className="results-panel" id="workspace"><div className="results-toolbar"><div className="view-tabs" role="tablist" aria-label="Career exploration view"><button role="tab" aria-selected={tab === "matches"} onClick={() => setTab("matches")}>Role matches{matches ? ` (${resultCount})` : ""}</button><button role="tab" aria-selected={tab === "pathway"} disabled={!pathway} onClick={() => setTab("pathway")}>Learning pathway</button></div><span className="reference-label">ESCO {data.dataset_version} · EU REFERENCE</span></div>
      {error && <div className="error-panel compact" role="alert">{error}<button className="text-button" onClick={() => setError("")}>Dismiss</button></div>}
      {tab === "matches" && <>
        <div className="results-heading"><div><p className="eyebrow">EVIDENCE, WITH CONTEXT</p><h2>{isSearch ? "Occupation search results" : matches ? "Your role matches" : "A clearer next step starts here"}</h2><p className="small muted">Skill alignment · not hiring probability. {isSearch ? "Search results ranked by profile relevance; recommendation filters do not apply." : "Ranked by profile relevance."} Current job-market demand is not included.</p></div><span className="round-icon" aria-hidden="true">↗</span></div>
        <p className="micro" data-testid="index-status">{data.data_source_status === "local_full" ? "Full official API collection indexed locally" : "Limited subset fallback"} - {data.occupation_count ?? data.roles.length} occupations - ESCO {data.dataset_version}</p>
        <form className="catalogue-toolbar role-search-toolbar" onSubmit={e => { e.preventDefault(); void calculate(); }}>
          <label htmlFor="occupation-search">Search occupations</label>
          <div className="role-search-input-row">
            <input id="occupation-search" type="search" maxLength={100} value={roleQuery} onChange={e => changeQuery(e.target.value)} />
            <button type="submit" className="secondary role-search-submit" aria-label="Search roles" title="Search roles" disabled={busy}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
            </button>
          </div>
        </form>
        {data.coverage_warning && <p className="notice small">{data.coverage_warning}</p>}
        {matches?.scenario_context && <ScenarioNotice context={matches.scenario_context} sources={data.sources} />}
        {busy && <div role="status" className="inline-status"><span className="spinner" />Comparing your skills against verified requirements…</div>}{pathBusy && <div role="status" className="inline-status"><span className="spinner" />Building your personalised starter pathway…</div>}
        {!matches && !busy && <div className="empty-state"><div className="empty-icon" aria-hidden="true">✳</div><h3>See the possibilities in your skills.</h3><p>Choose a synthetic profile or edit its skills, then find matching roles. Every occupation is grounded in a verified source.</p><div className="empty-facts"><span><strong>{data.occupation_count ?? data.roles.length}</strong> indexed occupations</span><span><strong>{data.skill_count ?? data.skills.length}</strong> indexed concepts</span></div></div>}
        {matches && <div aria-live="polite" aria-busy={busy} className={busy ? "results-list dimmed" : "results-list"}>
          {matches.unknown_user_skills.length > 0 && <p className="notice">Unresolved skills, excluded from scoring: {matches.unknown_user_skills.join(", ")}</p>}
          <p className="small result-count">{isSearch ? `${resultCount} title search results - recommendation filters do not apply` : `${matches.total_qualifying_roles} qualifying occupations - threshold ${matches.qualification_threshold_pct}%`} - {matches.recognised_user_skill_count} recognised listed skills</p>

          {!matches.results.length && <div className="empty-state"><h3>{isSearch ? "No occupations found" : matches.insufficient_evidence ? "Add more specific skills" : "No qualifying roles found"}</h3><p>{isSearch ? "No indexed preferred title or official alternative label matches this search. Try another title or clear the search." : matches.insufficient_evidence ? "Add at least two distinct recognised skills, including occupationally specific evidence. One skill or generic skills alone cannot qualify a role." : "Confirm your listed skills or clear the title search. The relevance threshold has not been lowered to force recommendations."}</p></div>}
          {matches.results.map(m => <CareerCard key={m.role_id} match={m} sources={data.sources} onSelect={() => void selectRole(m.role_id)} busy={busy || pathBusy} />)}
          {matches.next_offset !== null && <button className="secondary see-more" disabled={busy} onClick={() => void calculate(matches.next_offset!, matches.role_query)}>{isSearch ? "Show more search results" : "Show more qualifying roles"}</button>}
          <details className="method-panel scoring-footer" data-testid="scoring-footer"><summary>How recommendations work / Limitations</summary>
            <p className="small">Profile relevance measures how your listed, recognised skills relate to an ESCO occupation. It does not include current job-market demand or measure readiness or hiring probability.</p>
            <p className="small">The backend weights skills by 1 + ln((N+1)/(df+1)), using the full occupation index. Essential links receive strength 1, optional links 0.4. Weighted role overlap is divided by the weight of all recognised listed skills. Roles must meet the application-defined {matches.qualification_threshold_pct}% threshold, two distinct matching concepts, an essential match and a non-transversal informative match occurring in no more than 25% of occupations.</p>
            <p className="small">Documented essential coverage remains separate under Why this match. Unmentioned requirements are not yet evidenced, not confirmed deficiencies. Areas use sourced broader-skill links with an application-defined single-parent display rule, or actual sourced concept names when grouping is unavailable. They do not change scores.</p>
            {matches.warnings.map(w => <p className="micro muted" key={w}>{w}</p>)}<p className="micro">Method: {matches.scoring_method} - ESCO {matches.esco_release} - {matches.data_source_status} - {matches.discovered_candidate_count} candidates. Qualification diagnostics: {Object.entries(matches.diagnostic_counts).map(([key, value]) => `${key}: ${value}`).join("; ")}. European reference data do not establish Malaysian demand.</p>
          </details></div>}

      </>}
      {tab === "pathway" && pathway && <>{pathway.status === "resource_not_found" && <p className="notice small">No verified pathway resources available yet for this role. Coverage remains incomplete.</p>}<PathwayView pathway={pathway} data={data} onBack={() => setTab("matches")} /></>}
      <div className="integration-note"><span aria-hidden="true">◌</span><p><strong>More context, when the evidence is ready.</strong><br />Real trend data, sourced SDG mappings and moderate / fast AI scenarios await team integration. No forecasts or SDG connections are invented.</p></div>
      </section>
    </div>}
    <footer className="app-footer"><p>{data?.attribution ?? "Occupational reference: European Commission ESCO."}<br /><span>English subset; coverage scoring and resource mappings are project additions. No European Commission endorsement implied.</span></p><p>Public reference data. Synthetic people.<br /><span>No LLM or paid API required.</span></p></footer></main>
  </div>;
}

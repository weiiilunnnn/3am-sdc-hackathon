"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getEmployment, refreshEmployment, type EmploymentDashboard, type EmploymentJob } from "../../lib/api";

const PAGE_SIZE = 10;

export type ProfileSkillRef = { skill_id: string | null; skill_name: string };

export type EmploymentSnapshotViewProps = {
  dashboard: EmploymentDashboard | null;
  loading: boolean;
  refreshing: boolean;
  error: string;
  cooldownSeconds: number;
  onRetry: () => void;
  onRefresh: () => void;
  topicLabels?: Record<string, string>;
  profileSkills?: ProfileSkillRef[];
  initialTopicFilter?: string;
  initialSkillFilter?: string;
};

function fmt(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function fmtDay(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

export function formatCooldown(seconds: number) {
  const s = Math.max(0, Math.ceil(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function JobItem({ job, topicLabels }: { job: EmploymentJob; topicLabels: Record<string, string> }) {
  return <li className="job-item" data-testid={`job-${job.source_job_id}`}>
    <div className="job-head">
      <strong>{job.title}</strong>
      <span className="job-id">Remote OK ID {job.source_job_id}</span>
    </div>
    <p className="job-line">{job.company || "Company unspecified"} · {job.location || "Location unspecified"} · Published {fmtDay(job.published_at)}</p>
    <p className="job-line"><a href={job.source_url} target="_blank" rel="noopener noreferrer" data-testid={`link-job-${job.source_job_id}`}>View original posting on Remote OK<span className="visually-hidden"> (opens in new tab)</span></a></p>
    {job.topic_ids.length > 0 && <p className="job-line">Topics: {job.topic_ids.map((id) => topicLabels[id] ?? id).join(", ")}</p>}
    <details className="job-evidence">
      <summary>Provenance and keyword evidence ({job.skill_mentions.length} configured skill{job.skill_mentions.length === 1 ? "" : "s"} mentioned)</summary>
      <p className="job-line">Original source date: {job.source_date} · Normalized publication: {job.published_at} · Retrieved: {job.retrieved_at}</p>
      {job.tags.length > 0 && <p className="job-line">Provider tags: {job.tags.join(", ")}</p>}
      {job.skill_mentions.length ? <ul>{job.skill_mentions.map((m) => <li key={m.skill_id}><b>{m.label}</b>: terms “{m.terms.join("”, “")}” found in {m.fields.join(", ")}</li>)}</ul> : <p className="job-line muted">No configured skill keywords mentioned.</p>}
    </details>
  </li>;
}

export function EmploymentSnapshotView({
  dashboard, loading, refreshing, error, cooldownSeconds, onRetry, onRefresh,
  topicLabels = {}, profileSkills = [], initialTopicFilter = "", initialSkillFilter = "",
}: EmploymentSnapshotViewProps) {
  const [topic, setTopic] = useState(initialTopicFilter);
  const [skill, setSkill] = useState(initialSkillFilter);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const jobs = dashboard?.jobs ?? [];
  const filtered = useMemo(() => jobs.filter((j) =>
    (!topic || j.topic_ids.includes(topic)) && (!skill || j.skill_mentions.some((m) => m.skill_id === skill))), [jobs, topic, skill]);
  const topicIds = useMemo(() => Array.from(new Set([...Object.keys(dashboard?.topic_counts ?? {}), ...jobs.flatMap((j) => j.topic_ids)])).sort(), [dashboard, jobs]);
  const overlap = useMemo(() => {
    if (!dashboard) return [];
    const ids = new Set(profileSkills.map((s) => s.skill_id).filter((id): id is string => !!id));
    return dashboard.skill_counts.filter((c) => ids.has(c.skill_id));
  }, [dashboard, profileSkills]);

  const hasCache = jobs.length > 0;
  const status = dashboard?.refresh_status;
  const coolingDown = cooldownSeconds > 0;
  const refreshLabel = refreshing ? "Checking Remote OK…" : coolingDown ? `Next refresh in ${formatCooldown(cooldownSeconds)}` : "Refresh employment snapshot";

  return <section className="panel employment-panel" aria-labelledby="employment-heading" data-testid="section-employment">
    <div className="section-heading"><span className="section-no">EM</span><div><h2 id="employment-heading">Employment-posting snapshot · Remote OK</h2><p>A separate source from the OpenAlex research cards above. Postings are not merged with research counts.</p></div></div>

    <div className="notice" role="note" data-testid="notice-employment-interpretation">
      <span className="notice-icon" aria-hidden="true">i</span>
      <div><strong>A sample of remote postings, not the global market</strong>Counts use the retained Remote OK postings in this cached snapshot as the denominator. A “mention” means one of the configured keywords appeared in the posting’s title, tags or description — it is not a confirmed requirement. No growth, forecast or global-demand ranking is implied. International scope; not representative of any country or labour market.</div>
    </div>

    <div className="radar-toolbar">
      <div>
        <span className="mode-pill" data-testid="status-employment-mode">{hasCache ? "REAL · CACHED POSTINGS" : "REAL MODE · NO CACHE YET"}</span>
        <p className="status-line" style={{ margin: "8px 0 0" }} data-testid="status-employment-meta">Last successful collection: {fmt(dashboard?.last_successful_refresh)} · Last attempt: {fmt(dashboard?.last_attempt_at)} · Feed updated: {fmt(dashboard?.source_feed_updated_at)}</p>
      </div>
      <button className="button" type="button" onClick={onRefresh} disabled={loading || refreshing || coolingDown} aria-busy={refreshing} data-testid="button-refresh-employment">{refreshLabel}</button>
    </div>
    <p className="field-hint">Live refresh is attempted at most once every 24 hours; loading this page only reads the cache.</p>

    {refreshing && <div className="message info" role="status" data-testid="status-employment-refreshing">Requesting the Remote OK feed. Cached postings stay visible until a successful result replaces them.</div>}
    {status === "cooldown" && coolingDown && <div className="message info" role="status" data-testid="status-employment-cooldown">Refresh is cooling down ({formatCooldown(cooldownSeconds)} remaining). Cached postings remain available.</div>}
    {status === "failed" && <div className="message error" role="alert" data-testid="status-employment-failed">The last collection failed{dashboard?.error_message ? `: ${dashboard.error_message}` : "."} {hasCache ? "Showing the previous cached snapshot." : "No cached snapshot is available."}</div>}
    {dashboard?.cache_fallback && status !== "failed" && <div className="message info" role="status" data-testid="status-employment-fallback"><strong>Showing cached postings.</strong> {dashboard.error_message ?? ""}</div>}
    {error && <div className="message error" role="alert" data-testid="error-employment"><span>{error}</span> <button type="button" className="button ghost small" onClick={onRetry} data-testid="button-retry-employment">Retry cached load</button></div>}

    {loading && dashboard && <p className="message info" role="status">Reloading the cache. Existing postings remain visible.</p>}
    {loading && !dashboard ? <div className="skeleton" style={{ height: 160, marginTop: 14 }} aria-label="Loading cached employment postings" role="status" data-testid="loading-employment" /> : !dashboard ? (!error && <p className="message info" role="status">No employment cache loaded yet.</p>) : !hasCache ? <p className="message info" role="status" data-testid="empty-employment">No Remote OK postings are cached yet. Collection only happens when you choose to refresh.</p> : <>
      <dl className="topic-meta employment-meta" data-testid="employment-source-meta">
        <div className="meta-item"><dt>Source</dt><dd>Data from <a href={dashboard.source.website_url} target="_blank" rel="noopener noreferrer">{dashboard.source.name}</a> · <a href={dashboard.source.url} target="_blank" rel="noopener noreferrer">JSON feed</a> · <a href={dashboard.source.terms_url} target="_blank" rel="noopener noreferrer">Terms</a> (reviewed {dashboard.source.terms_reviewed_on}) · <a href={dashboard.source.documentation_url} target="_blank" rel="noopener noreferrer">API / FAQ</a></dd></div>
        <div className="meta-item"><dt>Reuse</dt><dd>{dashboard.source.permitted_use}</dd></div>
        <div className="meta-item"><dt>Measurement</dt><dd>{dashboard.source.measurement}</dd></div>
        <div className="meta-item"><dt>Coverage</dt><dd>{dashboard.source.coverage}</dd></div>
        <div className="meta-item"><dt>Published range</dt><dd>{fmtDay(dashboard.published_from)} – {fmtDay(dashboard.published_to)}</dd></div>
        <div className="meta-item"><dt>Records</dt><dd>{dashboard.received_records} received · {dashboard.excluded_records} excluded · {dashboard.posting_count} retained (denominator) · sample limit {dashboard.source.sample_limit}</dd></div>
        <div className="meta-item"><dt>Employers</dt><dd>{dashboard.employer_count} distinct</dd></div>
        <div className="meta-item"><dt>Locations</dt><dd>{dashboard.unknown_location_count} with unspecified location. Provider labels: {dashboard.location_labels.length ? dashboard.location_labels.join("; ") : "none"}</dd></div>
        <div className="meta-item"><dt>Refresh policy</dt><dd>{dashboard.source.refresh_policy}</dd></div>
      </dl>
      <div className="warning-strip"><strong>Limitations.</strong> {dashboard.source.limitations}</div>

      <div className="table-scroll">
        <table className="data-table" data-testid="table-skill-counts">
          <caption>Configured skill keyword mentions across {dashboard.posting_count} retained postings</caption>
          <thead><tr><th scope="col">Skill</th><th scope="col">Postings mentioning</th><th scope="col">Share of retained</th></tr></thead>
          <tbody>{dashboard.skill_counts.length ? dashboard.skill_counts.map((c) => <tr key={c.skill_id}><th scope="row">{c.label}</th><td>{c.posting_count}</td><td>{c.share_percent.toLocaleString(undefined, { maximumFractionDigits: 1 })}%</td></tr>) : <tr><td colSpan={3}>No configured keywords were mentioned.</td></tr>}</tbody>
        </table>
      </div>

      {profileSkills.length > 0 && <div className="message info" data-testid="employment-profile-overlap"><strong>Saved profile · exact skill-ID overlap only.</strong> {overlap.length ? `Your saved skills with matching configured IDs: ${overlap.map((c) => `${c.label} (${c.posting_count} posting mentions)`).join(", ")}.` : "None of your saved skill IDs match configured keywords in this snapshot."} This is a keyword-mention overlap, not a career or job match.</div>}

      <div className="employment-filters">
        <label className="field"><span className="label-text">Filter by topic</span><select value={topic} onChange={(e) => { setTopic(e.target.value); setVisible(PAGE_SIZE); }} data-testid="select-employment-topic"><option value="">All topics</option>{topicIds.map((id) => <option key={id} value={id}>{topicLabels[id] ?? id} ({dashboard.topic_counts[id] ?? 0})</option>)}</select></label>
        <label className="field"><span className="label-text">Filter by skill mention</span><select value={skill} onChange={(e) => { setSkill(e.target.value); setVisible(PAGE_SIZE); }} data-testid="select-employment-skill"><option value="">All skills</option>{dashboard.skill_counts.map((c) => <option key={c.skill_id} value={c.skill_id}>{c.label} ({c.posting_count})</option>)}</select></label>
      </div>
      <p className="status-line" role="status" aria-live="polite" data-testid="text-employment-filter-count">Showing {Math.min(visible, filtered.length)} of {filtered.length} matching postings ({dashboard.posting_count} retained).</p>
      {filtered.length === 0 ? <p className="message info" data-testid="empty-employment-filtered">No retained postings match these filters. That is zero matches in this sample only. <button type="button" className="button ghost small" onClick={() => { setTopic(""); setSkill(""); }}>Clear filters</button></p> : <>
        <ul className="job-list" data-testid="list-employment-jobs">{filtered.slice(0, visible).map((j) => <JobItem key={j.source_job_id} job={j} topicLabels={topicLabels} />)}</ul>
        {visible < filtered.length && <button type="button" className="button secondary" onClick={() => setVisible((v) => v + PAGE_SIZE)} data-testid="button-employment-more">Show {Math.min(PAGE_SIZE, filtered.length - visible)} more</button>}
      </>}
    </>}
  </section>;
}

export default function EmploymentSnapshot({ topicLabels, profileSkills }: { topicLabels?: Record<string, string>; profileSkills?: ProfileSkillRef[] }) {
  const [dashboard, setDashboard] = useState<EmploymentDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const r = await getEmployment(); setDashboard(r); setCountdown(Math.max(0, r.cooldown_seconds || 0)); }
    catch (e) { setError(e instanceof Error ? e.message : "Cached employment postings could not be loaded."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const ticking = countdown > 0;
  useEffect(() => {
    if (!ticking) return;
    const t = window.setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => window.clearInterval(t);
  }, [ticking]);

  async function refresh() {
    if (refreshing || countdown > 0) return;
    setRefreshing(true); setError("");
    try { const r = await refreshEmployment(); setDashboard(r); setCountdown(Math.max(0, r.cooldown_seconds || 0)); }
    catch (e) {
      const msg = e instanceof Error ? e.message : "Employment refresh failed.";
      setError(`${msg}${dashboard?.jobs.length ? " Cached postings remain shown." : ""}`);
    } finally { setRefreshing(false); }
  }

  return <EmploymentSnapshotView dashboard={dashboard} loading={loading} refreshing={refreshing} error={error} cooldownSeconds={countdown} onRetry={() => void load()} onRefresh={() => void refresh()} topicLabels={topicLabels} profileSkills={profileSkills} />;
}

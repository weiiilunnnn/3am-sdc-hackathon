"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiError, getProfileRelevance, getTrendDemo, getTrends, refreshTrends,
  type ProfileRelevance, type TrendDashboard, type TrendObservation, type TrendTopic,
} from "../../lib/api";
import { buildTrendChartGeometry } from "../../lib/chart-utils";
import EmploymentSnapshot from "./EmploymentSnapshot";

const PROFILE_KEY = "aiversecity.synthetic-profile-id";

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function TrendChart({ observations, label }: { observations: TrendObservation[]; label: string }) {
  const geometry = useMemo(() => buildTrendChartGeometry(observations, 620, 205, 32), [observations]);
  const years = geometry.points;
  if (!years.length) return <div className="message info" role="status" data-testid="empty-observations">No year observations are available for this topic.</div>;
  const labelIndices = new Set([0, Math.floor((years.length - 1) / 2), years.length - 1]);
  return <div>
    <svg className="chart" viewBox="0 0 620 205" role="img" aria-label={`${label} research activity by publication year; missing years are shown as gaps`} data-testid={`chart-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
      <line x1="32" y1="31" x2="588" y2="31" className="chart-grid" />
      <line x1="32" y1="91" x2="588" y2="91" className="chart-grid" />
      <line x1="32" y1="173" x2="588" y2="173" className="chart-grid" />
      {geometry.segments.map((segment, index) => <polyline key={index} points={segment} className="chart-line" />)}
      {geometry.points.map((point, index) => <g key={`${point.year}-${index}`}><circle className="chart-point" cx={point.x} cy={point.y} r="4.5"><title>{point.year}: {point.value.toLocaleString()} records</title></circle>{labelIndices.has(index) && <text className="chart-label" textAnchor={index === 0 ? "start" : index === years.length - 1 ? "end" : "middle"} x={point.x} y="197">{point.year}</text>}</g>)}
    </svg>
    <div className="observation-strip" aria-label="Year-by-year observations">
      {[...observations].sort((a, b) => a.period_year - b.period_year).map((observation) => <span className="observation" key={`${observation.period_year}-${observation.period_label}`} data-testid={`observation-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${observation.period_year}`}><b>{observation.value.toLocaleString()}</b>{observation.period_label || observation.period_year}</span>)}
    </div>
    <p className="field-hint" style={{ margin: "8px 0 0" }}>Each point is an observed publication-year count. Unreported years remain gaps; no values are interpolated.</p>
  </div>;
}

function ChangeReadout({ topic }: { topic: TrendTopic }) {
  const change = topic.change;
  const valid = change.status === "available" && change.compared_years?.length === 2 && Number.isFinite(change.absolute_change);
  return <div className="change-box" data-testid={`change-${topic.topic_id}`}>
    {valid ? <><span className="change-value">{change.absolute_change! > 0 ? "+" : ""}{change.absolute_change!.toLocaleString()}</span><p>{Number.isFinite(change.percentage_change) && <strong>{change.percentage_change! > 0 ? "+" : ""}{change.percentage_change!.toLocaleString(undefined, { maximumFractionDigits: 1 })}% </strong>}from {change.compared_years![0]} to {change.compared_years![1]} · {change.explanation}</p></> : <><span className="change-value" style={{ color: "var(--muted)" }}>—</span><p>{change.explanation || "A comparable change is not available. More observations or a non-zero baseline are needed."}</p></>}
  </div>;
}

function TopicCard({ topic, mode }: { topic: TrendTopic; mode: "real" | "synthetic" }) {
  return <article className="panel topic-card" data-testid={`card-topic-${topic.topic_id}`}>
    <div className="topic-top"><h2>{topic.label}</h2><span className="topic-tag">{topic.status === "available" ? "OBSERVATIONS AVAILABLE" : "LIMITED SAMPLE"}</span></div>
    <p className="definition">{topic.definition}</p>
    <TrendChart observations={topic.observations} label={topic.label} />
    <ChangeReadout topic={topic} />
    <dl className="topic-meta">
      <div className="meta-item"><dt>Measurement</dt><dd>{topic.measurement}</dd></div>
      <div className="meta-item"><dt>Source</dt><dd>{topic.source_name}</dd></div>
      <div className="meta-item"><dt>Source URL</dt><dd>{topic.source_url ? <a href={topic.source_url} target="_blank" rel="noreferrer">{topic.source_url}</a> : "Not provided by source"}</dd></div>
      <div className="meta-item"><dt>Observation period</dt><dd>{topic.observations.length ? `${Math.min(...topic.observations.map((o) => o.period_year))}–${Math.max(...topic.observations.map((o) => o.period_year))} publication years` : "No observed years"}</dd></div>
      <div className="meta-item"><dt>Retrieved</dt><dd>{topic.observations.length ? [...topic.observations].sort((a, b) => b.retrieved_at.localeCompare(a.retrieved_at))[0].retrieved_at : "No timestamp supplied"}</dd></div>
      <div className="meta-item"><dt>Data mode</dt><dd>{mode === "real" ? "Real cached research observations" : "Synthetic demonstration data"}</dd></div>
    </dl>
    <div className="warning-strip"><strong>Interpret with care.</strong> {topic.limitations} Counts reflect research activity, not job demand or hiring volume.</div>
  </article>;
}

export default function RadarPage() {
  const [dashboard, setDashboard] = useState<TrendDashboard | null>(null);
  const [demo, setDemo] = useState<TrendDashboard | null>(null);
  const [showDemo, setShowDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [relevance, setRelevance] = useState<ProfileRelevance | null>(null);
  const [relevanceError, setRelevanceError] = useState("");
  const [relevanceLoading, setRelevanceLoading] = useState(false);
  const [profileId, setProfileId] = useState("");
  const [topicFilter, setTopicFilter] = useState("");

  const loadCached = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getTrends();
      setDashboard(result);
      setCountdown(Math.max(0, result.cooldown_seconds || 0));
      let id = "";
      try { id = localStorage.getItem(PROFILE_KEY) ?? ""; } catch { id = ""; }
      setProfileId(id);
      if (id) {
        setRelevanceLoading(true);
        getProfileRelevance(id).then(setRelevance).catch((reason: unknown) => {
          setRelevanceError(reason instanceof Error ? reason.message : "Profile relevance could not be loaded.");
        }).finally(() => setRelevanceLoading(false));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Cached research observations could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadCached(); }, [loadCached]);
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setInterval(() => setCountdown((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [countdown > 0]);

  async function refreshResearch() {
    if (refreshing || countdown > 0) return;
    setRefreshing(true);
    setError("");
    try {
      const result = await refreshTrends();
      setDashboard(result);
      setCountdown(Math.max(0, result.cooldown_seconds || 0));
      if (result.refresh_status === "cooldown") setError("Refresh is cooling down. The cached data remains available.");
      else if (result.refresh_status === "failed") setError(result.error_message || "The live source could not be refreshed.");
      else setError("");
      if (profileId) {
        getProfileRelevance(profileId).then((value) => {
          setRelevance(value);
          setRelevanceError("");
        }).catch((reason: unknown) => {
          setRelevanceError(reason instanceof Error ? reason.message : "Profile relevance could not be loaded.");
        });
      }
    } catch (reason) {
      const apiError = reason instanceof ApiError ? reason : null;
      setError(reason instanceof Error ? reason.message : "Live refresh failed.");
      if (apiError?.status === 429) setCountdown(60);
      if (dashboard) setDashboard({ ...dashboard, refresh_status: apiError?.status === 429 ? "cooldown" : "failed", cache_fallback: dashboard.topics.some((topic) => topic.observations.length > 0), error_message: reason instanceof Error ? reason.message : "Refresh failed." });
    } finally {
      setRefreshing(false);
    }
  }

  async function loadDemo() {
    setShowDemo(true);
    if (demo) return;
    setDemoLoading(true);
    try {
      setDemo(await getTrendDemo());
    } catch (reason) {
      setError(reason instanceof Error ? `Synthetic demo unavailable: ${reason.message}` : "Synthetic demo unavailable.");
    } finally {
      setDemoLoading(false);
    }
  }

  const refreshText = refreshing || dashboard?.refresh_status === "refreshing" ? "Refreshing OpenAlex…" : countdown > 0 ? `Refresh available in ${countdown}s` : "Refresh research data";
  const topicLabels = useMemo(() => Object.fromEntries([...(dashboard?.topics ?? []), ...(demo?.topics ?? [])].map((t) => [t.topic_id, t.label])), [dashboard, demo]);
  const visibleTopics = (list: TrendTopic[]) => topicFilter ? list.filter((t) => t.topic_id === topicFilter) : list;
  const lastRetrieved = dashboard?.last_successful_refresh;

  return <main className="page-wrap">
    <div className="page-kicker"><span className="kicker-dot" /> FEATURE 02 <span>·</span> FUTURE SKILLS RADAR</div>
    <div className="hero-row">
      <div><h1>Research signals,<br />with the dates attached.</h1><p className="hero-copy">Explore what academic research has been publishing about selected skill topics. A useful signal to investigate — never a proxy for hiring demand.</p></div>
      <span className="hero-index">OPEN RESEARCH · INTERNATIONAL SCOPE / 02</span>
    </div>
    <div className="notice" role="note" data-testid="notice-research-interpretation">
      <span className="notice-icon" aria-hidden="true">i</span>
      <div><strong>Activity is not demand</strong>These counts describe research activity in the source and publication years shown. They do not measure vacancies, employer demand, salaries, or likely career outcomes. Missing years are left visible as gaps.</div>
    </div>
    <div className="radar-toolbar">
      <div><span className={`mode-pill ${dashboard?.mode === "synthetic" ? "synthetic" : ""}`} data-testid="status-real-mode">{dashboard?.mode === "synthetic" ? "SYNTHETIC DATA MODE" : dashboard?.topics.some((topic) => topic.observations.length > 0) ? "REAL · CACHED OBSERVATIONS" : "REAL MODE · NO CACHE YET"}</span><p className="status-line" style={{ margin: "8px 0 0" }} data-testid="status-refresh-meta">Last successful refresh: {formatDate(lastRetrieved)}{dashboard?.last_attempt_at ? ` · Last attempt: ${formatDate(dashboard.last_attempt_at)}` : ""}</p></div>
      <button className="button" type="button" onClick={refreshResearch} disabled={loading || refreshing || countdown > 0} data-testid="button-refresh-trends">{refreshText}</button>
    </div>
    {dashboard?.cache_fallback && <div className="message info" role="status" data-testid="status-cache-fallback"><strong>Showing cached data.</strong> The most recent refresh could not replace the saved observations. {dashboard.error_message || dashboard.notice}</div>}
    {dashboard?.notice && <p className="field-hint" data-testid="text-dashboard-notice">{dashboard.notice}</p>}
    {error && <div className="message error" role="alert" data-testid="error-radar"><span>{error}</span> <button type="button" className="button ghost small" onClick={() => void loadCached()} data-testid="button-retry-trends">Retry cached load</button></div>}
    <label className="field topic-filter"><span className="label-text">Filter research topics</span><select value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)} data-testid="select-research-topic"><option value="">All topics</option>{Object.entries(topicLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    <p className="field-hint">Research sources are international in scope (global OpenAlex index); results are not representative of any single country.</p>
    {loading ? <div className="radar-cards" aria-label="Loading cached research observations" data-testid="loading-trends"><div className="skeleton" /><div className="skeleton" /></div> : dashboard ? dashboard.topics.length ? visibleTopics(dashboard.topics).length ? <div className="radar-cards" data-testid="list-real-topics">{visibleTopics(dashboard.topics).map((topic) => <TopicCard topic={topic} mode={dashboard.mode} key={topic.topic_id} />)}</div> : <div className="panel message info" role="status" data-testid="empty-filtered-topics">No research topic matches this filter.</div> : <div className="panel message info" role="status" data-testid="empty-real-topics">No cached topic observations are available yet. A refresh is an explicit action and may retrieve new research records.</div> : !error && <div className="panel message info" role="status">No research cache loaded yet.</div>}

    {profileId && <section className="panel relevance-panel" aria-labelledby="profile-signal-heading" data-testid="panel-profile-relevance">
      <div className="section-heading"><span className="section-no">↗</span><div><h2 id="profile-signal-heading">Your saved profile · explicit topic links</h2><p>Only skill-to-topic associations returned for this saved synthetic profile are shown here.</p></div></div>
      {relevanceLoading && <div className="skeleton" style={{ height: 100 }} aria-label="Loading profile skill signals" data-testid="loading-relevance" />}
      {relevanceError && <div className="message error" role="alert" data-testid="error-relevance">{relevanceError}</div>}
      {relevance && <><p className="field-hint" data-testid="text-relevance-notice">{relevance.notice}</p><div className="relevance-list">{relevance.skills.map((skill, index) => <article className="relevance-item" key={`${skill.skill_id ?? "custom"}-${skill.skill_name}-${index}`} data-testid={`relevance-skill-${index}`}><strong>{skill.skill_name}</strong>{skill.status === "no_available_signal" && <div className="relevance-unavailable">No available signal</div>}<p>{skill.explanation}</p>{skill.topics.map((topic) => <p key={topic.topic_id}><b>{topic.label}</b> · {topic.explanation}{topic.latest_period_year ? ` Latest year: ${topic.latest_period_year}.` : ""}{!topic.signal_available ? " No topic signal available." : ""}</p>)}</article>)}</div></>}
    </section>}

    <EmploymentSnapshot topicLabels={topicLabels} profileSkills={relevance?.skills ?? []} />

    <section style={{ marginTop: 34 }}>
      <div className="radar-toolbar" style={{ marginBottom: 13 }}>
        <div><div className="page-kicker"><span className="kicker-dot" /> SEPARATE EXPLORATION</div><h2 style={{ font: "700 23px Manrope,sans-serif", letterSpacing: "-.04em", margin: "8px 0 0" }}>Synthetic demo signals</h2><p className="field-hint" style={{ margin: "5px 0 0" }}>A fictional dataset for interface exploration. It is never merged with or used as a fallback for the real cache.</p></div>
        {!showDemo ? <button type="button" className="button secondary" onClick={() => void loadDemo()} data-testid="button-open-synthetic-demo">Open synthetic demo</button> : <button type="button" className="button ghost" onClick={() => setShowDemo(false)} data-testid="button-hide-synthetic-demo">Hide demo</button>}
      </div>
      {showDemo && <div data-testid="section-synthetic-demo">
        <span className="mode-pill synthetic" data-testid="status-synthetic-mode">SYNTHETIC · FICTIONAL OBSERVATIONS</span>
        {demoLoading && <div className="radar-cards" style={{ marginTop: 15 }}><div className="skeleton" /></div>}
        {!demoLoading && demo && <><p className="message info" role="note" data-testid="notice-synthetic-demo"><strong>Fictional data, not OpenAlex.</strong> This opt-in demonstration must not be interpreted as real research activity.</p><div className="radar-cards" style={{ marginTop: 14 }}>{visibleTopics(demo.topics).map((topic) => <TopicCard topic={topic} mode="synthetic" key={topic.topic_id} />)}{!visibleTopics(demo.topics).length && <p className="message info" role="status">No demo topic matches this filter.</p>}</div></>}
        {!demoLoading && !demo && <p className="message info" role="status">Synthetic demo has not loaded. The real cached view remains separate.</p>}
      </div>}
    </section>
  </main>;
}

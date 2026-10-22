"use client";

import { useEffect, useMemo, useState } from "react";
import WorkspaceNav from "../WorkspaceNav";
import "./trend-signals.css";

type Skill = { id: string; name: string; is_profile_skill: boolean; posting_mentions: number | null };
type Evidence = { id: string; title: string; company: string | null; date: string; url: string; source: string; excerpt: string | null; excerpt_field: string | null };
type Finding = {
  id: string; type: "posting_prevalence" | "skill_cooccurrence" | "research_momentum"; headline: string;
  metric: { numerator: number; denominator: number; unit: string; change_percent?: number };
  chart: { kind: "bars" | "paired" | "line"; title: string; unit: string; max?: number; highlight_id?: string; items: { id?: string; label?: string; count: number; year?: number }[] };
  observation_period: { from: string; to: string }; source: { name: string; url: string; collected_at: string | null; scope: string };
  evidence: Evidence[]; employer_count: number | null; coverage: string; interpretation: string; why_relevant: string;
  stale: boolean; cached_explanation: { interpretation: string; model: string } | null;
};
type Experience = {
  profile: { id: string; label: string; occupation: string; skills: { id: string | null; name: string }[]; synthetic: boolean };
  samples: { id: string; label: string }[];
  context: { id: string | null; label: string | null; status: "supported" | "unsupported"; overridden: boolean; reason: string | null; available: { id: string; label: string }[] };
  insights: Finding[]; searchable_skills: Skill[];
  source: { research_retrieved_at: string | null; research_status: string; posting_retrieved_at: string | null; posting_status: string; posting_sample_size: number; posting_url: string; posting_snapshots_saved: number };
  processing: { extraction: string; mapping_version: string }; method: string;
};

function date(value: string | null) {
  if (!value) return "Not collected";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
function category(finding: Finding) {
  return finding.type === "posting_prevalence" ? "Current posting pattern" : finding.type === "skill_cooccurrence" ? "Current skill pairing" : "Research momentum";
}
function Icon({ type }: { type: Finding["type"] }) {
  if (type === "posting_prevalence") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" /></svg>;
  if (type === "skill_cooccurrence") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="12" r="5" /><circle cx="16" cy="12" r="5" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 19h18M5 16l5-5 4 3 5-8" /><circle cx="19" cy="6" r="1" /></svg>;
}
function Metric({ finding }: { finding: Finding }) {
  const { numerator, denominator, change_percent } = finding.metric;
  if (finding.type === "research_momentum") return <><strong>{change_percent === undefined ? "—" : `${change_percent > 0 ? "+" : ""}${change_percent.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`}</strong><span>{finding.observation_period.from} → {finding.observation_period.to} · {numerator.toLocaleString()} vs {denominator.toLocaleString()} records</span></>;
  return <><strong>{numerator} of {denominator}</strong><span>{finding.type === "skill_cooccurrence" ? "postings with the first skill also mention the second" : "relevant postings mention this skill"}</span></>;
}
function Chart({ finding }: { finding: Finding }) {
  const chart = finding.chart;
  const max = chart.max || finding.metric.denominator || 1;
  const values = chart.items;
  const lineMax = Math.max(1, ...values.map((item) => item.count));
  const points = values.map((item, index) => ({ x: 46 + index * 582 / Math.max(1, values.length - 1), y: 16 + (1 - item.count / lineMax) * 195, item }));
  return <div className="trend-chart"><div className="trend-chart-title"><h3>{chart.title}</h3><span>{chart.unit} · {chart.kind === "line" ? `${finding.observation_period.from}–${finding.observation_period.to}` : `n=${finding.type === "skill_cooccurrence" ? finding.metric.denominator : max}`}</span></div>
    {chart.kind === "line" ? <svg viewBox="0 0 650 250" className="trend-line" role="img" aria-label={values.map((item) => `${item.year}: ${item.count.toLocaleString()} research records`).join("; ")}><line x1="46" x2="630" y1="211" y2="211" /><text x="38" y="20" textAnchor="end">{lineMax.toLocaleString()}</text><text x="38" y="214" textAnchor="end">0</text><polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} />{points.map((point) => <g key={point.item.year}><circle cx={point.x} cy={point.y} r="4" /><text x={point.x} y="241" textAnchor="middle">{point.item.year}</text></g>)}</svg> : <div className="trend-bars"><div className="trend-axis"><span>0</span><span>{max} postings</span></div>{values.map((item) => <div className={`trend-bar-row ${item.id === chart.highlight_id ? "active" : ""}`} key={item.id}><span>{item.label}</span><div aria-hidden="true"><i style={{ width: `${Math.min(100, item.count / max * 100)}%` }} /></div><strong>{item.count} / {max}</strong></div>)}</div>}
    <details className="trend-data"><summary>View exact values</summary><table><thead><tr><th scope="col">{chart.kind === "line" ? "Year" : "Skill"}</th><th scope="col">{chart.unit}</th></tr></thead><tbody>{values.map((item) => <tr key={item.id || item.year}><th scope="row">{item.label || item.year}</th><td>{item.count.toLocaleString()}</td></tr>)}</tbody></table></details>
  </div>;
}
function EvidenceRows({ finding }: { finding: Finding }) {
  const render = (row: Evidence) => <li key={row.id}><a href={row.url} target="_blank" rel="noreferrer">{row.title} ↗</a><small>{row.source}{row.company ? ` · ${row.company}` : ""} · {date(row.date)}</small>{row.excerpt && <blockquote>“{row.excerpt}” <span>· {row.excerpt_field}</span></blockquote>}</li>;
  return <div className="trend-evidence"><h3>Inspect the evidence</h3>{finding.employer_count !== null && <p>{finding.employer_count} distinct employers in the matching posts</p>}{finding.evidence.length ? <><ul>{finding.evidence.slice(0, 2).map(render)}</ul>{finding.evidence.length > 2 && <details><summary>Show {finding.evidence.length - 2} more sources</summary><ul>{finding.evidence.slice(2).map(render)}</ul></details>}</> : <p>No individual source examples are retained.</p>}</div>;
}
function Workspace({ finding }: { finding: Finding }) {
  return <section className="trend-workspace" aria-labelledby="trend-selected-title"><div className="trend-workspace-meta"><span>{category(finding)}</span><span>{finding.stale ? `Saved evidence · collected ${date(finding.source.collected_at)}` : `Collected ${date(finding.source.collected_at)}`}</span></div><h2 id="trend-selected-title">{finding.headline}</h2><p className="trend-relevance">{finding.why_relevant}</p><div className="trend-workspace-grid"><div className="trend-visual"><div className="trend-metric"><Metric finding={finding} /></div><Chart finding={finding} /></div><aside className="trend-interpretation"><h3>What this tells us</h3><p>{finding.interpretation}</p>{finding.cached_explanation && <p className="trend-ai-wording">{finding.cached_explanation.interpretation}<small>Optional AI wording · {finding.cached_explanation.model}</small></p>}<p className="trend-scope">{finding.source.scope}</p><EvidenceRows finding={finding} /><p className="trend-limit">{finding.coverage}</p></aside></div></section>;
}
function OwnSkills({ data }: { data: Experience }) {
  const sample = data.source.posting_sample_size;
  return <section className="trend-own-skills"><div><h2>Your listed skills in the full feed</h2><p>This broader snapshot is separate from the role-specific findings above.</p><p>Is a skill losing momentum? We cannot tell from this feed yet: saved collections overlap, and no defensible posting change is available.</p></div><div>{data.profile.skills.map((skill) => { const found = data.searchable_skills.find((item) => skill.id ? item.id === skill.id : item.name.toLowerCase() === skill.name.toLowerCase()); const count = found?.posting_mentions; return <div className="trend-own-row" key={skill.id || skill.name}><span>{skill.name}</span><div aria-hidden="true"><i style={{ width: `${sample && count ? count / sample * 100 : 0}%` }} /></div><strong>{count === null || count === undefined ? "Not tracked" : `${count} / ${sample}`}</strong></div>; })}</div><small>One Remote OK snapshot, not a growth chart. Unlisted skills are not assumed absent.</small></section>;
}

export default function SignalsPage() {
  const [ready, setReady] = useState(false), [sampleId, setSampleId] = useState("cs-student"), [savedId, setSavedId] = useState("");
  const [useSaved, setUseSaved] = useState(false), [roleOverride, setRoleOverride] = useState(""), [data, setData] = useState<Experience | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [selectedId, setSelectedId] = useState(""), [search, setSearch] = useState("");
  useEffect(() => { try { const id = localStorage.getItem("aiversecity.synthetic-profile-id"); if (id) setSavedId(id); const sample = localStorage.getItem("pathwaay.sample-id"); if (sample) setSampleId(sample); if (id && localStorage.getItem("pathwaay.profile-mode") === "saved") setUseSaved(true); } catch { /* Default demo profile remains available. */ } setReady(true); }, []);
  useEffect(() => { if (!ready) return; const controller = new AbortController(); setData(null); setSelectedId(""); setLoading(true); setError(""); const params = new URLSearchParams(useSaved && savedId ? { profile_id: savedId } : { sample_id: sampleId }); if (roleOverride) params.set("role_family", roleOverride);
    fetch(`/api/trends/experience?${params}`, { signal: controller.signal }).then(async (response) => { if (!response.ok) throw new Error(response.status === 404 ? "The saved profile could not be found. Choose a sample profile to continue." : "Saved evidence is temporarily unavailable."); return response.json() as Promise<Experience>; }).then((result) => { setData(result); setSelectedId(result.insights[0]?.id || ""); }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "The evidence could not be loaded."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); return () => controller.abort();
  }, [ready, sampleId, savedId, useSaved, roleOverride]);
  const selected = data?.insights.find((item) => item.id === selectedId) || data?.insights[0];
  const results = useMemo(() => search.trim() && data ? data.searchable_skills.filter((item) => item.name.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 6) : [], [data, search]);
  return <main className="shell trend-page"><div className="ambient-layer" aria-hidden="true" /><WorkspaceNav active="signals" /><header className="trend-header"><div><p className="trend-kicker">PATHWAAY · AI TREND SIGNALS</p><h1>Your AI Trend Signals</h1><p>What is changing around your work, and what does the evidence actually show?</p></div><div className="trend-profile-control"><label htmlFor="trend-profile">Profile in view</label><select id="trend-profile" value={useSaved ? "saved" : sampleId} onChange={(event) => { const value = event.target.value; setUseSaved(value === "saved"); if (value !== "saved") setSampleId(value); setRoleOverride(""); try { localStorage.setItem("pathwaay.profile-mode", value === "saved" ? "saved" : "sample"); if (value !== "saved") localStorage.setItem("pathwaay.sample-id", value); } catch { /* Selection remains active. */ } }}>{savedId && <option value="saved">My saved demo profile</option>}{(data?.samples || [{ id: "cs-student", label: "Computer science student" }]).map((sample) => <option value={sample.id} key={sample.id}>{sample.label}</option>)}</select><small>{data?.profile.synthetic === false ? "Saved profile" : "Fictional demo profile"}</small></div></header>
    {loading && <div className="trend-skeleton" role="status" aria-label="Loading saved evidence"><div /><div /><div /></div>}
    {error && <div className="trend-error" role="alert"><strong>We could not load this profile’s findings.</strong><p>{error}</p><button type="button" onClick={() => { setUseSaved(false); setSampleId("cs-student"); }}>Use computer science sample</button></div>}
    {!loading && data && <><div className="trend-context"><div><strong>{data.context.overridden ? `Exploring ${data.context.label}` : data.context.label || data.profile.occupation}</strong><span>{data.context.overridden ? "Exploration context · profile unchanged" : data.context.reason ? `Linked through ${data.context.reason}` : "No supported role match yet"}</span><span>{data.profile.skills.slice(0, 3).map((skill) => skill.name).join(" · ")}</span></div><label htmlFor="trend-role">Explore a role group<select id="trend-role" value={roleOverride} onChange={(event) => setRoleOverride(event.target.value)}><option value="">From my profile</option>{data.context.available.map((context) => <option value={context.id} key={context.id}>{context.label}</option>)}</select></label></div>
      {data.context.status === "unsupported" ? <section className="trend-empty"><h2>No supported role group matches this profile yet.</h2><p>We currently have enough relevant sampled postings for software engineering. Choose that exploration context above to inspect its evidence; your profile will not change.</p></section> : data.insights.length ? <><section className="trend-selector" aria-labelledby="trend-findings-title"><div className="trend-section-head"><div><h2 id="trend-findings-title">Findings for {data.context.label}</h2><p>Select a finding to see its chart, interpretation and sources together.</p></div><span>{data.insights.length} evidence-backed {data.insights.length === 1 ? "finding" : "findings"}</span></div><div className="trend-card-row">{data.insights.map((finding) => <button type="button" className={`trend-card ${selected?.id === finding.id ? "is-selected" : ""}`} aria-pressed={selected?.id === finding.id} key={finding.id} onClick={() => setSelectedId(finding.id)}><span className="trend-card-category"><Icon type={finding.type} />{category(finding)}</span><strong>{finding.headline}</strong><span className="trend-card-stat"><Metric finding={finding} /></span><span className="trend-card-reason">{finding.why_relevant}</span></button>)}</div></section>{selected && <Workspace finding={selected} />}</> : <section className="trend-empty"><h2>Not enough saved evidence for a finding yet.</h2><p>Sources are checked in the background. This page shows only supported measurements.</p></section>}
      <OwnSkills data={data} /><details className="trend-search"><summary>Explore another skill in the full feed</summary><label htmlFor="trend-skill-search">Search a skill</label><input id="trend-skill-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Try Python or SQL" />{search.trim() && <ul>{results.length ? results.map((skill) => <li key={skill.id}><strong>{skill.name}</strong><span>{skill.posting_mentions === null ? "Not tracked in this snapshot" : `${skill.posting_mentions} / ${data.source.posting_sample_size} full-feed posts`}</span></li>) : <li>No tracked skill matches this search.</li>}</ul>}</details>
      <details className="trend-method"><summary>Sources, calculation and coverage</summary><div><p>{data.method}</p><p>Role grouping uses titles and a curated mapping ({data.processing.mapping_version}). Extraction is {data.processing.extraction}. These mappings are relevance rules, not market evidence. The page request runs no model or external collection.</p><p><a href={data.source.posting_url} target="_blank" rel="noreferrer">Remote OK feed ↗</a> · collected {date(data.source.posting_retrieved_at)} · {data.source.posting_sample_size} retained posts · {data.source.posting_snapshots_saved} saved collections · refresh {data.source.posting_status}. OpenAlex collected {date(data.source.research_retrieved_at)} · refresh {data.source.research_status}.</p><p>Remote OK is a bounded mixed-location remote-job sample, not representative of Malaysia. Overlapping snapshots do not yet support posting-change claims. Research growth is not hiring growth or AI replacement risk. OpenAlex currently retains aggregate query counts, not individual paper titles.</p></div></details>
    </>}
  </main>;
}

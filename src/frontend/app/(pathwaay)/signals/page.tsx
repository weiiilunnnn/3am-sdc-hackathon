"use client";

import { useEffect, useMemo, useState } from "react";
import WorkspaceNav from "../WorkspaceNav";

type Observation = { year: number; count: number };
type Signal = {
  id: string; name: string; relevance: string[]; direction: "rising" | "falling" | "flat" | "unavailable";
  research_count: number | null; research_year: number | null; change_percent: number | null;
  compared_years: number[] | null; observations: Observation[]; posting_mentions: number;
  posting_sample_size: number; examples: { title: string; company: string; url: string }[];
  action: string; source_url: string; measurement: string; limitations: string;
};
type Skill = { id: string; name: string; is_profile_skill: boolean; posting_mentions: number | null; related_topic_ids: string[] };
type Experience = {
  profile: { id: string; label: string; occupation: string; field_of_study: string; years_experience: number; interests: string[]; aspiration: string; skills: { id: string | null; name: string }[]; develop: string[]; synthetic: boolean };
  samples: { id: string; label: string }[]; signals: Signal[]; searchable_skills: Skill[];
  source: { research_retrieved_at: string | null; research_status: string; posting_retrieved_at: string | null;
    posting_feed_updated_at: string | null; posting_sample_size: number; posting_url: string;
    posting_snapshots_saved: number; posting_history_started_at: string | null };
  method: string;
};

function date(value: string | null) {
  if (!value) return "Awaiting first collection";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function ResearchChart({ signal }: { signal: Signal }) {
  const values = signal.observations;
  if (values.length < 2) return <p className="signal-no-chart">A comparable research series is not available yet.</p>;
  const width = 760, height = 260, left = 28, right = 28, top = 26, bottom = 38;
  const low = 0;
  const high = Math.max(...values.map((item) => item.count));
  const spread = high - low || 1;
  const points = values.map((item, index) => ({
    x: left + index * ((width - left - right) / (values.length - 1)),
    y: top + (1 - (item.count - low) / spread) * (height - top - bottom),
    item,
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `M ${points[0].x} ${height - bottom} L ${points.map((point) => `${point.x} ${point.y}`).join(" L ")} L ${points.at(-1)!.x} ${height - bottom} Z`;
  return <div className="signal-chart-wrap">
    <svg viewBox={`0 0 ${width} ${height}`} className="signal-chart" role="img" aria-label={`${signal.name}: ${values.map((item) => `${item.year}, ${item.count.toLocaleString()} records`).join("; ")}`}>
      <defs><linearGradient id="signal-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#6af2b2" stopOpacity=".34" /><stop offset="1" stopColor="#6af2b2" stopOpacity="0" /></linearGradient></defs>
      <line x1={left} y1={height - bottom} x2={width - right} y2={height - bottom} className="signal-axis" />
      <path d={area} fill="url(#signal-area)" />
      <polyline points={line} className="signal-line" />
      {points.map(({ x, y, item }) => <g key={item.year}><circle cx={x} cy={y} r="5" className="signal-point"><title>{item.year}: {item.count.toLocaleString()} records</title></circle><text x={x} y={height - 9} textAnchor="middle" className="signal-year">{item.year}</text></g>)}
    </svg>
  </div>;
}

function ProfileSkillsEvidence({ data, onTopic }: { data: Experience; onTopic: (id: string) => void }) {
  const skills = data.profile.skills.map((profileSkill) => {
    const measured = data.searchable_skills.find((item) =>
      profileSkill.id ? item.id === profileSkill.id : item.name.toLocaleLowerCase() === profileSkill.name.toLocaleLowerCase());
    return { ...profileSkill, mentions: measured?.posting_mentions ?? null, topics: measured?.related_topic_ids ?? [] };
  });
  const sampleSize = data.source.posting_sample_size;
  const largestShare = sampleSize ? Math.max(0, ...skills.map((skill) => skill.mentions === null ? 0 : skill.mentions / sampleSize * 100)) : 0;
  const axisMax = [1, 5, 10, 25, 50, 100].find((limit) => largestShare <= limit) ?? 100;

  return <section className="signal-profile-evidence" aria-labelledby="profile-skills-title">
    <div className="signal-section-head"><div><h2 id="profile-skills-title">The skills you already have</h2><p>How often your listed skills appear in the saved Remote OK sample.</p></div><span>{skills.length} listed skills · {sampleSize} sampled posts</span></div>
    {skills.length ? <div className="profile-skill-plot">
      <div className="profile-skill-axis"><span>0</span><span>{axisMax}% of sampled posts</span></div>
      {skills.map((skill, index) => {
        const share = skill.mentions !== null && sampleSize ? skill.mentions / sampleSize * 100 : null;
        return <div className="profile-skill-row" key={`${skill.id ?? skill.name}-${index}`}>
          <strong>{skill.name}</strong>
          <div className="profile-skill-track" aria-hidden="true">{share !== null && <span style={{ width: `${Math.min(100, share / axisMax * 100)}%` }} />}</div>
          <span className="profile-skill-value">{skill.mentions === null ? "Not measured" : `${skill.mentions} / ${sampleSize}`}</span>
          {skill.topics.length > 0 && <div className="profile-skill-topics">Related research: {skill.topics.map((id) => {
            const topic = data.signals.find((item) => item.id === id);
            return topic ? <button type="button" key={id} onClick={() => onTopic(id)}>{topic.name} · {topic.change_percent === null ? "trend unavailable" : `${topic.change_percent > 0 ? "+" : ""}${topic.change_percent.toLocaleString(undefined, { maximumFractionDigits: 1 })}% research`}</button> : null;
          })}</div>}
        </div>;
      })}
    </div> : <p className="signal-quiet">This profile has no listed skills yet.</p>}
    <p className="profile-skill-note">This graph shows one posting snapshot, not skill growth or decline. “Not measured” means the skill is outside our tracked posting phrases. Related OpenAlex trends are research activity, not demand for the skill. Source collected {date(data.source.posting_retrieved_at)}.</p>
  </section>;
}

export default function SignalsPage() {
  const [sampleId, setSampleId] = useState("cs-student");
  const [savedId, setSavedId] = useState("");
  const [useSaved, setUseSaved] = useState(false);
  const [data, setData] = useState<Experience | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [focusId, setFocusId] = useState("");
  const [search, setSearch] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);

  useEffect(() => {
    try {
      const id = localStorage.getItem("aiversecity.synthetic-profile-id");
      if (id) setSavedId(id);
      const sample = localStorage.getItem("pathwaay.sample-id");
      if (sample) setSampleId(sample);
      if (id && localStorage.getItem("pathwaay.profile-mode") === "saved") setUseSaved(true);
    } catch { /* A sample profile still works when browser storage is disabled. */ }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const query = useSaved && savedId ? `profile_id=${encodeURIComponent(savedId)}` : `sample_id=${encodeURIComponent(sampleId)}`;
    fetch(`/api/trends/experience?${query}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 404 ? "This saved profile is no longer available." : "The cached signals could not be loaded.");
        return response.json() as Promise<Experience>;
      })
      .then((value) => { setData(value); setFocusId(""); setSelectedSkill(null); })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        if (useSaved) { setUseSaved(false); try { localStorage.setItem("pathwaay.profile-mode", "sample"); } catch { /* Ignore storage failure. */ } return; }
        setError(reason instanceof Error ? reason.message : "The cached signals could not be loaded.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [sampleId, savedId, useSaved]);

  const personal = data?.signals.filter((signal) => signal.relevance.length) ?? [];
  const featured = data?.signals.find((signal) => signal.id === focusId) ?? personal.find((signal) => signal.observations.length > 1) ?? data?.signals.find((signal) => signal.observations.length > 1);
  const query = search.trim().toLocaleLowerCase();
  const results = useMemo(() => !query || !data ? [] : [
    ...data.searchable_skills.filter((skill) => skill.name.toLocaleLowerCase().includes(query)),
  ].slice(0, 8), [data, query]);
  const topicResults = !query ? [] : (data?.signals ?? []).filter((signal) => signal.name.toLocaleLowerCase().includes(query));
  const falling = data?.signals.filter((signal) => signal.direction === "falling") ?? [];

  return <main className="shell signal-shell">
    <div className="ambient-layer" aria-hidden="true" />
    <WorkspaceNav active="signals" />
    <section className="signal-intro">
      <div><p className="eyebrow">YOUR PROFILE · RESEARCH · JOB POSTINGS</p><h1>Your AI skills,<br /><span>in motion.</span></h1><p className="intro">See the research topics connected to your skills and goals, then check the evidence behind each signal.</p></div>
      <div className="signal-profile-card">
        <span className="signal-card-label">PROFILE IN VIEW</span>
        <strong>{data?.profile.label ?? "Loading profile…"}</strong>
        <p>{data?.profile.aspiration ?? ""}</p>
        <label htmlFor="signal-profile-select">Explore another profile</label>
        <select id="signal-profile-select" value={useSaved ? "saved" : sampleId} onChange={(event) => { if (event.target.value === "saved") setUseSaved(true); else { setUseSaved(false); setSampleId(event.target.value); } try { localStorage.setItem("pathwaay.profile-mode", event.target.value === "saved" ? "saved" : "sample"); if (event.target.value !== "saved") localStorage.setItem("pathwaay.sample-id", event.target.value); } catch { /* Selection remains active for this visit. */ } }}>
          {savedId && <option value="saved">My saved demo profile</option>}
          {(data?.samples ?? [{ id: "cs-student", label: "Computer science student" }]).map((sample) => <option value={sample.id} key={sample.id}>{sample.label}</option>)}
        </select>
        <small>{useSaved ? "Saved fictional demo profile" : "Premade fictional profile · choose another to see how the signals change"}</small>
      </div>
    </section>

    {loading && <div className="signal-loading" role="status">Reading the saved evidence…</div>}
    {error && <div className="signal-error" role="alert">{error}</div>}
    {!loading && data && <>
      <section className="signal-feature" aria-labelledby="feature-title">
        <div className="signal-feature-head"><div><span className="signal-card-label">{featured?.relevance.length && featured.direction === "rising" ? "FASTEST-RISING LINKED RESEARCH TOPIC" : "PROFILE-LINKED RESEARCH SIGNAL"}</span><h2 id="feature-title">{featured?.name ?? "No comparable topic yet"}</h2><p>{featured?.relevance.join(" · ") || "General topic · no explicit profile link"}</p></div>
          {featured && <div className="signal-big-stat"><strong>{featured.change_percent === null ? "—" : `${featured.change_percent > 0 ? "+" : ""}${featured.change_percent.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`}</strong><span>{featured.compared_years?.join(" → ") ?? "No comparable years"}<br />OpenAlex research records</span></div>}
        </div>
        {featured && <><ResearchChart signal={featured} /><div className="signal-chart-bottom"><span>Zero baseline · {featured.research_count?.toLocaleString() ?? "—"} matching records in {featured.research_year ?? "the latest year"}</span><span>{featured.posting_sample_size ? `${featured.posting_mentions} of ${featured.posting_sample_size} sampled Remote OK posts mention this topic` : "Posting sample not collected yet"}</span></div></>}
      </section>

      <div className="signal-source-line"><span>OpenAlex collected {date(data.source.research_retrieved_at)}</span><span>Remote OK collected {date(data.source.posting_retrieved_at)}</span><span>These are different measurements, not a combined score.</span></div>

      <ProfileSkillsEvidence data={data} onTopic={(id) => { setFocusId(id); document.getElementById("feature-title")?.scrollIntoView({ behavior: "smooth" }); }} />

      <section className="signal-next" aria-labelledby="signal-next-title"><div className="signal-section-head"><div><p className="eyebrow">YOUR NEXT LOOK</p><h2 id="signal-next-title">What stands out for {data.profile.label.toLocaleLowerCase()}</h2></div><span>{personal.length} profile-linked topics</span></div>
        {personal.length ? <div className="signal-card-grid">{personal.slice(0, 3).map((signal) => <button type="button" className={`signal-topic-card ${featured?.id === signal.id ? "active" : ""}`} key={signal.id} onClick={() => setFocusId(signal.id)}><span className="signal-card-label">{signal.direction === "rising" ? "MORE RESEARCH" : signal.direction === "falling" ? "FEWER RESEARCH RECORDS" : "DIRECTION UNAVAILABLE"}</span><strong>{signal.name}</strong><span>{signal.relevance.join(" · ")}</span><em>View evidence ↗</em></button>)}</div> : <p className="signal-quiet">No monitored topic has a direct link to this profile’s listed skills or goals. Search a skill below to see what the available sources cover.</p>}
        {personal.length > 3 && <details className="signal-more"><summary>See {personal.length - 3} more profile-linked topics</summary><div>{personal.slice(3).map((signal) => <button type="button" key={signal.id} onClick={() => { setFocusId(signal.id); document.getElementById("feature-title")?.scrollIntoView({ behavior: "smooth" }); }}>{signal.name} <span>View chart ↗</span></button>)}</div></details>}
      </section>

      <section className="signal-lower"><div className="signal-lower-card"><p className="eyebrow">SKILLS LOSING MOMENTUM?</p><h2>Not measurable yet.</h2><p>{data.source.posting_snapshots_saved} dated job-posting {data.source.posting_snapshots_saved === 1 ? "snapshot is" : "snapshots are"} saved. Even with multiple collections, overlapping posts must be deduplicated and compared across suitable time windows before we can label a skill as declining.</p><p className="signal-caution">{falling.length ? `Separately, ${falling.map((item) => item.name).join(", ")} had fewer OpenAlex research records in the latest comparison. That is not a decline in skill demand or evidence of AI replacement.` : "None of the monitored research topics fell in the latest comparable years. A zero mention in one posting sample also does not prove decline or AI replacement."}</p></div>
        <div className="signal-lower-card signal-action"><p className="eyebrow">ONE USEFUL NEXT STEP</p><h2>Try it in practice.</h2><p>{featured?.action ?? "Choose a topic to explore a grounded next step."}</p><span>Based on your profile link to {featured?.name ?? "the selected topic"}; a learning suggestion, not a forecast.</span></div></section>

      <section className="signal-search-section" aria-labelledby="signal-search-title"><div className="signal-section-head"><div><p className="eyebrow">EXPLORE A SKILL</p><h2 id="signal-search-title">Curious about something else?</h2></div></div><label htmlFor="skill-search">Search a skill or topic</label><input id="skill-search" type="search" value={search} onChange={(event) => { setSearch(event.target.value); setSelectedSkill(null); }} placeholder="Try Python, SQL, machine learning…" autoComplete="off" />
        {query && <div className="signal-search-results">{topicResults.map((signal) => <button type="button" key={`topic-${signal.id}`} onClick={() => { setFocusId(signal.id); setSelectedSkill(null); document.getElementById("feature-title")?.scrollIntoView({ behavior: "smooth" }); }}>{signal.name}<span>Research series · view chart</span></button>)}{results.map((skill) => <button type="button" key={skill.id} onClick={() => setSelectedSkill(skill)}>{skill.name}<span>{skill.is_profile_skill ? "In your profile" : skill.posting_mentions === null ? "No posting count" : `${skill.posting_mentions} post mentions`}</span></button>)}{!results.length && !topicResults.length && <p>No tracked skill matches “{search}”. The data does not support a trend claim for it.</p>}</div>}
        {selectedSkill && <div className="signal-skill-detail"><strong>{selectedSkill.name}</strong><p>{selectedSkill.posting_mentions === null ? "This skill is not measured in the current posting sample." : `${selectedSkill.posting_mentions} of ${data.source.posting_sample_size} retained Remote OK posts mention this skill. A single snapshot cannot tell whether it is rising or falling.`}</p><p>{selectedSkill.related_topic_ids.length ? `Related research topics: ${selectedSkill.related_topic_ids.map((id) => data.signals.find((item) => item.id === id)?.name).filter(Boolean).join(", ")}. This is a relevance link, not a skill-demand estimate.` : "No monitored OpenAlex topic is directly mapped to this skill."}</p></div>}
      </section>

      <details className="signal-method"><summary>How we calculate this, and where the data comes from <span>See sources and limits</span></summary><div><p>{data.method}</p><p>The demonstration profile is fictional. Source figures are cached observations, and the suggested practice is editorial guidance.</p><p><a href={featured?.source_url ?? "https://api.openalex.org/works"} target="_blank" rel="noreferrer">Inspect the OpenAlex query ↗</a> <a href={data.source.posting_url} target="_blank" rel="noreferrer">Remote OK feed ↗</a></p>{featured?.examples.length ? <p>Original Remote OK posting examples: {featured.examples.map((job) => <a key={job.url} href={job.url} target="_blank" rel="noreferrer">{job.title} at {job.company} ↗</a>)}</p> : <p>No posting in the saved sample mentions this selected topic.</p>}<p>Research cache: {date(data.source.research_retrieved_at)} · Posting cache: {date(data.source.posting_retrieved_at)} · Feed update: {date(data.source.posting_feed_updated_at)}. The backend rechecks sources on a schedule; opening this page reads its saved cache.</p></div></details>
    </>}
  </main>;
}

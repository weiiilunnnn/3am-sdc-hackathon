"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ApiError, explainRadarBrief, getMalaysiaContext, getRadarBrief, refreshEmployment,
  refreshMalaysiaContext, refreshTrends, type MalaysiaContext, type RadarBrief,
} from "@/lib/api";

const PROFILE_KEY = "aiversecity.synthetic-profile-id";

function day(value: string | null) {
  if (!value) return "Not refreshed yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function directionText(direction: RadarBrief["cards"][number]["direction"]) {
  switch (direction) {
    case "more_research_records": return "More research records";
    case "fewer_research_records": return "Fewer research records";
    case "unchanged_research_records": return "No count change";
    default: return "Direction unavailable";
  }
}

export default function RadarOverview() {
  const [profileId, setProfileId] = useState("");
  const [brief, setBrief] = useState<RadarBrief | null>(null);
  const [malaysia, setMalaysia] = useState<MalaysiaContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [explanation, setExplanation] = useState("");
  const [explanationStatus, setExplanationStatus] = useState("");
  const [explaining, setExplaining] = useState(false);

  const load = useCallback(async (id: string) => {
    const [briefResult, malaysiaResult] = await Promise.all([
      getRadarBrief(id || undefined).catch((reason: unknown) => {
        if (reason instanceof ApiError && reason.status === 404 && id) {
          setProfileId("");
          return getRadarBrief();
        }
        throw reason;
      }),
      getMalaysiaContext(),
    ]);
    setBrief(briefResult);
    setMalaysia(malaysiaResult);
  }, []);

  useEffect(() => {
    let id = "";
    try { id = localStorage.getItem(PROFILE_KEY) ?? ""; } catch { /* Browser storage may be disabled. */ }
    setProfileId(id);
    void load(id).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Evidence could not be loaded.");
    }).finally(() => setLoading(false));
  }, [load]);

  async function refreshAll() {
    if (refreshing) return;
    setRefreshing(true);
    setError("");
    const results = await Promise.allSettled([refreshTrends(), refreshEmployment(), refreshMalaysiaContext()]);
    const failures = results.flatMap((result, index) => {
      const name = ["OpenAlex", "Remote OK", "DOSM"][index];
      if (result.status === "rejected") return [name];
      if ("refresh_status" in result.value && result.value.refresh_status === "failed") return [name];
      return [];
    });
    try { await load(profileId); } catch (reason) {
      failures.push("cached evidence");
      if (reason instanceof Error) setError(reason.message);
    }
    if (failures.length) setError(`Could not update: ${failures.join(", ")}. Available cached observations remain visible.`);
    setRefreshing(false);
  }

  async function requestExplanation() {
    if (explaining) return;
    setExplaining(true);
    setExplanationStatus("");
    try {
      const result = await explainRadarBrief(profileId || undefined);
      setExplanation(result.summary ?? "");
      setExplanationStatus(result.available ? `Optional wording by ${result.model}; the figures and sources above are unchanged.` : result.reason ?? "Explanation unavailable.");
    } catch (reason) {
      setExplanationStatus(reason instanceof Error ? reason.message : "Explanation unavailable.");
    } finally { setExplaining(false); }
  }

  const relevant = brief?.cards.filter((card) => card.matched_profile_skills.length || card.development_profile_skills.length) ?? [];
  const shown = brief?.cards ?? [];
  const groups = malaysia?.data?.groups.filter((group) => group.current_count >= 1000)
    .sort((a, b) => b.current_count - a.current_count).slice(0, 6) ?? [];

  return <section className="radar-overview" aria-labelledby="radar-overview-heading">
    <div className="radar-overview-head">
      <div><div className="page-kicker"><span className="kicker-dot" /> YOUR EVIDENCE BRIEF</div><h2 id="radar-overview-heading">Signals you can act on.</h2><p>See what changed in research, what appears in current postings, and how your saved skills connect.</p></div>
      <button className="button" type="button" onClick={() => void refreshAll()} disabled={refreshing || loading} data-testid="button-update-all-evidence">{refreshing ? "Updating three sources…" : "Update source evidence"}</button>
    </div>
    {loading && <div className="panel radar-overview-empty" role="status">Loading cached evidence…</div>}
    {error && <div className="message error" role="alert">{error}</div>}
    {!loading && brief && <>
      <div className="radar-source-strip" aria-label="Evidence source dates">
        <span><b>Research</b> OpenAlex · {day(brief.research_refreshed_at)}</span>
        <span><b>Posting snapshot</b> Remote OK · {day(brief.posting_refreshed_at)}</span>
        <span><b>Malaysia</b> DOSM · {malaysia?.data?.latest_period ?? "Not loaded"}</span>
      </div>
      {profileId && <p className="radar-profile-note">Matched to your saved synthetic profile. {relevant.length ? `${relevant.length} topics link to skills you have or want to develop.` : "No listed skill has a supported topic link yet; the topics below remain general exploration."}</p>}
      {!profileId && <p className="radar-profile-note">Save a profile to see which research topics link to skills you already have. These are transparent topic links, not a career match score.</p>}
      <div className="radar-signal-grid">
        {shown.map((card) => <article className={`radar-signal panel ${card.matched_profile_skills.length || card.development_profile_skills.length ? "is-personal" : ""}`} key={card.topic_id} data-testid={`brief-${card.topic_id}`}>
          <div className="radar-signal-top"><span className="radar-eyebrow">{card.matched_profile_skills.length || card.development_profile_skills.length ? "LINKED TO YOUR PROFILE" : "RESEARCH TOPIC"}</span><span className={`radar-direction ${card.direction}`}>{directionText(card.direction)}</span></div>
          <h3>{card.label}</h3>
          {card.matched_profile_skills.length > 0 && <p className="radar-linked">Your skill: {card.matched_profile_skills.join(", ")}</p>}
          {card.development_profile_skills.length > 0 && <p className="radar-linked">You want to develop: {card.development_profile_skills.join(", ")}</p>}
          <div className="radar-metrics">
            <div><strong>{card.research_count?.toLocaleString() ?? "—"}</strong><span>OpenAlex records · {card.research_year ?? "no year"}</span></div>
            <div><strong>{card.posting_denominator ? `${card.posting_mentions}/${card.posting_denominator}` : "—"}</strong><span>Remote OK posts mentioning topic</span></div>
          </div>
          <p className="radar-change">{card.previous_year && card.research_year && card.research_change_percent !== null ? `${card.previous_year} → ${card.research_year}: ${card.research_change_percent > 0 ? "+" : ""}${card.research_change_percent}% research count` : "Comparable research change is not yet available."}</p>
          <div className="radar-practice"><span>TRY THIS</span><p>{card.practice}</p></div>
          <div className="radar-citations"><a href={card.research_source_url ?? "https://api.openalex.org/works"} target="_blank" rel="noreferrer">OpenAlex query ↗</a><a href={card.posting_source_url} target="_blank" rel="noreferrer">Remote OK feed ↗</a></div>
        </article>)}
      </div>
      {brief.cards.every((card) => card.direction !== "fewer_research_records") && <p className="radar-method">None of the five monitored research topics has fewer matching records in the latest complete-year comparison. This does not establish that no skills or roles are declining.</p>}
      <p className="radar-method">{brief.method}</p>
      {profileId && <div className="radar-llm panel"><div><strong>Plain-language reading</strong><p>Optional wording from the project’s existing RunPod model. Source figures and actions stay visible above.</p></div><button className="button secondary" type="button" disabled={explaining} onClick={() => void requestExplanation()}>{explaining ? "Writing…" : "Explain my signals"}</button>{explanation && <blockquote>{explanation}</blockquote>}{explanationStatus && <small role="status">{explanationStatus}</small>}</div>}
    </>}

    <div className="radar-local-head"><div className="page-kicker">MALAYSIA · OFFICIAL CONTEXT</div><h2>Where online offerings sit locally.</h2><p>DOSM reports broad occupation groups. Compare each group’s share of all reported online offerings in the same quarter a year apart.</p></div>
    {malaysia?.data ? <div className="radar-local-panel panel"><div className="radar-local-summary"><strong>{malaysia.data.latest_period}</strong><span>{malaysia.data.latest_total.toLocaleString()} online offerings · {malaysia.data.comparison_period}: {malaysia.data.comparison_total.toLocaleString()}</span><a href={malaysia.data.source_url} target="_blank" rel="noreferrer">Official workbook ↗</a></div><div className="radar-local-list">{groups.map((group) => <div className="radar-local-row" key={group.name}><strong>{group.name}</strong><div className="radar-local-bar"><span style={{ width: `${Math.min(100, group.current_share_percent * 1.6)}%` }} /></div><span>{group.current_share_percent}% share</span><em className={group.direction}>{group.share_point_change === null ? "No comparison" : `${group.share_point_change > 0 ? "+" : ""}${group.share_point_change} pp YoY`}</em></div>)}</div><p>{malaysia.data.limitation} Retrieved {day(malaysia.retrieved_at)}. <a href={malaysia.data.source_page} target="_blank" rel="noreferrer">DOSM release ↗</a></p></div> : <div className="panel radar-overview-empty" role="status">No DOSM workbook is cached yet. Use “Update source evidence” to load the current configured official release.</div>}
  </section>;
}

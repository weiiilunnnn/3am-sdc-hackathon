"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getEmployment, getProfileRelevance, getTrends, type EmploymentDashboard, type ProfileRelevance, type TrendDashboard } from "../../lib/api";
import { PageIntro } from "../WorkspaceStates";
import { useSavedProfile } from "../profile-workspace";

function when(value: string | null | undefined) {
  if (!value) return "Not supplied";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function OutlookPage() {
  const { profile, profileId, loading: profileLoading, error: profileError, reload: reloadProfile } = useSavedProfile();
  const [employment, setEmployment] = useState<EmploymentDashboard | null>(null);
  const [trends, setTrends] = useState<TrendDashboard | null>(null);
  const [relevance, setRelevance] = useState<ProfileRelevance | null>(null);
  const [relevanceLoading, setRelevanceLoading] = useState(false);
  const [employmentLoading, setEmploymentLoading] = useState(true);
  const [trendLoading, setTrendLoading] = useState(true);
  const [employmentError, setEmploymentError] = useState("");
  const [trendError, setTrendError] = useState("");
  const [relevanceError, setRelevanceError] = useState("");

  const loadEmployment = useCallback(async () => {
    setEmploymentLoading(true); setEmploymentError("");
    try { setEmployment(await getEmployment()); }
    catch (reason) { setEmploymentError(reason instanceof Error ? reason.message : "Employment snapshot could not be loaded."); }
    finally { setEmploymentLoading(false); }
  }, []);
  const loadTrends = useCallback(async () => {
    setTrendLoading(true); setTrendError("");
    try { setTrends(await getTrends()); }
    catch (reason) { setTrendError(reason instanceof Error ? reason.message : "Research cache could not be loaded."); }
    finally { setTrendLoading(false); }
  }, []);

  useEffect(() => { void loadEmployment(); void loadTrends(); }, [loadEmployment, loadTrends]);
  useEffect(() => {
    let active = true;
    if (!profileId || !profile) { setRelevance(null); setRelevanceError(""); setRelevanceLoading(false); return; }
    setRelevanceLoading(true);
    setRelevanceError("");
    getProfileRelevance(profileId).then((result) => { if (active) setRelevance(result); })
      .catch((reason: unknown) => { if (active) setRelevanceError(reason instanceof Error ? reason.message : "Profile links could not be loaded."); })
      .finally(() => { if (active) setRelevanceLoading(false); });
    return () => { active = false; };
  }, [profile, profileId]);

  const profileSkillIds = useMemo(() => new Set((profile?.skills ?? []).map((skill) => skill.skill_id).filter((id): id is string => Boolean(id))), [profile]);
  const matchingMarketSkills = useMemo(() => (employment?.skill_counts ?? []).filter((item) => profileSkillIds.has(item.skill_id)), [employment, profileSkillIds]);

  return <main className="page-wrap">
    <PageIntro kicker="WORKFORCE OUTLOOK · SOURCE CONTEXT" title={<>Signals to inspect,<br />not answers to follow.</>} description="Two separate lenses: configured keyword mentions in a retained remote-posting sample, and OpenAlex publication activity. Neither can tell you whether a role is right for you." index="SOURCES / 04" />
    <div className="notice" role="note"><span className="notice-icon" aria-hidden="true">i</span><div><strong>Different sources, different meanings</strong>Posting keywords and research publications are not merged. Neither represents a complete labour market, predicts hiring, or promises an outcome.</div></div>

    <section className="outlook-section" aria-labelledby="market-heading">
      <div className="outlook-section-head"><div><span className="page-kicker"><span className="kicker-dot" /> SOURCE 01 · EMPLOYMENT SNAPSHOT</span><h2 id="market-heading">Remote OK posting sample</h2><p>Configured skill keywords mentioned in the retained records. Mentions are not confirmed requirements.</p></div><span className="source-stamp">MARKET SAMPLE</span></div>
      {employmentLoading && <div className="panel state-panel"><div className="skeleton" style={{ height: 155 }} aria-label="Loading employment snapshot" /></div>}
      {employmentError && <div className="message error" role="alert">{employmentError} <button type="button" className="button secondary small" onClick={() => void loadEmployment()}>Retry</button></div>}
      {!employmentLoading && employment && <>
        <div className="source-context panel"><div className="source-context-head"><div><h3>{employment.source.name}</h3><p>{employment.source.coverage}</p></div><span className="mode-pill">{employment.posting_count} RETAINED</span></div>
          <dl className="topic-meta">
            <div className="meta-item"><dt>Measurement</dt><dd>{employment.source.measurement}</dd></div>
            <div className="meta-item"><dt>Snapshot dates</dt><dd>{when(employment.published_from)} to {when(employment.published_to)}</dd></div>
            <div className="meta-item"><dt>Retrieved</dt><dd>{when(employment.last_successful_refresh)}</dd></div>
            <div className="meta-item"><dt>Source & terms</dt><dd><a href={employment.source.website_url} target="_blank" rel="noreferrer">Website</a> · <a href={employment.source.url} target="_blank" rel="noreferrer">Feed</a> · <a href={employment.source.terms_url} target="_blank" rel="noreferrer">Terms</a></dd></div>
            <div className="meta-item"><dt>Limitations</dt><dd>{employment.source.limitations}</dd></div>
          </dl>
        </div>
        <div className="outlook-market-grid">
          <article className="panel signal-list-panel"><div className="section-heading"><span className="section-no">ID</span><div><h3>Exact saved-skill ID overlap</h3><p>Only identical local IDs are compared here.</p></div></div>
            {profileLoading && <div className="skeleton" style={{ height: 68 }} aria-label="Loading saved profile" />}
            {profileError && <p className="message error" role="alert">{profileError} <button type="button" className="button ghost small" onClick={() => void reloadProfile()}>Retry profile</button></p>}
            {!profileLoading && !profileError && !profile && <p className="message info">Save a fictional profile to see exact-ID overlap. This snapshot remains separate from profile data.</p>}
            {profile && <>{matchingMarketSkills.length ? <ul className="signal-rows">{matchingMarketSkills.map((item) => <li key={item.skill_id}><div><strong>{item.label}</strong><small>Skill ID · {item.skill_id}</small></div><span className="signal-count">{item.posting_count}<small>mentions</small></span></li>)}</ul> : <p className="message info">No saved skill ID exactly matches a configured keyword in this sample. This is not evidence of no demand or no opportunity.</p>}<p className="field-hint">No alias or name-only matches are inferred. Mentions are counts within {employment.posting_count} retained postings, not job matches.</p></>}
          </article>
          <article className="panel signal-list-panel"><div className="section-heading"><span className="section-no">ALL</span><div><h3>Configured keyword counts</h3><p>Snapshot total: {employment.posting_count} retained records.</p></div></div>
            {employment.skill_counts.length ? <ul className="signal-rows">{employment.skill_counts.map((item) => <li key={item.skill_id}><div><strong>{item.label}</strong><small>Configured ID · {item.skill_id}</small></div><span className="signal-count">{item.posting_count}<small>{item.share_percent.toLocaleString(undefined, { maximumFractionDigits: 1 })}% of sample</small></span></li>)}</ul> : <p className="message info">No configured keyword mentions were reported in this snapshot.</p>}
          </article>
        </div>
      </>}
      {!employmentLoading && !employmentError && !employment && <div className="panel message info">No employment snapshot is available.</div>}
      {!employmentLoading && employment?.posting_count === 0 && <div className="message info">The current snapshot contains no retained postings. No skill comparison is possible.</div>}
    </section>

    <section className="outlook-section research-section" aria-labelledby="research-heading">
      <div className="outlook-section-head"><div><span className="page-kicker"><span className="kicker-dot" /> SOURCE 02 · OPENALEX</span><h2 id="research-heading">Research publication activity</h2><p>Indexed research counts by topic and publication year. This is a separate research signal—not a job-market measure.</p></div><span className="source-stamp research-stamp">RESEARCH SIGNAL</span></div>
      {trendLoading && <div className="panel state-panel"><div className="skeleton" style={{ height: 150 }} aria-label="Loading research observations" /></div>}
      {trendError && <div className="message error" role="alert">{trendError} <button type="button" className="button secondary small" onClick={() => void loadTrends()}>Retry</button></div>}
      {!trendLoading && trends && <>
        <div className="message info"><strong>{trends.mode === "real" ? "OpenAlex cached research data" : "Synthetic research demonstration"}</strong> {trends.notice} {trends.mode === "synthetic" ? "These observations are fictional and must not be interpreted as OpenAlex data." : `Last successful update: ${when(trends.last_successful_refresh)}.`}</div>
        {trends.mode === "real" && profile && <div className="panel signal-list-panel research-profile">
          <div className="section-heading"><span className="section-no">ID</span><div><h3>Profile-to-topic links</h3><p>Only the API’s explicit skill-ID associations are shown; this is not matching.</p></div></div>
          {relevanceLoading && <div className="skeleton" style={{ height: 92 }} aria-label="Loading profile research links" />}
          {relevanceError && <div className="message error" role="alert">{relevanceError} <button type="button" className="button ghost small" onClick={() => { setRelevanceLoading(true); setRelevanceError(""); void getProfileRelevance(profileId).then(setRelevance).catch((reason: unknown) => setRelevanceError(reason instanceof Error ? reason.message : "Profile links could not be loaded.")).finally(() => setRelevanceLoading(false)); }}>Retry</button></div>}
          {!relevanceLoading && !relevanceError && !relevance && <p className="message info">No profile research links are available yet.</p>}
          {relevance && <><p className="field-hint">{relevance.notice}</p>{relevance.skills.length ? <div className="relevance-list">{relevance.skills.map((skill, index) => <article className="relevance-item" key={`${skill.skill_id}-${index}`}><strong>{skill.skill_name}</strong><small className="skill-source">{skill.skill_id ? `Exact skill ID · ${skill.skill_id}` : "Custom skill · no exact local ID"}</small><p>{skill.explanation}</p>{skill.topics.length ? skill.topics.map((topic) => <p key={topic.topic_id}><b>{topic.label}</b> · {topic.explanation} {topic.signal_available ? `Latest observed publication year: ${topic.latest_period_year ?? "not supplied"}.` : "No topic signal available."}</p>) : <p>No explicit research-topic association is available for this skill.</p>}</article>)}</div> : <p className="message info">No profile skill associations were returned.</p>}</>}
        </div>}
        {trends.mode === "real" && !trends.topics.some((topic) => topic.observations.length > 0) && <div className="panel message info">No OpenAlex topic observations are currently available. A missing signal is not a zero or a forecast.</div>}
        {trends.topics.length > 0 && <div className="outlook-research-list">{trends.topics.map((topic) => <article className="panel research-topic" key={topic.topic_id}><div className="research-topic-head"><div><span className="topic-tag">{topic.status === "available" ? "OBSERVATIONS AVAILABLE" : "LIMITED SAMPLE"}</span><h3>{topic.label}</h3></div><span className="research-topic-count">{topic.observations.length}<small>observations</small></span></div><p>{topic.definition}</p><div className="research-bars">{topic.observations.slice().sort((a, b) => a.period_year - b.period_year).map((observation) => <div className="research-year" key={`${topic.topic_id}-${observation.period_year}`}><div className="research-bar-track" aria-label={`${observation.period_year}: ${observation.value} records`}><span style={{ transform: `scaleX(${Math.max(.025, observation.value / Math.max(1, ...topic.observations.map((item) => item.value)))})` }} /></div><div><strong>{observation.value.toLocaleString()}</strong><small>{observation.period_label || observation.period_year}</small></div></div>)}</div><dl className="topic-meta"><div className="meta-item"><dt>Source</dt><dd>{topic.source_name}{topic.source_url && <> · <a href={topic.source_url} target="_blank" rel="noreferrer">Source record</a></>}</dd></div><div className="meta-item"><dt>Measurement</dt><dd>{topic.measurement}</dd></div><div className="meta-item"><dt>Retrieved</dt><dd>{topic.observations.length ? when(topic.observations.map((item) => item.retrieved_at).sort().at(-1)) : "No observations"}</dd></div><div className="meta-item"><dt>Limitations</dt><dd>{topic.limitations}</dd></div></dl></article>)}</div>}
      </>}
      {!trendLoading && !trendError && !trends && <div className="panel message info">No research cache is available.</div>}
    </section>

    <section className="panel outlook-next-actions" aria-labelledby="outlook-next-heading">
      <div className="section-heading"><span className="section-no">NEXT</span><div><h2 id="outlook-next-heading">A next step you choose</h2><p>Use the signals as context, then decide what is useful for your own profile.</p></div></div>
      {profile?.skills_to_develop.length || profile?.interests.length ? <div className="outlook-interest-list"><strong>Your stated interests · not generated recommendations</strong><div>{[...new Set([...(profile.skills_to_develop ?? []), ...(profile.interests ?? [])])].map((item) => <span className="topic-tag" key={item}>{item}</span>)}</div></div> : <p className="message info">Add interests or skills you want to develop in your profile to use the “Related to my interests” filter in Explore Skills.</p>}
      <div className="outlook-action-links">
        <Link className="button secondary" href="/explore">Explore Skills and compare filters</Link>
        <Link className="button ghost" href="/#experience-section">Add experience or skill evidence</Link>
        <Link className="button ghost" href="/cv-studio">Preview your saved CV</Link>
      </div>
    </section>
  </main>;
}

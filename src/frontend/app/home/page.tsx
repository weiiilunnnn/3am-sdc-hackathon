"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getEmployment, getProfileInsights, type EmploymentDashboard, type ProfileInsights } from "../../lib/api";
import { PageIntro, ProfileGate } from "../WorkspaceStates";
import { useSavedProfile } from "../profile-workspace";

export default function HomePage() {
  const { profile, profileId, loading, error, reload } = useSavedProfile();
  const [insights, setInsights] = useState<ProfileInsights | null>(null);
  const [employment, setEmployment] = useState<EmploymentDashboard | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState("");
  const [employmentLoading, setEmploymentLoading] = useState(true);
  const [employmentError, setEmploymentError] = useState("");

  const loadInsights = useCallback(async (id: string) => {
    setInsightLoading(true);
    setInsightError("");
    try { setInsights(await getProfileInsights(id)); }
    catch (reason) { setInsightError(reason instanceof Error ? reason.message : "Profile indicators could not be loaded."); }
    finally { setInsightLoading(false); }
  }, []);

  useEffect(() => {
    let live = true;
    if (!profileId || !profile) { setInsights(null); return; }
    setInsightLoading(true);
    setInsightError("");
    getProfileInsights(profileId).then((result) => { if (live) setInsights(result); })
      .catch((reason: unknown) => { if (live) setInsightError(reason instanceof Error ? reason.message : "Profile indicators could not be loaded."); })
      .finally(() => { if (live) setInsightLoading(false); });
    return () => { live = false; };
  }, [profileId, profile]);

  const loadEmployment = useCallback(async () => {
    setEmploymentLoading(true);
    setEmploymentError("");
    try { setEmployment(await getEmployment()); }
    catch (reason) { setEmploymentError(reason instanceof Error ? reason.message : "Cached employment evidence could not be loaded."); }
    finally { setEmploymentLoading(false); }
  }, []);

  useEffect(() => { void loadEmployment(); }, [loadEmployment]);

  return <main className="page-wrap">
    <PageIntro kicker="YOUR WORKSPACE · OVERVIEW" title={<>A small next step<br />is still progress.</>} description="A practical home for your saved fictional profile, the evidence behind it, and a few useful places to continue." index="LEARNER WORKSPACE / 00" />
    {loading || error || !profile ? <ProfileGate loading={loading} error={error} onRetry={() => void reload()} /> : <>
      <section className="home-welcome panel">
        <div><span className="topic-tag">SAVED FICTIONAL PROFILE</span><h2>{profile.field_of_study || "Your profile"}</h2><p>{profile.professional_summary || "A profile is a living draft. Add a short summary when you are ready to describe your focus in your own words."}</p><div className="welcome-meta"><span>{profile.skills.length} skills named</span><span>{profile.experience.length + profile.projects.length + profile.education.length + profile.certifications.length + profile.achievements.length} records added</span><span>Updated {new Date(profile.updated_at).toLocaleDateString(undefined, { dateStyle: "medium" })}</span></div></div>
        <Link className="button" href="/">Continue profile <span aria-hidden="true">→</span></Link>
      </section>

      <div className="home-columns">
        <section className="panel home-section" aria-labelledby="indicator-heading">
          <div className="section-heading"><span className="section-no">01</span><div><h2 id="indicator-heading">Profile indicators</h2><p>Transparent descriptions of the information currently in this profile.</p></div></div>
          <p className="field-hint">{insights?.notice ?? "Indicators describe profile content only; they are not a measure of employability or likely outcomes."}</p>
          {insightLoading && <div className="skeleton" style={{ height: 115 }} aria-label="Loading profile indicators" />}
          {insightError && <div className="message error" role="alert">{insightError} <button type="button" className="button ghost small" onClick={() => void loadInsights(profileId)}>Retry</button></div>}
          {!insightLoading && insights && <div className="indicator-list">{insights.indicators.map((indicator) => <article className="indicator-row" key={indicator.id}><div className="indicator-ring" aria-label={indicator.value_percent === null ? "Not enough information" : `${indicator.value_percent}%`}>{indicator.value_percent === null ? "—" : `${Math.round(indicator.value_percent)}%`}</div><div><h3>{indicator.label}</h3><p>{indicator.interpretation}</p><small>{indicator.status === "available" ? `${indicator.numerator ?? "—"} of ${indicator.denominator ?? "—"} profile items` : "Not enough information yet"} · {indicator.limitation}</small></div></article>)}</div>}
          {!insightLoading && !insights && !insightError && <div className="message info">No indicators were returned. Your saved profile remains available to edit.</div>}
        </section>

        <section className="panel home-section" aria-labelledby="next-heading">
          <div className="section-heading"><span className="section-no">02</span><div><h2 id="next-heading">A few next steps</h2><p>Small actions that make this profile easier to understand.</p></div></div>
          <ul className="next-list">
            {(insights?.suggestions.length ? insights.suggestions : ["Write a short professional summary in your own words.", "Link a skill to a record that demonstrates it.", "Explore the skill catalogue to check local vocabulary labels."]).map((suggestion, index) => <li key={`${suggestion}-${index}`}><span className="next-number">{String(index + 1).padStart(2, "0")}</span><span>{suggestion}</span><Link href={index === 2 ? "/explore" : "/"} aria-label={`Continue: ${suggestion}`}>→</Link></li>)}
          </ul>
          <p className="field-hint">These are prompts for profile upkeep, not a prediction or promise about work.</p>
        </section>
      </div>

      <section className="panel home-section home-outlook" aria-labelledby="home-outlook-heading">
        <div className="section-heading"><span className="section-no">03</span><div><h2 id="home-outlook-heading">Skills Outlook highlights</h2><p>Only exact saved skill IDs with a configured keyword signal are shown.</p></div></div>
        {employmentLoading && <div className="skeleton" style={{ height: 90 }} aria-label="Loading saved-skill market signals" />}
        {employmentError && <div className="message error" role="alert">{employmentError} <button type="button" className="button ghost small" onClick={() => void loadEmployment()}>Retry</button></div>}
        {!employmentLoading && employment && profile.skills.length > 0 && (() => {
          const profileIds = new Set(profile.skills.map((skill) => skill.skill_id).filter((id): id is string => Boolean(id)));
          const matched = employment.skill_counts.filter((item) => profileIds.has(item.skill_id)).slice(0, 4);
          return matched.length ? <ul className="home-signal-list">{matched.map((item) => <li key={item.skill_id}><div><strong>{item.label}</strong><small>{item.posting_count} keyword mentions · {employment.posting_count} retained postings</small></div><span>{item.share_percent.toLocaleString(undefined, { maximumFractionDigits: 1 })}%</span></li>)}</ul>
            : <p className="message info">No exact skill IDs in this profile match a configured keyword. This does not indicate a lack of demand or opportunity.</p>;
        })()}
        {!employmentLoading && employment?.posting_count === 0 && <p className="message info">No retained postings are available for comparison. No zero or trend is inferred.</p>}
        <p className="field-hint">Remote OK snapshot only · not representative of the whole labour market · mentions are not confirmed requirements.</p>
        <Link className="text-link" href="/outlook">View Skills Outlook and source details →</Link>
      </section>

      <section className="shortcut-band" aria-label="Workspace shortcuts">
        <div><span className="page-kicker"><span className="kicker-dot" /> CONTINUE WHEN YOU’RE READY</span><h2>Keep your skills connected to their context.</h2></div>
        <div className="shortcut-links">
          <Link href="/#skills-section"><span>01</span><strong>Add Skill</strong><small>Update your named skills</small></Link>
          <Link href="/#experience-section"><span>02</span><strong>Add Experience</strong><small>Keep practical examples close</small></Link>
          <Link href="/#projects-section"><span>03</span><strong>Add Project</strong><small>Show where a skill was used</small></Link>
          <Link href="/"><span>04</span><strong>Edit Profile</strong><small>Update your saved details</small></Link>
          <Link href="/cv-studio"><span>05</span><strong>Generate CV</strong><small>Preview saved profile content</small></Link>
          <Link href="/outlook"><span>06</span><strong>View Skills Outlook</strong><small>Inspect source-backed signals</small></Link>
        </div>
      </section>
    </>}
  </main>;
}

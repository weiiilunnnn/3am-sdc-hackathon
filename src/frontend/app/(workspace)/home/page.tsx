"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getEmployment, getProfileInsights, type EmploymentDashboard, type ProfileInsights } from "@/lib/api";
import { PageIntro, ProfileGate } from "../WorkspaceStates";
import { useRegistrationProfile, useSavedProfile } from "../profile-workspace";
import type { PathwaayRegistrationProfile } from "@/lib/pathwaay-profile";

function RegistrationHome({ profile }: { profile: PathwaayRegistrationProfile }) {
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Your Pathwaay profile";
  const experiences = profile.experiences.filter((item) => [item.title, item.company, item.timeframe, item.description].some((value) => value.trim()));
  const profileRecords = experiences.length + [profile.educationRecord, profile.schoolAwards, profile.volunteering, profile.projects, profile.certifications, profile.achievements]
    .filter((value) => value.trim()).length;
  const learningPreferences = [
    profile.learningMode,
    profile.weeklyHours ? `${profile.weeklyHours} hours per week` : "",
    profile.learningBudget ? `MYR ${profile.learningBudget} budget` : "",
  ].filter(Boolean).join(" · ");
  const profileDetails = [
    ["Education and awards", [profile.educationLevel, profile.cgpa ? `CGPA ${profile.cgpa}` : "", profile.schoolAwards, profile.educationRecord].filter(Boolean).join(" · ")],
    ["Interests and strengths", [profile.interests, profile.strengths].filter(Boolean).join(" · ")],
    ["Work and volunteering", [profile.workActivities, profile.volunteering].filter(Boolean).join(" · ")],
    ["Skills to develop", profile.skillsToDevelop],
    ["Projects and milestones", [profile.projects, profile.certifications, profile.achievements].filter(Boolean).join(" · ")],
    ["Learning plan", learningPreferences],
  ].filter(([, value]) => value.trim());

  return <>
    <section className="home-welcome panel">
      <div>
        <span className="topic-tag">REGISTRATION PROFILE · BROWSER SESSION</span>
        <h2>{name}</h2>
        <p>{profile.profileSummary || `${profile.major || "Your field of study"}${profile.university ? ` at ${profile.university}` : ""}${profile.aspiration ? `. Moving toward ${profile.aspiration}` : "."}`}</p>
        <div className="welcome-meta">
          {profile.major && <span>{profile.major}</span>}
          {profile.university && <span>{profile.university}</span>}
          <span>{profile.skills.length} selected skills</span>
          <span>{profileRecords} profile records</span>
        </div>
      </div>
      <Link className="button" href="/profile">View completed profile <span aria-hidden="true">→</span></Link>
    </section>

    <div className="home-columns">
      <section className="panel home-section" aria-labelledby="registration-skills-heading">
        <div className="section-heading"><span className="section-no">01</span><div><h2 id="registration-skills-heading">Your selected skills</h2><p>Skills carried over from registration.</p></div></div>
        {profile.skills.length
          ? <div className="registration-home-skills">{profile.skills.map((skill, index) => {
            const link = profile.skillLinks?.find((item) => item.name.toLowerCase() === skill.toLowerCase());
            return <span className="completed-skill" key={`${skill}-${index}`}><span>{skill}</span><small>{link?.skill_id ?? link?.taxonomy_source ?? "Custom entry"}</small></span>;
          })}</div>
          : <p className="message info">No skills were selected during registration yet. You can add them from your profile.</p>}
        <Link className="text-link" href="/profile/edit">Review your profile and skills →</Link>
      </section>

      <section className="panel home-section" aria-labelledby="registration-experience-heading">
        <div className="section-heading"><span className="section-no">02</span><div><h2 id="registration-experience-heading">Experience so far</h2><p>Roles and placements you entered during registration.</p></div></div>
        {experiences.length
          ? <div className="completed-experience-list">{experiences.map((item) => <article className="completed-experience" key={item.id}>
            <div className="completed-experience-marker" aria-hidden="true" />
            <div><h3>{item.title || "Experience"}</h3><p className="completed-experience-meta">{[item.company, item.timeframe].filter(Boolean).join(" · ") || "Details in your profile"}</p>{item.description && <p className="completed-experience-description">{item.description}</p>}</div>
          </article>)}</div>
          : <p className="message info">No experience details were added yet. You can update them in your profile.</p>}
      </section>
    </div>

    {profileDetails.length > 0 && <section className="panel home-section registration-home-details" aria-labelledby="registration-details-heading">
      <div className="section-heading"><span className="section-no">03</span><div><h2 id="registration-details-heading">More from your registration</h2><p>Education, interests and other details you shared.</p></div></div>
      <div className="registration-home-detail-grid">{profileDetails.map(([label, value]) => <article className="registration-home-detail" key={label}><h3>{label}</h3><p>{value}</p></article>)}</div>
    </section>}

    <section className="shortcut-band" aria-label="Profile shortcuts">
      <div><span className="page-kicker"><span className="kicker-dot" /> YOUR REGISTRATION DATA</span><h2>Your information is ready to use.</h2></div>
      <div className="shortcut-links">
        <Link href="/profile"><span>01</span><strong>View Profile</strong><small>Review all registration details</small></Link>
        <Link href="/profile/edit"><span>02</span><strong>Edit Profile</strong><small>Update your session profile</small></Link>
        <Link href="/cv-studio"><span>03</span><strong>Open CV Studio</strong><small>Preview these details as a CV</small></Link>
      </div>
    </section>
    <p className="field-hint registration-home-note">Registration profile data is kept in this browser session. It is not a database-backed account profile.</p>
  </>;
}

export default function HomePage() {
  const { profile, profileId, loading, error, reload } = useSavedProfile();
  const { profile: registrationProfile, loading: registrationLoading } = useRegistrationProfile();
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
    if (registrationLoading || registrationProfile || !profileId || !profile) { setInsights(null); setInsightLoading(false); return; }
    setInsightLoading(true);
    setInsightError("");
    getProfileInsights(profileId).then((result) => { if (live) setInsights(result); })
      .catch((reason: unknown) => { if (live) setInsightError(reason instanceof Error ? reason.message : "Profile indicators could not be loaded."); })
      .finally(() => { if (live) setInsightLoading(false); });
    return () => { live = false; };
  }, [profileId, profile, registrationLoading, registrationProfile]);

  const loadEmployment = useCallback(async () => {
    setEmploymentLoading(true);
    setEmploymentError("");
    try { setEmployment(await getEmployment()); }
    catch (reason) { setEmploymentError(reason instanceof Error ? reason.message : "Cached employment evidence could not be loaded."); }
    finally { setEmploymentLoading(false); }
  }, []);

  useEffect(() => {
    if (!registrationLoading && !registrationProfile) void loadEmployment();
  }, [loadEmployment, registrationLoading, registrationProfile]);

  return <main className="page-wrap">
    <PageIntro kicker="YOUR WORKSPACE · OVERVIEW" title={<>A small next step<br />is still progress.</>} description="A practical home for your saved profile, the evidence behind it, and a few useful places to continue." index="LEARNER WORKSPACE / 00" />
    {registrationLoading ? <ProfileGate loading error="" onRetry={() => {}} />
      : registrationProfile ? <RegistrationHome profile={registrationProfile} />
      : loading || error || !profile ? <ProfileGate loading={loading} error={error} onRetry={() => void reload()} /> : <>
      <section className="home-welcome panel">
        <div><span className="topic-tag">SAVED PROFILE</span><h2>{profile.field_of_study || "Your profile"}</h2><p>{profile.professional_summary || "A profile is a living draft. Add a short summary when you are ready to describe your focus in your own words."}</p><div className="welcome-meta"><span>{profile.skills.length} skills named</span><span>{profile.experience.length + profile.projects.length + profile.education.length + profile.certifications.length + profile.achievements.length} records added</span><span>Updated {new Date(profile.updated_at).toLocaleDateString(undefined, { dateStyle: "medium" })}</span></div></div>
        <Link className="button" href="/profile">View completed profile <span aria-hidden="true">→</span></Link>
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
            {(insights?.suggestions.length ? insights.suggestions : ["Write a short professional summary in your own words.", "Link a skill to a record that demonstrates it.", "Explore the skill catalogue to check local vocabulary labels."]).map((suggestion, index) => <li key={`${suggestion}-${index}`}><span className="next-number">{String(index + 1).padStart(2, "0")}</span><span>{suggestion}</span><Link href={index === 2 ? "/explore" : "/profile"} aria-label={`Continue: ${suggestion}`}>→</Link></li>)}
          </ul>
          <p className="field-hint">These are prompts for profile upkeep, not a prediction or promise about work.</p>
        </section>
      </div>

      <section className="panel home-section home-outlook" aria-labelledby="home-outlook-heading">
        <div className="section-heading"><span className="section-no">03</span><div><h2 id="home-outlook-heading">AI skill connection highlights</h2><p>Only exact saved skill IDs with a configured keyword signal are shown.</p></div></div>
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
        <Link className="text-link" href="/outlook">View your AI skill connections →</Link>
      </section>

      <section className="shortcut-band" aria-label="Workspace shortcuts">
        <div><span className="page-kicker"><span className="kicker-dot" /> CONTINUE WHEN YOU’RE READY</span><h2>Keep your skills connected to their context.</h2></div>
        <div className="shortcut-links">
          <Link href="/profile/edit#completed-skills-heading"><span>01</span><strong>Review Skills</strong><small>Update your selected skills</small></Link>
          <Link href="/profile/edit#completed-experience-heading"><span>02</span><strong>Review Experience</strong><small>Keep practical examples close</small></Link>
          <Link href="/profile/edit#completed-proof-heading"><span>03</span><strong>Review Projects</strong><small>Show where a skill was used</small></Link>
          <Link href="/profile/edit"><span>04</span><strong>Edit Profile</strong><small>Update your completed details</small></Link>
          <Link href="/cv-studio"><span>05</span><strong>Generate CV</strong><small>Preview saved profile content</small></Link>
          <Link href="/outlook"><span>06</span><strong>AI Skill Connections</strong><small>Inspect source-backed signals</small></Link>
        </div>
      </section>
    </>}
  </main>;
}

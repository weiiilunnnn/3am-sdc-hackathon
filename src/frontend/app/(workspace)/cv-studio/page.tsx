"use client";

import { useState } from "react";
import { PageIntro, ProfileGate } from "../WorkspaceStates";
import { profileSkillEvidenceKey, useRegistrationProfile, useSavedProfile } from "../profile-workspace";
import type { PathwaayRegistrationProfile } from "@/lib/pathwaay-profile";

type TemplateName = "field" | "clearline";

const groups = [
  ["education", "Education"],
  ["experience", "Experience"],
  ["projects", "Projects"],
  ["certifications", "Certifications"],
  ["achievements", "Achievements"],
] as const;

function CvTemplateControls({ template, onTemplateChange }: { template: TemplateName; onTemplateChange: (next: TemplateName) => void }) {
  return <div className="cv-studio-tools no-print">
    <div><span className="page-kicker"><span className="kicker-dot" /> CHOOSE A TEMPLATE</span><div className="template-switch" role="radiogroup" aria-label="Choose a CV template">
      <button type="button" role="radio" aria-checked={template === "field"} className={`template-choice ${template === "field" ? "selected" : ""}`} onClick={() => onTemplateChange("field")}><span className="template-swatch field-swatch" aria-hidden="true" /><span><strong>Field notes</strong><small>Editorial · quiet emphasis</small></span></button>
      <button type="button" role="radio" aria-checked={template === "clearline"} className={`template-choice ${template === "clearline" ? "selected" : ""}`} onClick={() => onTemplateChange("clearline")}><span className="template-swatch clear-swatch" aria-hidden="true" /><span><strong>Clearline</strong><small>Structured · compact</small></span></button>
    </div></div>
    <button type="button" className="button" onClick={() => window.print()}>Print / Save as PDF <span aria-hidden="true">↗</span></button>
  </div>;
}

function RegistrationCvPreview({ profile, template }: { profile: PathwaayRegistrationProfile; template: TemplateName }) {
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Professional profile";
  const educationDetails = [
    profile.educationLevel,
    profile.major,
    profile.university,
    profile.cgpa ? `CGPA ${profile.cgpa}` : "",
  ].filter(Boolean);
  const experiences = profile.experiences.filter((item) => [item.title, item.company, item.timeframe, item.description].some((value) => value.trim()));
  const records = [
    ["Honours and awards", profile.schoolAwards],
    ["Learning and coursework", profile.educationRecord],
    ["Volunteering and work activities", profile.volunteering],
    ["Projects", profile.projects],
    ["Certifications and training", profile.certifications],
    ["Achievements", profile.achievements],
    ["Interests", profile.interests],
    ["Work activities", profile.workActivities],
    ["Transferable strengths", profile.strengths],
    ["Skills to develop", profile.skillsToDevelop],
    ["Learning preferences", [
      profile.learningMode,
      profile.weeklyHours ? `${profile.weeklyHours} hours per week` : "",
      profile.learningBudget ? `MYR ${profile.learningBudget} budget` : "",
    ].filter(Boolean).join(" · ")],
  ] as const;

  return <>
    <p className="cv-source-note no-print">Preview uses the details collected in your registration profile · stored in this browser session · dates and proficiency levels are not inferred.</p>
    <article className={`cv-document cv-template-${template}`} aria-label={`${template === "field" ? "Field notes" : "Clearline"} CV preview`}>
      <header className="cv-document-header">
        <div className="cv-document-mark" aria-hidden="true">{fullName.slice(0, 1).toUpperCase()}</div>
        <div><p className="cv-doc-kicker">PATHWAAY · FICTIONAL PROFILE</p><h2>{fullName}</h2><p className="cv-doc-subtitle">{[profile.major, profile.educationLevel].filter(Boolean).join(" · ")}</p>{profile.university && <p className="cv-doc-contact">{profile.university}</p>}{profile.email && <p className="cv-doc-contact">{profile.email}</p>}</div>
      </header>
      {profile.profileSummary && <section className="cv-doc-section cv-summary"><h3>Profile</h3><p>{profile.profileSummary}</p></section>}
      {profile.aspiration && <section className="cv-doc-section"><h3>Career direction</h3><p>{profile.aspiration}</p></section>}
      {profile.skills.length > 0 && <section className="cv-doc-section"><h3>Skills</h3><ul className="cv-skill-list">{profile.skills.map((skill, index) => {
        const link = profile.skillLinks?.find((item) => item.name.toLowerCase() === skill.toLowerCase());
        return <li key={`${skill}-${index}`}><strong>{skill}</strong><span>{link?.taxonomy_source ?? "Registration entry"}</span>{link?.skill_id && <small>{link.skill_id}</small>}</li>;
      })}</ul></section>}
      {educationDetails.length > 0 && <section className="cv-doc-section"><h3>Education</h3><p>{educationDetails.join(" · ")}</p></section>}
      {experiences.length > 0 && <section className="cv-doc-section cv-record-section"><h3>Experience</h3>{experiences.map((item) => <article className="cv-record" key={item.id}>
        <div className="cv-record-heading"><div>{item.title && <h4>{item.title}</h4>}{item.company && <p>{item.company}</p>}</div>{item.timeframe && <span>{item.timeframe}</span>}</div>
        {item.description && <p className="cv-record-description">{item.description}</p>}
      </article>)}</section>}
      {records.map(([label, text]) => text.trim() && <section className="cv-doc-section" key={label}><h3>{label}</h3><p className="cv-record-description">{text}</p></section>)}
      {!profile.profileSummary && !profile.skills.length && !educationDetails.length && !experiences.length && records.every(([, text]) => !text.trim()) && <div className="cv-empty-record"><h3>This preview is waiting for your registration details.</h3><p>Add a summary, skills or experience in your profile, then return here.</p></div>}
      <footer className="cv-document-footer"><span>Fictional registration profile · browser session</span><span>Pathwaay / Domain 1</span></footer>
    </article>
  </>;
}

export default function CVStudioPage() {
  const { profile, loading, error, reload } = useSavedProfile();
  const { profile: registrationProfile, loading: registrationLoading } = useRegistrationProfile();
  const [template, setTemplate] = useState<TemplateName>("field");
  return <main className="page-wrap cv-studio-page">
    <PageIntro kicker="CV STUDIO · PROFILE PREVIEW" title={<>A clean view of<br />what you’ve confirmed.</>} description="Choose a layout and preview the details in your registration profile or saved fictional profile. The preview never invents missing titles, dates or employers." index="DOCUMENT STUDIO / 05" />
    {registrationLoading ? <ProfileGate loading error="" onRetry={() => {}} /> : registrationProfile ? <>
      <CvTemplateControls template={template} onTemplateChange={setTemplate} />
      <RegistrationCvPreview profile={registrationProfile} template={template} />
    </> : loading || error || !profile ? <ProfileGate loading={loading} error={error} onRetry={() => void reload()} /> : <>
      <CvTemplateControls template={template} onTemplateChange={setTemplate} />
      <p className="cv-source-note no-print">Preview uses saved profile data only · last saved {new Date(profile.updated_at).toLocaleDateString(undefined, { dateStyle: "medium" })} · no unsaved editor changes appear here.</p>
      <article className={`cv-document cv-template-${template}`} aria-label={`${template === "field" ? "Field notes" : "Clearline"} CV preview`}>
        <header className="cv-document-header">
          <div className="cv-document-mark" aria-hidden="true">P</div>
          <div><p className="cv-doc-kicker">PATHWAAY · FICTIONAL PROFILE</p><h2>{profile.current_occupation || profile.field_of_study || "Professional profile"}</h2><p className="cv-doc-subtitle">{profile.field_of_study}{profile.education_level ? ` · ${profile.education_level.replaceAll("_", " ")}` : ""}</p></div>
          <div className="cv-doc-date">PROFILE<br /><strong>{new Date(profile.updated_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</strong></div>
        </header>
        {profile.professional_summary && <section className="cv-doc-section cv-summary"><h3>Profile</h3><p>{profile.professional_summary}</p></section>}
        {profile.skills.length > 0 && <section className="cv-doc-section"><h3>Skills</h3><ul className="cv-skill-list">{profile.skills.map((skill, index) => <li key={`${skill.skill_id ?? "custom"}-${index}`}><strong>{skill.display_name}</strong><span>{skill.skill_id ? "Local vocabulary" : "Custom entry"} · {skill.proficiency}</span>{skill.evidence_record_ids.length > 0 && <small>{skill.evidence_record_ids.length} linked record{skill.evidence_record_ids.length === 1 ? "" : "s"}</small>}</li>)}</ul></section>}
        {groups.map(([key, label]) => {
          const records = profile[key];
          if (!records.length) return null;
          return <section className="cv-doc-section cv-record-section" key={key}><h3>{label}</h3>{records.map((record) => {
            const linkedSkills = profile.skills.filter((skill) => record.skill_ids.includes(profileSkillEvidenceKey(skill))).map((skill) => skill.display_name);
            return <article className="cv-record" key={record.id}><div className="cv-record-heading"><div>{record.title && <h4>{record.title}</h4>}{record.organization && <p>{record.organization}</p>}</div>{record.period && <span>{record.period}</span>}</div>{record.description && <p className="cv-record-description">{record.description}</p>}{linkedSkills.length > 0 && <p className="cv-record-skills"><span>Linked skills</span> {linkedSkills.join(" · ")}</p>}</article>;
          })}</section>;
        })}
        {!profile.professional_summary && !profile.skills.length && groups.every(([key]) => profile[key].length === 0) && <div className="cv-empty-record"><h3>This preview is waiting for your saved details.</h3><p>Add a summary, skills or evidence records in Profile, then save and return here.</p></div>}
        <footer className="cv-document-footer"><span>Fictional demonstration profile · no contact details stored</span><span>Pathwaay / Domain 1</span></footer>
      </article>
    </>}
  </main>;
}

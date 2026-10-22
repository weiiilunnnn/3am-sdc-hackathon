"use client";

import { useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PathwaayExperience, PathwaayRegistrationProfile } from "@/lib/pathwaay-profile";

type EditableSection = "identity" | "intro" | "education" | "skills" | "experience" | "milestones" | "direction" | "learning";
type ExperienceField = keyof PathwaayExperience;

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="completed-detail"><span>{label}</span><strong>{value || "Not added"}</strong></div>;
}

function TextGroup({ title, text }: { title: string; text: string }) {
  if (!text.trim()) return null;
  return <div className="completed-text-group"><h3>{title}</h3><p>{text}</p></div>;
}

function EditorField({ label, value, onChange, multiline = false, type = "text" }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  type?: string;
}) {
  return <label className="completed-editor-field">{label}{multiline
    ? <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} />
    : <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />}</label>;
}

function SectionHeading({ id, number, title, subtitle }: { id: string; number: string; title: string; subtitle: string }) {
  return <div className="completed-section-heading"><span>{number}</span><div><h2 id={id}>{title}</h2><p>{subtitle}</p></div></div>;
}

function compressPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("This browser could not prepare the image."));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("The selected image could not be opened."));
    };
    image.src = objectUrl;
  });
}

export default function CompletedProfile({ profile, onProfileChange, editPage = false }: {
  profile: PathwaayRegistrationProfile;
  onProfileChange: (profile: PathwaayRegistrationProfile) => void;
  editPage?: boolean;
}) {
  const [draft, setDraft] = useState(profile);
  const [photoMessage, setPhotoMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const router = useRouter();

  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Your Pathwaay profile";
  const initials = [profile.firstName, profile.lastName].filter(Boolean).map((part) => part[0]?.toUpperCase()).join("") || "P";
  const experience = profile.experiences.filter((entry) => entry.title.trim() || entry.company.trim() || entry.description.trim());
  const details = [profile.interests, profile.workActivities, profile.strengths, profile.skillsToDevelop, profile.aspiration].filter((item) => item.trim()).length;

  function saveEdit() {
    try {
      onProfileChange(draft);
      setSaveError("");
      if (editPage) router.push("/profile");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Your changes could not be saved.");
    }
  }

  function updateExperience(index: number, key: ExperienceField, value: string) {
    setDraft((current) => ({
      ...current,
      experiences: current.experiences.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item),
    }));
  }

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoMessage("Choose an image file, such as JPG, PNG or WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoMessage("Choose an image smaller than 5 MB.");
      return;
    }
    try {
      const photoDataUrl = await compressPhoto(file);
      setDraft((current) => ({ ...current, photoDataUrl }));
      setPhotoMessage("Profile photo updated for this session.");
    } catch (error) {
      setPhotoMessage(error instanceof Error ? error.message : "The photo could not be saved.");
    }
  }

  function removePhoto() {
    setDraft((current) => ({ ...current, photoDataUrl: undefined }));
    setPhotoMessage("Profile photo removed.");
  }

  const isEditing = (_section: EditableSection) => editPage;
  const shownPhoto = editPage ? draft.photoDataUrl : profile.photoDataUrl;

  return <main className={`page-wrap completed-profile${editPage ? " completed-profile-editing" : ""}`}>
    <div className="page-kicker"><span className="kicker-dot" /> YOUR WORKSPACE <span>·</span> MY PROFILE{editPage && <><span>·</span> EDIT</>}</div>
    <div className="completed-profile-hero">
      <div className="completed-identity">
        {shownPhoto
          ? <img className="completed-avatar completed-avatar-photo" src={shownPhoto} alt={`${fullName} profile`} />
          : <div className="completed-avatar" aria-hidden="true">{initials}</div>}
        <div>
          <span className="completed-status"><i /> {editPage ? "EDIT YOUR PROFILE" : "PROFILE READY · SESSION PREVIEW"}</span>
          {isEditing("identity") ? <div className="completed-identity-editor">
            <EditorField label="First name" value={draft.firstName} onChange={(value) => setDraft((current) => ({ ...current, firstName: value }))} />
            <EditorField label="Last name" value={draft.lastName} onChange={(value) => setDraft((current) => ({ ...current, lastName: value }))} />
            <EditorField label="Field of study" value={draft.major} onChange={(value) => setDraft((current) => ({ ...current, major: value }))} />
            <EditorField label="School or university" value={draft.university} onChange={(value) => setDraft((current) => ({ ...current, university: value }))} />
          </div> : <><h1>{fullName}</h1><p>{profile.major || "Your field of study"}{profile.university ? ` · ${profile.university}` : ""}</p></>}
          {editPage && <div className="completed-photo-actions">
            <label className="button secondary small" htmlFor="completed-profile-photo">{shownPhoto ? "Change photo" : "Upload photo"}</label>
            <input className="completed-photo-input" id="completed-profile-photo" type="file" accept="image/*" onChange={(event) => void handlePhoto(event)} />
            {shownPhoto && <button className="button ghost small" type="button" onClick={removePhoto}>Remove photo</button>}
          </div>}
          {editPage && photoMessage && <span className="completed-photo-message" role="status">{photoMessage}</span>}
        </div>
      </div>
      <div className="completed-hero-actions">
        {editPage ? (
          <>
            <button className="button small" type="button" onClick={saveEdit}>Save changes <span aria-hidden="true">→</span></button>
            <Link className="button secondary small" href="/profile">Cancel</Link>
          </>
        ) : (
          <Link className="button small" href="/profile/edit">Edit profile <span aria-hidden="true">↗</span></Link>
        )}
      </div>
    </div>
    {editPage && saveError && <p className="completed-save-error" role="alert">{saveError}</p>}

    <div className="completed-profile-grid">
      <div className="completed-profile-main">
        <section className="completed-panel completed-intro" aria-labelledby="completed-intro-heading">
          <div className="completed-section-title-row"><div className="completed-section-kicker">YOUR PROFILE</div></div>
          {isEditing("intro") ? <><h2 className="visually-hidden" id="completed-intro-heading">Profile summary</h2><div className="completed-editor-grid">
            <EditorField label="Profile summary" value={draft.profileSummary} onChange={(value) => setDraft((current) => ({ ...current, profileSummary: value }))} multiline />
            <EditorField label="What I’m moving toward" value={draft.aspiration} onChange={(value) => setDraft((current) => ({ ...current, aspiration: value }))} multiline />
          </div></> : <><h2 id="completed-intro-heading">A clear starting point for what comes next.</h2>
            <p>{profile.profileSummary.trim() || `A ${profile.educationLevel.toLowerCase()} learner focused on ${profile.major || "building new skills"}${profile.skills.length ? `, with strengths in ${profile.skills.slice(0, 3).join(", ")}` : ""}.`}</p>
            {profile.aspiration.trim() && <div className="completed-aspiration"><span>WHAT I’M MOVING TOWARD</span><strong>{profile.aspiration}</strong></div>}</>}
        </section>

        <section className="completed-panel" aria-labelledby="completed-education-heading">
          <SectionHeading id="completed-education-heading" number="01" title="Education" subtitle="Your study background and milestones" />
          {isEditing("education") ? <div className="completed-editor-grid">
            <EditorField label="Education level" value={draft.educationLevel} onChange={(value) => setDraft((current) => ({ ...current, educationLevel: value }))} />
            <EditorField label="School or university" value={draft.university} onChange={(value) => setDraft((current) => ({ ...current, university: value }))} />
            <EditorField label="Field of study" value={draft.major} onChange={(value) => setDraft((current) => ({ ...current, major: value }))} />
            <EditorField label="Overall CGPA" value={draft.cgpa} onChange={(value) => setDraft((current) => ({ ...current, cgpa: value }))} />
            <EditorField label="Honours and awards" value={draft.schoolAwards} onChange={(value) => setDraft((current) => ({ ...current, schoolAwards: value }))} multiline />
            <EditorField label="Learning and coursework" value={draft.educationRecord} onChange={(value) => setDraft((current) => ({ ...current, educationRecord: value }))} multiline />
          </div> : <><div className="completed-detail-grid">
            <Detail label="Education level" value={profile.educationLevel} />
            <Detail label="School or university" value={profile.university} />
            <Detail label="Field of study" value={profile.major} />
            <Detail label="Overall CGPA" value={profile.cgpa ? `${profile.cgpa} / 4.00` : "Not added"} />
          </div>
            <TextGroup title="Honours and awards" text={profile.schoolAwards} />
            <TextGroup title="Learning and coursework" text={profile.educationRecord} /></>}
        </section>

        <section className="completed-panel" aria-labelledby="completed-skills-heading">
          <SectionHeading id="completed-skills-heading" number="02" title="Skills I’m building with" subtitle={`${profile.skills.length} selected skill${profile.skills.length === 1 ? "" : "s"}`} />
          {isEditing("skills") ? <div className="completed-editor-grid"><EditorField label="Skills (separate with commas)" value={draft.skills.join(", ")} onChange={(value) => setDraft((current) => ({ ...current, skills: value.split(",").map((skill) => skill.trim()).filter(Boolean) }))} multiline /></div>
            : profile.skills.length ? <div className="completed-skill-list">{profile.skills.map((skill, index) => <span className="completed-skill" key={`${skill}-${index}`}>{skill}</span>)}</div> : <p className="completed-empty">No skills added yet.</p>}
        </section>

        <section className="completed-panel" aria-labelledby="completed-experience-heading">
          <SectionHeading id="completed-experience-heading" number="03" title="Experience" subtitle={`${experience.length} role${experience.length === 1 ? "" : "s"} included`} />
          {isEditing("experience") ? <div className="completed-editor-grid">
            {draft.experiences.map((entry, index) => <div className="completed-experience-editor" key={entry.id}>
              <div className="completed-editor-grid">
                <EditorField label="Job title" value={entry.title} onChange={(value) => updateExperience(index, "title", value)} />
                <EditorField label="Company or organisation" value={entry.company} onChange={(value) => updateExperience(index, "company", value)} />
                <EditorField label="Timeframe" value={entry.timeframe} onChange={(value) => updateExperience(index, "timeframe", value)} />
                <EditorField label="Description" value={entry.description} onChange={(value) => updateExperience(index, "description", value)} multiline />
              </div>
              <button className="button ghost small" type="button" onClick={() => setDraft((current) => ({ ...current, experiences: current.experiences.filter((_, itemIndex) => itemIndex !== index) }))}>Remove experience</button>
            </div>)}
            <button className="button secondary small" type="button" onClick={() => setDraft((current) => ({ ...current, experiences: [...current.experiences, { id: `experience-${Date.now()}`, title: "", company: "", timeframe: "", description: "" }] }))}>Add experience</button>
            <EditorField label="Volunteering and work activities" value={draft.volunteering} onChange={(value) => setDraft((current) => ({ ...current, volunteering: value }))} multiline />
          </div> : <>{experience.length ? <div className="completed-experience-list">{experience.map((entry) => <article className="completed-experience" key={entry.id}>
            <div className="completed-experience-marker" aria-hidden="true" />
            <div><h3>{entry.title || "Experience"}</h3><p className="completed-experience-meta">{[entry.company, entry.timeframe].filter(Boolean).join(" · ")}</p>{entry.description && <p className="completed-experience-description">{entry.description}</p>}</div>
          </article>)}</div> : <p className="completed-empty">No job or placement details added yet.</p>}
            <TextGroup title="Volunteering and work activities" text={profile.volunteering} /></>}
        </section>

        {(profile.projects || profile.certifications || profile.achievements || isEditing("milestones")) && <section className="completed-panel" aria-labelledby="completed-proof-heading">
          <SectionHeading id="completed-proof-heading" number="04" title="Projects and milestones" subtitle="Examples of learning put into practice" />
          {isEditing("milestones") ? <div className="completed-editor-grid">
            <EditorField label="Projects" value={draft.projects} onChange={(value) => setDraft((current) => ({ ...current, projects: value }))} multiline />
            <EditorField label="Certifications and training" value={draft.certifications} onChange={(value) => setDraft((current) => ({ ...current, certifications: value }))} multiline />
            <EditorField label="Achievements" value={draft.achievements} onChange={(value) => setDraft((current) => ({ ...current, achievements: value }))} multiline />
          </div> : <><TextGroup title="Projects" text={profile.projects} /><TextGroup title="Certifications and training" text={profile.certifications} /><TextGroup title="Achievements" text={profile.achievements} /></>}
        </section>}
      </div>

      <aside className="completed-profile-aside">
        <section className="completed-panel completed-snapshot" aria-labelledby="completed-snapshot-heading">
          <div className="completed-section-kicker">AT A GLANCE</div>
          <h2 id="completed-snapshot-heading">My snapshot</h2>
          <Detail label="Roles" value={String(experience.length)} />
          <Detail label="Skills" value={String(profile.skills.length)} />
          <Detail label="Profile details" value={`${details} direction${details === 1 ? "" : "s"}`} />
          <div className="completed-session-note">This profile is a session preview kept in this browser tab; it is not saved to the profile database.</div>
        </section>

        <section className="completed-panel completed-direction" aria-labelledby="completed-direction-heading">
          <div className="completed-section-title-row"><div><div className="completed-section-kicker">DIRECTION</div><h2 id="completed-direction-heading">What matters to me</h2></div></div>
          {isEditing("direction") ? <div className="completed-editor-grid">
            <EditorField label="Interests" value={draft.interests} onChange={(value) => setDraft((current) => ({ ...current, interests: value }))} multiline />
            <EditorField label="Work activities" value={draft.workActivities} onChange={(value) => setDraft((current) => ({ ...current, workActivities: value }))} multiline />
            <EditorField label="Transferable strengths" value={draft.strengths} onChange={(value) => setDraft((current) => ({ ...current, strengths: value }))} multiline />
            <EditorField label="Skills to develop" value={draft.skillsToDevelop} onChange={(value) => setDraft((current) => ({ ...current, skillsToDevelop: value }))} multiline />
            <EditorField label="Career aspiration" value={draft.aspiration} onChange={(value) => setDraft((current) => ({ ...current, aspiration: value }))} multiline />
          </div> : <><TextGroup title="Interests" text={profile.interests} /><TextGroup title="Work activities" text={profile.workActivities} /><TextGroup title="Transferable strengths" text={profile.strengths} /><TextGroup title="Skills to develop" text={profile.skillsToDevelop} /></>}
        </section>

        <section className="completed-panel completed-learning" aria-labelledby="completed-learning-heading">
          <div className="completed-section-title-row"><div><div className="completed-section-kicker">LEARNING PLAN</div><h2 id="completed-learning-heading">A pace that fits</h2></div></div>
          {isEditing("learning") ? <div className="completed-editor-grid">
            <EditorField label="Hours per week" value={draft.weeklyHours} onChange={(value) => setDraft((current) => ({ ...current, weeklyHours: value }))} type="number" />
            <EditorField label="Budget (MYR)" value={draft.learningBudget} onChange={(value) => setDraft((current) => ({ ...current, learningBudget: value }))} type="number" />
            <EditorField label="Preferred format" value={draft.learningMode} onChange={(value) => setDraft((current) => ({ ...current, learningMode: value }))} />
          </div> : <><Detail label="Hours per week" value={profile.weeklyHours ? `${profile.weeklyHours} hours` : "Open"} /><Detail label="Budget" value={profile.learningBudget ? `MYR ${profile.learningBudget}` : "Open"} /><Detail label="Format" value={profile.learningMode || "To explore"} /></>}
        </section>
      </aside>
    </div>
  </main>;
}

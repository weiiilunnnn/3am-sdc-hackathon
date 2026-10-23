"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
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

function EditIconButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button className="completed-edit-icon" type="button" aria-label={`Edit ${label}`} title={`Edit ${label}`} onClick={onClick}>
    <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.8 3.2 16.8 7.2M3.5 16.5l3.3-.7L16 6.6a1.7 1.7 0 0 0-2.4-2.4l-9.2 9.2-.9 3.1Z" /></svg>
  </button>;
}

function SectionHeading({ id, number, title, subtitle, onEdit }: { id: string; number: string; title: string; subtitle: string; onEdit?: () => void }) {
  return <div className="completed-section-heading"><span>{number}</span><div><h2 id={id}>{title}</h2><p>{subtitle}</p></div>{onEdit && <EditIconButton label={title} onClick={onEdit} />}</div>;
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
  onProfileChange: (profile: PathwaayRegistrationProfile) => void | Promise<void>;
  editPage?: boolean;
}) {
  const [draft, setDraft] = useState(profile);
  const [activeEditor, setActiveEditor] = useState<EditableSection | null>(null);
  const [photoMessage, setPhotoMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const router = useRouter();
  const editorDialogRef = useRef<HTMLDialogElement>(null);

  const displayProfile = editPage ? draft : profile;
  const fullName = [displayProfile.firstName, displayProfile.lastName].filter(Boolean).join(" ") || "Your Pathwaay profile";
  const initials = [displayProfile.firstName, displayProfile.lastName].filter(Boolean).map((part) => part[0]?.toUpperCase()).join("") || "P";
  const experience = displayProfile.experiences.filter((entry) => entry.title.trim() || entry.company.trim() || entry.description.trim());
  const details = [displayProfile.interests, displayProfile.workActivities, displayProfile.strengths, displayProfile.skillsToDevelop, displayProfile.aspiration].filter((item) => item.trim()).length;

  useEffect(() => {
    const dialog = editorDialogRef.current;
    if (activeEditor && dialog && !dialog.open) dialog.showModal();
    if (!activeEditor && dialog?.open) dialog.close();
  }, [activeEditor]);

  async function saveEdit() {
    if (saving) return;
    setSaving(true);
    try {
      await onProfileChange(draft);
      setSaveError("");
      if (editPage) router.push("/profile");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Your changes could not be saved.");
    } finally { setSaving(false); }
  }

  function updateSkillNames(value: string) {
    const skills = value.split(",").map((skill) => skill.trim()).filter(Boolean);
    setDraft((current) => {
      const links = new Map((current.skillLinks ?? []).map((link) => [link.name.toLowerCase(), link]));
      return {
        ...current,
        skills,
        skillLinks: skills.map((name) => links.get(name.toLowerCase()) ?? {
          name,
          skill_id: null,
          taxonomy_source: "Custom · not taxonomy-linked",
        }),
      };
    });
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

  function editSection(section: EditableSection) {
    setActiveEditor(section);
  }

  function editorFields() {
    switch (activeEditor) {
      case "identity":
        return <div className="completed-editor-grid">
          <EditorField label="First name" value={draft.firstName} onChange={(value) => setDraft((current) => ({ ...current, firstName: value }))} />
          <EditorField label="Last name" value={draft.lastName} onChange={(value) => setDraft((current) => ({ ...current, lastName: value }))} />
          <EditorField label="Email address" value={draft.email ?? ""} onChange={(value) => setDraft((current) => ({ ...current, email: value }))} type="email" />
          <EditorField label="Field of study" value={draft.major} onChange={(value) => setDraft((current) => ({ ...current, major: value }))} />
          <EditorField label="School or university" value={draft.university} onChange={(value) => setDraft((current) => ({ ...current, university: value }))} />
        </div>;
      case "intro":
        return <div className="completed-editor-grid">
          <EditorField label="Profile summary" value={draft.profileSummary} onChange={(value) => setDraft((current) => ({ ...current, profileSummary: value }))} multiline />
          <EditorField label="What I’m moving toward" value={draft.aspiration} onChange={(value) => setDraft((current) => ({ ...current, aspiration: value }))} multiline />
        </div>;
      case "education":
        return <div className="completed-editor-grid">
          <EditorField label="Education level" value={draft.educationLevel} onChange={(value) => setDraft((current) => ({ ...current, educationLevel: value }))} />
          <EditorField label="School or university" value={draft.university} onChange={(value) => setDraft((current) => ({ ...current, university: value }))} />
          <EditorField label="Field of study" value={draft.major} onChange={(value) => setDraft((current) => ({ ...current, major: value }))} />
          <EditorField label="Overall CGPA" value={draft.cgpa} onChange={(value) => setDraft((current) => ({ ...current, cgpa: value }))} />
          <EditorField label="Honours and awards" value={draft.schoolAwards} onChange={(value) => setDraft((current) => ({ ...current, schoolAwards: value }))} multiline />
          <EditorField label="Learning and coursework" value={draft.educationRecord} onChange={(value) => setDraft((current) => ({ ...current, educationRecord: value }))} multiline />
        </div>;
      case "skills":
        return <div className="completed-editor-grid"><EditorField label="Skills (separate with commas)" value={draft.skills.join(", ")} onChange={updateSkillNames} multiline /></div>;
      case "experience":
        return <div className="completed-experience-modal-editor">
          <button className="button secondary small completed-add-experience" type="button" onClick={() => setDraft((current) => ({ ...current, experiences: [...current.experiences, { id: `experience-${Date.now()}`, title: "", company: "", timeframe: "", description: "" }] }))}><span aria-hidden="true">+</span> Add experience</button>
          <div className="completed-editor-grid">
            {draft.experiences.map((entry, index) => <div className="completed-experience-editor" key={entry.id}>
              <div className="completed-editor-grid">
                <EditorField label="Job title" value={entry.title} onChange={(value) => updateExperience(index, "title", value)} />
                <EditorField label="Company or organisation" value={entry.company} onChange={(value) => updateExperience(index, "company", value)} />
                <EditorField label="Timeframe" value={entry.timeframe} onChange={(value) => updateExperience(index, "timeframe", value)} />
                <EditorField label="Description" value={entry.description} onChange={(value) => updateExperience(index, "description", value)} multiline />
              </div>
              <button className="button ghost small" type="button" onClick={() => setDraft((current) => ({ ...current, experiences: current.experiences.filter((_, itemIndex) => itemIndex !== index) }))}>Remove experience</button>
            </div>)}
          </div>
          <EditorField label="Volunteering and work activities" value={draft.volunteering} onChange={(value) => setDraft((current) => ({ ...current, volunteering: value }))} multiline />
        </div>;
      case "milestones":
        return <div className="completed-editor-grid">
          <EditorField label="Projects" value={draft.projects} onChange={(value) => setDraft((current) => ({ ...current, projects: value }))} multiline />
          <EditorField label="Certifications and training" value={draft.certifications} onChange={(value) => setDraft((current) => ({ ...current, certifications: value }))} multiline />
          <EditorField label="Achievements" value={draft.achievements} onChange={(value) => setDraft((current) => ({ ...current, achievements: value }))} multiline />
        </div>;
      case "direction":
        return <div className="completed-editor-grid">
          <EditorField label="Interests" value={draft.interests} onChange={(value) => setDraft((current) => ({ ...current, interests: value }))} multiline />
          <EditorField label="Work activities" value={draft.workActivities} onChange={(value) => setDraft((current) => ({ ...current, workActivities: value }))} multiline />
          <EditorField label="Transferable strengths" value={draft.strengths} onChange={(value) => setDraft((current) => ({ ...current, strengths: value }))} multiline />
          <EditorField label="Skills to develop" value={draft.skillsToDevelop} onChange={(value) => setDraft((current) => ({ ...current, skillsToDevelop: value }))} multiline />
          <EditorField label="Career aspiration" value={draft.aspiration} onChange={(value) => setDraft((current) => ({ ...current, aspiration: value }))} multiline />
        </div>;
      case "learning":
        return <div className="completed-editor-grid">
          <EditorField label="Hours per week" value={draft.weeklyHours} onChange={(value) => setDraft((current) => ({ ...current, weeklyHours: value }))} type="number" />
          <EditorField label="Budget (MYR)" value={draft.learningBudget} onChange={(value) => setDraft((current) => ({ ...current, learningBudget: value }))} type="number" />
          <EditorField label="Preferred format" value={draft.learningMode} onChange={(value) => setDraft((current) => ({ ...current, learningMode: value }))} />
        </div>;
      default:
        return null;
    }
  }

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
          {editPage && <EditIconButton label="personal details" onClick={() => editSection("identity")} />}
          <h1>{fullName}</h1><p>{displayProfile.major || "Your field of study"}{displayProfile.university ? ` · ${displayProfile.university}` : ""}</p>{displayProfile.email && <p>{displayProfile.email}</p>}
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
            <button className="button small" type="button" onClick={saveEdit} disabled={saving}>Save changes <span aria-hidden="true">→</span></button>
            <Link className="button secondary small" href="/profile">Cancel</Link>
          </>
        ) : (
          <Link className="button small" href="/profile/edit">Edit profile <span aria-hidden="true">↗</span></Link>
        )}
      </div>
    </div>
    {editPage && saving && <p role="status">Saving your profile...</p>}
    {editPage && saveError && <p className="completed-save-error" role="alert">{saveError}</p>}

    <div className="completed-profile-grid">
      <div className="completed-profile-main">
        <section className="completed-panel completed-intro" aria-labelledby="completed-intro-heading">
          <div className="completed-section-title-row"><div className="completed-section-kicker">YOUR PROFILE</div>{editPage && <EditIconButton label="profile summary" onClick={() => editSection("intro")} />}</div>
          <h2 id="completed-intro-heading">A clear starting point for what comes next.</h2>
          <p>{displayProfile.profileSummary.trim() || `A ${displayProfile.educationLevel.toLowerCase()} learner focused on ${displayProfile.major || "building new skills"}${displayProfile.skills.length ? `, with strengths in ${displayProfile.skills.slice(0, 3).join(", ")}` : ""}.`}</p>
          {displayProfile.aspiration.trim() && <div className="completed-aspiration"><span>WHAT I’M MOVING TOWARD</span><strong>{displayProfile.aspiration}</strong></div>}
        </section>

        <section className="completed-panel" aria-labelledby="completed-education-heading">
          <SectionHeading id="completed-education-heading" number="01" title="Education" subtitle="Your study background and milestones" onEdit={editPage ? () => editSection("education") : undefined} />
          <><div className="completed-detail-grid">
            <Detail label="Education level" value={displayProfile.educationLevel} />
            <Detail label="School or university" value={displayProfile.university} />
            <Detail label="Field of study" value={displayProfile.major} />
            <Detail label="Overall CGPA" value={displayProfile.cgpa ? `${displayProfile.cgpa} / 4.00` : "Not added"} />
          </div>
            <TextGroup title="Honours and awards" text={displayProfile.schoolAwards} />
            <TextGroup title="Learning and coursework" text={displayProfile.educationRecord} /></>
        </section>

        <section className="completed-panel" aria-labelledby="completed-skills-heading">
          <SectionHeading id="completed-skills-heading" number="02" title="Skills I’m building with" subtitle={`${displayProfile.skills.length} selected skill${displayProfile.skills.length === 1 ? "" : "s"}`} onEdit={editPage ? () => editSection("skills") : undefined} />
          {displayProfile.skills.length ? <div className="completed-skill-list">{displayProfile.skills.map((skill, index) => {
              const link = displayProfile.skillLinks?.find((item) => item.name.toLowerCase() === skill.toLowerCase());
              return <span className="completed-skill" key={`${skill}-${index}`}><span>{skill}</span><small>{link?.skill_id ? `${link.taxonomy_source} · ${link.skill_id}` : link?.taxonomy_source ?? "No taxonomy link"}</small></span>;
            })}</div> : <p className="completed-empty">No skills added yet.</p>}
        </section>

        <section className="completed-panel" aria-labelledby="completed-experience-heading">
          <SectionHeading id="completed-experience-heading" number="03" title="Experience" subtitle={`${experience.length} role${experience.length === 1 ? "" : "s"} included`} onEdit={editPage ? () => editSection("experience") : undefined} />
          <>{experience.length ? <div className="completed-experience-list">{experience.map((entry) => <article className="completed-experience" key={entry.id}>
            <div className="completed-experience-marker" aria-hidden="true" />
            <div><h3>{entry.title || "Experience"}</h3><p className="completed-experience-meta">{[entry.company, entry.timeframe].filter(Boolean).join(" · ")}</p>{entry.description && <p className="completed-experience-description">{entry.description}</p>}</div>
          </article>)}</div> : <p className="completed-empty">No job or placement details added yet.</p>}
            <TextGroup title="Volunteering and work activities" text={displayProfile.volunteering} /></>
        </section>

        {(displayProfile.projects || displayProfile.certifications || displayProfile.achievements || editPage) && <section className="completed-panel" aria-labelledby="completed-proof-heading">
          <SectionHeading id="completed-proof-heading" number="04" title="Projects and milestones" subtitle="Examples of learning put into practice" onEdit={editPage ? () => editSection("milestones") : undefined} />
          <><TextGroup title="Projects" text={displayProfile.projects} /><TextGroup title="Certifications and training" text={displayProfile.certifications} /><TextGroup title="Achievements" text={displayProfile.achievements} /></>
        </section>}
      </div>

      <aside className="completed-profile-aside">
        <section className="completed-panel completed-snapshot" aria-labelledby="completed-snapshot-heading">
          <div className="completed-section-kicker">AT A GLANCE</div>
          <h2 id="completed-snapshot-heading">My snapshot</h2>
          <Detail label="Roles" value={String(experience.length)} />
          <Detail label="Skills" value={String(displayProfile.skills.length)} />
          <Detail label="Profile details" value={`${details} direction${details === 1 ? "" : "s"}`} />
          <div className="completed-session-note">This profile is a session preview kept in this browser tab; it is not saved to the profile database.</div>
        </section>

        <section className="completed-panel completed-direction" aria-labelledby="completed-direction-heading">
          <div className="completed-section-title-row"><div><div className="completed-section-kicker">DIRECTION</div><h2 id="completed-direction-heading">What matters to me</h2></div>{editPage && <EditIconButton label="direction" onClick={() => editSection("direction")} />}</div>
          <><TextGroup title="Interests" text={displayProfile.interests} /><TextGroup title="Work activities" text={displayProfile.workActivities} /><TextGroup title="Transferable strengths" text={displayProfile.strengths} /><TextGroup title="Skills to develop" text={displayProfile.skillsToDevelop} /></>
        </section>

        <section className="completed-panel completed-learning" aria-labelledby="completed-learning-heading">
          <div className="completed-section-title-row"><div><div className="completed-section-kicker">LEARNING PLAN</div><h2 id="completed-learning-heading">A pace that fits</h2></div>{editPage && <EditIconButton label="learning plan" onClick={() => editSection("learning")} />}</div>
          <><Detail label="Hours per week" value={displayProfile.weeklyHours ? `${displayProfile.weeklyHours} hours` : "Open"} /><Detail label="Budget" value={displayProfile.learningBudget ? `MYR ${displayProfile.learningBudget}` : "Open"} /><Detail label="Format" value={displayProfile.learningMode || "To explore"} /></>
        </section>
      </aside>
    </div>
    <dialog
      ref={editorDialogRef}
      className="completed-editor-dialog"
      aria-labelledby="completed-editor-title"
      onClose={() => setActiveEditor(null)}
      onCancel={(event) => {
        event.preventDefault();
        setActiveEditor(null);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          setActiveEditor(null);
        }
      }}
    >
      {activeEditor && <div className="completed-editor-dialog-content">
        <div className="completed-editor-dialog-heading">
          <div><span className="completed-section-kicker">EDIT PROFILE</span><h2 id="completed-editor-title">{({
            identity: "Personal details",
            intro: "Profile summary",
            education: "Education",
            skills: "Skills",
            experience: "Experience",
            milestones: "Projects and milestones",
            direction: "What matters to me",
            learning: "Learning plan",
          })[activeEditor]}</h2></div>
          <button className="completed-editor-close" type="button" aria-label="Close editor" onClick={() => setActiveEditor(null)}>×</button>
        </div>
        {editorFields()}
        <p className="completed-editor-note">Your edits are a draft until you select “Save changes” on your profile.</p>
        <div className="completed-edit-actions"><button className="button small" type="button" onClick={() => setActiveEditor(null)}>Done</button></div>
      </div>}
    </dialog>
  </main>;
}

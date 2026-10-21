"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiError, createProfile, extractCV, getProfile, getSampleProfiles, getSkills, updateProfile,
  type CVExtraction, type EducationLevel, type LearningMode, type ProfileDraft, type ProfileStatus,
  type ProfileItem, type Proficiency, type SampleProfile, type SkillOption, type StoredProfile,
} from "@/lib/api";
import { splitCommaList, validateProfileDraft } from "@/lib/profile-validation";

const PROFILE_KEY = "aiversecity.synthetic-profile-id";
const statusOptions: [ProfileStatus, string][] = [["student", "Student"], ["fresh_graduate", "Fresh graduate"], ["employed", "Employed"], ["career_switcher", "Career switcher"], ["other", "Other"]];
const educationOptions: [EducationLevel, string][] = [["secondary", "Secondary"], ["certificate", "Certificate"], ["diploma", "Diploma"], ["bachelor", "Bachelor’s degree"], ["postgraduate", "Postgraduate"], ["other", "Other"]];
const proficiencyOptions: [Proficiency, string][] = [["beginner", "Beginner"], ["intermediate", "Intermediate"], ["advanced", "Advanced"]];
const learningModes: [LearningMode, string][] = [["self_paced", "Self-paced"], ["instructor_led", "Instructor-led"], ["peer_learning", "Peer learning"], ["mixed", "A mix of formats"]];

const emptyDraft: ProfileDraft = {
  status: "student", education_level: "bachelor", field_of_study: "", professional_summary: "", current_occupation: "",
  years_experience: 0, skills: [], interests: [], work_activities: [], transferable_strengths: [],
  career_aspirations: "", skills_to_develop: [], education: [], experience: [], projects: [], certifications: [], achievements: [],
  learning_preferences: { weekly_hours: null, budget_myr: null, mode: null }, synthetic_demo: true,
};

function draftFromProfile(profile: StoredProfile | SampleProfile): ProfileDraft {
  return {
    status: profile.status, education_level: profile.education_level, field_of_study: profile.field_of_study,
    professional_summary: profile.professional_summary ?? "",
    current_occupation: profile.current_occupation, years_experience: profile.years_experience,
    skills: profile.skills.map((skill) => "display_name" in skill
      ? { name: skill.display_name, skill_id: skill.skill_id, proficiency: skill.proficiency, force_custom: skill.is_custom, evidence_record_ids: [...skill.evidence_record_ids] }
      : { name: skill.name, skill_id: skill.skill_id, proficiency: skill.proficiency, force_custom: skill.force_custom, evidence_record_ids: [...skill.evidence_record_ids] }),
    interests: [...profile.interests], work_activities: [...profile.work_activities],
    transferable_strengths: [...profile.transferable_strengths], career_aspirations: profile.career_aspirations,
    skills_to_develop: [...profile.skills_to_develop],
    education: profile.education.map((item) => ({ ...item, skill_ids: [...item.skill_ids] })),
    experience: profile.experience.map((item) => ({ ...item, skill_ids: [...item.skill_ids] })),
    projects: profile.projects.map((item) => ({ ...item, skill_ids: [...item.skill_ids] })),
    certifications: profile.certifications.map((item) => ({ ...item, skill_ids: [...item.skill_ids] })),
    achievements: profile.achievements.map((item) => ({ ...item, skill_ids: [...item.skill_ids] })),
    learning_preferences: { ...profile.learning_preferences }, synthetic_demo: true,
  };
}

type ListKey = "interests" | "work_activities" | "transferable_strengths" | "skills_to_develop";

function listTexts(profile: ProfileDraft): Record<ListKey, string> {
  return {
    interests: profile.interests.join(", "), work_activities: profile.work_activities.join(", "),
    transferable_strengths: profile.transferable_strengths.join(", "),
    skills_to_develop: profile.skills_to_develop.join(", "),
  };
}

function FormField({ label, hint, error, children, full = false }: { label: string; hint?: string; error?: string; children: React.ReactNode; full?: boolean }) {
  return <div className={`field${full ? " full" : ""}`}><label>{label}<span className="field-control">{children}</span></label>{hint && <span className="field-hint">{hint}</span>}{error && <span className="field-hint" role="alert" style={{ color: "var(--danger)" }}>{error}</span>}</div>;
}

const recordGroups = [
  ["education", "Education", "Study, coursework or learning records"],
  ["experience", "Experience", "Work, volunteering or practical experience"],
  ["projects", "Projects", "A project, contribution or piece of work"],
  ["certifications", "Certifications", "Certificates and completed training"],
  ["achievements", "Achievements", "Recognition or milestones"],
] as const;
type RecordGroup = typeof recordGroups[number][0];

function skillEvidenceKey(skill: { skill_id: string | null; name: string }) {
  return skill.skill_id ?? `custom:${skill.name.normalize("NFKC").trim().toLocaleLowerCase()}`;
}

function newRecord(): ProfileItem {
  return { id: `record-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title: "", organization: "", period: "", description: "", skill_ids: [] };
}

export default function Home() {
  const [draft, setDraft] = useState<ProfileDraft>(emptyDraft);
  const [listInputs, setListInputs] = useState(() => listTexts(emptyDraft));
  const [samples, setSamples] = useState<SampleProfile[]>([]);
  const [sampleError, setSampleError] = useState("");
  const [sampleLoading, setSampleLoading] = useState(true);
  const [profileId, setProfileId] = useState("");
  const [pendingProfileId, setPendingProfileId] = useState("");
  const [savedProfile, setSavedProfile] = useState<StoredProfile | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"success" | "error" | "info">("info");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [skillQuery, setSkillQuery] = useState("");
  const [skillOptions, setSkillOptions] = useState<SkillOption[]>([]);
  const [taxonomyNote, setTaxonomyNote] = useState("");
  const [skillLoading, setSkillLoading] = useState(false);
  const [skillMenu, setSkillMenu] = useState(false);
  const [skillLoadError, setSkillLoadError] = useState("");
  const [cvConsent, setCvConsent] = useState(false);
  const [cvBusy, setCvBusy] = useState(false);
  const [cvReview, setCvReview] = useState<CVExtraction | null>(null);
  const [cvSelectedSkills, setCvSelectedSkills] = useState<number[]>([]);
  const [cvSkillLevels, setCvSkillLevels] = useState<Record<number, Proficiency | "">>({});
  const [unratedSkills, setUnratedSkills] = useState<string[]>([]);
  const [cvNotice, setCvNotice] = useState("");
  const [cvError, setCvError] = useState("");

  const applyDraft = useCallback((next: ProfileDraft) => {
    setDraft(next);
    setListInputs(listTexts(next));
    setUnratedSkills([]);
  }, []);

  const restoreProfile = useCallback(async (id: string, active: () => boolean = () => true) => {
    setPageLoading(true);
    setPendingProfileId(id);
    try {
      const profile = await getProfile(id);
      if (active()) {
        setProfileId(profile.id);
        setSavedProfile(profile);
        applyDraft(draftFromProfile(profile));
        setPendingProfileId("");
        setMessage("Your saved fictional profile has been reloaded.");
        setMessageKind("success");
      }
    } catch (error) {
      if (active()) {
        if (error instanceof ApiError && error.status === 404) {
          setPendingProfileId("");
          let storageNote = "";
          try { localStorage.removeItem(PROFILE_KEY); } catch { storageNote = " This browser could not clear the stale reference."; }
          setMessage(`The saved fictional profile no longer exists on the server. Load a sample to start a new one.${storageNote}`);
        } else {
          setMessage("The saved profile could not be retrieved. Its reference is retained on this device. Retry loading it, or load a sample to start a separate fictional profile.");
        }
        setMessageKind("error");
      }
    } finally {
      if (active()) setPageLoading(false);
    }
  }, [applyDraft]);

  useEffect(() => {
    let active = true;
    void getSampleProfiles().then((result) => {
      if (active) setSamples(result.profiles);
    }).catch(() => {
      if (active) setSampleError("Fictional sample profiles could not be loaded. You can still create a profile from scratch.");
    }).finally(() => { if (active) setSampleLoading(false); });
    try {
      const id = localStorage.getItem(PROFILE_KEY);
      if (id) void restoreProfile(id, () => active);
      else setPageLoading(false);
    } catch {
      setPageLoading(false);
      setMessage("This browser cannot access saved-profile storage. Automatic reopening may not work.");
      setMessageKind("error");
    }
    return () => { active = false; };
  }, [restoreProfile]);

  useEffect(() => {
    let active = true;
    setSkillLoading(true);
    const timer = window.setTimeout(() => {
      getSkills(skillQuery).then((result) => {
        if (active) {
          setSkillOptions(result.skills);
          setTaxonomyNote(result.taxonomy.status_note);
          setSkillLoadError("");
        }
      }).catch(() => {
        if (active) { setSkillLoadError("Skill vocabulary is temporarily unavailable. You can still add a custom skill."); setSkillOptions([]); }
      }).finally(() => { if (active) setSkillLoading(false); });
    }, 220);
    return () => { active = false; window.clearTimeout(timer); };
  }, [skillQuery]);

  const skillIds = useMemo(() => new Map(skillOptions.map((option) => [option.id, option])), [skillOptions]);
  function addSkill(name: string, id: string | null, forceCustom = false) {
    const clean = name.trim();
    if (!clean || draft.skills.some((skill) => skill.name.toLowerCase() === clean.toLowerCase())) return;
    setDraft((current) => ({ ...current, skills: [...current.skills, { name: clean, skill_id: id, proficiency: "beginner", force_custom: forceCustom, evidence_record_ids: [] }] }));
    setUnratedSkills((current) => [...current, skillEvidenceKey({ skill_id: id, name: clean })]);
    setSkillQuery("");
    setSkillMenu(false);
    setErrors((current) => ({ ...current, skills: "" }));
  }

  function loadSample(sample: SampleProfile) {
    applyDraft(draftFromProfile(sample));
    setSavedProfile(null);
    setProfileId("");
    setPendingProfileId("");
    setConfirmed(false);
    setCvReview(null);
    setErrors({});
    setMessage(`${sample.label} loaded. Review the fictional details, then save when ready.`);
    setMessageKind("info");
  }

  function changeRecord(group: RecordGroup, id: string, patch: Partial<ProfileItem>) {
    setDraft((current) => ({ ...current, [group]: current[group].map((item) => item.id === id ? { ...item, ...patch } : item) }));
  }

  function removeRecord(group: RecordGroup, id: string) {
    setDraft((current) => ({
      ...current,
      [group]: current[group].filter((item) => item.id !== id),
      skills: current.skills.map((skill) => ({ ...skill, evidence_record_ids: skill.evidence_record_ids.filter((recordId) => recordId !== id) })),
    }));
  }

  function toggleRecordSkill(group: RecordGroup, record: ProfileItem, skill: ProfileDraft["skills"][number], checked: boolean) {
    const key = skillEvidenceKey(skill);
    const ids = checked ? Array.from(new Set([...record.skill_ids, key])) : record.skill_ids.filter((id) => id !== key);
    setDraft((current) => ({
      ...current,
      [group]: current[group].map((item) => item.id === record.id ? { ...item, skill_ids: ids } : item),
      skills: current.skills.map((item) => skillEvidenceKey(item) !== key ? item : {
        ...item,
        evidence_record_ids: checked
          ? Array.from(new Set([...item.evidence_record_ids, record.id]))
          : item.evidence_record_ids.filter((id) => id !== record.id),
      }),
    }));
  }

  function editSkillName(index: number, name: string) {
    const skill = draft.skills[index];
    if (!skill) return;
    const oldKey = skillEvidenceKey(skill);
    const nextKey = `custom:${name.normalize("NFKC").trim().toLocaleLowerCase()}`;
    setUnratedSkills((current) => current.map((item) => item === oldKey ? nextKey : item));
    setDraft((current) => ({
      ...current,
      skills: current.skills.map((item, itemIndex) => itemIndex === index ? { ...item, name, skill_id: null, force_custom: true } : item),
      education: current.education.map((record) => ({ ...record, skill_ids: record.skill_ids.map((id) => id === oldKey ? nextKey : id) })),
      experience: current.experience.map((record) => ({ ...record, skill_ids: record.skill_ids.map((id) => id === oldKey ? nextKey : id) })),
      projects: current.projects.map((record) => ({ ...record, skill_ids: record.skill_ids.map((id) => id === oldKey ? nextKey : id) })),
      certifications: current.certifications.map((record) => ({ ...record, skill_ids: record.skill_ids.map((id) => id === oldKey ? nextKey : id) })),
      achievements: current.achievements.map((record) => ({ ...record, skill_ids: record.skill_ids.map((id) => id === oldKey ? nextKey : id) })),
    }));
  }

  function removeSkill(index: number) {
    const skill = draft.skills[index];
    if (!skill) return;
    const key = skillEvidenceKey(skill);
    setUnratedSkills((current) => current.filter((item) => item !== key));
    setDraft((current) => ({
      ...current,
      skills: current.skills.filter((_, idx) => idx !== index),
      education: current.education.map((r) => ({ ...r, skill_ids: r.skill_ids.filter((id) => id !== key) })),
      experience: current.experience.map((r) => ({ ...r, skill_ids: r.skill_ids.filter((id) => id !== key) })),
      projects: current.projects.map((r) => ({ ...r, skill_ids: r.skill_ids.filter((id) => id !== key) })),
      certifications: current.certifications.map((r) => ({ ...r, skill_ids: r.skill_ids.filter((id) => id !== key) })),
      achievements: current.achievements.map((r) => ({ ...r, skill_ids: r.skill_ids.filter((id) => id !== key) })),
    }));
  }

  function chooseProficiency(index: number, proficiency: Proficiency) {
    const skill = draft.skills[index];
    if (!skill) return;
    const key = skillEvidenceKey(skill);
    setDraft((current) => ({ ...current, skills: current.skills.map((item, idx) => idx === index ? { ...item, proficiency } : item) }));
    setUnratedSkills((current) => current.filter((item) => item !== key));
  }

  async function reviewCV(file: File | undefined) {
    if (!file) return;
    if (!cvConsent) {
      setCvError("Confirm synthetic-only use before sending a file for extraction.");
      return;
    }
    setCvBusy(true);
    setCvError("");
    setCvNotice("");
    try {
      const result = await extractCV(file);
      setCvReview(result);
      setCvNotice("Extraction is ready for review. The selected file was sent for processing and is not saved by this workspace.");
    } catch (reason) {
      setCvError(reason instanceof Error ? reason.message : "CV extraction could not be completed.");
    } finally {
      setCvBusy(false);
    }
  }

  function applyCVReview() {
    if (!cvReview) return;
    if (cvSelectedSkills.some((index) => !cvSkillLevels[index])) {
      setCvError("Choose a proficiency for each selected skill before applying the review.");
      return;
    }
    const sectionToGroup: Record<string, RecordGroup | null> = {
      education: "education", experience: "experience", projects: "projects",
      certifications: "certifications", achievements: "achievements", skills: null,
    };
    setDraft((current) => {
      const next = { ...current, professional_summary: cvReview.summary === null ? current.professional_summary : cvReview.summary };
      for (const [section, group] of Object.entries(sectionToGroup)) {
        if (!group) continue;
        const imported = (cvReview.sections[section as keyof typeof cvReview.sections] ?? []).filter((line) => line.length > 0);
        if (imported.length) next[group] = [...next[group], ...imported.map((line) => ({ ...newRecord(), description: line }))];
      }
      const importedSkills = cvReview.skills.filter((_, index) => cvSelectedSkills.includes(index));
      for (const candidate of importedSkills) {
        const candidateIndex = cvReview.skills.indexOf(candidate);
        const name = candidate.canonical_name ?? candidate.original_text;
        if (!next.skills.some((skill) => skill.name.toLowerCase() === name.toLowerCase())) {
          next.skills = [...next.skills, { name, skill_id: candidate.skill_id, proficiency: cvSkillLevels[candidateIndex] as Proficiency, force_custom: !candidate.skill_id, evidence_record_ids: [] }];
        }
      }
      return next;
    });
    setCvReview(null);
    setCvSelectedSkills([]);
    setCvSkillLevels({});
    setCvNotice("Reviewed extraction added to your unsaved profile. Check each entry and save only when ready.");
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveLoading || pageLoading || pendingProfileId) return;
    const result = validateProfileDraft(draft);
    const nextErrors = { ...result.errors };
    if (unratedSkills.length) nextErrors.skills = "Choose a proficiency for each newly added skill before saving.";
    if (!confirmed) nextErrors.synthetic_demo = "Confirm that this is fictional demo data before saving.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).some((key) => nextErrors[key])) {
      setMessage("Review the highlighted fields before saving.");
      setMessageKind("error");
      return;
    }
    setSaveLoading(true);
    setMessage("");
    try {
      const stored = profileId ? await updateProfile(profileId, draft) : await createProfile(draft);
      setProfileId(stored.id);
      setSavedProfile(stored);
      applyDraft(draftFromProfile(stored));
      try {
        localStorage.setItem(PROFILE_KEY, stored.id);
        setMessage(profileId ? "Your fictional profile has been updated." : "Your fictional profile is saved and its reference is remembered on this device.");
        setMessageKind("success");
      } catch {
        setMessage(`The server saved profile ${stored.id}, but this browser could not remember its reference. Keep this ID; automatic reopening will not work.`);
        setMessageKind("info");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The profile could not be saved. Please try again.");
      setMessageKind("error");
    } finally {
      setSaveLoading(false);
    }
  }

  const setList = (key: ListKey) => (event: ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value;
    // Keep unfinished separators while typing; the API still receives normalized lists.
    setListInputs((current) => ({ ...current, [key]: text }));
    setDraft((current) => ({ ...current, [key]: splitCommaList(text) }));
  };

  return (
    <main className="page-wrap">
      <div className="page-kicker"><span className="kicker-dot" /> YOUR WORKSPACE <span>·</span> PROFILE & EVIDENCE</div>
      <div className="hero-row">
        <div><h1>Make room for<br />the work you’ve done.</h1><p className="hero-copy">Build a living profile from skills, learning and real evidence. Keep it fictional, useful and yours to revise.</p></div>
        <span className="hero-index">LEARNER WORKSPACE / PROFILE</span>
      </div>
      {pageLoading && <div className="message info" role="status" data-testid="loading-profile-message">Loading your profile workspace and checking for a saved fictional profile…</div>}
      {!pageLoading && pendingProfileId && <div className="message error" role="alert" data-testid="error-profile-retrieval">
        <span>{message}</span>{" "}
        <button type="button" className="button secondary small" onClick={() => void restoreProfile(pendingProfileId)} data-testid="button-retry-profile">Retry saved profile</button>
      </div>}
      <div className="notice" role="note" data-testid="notice-fictional-only">
        <span className="notice-icon" aria-hidden="true">!</span>
        <div><strong>Fictional demo profiles only</strong>Never enter real names, contact details or real CV content. CV review accepts fictional demonstration files only and does not save the original file. Use a sample or make up a profile.</div>
      </div>

      <div className="profile-grid">
        <form className="panel form-panel" onSubmit={saveProfile} noValidate data-testid="form-profile">
          <section className="form-section">
            <div className="section-heading"><span className="section-no">01</span><div><h2>Try a fictional starting point</h2><p>Loading a sample fills this form only; it will not save until you choose Save.</p></div></div>
            {sampleError && <div className="message error" role="alert" data-testid="error-samples">{sampleError}</div>}
            <div className="sample-row">
              {samples.slice(0, 5).map((sample) => <button type="button" disabled={pageLoading || saveLoading} className="button secondary small" key={sample.sample_id} onClick={() => loadSample(sample)} data-testid={`button-sample-${sample.sample_id}`}>{sample.label} <span aria-hidden="true">↗</span></button>)}
              {samples.length === 0 && !sampleError && <span className="field-hint">{sampleLoading ? "Loading fictional samples…" : "Samples will appear when available."}</span>}
            </div>
          </section>

          <section className="form-section">
            <div className="section-heading"><span className="section-no">02</span><div><h2>Your starting point</h2><p>A little context, with no identifying details.</p></div></div>
            <div className="field-grid">
              <FormField label="Current status"><select aria-label="Current status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as ProfileStatus })} data-testid="select-status">{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FormField>
              <FormField label="Education level"><select aria-label="Education level" value={draft.education_level} onChange={(e) => setDraft({ ...draft, education_level: e.target.value as EducationLevel })} data-testid="select-education">{educationOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FormField>
              <FormField label="Field of study" error={errors.field_of_study}><input aria-label="Field of study" value={draft.field_of_study} onChange={(e) => setDraft({ ...draft, field_of_study: e.target.value })} placeholder="e.g. information systems" data-testid="input-field-of-study" /></FormField>
              <FormField label="Current occupation" hint="Optional; use a fictional or general description." error={errors.current_occupation}><input aria-label="Current occupation" value={draft.current_occupation ?? ""} onChange={(e) => setDraft({ ...draft, current_occupation: e.target.value })} placeholder="e.g. retail assistant" data-testid="input-occupation" /></FormField>
              <FormField label="Years of experience" error={errors.years_experience}><input type="number" min="0" max="70" step="1" aria-label="Years of experience" value={draft.years_experience} onChange={(e) => setDraft({ ...draft, years_experience: Number(e.target.value) })} data-testid="input-experience" /></FormField>
              <FormField label="Professional summary" hint="A short, factual introduction. No identifying details." full><textarea aria-label="Professional summary" value={draft.professional_summary} onChange={(e) => setDraft({ ...draft, professional_summary: e.target.value })} placeholder="Describe your focus, experience or the kinds of work you enjoy." data-testid="input-professional-summary" /></FormField>
            </div>
          </section>

          <section className="form-section" id="skills-section">
            <div className="section-heading"><span className="section-no">03</span><div><h2>Skills you can name today</h2><p>Choose a vocabulary match, or keep an unfamiliar skill as custom.</p></div></div>
            <div className="skill-entry">
              <div className="skill-search-wrap">
                <input className="skill-search" aria-label="Search skills vocabulary" placeholder="Search skills, e.g. data analysis" value={skillQuery} onChange={(e) => { setSkillQuery(e.target.value); setSkillMenu(true); }} onFocus={() => setSkillMenu(true)} onBlur={() => window.setTimeout(() => setSkillMenu(false), 140)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const needle = skillQuery.trim().toLocaleLowerCase(); const match = skillOptions.find((option) => option.name.toLocaleLowerCase() === needle || option.aliases.some((alias) => alias.toLocaleLowerCase() === needle)); if (match) addSkill(match.name, match.id); else addSkill(skillQuery, null, true); } }} data-testid="input-skill-search" />
                {skillMenu && skillQuery.trim() && <div className="skill-results" role="listbox" data-testid="list-skill-options">
                  {skillLoading && <div className="field-hint" style={{ padding: 10 }}>Searching the vocabulary…</div>}
                  {!skillLoading && skillOptions.slice(0, 8).map((option) => <button type="button" className="skill-option" key={option.id} onMouseDown={(e) => e.preventDefault()} onClick={() => addSkill(option.name, option.id)} data-testid={`option-skill-${option.id}`}><span>{option.name}</span><small>{option.taxonomy_source}</small></button>)}
                  {!skillLoading && <button type="button" className="skill-option" onMouseDown={(e) => e.preventDefault()} onClick={() => addSkill(skillQuery, null, true)} data-testid="button-add-custom-skill"><span>Add “{skillQuery.trim()}” as custom</span><small>Not taxonomy-matched</small></button>}
                </div>}
              </div>
              <button type="button" className="button secondary" onClick={() => addSkill(skillQuery, null, true)} disabled={!skillQuery.trim()} data-testid="button-add-skill">Add as custom</button>
              <span className="field-hint">{skillLoading ? "Searching…" : "Pick a match or add custom"}</span>
            </div>
            {taxonomyNote && <p className="field-hint" data-testid="text-taxonomy-status">{taxonomyNote}</p>}
            {skillLoadError && <div className="message info" role="status" data-testid="status-skill-search">{skillLoadError}</div>}
            {errors.skills && <div className="field-hint" role="alert" style={{ color: "var(--danger)", marginTop: 10 }}>{errors.skills}</div>}
            {draft.skills.length > 0 && <div className="skill-list" data-testid="list-profile-skills">
              {draft.skills.map((skill, index) => {
                const option = skill.skill_id ? skillIds.get(skill.skill_id) : undefined;
                const normalized = savedProfile?.skills.find((item) => item.skill_id === skill.skill_id && item.display_name.toLowerCase() === skill.name.toLowerCase());
                const taxonomy = skill.skill_id ? (normalized?.taxonomy_source ?? option?.taxonomy_source ?? "Vocabulary-linked skill") : "Custom · no taxonomy match";
                return <div className="skill-chip" key={`${skill.skill_id ?? "custom"}-${skill.name}-${index}`} data-testid={`skill-profile-${index}`}>
                  <div><label className="skill-edit-label">Skill name<input aria-label={`Edit skill name ${index + 1}`} value={skill.name} onChange={(event) => editSkillName(index, event.target.value)} /></label><span className="skill-source">{taxonomy}{skill.skill_id ? ` · ${skill.skill_id}` : " · Custom entry"}</span><span className="skill-source">{skill.evidence_record_ids.length ? `${skill.evidence_record_ids.length} linked record${skill.evidence_record_ids.length === 1 ? "" : "s"}` : "No linked evidence yet"} · self-reported, not independently verified</span></div>
                  <select aria-label={`Choose proficiency for ${skill.name}`} value={unratedSkills.includes(`${skill.skill_id ?? "custom"}:${skill.name.toLowerCase()}`) ? "" : skill.proficiency} onChange={(e) => { if (e.target.value) chooseProficiency(index, e.target.value as Proficiency); }} data-testid={`select-proficiency-${index}`}><option value="" disabled>Choose level</option>{proficiencyOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                  <button type="button" className="icon-button" aria-label={`Remove ${skill.name}`} onClick={() => removeSkill(index)} data-testid={`button-remove-skill-${index}`}>×</button>
                </div>;
              })}
            </div>}
          </section>

          <section className="form-section" aria-labelledby="records-heading">
            <div className="section-heading"><span className="section-no">04</span><div><h2 id="records-heading">Keep evidence close to each skill</h2><p>Records are optional. Link only the skills a record actually supports.</p></div></div>
            <div className="record-groups">
              {recordGroups.map(([group, label, hint]) => <section className="record-group" key={group} id={`${group}-section`} aria-label={label}>
                <div className="record-group-head"><div><h3>{label}</h3><p>{hint}</p></div><button type="button" className="button secondary small" onClick={() => setDraft((current) => ({ ...current, [group]: [...current[group], newRecord()] }))}>Add {label.toLowerCase()}</button></div>
                {draft[group].length === 0 && <p className="record-empty">Nothing here yet. Add a short record when you have one to include.</p>}
                {draft[group].map((record, recordIndex) => <article className="record-editor" key={record.id}>
                  <div className="record-editor-top"><span className="record-count">{String(recordIndex + 1).padStart(2, "0")}</span><button className="button danger small" type="button" onClick={() => removeRecord(group, record.id)} aria-label={`Remove ${label} record ${recordIndex + 1}`}>Remove</button></div>
                  <div className="field-grid">
                    <FormField label="Title"><input value={record.title} onChange={(e) => changeRecord(group, record.id, { title: e.target.value })} placeholder="Add a title" /></FormField>
                    <FormField label="Organization"><input value={record.organization ?? ""} onChange={(e) => changeRecord(group, record.id, { organization: e.target.value })} placeholder="Optional" /></FormField>
                    <FormField label="Period"><input value={record.period ?? ""} onChange={(e) => changeRecord(group, record.id, { period: e.target.value })} placeholder="Optional" /></FormField>
                    <FormField label="Description" full><textarea value={record.description} onChange={(e) => changeRecord(group, record.id, { description: e.target.value })} placeholder="What happened? Keep it factual and fictional." /></FormField>
                  </div>
                  {draft.skills.length > 0 && <fieldset className="evidence-links"><legend>Skills this record supports · self-reported</legend><div className="evidence-options">{draft.skills.map((skill) => <label key={skillEvidenceKey(skill)}><input type="checkbox" checked={record.skill_ids.includes(skillEvidenceKey(skill))} onChange={(e) => toggleRecordSkill(group, record, skill, e.target.checked)} />{skill.name}</label>)}</div></fieldset>}
                </article>)}
              </section>)}
            </div>
            {errors.records && <p className="field-hint" role="alert" style={{ color: "var(--danger)" }}>{errors.records}</p>}
          </section>

          <section className="form-section cv-intake" aria-labelledby="cv-heading">
            <div className="section-heading"><span className="section-no">05</span><div><h2 id="cv-heading">Review a fictional CV locally</h2><p>Extraction is a starting point for careful editing, not an automatic profile save.</p></div></div>
            <div className="notice cv-notice" role="note"><span className="notice-icon" aria-hidden="true">!</span><div><strong>Synthetic examples only</strong>Do not upload a real CV or personal information. The selected file is sent for extraction only, kept transient in memory for this review, and never saved as a file by this workspace.</div></div>
            <label className="confirm-row cv-confirm"><input type="checkbox" checked={cvConsent} onChange={(e) => setCvConsent(e.target.checked)} /><span>I confirm this is a fictional demonstration CV with no real personal information.</span></label>
            <label className="cv-file-label">Choose a fictional file<input type="file" accept=".pdf,.docx" disabled={!cvConsent || cvBusy} onChange={(e) => { void reviewCV(e.target.files?.[0]); e.currentTarget.value = ""; }} aria-label="Choose a fictional CV for extraction" /></label>
            {cvBusy && <div className="message info" role="status">Reviewing the selected document…</div>}
            {cvError && <div className="message error" role="alert">{cvError}</div>}
            {cvNotice && <div className="message info" role="status">{cvNotice}</div>}
            {cvReview && <div className="cv-review">
              <div className="cv-review-head"><div><span className="topic-tag">REVIEW ONLY · NOT SAVED</span><h3>{cvReview.filename}</h3><p>Confirm every line. Extracted lines remain descriptions; title, organization and period are left blank.</p></div><button type="button" className="button ghost small" onClick={() => { setCvReview(null); setCvSelectedSkills([]); setCvSkillLevels({}); }}>Discard review</button></div>
              {cvReview.warnings.length > 0 && <ul className="cv-warnings">{cvReview.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul>}
              <label className="field"><span className="label-text">Extracted summary · edit before applying</span><textarea value={cvReview.summary ?? ""} onChange={(e) => setCvReview({ ...cvReview, summary: e.target.value })} /></label>
              {recordGroups.map(([group, label]) => {
                const section = group as keyof typeof cvReview.sections;
                const lines = cvReview.sections[section] ?? [];
                return <div className="cv-lines" key={group}><h4>{label} lines</h4>{lines.length ? lines.map((line, index) => <label className="field" key={`${group}-${index}`}><span className="label-text">Line {index + 1} · description</span><textarea value={line} onChange={(e) => setCvReview({ ...cvReview, sections: { ...cvReview.sections, [section]: lines.map((value, lineIndex) => lineIndex === index ? e.target.value : value) } })} /></label>) : <p className="field-hint">No lines extracted.</p>}</div>;
              })}
              <div className="cv-lines"><h4>Skill candidates · exact matching is not a proficiency claim</h4>{cvReview.skills.length ? cvReview.skills.map((candidate, index) => <label className="cv-candidate" key={`${candidate.original_text}-${index}`}><input type="checkbox" checked={cvSelectedSkills.includes(index)} onChange={(e) => setCvSelectedSkills((current) => e.target.checked ? [...current, index] : current.filter((item) => item !== index))} /><span><strong>{candidate.resolution === "exact_local_alias_match" ? candidate.canonical_name : "Needs your review"}</strong><input aria-label={`Review source text for skill candidate ${index + 1}`} value={candidate.original_text} readOnly={candidate.resolution === "exact_local_alias_match"} onChange={(e) => setCvReview({ ...cvReview, skills: cvReview.skills.map((item, itemIndex) => itemIndex === index ? { ...item, original_text: e.target.value } : item) })} /><small>{candidate.resolution === "exact_local_alias_match" ? `Exact local-alias match · ${candidate.skill_id}` : "Unmatched candidate · selected entries become custom profile skills"}</small><select aria-label={`Choose proficiency for extracted skill ${index + 1}`} value={cvSkillLevels[index] ?? ""} onChange={(e) => setCvSkillLevels((current) => ({ ...current, [index]: e.target.value as Proficiency | "" }))}><option value="">Choose proficiency if adding</option>{proficiencyOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></span></label>) : <p className="field-hint">No skill candidates were extracted.</p>}</div>
              {cvSelectedSkills.some((index) => !cvSkillLevels[index]) && <p className="field-hint" role="status">Select a proficiency for each checked skill. The extraction does not estimate proficiency.</p>}
              <button className="button" type="button" onClick={applyCVReview}>Apply reviewed details to profile draft</button>
            </div>}
          </section>

          <section className="form-section">
            <div className="section-heading"><span className="section-no">06</span><div><h2>What gives your work shape</h2><p>Comma-separated lists work well here. Keep each entry short and fictional.</p></div></div>
            <div className="field-grid">
              <FormField label="Interests" error={errors.interests}><input value={listInputs.interests} onChange={setList("interests")} placeholder="e.g. sustainable cities, design" data-testid="input-interests" /></FormField>
              <FormField label="Work activities" error={errors.work_activities}><input value={listInputs.work_activities} onChange={setList("work_activities")} placeholder="e.g. coordinating events, testing" data-testid="input-work-activities" /></FormField>
              <FormField label="Transferable strengths" error={errors.transferable_strengths}><input value={listInputs.transferable_strengths} onChange={setList("transferable_strengths")} placeholder="e.g. clear communication, patience" data-testid="input-strengths" /></FormField>
              <FormField label="Skills to develop" error={errors.skills_to_develop}><input value={listInputs.skills_to_develop} onChange={setList("skills_to_develop")} placeholder="e.g. data visualisation, facilitation" data-testid="input-skills-to-develop" /></FormField>
              <FormField label="Career aspiration" error={errors.career_aspirations} full><textarea value={draft.career_aspirations} onChange={(e) => setDraft({ ...draft, career_aspirations: e.target.value })} placeholder="Describe a kind of work you would like to move toward." data-testid="input-aspiration" /></FormField>
            </div>
          </section>

          <section className="form-section">
            <div className="section-heading"><span className="section-no">07</span><div><h2>Make learning realistic</h2><p>Set a pace and format that could fit your week.</p></div></div>
            <div className="field-grid">
              <FormField label="Hours per week" error={errors.weekly_hours}><input type="number" min="0" max="168" step="1" value={draft.learning_preferences.weekly_hours ?? ""} onChange={(e) => setDraft({ ...draft, learning_preferences: { ...draft.learning_preferences, weekly_hours: e.target.value === "" ? null : Number(e.target.value) } })} placeholder="Not sure yet" data-testid="input-weekly-hours" /></FormField>
              <FormField label="Learning budget (MYR)" error={errors.budget_myr}><input type="number" min="0" max="100000" step="10" value={draft.learning_preferences.budget_myr ?? ""} onChange={(e) => setDraft({ ...draft, learning_preferences: { ...draft.learning_preferences, budget_myr: e.target.value === "" ? null : Number(e.target.value) } })} placeholder="Not sure yet" data-testid="input-budget-myr" /></FormField>
              <FormField label="Preferred learning mode"><select value={draft.learning_preferences.mode ?? ""} onChange={(e) => setDraft({ ...draft, learning_preferences: { ...draft.learning_preferences, mode: e.target.value ? e.target.value as LearningMode : null } })} data-testid="select-learning-mode"><option value="">Choose later</option>{learningModes.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></FormField>
            </div>
          </section>
          <div className="save-bar">
            <label className="confirm-row"><input type="checkbox" checked={confirmed} onChange={(e) => { setConfirmed(e.target.checked); setErrors((current) => ({ ...current, synthetic_demo: "" })); }} data-testid="checkbox-fictional-confirmation" /><span>I confirm this profile contains fictional demonstration data only, with no real CV or personal information.</span></label>
            <button className="button" type="submit" disabled={saveLoading || pageLoading || Boolean(pendingProfileId)} data-testid="button-save-profile">{saveLoading ? "Saving profile…" : profileId ? "Update profile" : "Save profile"} <span aria-hidden="true">→</span></button>
          </div>
          {errors.synthetic_demo && <div className="message error" role="alert" data-testid="error-fictional-confirmation">{errors.synthetic_demo}</div>}
          {message && !pendingProfileId && <div className={`message ${messageKind}`} role={messageKind === "error" ? "alert" : "status"} data-testid={`status-profile-${messageKind}`}>{message}</div>}
        </form>

        <aside className="panel side-panel" aria-label="Profile workspace guide">
          <h2>A useful profile, not a CV</h2>
          <div className="steps">
            <div className="step"><span className="step-num">A</span><div><strong>Start with a sample</strong><p>Choose a fictional profile to explore the form without entering personal details.</p></div></div>
            <div className="step"><span className="step-num">B</span><div><strong>Name the transferable</strong><p>Activities and strengths matter alongside formal qualifications.</p></div></div>
            <div className="step"><span className="step-num">C</span><div><strong>Save when it feels right</strong><p>Your saved record can be reopened on this device using its profile ID.</p></div></div>
          </div>
          <div className="side-rule" />
            {pageLoading ? <div className="skeleton" style={{ height: 58 }} aria-label="Loading saved profile" data-testid="loading-saved-profile" /> : savedProfile ? <><span className="saved-badge" data-testid="status-saved-profile">SAVED · {savedProfile.id.slice(0, 12)}</span><p className="field-hint" style={{ marginTop: 10 }}>Last updated {new Date(savedProfile.updated_at).toLocaleString()}</p></> : pendingProfileId ? <p className="field-hint">Saved profile reference retained · waiting for a successful retry.</p> : <><span className="field-hint" data-testid="status-no-saved-profile">No saved profile on this device yet.</span><div className="side-rule" /><p className="field-hint">Use fictional demonstration details only. Only fictional files may be reviewed; original files are not saved by this workspace.</p></>}
        </aside>
      </div>
    </main>
  );
}

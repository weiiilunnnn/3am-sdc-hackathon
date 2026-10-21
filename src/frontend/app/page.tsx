"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  createProfile, getProfile, getSampleProfiles, getSkills, updateProfile,
  type EducationLevel, type LearningMode, type ProfileDraft, type ProfileStatus,
  type Proficiency, type SampleProfile, type SkillInput, type SkillOption, type StoredProfile,
} from "../lib/api";
import { splitCommaList, validateProfileDraft } from "../lib/profile-validation";

const PROFILE_KEY = "aiversecity.synthetic-profile-id";
const statusOptions: [ProfileStatus, string][] = [["student", "Student"], ["fresh_graduate", "Fresh graduate"], ["employed", "Employed"], ["career_switcher", "Career switcher"], ["other", "Other"]];
const educationOptions: [EducationLevel, string][] = [["secondary", "Secondary"], ["certificate", "Certificate"], ["diploma", "Diploma"], ["bachelor", "Bachelor’s degree"], ["postgraduate", "Postgraduate"], ["other", "Other"]];
const proficiencyOptions: [Proficiency, string][] = [["beginner", "Beginner"], ["intermediate", "Intermediate"], ["advanced", "Advanced"]];
const learningModes: [LearningMode, string][] = [["self_paced", "Self-paced"], ["instructor_led", "Instructor-led"], ["peer_learning", "Peer learning"], ["mixed", "A mix of formats"]];

const emptyDraft: ProfileDraft = {
  status: "student", education_level: "bachelor", field_of_study: "", current_occupation: "",
  years_experience: 0, skills: [], interests: [], work_activities: [], transferable_strengths: [],
  career_aspirations: "", skills_to_develop: [],
  learning_preferences: { weekly_hours: null, budget_myr: null, mode: null }, synthetic_demo: true,
};

function draftFromProfile(profile: StoredProfile | SampleProfile): ProfileDraft {
  return {
    status: profile.status, education_level: profile.education_level, field_of_study: profile.field_of_study,
    current_occupation: profile.current_occupation, years_experience: profile.years_experience,
    skills: profile.skills.map((skill) => "display_name" in skill
      ? { name: skill.display_name, skill_id: skill.skill_id, proficiency: skill.proficiency, force_custom: skill.is_custom }
      : { name: skill.name, skill_id: skill.skill_id, proficiency: skill.proficiency, force_custom: skill.force_custom }),
    interests: [...profile.interests], work_activities: [...profile.work_activities],
    transferable_strengths: [...profile.transferable_strengths], career_aspirations: profile.career_aspirations,
    skills_to_develop: [...profile.skills_to_develop],
    learning_preferences: { ...profile.learning_preferences }, synthetic_demo: true,
  };
}

function listValue(event: ChangeEvent<HTMLInputElement>, key: "interests" | "work_activities" | "transferable_strengths" | "skills_to_develop", setDraft: (updater: (current: ProfileDraft) => ProfileDraft) => void) {
  const values = splitCommaList(event.target.value);
  setDraft((current) => ({ ...current, [key]: values }));
}

function FormField({ label, hint, error, children, full = false }: { label: string; hint?: string; error?: string; children: React.ReactNode; full?: boolean }) {
  return <div className={`field${full ? " full" : ""}`}><label>{label}<span className="field-control">{children}</span></label>{hint && <span className="field-hint">{hint}</span>}{error && <span className="field-hint" role="alert" style={{ color: "var(--danger)" }}>{error}</span>}</div>;
}

export default function Home() {
  const [draft, setDraft] = useState<ProfileDraft>(emptyDraft);
  const [samples, setSamples] = useState<SampleProfile[]>([]);
  const [sampleError, setSampleError] = useState("");
  const [sampleLoading, setSampleLoading] = useState(true);
  const [profileId, setProfileId] = useState("");
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

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = await getSampleProfiles();
        if (active) setSamples(result.profiles);
      } catch {
        if (active) setSampleError("Fictional sample profiles could not be loaded. You can still create a profile from scratch.");
      } finally {
        if (active) setSampleLoading(false);
      }
      try {
        const id = localStorage.getItem(PROFILE_KEY);
        if (id) {
          const profile = await getProfile(id);
          if (active) {
            setProfileId(profile.id);
            setSavedProfile(profile);
            setDraft(draftFromProfile(profile));
            setMessage("Your saved fictional profile has been reloaded.");
            setMessageKind("success");
          }
        }
      } catch {
        if (active) {
          localStorage.removeItem(PROFILE_KEY);
          setMessage("The saved profile could not be retrieved. Start a new fictional profile or try again later.");
          setMessageKind("error");
        }
      } finally {
        if (active) setPageLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

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
    setDraft((current) => ({ ...current, skills: [...current.skills, { name: clean, skill_id: id, proficiency: "beginner", force_custom: forceCustom }] }));
    setSkillQuery("");
    setSkillMenu(false);
    setErrors((current) => ({ ...current, skills: "" }));
  }

  function loadSample(sample: SampleProfile) {
    setDraft(draftFromProfile(sample));
    setSavedProfile(null);
    setProfileId("");
    setConfirmed(false);
    setErrors({});
    setMessage(`${sample.label} loaded. Review the fictional details, then save when ready.`);
    setMessageKind("info");
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateProfileDraft(draft);
    const nextErrors = { ...result.errors };
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
      localStorage.setItem(PROFILE_KEY, stored.id);
      setProfileId(stored.id);
      setSavedProfile(stored);
      setDraft(draftFromProfile(stored));
      setMessage(profileId ? "Your fictional profile has been updated." : "Your fictional profile is saved on this device and ready to revisit.");
      setMessageKind("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The profile could not be saved. Please try again.");
      setMessageKind("error");
    } finally {
      setSaveLoading(false);
    }
  }

  const setList = (key: "interests" | "work_activities" | "transferable_strengths" | "skills_to_develop") =>
    (event: ChangeEvent<HTMLInputElement>) => listValue(event, key, setDraft);

  return (
    <main className="page-wrap">
      <div className="page-kicker"><span className="kicker-dot" /> FEATURE 01 <span>·</span> SKILLS PROFILE INTAKE</div>
      <div className="hero-row">
        <div><h1>Start with what<br />you already bring.</h1><p className="hero-copy">A clear, practical picture of your skills and next learning steps — no CV required. This workspace is built for fictional examples only.</p></div>
        <span className="hero-index">MALAYSIA · LEARNER WORKSPACE / 01</span>
      </div>
      <div className="notice" role="note" data-testid="notice-fictional-only">
        <span className="notice-icon" aria-hidden="true">!</span>
        <div><strong>Fictional demo profiles only</strong>Do not enter a real CV, your name, contact details, or any other personal information. There are no uploads or accounts here. Use one of the fictional samples or make up a profile.</div>
      </div>

      <div className="profile-grid">
        <form className="panel form-panel" onSubmit={saveProfile} noValidate data-testid="form-profile">
          <section className="form-section">
            <div className="section-heading"><span className="section-no">01</span><div><h2>Try a fictional starting point</h2><p>Loading a sample fills this form only; it will not save until you choose Save.</p></div></div>
            {sampleError && <div className="message error" role="alert" data-testid="error-samples">{sampleError}</div>}
            <div className="sample-row">
              {samples.slice(0, 5).map((sample) => <button type="button" className="button secondary small" key={sample.sample_id} onClick={() => loadSample(sample)} data-testid={`button-sample-${sample.sample_id}`}>{sample.label} <span aria-hidden="true">↗</span></button>)}
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
            </div>
          </section>

          <section className="form-section">
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
                  <div><span className="skill-name">{skill.name}</span><span className="skill-source">{taxonomy}{skill.skill_id ? ` · ${skill.skill_id}` : " · Custom entry"}</span></div>
                  <select aria-label={`Proficiency for ${skill.name}`} value={skill.proficiency} onChange={(e) => setDraft((current) => ({ ...current, skills: current.skills.map((item, idx) => idx === index ? { ...item, proficiency: e.target.value as Proficiency } : item) }))} data-testid={`select-proficiency-${index}`}>{proficiencyOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                  <button type="button" className="icon-button" aria-label={`Remove ${skill.name}`} onClick={() => setDraft((current) => ({ ...current, skills: current.skills.filter((_, idx) => idx !== index) }))} data-testid={`button-remove-skill-${index}`}>×</button>
                </div>;
              })}
            </div>}
          </section>

          <section className="form-section">
            <div className="section-heading"><span className="section-no">04</span><div><h2>What gives your work shape</h2><p>Comma-separated lists work well here. Keep each entry short and fictional.</p></div></div>
            <div className="field-grid">
              <FormField label="Interests" error={errors.interests}><input value={draft.interests.join(", ")} onChange={setList("interests")} placeholder="e.g. sustainable cities, design" data-testid="input-interests" /></FormField>
              <FormField label="Work activities" error={errors.work_activities}><input value={draft.work_activities.join(", ")} onChange={setList("work_activities")} placeholder="e.g. coordinating events, testing" data-testid="input-work-activities" /></FormField>
              <FormField label="Transferable strengths" error={errors.transferable_strengths}><input value={draft.transferable_strengths.join(", ")} onChange={setList("transferable_strengths")} placeholder="e.g. clear communication, patience" data-testid="input-strengths" /></FormField>
              <FormField label="Skills to develop" error={errors.skills_to_develop}><input value={draft.skills_to_develop.join(", ")} onChange={setList("skills_to_develop")} placeholder="e.g. data visualisation, facilitation" data-testid="input-skills-to-develop" /></FormField>
              <FormField label="Career aspiration" error={errors.career_aspirations} full><textarea value={draft.career_aspirations} onChange={(e) => setDraft({ ...draft, career_aspirations: e.target.value })} placeholder="Describe a kind of work you would like to move toward." data-testid="input-aspiration" /></FormField>
            </div>
          </section>

          <section className="form-section">
            <div className="section-heading"><span className="section-no">05</span><div><h2>Make learning realistic</h2><p>Set a pace and format that could fit your week.</p></div></div>
            <div className="field-grid">
              <FormField label="Hours per week" error={errors.weekly_hours}><input type="number" min="0" max="168" step="1" value={draft.learning_preferences.weekly_hours ?? ""} onChange={(e) => setDraft({ ...draft, learning_preferences: { ...draft.learning_preferences, weekly_hours: e.target.value === "" ? null : Number(e.target.value) } })} placeholder="Not sure yet" data-testid="input-weekly-hours" /></FormField>
              <FormField label="Learning budget (MYR)" error={errors.budget_myr}><input type="number" min="0" max="100000" step="10" value={draft.learning_preferences.budget_myr ?? ""} onChange={(e) => setDraft({ ...draft, learning_preferences: { ...draft.learning_preferences, budget_myr: e.target.value === "" ? null : Number(e.target.value) } })} placeholder="Not sure yet" data-testid="input-budget-myr" /></FormField>
              <FormField label="Preferred learning mode"><select value={draft.learning_preferences.mode ?? ""} onChange={(e) => setDraft({ ...draft, learning_preferences: { ...draft.learning_preferences, mode: e.target.value ? e.target.value as LearningMode : null } })} data-testid="select-learning-mode"><option value="">Choose later</option>{learningModes.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></FormField>
            </div>
          </section>
          <div className="save-bar">
            <label className="confirm-row"><input type="checkbox" checked={confirmed} onChange={(e) => { setConfirmed(e.target.checked); setErrors((current) => ({ ...current, synthetic_demo: "" })); }} data-testid="checkbox-fictional-confirmation" /><span>I confirm this profile contains fictional demonstration data only, with no real CV or personal information.</span></label>
            <button className="button" type="submit" disabled={saveLoading || pageLoading} data-testid="button-save-profile">{saveLoading ? "Saving profile…" : profileId ? "Update profile" : "Save profile"} <span aria-hidden="true">→</span></button>
          </div>
          {errors.synthetic_demo && <div className="message error" role="alert" data-testid="error-fictional-confirmation">{errors.synthetic_demo}</div>}
          {message && <div className={`message ${messageKind}`} role={messageKind === "error" ? "alert" : "status"} data-testid={`status-profile-${messageKind}`}>{message}</div>}
        </form>

        <aside className="panel side-panel" aria-label="Profile workspace guide">
          <h2>A useful profile, not a CV</h2>
          <div className="steps">
            <div className="step"><span className="step-num">A</span><div><strong>Start with a sample</strong><p>Choose a fictional profile to explore the form without entering personal details.</p></div></div>
            <div className="step"><span className="step-num">B</span><div><strong>Name the transferable</strong><p>Activities and strengths matter alongside formal qualifications.</p></div></div>
            <div className="step"><span className="step-num">C</span><div><strong>Save when it feels right</strong><p>Your saved record can be reopened on this device using its profile ID.</p></div></div>
          </div>
          <div className="side-rule" />
          {pageLoading ? <div className="skeleton" style={{ height: 58 }} aria-label="Loading saved profile" data-testid="loading-saved-profile" /> : savedProfile ? <><span className="saved-badge" data-testid="status-saved-profile">SAVED · {savedProfile.id.slice(0, 12)}</span><p className="field-hint" style={{ marginTop: 10 }}>Last updated {new Date(savedProfile.updated_at).toLocaleString()}</p></> : <><span className="field-hint" data-testid="status-no-saved-profile">No saved profile on this device yet.</span><div className="side-rule" /><p className="field-hint">The intake and samples are synthetic-only. No real CVs, names, contact details, or uploads belong here.</p></>}
        </aside>
      </div>
    </main>
  );
}

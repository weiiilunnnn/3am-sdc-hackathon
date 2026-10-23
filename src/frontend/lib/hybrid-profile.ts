/** Local-device profile continuity, not authenticated account ownership. */
import { createProfile, getProfile, getSkills, updateProfile, type ProfileDraft, type ProfileItem, type SkillOption, type StoredProfile } from "./api";
import { PATHWAAY_PROFILE_HANDOFF_KEY, readPathwaayRegistrationProfile, type PathwaayRegistrationProfile } from "./pathwaay-profile";
import { PROFILE_KEY, profileToDraft } from "../app/(workspace)/profile-workspace";
import { request } from "./future-role-api";
import type { Profile } from "./contracts";
import { setCurrentFutureRoleProfile } from "./future-role-session";
import { validateProfileDraft } from "./profile-validation";

const CREATION_KEY = "pathwaay.pending-profile-creation";
const REVISION_KEY = "pathwaay.profile-revision";
let saving: Promise<PathwaayRegistrationProfile> | null = null;
const key = (s: string) => s.trim().toLocaleLowerCase().replace(/\s+/g, " ");
const list = (s: string) => [...new Set(s.split(/[,;\n]/).map(v => v.trim()).filter(Boolean))];
const number = (s: string) => {
  if (!s.trim()) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) throw new Error("Learning hours and budget must be non-negative numbers, or blank.");
  return n;
};

export function registrationToDraft(main: PathwaayRegistrationProfile, saved?: StoredProfile, vocabulary: SkillOption[] = []): ProfileDraft {
  const previous = saved?.registration_profile;
  const base: ProfileDraft = saved ? profileToDraft(saved) : {
    status: "unknown", education_level: "other", field_of_study: main.major,
    professional_summary: "", current_occupation: null, years_experience: null,
    skills: [], interests: [], work_activities: [], transferable_strengths: [], career_aspirations: "", skills_to_develop: [],
    education: [], experience: [], projects: [], certifications: [], achievements: [],
    learning_preferences: {weekly_hours: null, budget_myr: null, mode: null}, synthetic_demo: false,
  };
  // Only local vocabulary identity is reused here; ESCO recognition stays on the server.
  const identity = (name: string) => vocabulary.find(s => [s.name, ...s.aliases].some(n => key(n) === key(name)))?.id ?? `name:${key(name)}`;
  const owns = new Set((previous?.skills ?? []).map(identity));
  const requested = new Set(main.skills.map(identity));
  const skills = base.skills.filter(s => !owns.has(s.skill_id ?? identity(s.name)) || requested.has(s.skill_id ?? identity(s.name)));
  for (const name of main.skills) {
    const id = identity(name);
    const existing = skills.find(s => (s.skill_id ?? identity(s.name)) === id);
    if (!existing) skills.push({name, skill_id: id.startsWith("local:") ? id : null, proficiency: "unknown", evidence_record_ids: []});
  }
  // Include retained backend skills in Main's view rather than hiding them.
  const snapshot = {...main, skills: [...main.skills]};
  for (const skill of skills) if (!snapshot.skills.some(n => identity(n) === (skill.skill_id ?? identity(skill.name)))) snapshot.skills.push(skill.name);
  const records = (old: ProfileItem[], prefix: string, incoming: ProfileItem[]) => [...old.filter(r => !r.id.startsWith(prefix)), ...incoming.map(r => ({...r, skill_ids: old.find(o => o.id === r.id)?.skill_ids ?? r.skill_ids}))];
  const narrative = (section: "projects" | "certifications" | "achievements", value: string) => {
    if (!previous && !value.trim()) return base[section];
    return records(base[section], `main:${section}`, value.trim() ? [{id: `main:${section}`, title: "", organization: null, period: null, description: value, skill_ids: []}] : []);
  };
  const educationMap: Record<string, ProfileDraft["education_level"]> = {
    "secondary": "secondary", "postgraduate": "postgraduate", "secondary school": "secondary", "certificate": "certificate", "diploma": "diploma",
    "bachelor’s degree": "bachelor", "bachelor's degree": "bachelor", "master’s degree": "postgraduate", "phd / doctorate": "postgraduate",
  };
  const modeMap: Record<string, NonNullable<ProfileDraft["learning_preferences"]["mode"]>> = {"Self-paced": "self_paced", "Instructor-led": "instructor_led", "Peer learning": "peer_learning", "A mix of formats": "mixed"};
  const text = (value: string, old: string) => previous || value.trim() ? value : old;
  const values = (value: string, old: string[]) => previous || value.trim() ? list(value) : old;
  return {...base, synthetic_demo: false, registration_profile: snapshot, skills,
    field_of_study: main.major, education_level: educationMap[key(main.educationLevel)] ?? "other",
    professional_summary: text(main.profileSummary, base.professional_summary),
    career_aspirations: text(main.aspiration, base.career_aspirations),
    interests: values(main.interests, base.interests), work_activities: values(main.workActivities, base.work_activities),
    transferable_strengths: values(main.strengths, base.transferable_strengths), skills_to_develop: values(main.skillsToDevelop, base.skills_to_develop),
    learning_preferences: {
      weekly_hours: !previous && !main.weeklyHours.trim() ? base.learning_preferences.weekly_hours : number(main.weeklyHours),
      budget_myr: !previous && !main.learningBudget.trim() ? base.learning_preferences.budget_myr : number(main.learningBudget),
      mode: !previous && !main.learningMode ? base.learning_preferences.mode : modeMap[main.learningMode] ?? null,
    },
    education: records(base.education, "main:education", [{id: "main:education", title: main.educationLevel, organization: main.university || null, period: null, description: main.educationRecord, skill_ids: []}]),
    experience: records(base.experience, "main:experience:", main.experiences.filter(e => [e.title,e.company,e.timeframe,e.description].some(s => s.trim())).map(e => {
      const id = `main:experience:${e.id}`;
      return {id, title: e.title, organization: e.company || null, period: e.timeframe || null, description: e.description, skill_ids: base.experience.find(r => r.id === id)?.skill_ids ?? []};
    })),
    projects: narrative("projects", main.projects), certifications: narrative("certifications", main.certifications), achievements: narrative("achievements", main.achievements),
  };
}

function remember(profile: StoredProfile) {
  window.localStorage.setItem(PROFILE_KEY, profile.id);
  window.sessionStorage.setItem(REVISION_KEY, JSON.stringify({id: profile.id, revision: profile.updated_at}));
  if (profile.registration_profile) window.sessionStorage.setItem(PATHWAAY_PROFILE_HANDOFF_KEY, JSON.stringify(profile.registration_profile));
}

export async function restoreHybridProfile(): Promise<PathwaayRegistrationProfile | null> {
  const current = readPathwaayRegistrationProfile();
  const id = window.localStorage.getItem(PROFILE_KEY);
  if (!id) return current;
  const saved = await getProfile(id); // Never create a replacement after a failed lookup.
  const revision = window.sessionStorage.getItem(REVISION_KEY);
  const version = revision ? JSON.parse(revision) as {id: string; revision: string} : null;
  if (saved.registration_profile && (!current || !version || version.id !== id || version.revision !== saved.updated_at)) {
    remember(saved);
    return saved.registration_profile;
  }
  if (!revision) window.sessionStorage.setItem(REVISION_KEY, JSON.stringify({id, revision: saved.updated_at}));
  return current;
}

export function saveHybridProfile(main: PathwaayRegistrationProfile): Promise<PathwaayRegistrationProfile> {
  if (saving) return Promise.reject(new Error("A profile save is already in progress. Please wait."));
  saving = persist(main).finally(() => { saving = null; });
  return saving;
}

async function persist(main: PathwaayRegistrationProfile): Promise<PathwaayRegistrationProfile> {
  // Preserve Main's draft even when the backend is unavailable.
  window.sessionStorage.setItem(PATHWAAY_PROFILE_HANDOFF_KEY, JSON.stringify(main));
  let id = window.localStorage.getItem(PROFILE_KEY);
  let pending = window.localStorage.getItem(CREATION_KEY);
  let saved = id ? await getProfile(id) : undefined;
  const vocabulary = (await getSkills()).skills;
  if (!saved && pending) {
    // Recover the original request after a lost response before applying edits.
    const operation = JSON.parse(pending) as {key: string; draft: ProfileDraft};
    saved = await createProfile(operation.draft, operation.key);
    remember(saved); id = saved.id;
    window.localStorage.removeItem(CREATION_KEY);
  }
  const remembered = window.sessionStorage.getItem(REVISION_KEY);
  if (saved && remembered) {
    const version = JSON.parse(remembered) as {id: string; revision: string};
    if (version.id === saved.id && version.revision !== saved.updated_at) throw new Error("Profile changed elsewhere. Reload this page before saving again.");
  }
  const draft = registrationToDraft(main, saved, vocabulary);
  const validation = validateProfileDraft(draft);
  if (!validation.valid) throw new Error(Object.values(validation.errors).join(" "));
  let result: StoredProfile;
  if (saved) result = await updateProfile(saved.id, draft, saved.updated_at);
  else {
    const operation = {key: crypto.randomUUID(), draft};
    pending = JSON.stringify(operation);
    // Do not POST unless its retry identity has been durably remembered first.
    window.localStorage.setItem(CREATION_KEY, pending);
    result = await createProfile(draft, operation.key);
  }
  remember(result);
  window.localStorage.removeItem(CREATION_KEY);
  // Saving is complete even if the optional matching-profile refresh fails.
  setCurrentFutureRoleProfile(null);
  try { setCurrentFutureRoleProfile(await request<Profile>(`/api/v2/profiles/${encodeURIComponent(result.id)}`)); } catch { /* Reloaded by matching on entry. */ }
  window.dispatchEvent(new Event("pathwaay-backend-profile-updated"));
  return result.registration_profile ?? main;
}

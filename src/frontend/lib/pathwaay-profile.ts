export const PATHWAAY_PROFILE_HANDOFF_KEY = "pathwaay.registration-profile";

export type PathwaayExperience = {
  id: string;
  title: string;
  timeframe: string;
  company: string;
  description: string;
};

export type PathwaayRegistrationProfile = {
  firstName: string;
  lastName: string;
  educationLevel: string;
  university: string;
  major: string;
  cgpa: string;
  schoolAwards: string;
  experiences: PathwaayExperience[];
  skills: string[];
  educationRecord: string;
  volunteering: string;
  projects: string;
  certifications: string;
  achievements: string;
  interests: string;
  workActivities: string;
  strengths: string;
  skillsToDevelop: string;
  aspiration: string;
  profileSummary: string;
  weeklyHours: string;
  learningBudget: string;
  learningMode: string;
  photoDataUrl?: string;
};

export function readPathwaayRegistrationProfile(): PathwaayRegistrationProfile | null {
  try {
    const raw = window.sessionStorage.getItem(PATHWAAY_PROFILE_HANDOFF_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const profile = value as Partial<PathwaayRegistrationProfile>;
    if (typeof profile.firstName !== "string" || typeof profile.major !== "string" || !Array.isArray(profile.skills)) return null;
    const text = (field: unknown) => typeof field === "string" ? field : "";
    const experiences = Array.isArray(profile.experiences) ? profile.experiences.filter((entry) => entry && typeof entry.id === "string") : [];
    return {
      firstName: text(profile.firstName), lastName: text(profile.lastName), educationLevel: text(profile.educationLevel),
      university: text(profile.university), major: text(profile.major), cgpa: text(profile.cgpa), schoolAwards: text(profile.schoolAwards),
      experiences: experiences.map((entry) => ({ id: text(entry.id), title: text(entry.title), timeframe: text(entry.timeframe), company: text(entry.company), description: text(entry.description) })),
      skills: profile.skills.filter((skill): skill is string => typeof skill === "string"),
      educationRecord: text(profile.educationRecord), volunteering: text(profile.volunteering), projects: text(profile.projects),
      certifications: text(profile.certifications), achievements: text(profile.achievements), interests: text(profile.interests),
      workActivities: text(profile.workActivities), strengths: text(profile.strengths), skillsToDevelop: text(profile.skillsToDevelop),
      aspiration: text(profile.aspiration), profileSummary: text(profile.profileSummary), weeklyHours: text(profile.weeklyHours),
      learningBudget: text(profile.learningBudget), learningMode: text(profile.learningMode),
      photoDataUrl: typeof profile.photoDataUrl === "string" && profile.photoDataUrl.startsWith("data:image/jpeg;base64,") && profile.photoDataUrl.length <= 600_000 ? profile.photoDataUrl : undefined,
    };
  } catch {
    return null;
  }
}

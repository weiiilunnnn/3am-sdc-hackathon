export type ProfileStatus =
  | "student"
  | "fresh_graduate"
  | "employed"
  | "career_switcher"
  | "other";
export type EducationLevel =
  | "secondary"
  | "certificate"
  | "diploma"
  | "bachelor"
  | "postgraduate"
  | "other";
export type Proficiency = "beginner" | "intermediate" | "advanced";
export type LearningMode = "self_paced" | "instructor_led" | "peer_learning" | "mixed";

export type SkillInput = {
  name: string;
  skill_id: string | null;
  proficiency: Proficiency;
  force_custom?: boolean;
  evidence_record_ids: string[];
};

export type ProfileItem = {
  id: string;
  title: string;
  organization: string | null;
  period: string | null;
  description: string;
  skill_ids: string[];
};

export type ProfileDraft = {
  status: ProfileStatus;
  education_level: EducationLevel;
  field_of_study: string;
  professional_summary: string;
  current_occupation: string | null;
  years_experience: number;
  skills: SkillInput[];
  interests: string[];
  work_activities: string[];
  transferable_strengths: string[];
  career_aspirations: string;
  skills_to_develop: string[];
  education: ProfileItem[];
  experience: ProfileItem[];
  projects: ProfileItem[];
  certifications: ProfileItem[];
  achievements: ProfileItem[];
  learning_preferences: {
    weekly_hours: number | null;
    budget_myr: number | null;
    mode: LearningMode | null;
  };
  synthetic_demo: true;
};

export type NormalizedSkill = {
  skill_id: string | null;
  display_name: string;
  input_names: string[];
  proficiency: Proficiency;
  taxonomy_source: "Local prototype vocabulary" | "Custom";
  is_custom: boolean;
  evidence_record_ids: string[];
};

export type StoredProfile = Omit<ProfileDraft, "skills"> & {
  id: string;
  created_at: string;
  updated_at: string;
  skills: NormalizedSkill[];
};

export type SampleProfile = ProfileDraft & {
  sample_id: string;
  label: string;
};

export type SkillOption = {
  id: string;
  name: string;
  aliases: string[];
  taxonomy_source: string;
  esco_uri: string | null;
  source_version: string | null;
  source_url: string | null;
};

export type SkillsResponse = {
  taxonomy: {
    name: string;
    version: string;
    reviewed_on: string;
    classification_url: string;
    api_url: string;
    reuse_url: string;
    status_note: string;
  };
  skills: SkillOption[];
};

export type TrendObservation = {
  period_year: number;
  value: number;
  period_label: string;
  source_url: string | null;
  retrieved_at: string;
  data_mode: "real" | "synthetic";
};

export type TrendChange = {
  status: "available" | "insufficient_data";
  absolute_change: number | null;
  percentage_change: number | null;
  compared_years: number[] | null;
  explanation: string;
};

export type TrendTopic = {
  topic_id: string;
  label: string;
  definition: string;
  measurement: string;
  limitations: string;
  source_name: string;
  source_url: string | null;
  observations: TrendObservation[];
  change: TrendChange;
  status: "available" | "insufficient_data";
};

export type TrendDashboard = {
  mode: "real" | "synthetic";
  topics: TrendTopic[];
  last_successful_refresh: string | null;
  last_attempt_at: string | null;
  refresh_status: "never" | "refreshing" | "success" | "failed" | "cooldown" | "demo";
  cooldown_seconds: number;
  cache_fallback: boolean;
  error_message: string | null;
  notice: string;
};

export type ProfileRelevance = {
  profile_id: string;
  skills: {
    skill_id: string | null;
    skill_name: string;
    status: "matched" | "no_available_signal";
    explanation: string;
    topics: {
      topic_id: string;
      label: string;
      explanation: string;
      signal_available: boolean;
      latest_period_year: number | null;
    }[];
  }[];
  notice: string;
};

export type TrendHistory = {
  history: {
    topic_id: string;
    label: string;
    observations: TrendObservation[];
  }[];
};

export type RadarBrief = {
  profile_id: string | null;
  profile_context: { current_occupation: string | null; career_aspirations: string; skills_to_develop: string[]; synthetic_demo: boolean } | null;
  cards: {
    topic_id: string; label: string; definition: string;
    direction: "more_research_records" | "fewer_research_records" | "unchanged_research_records" | "insufficient_data";
    research_count: number | null; research_year: number | null;
    previous_count: number | null; previous_year: number | null;
    research_change_percent: number | null; research_source_url: string | null;
    research_retrieved_at: string | null; posting_mentions: number;
    posting_denominator: number; posting_source_url: string; posting_retrieved_at: string | null;
    matched_profile_skills: string[]; development_profile_skills: string[]; practice: string;
  }[];
  research_refreshed_at: string | null; posting_refreshed_at: string | null; method: string;
};

export type MalaysiaContext = {
  status: "empty" | "available";
  retrieved_at: string | null;
  data: null | {
    source_name: string; source_url: string; source_page: string; scope: string;
    latest_period: string; comparison_period: string;
    latest_total: number; comparison_total: number; limitation: string;
    groups: {
      name: string; current_count: number; previous_count: number | null;
      current_share_percent: number; previous_share_percent: number | null;
      share_point_change: number | null;
      direction: "higher_share" | "lower_share" | "unchanged_share" | "not_comparable";
    }[];
  };
};

export type EmploymentJob = {
  source_job_id: string;
  title: string;
  company: string;
  location: string | null;
  source_url: string;
  source_date: string;
  published_at: string;
  retrieved_at: string;
  tags: string[];
  skill_mentions: { skill_id: string; label: string; terms: string[]; fields: string[] }[];
  topic_ids: string[];
};

export type EmploymentDashboard = {
  mode: "real";
  source: {
    id: string; name: string; url: string; website_url: string; documentation_url: string;
    terms_url: string; terms_reviewed_on: string; permitted_use: string; coverage: string;
    measurement: string; limitations: string; refresh_policy: string; sample_limit: number;
  };
  jobs: EmploymentJob[];
  skill_counts: { skill_id: string; label: string; posting_count: number; share_percent: number }[];
  topic_counts: Record<string, number>;
  posting_count: number;
  employer_count: number;
  location_labels: string[];
  unknown_location_count: number;
  published_from: string | null;
  published_to: string | null;
  source_feed_updated_at: string | null;
  received_records: number;
  excluded_records: number;
  last_successful_refresh: string | null;
  last_attempt_at: string | null;
  refresh_status: "never" | "refreshing" | "success" | "failed" | "cooldown";
  cooldown_seconds: number;
  cache_fallback: boolean;
  error_message: string | null;
};

export type ProfileIndicator = {
  id: string;
  label: string;
  status: "available" | "not_enough_information";
  value_percent: number | null;
  numerator: number | null;
  denominator: number | null;
  interpretation: string;
  limitation: string;
};

export type ProfileInsights = {
  profile_id: string;
  indicators: ProfileIndicator[];
  suggestions: string[];
  notice: string;
};

export type CVExtraction = {
  synthetic_demo: true;
  filename: string;
  summary: string | null;
  sections: Record<"experience" | "education" | "projects" | "certifications" | "achievements" | "skills", string[]>;
  skills: {
    original_text: string;
    canonical_name: string | null;
    skill_id: string | null;
    resolution: "exact_local_alias_match" | "unmatched_user_review_required";
  }[];
  warnings: string[];
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    headers,
  });

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const detail =
      body && typeof body === "object" && "detail" in body
        ? (body as { detail?: unknown }).detail
        : undefined;
    const message = Array.isArray(detail)
      ? detail
          .map((item) =>
            item && typeof item === "object" && "msg" in item
              ? String(item.msg)
              : "Invalid input",
          )
          .join("; ")
      : typeof detail === "string"
        ? detail
        : `Request failed with status ${response.status}.`;
    throw new ApiError(message, response.status);
  }
  return body as T;
}

export function getSkills(query = "") {
  const suffix = query ? `?q=${encodeURIComponent(query)}` : "";
  return request<SkillsResponse>(`/api/skills${suffix}`);
}

export function getSampleProfiles() {
  return request<{ synthetic: true; profiles: SampleProfile[] }>("/api/profiles/samples");
}

export function createProfile(profile: ProfileDraft) {
  return request<StoredProfile>("/api/profiles", {
    method: "POST",
    body: JSON.stringify(profile),
  });
}

export function getProfile(profileId: string) {
  return request<StoredProfile>(`/api/profiles/${encodeURIComponent(profileId)}`);
}

export function getProfileInsights(profileId: string) {
  return request<ProfileInsights>(`/api/profiles/${encodeURIComponent(profileId)}/insights`);
}

export function updateProfile(profileId: string, profile: ProfileDraft) {
  return request<StoredProfile>(`/api/profiles/${encodeURIComponent(profileId)}`, {
    method: "PUT",
    body: JSON.stringify(profile),
  });
}

export async function extractCV(file: File): Promise<CVExtraction> {
  const response = await fetch("/api/profiles/extract-cv", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-Filename": file.name,
      "X-Synthetic-Demo-Confirmed": "true",
    },
    body: file,
  });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const detail = body && typeof body === "object" && "detail" in body
      ? (body as { detail?: unknown }).detail
      : undefined;
    throw new ApiError(typeof detail === "string" ? detail : `CV extraction failed with status ${response.status}.`, response.status);
  }
  return body as CVExtraction;
}

export function getTrendTopics() {
  return request<{ topics: Record<string, string>[] }>("/api/trends/topics");
}

export function getTrends() {
  return request<TrendDashboard>("/api/trends");
}

export function getRadarBrief(profileId?: string) {
  return request<RadarBrief>(`/api/trends/brief${profileId ? `?profile_id=${encodeURIComponent(profileId)}` : ""}`);
}

export function explainRadarBrief(profileId?: string) {
  return request<{ available: boolean; reason: string | null; summary: string | null; model: string | null }>(
    `/api/trends/brief/explain${profileId ? `?profile_id=${encodeURIComponent(profileId)}` : ""}`,
    { method: "POST" },
  );
}

export function getMalaysiaContext() {
  return request<MalaysiaContext>("/api/trends/malaysia");
}

export function refreshMalaysiaContext() {
  return request<MalaysiaContext>("/api/trends/malaysia/refresh", { method: "POST" });
}

export function refreshTrends() {
  return request<TrendDashboard>("/api/trends/refresh", { method: "POST" });
}

export function getTrendDemo() {
  return request<TrendDashboard>("/api/trends/demo");
}

export function getTrendHistory(topicId?: string) {
  const suffix = topicId ? `?topic_id=${encodeURIComponent(topicId)}` : "";
  return request<TrendHistory>(`/api/trends/history${suffix}`);
}

export function getProfileRelevance(profileId: string) {
  return request<ProfileRelevance>(
    `/api/trends/relevance?profile_id=${encodeURIComponent(profileId)}`,
  );
}

export function getEmployment() {
  return request<EmploymentDashboard>("/api/employment");
}

export function refreshEmployment() {
  return request<EmploymentDashboard>("/api/employment/refresh", { method: "POST" });
}

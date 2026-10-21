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
};

export type ProfileDraft = {
  status: ProfileStatus;
  education_level: EducationLevel;
  field_of_study: string;
  current_occupation: string | null;
  years_experience: number;
  skills: SkillInput[];
  interests: string[];
  work_activities: string[];
  transferable_strengths: string[];
  career_aspirations: string;
  skills_to_develop: string[];
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

export function updateProfile(profileId: string, profile: ProfileDraft) {
  return request<StoredProfile>(`/api/profiles/${encodeURIComponent(profileId)}`, {
    method: "PUT",
    body: JSON.stringify(profile),
  });
}

export function getTrendTopics() {
  return request<{ topics: Record<string, string>[] }>("/api/trends/topics");
}

export function getTrends() {
  return request<TrendDashboard>("/api/trends");
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

"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, getProfile, type ProfileDraft, type StoredProfile } from "@/lib/api";
import { PATHWAAY_PROFILE_UPDATED_EVENT, readPathwaayRegistrationProfile, type PathwaayRegistrationProfile } from "@/lib/pathwaay-profile";

export const PROFILE_KEY = "aiversecity.synthetic-profile-id";

export function profileSkillEvidenceKey(skill: { skill_id: string | null; display_name: string }) {
  return skill.skill_id ?? `custom:${skill.display_name.normalize("NFKC").trim().toLocaleLowerCase()}`;
}

export function profileToDraft(profile: StoredProfile): ProfileDraft {
  return {
    status: profile.status,
    education_level: profile.education_level,
    field_of_study: profile.field_of_study,
    professional_summary: profile.professional_summary ?? "",
    current_occupation: profile.current_occupation,
    years_experience: profile.years_experience,
    skills: profile.skills.map((skill) => ({
      name: skill.display_name,
      skill_id: skill.skill_id,
      proficiency: skill.proficiency,
      force_custom: skill.is_custom,
      evidence_record_ids: [...skill.evidence_record_ids],
    })),
    interests: [...profile.interests],
    work_activities: [...profile.work_activities],
    transferable_strengths: [...profile.transferable_strengths],
    career_aspirations: profile.career_aspirations,
    skills_to_develop: [...profile.skills_to_develop],
    education: profile.education.map((item) => ({ ...item, skill_ids: [...item.skill_ids] })),
    experience: profile.experience.map((item) => ({ ...item, skill_ids: [...item.skill_ids] })),
    projects: profile.projects.map((item) => ({ ...item, skill_ids: [...item.skill_ids] })),
    certifications: profile.certifications.map((item) => ({ ...item, skill_ids: [...item.skill_ids] })),
    achievements: profile.achievements.map((item) => ({ ...item, skill_ids: [...item.skill_ids] })),
    learning_preferences: { ...profile.learning_preferences },
    synthetic_demo: profile.synthetic_demo,
    registration_profile: profile.registration_profile,
  };
}

export function useSavedProfile() {
  const [profile, setProfile] = useState<StoredProfile | null>(null);
  const [profileId, setProfileId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    let id = "";
    try { id = localStorage.getItem(PROFILE_KEY) ?? ""; } catch {
      setError("This browser cannot access saved-profile storage.");
      setProfile(null);
      setProfileId("");
      setLoading(false);
      return;
    }
    setProfileId(id);
    if (!id) {
      setProfile(null);
      setLoading(false);
      return;
    }
    try {
      const result = await getProfile(id);
      setProfile(result);
    } catch (reason) {
      setProfile(null);
      if (reason instanceof ApiError && reason.status === 404) {
        setProfileId("");
        setError("The saved profile reference no longer exists. Its reference has been retained; open Profile to review it.");
      } else {
        setError(reason instanceof Error ? reason.message : "The saved profile could not be loaded.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);
  return { profile, profileId, loading, error, reload };
}

export function useRegistrationProfile() {
  const [profile, setProfile] = useState<PathwaayRegistrationProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const refresh = () => {
      setProfile(readPathwaayRegistrationProfile());
      setLoading(false);
    };
    refresh();
    window.addEventListener(PATHWAAY_PROFILE_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(PATHWAAY_PROFILE_UPDATED_EVENT, refresh);
  }, []);

  return { profile, loading };
}

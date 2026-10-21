import type { ProfileDraft } from "./api";

export type ProfileValidationResult = {
  valid: boolean;
  errors: Record<string, string>;
};

export function splitCommaList(value: string): string[] {
  const seen = new Set<string>();
  return value.split(",").map((item) => item.trim()).filter((item) => {
    const key = item.toLocaleLowerCase();
    if (!item || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function validateProfileDraft(draft: ProfileDraft): ProfileValidationResult {
  const errors: Record<string, string> = {};
  const fieldOfStudy = draft.field_of_study.trim();
  if (fieldOfStudy.length < 2 || fieldOfStudy.length > 120) {
    errors.field_of_study = "Enter a field of study between 2 and 120 characters.";
  }
  if (
    !Number.isFinite(draft.years_experience) ||
    draft.years_experience < 0 ||
    draft.years_experience > 70
  ) {
    errors.years_experience = "Enter a number from 0 to 70 years of experience.";
  }
  if (draft.skills.length === 0 || draft.skills.length > 40) {
    errors.skills = "Add between 1 and 40 skills.";
  }
  if (draft.skills.some((skill) => skill.name.trim().length > 100)) {
    errors.skills = "Each skill name must be 100 characters or fewer.";
  }
  if (
    draft.current_occupation &&
    draft.current_occupation.trim().length > 120
  ) {
    errors.current_occupation = "Occupation must be 120 characters or fewer.";
  }
  const aspiration = draft.career_aspirations.trim();
  if (aspiration.length < 3 || aspiration.length > 500) {
    errors.career_aspirations = "Enter an aspiration between 3 and 500 characters.";
  }
  if (
    draft.learning_preferences.weekly_hours !== null &&
    (!Number.isFinite(draft.learning_preferences.weekly_hours) ||
      draft.learning_preferences.weekly_hours < 0 ||
      draft.learning_preferences.weekly_hours > 168)
  ) {
    errors.weekly_hours = "Weekly hours must be between 0 and 168.";
  }
  if (
    draft.learning_preferences.budget_myr !== null &&
    (!Number.isFinite(draft.learning_preferences.budget_myr) ||
      draft.learning_preferences.budget_myr < 0 ||
      draft.learning_preferences.budget_myr > 100000)
  ) {
    errors.budget_myr = "Budget must be between MYR 0 and MYR 100,000.";
  }
  if (draft.synthetic_demo !== true) {
    errors.synthetic_demo = "Only fictional demonstration profiles can be saved.";
  }
  for (const [field, values] of [
    ["interests", draft.interests],
    ["work_activities", draft.work_activities],
    ["transferable_strengths", draft.transferable_strengths],
    ["skills_to_develop", draft.skills_to_develop],
  ] as const) {
    if (values.length > 20 || values.some((value) => value.length > 120)) {
      errors[field] = "Use at most 20 entries, each 120 characters or fewer.";
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

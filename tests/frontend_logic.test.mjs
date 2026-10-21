import assert from "node:assert/strict";
import test from "node:test";

import { buildTrendChartGeometry } from "../src/frontend/lib/chart-utils.ts";
import { splitCommaList, validateProfileDraft } from "../src/frontend/lib/profile-validation.ts";

const validProfile = () => ({
  status: "student",
  education_level: "bachelor",
  field_of_study: "Computer science",
  current_occupation: "",
  years_experience: 0,
  skills: [{ name: "Python programming", skill_id: "local:python-programming", proficiency: "beginner" }],
  interests: ["AI"],
  work_activities: [],
  transferable_strengths: [],
  career_aspirations: "Explore software development.",
  skills_to_develop: [],
  learning_preferences: { weekly_hours: null, budget_myr: null, mode: null },
  synthetic_demo: true,
});

const observation = (period_year, value) => ({
  period_year,
  value,
  period_label: String(period_year),
  source_url: null,
  retrieved_at: "2026-10-21T00:00:00Z",
  data_mode: "synthetic",
});

test("comma-separated entries are trimmed and de-duplicated", () => {
  assert.deepEqual(splitCommaList(" Python, data,Python, , data "), ["Python", "data"]);
});

test("profile validation accepts a complete synthetic profile", () => {
  assert.deepEqual(validateProfileDraft(validProfile()), { valid: true, errors: {} });
});

test("profile validation rejects blank required data, negative experience, and non-demo data", () => {
  const profile = validProfile();
  profile.field_of_study = " ";
  profile.years_experience = -1;
  profile.skills = [];
  profile.career_aspirations = "";
  profile.synthetic_demo = false;
  const result = validateProfileDraft(profile);
  assert.equal(result.valid, false);
  assert.ok(result.errors.field_of_study);
  assert.ok(result.errors.years_experience);
  assert.ok(result.errors.skills);
  assert.ok(result.errors.career_aspirations);
  assert.ok(result.errors.synthetic_demo);
});

test("chart geometry safely handles empty and one-period data", () => {
  assert.deepEqual(buildTrendChartGeometry([]), {
    points: [],
    segments: [],
    minValue: 0,
    maxValue: 0,
  });
  const single = buildTrendChartGeometry([observation(2025, 12)]);
  assert.equal(single.points.length, 1);
  assert.deepEqual(single.segments, []);
});

test("chart geometry leaves a visible gap for a missing publication year", () => {
  const chart = buildTrendChartGeometry([
    observation(2021, 20),
    observation(2022, 30),
    observation(2024, 50),
    observation(2025, 60),
  ]);
  assert.equal(chart.points.length, 4);
  assert.equal(chart.segments.length, 2);
  assert.ok(chart.points[2].x > chart.points[1].x);
});

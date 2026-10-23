import { expect, test } from "@playwright/test";

test("saved skills produce matches, reloadable details, pathways and updated scores", async ({ page, request }) => {
  test.setTimeout(90_000);
  const boot = await (await request.get("/api/v2/bootstrap")).json();
  const sample = (await (await request.get("/api/profiles/samples")).json()).profiles[0];
  const { sample_id, label, taxonomy, ...draft } = sample;
  const fixture = boot.profiles.find((p: { profile_id: string }) => p.profile_id === "demo-graduate-a");
  draft.skills = fixture.skills.map((s: { name: string; proficiency: string }) => ({
    name: s.name, skill_id: null, force_custom: true, proficiency: s.proficiency === "unknown" ? "beginner" : s.proficiency, evidence_record_ids: [],
  }));
  const saved = await request.post("/api/profiles", { data: draft });
  expect(saved.status(), await saved.text()).toBe(201);
  const profile = await saved.json();
  await page.goto("/role-matching");
  await page.evaluate(id => localStorage.setItem("aiversecity.synthetic-profile-id", id), profile.id);
  const matching = page.waitForResponse(r => r.url().endsWith("/api/v2/matches"));
  await page.reload();
  const response = await matching;
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON().profile.profile_id).toBe(profile.id);
  const results = await response.json();
  expect(results.results.length).toBeGreaterThan(0);
  const explore = page.getByTestId("career-card").first().getByRole("link", { name: /Explore More/ });
  await expect(explore).not.toHaveAttribute("aria-disabled", "true");
  await explore.click();
  const overview = page.getByTestId("career-overview");
  await expect(overview).toBeVisible();
  await expect(overview.locator(".score strong")).toHaveText(`${results.results[0].score.profile_relevance_pct.toFixed(2)}%`);
  await page.reload();
  await expect(overview.locator(".score strong")).toHaveText(`${results.results[0].score.profile_relevance_pct.toFixed(2)}%`, { timeout: 30_000 });
  await page.getByRole("link", { name: /Explore Pathway/ }).click();
  await expect(page.getByTestId("pathway-view")).toBeVisible({ timeout: 30_000 });
  // Change claimed skills on the saved contract. A new visit must not reuse stale matches.
  draft.skills = [{ name: "Fictional unresolved test skill 123", skill_id: null, force_custom: true, proficiency: "beginner", evidence_record_ids: [] }];
  expect((await request.put(`/api/profiles/${profile.id}`, { data: draft })).status()).toBe(200);
  const updated = page.waitForResponse(r => r.url().endsWith("/api/v2/matches"));
  await page.goto("/role-matching");
  const changed = await updated;
  expect(changed.request().postDataJSON().profile.skills).toEqual([]);
  expect((await changed.json()).results).toEqual([]);
  await expect(page.getByText(/Unresolved skills, excluded from scoring/)).toBeVisible();
});

test("saved-profile errors allow retry and missing references never use a demo", async ({ page }) => {
  await page.goto("/role-matching");
  await page.evaluate(() => localStorage.setItem("aiversecity.synthetic-profile-id", "missing-test-profile"));
  await page.reload();
  await expect(page.locator(".error-panel[role=alert]")).toContainText("Saved profile not found");
  await expect(page.getByTestId("career-card")).toHaveCount(0);
  await page.evaluate(() => localStorage.removeItem("aiversecity.synthetic-profile-id"));
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: "Complete your profile to see personalised matches" })).toBeVisible();
});

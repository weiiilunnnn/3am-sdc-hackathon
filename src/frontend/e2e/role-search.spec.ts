import { displayOccupationTitle } from "../lib/career-display";
import { expect, test } from "@playwright/test";
import type { RoleSearchResponse } from "../lib/contracts";
import { openMatches, openDetails, titleSearch } from "./role-helpers";

test("search focus stays below its label with an adjacent icon on desktop and mobile", async ({ page }) => {
  await openMatches(page); const field = page.getByLabel("Search occupations");
  const button = page.getByRole("button", { name: "Search roles", exact: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 }); await field.focus();
    await expect(button).toBeVisible(); await expect(button.locator("svg")).toHaveCount(1); await expect(button).toHaveText("");
    const labelBox = await page.locator('label[for="occupation-search"]').boundingBox();
    const fieldBox = await field.boundingBox(); const buttonBox = await button.boundingBox();
    expect(fieldBox!.y - labelBox!.y - labelBox!.height).toBeGreaterThanOrEqual(7);
    expect(buttonBox!.x).toBeGreaterThan(fieldBox!.x + fieldBox!.width);
    expect(Math.abs(buttonBox!.y - fieldBox!.y)).toBeLessThan(1);
    expect(await field.evaluate(el => getComputedStyle(el).outlineOffset)).toBe("-2px");
  }
});

test("search scores remain sorted before pagination and clearing restores recommendations", async ({ page }) => {
  const original = await openMatches(page); const first = await titleSearch(page, "engineer");
  expect(first.total_search_results).toBeGreaterThan(5);
  const pending = page.waitForResponse(r => r.url().endsWith("/api/v2.1/roles/search"));
  await page.getByRole("button", { name: "Show more search results" }).click();
  const next = await (await pending).json() as RoleSearchResponse;
  const combined = [...first.results, ...next.results];
  const scores = combined.map(r => r.score.profile_relevance_pct ?? -1); expect(scores).toEqual([...scores].sort((a, b) => b - a));
  const cards = page.getByTestId("career-card"); await expect(cards).toHaveCount(combined.length);
  await expect(cards.locator(".recommendation-tag")).toHaveCount(0);
  await expect(cards.locator(".esco-tag")).toHaveCount(combined.length);
  await expect(cards.getByRole("heading")).toHaveText(combined.map(r => displayOccupationTitle(r.role_title)));
  await openDetails(page, 5); await page.getByRole("link", { name: /Back to Future-Role Matching/ }).click();
  await expect(page.getByLabel("Search occupations")).toHaveValue("engineer"); await expect(cards).toHaveCount(combined.length);
  const restored = page.waitForResponse(r => r.url().endsWith("/api/v2/matches"));
  await page.getByLabel("Search occupations").fill("   ");
  expect(await (await restored).json()).toEqual(original); await expect(cards).toHaveCount(original.results.length);
  await expect(page.getByRole("heading", { name: "Recommended for you" })).toBeVisible();
});

test("a searched zero-percent occupation keeps its score on details and can open a pathway", async ({ page }) => {
  await openMatches(page); const response = await titleSearch(page, "dentist");
  const index = response.results.findIndex(r => r.score.profile_relevance_pct === 0); expect(index).toBeGreaterThanOrEqual(0);
  const selected = response.results[index]; expect(selected.qualification_status).toBe("search_result");
  await openDetails(page, index); await expect(page.locator(".score strong")).toHaveText("0.00%");
  await expect(page.getByText(/Search result; recommendation qualification/)).toBeVisible();
  const pending = page.waitForResponse(r => r.url().endsWith("/api/pathways"));
  await page.getByRole("link", { name: /Explore Pathway/ }).click();
  const path = await (await pending).json(); expect(path.role_id).toBe(selected.role_id);
  await expect(page.getByTestId("pathway-view")).toBeVisible();
});

test("deep-linked current synthetic profile reuses the backend scorer", async ({ page, request }) => {
  const boot = await (await request.get("/api/v2/bootstrap")).json();
  const response = await (await request.post("/api/v2.1/roles/search", { data: { schema_version: "2.1", profile: boot.profiles[0], role_query: "data scientist" } })).json();
  const role = response.results[0];
  await page.goto(`/role-matching/roles/${encodeURIComponent(role.role_id)}?demo=${encodeURIComponent(boot.profiles[0].profile_id)}`);
  await expect(page.locator(".score strong")).toHaveText(`${role.score.profile_relevance_pct.toFixed(2)}%`, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(role.role_title);
});

test("unknown title and unavailable profile score remain honest", async ({ page }) => {
  await openMatches(page, "demo-discovery-unknown");
  const response = await titleSearch(page, "data scientist");
  expect(response.results[0].score.profile_relevance_pct).toBeNull();
  await expect(page.getByTestId("career-card").first().locator(".score strong")).toHaveText("Unavailable");
  await openDetails(page); await expect(page.locator(".score strong")).toHaveText("Unavailable");
  await expect(page.getByRole("link", { name: /Explore Pathway/ })).toBeDisabled();
  await page.getByRole("link", { name: /Back to Future-Role Matching/ }).click();
  const unknown = await titleSearch(page, "zz-no-indexed-title-123"); expect(unknown.total_search_results).toBe(0);
  await expect(page.getByRole("heading", { name: "No occupations found" })).toBeVisible();
});

test("clearing cancels delayed search and prevents stale overwrites", async ({ page }) => {
  const original = await openMatches(page);
  let arrived!: () => void, release!: () => void;
  const sent = new Promise<void>(resolve => { arrived = resolve; }); const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/v2.1/roles/search", async route => { const response = await route.fetch(); arrived(); await gate; await route.fulfill({ response }).catch(() => {}); });
  await page.getByLabel("Search occupations").fill("Data Scientist"); await sent;
  const restored = page.waitForResponse(r => r.url().endsWith("/api/v2/matches"));
  await page.getByLabel("Search occupations").fill(""); expect(await (await restored).json()).toEqual(original);
  release(); await page.unrouteAll({ behavior: "wait" });
  await expect(page.getByRole("heading", { name: "Recommended for you" })).toBeVisible();
  await expect(page.getByTestId("career-card")).toHaveCount(original.results.length);
});


test("positive scores below thirty percent are identical on both pages", async ({ page, request }) => {
  const boot = await (await request.get("/api/v2/bootstrap")).json();
  const search = await (await request.post("/api/v2.1/roles/search", { data: { schema_version: "2.1", profile: boot.profiles[0], role_query: "data scientist" } })).json();
  const role = search.results[0];
  const detail = await (await request.get(`/api/v2/roles/detail?role_id=${encodeURIComponent(role.role_id)}`)).json();
  const edges = detail.role.required_skills as { skill_id: string; name: string; requirement: string }[];
  const optional = edges.find(edge => edge.requirement === "optional")!;
  const required = new Set(edges.map(edge => edge.skill_id));
  const skills = boot.profiles.flatMap((p: { skills: { skill_id: string; name: string }[] }) => p.skills) as { skill_id: string; name: string }[];
  const unrelated = [...new Map(skills.filter(skill => !required.has(skill.skill_id)).map(skill => [skill.skill_id, skill])).values()].slice(0, 6);
  expect(unrelated).toHaveLength(6);
  // Explicit synthetic test profile, containing only existing verified concepts.
  const fixture = { ...boot.profiles[0], profile_id: "ui-test-below-threshold", skills: [optional, ...unrelated].map(skill => ({ skill_id: skill.skill_id, name: skill.name, proficiency: "unknown", self_reported: true })) };
  await page.route("**/api/v2/bootstrap", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...boot, profiles: [...boot.profiles, fixture] }) }));
  await openMatches(page, fixture.profile_id);
  const result = await titleSearch(page, role.role_title);
  const index = result.results.findIndex(r => r.role_id === role.role_id);
  expect(index).toBeGreaterThanOrEqual(0); const selected = result.results[index];
  expect(selected.score.profile_relevance_pct).toBeGreaterThan(0);
  expect(selected.score.profile_relevance_pct).toBeLessThan(30);
  await openDetails(page, index);
  await expect(page.locator(".score strong")).toHaveText(`${selected.score.profile_relevance_pct!.toFixed(2)}%`);
});

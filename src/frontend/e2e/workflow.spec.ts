import { displayOccupationTitle } from "../lib/career-display";
import { expect, test } from "@playwright/test";
import { openMatches, openDetails } from "./role-helpers";

test("full-width cards show sourced descriptions, strengths and unchanged backend relevance", async ({ page }) => {
  const response = await openMatches(page);
  const card = page.getByTestId("career-card").first();
  await expect(card.locator(".occupation-tag")).toHaveText(["Profile-Based Recommendation", "ESCO Occupation"]);
  await expect(card.getByRole("heading")).toHaveText(displayOccupationTitle(response.results[0].role_title));
  await expect(card.locator(".score strong")).toHaveText(`${response.results[0].score.profile_relevance_pct!.toFixed(2)}%`);
  await expect(card.getByRole("progressbar")).toHaveAttribute("aria-valuenow", String(response.results[0].score.profile_relevance_pct));
  await expect(card.getByRole("link", { name: /Explore More/ })).toBeVisible();
  await expect(card.locator(".career-card-description")).toHaveText(response.results[0].description);
  await expect(card.locator(".career-card-strengths .chip")).toHaveText(response.results[0].strengths.slice(0, 3).map(s => s.name));
  await expect(card.locator(".career-card-source")).toContainText(`ESCO ${response.results[0].esco_release}`);
  await expect(card.locator("details, button")).toHaveCount(0);
  await expect(page.getByText(/Start with your skills/i)).toHaveCount(0);
  await expect(page.getByRole("tab", { name: /Learning pathway/i })).toHaveCount(0);
  await expect(page.getByLabel("Synthetic profile")).toHaveCount(0);
  expect(response.results.every(r => r.score.profile_relevance_pct! >= 30)).toBeTruthy();
  for (const width of [1440, 820, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const list = await page.locator(".compact-results-grid").boundingBox();
    const hero = await page.locator(".intro-section").boundingBox();
    const heading = await page.locator(".results-heading").boundingBox();
    const search = await page.locator(".role-search-toolbar").boundingBox();
    expect(Math.abs(list!.x - hero!.x)).toBeLessThan(1);
    expect(Math.abs(heading!.x - hero!.x)).toBeLessThan(1);
    expect(Math.abs(search!.x - hero!.x)).toBeLessThan(1);
    const first = await card.boundingBox();
    const second = await page.getByTestId("career-card").nth(1).boundingBox();
    expect(Math.abs(first!.width - list!.width)).toBeLessThan(1);
    expect(second!.y).toBeGreaterThanOrEqual(first!.y + first!.height);
    const info = await card.locator(".career-card-information").boundingBox();
    const relevance = await card.locator(".career-card-relevance").boundingBox();
    if (width > 680) expect(relevance!.x).toBeGreaterThan(info!.x + info!.width);
    else expect(relevance!.y).toBeGreaterThanOrEqual(info!.y + info!.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width !== 820) await card.screenshot({ path: `test-results/horizontal-card-${width}.png` });
  }
});

test("canonical details preserve score, sourced strengths and compact gaps", async ({ page }) => {
  const response = await openMatches(page); const selected = response.results[0];
  const detail = await openDetails(page);
  expect(detail.role.role_id).toBe(selected.role_id);
  expect(decodeURIComponent(new URL(page.url()).pathname)).toBe(`/role-matching/roles/${selected.role_id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(selected.role_title);
  await expect(page.locator(".score strong")).toHaveText(`${selected.score.profile_relevance_pct!.toFixed(2)}%`);
  for (const name of ["Skill Gap Analysis", "Your Skill Profile", "Recognised Strengths", "Areas to Explore", "Skills Gap Breakdown"]) await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.locator(".area-tile")).toHaveCount(selected.development_areas.length);
  await expect(page.locator(".gap-facts dd")).toHaveText([selected.score.matched_recognised_skill_count, selected.score.matched_essential_skill_count, selected.not_evidenced_essential_count].map(String));
  expect(await page.getByRole("progressbar").count()).toBe(1);
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", String(selected.score.profile_relevance_pct));
  await expect(page.locator(".radial-fill")).toHaveAttribute("stroke-dashoffset", String(2 * Math.PI * 50 * (1 - selected.score.profile_relevance_pct! / 100)));
  for (const width of [1440, 820, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const info = await page.locator(".career-overview-information").boundingBox();
    const gauge = await page.getByRole("progressbar").boundingBox();
    const gap = await page.locator(".skill-gap-card").boundingBox();
    const profile = await page.locator(".skill-profile-card").boundingBox();
    if (width > 680) {
      expect(gauge!.x).toBeGreaterThan(info!.x + info!.width);
      expect(profile!.x).toBeGreaterThan(gap!.x + gap!.width);
      expect(Math.abs(profile!.y - gap!.y)).toBeLessThan(1);
    } else {
      expect(gauge!.y).toBeGreaterThan(info!.y + info!.height);
      expect(profile!.y).toBeGreaterThan(gap!.y + gap!.height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width !== 820) await page.screenshot({ path: `test-results/details-dashboard-${width}.png`, fullPage: true });
  }
  if (selected.development_areas.length) {
    const area = page.locator(".area-tile").first();
    await area.locator(".gap-area-explanation>summary").click();
    await expect(area.getByText(selected.development_areas[0].explanation, { exact: true })).toBeVisible();
    await area.locator(".sources>summary").click();
    await expect(area.locator(".sources li").first()).toBeVisible();
  }
  await page.getByText("ESCO occupation source", { exact: false }).first().click();
  await expect(page.getByTestId("career-overview").getByRole("link").first()).toHaveAttribute("href", /selectedVersion=v1.2.1/);
  await page.getByText("About this score / Sources & limitations", { exact: true }).click();
  await expect(page.getByText(/Documented essential coverage:/)).toBeVisible();
  await expect(page.getByText(/View all documented requirements/)).toHaveCount(0);
});

test("description toggle uses a single paragraph on the details page", async ({ page }) => {
  await openMatches(page); await openDetails(page);
  const description = page.getByTestId("role-description"); const original = await description.textContent();
  await expect(description).toHaveCount(1); await expect(description).toHaveClass(/description-clamped/);
  await page.getByRole("button", { name: /Read more/ }).click();
  await expect(description).not.toHaveClass(/description-clamped/); expect(await description.textContent()).toBe(original);
  await page.getByRole("button", { name: /Show less/ }).click(); await expect(description).toHaveClass(/description-clamped/);
});

test("details open the unchanged pathway for the canonical role and profile", async ({ page }) => {
  const response = await openMatches(page); await openDetails(page);
  const pending = page.waitForResponse(r => r.url().endsWith("/api/pathways"));
  await page.getByRole("link", { name: /Explore Pathway/ }).click();
  const result = await pending; expect(result.ok()).toBeTruthy();
  const path = await result.json(); expect(path.role_id).toBe(response.results[0].role_id); expect(path.profile_fingerprint).toBe(response.profile_fingerprint);
  await expect(page).toHaveURL(/\/pathway$/); await expect(page.getByTestId("pathway-view")).toBeVisible();
  await page.getByRole("link", { name: /Back to Career Details/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(response.results[0].role_title);
});

test("direct link and refresh never manufacture a profile or score", async ({ page, request }) => {
  await page.goto("/role-matching");
  await expect(page.getByRole("heading", { name: "Complete your profile to see personalised matches" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("career-card")).toHaveCount(0);
  const boot = await (await request.get("/api/v2/bootstrap")).json();
  const selected = await (await request.post("/api/v2/matches", { data: { schema_version: "2.0", profile: boot.profiles[0] } })).json();
  const role = { role_id: selected.results[0].role_id, title: selected.results[0].role_title };
  await page.goto(`/role-matching/roles/${encodeURIComponent(role.role_id)}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(role.title);
  await expect(page.locator(".score strong")).toHaveText("Unavailable");
  await expect(page.getByRole("link", { name: /Explore Pathway/ })).toBeDisabled();
  await page.reload(); await expect(page.getByRole("heading", { level: 1 })).toHaveText(role.title);
  await expect(page.locator(".score strong")).toHaveText("Unavailable");
});

test("invalid role and API errors are recoverable without fictitious details", async ({ page }) => {
  await page.goto("/role-matching/roles/not-a-role");
  await expect(page.locator(".error-panel[role=alert]")).toContainText(/not present/);
  await expect(page.getByTestId("career-overview")).toHaveCount(0);
  await page.route("**/api/v2/roles/detail?**", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "Fixture detail outage" }) }));
  await page.reload(); await expect(page.locator(".error-panel[role=alert]")).toContainText("Fixture detail outage");
  await page.unrouteAll(); await page.getByRole("link", { name: /Back to Future-Role Matching/ }).click();
  await expect(page.getByRole("heading", { name: "Complete your profile to see personalised matches" })).toBeVisible();
});

test("mobile overview, analysis, action and pathway do not overlap", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await openMatches(page); await openDetails(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const title = await page.getByRole("heading", { level: 1 }).boundingBox(); const button = await page.getByRole("link", { name: /Explore Pathway/ }).boundingBox();
  expect(button!.y).toBeGreaterThanOrEqual(title!.y + title!.height);
  await page.screenshot({ path: "test-results/career-details-mobile.png", fullPage: true });
  await page.getByRole("link", { name: /Explore Pathway/ }).click(); await expect(page.getByTestId("pathway-view")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

import { expect, test } from "@playwright/test";
import type { RoleSearchResponse } from "../lib/contracts";

test("search focus stays below its label with an adjacent icon on desktop and mobile", async ({ page }) => {
  await page.goto("/role-matching");
  const field = page.getByLabel("Search occupations");
  const button = page.getByRole("button", { name: "Search roles", exact: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await field.focus();
    await expect(button).toBeVisible();
    await expect(button.locator("svg")).toHaveCount(1);
    await expect(button).toHaveText("");
    const labelBox = await page.locator('label[for="occupation-search"]').boundingBox();
    const fieldBox = await field.boundingBox();
    const buttonBox = await button.boundingBox();
    expect(labelBox && fieldBox && buttonBox).toBeTruthy();
    expect(fieldBox!.y - labelBox!.y - labelBox!.height).toBeGreaterThanOrEqual(7);
    expect(buttonBox!.x).toBeGreaterThan(fieldBox!.x + fieldBox!.width);
    expect(Math.abs(buttonBox!.y - fieldBox!.y)).toBeLessThan(1);
    expect(await field.evaluate(el => getComputedStyle(el).outlineOffset)).toBe("-2px");
    await page.locator(".role-search-toolbar").screenshot({ path: `test-results/search-controls-${width}.png` });
  }
});

test("title search overrides qualification, clears automatically and keeps pathway navigation", async ({ page }) => {
  await page.goto("/role-matching");
  const matched = page.waitForResponse(r => r.url().endsWith("/api/v2/matches"));
  await page.getByRole("button", { name: "Find matching roles" }).click();
  const original = await (await matched).json();
  const search = page.getByLabel("Search occupations");
  const cards = page.getByTestId("career-card");
  // Empty input is still the same qualified recommendation page.
  await expect(cards).toHaveCount(original.results.length);
  const searched = page.waitForResponse(r => r.url().endsWith("/api/v2.1/roles/search"));
  await search.fill("Data Scientist");
  const found = await (await searched).json();
  expect(found.results[0].role_title.toLowerCase()).toBe("data scientist");
  await expect(page.getByRole("heading", { name: "Occupation search results" })).toBeVisible();
  await expect(cards.first().getByRole("heading")).toHaveText(/data scientist/i);
  const path = page.waitForResponse(r => r.url().endsWith("/api/pathways"));
  await cards.first().getByRole("button", { name: "Explore pathway" }).click();
  expect((await path).ok()).toBeTruthy();
  await expect(page.getByTestId("pathway-view")).toBeVisible();
  await page.getByRole("tab", { name: /Role matches/ }).click();
  const restored = page.waitForResponse(r => r.url().endsWith("/api/v2/matches"));
  await search.fill("   ");
  const cleared = await (await restored).json();
  expect(cleared).toEqual(original);
  await expect(cards).toHaveCount(original.results.length);
  await expect(page.getByRole("heading", { name: "Your role matches" })).toBeVisible();

  // A profile with no listed skills can still discover the verified occupation.
  const remove = page.getByRole("button", { name: /^Remove / });
  while (await remove.count()) await remove.first().click();
  const emptySearch = page.waitForResponse(r => r.url().endsWith("/api/v2.1/roles/search"));
  await search.fill("Data Scientist");
  const empty = await (await emptySearch).json();
  expect(empty.results[0].score.profile_relevance_pct).toBeNull();
  await expect(cards.first().locator(".score strong")).toHaveText("Not assessable");
  await expect(cards.first().locator(".notice")).toBeVisible();
  await expect(cards.first().getByRole("button", { name: "Explore pathway" })).toBeDisabled();
});

test("title pagination and unknown title empty state", async ({ page }) => {
  await page.goto("/role-matching");
  const first = page.waitForResponse(r => r.url().endsWith("/api/v2.1/roles/search"));
  await page.getByLabel("Search occupations").fill("data");
  const result = await (await first).json() as RoleSearchResponse;
  expect(result.total_search_results).toBeGreaterThan(5);
  const cards = page.getByTestId("career-card");
  await expect(cards).toHaveCount(5);
  const next = page.waitForResponse(r => r.url().endsWith("/api/v2.1/roles/search"));
  await page.getByRole("button", { name: "Show more search results" }).click();
  const nextResult = await (await next).json() as RoleSearchResponse;
  expect(nextResult.offset).toBe(5);
  await expect(cards).toHaveCount(10);
  const combined = [...result.results, ...nextResult.results];
  const scores = combined.map(r => r.score.profile_relevance_pct ?? -1);
  expect(scores).toEqual([...scores].sort((a, b) => b - a));
  await expect(cards.getByRole("heading")).toHaveText(combined.map(r => r.role_title));
  const unknown = page.waitForResponse(r => r.url().endsWith("/api/v2.1/roles/search"));
  await page.getByLabel("Search occupations").fill("zz-no-indexed-title-123");
  expect((await (await unknown).json()).total_search_results).toBe(0);
  await expect(cards).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "No occupations found" })).toBeVisible();
});

test("clearing cancels a delayed search and prevents stale search overwrites", async ({ page }) => {
  let arrived!: () => void, release!: () => void;
  const sent = new Promise<void>(resolve => { arrived = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/v2.1/roles/search", async route => {
    const response = await route.fetch(); arrived(); await gate;
    await route.fulfill({ response }).catch(() => {});
  });
  await page.goto("/role-matching");
  let response = page.waitForResponse(r => r.url().endsWith("/api/v2/matches"));
  await page.getByRole("button", { name: "Find matching roles" }).click();
  const original = await (await response).json();
  await page.getByLabel("Search occupations").fill("Data Scientist");
  await sent;
  response = page.waitForResponse(r => r.url().endsWith("/api/v2/matches"));
  await page.getByLabel("Search occupations").fill("");
  expect(await (await response).json()).toEqual(original);
  release();
  await page.unrouteAll({ behavior: "wait" });
  await expect(page.getByRole("heading", { name: "Your role matches" })).toBeVisible();
  await expect(page.getByTestId("career-card")).toHaveCount(original.results.length);
});

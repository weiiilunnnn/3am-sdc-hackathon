import { expect, test } from "@playwright/test";
import { openMatches, openDetails } from "./role-helpers";

// Providers are disabled in Playwright config. These check only local fallback
// and explicitly mocked provenance, never claim successful live discovery.
test("pathway discovery loading, local fallback and mobile evidence stay usable", async ({ page }) => {
  await openMatches(page); await openDetails(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/pathways", async route => {
    const response = await route.fetch();
    await gate;
    await route.fulfill({ response });
  });
  await page.getByRole("link", { name: /Explore Pathway/ }).click();
  await expect(page.getByRole("status")).toContainText("Finding and checking learning resources");
  release();
  await expect(page.getByTestId("pathway-view")).toBeVisible();
  await expect(page.getByTestId("discovery-notice")).toContainText(/local catalogue/);
  for (const badge of await page.getByTestId("resource-origin").all()) await expect(badge).toContainText("Reviewed catalogue");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("cached online provenance uses returned source records and survives no guessed claims", async ({ page }) => {
  await openMatches(page); await openDetails(page);
  await page.route("**/api/pathways", async route => {
    const response = await route.fetch();
    const data = await response.json();
    data.discovery_status = "mixed";
    data.discovery_message = "Mocked cached online resources supplemented with reviewed catalogue resources.";
    const resource = data.phases.flatMap((p: { resources: unknown[] }) => p.resources)[0];
    resource.resource_origin = "web_discovered";
    resource.retrieval_mode = "cached_verified";
    resource.content_verified_at = "2026-10-22T00:00:00Z";
    await route.fulfill({ response, json: data });
  });
  await page.getByRole("link", { name: /Explore Pathway/ }).click();
  await expect(page.getByTestId("discovery-notice")).toContainText("Mocked cached online");
  await expect(page.getByTestId("resource-origin").first()).toContainText("Previously discovered");
  await expect(page.getByTestId("resource-origin").first()).toContainText("Provider details checked 2026-10-22");
});

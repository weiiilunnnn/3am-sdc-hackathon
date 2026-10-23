import { expect, test } from "@playwright/test";
import { openMatches, openDetails } from "./role-helpers";

test("role screens share workspace navigation and preserve client navigation", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/profile");
  await page.evaluate(() => { (window as unknown as Record<string, unknown>).__workspaceNavigationTest = "retained"; });
  await page.getByTestId("link-role-matching").click();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await expect(page.getByTestId("link-role-matching")).toHaveAttribute("aria-current", "page");
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__workspaceNavigationTest)).toBe("retained");
  await page.getByTestId("link-profile").click();
  await expect(page.getByTestId("form-profile")).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__workspaceNavigationTest)).toBe("retained");
  // Verify all feature screens use the same shell, including nested routes.
  await openMatches(page);
  for (const width of [1440, 820, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openDetails(page);
  for (let step = 0; step < 2; step++) {
    await expect(page.getByRole("banner")).toHaveCount(1);
    await expect(page.getByRole("contentinfo")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Aiversecity home", exact: true })).toBeVisible();
    await expect(page.getByTestId("link-role-matching")).toHaveAttribute("aria-current", "page");
    if (step === 0) await page.getByRole("link", { name: /Explore Pathway/ }).click();
  }
  await expect(page.getByTestId("pathway-view")).toBeVisible();
  await page.screenshot({ path: "test-results/shared-workspace-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/shared-workspace-mobile.png" });
  await page.getByTestId("link-profile").click();
  await expect(page.getByTestId("form-profile")).toBeVisible();
  await expect(page.locator(".future-role-ui")).toHaveCount(0);
  expect(await page.getByRole("heading", { level: 1 }).evaluate(el => getComputedStyle(el).fontFamily)).toContain("Manrope");
});

test("main redirect and every existing page remain available alongside KW", async ({ page, request }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await expect(page).toHaveURL(/\/register$/);
  for (const route of ["/register", "/login", "/explorer", "/home", "/profile", "/cv-studio", "/outlook", "/explore", "/radar", "/role-matching"]) {
    const response = await request.get(route);
    expect(response.status(), route).toBe(200);
  }
  await page.getByRole("link", { name: "Skills workspace", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.getByTestId("link-profile").click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByTestId("form-profile")).toBeVisible();
});

test("saved profile supplies matching automatically and survives updates and refresh", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/profile");
  await page.locator('[data-testid^="button-sample-"]').first().click();
  const summary = "Fictional integration profile used to verify the merged application.";
  await page.getByLabel("Professional summary", { exact: true }).fill(summary);
  await page.getByTestId("checkbox-fictional-confirmation").check();
  const saved = page.waitForResponse(r => r.url().endsWith("/api/profiles") && r.request().method() === "POST");
  await page.getByTestId("button-save-profile").click();
  const response = await saved;
  expect(response.status()).toBe(201);
  const profile = await response.json();
  await expect(page.getByTestId("status-saved-profile")).toContainText(profile.id.slice(0, 12));
  await page.reload();
  await expect(page.getByLabel("Professional summary", { exact: true })).toHaveValue(summary);
  const matching = page.waitForResponse(r => r.url().endsWith("/api/v2/matches"));
  await page.getByTestId("link-role-matching").click();
  await expect(page).toHaveURL(/\/role-matching$/);
  const matches = await matching;
  expect(matches.status()).toBe(200);
  expect(matches.request().postDataJSON().profile.profile_id).toBe(profile.id);
  await expect(page.locator(".result-count")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Complete your profile to see personalised matches" })).toHaveCount(0);
  const refreshed = page.waitForResponse(r => r.url().endsWith("/api/v2/matches"));
  await page.reload();
  expect((await refreshed).status()).toBe(200);
  await page.goto("/profile");
  await expect(page.getByLabel("Professional summary", { exact: true })).toHaveValue(summary);
  await expect(page.getByTestId("status-saved-profile")).toContainText(profile.id.slice(0, 12));
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

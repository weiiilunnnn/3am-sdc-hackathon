import { expect, test } from "@playwright/test";

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

test("main profile persists across KW navigation without contract conversion", async ({ page }) => {
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
  await page.getByTestId("link-role-matching").click();
  await expect(page).toHaveURL(/\/role-matching$/);
  await expect(page.getByRole("button", { name: "Find matching roles" })).toBeVisible({ timeout: 30_000 });
  await page.goto("/profile");
  await expect(page.getByLabel("Professional summary", { exact: true })).toHaveValue(summary);
  await expect(page.getByTestId("status-saved-profile")).toContainText(profile.id.slice(0, 12));
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

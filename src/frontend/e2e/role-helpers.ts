import { expect, type Page } from "@playwright/test";
import type { DiscoveryResponse, RoleSearchResponse } from "../lib/contracts";
export async function openMatches(page: Page, demo = "demo-graduate-a") {
  const pending = page.waitForResponse(r => r.url().endsWith("/api/v2/matches"));
  await page.goto(`/role-matching?demo=${encodeURIComponent(demo)}`);
  const result = await (await pending).json() as DiscoveryResponse;
  await expect(page.getByTestId("career-card")).toHaveCount(result.results.length);
  return result;
}
export async function titleSearch(page: Page, query: string) {
  const pending = page.waitForResponse(r => r.url().endsWith("/api/v2.1/roles/search"));
  await page.getByLabel("Search occupations").fill(query);
  const result = await (await pending).json() as RoleSearchResponse;
  await expect(page.getByTestId("career-card")).toHaveCount(result.results.length);
  return result;
}
export async function openDetails(page: Page, index = 0) {
  const pending = page.waitForResponse(r => r.url().includes("/api/v2/roles/detail?"));
  await page.getByTestId("career-card").nth(index).getByRole("link", { name: /Explore More/ }).click();
  const result = await (await pending).json();
  await expect(page.getByTestId("career-overview")).toBeVisible();
  return result;
}

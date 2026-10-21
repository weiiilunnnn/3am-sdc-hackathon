import { expect, test } from "@playwright/test";
import type { Bootstrap, DiscoveryResponse } from "../lib/contracts";

let boot: Bootstrap;
test.beforeAll(async ({ request }) => {
  const response = await request.get("/api/v2/bootstrap", { timeout: 60_000 });
  expect(response.ok()).toBeTruthy(); boot = await response.json();
});
async function match(page: import("@playwright/test").Page) {
  const response = page.waitForResponse(r => r.url().endsWith("/api/v2/matches"));
  await page.getByRole("button", { name: "Find matching roles" }).click();
  return await (await response).json() as DiscoveryResponse;
}

test("real proxy, qualified relevance cards and citations", async ({ page, request }) => {
  expect((await request.get("/api/health")).ok()).toBeTruthy();
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto("/");
  const result = await match(page); const cards = page.getByTestId("career-card");
  expect(result.indexed_occupation_count).toBeGreaterThan(15);
  expect(result.total_qualifying_roles).toBeGreaterThan(0);
  await expect(cards).toHaveCount(result.results.length);
  await expect(cards.first().locator(".score strong")).toHaveText(`${result.results[0].score.profile_relevance_pct!.toFixed(2)}%`);
  await expect(cards.first().getByText("Profile relevance", { exact: true })).toBeVisible();
  await page.screenshot({ path: "../../docs/screenshots/discovery-desktop.png", fullPage: true });
  await cards.first().getByText("Why this match?", { exact: true }).click();
  await expect(cards.first().getByText(/Documented essential coverage:/)).toBeVisible();
  await cards.first().getByText("Occupation & matching-skill sources", { exact: false }).click();
  await expect(cards.first().getByRole("link").first()).toHaveAttribute("href", /selectedVersion=v1.2.1/);
});

test("description toggle uses one element and independent state", async ({ page }) => {
  await page.goto("/"); await match(page); const cards = page.getByTestId("career-card");
  const description = cards.first().getByTestId("role-description"); const original = await description.textContent();
  await expect(description).toHaveCount(1); await expect(description).toHaveClass(/description-clamped/);
  const toggle = cards.first().getByRole("button", { name: /Read more/ });
  await toggle.focus(); await page.keyboard.press("Enter");
  await expect(cards.first().getByRole("button", { name: /Show less/ })).toHaveAttribute("aria-expanded", "true");
  await expect(description).toHaveCount(1); expect(await description.textContent()).toEqual(original);
  await expect(description).not.toHaveClass(/description-clamped/);
  if (await cards.count() > 1) await expect(cards.nth(1).getByRole("button", { name: /Read more/ })).toHaveAttribute("aria-expanded", "false");
  await cards.first().getByRole("button", { name: /Show less/ }).click(); await expect(description).toHaveClass(/description-clamped/);
});

test("variable counts, pagination and server-side role search", async ({ page }) => {
  const keyErrors: string[] = [];
  page.on("console", m => { if (m.type() === "error" && m.text().includes("same key")) keyErrors.push(m.text()); });
  await page.goto("/"); const result = await match(page); const cards = page.getByTestId("career-card");
  if (result.next_offset !== null) {
    const response = page.waitForResponse(r => r.url().endsWith("/api/v2/matches"));
    await page.getByRole("button", { name: "Show more qualifying roles" }).click();
    const next: DiscoveryResponse = await (await response).json(); await expect(cards).toHaveCount(result.results.length + next.results.length);
  }
  await page.getByLabel("Search occupations").fill(result.results[0].role_title);
  await page.getByRole("button", { name: "Search roles", exact: true }).click();
  await expect(cards.first().getByRole("heading")).toHaveText(new RegExp(result.results[0].role_title, "i"));
  await page.getByLabel("Synthetic profile").selectOption("demo-graduate-c");
  const single = await match(page); expect(single.total_qualifying_roles).toBe(0);
  await expect(cards).toHaveCount(0); await expect(page.getByRole("heading", { name: "Add more specific skills" })).toBeVisible();
  expect(keyErrors).toEqual([]);
});

test("compact sourced areas and no matching market or full-requirements UI", async ({ page }) => {
  await page.goto("/"); await match(page);
  await expect(page.getByText(/Market outlook/i)).toHaveCount(0);
  await expect(page.getByLabel("Market context")).toHaveCount(0);
  await expect(page.getByText(/View all documented requirements/i)).toHaveCount(0);
  const cards = page.getByTestId("career-card");
  for (const card of await cards.all()) {
    expect(await card.locator(".strength-chips .positive").count()).toBeLessThanOrEqual(3);
    expect(await card.locator(".development-area").count()).toBeLessThanOrEqual(5);
    await expect(card.getByRole("progressbar")).toHaveAttribute("aria-label", /not readiness/);
  }
  const footer = page.getByTestId("scoring-footer"); await expect(footer).not.toHaveAttribute("open", "");
  expect(await cards.last().evaluate((n, f) => !!(n.compareDocumentPosition(f as Node) & Node.DOCUMENT_POSITION_FOLLOWING), await footer.elementHandle())).toBe(true);
  const area = cards.first().locator(".development-area").first(); await area.locator(":scope > summary").click();
  await area.getByText("Source for this area", { exact: false }).click();
  await expect(area.getByRole("link").first()).toHaveAttribute("href", /^https:\/\/ec.europa.eu\/esco\/api\//);
  await page.screenshot({ path: "../../docs/screenshots/discovery-evidence.png", fullPage: true });
});

test("unknown terms and empty intake remain honest", async ({ page }) => {
  await page.goto("/"); await page.getByText("Add unresolved skills or interests").click();
  await page.getByLabel("Unresolved skills (comma separated)").fill("unreviewed typo"); await match(page);
  await expect(page.getByText("Unresolved skills, excluded from scoring: unreviewed typo")).toBeVisible();
  const remove = page.getByRole("button", { name: /^Remove / }); const count = await remove.count();
  for (let i=0; i<count; i++) await remove.first().click();
  await expect(page.getByRole("button", { name: "Find matching roles" })).toBeDisabled();
  await expect(page.getByTestId("career-card")).toHaveCount(0);
});

test("bootstrap failure is recoverable", async ({ page }) => {
  await page.route("**/api/v2/bootstrap", r => r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "Reference data unavailable" }) }));
  await page.goto("/"); await expect(page.getByRole("alert").filter({ hasText: "Reference data unavailable" })).toBeVisible();
  await page.unroute("**/api/v2/bootstrap"); await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByLabel("Synthetic profile")).toBeVisible();
});

test("new discovered occupation hands off to unchanged pathways", async ({ page, request }) => {
  const original = new Set((await (await request.get("/api/bootstrap")).json()).roles.map((r: {role_id:string}) => r.role_id));
  const result: DiscoveryResponse = await (await request.post("/api/v2/matches", { data: { schema_version: "2.0", profile: boot.profiles[0], page_size:25 } })).json();
  const selected = result.results.find(r => !original.has(r.role_id)); expect(selected).toBeTruthy();
  await page.goto("/"); await match(page);
  await page.getByLabel("Search occupations").fill(selected!.role_title); await page.getByRole("button", { name: "Search roles", exact:true }).click();
  const pathResponse = page.waitForResponse(r => r.url().endsWith("/api/pathways"));
  await page.getByTestId("career-card").first().getByRole("button", { name:"Explore pathway" }).click();
  const response = await pathResponse; expect(response.ok()).toBeTruthy(); const pathway = await response.json();
  expect(pathway.role_id).toBe(selected!.role_id);
  await expect(page.getByTestId("pathway-view").getByRole("heading", { name:selected!.role_title, exact:true })).toBeVisible();
  if (pathway.uncovered_skill_ids.length) await expect(page.getByTestId("pathway-view").getByText("Incomplete", { exact:true })).toBeVisible();
  await page.screenshot({ path:"../../docs/screenshots/discovery-pathway-handoff.png", fullPage:true });
});

test("mobile matching, pathway and skill search", async ({ page }) => {
  await page.setViewportSize({ width:390,height:844 }); await page.goto("/"); await match(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:"../../docs/screenshots/discovery-mobile.png",fullPage:true});
  await page.getByTestId("career-card").first().getByRole("button",{name:"Explore pathway"}).click();
  await expect(page.getByTestId("pathway-view")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel("Skills & knowledge").fill("Python");
  await expect(page.locator(".skill-picker").getByRole("button",{name:"Python (computer programming)",exact:true})).toBeVisible();
});

test("profile edits cancel late matching responses", async ({ page }) => {
  let release!:()=>void, arrived!:()=>void; const gate=new Promise<void>(r=>{release=r;});const sent=new Promise<void>(r=>{arrived=r;});
  await page.route("**/api/v2/matches",async route=>{const response=await route.fetch();arrived();await gate;await route.fulfill({response}).catch(()=>{});});
  await page.goto("/"); await page.getByRole("button",{name:"Find matching roles"}).click();await sent;
  await page.getByLabel("Synthetic profile").selectOption("demo-graduate-c");release();
  await expect(page.getByTestId("career-card")).toHaveCount(0);
  await page.unroute("**/api/v2/matches");await match(page);await expect(page.getByRole("heading",{name:"Add more specific skills"})).toBeVisible();
});

test("scenario context is retained without changing relevance", async ({ page, request }) => {
  const baseline:DiscoveryResponse=await(await request.post("/api/v2/matches",{data:{schema_version:"2.0",profile:boot.profiles[0]}})).json();
  await page.route("**/api/v2/matches",async route=>{const payload=route.request().postDataJSON();const response=await route.fetch({postData:JSON.stringify({...payload,scenario_config:{schema_version:"1.0",scenario_id:"moderate",version:"test",is_synthetic:true,display_label:"Illustrative scenario",assumptions:[],model_method:"not-yet-defined",source_ids:["demo:fixture:001"],disclaimer:"Not a validated forecast"}})});await route.fulfill({response});});
  await page.goto("/");await match(page);await expect(page.getByRole("heading",{name:"Illustrative scenario"})).toBeVisible();
  await expect(page.getByTestId("career-card").first().locator(".score strong")).toHaveText(`${baseline.results[0].score.profile_relevance_pct!.toFixed(2)}%`);
});

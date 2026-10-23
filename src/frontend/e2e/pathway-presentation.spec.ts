import { expect, test } from "@playwright/test";
import { openDetails, openMatches } from "./role-helpers";

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test(`connected pathway omits unsupported metadata and wraps at ${viewport.width}px`, async ({ page }, testInfo) => {
    test.setTimeout(75_000);
    await page.setViewportSize(viewport);
    await openMatches(page); await openDetails(page);
    let responseData: any;
    const longTitle = "Fictional presentation fixture: " + "LongResourceNameWithoutSpaces".repeat(5);
    await page.route("**/api/pathways", async route => {
      const response = await route.fetch();
      const data = await response.json();
      const first = data.phases.flatMap((p: any) => p.resources)[0];
      expect(first).toBeTruthy();
      Object.assign(first, { title: longTitle, resource_type: "unrecognised", provider: "", time_estimate: null,
        duration_hours: null, cost_status: "unknown", cost: null, prerequisite_status: "unknown",
        prerequisite_notes: "Not confirmed", access_notes: "Price not confirmed" });
      responseData = data;
      await route.fulfill({ response, json: data });
    });
    await page.getByRole("link", { name: /Explore Pathway/ }).click();
    const pathway = page.getByTestId("pathway-view");
    await expect(pathway).toBeVisible();
    await expect(pathway.locator(".pathway-hero h2")).toHaveText(responseData.role_title);
    await expect(pathway.locator(".pathway-metrics strong").nth(0)).toHaveText(String(responseData.target_skill_ids.length));
    await expect(page.getByTestId("discovery-notice")).toHaveText(responseData.discovery_message);
    await expect(page.getByText("Pathway method, scheduling & limitations", { exact: true })).toHaveCount(0);
    const numbers = pathway.locator(".pathway-timeline .phase-number");
    const phases = responseData.phases.filter((p: any) => p.phase_kind !== "remaining_gaps");
    await expect(numbers).toHaveText([...phases.map((p: any) => String(p.order).padStart(2, "0")), String(phases.length+1).padStart(2, "0")]);
    const timeline = pathway.locator(".pathway-timeline");
    const checkAlignment = async () => {
      const lineX = await timeline.evaluate(el => {const s = getComputedStyle(el, "::before"); return el.getBoundingClientRect().x + parseFloat(s.left) + parseFloat(s.width)/2;});
      const centres = await numbers.evaluateAll(nodes => nodes.map(n => { const r = n.getBoundingClientRect(); return r.x+r.width/2; }));
      expect(centres.every(x => Math.abs(x-lineX)<1)).toBeTruthy();
    };
    await checkAlignment();
    const first = pathway.locator(".pathway-resource").first();
    await expect(first).toHaveAttribute("data-resource-icon", "book");
    await expect(first.getByRole("heading")).toHaveText(longTitle + " ↗");
    await expect(first.locator(".badge,.resource-duration")).toHaveCount(0);
    await expect(first.locator(".prerequisite-hint").filter({hasText: /^Prerequisites:/})).toHaveCount(0);
    await expect(pathway.locator(".pathway-resource details")).toHaveCount(0);
    await expect(first).not.toContainText(/Cost unknown|Time unavailable|Not confirmed|Beginner|Intermediate|Video/);
    const phaseEvidence = pathway.locator(".phase-list .phase-content > details").first();
    await phaseEvidence.locator("summary").first().click();
    await checkAlignment();
    await phaseEvidence.locator("summary").first().click();
    const layout = await first.evaluate(el => {const s = getComputedStyle(el);const title = el.querySelector("h4")!;return {padding:parseFloat(s.paddingTop), fits: title.scrollWidth<=title.clientWidth+1 && title.scrollHeight<=title.clientHeight+1};});
    expect(layout.padding).toBeGreaterThanOrEqual(viewport.width < 680 ? 16 : 20);
    expect(layout.fits).toBeTruthy();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await expect(page.getByRole("link", { name: /Back to Career Details/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Back to matching roles/ })).toHaveCount(0);
    await expect(pathway.getByText("Incomplete", {exact: true})).toHaveCount(0);
    await expect(pathway.getByText(/Remaining Learning Gaps|No eligible verified route for/)).toHaveCount(0);
    await pathway.screenshot({ path: testInfo.outputPath("pathway.png") });
  });
}

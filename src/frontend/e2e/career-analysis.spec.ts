import { expect, test } from "@playwright/test";
import { openDetails, openMatches } from "./role-helpers";
import { displaySkillLabel } from "../lib/career-display";
import type { CareerAnalysis } from "../lib/career-analysis";

for (const viewport of [{ width: 1280, height: 900 }, { width: 780, height: 900 }, { width: 390, height: 844 }]) {
  test(`career evidence is progressive, accessible and full width at ${viewport.width}px`, async ({ page }, testInfo) => {
    test.setTimeout(75_000);
    await page.setViewportSize(viewport);
    let aiCalls = 0;
    let roleEvidence: CareerAnalysis | null = null;
    const duplicateKeys: string[] = [];
    page.on("console", message => { if (message.text().includes("same key")) duplicateKeys.push(message.text()); });
    await page.route("**/api/v2/roles/analysis", async route => {
      const payload = route.request().postDataJSON();
      // Always fetch deterministic evidence; mocked interpretation never uses providers.
      const response = await route.fetch({ postData: JSON.stringify({ ...payload, generate_ai: false }) });
      const data = await response.json() as CareerAnalysis;
      if (!payload.generate_ai) roleEvidence = data;
      if (payload.generate_ai) {
        aiCalls++;
        await new Promise(resolve => setTimeout(resolve, 400));
        data.status = "ready";
        data.message = "Mocked AI interpretation for browser verification.";
        data.interpretations = data.groups.slice(0, 5).map(g => ({ group_id: g.group_id,
          why_relevant: "This area may support exploring the documented occupation requirements.", evidence_ids: [data.evidence[1].evidence_id] }));
        if (data.matched.length) data.bridges = data.groups.slice(0, 3).map((g, i) => ({ matched_skill_ids: [data.matched[i % data.matched.length].skill_id],
          target_group_id: g.group_id, explanation: "Your recognised skills could support learning this capability.", evidence_ids: [data.evidence[1].evidence_id] }));
      }
      await route.fulfill({ response, json: data });
    });
    const results = await openMatches(page);
    expect(aiCalls).toBe(0);
    const detail = await openDetails(page);
    await expect(page.getByRole("progressbar")).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Not Evidenced/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab")).toHaveCount(2);
    await expect(page.locator(".gap-capability")).toHaveCount(4);
    const tiles = page.getByRole("tabpanel").locator(".matrix-capability");
    await expect(tiles).toHaveCount(4);
    await expect(page.getByText("View Source Skills", { exact: true })).toHaveCount(0);
    await expect(tiles.locator("summary,button,a,.concept-count")).toHaveCount(0);
    await expect(tiles.locator(".matrix-concept-label")).toHaveText(["Concepts:", "Concepts:", "Concepts:", "Concepts:"]);
    const sectionSource = page.getByRole("link", {name: "Source: ESCO Occupational Skills ↗"});
    await expect(sectionSource).toHaveCount(1);
    const sourceUrl = await sectionSource.getAttribute("href");
    expect(detail.sources.some((s: {url: string | null}) => s.url === sourceUrl) || sourceUrl === detail.role.role_id).toBeTruthy();
    expect(sourceUrl).toMatch(/^https?:\/\/(?:data.europa.eu|ec.europa.eu)\//);
    await expect(page.getByTestId("scoring-footer")).toHaveCount(0);
    await expect(page.locator(".radial-note")).toBeVisible();
    await page.getByRole("button", { name: /Explore .* More Capability Groups/ }).click();
    await expect(tiles).toHaveCount(8);
    await expect(page.getByText("Potential Learning Connection", { exact: false }).first()).toBeVisible();
    await expect(page.locator(".bridge-capability")).toHaveCount(3);
    const missing = page.getByRole("tab", { name: /^Not Evidenced/ });
    await missing.focus(); await missing.press("ArrowLeft");
    await expect(page.getByRole("tab", { name: /^Matched/ })).toBeFocused();
    await expect(page.getByRole("tab", { name: /^Matched/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel").locator("summary,button,a,.concept-count")).toHaveCount(0);
    await expect(page.getByRole("tabpanel").locator(".matrix-concept-label")).toHaveCount(Math.min(4, (roleEvidence as unknown as CareerAnalysis).matched.length));
    await page.getByRole("tab", { name: /^Matched/ }).press("End");
    await expect(missing).toHaveAttribute("aria-selected", "true");
    const evidence = roleEvidence as unknown as CareerAnalysis;
    const representatives = evidence.groups.flatMap((g, i) => g.concepts.slice(0, 2).map(c => ({name: c.name, index: i})));
    const longest = representatives.sort((a, b) => b.name.length-a.name.length)[0];
    expect(longest.name.length).toBeGreaterThan(40);
    let revealed = 8;
    while (revealed <= longest.index) {
      await page.getByRole("button", { name: /Explore .* More Capability Groups/ }).click();
      revealed += 4;
    }
    const longChip = page.getByRole("tabpanel").locator(".chip").filter({hasText: displaySkillLabel(longest.name)}).first();
    await expect(longChip).toHaveText(displaySkillLabel(longest.name));
    const wrapping = await longChip.evaluate(node => {const s = getComputedStyle(node);return {overflow:s.overflow, clamp:s.webkitLineClamp, whitespace:s.whiteSpace, fits:node.scrollHeight<=node.clientHeight+1 && node.scrollWidth<=node.clientWidth+1};});
    expect(wrapping.overflow).not.toBe("hidden");
    expect(wrapping.clamp).toBe("none");
    expect(wrapping.whitespace).toBe("normal");
    expect(wrapping.fits).toBeTruthy();
    expect(aiCalls).toBe(1);
    expect(duplicateKeys).toEqual([]);
    const cards = page.locator(".career-analysis-stack > .career-analysis-card");
    await expect(cards).toHaveCount(3);
    const boxes = await cards.evaluateAll(nodes => nodes.map(n => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, bottom: r.bottom }; }));
    expect(boxes[1].y).toBeGreaterThan(boxes[0].bottom);
    expect(boxes[2].y).toBeGreaterThan(boxes[1].bottom);
    expect(boxes[1].width).toBe(boxes[0].width);
    const miniBoxes = await page.locator(".gap-capability").evaluateAll(nodes => nodes.map(n => {const r = n.getBoundingClientRect(); return {x:r.x,y:r.y};}));
    if (viewport.width >= 1100) expect(miniBoxes.every(b => Math.abs(b.y-miniBoxes[0].y)<1)).toBeTruthy();
    else if (viewport.width < 680) expect(miniBoxes[1].y).toBeGreaterThan(miniBoxes[0].y);
    else { expect(miniBoxes[1].y).toBe(miniBoxes[0].y); expect(miniBoxes[2].y).toBeGreaterThan(miniBoxes[0].y); }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: testInfo.outputPath("career-analysis.png"), fullPage: true });
    await expect(page.getByRole("link", { name: /Explore Pathway/ })).toBeEnabled();
    expect(results.results[0].role_id).toBeTruthy();
  });
}

test("missing AI keeps the ESCO matrix and overview usable", async ({ page }) => {
  await openMatches(page);
  await openDetails(page);
  await expect(page.getByText("AI analysis unavailable · Showing ESCO source skills")).toBeVisible();
  await expect(page.getByRole("progressbar")).toBeVisible();
  await expect(page.getByRole("tab", { name: /^Not Evidenced/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab")).toHaveCount(2);
  await expect(page.getByRole("heading", {name: "AI Skill Connections Aren't Available Yet"})).toBeVisible();
  await expect(page.getByRole("link", { name: /Explore Pathway/ })).toBeEnabled();
});

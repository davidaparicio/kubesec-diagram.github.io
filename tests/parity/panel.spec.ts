import { test, expect, openDiagram, settle, uiState, imageTransform, expectRecorded, round, VIEWPORTS, sel, within } from "./fixtures";

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`panel ${name}`, () => {
    test.use({ viewport });

    test("open, layout and close", async ({ page }) => {
      await openDiagram(page);
      const imageBox = () => page.locator("#main-image, .dwk-main-image").boundingBox();
      const before = await imageBox();
      await page.locator(sel("floating-filter-toggle")).click();
      await settle(page, 600);
      const open = await uiState(page);
      const openTransform = round(await imageTransform(page));
      const afterOpen = await imageBox();
      const panelBox = await page.locator(sel("filter-panel")).boundingBox();
      if (open.overlay) {
        await page.mouse.click(5, viewport.height / 2);
      } else {
        await page.locator(sel("close-filter-panel")).click();
      }
      await settle(page, 600);
      // Deliberate difference: prod shifts the diagram left while the docked
      // panel opens; here the panel slides over it and the picture stays put.
      const slidesOver = test.info().project.name !== "reference" && open.docked;
      if (slidesOver) {
        (["x", "y", "width", "height"] as const).forEach((key) => expect(Math.abs(afterOpen![key] - before![key])).toBeLessThanOrEqual(1));
      }
      expectRecorded(
        `panel-${name}`,
        { open, openTransform, panelWidth: panelBox ? Math.round(panelBox.width) : null, closed: await uiState(page) },
        { omit: slidesOver ? ["openTransform"] : [] },
      );
    });
  });
}

test.describe("panel content", () => {
  test.use({ viewport: VIEWPORTS.desktop });

  test("results, tag tree and pins", async ({ page }) => {
    await openDiagram(page, "?menu=true&tags=open&pins=Rbac");
    await settle(page, 600);
    const summary = await page.locator(sel("filter-result-count")).textContent();
    const pinnedTitle = await page.locator(".pinned-results-header strong").textContent();
    const firstResults = await page.locator(within("filter-results", ".filter-result-head strong")).allTextContents();
    const treeMeta = await page.locator(".tag-tree-header .tag-tree-meta").textContent();
    const levelValue = await page.locator(".level-filter-value").textContent();

    await page.locator(sel("filter-search-input")).fill("etcd");
    await settle(page, 300);
    const filteredSummary = await page.locator(sel("filter-result-count")).textContent();

    await page.locator(".level-filter-slider").fill("1");
    await settle(page, 300);
    const levelSummary = await page.locator(sel("filter-result-count")).textContent();
    const hiddenReason = await page.locator(".filter-result-state").allTextContents();

    await page.locator(sel("filter-reset-btn")).click();
    await settle(page, 300);
    expect(await page.locator(sel("filter-search-input")).inputValue()).toBe("");

    expectRecorded("panel-content", {
      summary,
      pinnedTitle,
      firstResults: firstResults.slice(0, 12),
      resultCount: firstResults.length,
      treeMeta,
      levelValue,
      filteredSummary,
      levelSummary,
      hiddenReason,
    });
  });
});

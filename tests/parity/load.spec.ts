import { test, expect, openDiagram, visibleTaggedCount, uiState, expectRecorded, VIEWPORTS, sel, within, helpPanel } from "./fixtures";

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`load ${name}`, () => {
    test.use({ viewport });

    test("loads without console errors", async ({ page, consoleErrors }) => {
      await openDiagram(page);
      expect(consoleErrors).toEqual([]);
      await expect(page).toHaveTitle("kubesec-diagram");
      expectRecorded(`load-${name}`, {
        visibleTagged: await visibleTaggedCount(page),
        helpCount: await page.locator(within("main-image", "[data-help]")).count(),
        ui: await uiState(page),
      });
    });
  });
}

test.describe("about modal", () => {
  test.use({ seenAbout: false, viewport: VIEWPORTS.desktop });

  test("first bare visit shows about once", async ({ page }) => {
    await openDiagram(page);
    await expect(page.locator(helpPanel("about-modal"))).toBeVisible();
    expect((await uiState(page)).modalLocked).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.locator(helpPanel("about-modal"))).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem("kubesec-about"))).toBe("seen");
    await openDiagram(page);
    await expect(page.locator(helpPanel("about-modal"))).toBeHidden();
  });

  test("a link with parameters never shows about", async ({ page }) => {
    await openDiagram(page, "?menu=true");
    await expect(page.locator(helpPanel("about-modal"))).toBeHidden();
  });
});

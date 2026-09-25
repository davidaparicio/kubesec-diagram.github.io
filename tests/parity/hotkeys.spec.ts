import { test, expect, openDiagram, settle, uiState, imageTransform, expectRecorded, round, VIEWPORTS, sel, within, helpPanel } from "./fixtures";

test.use({ viewport: VIEWPORTS.desktop });

test("pan and zoom keys", async ({ page }) => {
  await openDiagram(page);
  await page.keyboard.press("+");
  await settle(page);
  const steps: Record<string, number[]> = { plus: round(await imageTransform(page)) };
  await page.keyboard.press("=");
  await settle(page);
  steps.equals = round(await imageTransform(page));
  for (const key of ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown", "Shift+ArrowLeft", "Shift+ArrowUp"]) {
    await page.keyboard.press(key);
    await settle(page);
    steps[key] = round(await imageTransform(page));
  }
  await page.keyboard.press("-");
  await settle(page);
  steps.minus = round(await imageTransform(page));
  await page.keyboard.press("_");
  await settle(page);
  steps.underscore = round(await imageTransform(page));
  await page.keyboard.press("0");
  await settle(page);
  steps.zero = round(await imageTransform(page));
  expect((await uiState(page)).fitAll).toBe(true);
  expectRecorded("hotkeys-camera", steps);
});

test("slash opens the panel and focuses search", async ({ page }) => {
  await openDiagram(page);
  await page.keyboard.press("/");
  await settle(page);
  expect((await uiState(page)).panelOpen).toBe(true);
  await expect(page.locator(sel("filter-search-input"))).toBeFocused();
  await page.keyboard.type("net");
  await page.keyboard.press("Escape");
  await settle(page);
  await expect(page.locator(sel("filter-search-input"))).toHaveValue("net");
  expect((await uiState(page)).panelOpen).toBe(false);
});

test("question mark toggles the shortcut modal", async ({ page }) => {
  await openDiagram(page, "?menu=true&pins=Rbac");
  await page.locator(sel("filter-search-input")).blur();
  await page.keyboard.press("?");
  await expect(page.locator(helpPanel("shortcut-modal"))).toBeVisible();
  expect((await uiState(page)).modalLocked).toBe(true);
  const before = await imageTransform(page);
  await page.keyboard.press("ArrowLeft");
  await settle(page);
  expect(await imageTransform(page)).toEqual(before);
  const variants = await page.locator(within("link-info-variants", ".link-info-link strong")).allTextContents();
  const params = await page.locator(within("link-info-params", ".link-info-param-name")).allTextContents();
  expectRecorded("hotkeys-link-info", { variants, params });
  // One Escape closes both the modal and the panel in prod.
  await page.keyboard.press("Escape");
  await settle(page);
  await expect(page.locator(helpPanel("shortcut-modal"))).toBeHidden();
  expect((await uiState(page)).panelOpen).toBe(false);
});

test("keys are ignored while typing or with modifiers", async ({ page }) => {
  await openDiagram(page, "?menu=true");
  await settle(page);
  const before = await imageTransform(page);
  await page.locator(sel("filter-search-input")).focus();
  await page.keyboard.press("0");
  await page.keyboard.press("+");
  await settle(page);
  expect(await imageTransform(page)).toEqual(before);
  await page.locator(sel("filter-search-input")).blur();
  await page.keyboard.press("Control+0");
  await settle(page);
  expect((await uiState(page)).fitAll).toBe(false);
});

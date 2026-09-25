import {
  test,
  expect,
  openDiagram,
  settle,
  search,
  uiState,
  imageTransform,
  screenPointInSvg,
  svgPointOnScreen,
  expectRecorded,
  round,
  VIEWPORTS,
} from "./fixtures";

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`camera ${name}`, () => {
    test.use({ viewport });

    test("default view", async ({ page }) => {
      await openDiagram(page);
      expectRecorded(`camera-default-${name}`, round(await imageTransform(page)));
    });

    test("wheel zoom keeps the point under the pointer", async ({ page }) => {
      await openDiagram(page);
      const pointer = { x: Math.round(viewport.width * 0.4), y: Math.round(viewport.height * 0.45) };
      const anchor = await screenPointInSvg(page, pointer.x, pointer.y);
      await page.mouse.move(pointer.x, pointer.y);
      for (let step = 0; step < 4; step += 1) {
        await page.mouse.wheel(0, -120);
        await settle(page, 30);
      }
      await settle(page);
      const after = await svgPointOnScreen(page, anchor!.x, anchor!.y);
      expect(Math.abs(after!.x - pointer.x)).toBeLessThanOrEqual(2);
      expect(Math.abs(after!.y - pointer.y)).toBeLessThanOrEqual(2);
      expectRecorded(`camera-wheel-in-${name}`, round(await imageTransform(page)));
    });

    test("min zoom equals fit-all", async ({ page }) => {
      await openDiagram(page);
      await page.keyboard.press("0");
      await settle(page);
      expect((await uiState(page)).fitAll).toBe(true);
      const fit = await imageTransform(page);
      const fitBox = await page.locator("#main-image svg, .dwk-main-image svg").boundingBox();
      expectRecorded(`camera-fit-${name}`, round(fit));

      await openDiagram(page);
      await page.mouse.move(viewport.width / 2, viewport.height / 2);
      for (let step = 0; step < 12; step += 1) {
        await page.mouse.wheel(0, 400);
        await settle(page, 20);
      }
      await settle(page, 600);
      const zoomedOut = await imageTransform(page);
      const outBox = await page.locator("#main-image svg, .dwk-main-image svg").boundingBox();
      expect(Math.abs(outBox!.width - fitBox!.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(outBox!.height - fitBox!.height)).toBeLessThanOrEqual(1);
      expect(await search(page)).toBe("?v=fit");
      expectRecorded(`camera-wheel-out-${name}`, round(zoomedOut));
    });

    test("pan clamps at the edges", async ({ page }) => {
      await openDiagram(page);
      const center = { x: viewport.width / 2, y: viewport.height / 2 };
      await page.mouse.move(center.x, center.y);
      await page.mouse.down();
      await page.mouse.move(center.x + 4000, center.y + 4000, { steps: 8 });
      await page.mouse.up();
      await settle(page);
      const topLeft = await imageTransform(page);
      await page.mouse.move(center.x, center.y);
      await page.mouse.down();
      await page.mouse.move(center.x - 8000, center.y - 8000, { steps: 8 });
      await page.mouse.up();
      await settle(page);
      const bottomRight = await imageTransform(page);
      expectRecorded(`camera-clamp-${name}`, { topLeft: round(topLeft), bottomRight: round(bottomRight) });
    });

    test("v= rect restores", async ({ page }) => {
      await openDiagram(page, "?v=0.3,0.6,0.2,0.25");
      expectRecorded(`camera-restore-${name}`, round(await imageTransform(page)));
    });
  });
}

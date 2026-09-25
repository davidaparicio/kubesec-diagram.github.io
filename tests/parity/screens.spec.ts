import { test, expect, openDiagram, settle, VIEWPORTS } from "./fixtures";

const ANNOTATIONS = Buffer.from(
  JSON.stringify([
    { x: 0.3, y: 0.4, type: "user-info", title: "Point", description: "", shape: "rectangle" },
    { x: 0.5, y: 0.5, type: "area-important", title: "Area", description: "", shape: "circle", widthRel: 0.1, heightRel: 0.08 },
    { x: 0.6, y: 0.2, x2: 0.7, y2: 0.3, type: "arrow-info", title: "", description: "" },
  ]),
  "utf8",
).toString("base64");

const SCREENS: Record<string, string> = {
  default: "",
  fit: "?v=fit",
  pin: "?pins=Rbac",
  level0: "?filter-level=0",
  annotations: `?annotations=${encodeURIComponent(ANNOTATIONS)}`,
  panel: "?menu=true&tags=open",
};

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`screens ${name}`, () => {
    test.use({ viewport });

    for (const [screen, input] of Object.entries(SCREENS)) {
      test(screen, async ({ page }) => {
        await openDiagram(page, input);
        await settle(page, 1500);
        // Prod's docked panel animates the diagram on load with frame-dependent
        // timing; the resulting transform is covered by panel.spec.ts.
        const mask = screen === "panel" ? [page.locator("#image-wrapper, .dwk-image-wrapper")] : [];
        await expect(page).toHaveScreenshot(`${name}-${screen}.png`, { mask });
      });
    }

    test("dark", async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem("kubesec-theme", "dark"));
      await openDiagram(page);
      await settle(page, 800);
      await expect(page).toHaveScreenshot(`${name}-dark.png`);
    });
  });
}

import { test, expect, openDiagram, settle, search, uiState, visibleTaggedCount, expectRecorded, VIEWPORTS, sel } from "./fixtures";

const ANNOTATIONS = Buffer.from(
  JSON.stringify([
    { x: 0.3, y: 0.4, type: "user-info", title: "Point", description: "<b>hi</b>", shape: "rectangle" },
    { x: 0.5, y: 0.5, type: "area-important", title: "Area", description: "", shape: "circle", widthRel: 0.1, heightRel: 0.08 },
    { x: 0.6, y: 0.2, x2: 0.7, y2: 0.3, type: "arrow-info", title: "", description: "" },
  ]),
  "utf8",
).toString("base64");

const CASES: Record<string, string> = {
  menu: "?menu=true",
  menuFalse: "?menu=false",
  query: "?filter-query=rbac",
  queryMenu: "?filter-query=rbac&menu=true",
  hideTags: "?filter-hide-tags=Network,Api.Rbac",
  hideTagsAncestor: "?filter-hide-tags=Network.Egress,Network",
  hideTagsEmpty: "?filter-hide-tags=",
  pins: "?pins=Rbac",
  pinsInvalid: "?pins=Nope,Rbac,KubeApi",
  level1: "?filter-level=1",
  level0: "?filter-level=0",
  levelMax: "?filter-level=3",
  levelTooHigh: "?filter-level=9",
  tagsOpen: "?tags=open",
  viewportFit: "?v=fit",
  viewportZero: "?v=0",
  viewportRect: "?v=0.5,0.5,0.2,0.2",
  viewportBad: "?v=2,2,2,2",
  annotations: `?annotations=${encodeURIComponent(ANNOTATIONS)}`,
  unknown: "?foo=bar&menu=true",
  combined: "?menu=true&filter-query=api&filter-hide-tags=Logging&pins=KubeApi&filter-level=2&tags=open&v=0.4,0.6,0.3,0.3",
};

test.use({ viewport: VIEWPORTS.desktop });

for (const [name, input] of Object.entries(CASES)) {
  test(`url round trip: ${name}`, async ({ page }) => {
    await openDiagram(page, input);
    await settle(page, 600);
    expectRecorded(`url-${name}`, {
      search: await search(page),
      visibleTagged: await visibleTaggedCount(page),
      ui: await uiState(page),
      searchValue: await page.locator(sel("filter-search-input")).inputValue(),
    });
  });
}

test("interaction writes the URL", async ({ page }) => {
  await openDiagram(page);
  const steps: Record<string, string> = {};

  await page.locator(sel("floating-filter-toggle")).click();
  await settle(page, 500);
  steps.open = await search(page);

  await page.locator(sel("filter-search-input")).fill("tls");
  await settle(page, 500);
  steps.query = await search(page);

  await page.locator(sel("filter-search-input")).fill("");
  await page.locator(sel("close-filter-panel")).click();
  await settle(page, 500);
  steps.closed = await search(page);

  await page.mouse.move(500, 400);
  await page.mouse.wheel(0, -300);
  await settle(page, 700);
  steps.zoomed = (await search(page)).replace(/v=[^&]+/, "v=RECT");

  expectRecorded("url-interaction", steps);
});

test("incoming v= survives startup writes until the view moves", async ({ page }) => {
  await openDiagram(page, "?v=0.5,0.5,0.2,0.2&menu=true");
  await settle(page, 600);
  expect(await search(page)).toContain("v=0.5,0.5,0.2,0.2");
  await page.locator(sel("filter-search-input")).fill("api");
  await settle(page, 600);
  expect(await search(page)).toContain("v=0.5,0.5,0.2,0.2");
});

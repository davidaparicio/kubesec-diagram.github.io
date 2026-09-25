import { test, openDiagram, visibleTaggedCount, expectRecorded, VIEWPORTS, settle } from "./fixtures";

const COMBOS: Record<string, string> = {
  all: "",
  level0: "?filter-level=0",
  level1: "?filter-level=1",
  level2: "?filter-level=2",
  hideNetwork: "?filter-hide-tags=Network",
  hideLeaf: "?filter-hide-tags=Network.Egress.Gateway",
  hidePriority: "?filter-hide-tags=pri-1,pri-2,pri-3,info",
  hideMany: "?filter-hide-tags=Api,Logging,SupplyChain&filter-level=2",
  query: "?filter-query=rbac",
};

test.use({ viewport: VIEWPORTS.desktop });

for (const [name, input] of Object.entries(COMBOS)) {
  test(`visible tagged elements: ${name}`, async ({ page }) => {
    await openDiagram(page, input);
    await settle(page, 300);
    expectRecorded(`count-${name}`, await visibleTaggedCount(page));
  });
}

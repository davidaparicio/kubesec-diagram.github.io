import { test as base, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
export const REFERENCE_SVG = path.join(here, ".reference", "kubesec-diagram.svg");

export const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
} as const;

// Prod uses ids, webkit uses scoped classes; one selector matches both.
export function sel(name: string): string {
  return `#${name}, .dwk-${name}`;
}

// Prod's about and shortcut modals are tabs of one help dialog here; the
// tab's panel is visible exactly when prod's modal would be.
export function helpPanel(prodModal: "about-modal" | "shortcut-modal"): string {
  const tab = prodModal === "about-modal" ? "about" : "shortcuts";
  return `#${prodModal}, .dwk-help-panel-${tab}`;
}

// Descendants of a named element in either implementation.
export function within(name: string, selector: string): string {
  return `#${name} ${selector}, .dwk-${name} ${selector}`;
}

type Fixtures = { consoleErrors: string[]; seenAbout: boolean };

export const test = base.extend<Fixtures>({
  seenAbout: [true, { option: true }],
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(String(error)));
    await use(errors);
  },
  page: async ({ page, seenAbout }, use) => {
    const svg = fs.readFileSync(REFERENCE_SVG);
    await page.route(/https:\/\/(raw|media)\.githubusercontent\.com\/.*\.svg$/, (route) =>
      route.fulfill({ contentType: "image/svg+xml", body: svg }),
    );
    if (seenAbout) {
      await page.addInitScript(() => localStorage.setItem("kubesec-about", "seen"));
    }
    await use(page);
  },
});

export { expect };

export async function openDiagram(page: Page, search = ""): Promise<void> {
  await page.goto(`/${search}`);
  await waitForDiagram(page);
}

export async function waitForDiagram(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const svg = document.querySelector("#main-image svg, .dwk-main-image svg");
    const loading = document.querySelector("#loading-indicator, .dwk-loading");
    const image = document.querySelector<HTMLElement>("#main-image, .dwk-main-image");
    return Boolean(svg && !loading && image && image.style.transform);
  });
  await settle(page);
}

export async function settle(page: Page, ms = 150): Promise<void> {
  await page.evaluate(
    (delay) =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, delay))),
      ),
    ms,
  );
}

export async function search(page: Page): Promise<string> {
  return page.evaluate(() => `${window.location.search}`);
}

export async function visibleTaggedCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const image = document.querySelector("#main-image, .dwk-main-image");
    if (!image) return -1;
    return Array.from(image.querySelectorAll<SVGElement>("[data-tags]")).filter(
      (element) => element.style.display !== "none",
    ).length;
  });
}

// State that both implementations expose through the DOM.
export async function uiState(page: Page) {
  return page.evaluate(() => {
    const has = (selector: string) => Boolean(document.querySelector(selector));
    const panel = document.querySelector("#filter-panel, .dwk-filter-panel");
    return {
      panelOpen: Boolean(panel && panel.classList.contains("open")),
      docked: has("body.filter-docked-open, .dwk-root.filter-docked-open"),
      overlay: has("body.filter-overlay-open, .dwk-root.filter-overlay-open"),
      fitAll: has("body.diagram-fit-all, .dwk-root.diagram-fit-all"),
      dark: has("body.theme-dark, .dwk-root[data-theme='dark']"),
      modalLocked: has("body.modal-locks-diagram, .dwk-root.modal-locks-diagram"),
    };
  });
}

export async function imageTransform(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const image = document.querySelector<HTMLElement>("#main-image, .dwk-main-image");
    const match = image ? image.style.transform.match(/matrix\(([^)]+)\)/) : null;
    return match ? match[1].split(",").map((part) => Number.parseFloat(part)) : [];
  });
}

// Screen position of a diagram point given in viewBox units.
export async function svgPointOnScreen(page: Page, x: number, y: number) {
  return page.evaluate(
    ([px, py]) => {
      const svg = document.querySelector<SVGSVGElement>("#main-image svg, .dwk-main-image svg");
      const ctm = svg?.getScreenCTM();
      if (!ctm) return null;
      const point = new DOMPoint(px, py).matrixTransform(ctm);
      return { x: point.x, y: point.y };
    },
    [x, y],
  );
}

export async function screenPointInSvg(page: Page, x: number, y: number) {
  return page.evaluate(
    ([px, py]) => {
      const svg = document.querySelector<SVGSVGElement>("#main-image svg, .dwk-main-image svg");
      const ctm = svg?.getScreenCTM();
      if (!ctm) return null;
      const point = new DOMPoint(px, py).matrixTransform(ctm.inverse());
      return { x: point.x, y: point.y };
    },
    [x, y],
  );
}

const RECORDED_DIR = path.join(here, "recorded");

// Characterization: values are recorded once from the reference
// (PARITY_RECORD=1 --project=reference) and every later run - reference or
// current - must reproduce them.
// options.omit: keys left out of the comparison, for a deliberate, documented
// difference from prod that the test asserts separately.
export function expectRecorded(key: string, value: unknown, options: { omit?: string[] } = {}): void {
  const file = path.join(RECORDED_DIR, `${key}.json`);
  if (process.env.PARITY_RECORD === "1") {
    if (test.info().project.name !== "reference") {
      throw new Error("PARITY_RECORD=1 is only valid for --project=reference");
    }
    fs.mkdirSync(RECORDED_DIR, { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
    return;
  }
  if (!fs.existsSync(file)) {
    throw new Error(`No recorded value for "${key}"; run PARITY_RECORD=1 npm run test:parity -- --project=reference`);
  }
  const drop = (object: unknown) => {
    if (!options.omit || typeof object !== "object" || object === null) return object;
    const copy = { ...(object as Record<string, unknown>) };
    options.omit.forEach((name) => delete copy[name]);
    return copy;
  };
  expect(drop(value), key).toEqual(drop(JSON.parse(fs.readFileSync(file, "utf8"))));
}

export function round(values: number[], decimals = 1): number[] {
  const factor = 10 ** decimals;
  return values.map((value) => Math.round(value * factor) / factor);
}

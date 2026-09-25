import { defineConfig } from "@playwright/test";
import path from "node:path";

// reference: this site before diagram-webkit (setup.sh clones it).
// current: this project's build (setup.sh builds it).
const here = path.dirname(new URL(import.meta.url).pathname);
const origins = [
  { name: "reference", dir: path.join(here, ".reference"), port: 4001 },
  { name: "current", dir: path.join(here, ".current"), port: 4002 },
];

export default defineConfig({
  testDir: here,
  testMatch: "*.spec.ts",
  timeout: 60_000,
  fullyParallel: true,
  reporter: [["list"]],
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFileName}/{arg}{ext}",
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: "disabled" } },
  use: { trace: "retain-on-failure" },
  webServer: origins.map(({ dir, port }) => ({
    command: `node ${here}/serve.mjs ${dir} ${port}`,
    port,
    reuseExistingServer: !process.env.CI,
  })),
  projects: origins.map(({ name, port }) => ({ name, use: { baseURL: `http://127.0.0.1:${port}` } })),
});

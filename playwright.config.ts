import { defineConfig } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const testData = mkdtempSync(join(tmpdir(), "aula-ui-"));
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  testIgnore: "**/pages.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4180",
    launchOptions: {
      executablePath: process.env.AULA_CHROMIUM || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: "mobile",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: "python3 server/app.py",
    url: "http://127.0.0.1:4180/api/health",
    reuseExistingServer: false,
    env: { AULA_PORT: "4180", AULA_DATA_DIR: testData, AULA_LOCAL_MODE: "1" },
  },
});

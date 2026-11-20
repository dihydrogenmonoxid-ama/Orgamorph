import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  // Leistungsmessung nur auf Wunsch (npm run test:perf): auf geteilten CI-Rechnern nicht aussagekräftig
  testIgnore: process.env.PERF ? [] : ["**/perf.spec.ts"],
  timeout: 60_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: { trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
});

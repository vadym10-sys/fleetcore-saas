import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  testDir: "./apps/web/e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "API_PORT=4000 WEB_ORIGIN=http://127.0.0.1:3000 API_PUBLIC_URL=http://127.0.0.1:4000 pnpm --filter @fleetcore/api dev",
      reuseExistingServer: false,
      timeout: 30_000,
      url: "http://127.0.0.1:4000/health",
    },
    {
      command: "PORT=3000 pnpm --filter @fleetcore/web dev",
      reuseExistingServer: false,
      timeout: 30_000,
      url: "http://127.0.0.1:3000",
    },
  ],
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], browserName: "chromium" },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 15"], browserName: "chromium" },
    },
  ],
});

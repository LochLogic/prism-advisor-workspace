import { defineConfig, devices } from '@playwright/test';

// E2E smoke over the demo (no signup, no network): an init script flips on demo
// mode and the app runs entirely client-side. Serves the built _site via the
// dependency-free static server so there's no npx fetch in CI.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'line',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'node scripts/serve.mjs _site 3000',
    url: 'http://localhost:3000/app/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});

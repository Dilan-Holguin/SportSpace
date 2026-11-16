import { defineConfig, devices } from '@playwright/test';

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_WEB_URL ?? 'http://localhost:5173',
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: process.env.E2E_WEB_URL ?? 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  globalSetup: './e2e/global-setup.ts',
  metadata: { apiUrl: API_URL },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});

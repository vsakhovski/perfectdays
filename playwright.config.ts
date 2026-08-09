import { defineConfig, devices } from '@playwright/test';

import { getE2EBaseUrl } from './e2e/runtime-config';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] ? 2 : 0,
  ...(process.env['CI'] ? { workers: 1 } : {}),
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL: getE2EBaseUrl(),
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 15'] } },
  ],
});

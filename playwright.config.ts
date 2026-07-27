import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // tests/unit is vitest territory; importing vitest under the playwright
  // runner crashes the whole suite.
  testIgnore: ['**/unit/**'],
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:2222',
    trace: 'off',
  },
  projects: [
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 13'] },
      grep: /administrator hold replaces|a short tap remains|native mobile menu|captures the touch pointer|iOS Oracle surface|keeps the iPhone reading marker/,
    },
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
  ],
});

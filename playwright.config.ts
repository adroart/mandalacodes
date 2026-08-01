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
    // Narrowest and widest phone/tablet widths a layout has to survive.
    // 320 is where long words and image-bearing grid tracks blow out; 768 is
    // where two-column section heads fail to collapse. Neither failure shows
    // at the Pixel 5's 393, which is why one width was not enough.
    {
      name: 'Mobile 320',
      use: { ...devices['Pixel 5'], viewport: { width: 320, height: 568 } },
    },
    {
      name: 'Tablet 768',
      use: { ...devices['Pixel 5'], viewport: { width: 768, height: 1024 } },
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

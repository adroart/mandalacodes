import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: ['oracle-authoring-app.spec.ts'], workers: 1,
  use: { baseURL: 'http://127.0.0.1:4178' },
  projects: [
    { name: 'iPhone WebKit', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
    { name: 'Desktop Chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: { command: 'npx vite preview --config vite.oracle.config.ts --port 4178 --host 127.0.0.1', url: 'http://127.0.0.1:4178', reuseExistingServer: true },
});

import { defineConfig, devices } from '@playwright/test';
const baseURL = process.env.ORACLE_AUTHORING_PREVIEW_URL ?? 'http://127.0.0.1:4178';
const port = new URL(baseURL).port;
export default defineConfig({
  testDir: './tests', testMatch: ['oracle-authoring-app.spec.ts','oracle-voice-journey.spec.ts','oracle-human-authoring.spec.ts','oracle-passage-authoring.spec.ts','oracle-section-workflow.spec.ts'], workers: 1,
  use: { baseURL },
  projects: [
    { name: 'iPhone WebKit', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
    { name: 'Desktop Chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: { command: `npx vite preview --config vite.oracle.config.ts --port ${port} --host 127.0.0.1 --strictPort`, url: baseURL, reuseExistingServer: true },
});

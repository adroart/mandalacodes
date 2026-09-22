import { defineConfig, devices } from '@playwright/test';

// Run after npm run build: exercises the generated production worker.
export default defineConfig({
  testDir: './tests',
  testMatch: 'pwa-learn.spec.ts',
  reporter: 'list',
  metadata: { pwa: true },
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:2423' },
  webServer: {
    command: 'npx vite preview --host 127.0.0.1 --port 2423 --strictPort',
    url: 'http://127.0.0.1:2423',
    reuseExistingServer: false,
  },
});

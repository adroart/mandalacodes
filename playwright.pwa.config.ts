import { defineConfig, devices } from '@playwright/test';

// Run after npm run build: exercises the generated production worker.
export default defineConfig({
  testDir: './tests',
  testMatch: ['pwa-learn.spec.ts', 'offline-qr-reading.spec.ts'],
  reporter: 'list',
  // CI runs this after mobile; preserve that lane's screenshots and traces.
  outputDir: 'test-results/pwa',
  metadata: { pwa: true },
  use: { baseURL: 'http://127.0.0.1:2423' },
  projects: [
    { name: 'Desktop Chrome', testMatch: 'pwa-learn.spec.ts', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Chrome', testMatch: 'offline-qr-reading.spec.ts', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'npx vite preview --host 127.0.0.1 --port 2423 --strictPort',
    url: 'http://127.0.0.1:2423',
    reuseExistingServer: false,
  },
});

import { defineConfig, devices } from '@playwright/test';

// The suite was reading as broadly red because nothing started the app
// before it ran (2026-09-02 decision, TODO.md). The dev server the specs
// assume is `vite --port 2222` (package.json's `dev` script) — same port
// the default baseURL already pointed at. Several spec files (account-pieces,
// atlas-ceremony-boundary, atlas-no-webgl, oracle-visual-foundation,
// oracle-invocation-composer, oracle-reflection-recorder, light-mode-materials)
// read `process.env.PLAYWRIGHT_BASE_URL` themselves at module scope instead of
// going through `use.baseURL`, so PLAYWRIGHT_BASE_URL is the one override that
// reaches every spec — a run on a spare port (to avoid fighting whatever
// session holds 2222) must set that var, not a bespoke port var those specs
// don't know about. The webServer's port is derived from it so both agree.
// The two build-dependent specs (universal-language-prerender,
// function-headers-csp) stay self-skipping via their own env vars and don't
// need this server.
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:2222';
const PORT = new URL(BASE_URL).port || '80';

export default defineConfig({
  testDir: './tests',
  // tests/unit is vitest territory; importing vitest under the playwright
  // runner crashes the whole suite.
  testIgnore: ['**/unit/**'],
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'off',
  },
  webServer: {
    // vite.config.ts's own `serve-learn-static` plugin documents this: the
    // dev server doesn't resolve directory indexes, so /learn 404s locally
    // unless `public/learn` was built first (light-mode-materials.spec.ts and
    // typography-contract.spec.ts both navigate there). Building it is a
    // one-time, ~15s cost (content-site's own install + astro build), skipped
    // once public/learn exists, so this only pays the price on a fresh
    // checkout or CI runner rather than on every run.
    command: `sh -c 'test -d public/learn || npm run build:content; npx vite --port ${PORT} --strictPort'`,
    url: BASE_URL,
    // Locally, reuse a server a developer already has running on this port.
    // In CI there is never a pre-existing server, and reusing one would mask
    // a server that failed to start.
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
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

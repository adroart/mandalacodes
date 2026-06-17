/**
 * Vitest config for the unit suite (`npm run test:unit`).
 *
 * Deliberately separate from vite.config.ts: the unit tests exercise pure
 * utils (ledger, projection, kinship) in a plain Node environment and don't
 * need the React plugin or the dev-server setup. Playwright e2e specs keep
 * their own runner (`npm test`); the include glob below keeps the two
 * suites from picking up each other's files.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});

import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir:'./tests', outputDir:'test-results/oracle-account', testMatch:'oracle-account-ui.browser.ts', workers:1,
  use:{...devices['iPhone 13'], browserName:'webkit', baseURL:'http://127.0.0.1:4252'},
  webServer:{command:'VITE_ORACLE_NATIVE_ACCOUNTS=true npx vite --config vite.oracle.config.ts --host 127.0.0.1 --port 4252 --strictPort',url:'http://127.0.0.1:4252',reuseExistingServer:!process.env.CI},
});

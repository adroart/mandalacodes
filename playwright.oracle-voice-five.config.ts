import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./tests',testMatch:['oracle-voice-five.spec.ts','oracle-voice-journey.spec.ts','oracle-checked-editor.spec.ts'],workers:1,retries:0,
 use:{baseURL:'http://127.0.0.1:4279',trace:'retain-on-failure'},
 projects:[
  {name:'Phone',use:{...devices['iPhone 13'],browserName:'chromium',viewport:{width:390,height:844}}},
  {name:'Desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:900}}},
 ],
 webServer:{command:'npx vite --config vite.oracle.config.ts --host 127.0.0.1 --port 4279 --strictPort',url:'http://127.0.0.1:4279',reuseExistingServer:true},
});

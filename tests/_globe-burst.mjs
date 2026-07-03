// Temp dev tool: capture the atlas globe at timed intervals after load,
// so the ignition opening and mandala view can be reviewed frame by frame.
// Usage: node tests/_globe-burst.mjs [url-suffix] [label]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const suffix = process.argv[2] ?? '';
const label = process.argv[3] ?? 'burst';
const dir = `test-results/globe-${label}`;
mkdirSync(dir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:2222/atlas${suffix}`, { waitUntil: 'domcontentloaded' });

const marks = [1500, 2500, 3500, 5000, 6500, 8500, 11000, 26500, 32000];
let prev = 0;
for (const t of marks) {
  await page.waitForTimeout(t - prev);
  prev = t;
  await page.screenshot({ path: `${dir}/t${String(t).padStart(5, '0')}.png` });
  console.log(`captured t=${t}ms`);
}
await browser.close();

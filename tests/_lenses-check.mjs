// Temp dev tool: verify the M6 lenses. Injects a local profile whose gates
// cover placed pieces, then exercises: your-codes toggle, series legend
// focus, mandala ring tap.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const dir = 'test-results/lenses';
mkdirSync(dir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

// Profile: all 11 positions on gates 1 and 9 (Earth's Breath is card 1).
const pos = (g) => ({ gate: g, line: 1 });
const profile = {
  inputs: {
    date: '1990-01-01', time: '12:00',
    place: { label: 'Denpasar, Indonesia', lat: -8.65, lng: 115.22, tzId: 'Asia/Makassar' },
  },
  computed: {
    lifesWork: pos(1), evolution: pos(9), radiance: pos(1), purpose: pos(9),
    attraction: pos(1), iq: pos(9), eq: pos(1), sq: pos(9),
    core: pos(1), culture: pos(9), pearl: pos(1),
  },
  updatedAt: new Date().toISOString(),
};
await page.addInitScript((p) => {
  localStorage.setItem('ul.profile.v1', JSON.stringify(p));
}, profile);

await page.goto('http://localhost:2222/atlas', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000); // ignition settles

// 1. your-codes toggle appears and recedes the rest.
const yours = page.getByRole('button', { name: 'your codes' });
console.log('your-codes button:', await yours.count());
if (await yours.count()) {
  await yours.click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${dir}/1-yours.png` });
  await yours.click(); // off again
}

// 2. series legend focus.
const legendBtn = page.getByRole('button', { name: /Universal Language/ }).first();
if (await legendBtn.count()) {
  await legendBtn.click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${dir}/2-series-focus.png` });
  await legendBtn.click();
}

// 3. mandala ring tap: engage mandala, wait for pull-back, tap on the ring.
await page.getByRole('button', { name: 'mandala' }).click();
await page.waitForTimeout(3500);
await page.screenshot({ path: `${dir}/3-mandala.png` });
// The ring's right limb sits near x ~ 965 at this viewport; sweep a few taps.
let navigated = null;
for (const [x, y] of [[965, 385], [940, 350], [900, 330], [985, 420]]) {
  await page.mouse.click(x, y);
  await page.waitForTimeout(900);
  const url = page.url();
  if (/universal-language\/\d+/.test(url) || /piece=/.test(url)) { navigated = `${x},${y} -> ${url}`; break; }
}
console.log('ring tap:', navigated ?? 'no glyph hit at sampled points');
await page.screenshot({ path: `${dir}/4-after-ringtap.png` });

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
console.log('page errors:', errors.length);
await browser.close();

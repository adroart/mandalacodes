import { chromium } from 'playwright';

const BASE = 'http://localhost:2229';
const OUT = process.env.QA_OUT_DIR || '/tmp/typeahead-qa';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.addInitScript(() => localStorage.setItem('dark-mode', 'false'));

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail ? ': ' + detail : ''}`);
}

async function freshSteward() {
  await page.goto(`${BASE}/dev/steward-qa`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  return page.locator('#city-search-input');
}

// ── pick + save flash + placeholder update ──
let cityInput = await freshSteward();
await cityInput.click();
await cityInput.fill('lisbon');
await page.waitForTimeout(300);
const lisbonOption = page.locator('li[role="option"]', { hasText: 'Lisbon, Portugal' });
check('steward: filtered to Lisbon', await lisbonOption.count() === 1);
await lisbonOption.click();
await page.waitForTimeout(200);
check('steward: Saved. flash shown after pick', await page.locator('text=Saved.').count() > 0);
const queryAfterPick = await cityInput.inputValue();
check('steward: query cleared after pick', queryAfterPick === '', `got "${queryAfterPick}"`);
const placeholderAfterPick = await cityInput.getAttribute('placeholder');
check('steward: placeholder now shows Lisbon', (placeholderAfterPick || '').includes('Lisbon'), placeholderAfterPick || '');
await page.screenshot({ path: `${OUT}/interact-steward-after-pick.png` });

// ── Escape closes (fresh page) ──
cityInput = await freshSteward();
await cityInput.click();
await page.waitForTimeout(250);
const listBeforeEsc = await page.locator('#city-search-list').count();
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
const listAfterEsc = await page.locator('#city-search-list').count();
check('steward: Escape closes dropdown', listBeforeEsc > 0 && listAfterEsc === 0, `before=${listBeforeEsc} after=${listAfterEsc}`);

// ── Click-outside closes (fresh page, click a safe empty spot) ──
cityInput = await freshSteward();
await cityInput.click();
await page.waitForTimeout(200);
const listBeforeOutside = await page.locator('#city-search-list').count();
// Click the page heading area (well below the nav bar, not a link).
await page.locator('h1', { hasText: 'Your pieces' }).click();
await page.waitForTimeout(200);
const listAfterOutside = await page.locator('#city-search-list').count();
check('steward: click-outside closes dropdown', listBeforeOutside > 0 && listAfterOutside === 0, `before=${listBeforeOutside} after=${listAfterOutside}`);

// ── Arrow keys + Enter picks (fresh page) ──
cityInput = await freshSteward();
await cityInput.click();
await page.waitForTimeout(200);
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
check('steward: ArrowDown+ArrowDown+Enter picks and saves', await page.locator('text=Saved.').count() > 0);

// ── ARIA roles (fresh page) ──
cityInput = await freshSteward();
await cityInput.click();
await page.waitForTimeout(200);
const role = await cityInput.getAttribute('role');
const expanded = await cityInput.getAttribute('aria-expanded');
const controls = await cityInput.getAttribute('aria-controls');
check('steward: input has role=combobox', role === 'combobox');
check('steward: aria-expanded true when open', expanded === 'true');
check('steward: aria-controls points at listbox', !!controls);
const listboxRole = controls ? await page.locator(`#${controls}`).getAttribute('role') : null;
check('steward: listbox has role=listbox', listboxRole === 'listbox');

// ── AdminAtlas: onChange('') clears selection while typing ──
await page.goto(`${BASE}/dev/admin-atlas-qa`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const adminCityInput = page.locator('input[placeholder="Lisbon, Portugal"]');
await adminCityInput.click();
await adminCityInput.fill('berlin');
await page.waitForTimeout(250);
const berlinOpt = page.locator('li[role="option"]', { hasText: 'Berlin, Germany' });
await berlinOpt.click();
await page.waitForTimeout(150);
check('admin: Selected badge shows after pick', await page.locator('text=Selected: berlin-de').count() > 0);
await adminCityInput.fill('berlin extra');
await page.waitForTimeout(150);
check('admin: Selected badge clears while typing (onChange(\'\'))', await page.locator('text=Selected: berlin-de').count() === 0);
await page.screenshot({ path: `${OUT}/interact-admin-atlas-typing-clears.png` });

await browser.close();

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length) process.exitCode = 1;

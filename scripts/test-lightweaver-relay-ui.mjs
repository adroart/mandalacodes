import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

const port = 5599;
const baseUrl = `http://127.0.0.1:${port}`;

if (!existsSync('dist/index.html')) {
  throw new Error('dist/index.html is missing. Run npm run build before this test.');
}

function waitForServer() {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const check = async () => {
      try {
        const response = await fetch(baseUrl);
        if (response.ok) return resolve();
      } catch {
        /* not up yet */
      }
      if (Date.now() - started > 15000) return reject(new Error('vite preview did not start'));
      setTimeout(check, 200);
    };
    check();
  });
}

const server = spawn('node_modules/.bin/vite', ['preview', '--host', '127.0.0.1', '--port', String(port)], {
  stdio: 'ignore',
});

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let currentPatternId = 'aurora';
  await page.addInitScript(() => {
    localStorage.setItem('lw_relay_card_id', 'test-card');
    localStorage.setItem('lw_relay_owner_token', 'test-token');
    localStorage.setItem('lw_relay_card_label', 'Lightweaver');
  });

  await page.route('**/api/lw/state/test-card', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        state: {
          id: 'test-card',
          label: 'Lightweaver',
          online: true,
          lastSeenAt: Date.now(),
          currentPatternId,
          brightness: 1,
          hue: 32,
          saturation: 230,
          blackout: false,
        },
      }),
    });
  });

  await page.route('**/api/lw/control/test-card', async (route) => {
    const body = route.request().postDataJSON();
    if (body?.patternId) {
      setTimeout(() => {
        currentPatternId = body.patternId;
      }, 1800);
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, commandId: 'test-command' }),
    });
  });

  await page.goto(`${baseUrl}/?led=1`);
  await page.getByRole('button', { name: 'Wave' }).click();
  await expectLocatorText(page, 'Sending to piece');

  const wave = page.getByRole('button', { name: 'Wave' });
  await expectClassContains(wave, 'lw-active');
} finally {
  if (browser) await browser.close();
  server.kill();
}

async function expectLocatorText(page, text) {
  const locator = page.getByText(text);
  await locator.waitFor({ state: 'visible', timeout: 1000 });
}

async function expectClassContains(locator, className) {
  const value = await locator.getAttribute('class');
  assert.match(value || '', new RegExp(`\\b${className}\\b`));
}

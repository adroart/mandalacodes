import { expect, test, type Page } from './fixtures';

const CARD = '/universal-language/22';
const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:2222';

async function dismissEntrance(page: Page) {
  const entrance = page.getByRole('dialog', { name: 'Card entrance. Tap to begin.' });
  await entrance.waitFor({ state: 'visible', timeout: 3_000 }).catch(() => undefined);
  if (await entrance.isVisible()) await entrance.click();
}

test('the live invocation follows the reading and renders constrained Markdown safely', async ({ page }) => {
  await page.route('**/api/oracle/invocations/22/live', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      title: 'Invocation for Grace',
      versionNumber: 3,
      blocks: [
        { type: 'heading', level: 2, children: [{ type: 'text', value: 'Invocation for Grace' }] },
        { type: 'paragraph', children: [{ type: 'text', value: 'Let beauty arise without becoming decoration.' }] },
      ],
    }),
  }));
  await page.goto(`${BASE}${CARD}`);
  await dismissEntrance(page);
  const reading = page.locator('section[data-chapter="ul"] [data-oracle-reading-prose]');
  const invocation = page.getByRole('article', { name: 'Invocation for Grace' });
  await expect(invocation).toBeVisible();
  const order = await page.evaluate(() => {
    const prose = document.querySelector('section[data-chapter="ul"] [data-oracle-reading-prose]');
    const invocation = document.querySelector('.public-invocation');
    return prose && invocation ? Boolean(prose.compareDocumentPosition(invocation) & Node.DOCUMENT_POSITION_FOLLOWING) : false;
  });
  expect(order).toBe(true);
  await expect(invocation.getByText('Let beauty arise without becoming decoration.')).toBeVisible();
  await expect(page.locator('.public-invocation [dangerouslySetInnerHTML]')).toHaveCount(0);
  await expect(reading).toBeVisible();
});

test('no live invocation leaves no public placeholder', async ({ page }) => {
  await page.route('**/api/oracle/invocations/22/live', route => route.fulfill({ status: 204, body: '' }));
  await page.goto(`${BASE}${CARD}`);
  await dismissEntrance(page);
  await expect(page.locator('.public-invocation')).toHaveCount(0);
  await expect(page.getByText('No invocation yet')).toHaveCount(0);
});

test('a previous card invocation never leaks into the next card while it loads', async ({ page }) => {
  await page.route('**/api/oracle/invocations/22/live', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ title: 'Grace Twenty Two', versionNumber: 1, blocks: [{ type: 'paragraph', children: [{ type: 'text', value: 'Only for twenty two.' }] }] }) }));
  await page.route('**/api/oracle/invocations/23/live', async route => { await new Promise(resolve => setTimeout(resolve, 500)); await route.fulfill({ status: 204, body: '' }); });
  await page.goto(`${BASE}${CARD}`);
  await dismissEntrance(page);
  await expect(page.getByText('Only for twenty two.')).toBeVisible();
  await page.evaluate(() => {
    window.history.pushState(window.history.state, '', '/universal-language/23');
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
  });
  await expect(page).toHaveURL(/\/universal-language\/23$/);
  await expect(page.getByText('Only for twenty two.')).toHaveCount(0);
});

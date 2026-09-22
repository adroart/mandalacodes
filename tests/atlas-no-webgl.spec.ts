import { test, expect } from './fixtures';

/* /atlas without WebGL (todo/plans/overarching-plan.md Track C1).
 *
 * DEVELOPMENT-STATUS.md claimed the fallback globe and side panel were
 * imported but never mounted, so a visitor with no WebGL saw only the
 * footer. Verifying that claim (2026-09-08) found the opposite problem:
 * AtlasPage.tsx already mounts `Globe` and `PieceSidePanel` under a
 * `!use3D` branch — but the "fallback" `Globe` draws through cobe, which
 * itself requires a WebGL context and silently no-ops without one (no
 * error, no draw call, just a blank canvas forever). So a genuinely
 * WebGL-less visitor saw the title, filters and side panel, but an empty
 * black box where the globe should be — the title and side panel bugs the
 * status doc worried about were already fixed, but "shows the globe" (the
 * plan's own acceptance line for C1) still failed.
 *
 * The fix teaches `Globe` (components/atlas/Globe.tsx) to paint a flat SVG
 * constellation — the same lights, projected with the same math used for
 * the WebGL canvas's own click hit-testing — whenever no WebGL context is
 * available at all. This spec forces WebGL off at the browser level and
 * asserts the constellation renders with real markers, selection still
 * works, and the page carries none of the four standard defects. */

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:2222';

test.use({
  launchOptions: {
    args: ['--disable-webgl', '--disable-webgl2'],
  },
});

const mockAtlasState = {
  ok: true,
  state: {
    generatedAt: '2026-09-08T00:00:00.000Z',
    schemaVersion: 2,
    cities: [
      { id: 'lisbon-pt', city: 'Lisbon', country: 'Portugal', countryCode: 'PT', lat: 38.7223, lng: -9.1393 },
      { id: 'denpasar-id', city: 'Denpasar', country: 'Indonesia', countryCode: 'ID', lat: -8.65, lng: 115.2167 },
      { id: 'new-york-us', city: 'New York', country: 'United States', countryCode: 'US', lat: 40.7128, lng: -74.006 },
    ],
    pieces: [
      { pieceId: 'UL-01', editionNumber: 1, series: 'Universal Language', cityId: 'lisbon-pt', status: 'placed', pieceType: 'mandala', claimOrdinal: 1, kind: 'sixty-four' },
      { pieceId: 'UL-02', editionNumber: 1, series: 'Universal Language', cityId: 'denpasar-id', status: 'placed', pieceType: 'mandala', claimOrdinal: 2, kind: 'sixty-four' },
      { pieceId: 'UL-03', editionNumber: 1, series: 'Universal Language', cityId: 'new-york-us', status: 'placed', pieceType: 'mandala', claimOrdinal: 3, kind: 'sixty-four' },
      { pieceId: 'UL-04', editionNumber: 1, series: 'Universal Language', cityId: null, status: 'seeking', pieceType: 'mandala', kind: 'sixty-four' },
    ],
  },
};

async function openAtlasWithoutWebGL(page: import('@playwright/test').Page) {
  await page.route('**/api/atlas', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockAtlasState) }),
  );
  await page.route('**/api/atlas/catalog', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, entries: [] }) }),
  );
  await page.goto(`${BASE}/atlas`, { waitUntil: 'networkidle' });
  // Confirm WebGL is genuinely off for this test, not just assumed from the
  // launch flags — a flag that stops working silently would make every
  // assertion below meaningless.
  const webglAvailable = await page.evaluate(() => {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  });
  expect(webglAvailable).toBe(false);
}

test('shows the constellation, not a blank box, with no WebGL at all', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  await openAtlasWithoutWebGL(page);

  // No WebGL canvas anywhere on the page — cobe was never asked to draw.
  await expect(page.locator('canvas')).toHaveCount(0);

  // The SVG constellation stands in for it, with real marker lights.
  const globe = page.locator('svg[aria-label*="constellation"]');
  await expect(globe).toBeVisible();
  const markerCount = await globe.locator('circle').count();
  // One boundary circle plus one per piece in the mock above.
  expect(markerCount).toBeGreaterThan(1);

  // Selection still works: clicking a light opens the side panel. The
  // marker keeps moving each frame (the same slow drift as the WebGL
  // globe), so a plain .click() can fail Playwright's stability check —
  // dispatch the event directly, the way a real click would land it.
  const firstMarker = globe.locator('circle').nth(1);
  await firstMarker.dispatchEvent('click');
  await expect(page.getByText('SELECTED PIECE')).toBeVisible();
  await expect(page.getByText('WHERE IT RESTS')).toBeVisible();

  // The four standard checks.
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
  await expect(page.getByText('404')).toHaveCount(0);
  await expect(page.getByText('page not found', { exact: false })).toHaveCount(0);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 2,
  );
  expect(overflow).toBe(false);
  expect(consoleErrors).toEqual([]);
});

test('title, filters and side panel chrome all render around the constellation', async ({ page }) => {
  await openAtlasWithoutWebGL(page);

  await expect(page.getByRole('heading', { name: 'Atlas' })).toBeVisible();
  await expect(page.getByText('Series', { exact: true })).toBeVisible();
  await expect(page.getByText('SHOW KINSHIP THREADS')).toBeVisible();
  await expect(
    page.getByText('Tap a point on the globe to see where that piece has come to rest.'),
  ).toBeVisible();

  // The filters sidebar is a fixed 360px column at the desktop (lg) breakpoint
  // while the Series+Status row only stacks vertically below `sm`, so on a
  // wide desktop viewport the "All / Placed / Seeking ground" segmented
  // buttons used to overflow the 360px column's right edge. `html, body`
  // carry `overflow-x: clip` (src/index.css) so that spillage never grows
  // `scrollWidth` for the page-wide overflow check above — it just silently
  // clips the last button(s) out of view. Assert the group's own bounding
  // box, not scrollWidth, stays inside the viewport.
  const statusGroup = page.getByRole('group', { name: 'Status filter' });
  await expect(statusGroup).toBeVisible();
  const box = await statusGroup.boundingBox();
  expect(box).not.toBeNull();
  const viewport = page.viewportSize();
  if (box && viewport) {
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  }
  await expect(page.getByRole('button', { name: 'Seeking ground' })).toBeVisible();
});

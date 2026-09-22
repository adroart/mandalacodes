/* Track C2 (todo/plans/overarching-plan.md): the 64 card pages now ship a
   prerendered <head> (scripts/prerender-cards.ts, served in production by
   functions/universal-language/[number].js) so crawlers see a real title,
   canonical, meta description, Open Graph / Twitter tags, and a JSON-LD
   CreativeWork with no JS required — and the SPA must still boot and
   hydrate the card identically to the plain client-rendered route.
   This only exercises the *built* output (dist/), not the dev server, so it
   is opt-in: run `npm run build && npx vite preview --port <N>` first, then

     PRERENDER_BASE_URL=http://localhost:<N> npx playwright test tests/universal-language-prerender.spec.ts

   Same shape as tests/live-oracle-cards.spec.ts (skip-if-unset, not part of
   the default `npm test` run against the dev server, which has no dist/). */
import { test, expect } from './fixtures';

const BASE = process.env.PRERENDER_BASE_URL ?? '';

test.skip(
  !BASE,
  'Set PRERENDER_BASE_URL (a `vite preview` origin serving a fresh `npm run build`) to run the prerendered-card checks.',
);

const CARD = 33;
const CARD_NAME = 'Echos of Time';

test(`card ${CARD} serves a prerendered head and still hydrates`, async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));

  const resp = await page.goto(`${BASE}/universal-language/${CARD}`, { waitUntil: 'domcontentloaded' });
  expect(resp?.status()).toBeLessThan(400);

  // Check the HEAD AS THE SERVER SENT IT, from the raw response body — not
  // via page.title()/DOM queries, which race the SPA's own hydration (the
  // card data loads in an async chunk and briefly re-renders with the site
  // default before settling on the real title a few hundred ms later, same
  // as it always has). The raw response is what a crawler that doesn't run
  // JS actually sees, which is the whole point of this page existing.
  const rawHtml = (await resp?.body())?.toString('utf8') ?? '';
  expect(rawHtml).toContain(`<title>${CARD_NAME} · Code ${CARD} · Universal Language Oracle</title>`);
  expect(rawHtml).toContain(`<link rel="canonical" href="https://mandalacodes.com/universal-language/${CARD}" />`);
  expect(rawHtml).toContain(`<meta property="og:url" content="https://mandalacodes.com/universal-language/${CARD}" />`);
  const ogImageMatch = rawHtml.match(/<meta property="og:image" content="([^"]*)"/);
  expect(ogImageMatch?.[1]).toContain('mandalacodes.com/media/image/');
  expect(ogImageMatch?.[1]).toContain('w=400&h=400');
  const creativeWorkMatch = rawHtml.match(/\{"@context":"https:\/\/schema\.org","@type":"CreativeWork".*?\}(?=\s*<\/script>)/);
  expect(creativeWorkMatch, 'JSON-LD CreativeWork block').toBeTruthy();
  const creativeWork = JSON.parse(creativeWorkMatch![0]);
  expect(creativeWork.name).toBe(`${CARD_NAME} · Code ${CARD} · Universal Language Oracle`);
  expect(creativeWork.url).toBe(`https://mandalacodes.com/universal-language/${CARD}`);

  // Now prove the SPA still hydrates on top of that head — the card reading
  // (not just the meta tags) has to actually render.
  const entranceDialog = page.getByRole('dialog', { name: 'Card entrance. Tap to begin.' });
  try {
    await entranceDialog.waitFor({ state: 'visible', timeout: 2_000 });
    await entranceDialog.click();
  } catch {
    // Direct navigation skips the entrance choreography — nothing to dismiss.
  }
  await expect(page.locator('[data-oracle-choreography="reading"]')).toBeAttached({ timeout: 10_000 });
  const readingText = await page.locator('[data-oracle-reading-prose]').first().innerText();
  expect(readingText.trim().length).toBeGreaterThan(200);
  expect(await page.locator('body').innerText()).toContain(CARD_NAME);

  // The four standard checks.
  const body = await page.textContent('body');
  expect(body, 'error boundary').not.toContain('Something went wrong');
  expect(body?.toLowerCase(), '404 text').not.toContain('page not found');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  expect(overflow, 'horizontal overflow').toBe(false);
  const unexpected = consoleErrors.filter((e) => !/401|403|favicon|net::ERR_/i.test(e));
  expect(unexpected, 'console errors').toEqual([]);
});

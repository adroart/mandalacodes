#!/usr/bin/env node
/**
 * Pre-make every artwork size the live site asks for, a few at a time.
 *
 * The media Worker stores each resized variant in R2 the first time it makes
 * one. Until then, a page that requests many new variants at once can push the
 * Worker past its resource limits (Cloudflare error 1102). Run this once after
 * deploying the Worker, and again after adding artwork or a new image size, so
 * no visitor is the first to ask for a variant.
 *
 *   node scripts/warm-media.mjs [https://mandalacodes.com] [--list]
 *
 * --list collects and counts the variants without requesting them.
 *
 * It visits the pages that show artwork at phone, tablet and desktop sizes,
 * collects every /media/ URL they request or list in a srcset, then fetches
 * each one with at most four in flight. Exit code 1 when any variant still
 * fails after one retry.
 */
import { chromium, devices } from 'playwright';

const args = process.argv.slice(2);
const LIST_ONLY = args.includes('--list');
const BASE = (args.find((a) => !a.startsWith('--')) ?? 'https://mandalacodes.com').replace(/\/$/, '');
const PAGES = ['/', '/learn', ...Array.from({ length: 64 }, (_, i) => `/universal-language/${i + 1}`)];
const VIEWPORTS = [
  devices['Pixel 5'],
  { viewport: { width: 1024, height: 900 }, deviceScaleFactor: 2 },
  { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
];
const IN_FLIGHT = 4;

const urls = new Set();
const browser = await chromium.launch();
for (const options of VIEWPORTS) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  // Collect the URLs without paying for the bytes; the fetch pass below makes them.
  await page.route('**/media/**', (route) => {
    urls.add(route.request().url());
    return route.abort();
  });
  for (const path of PAGES) {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(1200);
    const listed = await page
      .evaluate(() =>
        [...document.querySelectorAll('img[srcset], source[srcset]')].flatMap((el) =>
          el.srcset.split(',').map((candidate) => new URL(candidate.trim().split(/\s+/)[0], location.href).href),
        ),
      )
      .catch(() => []);
    for (const url of listed) if (url.includes('/media/')) urls.add(url);
  }
  await context.close();
}
await browser.close();

const list = [...urls].filter((u) => u.startsWith(BASE + '/media/'));
console.log(`${list.length} artwork variants found across ${PAGES.length} pages`);
if (LIST_ONLY) process.exit(0);

let done = 0;
const failed = [];
async function warm(url) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const res = await fetch(url, { headers: { Accept: 'image/avif,image/webp,image/*' } }).catch(() => null);
    if (res?.ok) {
      await res.arrayBuffer();
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  failed.push(url);
}
const queue = [...list];
await Promise.all(
  Array.from({ length: IN_FLIGHT }, async () => {
    while (queue.length) {
      await warm(queue.shift());
      done += 1;
      if (done % 50 === 0) console.log(`  ${done} of ${list.length}`);
    }
  }),
);

console.log(`${list.length - failed.length} of ${list.length} variants ready`);
if (failed.length) {
  console.log('Still failing:');
  for (const url of failed.slice(0, 20)) console.log(`  ${url}`);
  process.exit(1);
}

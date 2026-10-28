import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
test.beforeEach(async ({ context }) => {
  // Bundled assets are served locally for this browser test. No public network
  // is available: artwork and birth-place calculations must remain usable.
  await context.route(/^https:\/\//, route => route.abort());
});
test('bundled deck, drawing, and reading work without external network', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Oracle', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Birthday', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /draw a card/i }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('dialog').getByRole('button', { name: 'Cast the coins', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Open card \d+$/ }).first()).toBeVisible();
  await page.getByRole('button', { name: /^Open card \d+$/ }).first().click();
  await expect(page).toHaveURL(/\/universal-language\/\d+$/);
  await page.screenshot({ path: 'test-results/oracle-app-draw.png' });
  await page.goto('/universal-language/1');
  await expect(page.locator('img[src="/oracle-art/1.webp"]').first()).toBeVisible();
  await expect.poll(() => page.locator('img[src="/oracle-art/1.webp"]').first().evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('body')).toContainText('Gate 1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/oracle-app-reading.png' });
  await expect(page.getByText('Hold to record', { exact: true })).toHaveCount(0);
  await page.locator('[data-bar-tab=share]').click();
  await expect(page.getByRole('button', { name: 'Share reading', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test('Birthday searches local places, calculates and retains a profile after reopening', async ({ page }) => {
  await page.goto('/profile');
  await page.locator('input[type="date"]').fill('1990-06-15');
  await page.getByPlaceholder('HH:MM').fill('14:30');
  await page.getByPlaceholder('Type a city, then pick from the list').fill('Jakarta');
  await page.getByRole('option').first().click();
  await page.getByRole('button', { name: 'Build my profile', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
  await expect(page.locator('body')).toContainText('1990-06-15');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
  await expect(page.locator('body')).toContainText('1990-06-15');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/oracle-app-profile.png' });
});
test('all 64 artwork plates ship in the bundle', async ({ request }) => {
  const manifest = JSON.parse(readFileSync('dist-oracle/oracle-art/manifest.json', 'utf8'));
  expect(manifest).toHaveLength(64);
  for (const item of manifest) {
    const response = await request.get(`/oracle-art/${item.number}.webp`);
    expect(response.ok()).toBe(true);
    expect((await response.body()).length).toBe(item.bytes);
  }
});

test('trigram choices form a circle and preserve lower/upper selection on the phone', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Draw a card', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Draw a card' });
  await dialog.getByRole('tab', { name: 'Choose trigrams' }).click();
  const choices = dialog.getByRole('group', { name: /trigram choices/ });
  const geometry = await choices.evaluate(element => {
    const ring = element.getBoundingClientRect();
    return {
      width: ring.width, height: ring.height,
      buttons: Array.from(element.querySelectorAll('button')).map(button => {
        const box = button.getBoundingClientRect();
        return { width: box.width, height: box.height,
          radius: Math.hypot(box.x + box.width / 2 - ring.x - ring.width / 2, box.y + box.height / 2 - ring.y - ring.height / 2) };
      }),
    };
  });
  expect(Math.abs(geometry.width - geometry.height)).toBeLessThan(1);
  expect(geometry.buttons).toHaveLength(8);
  const radii = geometry.buttons.map(button => button.radius);
  expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(1);
  for (const button of geometry.buttons) {
    expect(button.width).toBeGreaterThanOrEqual(44);
    expect(button.height).toBeGreaterThanOrEqual(44);
  }
  await dialog.getByRole('button', { name: 'Fire', exact: true }).click();
  await expect(choices).toHaveAttribute('aria-label', 'Upper trigram choices');
  await dialog.getByRole('button', { name: 'Water', exact: true }).click();
  await expect(dialog.getByText('Hexagram 63', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Edit lower trigram, Fire' }).click();
  await dialog.getByRole('button', { name: 'Water', exact: true }).click();
  await expect(dialog.getByText('Hexagram 29', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Open card 29', exact: true })).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: 'test-results/oracle-app-trigram-circle.png' });
  await dialog.getByRole('button', { name: 'Open card 29', exact: true }).click();
  await expect(page).toHaveURL(/\/universal-language\/29$/);
});

for (const size of [{width:375,height:667},{width:430,height:932},{width:932,height:430}]) {
  test(`phone layouts stay usable at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const fits = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto('/');
    const draw = page.getByRole('button', {name:'Draw a card',exact:true}).first();
    await expect(draw).toBeVisible();
    await fits();
    await page.screenshot({path:`mobile/build/layout-deck-${size.width}.png`});
    await page.getByRole('button',{name:'Enter your birth time',exact:true}).click();
    await expect(page.getByRole('button',{name:'Close birth time',exact:true})).toBeInViewport({ratio:1});
    await page.getByRole('button',{name:'Close birth time',exact:true}).click();
    if (size.width === 430) await page.getByRole('button',{name:'Use light appearance',exact:true}).click();
    await page.getByRole('link',{name:'Explore',exact:true}).click();
    const systems = page.getByRole('navigation',{name:'Explore systems'});
    await expect(systems).toBeVisible();
    for(const link of await systems.getByRole('link').all()) {
      const box = await link.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({path:`mobile/build/layout-explore-${size.width}.png`});
    await systems.getByRole('link',{name:'Human Design',exact:true}).click();
    await expect(page.getByRole('heading',{name:'A map of energy'})).toBeInViewport();
    await fits();
    await page.goto('/universal-language/1');
    const tabs = page.locator('[data-nav]');
    await expect(tabs).toHaveCount(6);
    for(const tab of await tabs.all()) {
      // WebKit rounds fractional edges; tolerate less than one percent.
      await expect(tab).toBeInViewport({ratio:0.99});
      const box=await tab.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
      await tab.click();
      await fits();
    }
    await page.locator('[data-nav="iching"]').click();
    await page.screenshot({path:`mobile/build/layout-reading-${size.width}.png`});
    await page.locator('[data-bar-tab=share], [data-bar-share]').filter({visible:true}).first().click();
    await expect(page.getByRole('button',{name:'Share reading',exact:true})).toBeInViewport();
    await expect(page.getByRole('button',{name:'Close',exact:true})).toBeInViewport();
    await page.getByRole('button',{name:'Close',exact:true}).click();
  });
}

for (const width of [375, 430]) {
  test(`Birthday chart stays legible and aligned at ${width}px`, async ({page}) => {
    await page.setViewportSize({width,height:932});
    await page.goto('/profile');
    await page.locator('input[type="date"]').fill('1990-06-15');
    await page.getByPlaceholder('HH:MM').fill('14:30');
    await page.getByPlaceholder('Type a city, then pick from the list').fill('Jakarta');
    await page.getByRole('option').first().click();
    await page.getByRole('button',{name:'Build my profile',exact:true}).click();
    await expect(page.locator('.pg__svg')).toBeVisible();
    for (const theme of ['dark','light']) {
      if(theme === 'light') await page.getByRole('button',{name:'Use light appearance',exact:true}).click();
      const geometry=await page.locator('.pg__svg').evaluate(svg => {
        const viewport=svg.getBoundingClientRect();
        const box=(e:Element)=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};
        const labels=Array.from(svg.querySelectorAll('.pg__name')).map(box);
        const circles=Array.from(svg.querySelectorAll('.pg__circle')).map(box);
        const overlaps=(a:ReturnType<typeof box>,b:ReturnType<typeof box>)=>Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>1 && Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>1;
        return {labels:labels.length,minimumCircle:Math.min(...circles.map(c=>c.w)),
          labelClipping:labels.some(r=>r.x<viewport.x-1||r.x+r.w>viewport.right+1||r.y<viewport.y-1||r.y+r.h>viewport.bottom+1),
          labelOverlap:labels.some((a,i)=>labels.some((b,j)=>j>i&&overlaps(a,b))),
          circleOverlap:labels.some(a=>circles.some(b=>overlaps(a,b))),
          gateSize:parseFloat(getComputedStyle(svg.querySelector('.pg__gate')!).fontSize)*(svg as SVGSVGElement).getScreenCTM()!.a};
      });
      expect(geometry.labels).toBe(11);
      expect(geometry.minimumCircle).toBeGreaterThanOrEqual(44);
      expect(geometry.gateSize).toBeGreaterThanOrEqual(16);
      expect(geometry.labelClipping).toBe(false);
      expect(geometry.labelOverlap).toBe(false);
      expect(geometry.circleOverlap).toBe(false);
      await page.locator('.pg__canvas').screenshot({path:`mobile/build/birthday-chart-${width}-${theme}.png`});
    }
    await page.getByRole('button',{name:'Zoom in',exact:true}).click();
    await expect(page.getByRole('button',{name:'Reset zoom',exact:true})).toHaveText('130%');
    await page.getByRole('button',{name:'Reset zoom',exact:true}).click();
    await expect(page.getByRole('button',{name:'Reset zoom',exact:true})).toHaveText('100%');
    await page.locator('.pg__orb').first().click();
    await expect(page.locator('.pg__detail-name')).toHaveText("Life's Work");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}

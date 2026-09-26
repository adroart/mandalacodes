import { expect, test } from './fixtures';

/**
 * Every piece of text a reader can see on a card page is at least 12px and
 * at least 4.5:1 against the surface it sits on, in both palettes.
 *
 * Measured on the live card before the floor (2026-09-26): 24 text styles
 * fell short, from 8px Gene Keys labels to quiet ink at 3.9:1. Most of those
 * sizes and colours arrive as inline styles from the generated Claude Design
 * panels, so the floor lives in card-reading-fullbleed.css, where a re-import
 * cannot undo it. The six-tab row on phones is exempt: its fit is tuned for
 * 11px (see the [data-nav] rules in the same file).
 */

async function shortfalls(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    // Surfaces here use color-mix() and oklab(), which a regex over the
    // computed string misreads as near-black. A 1px canvas turns any CSS
    // colour into sRGB bytes, alpha included.
    const ctx = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true })!;
    const parse = (c: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000';
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return a === 0 ? [] : [r, g, b, a / 255];
    };
    const lum = (rgb: number[]) =>
      rgb.slice(0, 3).map(v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; })
        .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    const surface = (el: Element | null) => {
      for (let e = el; e; e = e.parentElement) {
        const c = parse(getComputedStyle(e).backgroundColor);
        if (c.length && c[3] > 0.5) return c;
      }
      return [20, 16, 11];
    };
    const out: string[] = [];
    for (const el of document.querySelectorAll('.card-reading *')) {
      if (el.closest('[data-nav]')) continue;
      const text = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent?.trim()).join(' ').trim();
      if (text.length < 2) continue;
      const box = el.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) continue;
      let shown = true;
      for (let e: Element | null = el; e; e = e.parentElement) {
        const s = getComputedStyle(e);
        if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) { shown = false; break; }
      }
      if (!shown) continue;
      const cs = getComputedStyle(el);
      const size = parseFloat(cs.fontSize);
      const bg = surface(el);
      const fg0 = parse(cs.color);
      const a = fg0[3] ?? 1;
      const fg = [0, 1, 2].map(i => fg0[i] * a + bg[i] * (1 - a));
      const [l1, l2] = [lum(fg), lum(bg)];
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      if (size < 12 || ratio < 4.5) out.push(`${size}px ${ratio.toFixed(2)}:1 "${text.slice(0, 30)}"`);
    }
    return [...new Set(out)];
  });
}

for (const dark of [true, false]) {
  for (const width of [390, 1440]) {
    test(`card text meets the legibility floor (${dark ? 'dark' : 'light'}, ${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(d => localStorage.setItem('dark-mode', d ? 'true' : 'false'), dark);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/universal-language/2');
      await expect(page.locator('.card-reading').first()).toBeAttached();
      for (let i = 0; i < 24; i++) { await page.mouse.wheel(0, 900); await page.waitForTimeout(60); }
      expect(await shortfalls(page)).toEqual([]);
    });
  }
}

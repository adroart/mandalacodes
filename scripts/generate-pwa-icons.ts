/**
 * DEV UTILITY — not part of the build or the deploy.
 *
 * Rasterizes public/favicon.svg (the existing "A" wordmark, same wood/bronze
 * palette used across the site) into the PNG sizes an installed PWA manifest
 * needs. The manifest previously pointed at /android-chrome-192x192.png and
 * /android-chrome-512x512.png, neither of which exists in this repo — those
 * links 404 today regardless of the PWA work. This generates real files so
 * an install (should a visitor choose one) doesn't show a blank icon.
 *
 * Also emits a maskable variant: the source mark is drawn edge-to-edge in its
 * 32x32 box, which Android's circular/squircle masks would clip, so the
 * maskable version pads it down to fit inside the ~80% safe-zone circle
 * launchers guarantee.
 *
 *   npx tsx scripts/generate-pwa-icons.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg, initWasm } from '@resvg/resvg-wasm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const favicon = readFileSync(resolve(root, 'public/favicon.svg'), 'utf8');

// Same content, redrawn onto a canvas so the mark occupies the inner safe
// zone (a centered 60%) rather than the full bleed — Android's adaptive-icon
// masks crop anything outside that zone on a "maskable" purpose icon.
const maskableSvg = favicon
  .replace('viewBox="0 0 32 32"', 'viewBox="0 0 32 32"')
  .replace(
    '<rect width="32" height="32" rx="6" fill="#141210"/>',
    '<rect width="32" height="32" fill="#141210"/><g transform="translate(6.4 6.4) scale(0.6)">',
  )
  .replace('</svg>', '</g></svg>');

async function render(svg: string, size: number, outPath: string) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  writeFileSync(outPath, png);
  console.log(`${outPath} (${size}x${size}, ${png.length} bytes)`);
}

async function main() {
  await initWasm(readFileSync(resolve(root, 'node_modules/@resvg/resvg-wasm/index_bg.wasm')));
  await render(favicon, 192, resolve(root, 'public/android-chrome-192x192.png'));
  await render(favicon, 512, resolve(root, 'public/android-chrome-512x512.png'));
  await render(maskableSvg, 512, resolve(root, 'public/android-chrome-512x512-maskable.png'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

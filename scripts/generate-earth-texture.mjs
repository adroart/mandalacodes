/**
 * Generate the engraved-earth equirectangular texture for the Three.js Atlas
 * globe (build-order item 3, the engraved earth).
 *
 * The ruled earth is the elevated hairline, I-b's lifted land value, NO
 * graticule (todo/plans/atlas-interface-redesign.md, "The planet itself").
 * The exact color/opacity/stroke values are ratified in the mockup generator
 * scratchpad/gen-hairline.mjs (variant hb, minus the graticule line); this
 * script bakes that drawing into a DATA texture rather than a flat picture so
 * the sphere shader can modulate the engraving at runtime (light pools, the
 * coast catch-light). The channels are:
 *
 *   R = land mask        (I-b land lift vs ocean; 1 on land, 0 on ocean)
 *   G = coast hairline    (the crisp 0.7px #c4aa7c 0.55 coastline)
 *   B = waterline         (the wide luminous strokes + the carved echo ring,
 *                          the signature of antique engraved charts)
 *
 * The sphere fragment shader composes ocean gradient + land lift (R) + coast
 * tinted ATLAS_GOLD (G) + waterline glow (B), then adds the marker light pools
 * and brightens G toward warm white inside them (the catch-light). See
 * components/atlas/three/GlobeSphere.tsx.
 *
 * COMMIT the generated PNGs; they are static assets. This script is for
 * regeneration only and is never part of the deploy build (Cloudflare CI has
 * no browser). It rasterizes with the Playwright chromium already installed
 * for the test suite.
 *
 * Regenerate:  node scripts/generate-earth-texture.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoEquirectangular, geoPath } from 'd3-geo';
import * as topojson from 'topojson-client';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'public/atlas');
mkdirSync(outDir, { recursive: true });

// land-110m keeps the coastline crisp at this texture size while staying tiny;
// 50m adds detail the globe never resolves and triples the file weight.
const world = JSON.parse(
  readFileSync(resolve(root, 'node_modules/world-atlas/land-110m.json'), 'utf8'),
);
const land = topojson.feature(world, world.objects.land);

/**
 * Build the equirectangular land + coast path strings at a given width. The
 * projection maps lng[-180,180] -> x[0,W] and lat[+90,-90] -> y[0,H] (top row
 * is the north pole), a plain 2:1 equirectangular plate the shader samples by
 * lat/lng computed from the surface normal.
 */
function paths(W) {
  const H = W / 2;
  const projection = geoEquirectangular()
    .scale(W / (2 * Math.PI))
    .translate([W / 2, H / 2])
    .precision(0.2);
  const path = geoPath(projection);
  return { W, H, landPath: path(land) };
}

/**
 * Render one variant to a PNG (base64) inside chromium. Stroke widths scale
 * with the texture so the engraving keeps the same weight the mockup ruled at
 * a ~760px globe diameter (equirectangular carries ~1.7x the mockup's
 * px-per-degree at the equator, folded into STROKE below).
 */
async function render(page, W) {
  const { H, landPath } = paths(W);
  const STROKE = W / 3400; // ~1.2px at W=4096; the ratified 0.7px coast, scaled

  const dataUrl = await page.evaluate(
    async ({ W, H, landPath, STROKE }) => {
      const path = new Path2D(landPath);

      // Each channel is drawn white-on-black on its own canvas, then the red
      // sample of each is packed into the final RGBA.
      const make = () => {
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
        return ctx;
      };

      // R — land mask. A solid fill with light AA at the coast; the shader
      // reads > 0.5 as land and lifts it one shade above the ocean.
      const rc = make();
      rc.fillStyle = '#fff';
      rc.fill(path);

      // G — the crisp coast hairline. One thin white stroke; the shader tints
      // it ATLAS_GOLD and brightens it toward warm white inside a light pool.
      const gc = make();
      gc.lineJoin = 'round';
      gc.lineCap = 'round';
      gc.strokeStyle = '#fff';
      gc.lineWidth = STROKE * 1.05;
      gc.stroke(path);

      // B — the waterline: a wide luminous halo falling off into the ocean,
      // with a brighter band hugging the coast that reads as the carved echo
      // ring of an antique chart. Baked as a soft field so the shader only
      // scales its intensity (cheap, no runtime blur).
      const bc = make();
      bc.lineJoin = 'round';
      bc.lineCap = 'round';
      bc.strokeStyle = '#fff';
      // wide, soft halo
      bc.globalAlpha = 0.34;
      bc.filter = `blur(${Math.round(STROKE * 4)}px)`;
      bc.lineWidth = STROKE * 11;
      bc.stroke(path);
      // mid band
      bc.globalAlpha = 0.5;
      bc.filter = `blur(${Math.round(STROKE * 1.6)}px)`;
      bc.lineWidth = STROKE * 5;
      bc.stroke(path);
      // the discrete echo: a brighter, tight band right at the coast
      bc.globalAlpha = 0.7;
      bc.filter = `blur(${Math.round(STROKE)}px)`;
      bc.lineWidth = STROKE * 2.4;
      bc.stroke(path);
      bc.globalAlpha = 1;
      bc.filter = 'none';

      const rd = rc.getImageData(0, 0, W, H).data;
      const gd = gc.getImageData(0, 0, W, H).data;
      const bd = bc.getImageData(0, 0, W, H).data;

      const out = document.createElement('canvas');
      out.width = W;
      out.height = H;
      const octx = out.getContext('2d');
      const img = octx.createImageData(W, H);
      const o = img.data;
      for (let i = 0; i < rd.length; i += 4) {
        o[i] = rd[i]; // R land mask
        o[i + 1] = gd[i]; // G coast
        o[i + 2] = bd[i]; // B waterline
        o[i + 3] = 255;
      }
      octx.putImageData(img, 0, 0);
      return out.toDataURL('image/png');
    },
    { W, H, landPath, STROKE },
  );

  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

const browser = await chromium.launch({
  executablePath:
    process.env.PW_CHROMIUM ||
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
const page = await browser.newPage();
await page.setContent('<!doctype html><meta charset="utf-8"><body></body>');

for (const [name, W] of [
  ['earth-hb.png', 3072],
  ['earth-hb-2k.png', 1536],
]) {
  const png = await render(page, W);
  const outPath = resolve(outDir, name);
  writeFileSync(outPath, png);
  console.log(`Wrote ${outPath} — ${(png.byteLength / 1024).toFixed(1)} KB (${W}x${W / 2})`);
}

await browser.close();
console.log('done');

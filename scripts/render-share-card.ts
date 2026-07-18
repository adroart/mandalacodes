/**
 * DEV VERIFICATION ONLY — not part of the build or the deploy.
 *
 * Renders the share card for one or more pieces to PNG using the SAME pure
 * composition the edge endpoint uses (`utils/atlas/shareCard.ts`), so the
 * certificate can be eyeballed for composition defects without a live Workers
 * runtime. The edge endpoint rasterizes the identical element tree with
 * workers-og (satori + resvg); this script does it with satori + resvg-wasm
 * directly (both are the same engine), which runs in plain node.
 *
 *   npx tsx scripts/render-share-card.ts <pieceId> [pieceId...] [--out DIR]
 *
 * Artwork bytes are fetched with the system `curl` (it honours the sandbox
 * proxy); a piece with no artwork, or a fetch failure, renders the warm plate.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import satori from 'satori';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import { FULL_ARCHIVE } from '../data/mockData';
import { buildSeedAtlasState } from '../data/atlasSeed';
import { findPublicPiece } from '../lib/atlas/state';
import { CITIES_BY_ID, formatPlaceLabel } from '../data/cities';
import { pieceCode } from '../utils/pieceCode';
import { ulCardNumber } from '../utils/universalLanguage';
import { img } from '../utils/cloudinary';
import { buildShareCardElement, type ShareCardInput } from '../utils/atlas/shareCard';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const outDir = outIdx >= 0 ? args[outIdx + 1] : resolve(root, '.cards');
const pieceIds = args.filter((a, i) => !a.startsWith('--') && i !== outIdx + 1);

const fontDir = resolve(root, 'public/fonts');
const fonts = [
  { name: 'Cinzel', data: readFileSync(resolve(fontDir, 'cinzel-latin-600-normal.woff')), weight: 600 as const, style: 'normal' as const },
  { name: 'Cormorant', data: readFileSync(resolve(fontDir, 'cormorant-garamond-latin-400-normal.woff')), weight: 400 as const, style: 'normal' as const },
  { name: 'Karla', data: readFileSync(resolve(fontDir, 'karla-latin-500-normal.woff')), weight: 500 as const, style: 'normal' as const },
  // The latin subsets have no numero sign (U+2116); the Cormorant cyrillic
  // subset does. Registered last so satori uses it only as a glyph fallback
  // for the sigil's №.
  { name: 'CormorantNumero', data: readFileSync(resolve(fontDir, 'cormorant-garamond-cyrillic-500-normal.woff')), weight: 500 as const, style: 'normal' as const },
];

function fetchArtworkDataUri(coverImage: string): string | null {
  try {
    const url = img(coverImage, { w: 640, h: 640, crop: 'fill', gravity: 'center', format: 'jpg' });
    const bytes = execFileSync('curl', ['-sSL', '--max-time', '30', url], { maxBuffer: 32 * 1024 * 1024 });
    if (!bytes.length) return null;
    return `data:image/jpeg;base64,${Buffer.from(bytes).toString('base64')}`;
  } catch {
    return null;
  }
}

function inputFor(pieceId: string): ShareCardInput {
  const state = buildSeedAtlasState();
  const piece = findPublicPiece(state, pieceId);
  const art = FULL_ARCHIVE.find((a) => a.id === pieceId);
  if (!art) throw new Error(`Unknown piece ${pieceId}`);
  const cardNumber = art.series === 'Universal Language' ? ulCardNumber(art.coverImage) : null;
  const cleanTitle = art.title.replace(/\s*-\s*\d+$/, '');
  const cityId = piece?.cityId ?? null;
  const city = cityId ? CITIES_BY_ID.get(cityId) : undefined;
  return {
    title: cleanTitle,
    sigil: pieceCode({ pieceId, series: art.series, category: art.category, cardNumber: cardNumber ?? undefined, isSignaturePiece: art.isSignaturePiece, sigilNumber: art.sigilNumber }),
    series: art.series,
    // Only a claimed light carries a PUBLIC dream in the state; unawakened /
    // seeking pieces have no intention, so null flows through (privacy rule).
    dream: piece?.intention ?? null,
    claimOrdinal: typeof piece?.claimOrdinal === 'number' ? piece.claimOrdinal : null,
    cityLabel: city ? formatPlaceLabel(city) : null,
    artworkDataUri: art.coverImage ? fetchArtworkDataUri(art.coverImage) : null,
  };
}

async function main() {
  await initWasm(readFileSync(resolve(root, 'node_modules/@resvg/resvg-wasm/index_bg.wasm')));
  mkdirSync(outDir, { recursive: true });
  for (const pieceId of pieceIds) {
    const input = inputFor(pieceId);
    const element = buildShareCardElement(input);
    const svg = await satori(element as unknown as Parameters<typeof satori>[0], {
      width: 1200,
      height: 630,
      fonts,
    });
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
    const out = resolve(outDir, `${pieceId}.png`);
    writeFileSync(out, png);
    console.log(
      `${pieceId}: dream=${input.dream ? `"${input.dream.slice(0, 40)}…"` : 'none'} ordinal=${input.claimOrdinal ?? '-'} art=${input.artworkDataUri ? 'yes' : 'plate'} -> ${out} (${png.length} bytes)`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Piece Plaque Generator — the PUBLIC back-of-piece plaque for ANY artwork.
 *
 * Emits, per FULL_ARCHIVE piece (or a single --piece=<id>), the public plaque
 * SVG that goes on the back of the physical work: the piece's sigil
 * (utils/pieceCode.ts), its title, and a QR encoding the IMMUTABLE printed URL
 *
 *     https://mandalacodes.com/qr/piece/<id>[/<edition>]
 *
 * The runtime redirect (functions/qr/piece/[[path]].js) forwards that URL to
 * the certificate for any pieceId, so the destination can evolve while the
 * printed URL never breaks (the forever contract,
 * todo/plans/claim-code-integration.md). This is the PUBLIC plaque ONLY — the
 * private claim insert prints from AdminAtlas, never from disk.
 *
 * Style-matched to scripts/generate-ul-qr.ts: the same 85×130 mm engraved
 * certificate feel, the same paper/ink/bronze/wood palette, generous quiet.
 *
 * Usage:
 *   npx tsx scripts/generate-piece-plaques.ts               (every piece)
 *   npx tsx scripts/generate-piece-plaques.ts --piece=UL-100 (one piece)
 *
 * Edit BASE_URL when canonical paths change, then re-run.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';

import { FULL_ARCHIVE } from '../data/mockData';
import { pieceCode } from '../utils/pieceCode';
import { slugify } from './slugify';
import type { Artwork } from '../types';

// ── URL config — edit here when canonical paths change ────────────────────────

const BASE_URL = 'https://mandalacodes.com';

/** The immutable printed URL for a piece's public QR. The runtime redirect
 *  handles any pieceId, so this URL is a forever contract once printed. */
function pieceQrUrl(pieceId: string, edition?: number): string {
  const tail = typeof edition === 'number' ? `/${edition}` : '';
  return `${BASE_URL}/qr/piece/${pieceId}${tail}`;
}

// ── Plaque dimensions ─────────────────────────────────────────────────────────
// 85×130 mm — the same portrait card the oracle plaques use.

const W = 85; // mm
const H = 130; // mm
const CX = W / 2;

// ── Colour palette (byte-identical to generate-ul-qr.ts) ──────────────────────

const PAPER = '#f5f0e8'; // warm off-white background
const INK = '#2c2c2c'; // title, QR dark modules
const BRONZE = '#8b6914'; // sigil (accent/label)
const WOOD = '#5a4a35'; // series line
const MUTED = '#a09070'; // lightest text (host line)

// ── Typography helpers ────────────────────────────────────────────────────────
// Usable text width ≈ 68 mm. Font sizes are SVG mm units (= pt at 1:1 viewBox).

/** Adaptive size for the title (Cormorant Garamond italic), matching the UL
 *  generator's card-name scale but tuned for longer piece titles. */
function titleFontSize(name: string): number {
  const len = name.length;
  if (len <= 12) return 9;
  if (len <= 16) return 8;
  if (len <= 20) return 7;
  if (len <= 26) return 6;
  if (len <= 34) return 5;
  return 4.4;
}

function titleHeight(fontSize: number): number {
  return fontSize * 0.88;
}

/** Adaptive size + letter-spacing for the sigil (Cinzel uppercase). Sigils are
 *  short ("UL № 1", "MA № 14") so this stays generous. */
function sigilStyle(sigil: string): { fontSize: number; letterSpacing: number } {
  return sigil.length <= 10
    ? { fontSize: 4, letterSpacing: 1.4 }
    : { fontSize: 3.4, letterSpacing: 0.9 };
}

// ── SVG helpers ───────────────────────────────────────────────────────────────

function r(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function embedQR(qrSvgStr: string, x: number, y: number, size: number): string {
  const vbMatch = qrSvgStr.match(/viewBox="([^"]+)"/);
  const innerMatch = qrSvgStr.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
  const viewBox = vbMatch ? vbMatch[1] : '0 0 37 37';
  const inner = innerMatch ? innerMatch[1].trim() : '';
  return (
    `<svg x="${r(x)}" y="${r(y)}" width="${r(size)}" height="${r(size)}" ` +
    `viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`
  );
}

// ── Plaque builder ────────────────────────────────────────────────────────────

interface PlaqueOpts {
  sigil: string;
  title: string;
  seriesLine: string; // series (or category) — a quiet line under the title
  qrUrl: string;
}

async function buildPlaque(opts: PlaqueOpts): Promise<string> {
  const { sigil, title, seriesLine, qrUrl } = opts;

  // ── Adaptive layout, top-to-bottom (dominant-baseline="hanging"). ──
  const sigStyle = sigilStyle(sigil);
  const tFontSize = titleFontSize(title);
  const tHeight = titleHeight(tFontSize);

  const sigilY = 20; // the sigil, quiet at the top like an edition mark
  const sigilH = sigStyle.fontSize * 0.75;
  const titleY = sigilY + sigilH + 10; // the title (hero)
  const seriesY = titleY + tHeight + 6; // series/category whisper
  const seriesH = 3 * 0.75;

  // QR — centred, large enough to scan reliably from any phone distance.
  const qrSize = 40;
  const qrX = CX - qrSize / 2;
  const qrY = seriesY + seriesH + 12; // generous breath before the QR

  // Host line — a quiet pointer under the QR, like a printer's imprint.
  const hostY = qrY + qrSize + 6;

  const qrSvgStr = await QRCode.toString(qrUrl, {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'L',
    color: { dark: INK, light: PAPER },
  });
  const qrSvg = embedQR(qrSvgStr, qrX, qrY, qrSize);

  const seriesEl = seriesLine
    ? `<text x="${CX}" y="${r(seriesY)}"
    text-anchor="middle" dominant-baseline="hanging"
    font-family="Lato, Helvetica, sans-serif"
    font-size="3" letter-spacing="0.3" fill="${WOOD}">${escXml(seriesLine)}</text>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm">

  <rect width="${W}" height="${H}" fill="${PAPER}"/>

  <text x="${CX}" y="${r(sigilY)}"
    text-anchor="middle" dominant-baseline="hanging"
    font-family="Cinzel, Palatino, serif"
    font-size="${sigStyle.fontSize}" letter-spacing="${sigStyle.letterSpacing}" fill="${BRONZE}">${escXml(sigil)}</text>

  <text x="${CX}" y="${r(titleY)}"
    text-anchor="middle" dominant-baseline="hanging"
    font-family="'Cormorant Garamond', Garamond, Georgia, serif"
    font-size="${tFontSize}" font-style="italic" fill="${INK}">${escXml(title)}</text>

  ${seriesEl}

  ${qrSvg}

  <text x="${CX}" y="${r(hostY)}"
    text-anchor="middle" dominant-baseline="hanging"
    font-family="Cinzel, Palatino, serif"
    font-size="2.6" letter-spacing="0.6" fill="${MUTED}">mandalacodes.com</text>

</svg>`;
}

// ── Index HTML builder ────────────────────────────────────────────────────────

function buildIndex(items: Array<{ filename: string; sigil: string; title: string }>): string {
  const cells = items
    .map(
      ({ filename, sigil, title }) => `
    <div class="item">
      <a href="${filename}" target="_blank">
        <img src="${filename}" alt="${escXml(title)}">
      </a>
      <div class="label">${escXml(sigil)} — ${escXml(title)}</div>
    </div>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Piece Plaques</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #111009; font-family: sans-serif; padding: 32px; }
    h1 { color: #f5f0e8; font-size: 15px; font-weight: 400; letter-spacing: 0.2em;
         text-transform: uppercase; margin-bottom: 6px; }
    p  { color: #6b5d48; font-size: 11px; margin-bottom: 32px; letter-spacing: 0.05em; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 16px; }
    .item { text-align: center; }
    .item a { display: block; }
    .item img { width: 100%; display: block; background: #f5f0e8;
                border: 1px solid #1e1a14; transition: border-color 0.2s; }
    .item a:hover img { border-color: #8b6914; }
    .label { color: #6b5d48; font-size: 10px; margin-top: 6px; letter-spacing: 0.04em; }
  </style>
</head>
<body>
  <h1>Piece Plaques · Public QR</h1>
  <p>${items.length} plaque${items.length === 1 ? '' : 's'} · 85 × 130 mm · Click any plaque to open the full SVG</p>
  <div class="grid">${cells}
  </div>
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

/** Series/category whisper line — the series when named, else the category. */
function seriesLineFor(art: Artwork): string {
  return art.series ?? art.category ?? '';
}

async function main(): Promise<void> {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const outDir = join(scriptDir, 'output', 'piece-plaques');
  mkdirSync(outDir, { recursive: true });

  const pieceArg = process.argv.find((a) => a.startsWith('--piece='));
  const onlyId = pieceArg ? pieceArg.slice('--piece='.length).trim() : null;

  const pieces = onlyId ? FULL_ARCHIVE.filter((a) => a.id === onlyId) : FULL_ARCHIVE;

  if (pieces.length === 0) {
    console.error(
      onlyId
        ? `No FULL_ARCHIVE piece with id "${onlyId}".`
        : 'FULL_ARCHIVE is empty — nothing to generate.',
    );
    process.exitCode = 1;
    return;
  }

  const indexEntries: Array<{ filename: string; sigil: string; title: string }> = [];
  let count = 0;

  for (const art of pieces) {
    const cleanTitle = art.title.replace(/\s*-\s*\d+$/, '');
    const sigil = pieceCode({
      pieceId: art.id,
      series: art.series,
      category: art.category,
      cardNumber: art.cardNumber,
      isSignaturePiece: art.isSignaturePiece,
      sigilNumber: art.sigilNumber,
    });

    const svg = await buildPlaque({
      sigil,
      title: cleanTitle,
      seriesLine: seriesLineFor(art),
      qrUrl: pieceQrUrl(art.id, art.editionNumber),
    });

    const filename = `${slugify(art.id)}-${slugify(cleanTitle)}.svg`;
    writeFileSync(join(outDir, filename), svg, 'utf8');
    indexEntries.push({ filename, sigil, title: cleanTitle });
    count++;
  }

  writeFileSync(join(outDir, 'index.html'), buildIndex(indexEntries), 'utf8');

  console.log(`\nGenerated ${count} piece plaque${count === 1 ? '' : 's'}  →  ${outDir}`);
  console.log(`  Preview  →  ${join(outDir, 'index.html')}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

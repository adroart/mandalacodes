/**
 * Cloudflare Pages Function — /piece/:pieceId  and  /piece/:pieceId/:edition
 *
 * Server-rendered social metadata for piece pages, the same move the oracle's
 * per-number cards make (functions/universal-language/[number].js): rewrite the
 * Open Graph / Twitter tags in index.html at the edge so a piece link dropped
 * in a chat or a story unfurls as the piece's CERTIFICATE, not a generic site
 * preview. The og:image points at the card image endpoint (/api/atlas/card/*).
 *
 * Human traffic is unaffected: the function returns the full index.html shell
 * (with the tags rewritten), React boots exactly as before and client-routes
 * /piece/:id. Crawlers, which do not run JS, read the correct tags immediately.
 *
 * BINDING RULE (privacy): og:description carries the PUBLIC dream only when one
 * rides the map (piece.intention, present in the public projection solely after
 * the steward shares it); otherwise it falls back to the series line. A private
 * dream is never read here, so it can never appear in a preview.
 */

import {
  readCanonicalAtlasState,
  type CanonicalAtlasEnv,
} from '../api/atlas/_canonical';
import { FULL_ARCHIVE } from '../../data/mockData';
import { pieceCode } from '../../utils/pieceCode';
import { ulCardNumber } from '../../utils/universalLanguage';

interface PieceMetaEnv extends CanonicalAtlasEnv {
  ASSETS: { fetch: (req: Request | string) => Promise<Response> };
}

interface PagesFn {
  request: Request;
  env: PieceMetaEnv;
  params: { path?: string | string[] };
}

/** Escape a value for use inside a double-quoted HTML attribute, and collapse
 *  whitespace so a multi-line dream stays on one meta line. */
function attr(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clip(text: string, max = 200): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export async function onRequestGet(ctx: PagesFn): Promise<Response> {
  const { env, request, params } = ctx;

  const indexUrl = new URL(request.url);
  indexUrl.pathname = '/index.html';
  indexUrl.search = '';
  const shell = await env.ASSETS.fetch(new Request(indexUrl.toString(), { method: 'GET' }));
  let html = await shell.text();

  const respond = () =>
    new Response(html, { headers: { 'content-type': 'text/html;charset=UTF-8' } });

  const segments = Array.isArray(params.path)
    ? params.path
    : params.path
      ? [params.path]
      : [];
  const pieceId = (segments[0] || '').trim();
  const editionRaw = segments[1];
  if (editionRaw !== undefined && (!/^\d+$/.test(editionRaw) || !Number.isSafeInteger(Number(editionRaw)) || Number(editionRaw) < 1)) return respond();
  const editionNumber =
    editionRaw !== undefined && /^\d+$/.test(editionRaw) ? parseInt(editionRaw, 10) : undefined;

  const art = pieceId ? FULL_ARCHIVE.find((a) => a.id === pieceId) : undefined;

  // Resolve the public projection for the dream + series/category (fail-soft: a
  // read error just falls back to the series line, never the private record).
  // A piece present here but absent from FULL_ARCHIVE (a shipped-but-not-yet-
  // catalogued piece) must STILL unfurl its certificate — a scanned QR may
  // never dead-end (forever contract). Only a piece in NEITHER the archive nor
  // the public state hands back the shell unchanged (React renders not-found).
  let dream: string | undefined;
  let pubSeries: string | undefined;
  let pubCategory: string | undefined;
  let foundInState = false;
  const physicalRequest = editionRaw !== undefined || new URL(request.url).searchParams.get('ref') === 'qr';
  try {
    const state = await readCanonicalAtlasState(request, env);
    if (!state) throw new Error('Canonical Atlas unavailable');
    const piece =
      typeof editionNumber === 'number'
        ? state.pieces.find((p) => p.pieceId === pieceId && (p.editionNumber ?? 0) === editionNumber)
        : state.pieces.find((p) => p.pieceId === pieceId);
    if (piece) {
      foundInState = true;
      pubSeries = piece.series;
      pubCategory = piece.category;
      if (piece.intention && piece.intention.trim()) dream = piece.intention.trim();
    }
  } catch {
    /* series line stands */
  }

  if ((!art || physicalRequest) && !foundInState) return respond();

  const series = art?.series ?? pubSeries;
  const category = art?.category ?? pubCategory;
  const cardNumber =
    art && art.series === 'Universal Language' ? art.cardNumber ?? null : null;
  const sigil = pieceCode({
    pieceId,
    series,
    category,
    cardNumber: cardNumber ?? undefined,
    isSignaturePiece: art?.isSignaturePiece,
    sigilNumber: art?.sigilNumber,
  });
  // Title falls back to the sigil when the piece is not yet catalogued.
  const cleanTitle = art ? art.title.replace(/\s*-\s*\d+$/, '') : sigil;

  const title = art ? `${cleanTitle} · ${sigil}` : sigil;
  const seriesLine =
    `${series ? `${series}` : sigil}${cardNumber != null ? ` · Code ${cardNumber}` : ''}. ` +
    `Painted and assembled by hand by Adrian Rasmussen.`;
  const description = clip(physicalRequest ? dream ?? seriesLine : `${seriesLine} Artwork design; physical pieces have their own public code and Piece Record.`);

  const origin = new URL(request.url).origin;
  const cardPath = `/api/atlas/card/${encodeURIComponent(pieceId)}${
    typeof editionNumber === 'number' ? `/${editionNumber}` : ''
  }`;
  const image = `${origin}${cardPath}`;

  const t = attr(title);
  const d = attr(description);
  const im = attr(image);

  html = html
    .replace(/<title>[^<]*<\/title>/, `<title>${t}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*"/, `$1${d}"`)
    .replace(/(<meta\s+property="og:title"\s+content=")[^"]*"/, `$1${t}"`)
    .replace(/(<meta\s+property="og:description"\s+content=")[^"]*"/, `$1${d}"`)
    .replace(/(<meta\s+property="og:image"\s+content=")[^"]*"/, `$1${im}"`)
    .replace(/(<meta\s+property="og:image:width"\s+content=")[^"]*"/, `$11200"`)
    .replace(/(<meta\s+property="og:image:height"\s+content=")[^"]*"/, `$1630"`)
    .replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*"/, `$1${t}"`)
    .replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*"/, `$1${d}"`)
    .replace(/(<meta\s+name="twitter:image"\s+content=")[^"]*"/, `$1${im}"`)
    .replace(/(<meta\s+name="twitter:card"\s+content=")[^"]*"/, `$1summary_large_image"`);

  return respond();
}

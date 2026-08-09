/**
 * GET /api/atlas/card/:pieceId
 * GET /api/atlas/card/:pieceId/:edition
 *
 * The share card as a 1200x630 PNG: the piece's certificate, composed in the
 * certificate grammar (warm paper, hairline frame, the artwork, the title and
 * sigil, the PUBLIC dream when one rides the map, the founding-light line when
 * claimed, the double-ring seal). This is what a piece link unfurls into when
 * dropped in a chat or a story (via functions/piece/[[path]].ts's og:image),
 * and what the steward downloads from their book.
 *
 * Rendering: runtime PNG at the edge. Crawlers do not run JS and generally
 * reject SVG og:images, so a PNG must be produced. A build-time pre-render is
 * unfit here because the card's live data (a fresh claim, a just-shared dream,
 * a placement) lives in R2 and is unreachable at build; only a runtime read of
 * the public state renders a card that is correct the instant the link is
 * posted. We compose the certificate with `utils/atlas/shareCard` (pure) and
 * rasterize with workers-og (satori + resvg-wasm), the OG-image stack built
 * for the Workers runtime. Fonts are served from /public/fonts.
 *
 * BINDING RULE (privacy): the dream is read ONLY from the piece's PUBLIC
 * projection (`piece.intention`, which is present only when the steward has
 * shared it on the map). An unshared dream never reaches this function, so it
 * can never reach a card. No call to action, no logo, no marketing furniture.
 */

import { ImageResponse } from 'workers-og';
import {
  readCanonicalAtlasState,
  type CanonicalAtlasEnv,
} from '../_canonical';
import { FULL_ARCHIVE } from '../../../../data/mockData';
import { CITIES_BY_ID, formatPlaceLabel } from '../../../../data/cities';
import { pieceCode } from '../../../../utils/pieceCode';
import { ulCardNumber } from '../../../../utils/universalLanguage';
import { img } from '../../../../utils/cloudinary';
import { buildShareCardElement } from '../../../../utils/atlas/shareCard';

/** The static-asset binding every Pages Function receives, used to read the
 *  embedded fonts from /public/fonts (same accessor the UL/piece meta
 *  functions use for index.html). */
interface CardEnv extends CanonicalAtlasEnv {
  ASSETS: { fetch: (req: Request | string) => Promise<Response> };
}

interface PagesFn {
  request: Request;
  env: CardEnv;
  params: { path?: string | string[] };
}

// ── Fonts, fetched once per isolate from the deployed assets ──
interface LoadedFont {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 500 | 600;
  style: 'normal';
}
let fontCache: LoadedFont[] | null = null;

const FONT_FILES: { file: string; name: string; weight: 400 | 500 | 600 }[] = [
  { file: 'cinzel-latin-600-normal.woff', name: 'Cinzel', weight: 600 },
  { file: 'cormorant-garamond-latin-400-normal.woff', name: 'Cormorant', weight: 400 },
  { file: 'karla-latin-500-normal.woff', name: 'Karla', weight: 500 },
  // The latin subsets carry no numero sign (U+2116); the Cormorant cyrillic
  // subset does. Registered last, it serves only as the glyph fallback for
  // the sigil's №.
  { file: 'cormorant-garamond-cyrillic-500-normal.woff', name: 'CormorantNumero', weight: 500 },
];

async function loadFonts(env: CardEnv, origin: string): Promise<LoadedFont[]> {
  if (fontCache) return fontCache;
  const loaded = await Promise.all(
    FONT_FILES.map(async (f) => {
      const res = await env.ASSETS.fetch(`${origin}/fonts/${f.file}`);
      const data = await res.arrayBuffer();
      return { name: f.name, data, weight: f.weight, style: 'normal' as const };
    }),
  );
  fontCache = loaded;
  return loaded;
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/** Fetch the artwork and inline it as a data URI (resvg does not fetch remote
 *  images). Any failure returns null so the warm plate fallback renders. */
async function artworkDataUri(coverImage: string | undefined): Promise<string | null> {
  if (!coverImage) return null;
  try {
    const url = img(coverImage, { w: 640, h: 640, crop: 'fill', gravity: 'center', format: 'jpg' });
    const res = await fetch(url, { cf: { cacheTtl: 86400, cacheEverything: true } } as RequestInit);
    if (!res.ok) return null;
    return `data:image/jpeg;base64,${toBase64(await res.arrayBuffer())}`;
  } catch {
    return null;
  }
}

export async function onRequestGet(ctx: PagesFn): Promise<Response> {
  const { env, request, params } = ctx;
  const segments = Array.isArray(params.path)
    ? params.path
    : params.path
      ? [params.path]
      : [];
  const pieceId = (segments[0] || '').trim();
  const editionRaw = segments[1];
  const editionNumber =
    editionRaw !== undefined && /^\d+$/.test(editionRaw) ? parseInt(editionRaw, 10) : undefined;

  if (!pieceId) return new Response('Not found', { status: 404 });

  const art = FULL_ARCHIVE.find((a) => a.id === pieceId);
  if (!art) return new Response('Not found', { status: 404 });

  const state = await readCanonicalAtlasState(request, env);
  if (!state) {
    return Response.json(
      { ok: false, error: 'atlas_source_unavailable' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  // Public-piece lookup (inlined so this function pulls in no React from
  // lib/atlas/state): match on pieceId, honouring an explicit edition.
  const piece =
    (typeof editionNumber === 'number'
      ? state.pieces.find((p) => p.pieceId === pieceId && (p.editionNumber ?? 0) === editionNumber)
      : state.pieces.find((p) => p.pieceId === pieceId)) ?? null;

  const cardNumber = art.series === 'Universal Language' ? ulCardNumber(art.coverImage) : null;
  const cleanTitle = art.title.replace(/\s*-\s*\d+$/, '');
  const cityId = piece?.cityId ?? null;
  const city = cityId ? CITIES_BY_ID.get(cityId) : undefined;

  const element = buildShareCardElement({
    title: cleanTitle,
    sigil: pieceCode({
      pieceId,
      series: piece?.series ?? art.series,
      category: piece?.category ?? art.category,
      cardNumber: cardNumber ?? undefined,
      isSignaturePiece: art.isSignaturePiece,
      sigilNumber: art.sigilNumber,
    }),
    series: piece?.series ?? art.series,
    // PUBLIC dream only — present in the projection solely when shared.
    dream: piece?.intention ?? null,
    claimOrdinal: typeof piece?.claimOrdinal === 'number' ? piece.claimOrdinal : null,
    cityLabel: city ? formatPlaceLabel(city) : null,
    artworkDataUri: await artworkDataUri(art.coverImage),
  });

  const origin = new URL(request.url).origin;
  const fonts = await loadFonts(env, origin);

  // `element` is a satori element tree (the shape satori consumes); it is not
  // typed as a React node, so cast to the constructor's first parameter type.
  const image = new ImageResponse(
    element as unknown as ConstructorParameters<typeof ImageResponse>[0],
    { width: 1200, height: 630, format: 'png', fonts },
  );

  // Re-wrap so the card carries a cache header (ImageResponse sets only the
  // content type). A short public TTL keeps a freshly-shared dream appearing
  // quickly while still sparing repeated renders.
  return new Response(image.body, {
    headers: {
      'Content-Type': image.headers.get('content-type') ?? 'image/png',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}

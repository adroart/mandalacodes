/**
 * The honest boundary.
 *
 * The collector record moved to the artist site on 2026-08-09. This repo
 * retired its collector write path on purpose: functions/api/atlas/_middleware
 * answers HTTP 410 for every /api/atlas/* route except three public reads, and
 * its body carries an `error` code (`atlas_moved` or `atlas_reader_moved`), the
 * server's own `message`, and a `destination`.
 *
 * That boundary is correct and stays. What was missing was the other half: the
 * front end never read the code or the destination, so a collector standing at
 * the claim ceremony met a generic failure and a "try again" button that
 * re-fired the same doomed request forever.
 *
 * This module is the one place that recognises the boundary. Every screen reads
 * it through here, so there is one behaviour and one set of words, not fifteen.
 *
 * Two rules live in this file:
 *   1. Retrying a 410 cannot succeed, so a boundary never carries a retry.
 *   2. No raw code reaches a human. The server's own `message` is kept for
 *      diagnostics, never rendered: it speaks in repo names and reader
 *      internals, and the person reading it may be holding a piece they just
 *      bought. The one house sentence below is what they see instead.
 */

export type AtlasBoundaryCode = 'atlas_moved' | 'atlas_reader_moved';

const BOUNDARY_CODES: readonly string[] = ['atlas_moved', 'atlas_reader_moved'];

/** The collector record's front door, when the server names nothing usable. */
export const ATLAS_BOUNDARY_DESTINATION = 'https://adrianrasmussen.com/atlas';

/** The one sentence. Calm, factual, no apology and no blame. */
export const ATLAS_BOUNDARY_SENTENCE =
  'The collector record now lives on the artist site.';

/** The one door label. Text only, and it goes somewhere. */
export const ATLAS_BOUNDARY_LINK_LABEL = 'Open the collector record';

export interface AtlasBoundary {
  code: AtlasBoundaryCode;
  /** The server's own words. Kept for logs and tests, never rendered. */
  serverMessage: string;
  /** A page a person can actually open, derived from what the server named. */
  destination: string;
  /** ISO date the record moved, when the server stamped one. */
  movedAt?: string;
}

/**
 * Turn whatever the server named into somewhere a person can go.
 *
 * The middleware names its API origin (`https://adrianrasmussen.com/api/atlas`),
 * which serves JSON: measured 2026-09-01, that path answers application/json
 * while `/atlas` on the same host answers text/html. Handing a collector a page
 * of JSON is not a door, so an /api path resolves to the record's front door on
 * the same host. Anything that is not a plain http(s) URL falls back to the
 * canonical door rather than becoming a link nobody can trust.
 */
export function humanAtlasDestination(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) return ATLAS_BOUNDARY_DESTINATION;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return ATLAS_BOUNDARY_DESTINATION;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return ATLAS_BOUNDARY_DESTINATION;
  }
  if (url.username || url.password) return ATLAS_BOUNDARY_DESTINATION;
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    return `${url.origin}/atlas`;
  }
  return url.href;
}

/**
 * Recognise a moved-boundary response from its status and parsed body.
 * Anything else is null, so a genuinely transient failure keeps its own
 * handling (and its retry).
 */
export function atlasBoundaryFrom(status: number, body: unknown): AtlasBoundary | null {
  if (status !== 410) return null;
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  const code = record.error;
  if (typeof code !== 'string' || !BOUNDARY_CODES.includes(code)) return null;
  return {
    code: code as AtlasBoundaryCode,
    serverMessage: typeof record.message === 'string' ? record.message : '',
    destination: humanAtlasDestination(record.destination),
    ...(typeof record.movedAt === 'string' ? { movedAt: record.movedAt } : {}),
  };
}

/**
 * Recognise the boundary straight off a fetch Response. The response is cloned,
 * so the caller can still read its body afterwards.
 */
export async function readAtlasBoundary(res: Response): Promise<AtlasBoundary | null> {
  if (res.status !== 410) return null;
  try {
    const body = await res.clone().json();
    return atlasBoundaryFrom(res.status, body);
  } catch {
    // A 410 whose body we cannot read is still the boundary; the middleware is
    // the only thing that answers 410 on these routes.
    return {
      code: 'atlas_moved',
      serverMessage: '',
      destination: humanAtlasDestination(res.headers.get('Link')?.match(/<([^>]+)>/)?.[1]),
    };
  }
}

/**
 * A code has no spaces; a sentence does. Server bodies on these routes carry
 * both kinds in the same `error` field, and screens used to render it straight
 * out, which is how the string `atlas_moved` ended up in front of a collector.
 */
function humanText(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const value = (body as Record<string, unknown>).error;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || !/\s/.test(trimmed)) return null;
  return trimmed;
}

/**
 * The message to show for a failed atlas call. A moved boundary speaks the one
 * house sentence; everything else keeps the screen's own words, and a bare code
 * never survives.
 */
export function atlasFailureMessage(
  status: number,
  body: unknown,
  fallback: string,
): string {
  if (atlasBoundaryFrom(status, body)) return ATLAS_BOUNDARY_SENTENCE;
  return humanText(body) ?? fallback;
}

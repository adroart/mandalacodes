import type { PublicAtlasState } from '../../../types';

export const ATLAS_MOVE_DATE = '2026-08-09';
export const DEFAULT_CANONICAL_ATLAS_URL =
  'https://adrianrasmussen.com/api/atlas';

export interface CanonicalAtlasEnv {
  ATLAS_CANONICAL_URL?: string;
}

export function canonicalAtlasUrl(env: CanonicalAtlasEnv): URL | null {
  try {
    const url = new URL(
      env.ATLAS_CANONICAL_URL || DEFAULT_CANONICAL_ATLAS_URL,
    );
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

export function isMandalaAtlasLoop(source: URL, request: Request): boolean {
  const requestUrl = new URL(request.url);
  const sourceHost = source.hostname.toLowerCase();
  const isMandalaHost =
    sourceHost === 'mandalacodes.com' ||
    sourceHost.endsWith('.mandalacodes.com') ||
    sourceHost === 'mandalacodes.pages.dev' ||
    sourceHost.endsWith('.mandalacodes.pages.dev');

  return isMandalaHost || source.origin === requestUrl.origin;
}

export function atlasReadError(
  error: 'atlas_source_invalid' | 'atlas_source_loop' | 'atlas_source_unavailable',
  status: number,
): Response {
  return Response.json(
    {
      ok: false,
      error,
      destination: DEFAULT_CANONICAL_ATLAS_URL,
      movedAt: ATLAS_MOVE_DATE,
    },
    {
      status,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}

/** Fetch the canonical public Atlas. The upstream request is always GET:
 * Adrian-Website exposes JSON at this route but intentionally rejects HEAD.
 * Callers that serve HEAD strip the returned body themselves. */
export async function fetchCanonicalAtlas(
  request: Request,
  env: CanonicalAtlasEnv,
): Promise<Response> {
  const source = canonicalAtlasUrl(env);
  if (!source) return atlasReadError('atlas_source_invalid', 503);
  if (isMandalaAtlasLoop(source, request)) {
    return atlasReadError('atlas_source_loop', 503);
  }

  try {
    return await fetch(
      new Request(source, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      }),
    );
  } catch {
    return atlasReadError('atlas_source_unavailable', 502);
  }
}

/** Parse a compatible canonical response for internal read-only consumers.
 * Failure is null, never a fallback to Mandala R2 or seeded placements. */
export async function readCanonicalAtlasState(
  request: Request,
  env: CanonicalAtlasEnv,
): Promise<PublicAtlasState | null> {
  const response = await fetchCanonicalAtlas(request, env);
  if (!response.ok) return null;
  try {
    const body = (await response.json()) as { ok?: unknown; state?: unknown };
    if (body?.ok !== true || !body.state || typeof body.state !== 'object') return null;
    const state = body.state as PublicAtlasState;
    return Array.isArray(state.pieces) && Array.isArray(state.cities) ? state : null;
  } catch {
    return null;
  }
}

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

function isAdrianCanonicalHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'adrianrasmussen.com' || host.endsWith('.adrianrasmussen.com');
}

function isSafeCanonicalRedirect(next: URL, current: URL, configured: URL): boolean {
  if (next.protocol !== 'https:' || next.username || next.password) return false;
  if (next.origin === current.origin) return true;
  return (
    isAdrianCanonicalHost(configured.hostname) &&
    isAdrianCanonicalHost(next.hostname)
  );
}

export function atlasReadError(
  error:
    | 'atlas_source_invalid'
    | 'atlas_source_loop'
    | 'atlas_source_redirect_unsafe'
    | 'atlas_source_redirect_limit'
    | 'atlas_source_unavailable',
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

  let current = source;
  const maxRedirects = 3;
  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    let response: Response;
    try {
      response = await fetch(
        new Request(current, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          redirect: 'manual',
        }),
      );
    } catch {
      return atlasReadError('atlas_source_unavailable', 502);
    }

    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    if (redirects === maxRedirects) {
      return atlasReadError('atlas_source_redirect_limit', 503);
    }

    const location = response.headers.get('Location');
    let next: URL;
    try {
      if (!location) throw new Error('missing redirect location');
      next = new URL(location, current);
    } catch {
      return atlasReadError('atlas_source_redirect_unsafe', 503);
    }
    if (isMandalaAtlasLoop(next, request)) {
      return atlasReadError('atlas_source_loop', 503);
    }
    if (!isSafeCanonicalRedirect(next, current, source)) {
      return atlasReadError('atlas_source_redirect_unsafe', 503);
    }
    current = next;
  }

  return atlasReadError('atlas_source_redirect_limit', 503);
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

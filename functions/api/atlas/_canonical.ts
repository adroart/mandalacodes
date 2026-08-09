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

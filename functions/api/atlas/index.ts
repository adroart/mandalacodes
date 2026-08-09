/**
 * GET /api/atlas
 *
 * Public, no auth. Mandala Codes keeps the Atlas / Universal Language
 * presentation, while Adrian-Website owns the canonical collector record.
 * Proxy that public JSON without consulting Mandala's frozen R2 objects.
 */

import {
  atlasReadError,
  canonicalAtlasUrl,
  isMandalaAtlasLoop,
  type CanonicalAtlasEnv,
} from './_canonical';

interface AtlasReadContext {
  request: Request;
  env: CanonicalAtlasEnv;
}

async function proxyCanonicalAtlas(
  context: AtlasReadContext,
): Promise<Response> {
  const source = canonicalAtlasUrl(context.env);
  if (!source) return atlasReadError('atlas_source_invalid', 503);
  if (isMandalaAtlasLoop(source, context.request)) {
    return atlasReadError('atlas_source_loop', 503);
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      new Request(source, {
        method: context.request.method === 'HEAD' ? 'HEAD' : 'GET',
        headers: { Accept: 'application/json' },
      }),
    );
  } catch {
    return atlasReadError('atlas_source_unavailable', 502);
  }

  return new Response(context.request.method === 'HEAD' ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstream.headers,
  });
}

export async function onRequestGet(
  context: AtlasReadContext,
): Promise<Response> {
  return proxyCanonicalAtlas(context);
}

export async function onRequestHead(
  context: AtlasReadContext,
): Promise<Response> {
  return proxyCanonicalAtlas(context);
}

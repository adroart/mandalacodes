/**
 * GET /api/atlas
 *
 * Public, no auth. Mandala Codes keeps the Atlas / Universal Language
 * presentation, while Adrian-Website owns the canonical collector record.
 * Proxy that public JSON without consulting Mandala's frozen R2 objects.
 */

import {
  fetchCanonicalAtlas,
  type CanonicalAtlasEnv,
} from './_canonical';

interface AtlasReadContext {
  request: Request;
  env: CanonicalAtlasEnv;
}

async function proxyCanonicalAtlas(
  context: AtlasReadContext,
): Promise<Response> {
  const upstream = await fetchCanonicalAtlas(context.request, context.env);

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

/**
 * GET /api/atlas
 *
 * Public, no auth. Mandala Codes keeps the Atlas / Universal Language
 * presentation, while Adrian-Website owns the canonical collector record.
 * Proxy that public JSON without consulting Mandala's frozen R2 objects.
 * When the canonical side answers in its collector-field shape, project it
 * into PublicAtlasState at this seam so every Mandala reader — the page,
 * the card seat, the piece page — keeps one contract.
 */

import {
  fetchCanonicalAtlas,
  type CanonicalAtlasEnv,
} from './_canonical';
import { adaptCollectorFieldState } from './_collectorField';

interface AtlasReadContext {
  request: Request;
  env: CanonicalAtlasEnv;
}

async function proxyCanonicalAtlas(
  context: AtlasReadContext,
): Promise<Response> {
  const upstream = await fetchCanonicalAtlas(context.request, context.env);

  if (upstream.ok) {
    let body: { ok?: unknown; state?: unknown } | null = null;
    try {
      body = (await upstream.clone().json()) as { ok?: unknown; state?: unknown };
    } catch {
      body = null;
    }
    if (body?.ok === true) {
      const adapted = adaptCollectorFieldState(body.state);
      if (adapted) {
        const headers = { 'Cache-Control': 'no-store' };
        if (context.request.method === 'HEAD') {
          return new Response(null, { status: upstream.status, headers });
        }
        return Response.json(
          { ok: true, state: adapted },
          { status: upstream.status, headers },
        );
      }
    }
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

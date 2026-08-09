import {
  ATLAS_MOVE_DATE,
  DEFAULT_CANONICAL_ATLAS_URL,
  canonicalAtlasUrl,
  isMandalaAtlasLoop,
  type CanonicalAtlasEnv,
} from './_canonical';

interface AtlasMiddlewareContext {
  request: Request;
  env: CanonicalAtlasEnv;
  next(): Promise<Response>;
}

const ALLOWED_METHODS = 'GET, HEAD, OPTIONS';

function destinationFor(context: AtlasMiddlewareContext): string {
  const configured = canonicalAtlasUrl(context.env);
  if (!configured || isMandalaAtlasLoop(configured, context.request)) {
    return DEFAULT_CANONICAL_ATLAS_URL;
  }
  return configured.href;
}

function boundaryHeaders(destination: string): Record<string, string> {
  return {
    Allow: ALLOWED_METHODS,
    'Access-Control-Allow-Methods': ALLOWED_METHODS,
    'Cache-Control': 'no-store',
    Link: `<${destination}>; rel="canonical"`,
  };
}

export async function onRequest(
  context: AtlasMiddlewareContext,
): Promise<Response> {
  const method = context.request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD') return context.next();

  const destination = destinationFor(context);
  const headers = boundaryHeaders(destination);
  if (method === 'OPTIONS') return new Response(null, { status: 204, headers });

  return Response.json(
    {
      ok: false,
      error: 'atlas_moved',
      message:
        'The Atlas collector record moved to Adrian-Website and is read-only on Mandala Codes.',
      readOnly: true,
      movedAt: ATLAS_MOVE_DATE,
      destination,
    },
    { status: 410, headers },
  );
}

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

/** Reads that no longer depend on Mandala's frozen holder/ledger evidence. */
function isSurvivingPublicRead(request: Request): boolean {
  const pathname = new URL(request.url).pathname.replace(/\/+$/, '');
  return (
    pathname === '/api/atlas' ||
    pathname === '/api/atlas/piece-content' ||
    pathname === '/api/atlas/card' ||
    pathname.startsWith('/api/atlas/card/')
  );
}

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
  if ((method === 'GET' || method === 'HEAD') && isSurvivingPublicRead(context.request)) {
    return context.next();
  }

  const destination = destinationFor(context);
  const headers = boundaryHeaders(destination);
  if (method === 'OPTIONS') return new Response(null, { status: 204, headers });

  if (method === 'GET' || method === 'HEAD') {
    if (method === 'HEAD') return new Response(null, { status: 410, headers });
    return Response.json(
      {
        ok: false,
        error: 'atlas_reader_moved',
        message:
          'This Atlas reader depended on Mandala Codes historical holder records and is retired until its canonical reader is available.',
        readOnly: true,
        movedAt: ATLAS_MOVE_DATE,
        destination,
      },
      { status: 410, headers },
    );
  }

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

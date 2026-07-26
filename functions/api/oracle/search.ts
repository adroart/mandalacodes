/**
 * GET /api/oracle/search?q=…&limit=…&literal=1
 *
 * Hosted oracle search. Ranks the prebuilt index with the shared ranker — the
 * same scoring the website and the local MCP use. Read-only published content,
 * so it's public and cacheable.
 */
import { rank, type SearchDoc } from '../../../lib/oracle/ranker';
import index from '../../../data/oracle-search-index.json';

const DOCS = index as unknown as SearchDoc[];

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (body: unknown, cache = false) =>
  new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': cache ? 'public, max-age=300' : 'no-store',
      ...CORS,
    },
  });

export const onRequestOptions = async () => new Response(null, { headers: CORS });

export const onRequestGet = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').slice(0, 200);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 8, 24);
  const literal = url.searchParams.get('literal') === '1';
  if (!q.trim()) return json({ query: '', hits: [] });
  return json({ query: q, hits: rank(DOCS, q, { limit, expand: !literal }) }, true);
};

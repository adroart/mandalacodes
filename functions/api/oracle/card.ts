/**
 * GET /api/oracle/card?n=1   (or ?name=Earth's%20Breath)
 *
 * Hosted single-code lookup. Returns the full canonical card from the prebuilt
 * corpus. Read-only published content — public and cacheable.
 */
import type { CanonicalCard } from '../../../lib/oracle/types';
import corpusData from '../../../data/oracle-corpus.json';

const CARDS = (corpusData as { cards: CanonicalCard[] }).cards;
const BY_NUMBER = new Map<number, CanonicalCard>(CARDS.map((c) => [c.number, c]));

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': status === 200 ? 'public, max-age=300' : 'no-store',
      ...CORS,
    },
  });

export const onRequestOptions = async () => new Response(null, { headers: CORS });

export const onRequestGet = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const n = Number(url.searchParams.get('n'));
  const name = url.searchParams.get('name');
  let card: CanonicalCard | undefined;
  if (Number.isFinite(n)) card = BY_NUMBER.get(n);
  else if (name) {
    const lname = name.toLowerCase();
    card = CARDS.find((c) => c.card_name.toLowerCase() === lname) ??
      CARDS.find((c) => c.card_name.toLowerCase().includes(lname));
  }
  if (!card) return json({ error: 'card not found (use ?n=1–64 or ?name=…)' }, 404);
  return json(card);
};

/**
 * POST /api/oracle/recommendation — the chart→art recommendation engine.
 *
 * The Mandala Codes side of the personalized client recommendation. Given a
 * person's chart (or their birth moment, which we compute the chart from), it
 * returns the art pieces of their codes and the energy each carries, plus the
 * curator's resolved picks. The Adrian Rasmussen quote system consumes this,
 * adds pricing/inventory and the purchase flow, and renders the client page/PDF.
 *
 * Body (JSON):
 *   {
 *     "clientName": "Jordan",                       // optional
 *     "profile":  { "lifesWork": {gate,line}, ... },// a ready 11-sphere chart, OR
 *     "utcBirth": "1990-06-09T14:30:00Z",           // compute the chart from this
 *     "recommendation": { intention, closing, picks:[{sphere|gate, reason}] } // optional
 *   }
 *
 * Returns the LookbookData (pieces + resolved recommendation). Read-only deck
 * content keyed by the caller's own chart; optionally gated by ORACLE_API_TOKEN.
 */
import { assembleLookbook, type ChartInput } from '../../../lib/oracle/recommendation';
import { buildHologeneticProfile } from '../../../lib/astrology/profile';
import type { CanonicalCard } from '../../../lib/oracle/types';
import corpusData from '../../../data/oracle-corpus.json';

interface Env { ORACLE_API_TOKEN?: string }

const CARDS = (corpusData as { cards: CanonicalCard[] }).cards;

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS },
  });

export const onRequestOptions: PagesFunction = async () => new Response(null, { headers: CORS });

export const onRequestGet: PagesFunction = async () =>
  json({
    endpoint: 'POST /api/oracle/recommendation',
    body: { clientName: 'optional', profile: 'an 11-sphere chart', utcBirth: 'ISO UTC, computes the chart instead', recommendation: 'optional { intention, closing, picks }' },
  });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const required = env.ORACLE_API_TOKEN;
  if (required) {
    const tok = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (tok !== required) return json({ error: 'unauthorized' }, 401);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  // Resolve the chart: an explicit profile, or compute it from a birth moment.
  let profile: ChartInput | undefined = body.profile;
  if (!profile && body.utcBirth) {
    const d = new Date(body.utcBirth);
    if (Number.isNaN(d.getTime())) return json({ error: 'utcBirth is not a valid date' }, 400);
    profile = buildHologeneticProfile({ utcBirth: d });
  }
  if (!profile) return json({ error: 'provide either "profile" or "utcBirth"' }, 400);

  // carry the optional recommendation block onto the chart input
  if (body.recommendation) profile = { ...profile, recommendation: body.recommendation };

  const data = assembleLookbook(CARDS, profile, { clientName: body.clientName });
  return json(data);
};

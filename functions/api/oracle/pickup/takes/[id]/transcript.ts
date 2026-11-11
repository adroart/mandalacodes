import type { R2Bucket } from '@cloudflare/workers-types';
import { MAX_BETTER_TEXT_BYTES } from '../../../../../../utils/oracleBetterTranscript';
import { isResponse, json, requireBinding } from '../../../reflections/_shared';
import { boundedJson } from '../../../authoring/_shared';
import { requirePickup, type PickupContext } from '../../_shared';
import { parseStoredBetter, parseTakeId, takeIdOf, type StoredBetterTake } from '../_shared';

const MAX_BODY_BYTES = 2_000_000;
const MAX_SEGMENTS = 5_000;
const MAX_WORDS = 20_000;
const MAX_SPEAKERS = 32;
const MAX_TIME_MS = 6 * 60 * 60 * 1000;
const HASH = /^[a-f0-9]{16,128}$/i;
const ENGINE = /^[A-Za-z0-9 ._-]{1,64}$/;

const reply = (status: number, error: string) => json({ ok: false, error }, status);
const time = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_TIME_MS;

type Segment = NonNullable<StoredBetterTake['segments']>[number];
type Word = NonNullable<StoredBetterTake['words']>[number];

/** Milliseconds from `startMs`/`endMs`, or from `start`/`end` in seconds as the segments pickup sends them. */
function span(item: Record<string, unknown>): [number, number] | null {
  const start = item.startMs ?? (typeof item.start === 'number' ? Math.round(item.start * 1000) : undefined);
  const end = item.endMs ?? (typeof item.end === 'number' ? Math.round(item.end * 1000) : undefined);
  return time(start) && time(end) && end >= start ? [start, end] : null;
}

function cleanWord(item: unknown): Word | string {
  if (!item || typeof item !== 'object') return 'each word needs text, startMs and endMs';
  const value = item as Record<string, unknown>, times = span(value), { text, probability } = value;
  if (!times || typeof text !== 'string' || text.length > 200) return 'each word needs text, startMs and endMs';
  if (probability !== undefined && probability !== null && (typeof probability !== 'number' || !Number.isFinite(probability) || probability < 0 || probability > 1)) return 'word probability must be between 0 and 1';
  return { text, startMs: times[0], endMs: times[1], ...(typeof probability === 'number' ? { probability } : {}) };
}

/** Segments, and the words: top-level `words`, or else the words nested in each segment. Every list is bounded. */
function cleanTiming(segmentsValue: unknown, wordsValue: unknown): { segments: Segment[]; words: Word[] } | string {
  if (segmentsValue !== undefined && !Array.isArray(segmentsValue)) return 'segments must be a list';
  if (wordsValue !== undefined && !Array.isArray(wordsValue)) return 'words must be a list';
  const segmentList = (segmentsValue ?? []) as unknown[];
  if (segmentList.length > MAX_SEGMENTS) return `segments must be at most ${MAX_SEGMENTS}`;
  const segments: Segment[] = [], words: Word[] = [];
  const nested = wordsValue === undefined;
  for (const item of segmentList) {
    if (!item || typeof item !== 'object') return 'each segment needs startMs, endMs and text';
    const value = item as Record<string, unknown>, times = span(value);
    if (!times || typeof value.text !== 'string' || value.text.length > 20_000) return 'each segment needs startMs, endMs and text';
    segments.push({ startMs: times[0], endMs: times[1], text: value.text, ...(typeof value.speaker === 'string' && value.speaker.length <= 64 ? { speaker: value.speaker } : {}) });
    if (nested && value.words !== undefined) {
      if (!Array.isArray(value.words)) return 'words must be a list';
      for (const word of value.words) {
        if (words.length >= MAX_WORDS) return `words must be at most ${MAX_WORDS}`;
        const clean = cleanWord(word); if (typeof clean === 'string') return clean; words.push(clean);
      }
    }
  }
  if (!nested) {
    const list = wordsValue as unknown[];
    if (list.length > MAX_WORDS) return `words must be at most ${MAX_WORDS}`;
    for (const word of list) { const clean = cleanWord(word); if (typeof clean === 'string') return clean; words.push(clean); }
  }
  return { segments, words };
}

/**
 * The Mac brings back a better transcript for one card recording. It is stored beside the audio; the phone reads it
 * and decides on the phone what to do with it (its own draft is never touched here).
 * - The same result again is accepted and changes nothing.
 * - A different result for the same audio replaces the earlier one only with `replace: true`.
 */
export async function onRequestPost({ request, env, params }: PickupContext) {
  const refused = await requirePickup(request, env); if (refused) return refused;
  const bucket = requireBinding(env.ORACLE_PRIVATE, 'ORACLE_PRIVATE') as R2Bucket | Response; if (isResponse(bucket)) return bucket;
  const take = parseTakeId(params.id);
  if (!take) return reply(400, 'invalid take id');
  if (Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES) return reply(413, 'result is too large');
  let body: Record<string, unknown>;
  try { body = await boundedJson(request, MAX_BODY_BYTES); } catch (error) {
    return error instanceof Error && error.message === 'body_too_large' ? reply(413, 'result is too large') : reply(400, 'invalid JSON');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400, 'invalid JSON');
  if (typeof body.audioHash !== 'string' || body.audioHash.toLowerCase() !== take.hash) return reply(400, 'audioHash does not match this take');

  if (!(await bucket.head(take.audioKey))) return reply(404, 'take not found');
  const existingObject = await bucket.get(take.betterKey);
  const existing = existingObject ? parseStoredBetter(await existingObject.json().catch(() => null)) : null;
  const now = new Date().toISOString();
  const summary = (record: StoredBetterTake) => ({ id: takeIdOf(take.user, take.hash), audioHash: take.hash, outcome: record.outcome, resultHash: record.resultHash ?? null, receivedAt: record.receivedAt });
  const store = async (record: StoredBetterTake) => {
    const written = await bucket.put(take.betterKey, JSON.stringify(record), {
      onlyIf: existingObject ? { etagMatches: existingObject.etag } : { etagDoesNotMatch: '*' },
      httpMetadata: { contentType: 'application/json' },
      customMetadata: { outcome: record.outcome, ...(record.resultHash ? { resultHash: record.resultHash } : {}) },
    });
    return written ? null : reply(409, 'this take changed while the result was arriving; send it again');
  };

  if (body.outcome === 'skipped') {
    // The Mac could not do better for this one. Stop offering it. A result already kept stays.
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 280) : '';
    if (!reason) return reply(400, 'say why it was set aside');
    if (existing) return json({ ok: true, result: 'unchanged', take: summary(existing) });
    const record: StoredBetterTake = { format: 'oracle-take-better', version: 1, audioHash: take.hash, outcome: 'skipped', receivedAt: now, reason };
    const failed = await store(record); if (failed) return failed;
    return json({ ok: true, result: 'skipped', take: summary(record) }, 201);
  }
  if (body.outcome !== undefined && body.outcome !== 'improved') return reply(400, 'outcome must be improved or skipped');

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return reply(400, 'text must not be empty');
  if (new TextEncoder().encode(text).length > MAX_BETTER_TEXT_BYTES) return reply(400, 'text must be at most 100000 UTF-8 bytes');
  if (typeof body.resultHash !== 'string' || !HASH.test(body.resultHash)) return reply(400, 'resultHash must be a hex digest');
  const resultHash = body.resultHash.toLowerCase();
  const engine = typeof body.engine === 'string' ? body.engine.trim() : typeof body.provider === 'string' ? body.provider.trim() : '';
  if (!ENGINE.test(engine)) return reply(400, 'engine must name the transcriber');
  const engineVersion = typeof body.engineVersion === 'string' && ENGINE.test(body.engineVersion.trim()) ? body.engineVersion.trim() : null;
  const timing = cleanTiming(body.segments, body.words); if (typeof timing === 'string') return reply(400, timing);
  const { segments, words } = timing;
  if (body.speakers !== undefined && (!Array.isArray(body.speakers) || body.speakers.length > MAX_SPEAKERS)) return reply(400, `speakers must be a list of at most ${MAX_SPEAKERS}`);

  if (existing?.outcome === 'improved') {
    if (existing.resultHash === resultHash) return json({ ok: true, result: 'unchanged', take: summary(existing) });
    if (body.replace !== true) return reply(409, 'a different result is already kept for this take; send replace: true to replace it');
  }
  const record: StoredBetterTake = {
    format: 'oracle-take-better', version: 1, audioHash: take.hash, outcome: 'improved', receivedAt: now,
    resultHash, engine, engineVersion, text, segments, words, speakers: Array.isArray(body.speakers) ? body.speakers : [],
  };
  const failed = await store(record); if (failed) return failed;
  return json({ ok: true, result: existing?.outcome === 'improved' ? 'replaced' : 'improved', take: summary(record) }, 201);
}

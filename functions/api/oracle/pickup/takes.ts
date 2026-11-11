import type { R2Bucket, R2Object } from '@cloudflare/workers-types';
import { json, requireBinding, isResponse } from '../reflections/_shared';
import { requirePickup, type PickupContext } from './_shared';
import { AUDIO_HASH, readTakeDetails, takeIdOf, validUserSegment } from './takes/_shared';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
/** R2 list calls one request may make. Each audio page costs one call plus usually one for the results beside it. */
const MAX_LIST_CALLS = 24;
/** Result pages looked through for one audio page; only results whose audio is gone could ever need more. */
const MAX_RESULT_PAGES = 6;
const MAX_USER_PAGES = 2;

/** Where a scan stopped: the user segment and R2's cursor in that user's audio listing. Opaque to the Mac. */
interface ScanCursor { u: string; c?: string }
const encodeCursor = (cursor: ScanCursor) => btoa(JSON.stringify(cursor)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function decodeCursor(value: string): ScanCursor | null {
  if (!/^[A-Za-z0-9_-]{1,2048}$/.test(value)) return null;
  try {
    const parsed = JSON.parse(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)));
    if (!parsed || typeof parsed.u !== 'string' || !validUserSegment(parsed.u)) return null;
    if (parsed.c !== undefined && (typeof parsed.c !== 'string' || parsed.c.length > 1024)) return null;
    return { u: parsed.u, ...(parsed.c ? { c: parsed.c } : {}) };
  } catch { return null; }
}

const hashAfter = (key: string, prefix: string) => key.startsWith(prefix) ? key.slice(prefix.length) : '';

/**
 * Card recordings from the app still waiting for a better transcript, oldest first. Read only.
 * Waiting: an audio object under authoring/<user>/audio/ with no result object under authoring/<user>/better/.
 * The scan pages through R2 under a fixed budget of list calls, so handled recordings cannot starve the rest:
 * when the budget runs out the reply carries `cursor`, and a call with that cursor carries on from there.
 */
export async function onRequestGet({ request, env }: PickupContext) {
  const refused = await requirePickup(request, env); if (refused) return refused;
  const bucket = requireBinding(env.ORACLE_PRIVATE, 'ORACLE_PRIVATE') as R2Bucket | Response; if (isResponse(bucket)) return bucket;
  const params = new URL(request.url).searchParams;
  const asked = Number(params.get('limit'));
  const limit = Number.isInteger(asked) && asked > 0 ? Math.min(asked, MAX_LIMIT) : DEFAULT_LIMIT;
  const cursorParam = params.get('cursor');
  const start = cursorParam ? decodeCursor(cursorParam) : null;
  if (cursorParam && !start) return json({ ok: false, error: 'invalid cursor' }, 400);

  let calls = 0;
  const users: string[] = [];
  let userCursor: string | undefined;
  for (let page = 0; page < MAX_USER_PAGES; page += 1) {
    const listed = await bucket.list({ prefix: 'authoring/', delimiter: '/', cursor: userCursor }); calls += 1;
    for (const prefix of listed.delimitedPrefixes ?? []) {
      const user = prefix.slice('authoring/'.length, -1);
      if (validUserSegment(user)) users.push(user);
    }
    userCursor = listed.truncated ? listed.cursor : undefined;
    if (!userCursor) break;
  }
  users.sort();

  const waiting: { object: R2Object; user: string; hash: string }[] = [];
  let next: ScanCursor | null = null;
  let incomplete = false;
  scan: for (const user of users) {
    if (start && user < start.u) continue;
    const audioPrefix = `authoring/${user}/audio/`, betterPrefix = `authoring/${user}/better/`;
    let audioCursor = start && user === start.u ? start.c : undefined;
    do {
      if (calls >= MAX_LIST_CALLS) { next = { u: user, ...(audioCursor ? { c: audioCursor } : {}) }; break scan; }
      const page = await bucket.list({ prefix: audioPrefix, cursor: audioCursor, include: ['httpMetadata', 'customMetadata'] } as never); calls += 1;
      const audio = page.objects.map((object) => ({ object, user, hash: hashAfter(object.key, audioPrefix) })).filter((item) => AUDIO_HASH.test(item.hash));
      if (audio.length) {
        const hashes = audio.map((item) => item.hash).sort();
        const first = hashes[0], last = hashes[hashes.length - 1];
        // Results are keyed by the same hash, so they sort the same way: list only the stretch this page covers.
        const handled = new Set<string>();
        let resultCursor: string | undefined, reachedEnd = false;
        for (let pageIndex = 0; pageIndex < MAX_RESULT_PAGES && !reachedEnd; pageIndex += 1) {
          const results = await bucket.list(resultCursor ? { prefix: betterPrefix, cursor: resultCursor } : { prefix: betterPrefix, startAfter: betterPrefix + first } as never); calls += 1;
          for (const object of results.objects) {
            const hash = hashAfter(object.key, betterPrefix).replace(/\.json$/, '');
            if (hash > last) { reachedEnd = true; break; }
            handled.add(hash);
          }
          if (!results.truncated) reachedEnd = true; else resultCursor = results.cursor;
        }
        if (!reachedEnd) incomplete = true;
        else for (const item of audio) if (!handled.has(item.hash)) waiting.push(item);
      }
      audioCursor = page.truncated ? page.cursor : undefined;
    } while (audioCursor);
  }

  const takes = waiting.map(({ object, user, hash }) => {
    const details = readTakeDetails(object);
    const id = takeIdOf(user, hash);
    return {
      id,
      audioHash: hash,
      hexagramNumber: details.cardNumber,
      sectionId: details.sectionId,
      captureId: details.captureId,
      recordedAt: details.recordedAt ?? object.uploaded.toISOString(),
      uploadedAt: object.uploaded.toISOString(),
      durationMs: details.durationMs,
      mimeType: details.mimeType,
      byteSize: object.size,
      detailsKnown: details.detailsKnown,
      status: 'waiting',
      draft: null,
      audioPath: `/api/oracle/pickup/takes/${id}/audio`,
    };
  }).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.id.localeCompare(b.id));
  const listed = takes.slice(0, limit);
  return json({ ok: true, takes: listed, more: takes.length > listed.length || next !== null || incomplete, cursor: next ? encodeCursor(next) : null });
}

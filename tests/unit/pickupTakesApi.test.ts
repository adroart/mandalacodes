import { describe, expect, it, vi } from 'vitest';
import { onRequestGet as listTakes } from '../../functions/api/oracle/pickup/takes';
import { onRequestGet as takeAudio } from '../../functions/api/oracle/pickup/takes/[id]/audio';
import { onRequestPost as takeTranscript } from '../../functions/api/oracle/pickup/takes/[id]/transcript';
import { cleanTakeDetails, parseTakeId, readTakeDetails, takeIdOf } from '../../functions/api/oracle/pickup/takes/_shared';

const KEY = 'p'.repeat(48);
const USER = 'owner-1';
const hashOf = (n: number) => n.toString(16).padStart(64, '0');

interface Stored { value: Uint8Array; etag: string; uploaded: Date; httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }

/** An in-memory R2 bucket: sorted keys, paged listing with cursor/startAfter/delimiter, conditional puts, ranged gets. */
function fakeR2(pageSize = 1000) {
  const objects = new Map<string, Stored>();
  let etags = 0;
  const calls = { list: [] as Record<string, unknown>[] };
  const view = (key: string, stored: Stored) => ({ key, size: stored.value.length, etag: stored.etag, uploaded: stored.uploaded, httpMetadata: stored.httpMetadata, customMetadata: stored.customMetadata });
  const bucket = {
    objects, calls,
    seed(key: string, value: Uint8Array | string, options: { uploaded?: Date; contentType?: string; customMetadata?: Record<string, string> } = {}) {
      objects.set(key, { value: typeof value === 'string' ? new TextEncoder().encode(value) : value, etag: `e${++etags}`, uploaded: options.uploaded ?? new Date('2026-11-01T00:00:00Z'), httpMetadata: { contentType: options.contentType }, customMetadata: options.customMetadata });
    },
    async list(options: { prefix?: string; delimiter?: string; cursor?: string; startAfter?: string; limit?: number; include?: string[] } = {}) {
      calls.list.push(options);
      const prefix = options.prefix ?? '';
      let keys = [...objects.keys()].filter((key) => key.startsWith(prefix)).sort();
      const after = options.cursor ?? options.startAfter;
      if (after) keys = keys.filter((key) => key > after);
      const delimited = new Set<string>(), out: string[] = [];
      for (const key of keys) {
        if (options.delimiter) {
          const rest = key.slice(prefix.length), at = rest.indexOf(options.delimiter);
          if (at >= 0) { delimited.add(prefix + rest.slice(0, at + 1)); continue; }
        }
        out.push(key);
      }
      const size = Math.min(options.limit ?? pageSize, pageSize);
      if (options.delimiter) return { objects: [], delimitedPrefixes: [...delimited], truncated: false };
      const page = out.slice(0, size);
      const truncated = out.length > size;
      return { objects: page.map((key) => view(key, objects.get(key)!)), delimitedPrefixes: [], truncated, ...(truncated ? { cursor: page[page.length - 1] } : {}) };
    },
    async head(key: string) { const stored = objects.get(key); return stored ? view(key, stored) : null; },
    async get(key: string, options?: { range?: { offset: number; length: number } }) {
      const stored = objects.get(key); if (!stored) return null;
      const bytes = options?.range ? stored.value.slice(options.range.offset, options.range.offset + options.range.length) : stored.value;
      return { ...view(key, stored), body: bytes, async json() { return JSON.parse(new TextDecoder().decode(stored.value)); }, async arrayBuffer() { return bytes.buffer; } };
    },
    async put(key: string, value: string | Uint8Array, options: { onlyIf?: { etagMatches?: string; etagDoesNotMatch?: string }; httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> } = {}) {
      const existing = objects.get(key);
      if (options.onlyIf?.etagDoesNotMatch === '*' && existing) return null;
      if (options.onlyIf?.etagMatches && existing?.etag !== options.onlyIf.etagMatches) return null;
      const stored = { value: typeof value === 'string' ? new TextEncoder().encode(value) : value, etag: `e${++etags}`, uploaded: new Date(), httpMetadata: options.httpMetadata, customMetadata: options.customMetadata };
      objects.set(key, stored);
      return view(key, stored);
    },
  };
  return bucket;
}

const audioKey = (hash: string, user = USER) => `authoring/${user}/audio/${hash}`;
const betterKey = (hash: string, user = USER) => `authoring/${user}/better/${hash}.json`;

function context(route: string, bucket: ReturnType<typeof fakeR2>, opts: { method?: string; token?: string | null; env?: Record<string, unknown>; body?: unknown; rawBody?: string; headers?: Record<string, string>; id?: string } = {}) {
  const headers: Record<string, string> = { ...(opts.token === null ? {} : { Authorization: `Bearer ${opts.token ?? KEY}` }), ...(opts.headers ?? {}) };
  const body = opts.rawBody ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body));
  const request = new Request(`https://example.test${route}`, { method: opts.method ?? 'GET', headers, body });
  return { request, env: { ORACLE_PRIVATE: bucket, AR_PICKUP_TOKEN: KEY, ...opts.env }, params: { id: opts.id ?? '' }, waitUntil: vi.fn() } as never;
}

const list = async (bucket: ReturnType<typeof fakeR2>, query = '', opts = {}) => {
  const response = await listTakes(context(`/api/oracle/pickup/takes${query}`, bucket, opts));
  return { response, body: await response.clone().json() as any };
};

const result = (hash: string, extra: Record<string, unknown> = {}) => ({
  outcome: 'improved', engine: 'ar-create', engineVersion: '2.1', audioHash: hash, resultHash: 'c'.repeat(64), text: 'I trust the slow way. It holds.',
  segments: [{ startMs: 0, endMs: 1800, text: 'I trust the slow way.' }, { startMs: 1900, endMs: 2600, text: 'It holds.' }],
  words: [{ text: 'I', startMs: 0, endMs: 200, probability: 0.99 }, { text: 'trust', startMs: 200, endMs: 600, probability: 0.4 }], ...extra,
});
const post = async (bucket: ReturnType<typeof fakeR2>, hash: string, body: unknown, opts: Record<string, unknown> = {}) => {
  const id = takeIdOf(USER, hash);
  const response = await takeTranscript(context(`/api/oracle/pickup/takes/${id}/transcript`, bucket, { method: 'POST', body, id, ...opts }));
  return { response, body: await response.clone().json() as any };
};

describe('take ids', () => {
  it('round-trips and rejects anything this site would not have issued', () => {
    const id = takeIdOf(USER, hashOf(1));
    expect(parseTakeId(id)).toMatchObject({ user: USER, hash: hashOf(1), audioKey: audioKey(hashOf(1)), betterKey: betterKey(hashOf(1)) });
    const b64 = (value: string) => btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    for (const bad of [undefined, '', 'abc', id + 'A', id.replace(/.$/, '+'), b64(`../${hashOf(1)}`), b64(`owner/../x/${hashOf(1)}`), b64(`${USER}/${"ab".repeat(32).toUpperCase()}`), b64(`${USER}/${hashOf(1)}/x`), b64(`a b/${hashOf(1)}`), b64(`%2/${hashOf(1)}`), b64(`.././${hashOf(1)}`), b64(`..${'/'}${hashOf(1)}`), b64(`${USER}/${'a'.repeat(63)}`)]) {
      expect(parseTakeId(bad), String(bad)).toBeNull();
    }
    expect(parseTakeId(takeIdOf(encodeURIComponent('user@example.com'), hashOf(2)))?.user).toBe('user%40example.com');
  });
});

describe('takes pickup key', () => {
  it('refuses every route while the key is unset or short, and with a wrong or missing key', async () => {
    const bucket = fakeR2(); bucket.seed(audioKey(hashOf(1)), 'audio');
    const id = takeIdOf(USER, hashOf(1));
    const routes = [
      () => listTakes,
      () => takeAudio,
      () => takeTranscript,
    ];
    for (const [index, route] of ['/api/oracle/pickup/takes', `/api/oracle/pickup/takes/${id}/audio`, `/api/oracle/pickup/takes/${id}/transcript`].entries()) {
      const handler = routes[index]() as (c: never) => Promise<Response>;
      const method = index === 2 ? 'POST' : 'GET', body = index === 2 ? result(hashOf(1)) : undefined;
      expect((await handler(context(route, bucket, { method, body, id, env: { AR_PICKUP_TOKEN: undefined } }))).status).toBe(503);
      expect((await handler(context(route, bucket, { method, body, id, env: { AR_PICKUP_TOKEN: 'short' }, token: 'short' }))).status).toBe(503);
      const wrong = await handler(context(route, bucket, { method, body, id, token: 'x'.repeat(48) }));
      expect(wrong.status).toBe(401); expect(wrong.headers.get('WWW-Authenticate')).toBe('Bearer');
      expect((await handler(context(route, bucket, { method, body, id, token: null }))).status).toBe(401);
    }
    expect(bucket.objects.has(betterKey(hashOf(1)))).toBe(false);
    expect(bucket.calls.list.length).toBe(0);
  });
});

describe('takes list', () => {
  it('lists audio with no result beside it, oldest first, bounded, with details or marked unknown', async () => {
    const bucket = fakeR2();
    bucket.seed(audioKey(hashOf(3)), 'c', { contentType: 'audio/mp4', customMetadata: { v: '1', durationMs: '61000', cardNumber: '12', sectionId: '12/DESIGN/the-drive', captureId: 'cap-3', recordedAt: '2026-11-02T09:00:00.000Z' } });
    bucket.seed(audioKey(hashOf(1)), 'a', { contentType: 'audio/webm', uploaded: new Date('2026-10-30T00:00:00Z') });
    bucket.seed(audioKey(hashOf(2)), 'b', { contentType: 'audio/mp4', customMetadata: { v: '1', recordedAt: '2026-11-01T09:00:00.000Z' } });
    bucket.seed(audioKey(hashOf(4)), 'd', { contentType: 'audio/mp4' });
    bucket.seed(betterKey(hashOf(4)), '{}');
    bucket.seed(`authoring/${USER}/sessions/s1`, '{}');
    const { response, body } = await list(bucket);
    expect(response.status).toBe(200);
    expect(body.takes.map((take: any) => take.audioHash)).toEqual([hashOf(1), hashOf(2), hashOf(3)]);
    expect(body.takes[0]).toMatchObject({ detailsKnown: false, mimeType: 'audio/webm', recordedAt: '2026-10-30T00:00:00.000Z', durationMs: null, hexagramNumber: null, byteSize: 1, status: 'waiting', draft: null });
    expect(body.takes[2]).toMatchObject({ detailsKnown: true, durationMs: 61000, hexagramNumber: 12, sectionId: '12/DESIGN/the-drive', captureId: 'cap-3', audioPath: `/api/oracle/pickup/takes/${takeIdOf(USER, hashOf(3))}/audio` });
    expect(body).toMatchObject({ more: false, cursor: null });
    const limited = await list(bucket, '?limit=2');
    expect(limited.body.takes).toHaveLength(2); expect(limited.body.more).toBe(true);
    expect((await list(bucket, '?limit=9999')).body.takes).toHaveLength(3);
    for (const call of bucket.calls.list) expect(String(call.prefix)).toMatch(/^authoring\/(owner-1\/(audio|better)\/)?$/);
  });

  it('pages past many already handled recordings and stays inside the budget, carrying on with a cursor', async () => {
    const bucket = fakeR2(10);
    for (let n = 1; n <= 400; n += 1) { bucket.seed(audioKey(hashOf(n)), 'x'); if (n !== 395) bucket.seed(betterKey(hashOf(n)), '{}'); }
    const first = await list(bucket);
    expect(bucket.calls.list.length).toBeLessThanOrEqual(30);
    expect(first.body.takes).toEqual([]);
    expect(first.body.more).toBe(true);
    expect(typeof first.body.cursor).toBe('string');
    let cursor = first.body.cursor, found: string[] = [], rounds = 0;
    while (cursor && rounds < 20) {
      const next = await list(bucket, `?cursor=${cursor}`);
      found = found.concat(next.body.takes.map((take: any) => take.audioHash)); cursor = next.body.cursor; rounds += 1;
    }
    expect(found).toEqual([hashOf(395)]);
    expect((await list(bucket, '?cursor=not*valid')).response.status).toBe(400);
    const sneaky = btoa(JSON.stringify({ u: '../x' })).replace(/=+$/, '');
    expect((await list(bucket, `?cursor=${sneaky}`)).response.status).toBe(400);
  });

  it('following the cursor visits every waiting take once when more wait than the limit, even on one listing page', async () => {
    const bucket = fakeR2(100);
    for (let n = 1; n <= 250; n += 1) bucket.seed(audioKey(hashOf(n)), 'x', { customMetadata: { v: '1', recordedAt: new Date(Date.UTC(2026, 0, 1) + (300 - n) * 60000).toISOString() } });
    const first = await list(bucket, '?limit=3');
    expect(first.body.takes.map((take: any) => take.audioHash)).toEqual([hashOf(3), hashOf(2), hashOf(1)]);
    expect(first.body.more).toBe(true); expect(typeof first.body.cursor).toBe('string');
    const seen: string[] = first.body.takes.map((take: any) => take.audioHash);
    let cursor = first.body.cursor, rounds = 0;
    while (cursor && rounds < 200) {
      const next = await list(bucket, `?limit=3&cursor=${cursor}`);
      seen.push(...next.body.takes.map((take: any) => take.audioHash)); cursor = next.body.cursor; rounds += 1;
    }
    expect(seen).toHaveLength(250);
    expect(new Set(seen).size).toBe(250);
    const small = fakeR2();
    for (let n = 1; n <= 7; n += 1) small.seed(audioKey(hashOf(n)), 'x');
    const all = await list(small, '?limit=7');
    expect(all.body.takes).toHaveLength(7); expect(all.body).toMatchObject({ more: false, cursor: null });
    const forged = btoa(JSON.stringify({ u: USER, k: 'authoring/other/audio/' + hashOf(1) })).replace(/=+$/, '');
    expect((await list(small, `?cursor=${forged}`)).response.status).toBe(400);
  });

  it('ignores keys that are not audio hashes and users whose segment is not canonical', async () => {
    const bucket = fakeR2();
    bucket.seed(audioKey('not-a-hash'), 'x');
    bucket.seed(`authoring/a b/audio/${hashOf(9)}`, 'x');
    bucket.seed(`other/${USER}/audio/${hashOf(8)}`, 'x');
    expect((await list(bucket)).body.takes).toEqual([]);
  });
});

describe('takes audio', () => {
  it('serves the bytes with their type, whole or by Range', async () => {
    const bucket = fakeR2(); bucket.seed(audioKey(hashOf(1)), new Uint8Array([1, 2, 3, 4, 5, 6]), { contentType: 'audio/mp4' });
    const id = takeIdOf(USER, hashOf(1));
    const whole = await takeAudio(context(`/x/${id}/audio`, bucket, { id }));
    expect(whole.status).toBe(200); expect(whole.headers.get('Content-Type')).toBe('audio/mp4'); expect(whole.headers.get('Content-Length')).toBe('6');
    expect([...new Uint8Array(await whole.arrayBuffer())]).toEqual([1, 2, 3, 4, 5, 6]);
    const part = await takeAudio(context(`/x/${id}/audio`, bucket, { id, headers: { Range: 'bytes=2-3' } }));
    expect(part.status).toBe(206); expect(part.headers.get('Content-Range')).toBe('bytes 2-3/6');
    expect([...new Uint8Array(await part.arrayBuffer())]).toEqual([3, 4]);
    expect((await takeAudio(context(`/x/${id}/audio`, bucket, { id, headers: { Range: 'bytes=9-' } }))).status).toBe(416);
  });

  it('rejects bad ids and unknown takes without reading other keys', async () => {
    const bucket = fakeR2(); bucket.seed(`authoring/${USER}/sessions/${hashOf(1)}`, 'private');
    const head = vi.spyOn(bucket, 'head');
    for (const id of ['..', 'abc', btoa(`${USER}/../sessions/${hashOf(1)}`).replace(/=+$/, '')]) expect((await takeAudio(context('/x', bucket, { id }))).status).toBe(400);
    expect(head).not.toHaveBeenCalled();
    expect((await takeAudio(context('/x', bucket, { id: takeIdOf(USER, hashOf(1)) }))).status).toBe(404);
    expect(head).toHaveBeenCalledWith(audioKey(hashOf(1)));
  });
});

describe('takes transcript', () => {
  it('refuses a chunked body over the limit without reading it to the end, and still takes in-limit and bad bodies', async () => {
    const bucket = fakeR2(); bucket.seed(audioKey(hashOf(1)), 'x');
    const id = takeIdOf(USER, hashOf(1)), route = `/api/oracle/pickup/takes/${id}/transcript`;
    const send = (stream: ReadableStream<Uint8Array>) => takeTranscript({
      request: new Request(`https://example.test${route}`, { method: 'POST', headers: { Authorization: `Bearer ${KEY}` }, body: stream, duplex: 'half' } as never),
      env: { ORACLE_PRIVATE: bucket, AR_PICKUP_TOKEN: KEY }, params: { id }, waitUntil: vi.fn(),
    } as never);
    let sent = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) { sent += 1; if (sent > 6) throw new Error('read past the limit'); controller.enqueue(new Uint8Array(1_000_000).fill(32)); },
    });
    const big = await send(endless);
    expect(big.status).toBe(413); expect(sent).toBeLessThanOrEqual(4);
    const bytes = new TextEncoder().encode(JSON.stringify(result(hashOf(1))));
    const chunks = (data: Uint8Array) => new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(data.slice(0, 20)); controller.enqueue(data.slice(20)); controller.close(); } });
    expect((await send(chunks(bytes))).status).toBe(201);
    expect((await send(chunks(new TextEncoder().encode('{not json')))).status).toBe(400);
  });

  it('keeps the result beside the audio, accepts the same result again, and the take leaves the list', async () => {
    const bucket = fakeR2(); bucket.seed(audioKey(hashOf(1)), 'x');
    const first = await post(bucket, hashOf(1), result(hashOf(1)));
    expect(first.response.status).toBe(201); expect(first.body).toMatchObject({ ok: true, result: 'improved', take: { audioHash: hashOf(1), resultHash: 'c'.repeat(64) } });
    const stored = JSON.parse(new TextDecoder().decode(bucket.objects.get(betterKey(hashOf(1)))!.value));
    expect(stored).toMatchObject({ format: 'oracle-take-better', outcome: 'improved', audioHash: hashOf(1), engine: 'ar-create', text: 'I trust the slow way. It holds.' });
    expect(stored.words[1]).toEqual({ text: 'trust', startMs: 200, endMs: 600, probability: 0.4 });
    const again = await post(bucket, hashOf(1), result(hashOf(1)));
    expect(again.response.status).toBe(200); expect(again.body.result).toBe('unchanged');
    expect((await list(bucket)).body.takes).toEqual([]);
  });

  it('replaces a different result only when asked to', async () => {
    const bucket = fakeR2(); bucket.seed(audioKey(hashOf(1)), 'x');
    await post(bucket, hashOf(1), result(hashOf(1)));
    const other = result(hashOf(1), { resultHash: 'd'.repeat(64), text: 'Another hearing.' });
    expect((await post(bucket, hashOf(1), other)).response.status).toBe(409);
    const replaced = await post(bucket, hashOf(1), { ...other, replace: true });
    expect(replaced.response.status).toBe(201); expect(replaced.body.result).toBe('replaced');
    expect(JSON.parse(new TextDecoder().decode(bucket.objects.get(betterKey(hashOf(1)))!.value)).text).toBe('Another hearing.');
  });

  it('rejects a result made from other audio, for a take that does not exist, and bad ids', async () => {
    const bucket = fakeR2(); bucket.seed(audioKey(hashOf(1)), 'x');
    expect((await post(bucket, hashOf(1), result(hashOf(2)))).body.error).toBe('audioHash does not match this take');
    expect((await post(bucket, hashOf(1), { ...result(hashOf(1)), audioHash: undefined })).response.status).toBe(400);
    expect((await post(bucket, hashOf(3), result(hashOf(3)))).response.status).toBe(404);
    expect((await takeTranscript(context('/x', bucket, { method: 'POST', body: result(hashOf(1)), id: 'nope' }))).status).toBe(400);
    expect(bucket.objects.has(betterKey(hashOf(1)))).toBe(false);
  });

  it('bounds the body and every list, and validates each word', async () => {
    const bucket = fakeR2(); bucket.seed(audioKey(hashOf(1)), 'x');
    const big = await post(bucket, hashOf(1), result(hashOf(1), { text: 'x'.repeat(2_100_000) }));
    expect(big.response.status).toBe(413);
    expect((await post(bucket, hashOf(1), result(hashOf(1), { words: Array.from({ length: 20_001 }, () => ({ text: 'a', startMs: 0, endMs: 1 })) }))).response.status).toBe(400);
    expect((await post(bucket, hashOf(1), result(hashOf(1), { segments: Array.from({ length: 5_001 }, () => ({ text: 'a', startMs: 0, endMs: 1 })) }))).response.status).toBe(400);
    expect((await post(bucket, hashOf(1), result(hashOf(1), { words: [{ text: 'a', startMs: 5, endMs: 1 }] }))).response.status).toBe(400);
    expect((await post(bucket, hashOf(1), result(hashOf(1), { words: [{ text: 'a', startMs: 0, endMs: 1, probability: 2 }] }))).response.status).toBe(400);
    expect((await post(bucket, hashOf(1), result(hashOf(1), { text: ' ' }))).response.status).toBe(400);
    expect((await post(bucket, hashOf(1), result(hashOf(1), { resultHash: 'zz' }))).response.status).toBe(400);
    expect((await post(bucket, hashOf(1), result(hashOf(1), { engine: '<b>' }))).response.status).toBe(400);
    expect((await post(bucket, hashOf(1), undefined, { rawBody: '{not json' })).response.status).toBe(400);
    expect(bucket.objects.has(betterKey(hashOf(1)))).toBe(false);
  });

  it('takes segments in the shape the segments pickup sends, seconds and nested words', async () => {
    const bucket = fakeR2(); bucket.seed(audioKey(hashOf(1)), 'x');
    const body = result(hashOf(1), { words: undefined, segments: [{ start: 0, end: 1.5, text: 'I trust.', words: [{ start: 0, end: 0.25, text: 'I', probability: 0.3 }] }] });
    expect((await post(bucket, hashOf(1), body)).response.status).toBe(201);
    const stored = JSON.parse(new TextDecoder().decode(bucket.objects.get(betterKey(hashOf(1)))!.value));
    expect(stored.segments).toEqual([{ startMs: 0, endMs: 1500, text: 'I trust.' }]);
    expect(stored.words).toEqual([{ text: 'I', startMs: 0, endMs: 250, probability: 0.3 }]);
  });

  it('a set-aside take leaves the list, and a kept result is never set aside', async () => {
    const bucket = fakeR2(); bucket.seed(audioKey(hashOf(1)), 'x'); bucket.seed(audioKey(hashOf(2)), 'x');
    expect((await post(bucket, hashOf(1), { outcome: 'skipped', audioHash: hashOf(1) })).response.status).toBe(400);
    expect((await post(bucket, hashOf(1), { outcome: 'skipped', audioHash: hashOf(1), reason: 'no speech' })).body.result).toBe('skipped');
    expect((await list(bucket)).body.takes.map((take: any) => take.audioHash)).toEqual([hashOf(2)]);
    await post(bucket, hashOf(2), result(hashOf(2)));
    expect((await post(bucket, hashOf(2), { outcome: 'skipped', audioHash: hashOf(2), reason: 'later' })).body.result).toBe('unchanged');
    expect(JSON.parse(new TextDecoder().decode(bucket.objects.get(betterKey(hashOf(2)))!.value)).outcome).toBe('improved');
    // A better result after a set-aside one is taken without replace.
    expect((await post(bucket, hashOf(1), result(hashOf(1)))).body.result).toBe('improved');
  });
});

describe('take details', () => {
  it('keeps valid bounded fields and drops the rest', () => {
    expect(cleanTakeDetails({ durationMs: 1000, cardNumber: 12, sectionId: '12/CODE', captureId: 'cap_1', recordedAt: '2026-11-01T08:00:00+01:00' }))
      .toEqual({ v: '1', durationMs: '1000', cardNumber: '12', sectionId: '12/CODE', captureId: 'cap_1', recordedAt: '2026-11-01T07:00:00.000Z' });
    expect(cleanTakeDetails({ durationMs: -1, cardNumber: 65, sectionId: 'x'.repeat(201), captureId: '../x', recordedAt: 'yesterday' })).toEqual({ v: '1' });
    expect(cleanTakeDetails({ durationMs: 1.5, cardNumber: '12', sectionId: 'line\nbreak', recordedAt: '1970-01-01T00:00:00Z' })).toEqual({ v: '1' });
    expect(cleanTakeDetails('nonsense')).toEqual({ v: '1' });
    expect(readTakeDetails({ customMetadata: { v: '1', cardNumber: '999' }, httpMetadata: { contentType: 'text/html' } } as never)).toMatchObject({ detailsKnown: true, cardNumber: null, mimeType: 'application/octet-stream' });
  });
});

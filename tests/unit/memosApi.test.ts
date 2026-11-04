import { beforeEach, describe, expect, it, vi } from 'vitest';
import { timedTranscriptText } from '../../functions/api/memos/_shared';

const getSession = vi.fn();
vi.mock('../../lib/account/auth.server.js', () => ({ createAuth: () => ({ api: { getSession } }) }));

const KEY = 'p'.repeat(48);
const MEMO = '00000000-0000-4000-8000-0000000000aa';
const adminSession = { user: { id: 'admin-1', email: 'a@example.com', emailVerified: true }, session: { id: 's' } };

/** An in-memory private bucket with the etag rules the memo manifest relies on. */
function fakeBucket() {
  const store = new Map<string, { body: string | ArrayBuffer; etag: string; type?: string }>();
  let version = 0;
  const read = async (body: unknown) => typeof body === 'string' ? body : body instanceof ArrayBuffer ? body : await new Response(body as BodyInit).arrayBuffer();
  return {
    store,
    async get(key: string) {
      const hit = store.get(key); if (!hit) return null;
      const text = typeof hit.body === 'string' ? hit.body : new TextDecoder().decode(hit.body);
      return { etag: hit.etag, httpEtag: `"${hit.etag}"`, size: typeof hit.body === 'string' ? hit.body.length : hit.body.byteLength, httpMetadata: { contentType: hit.type }, body: text, json: async () => JSON.parse(text), text: async () => text, arrayBuffer: async () => typeof hit.body === 'string' ? new TextEncoder().encode(hit.body).buffer : hit.body };
    },
    async put(key: string, body: unknown, options: { onlyIf?: { etagMatches?: string; etagDoesNotMatch?: string }; httpMetadata?: { contentType?: string } } = {}) {
      const current = store.get(key);
      if (options.onlyIf?.etagMatches !== undefined && current?.etag !== options.onlyIf.etagMatches) return null;
      if (options.onlyIf?.etagDoesNotMatch === '*' && current) return null;
      const etag = `e${++version}`; store.set(key, { body: await read(body), etag, type: options.httpMetadata?.contentType });
      return { key, etag };
    },
    async delete(key: string) { store.delete(key); },
    async list({ prefix, delimiter }: { prefix: string; delimiter?: string; cursor?: string }) {
      const keys = [...store.keys()].filter((key) => key.startsWith(prefix)).sort();
      if (!delimiter) return { objects: keys.map((key) => ({ key })), truncated: false, delimitedPrefixes: [] };
      const prefixes = [...new Set(keys.map((key) => key.slice(prefix.length)).filter((rest) => rest.includes(delimiter)).map((rest) => prefix + rest.slice(0, rest.indexOf(delimiter) + 1)))];
      return { objects: [], truncated: false, delimitedPrefixes: prefixes };
    },
  };
}

const ctx = (request: Request, env: Record<string, unknown>, params: Record<string, string> = {}) => ({ request, env, params, waitUntil: vi.fn() }) as never;
const pickup = (path: string, init: RequestInit = {}) => new Request(`https://example.test${path}`, { ...init, headers: { Authorization: `Bearer ${KEY}`, ...(init.headers ?? {}) } });

describe('memos from the phone', () => {
  let bucket: ReturnType<typeof fakeBucket>;
  let env: Record<string, unknown>;
  beforeEach(() => {
    vi.resetModules(); getSession.mockReset(); getSession.mockResolvedValue(adminSession);
    bucket = fakeBucket(); env = { DB: {}, ADMIN_EMAILS: 'a@example.com', ORACLE_PRIVATE: bucket, AR_PICKUP_TOKEN: KEY };
  });

  async function memoWithAudioAndPhoto() {
    const { onRequestPost: create } = await import('../../functions/api/memos');
    expect((await create(ctx(new Request('https://example.test/api/memos', { method: 'POST', body: JSON.stringify({ id: MEMO, title: '  Yingge   kiln ' }) }), env))).status).toBe(201);
    const { onRequestPost: audio } = await import('../../functions/api/memos/[id]/audio');
    const sound = new Uint8Array([1, 2, 3, 4]);
    expect((await audio(ctx(new Request('https://example.test/x', { method: 'POST', body: sound, headers: { 'Content-Type': 'audio/mp4', 'Content-Length': '4' } }), env, { id: MEMO }))).status).toBe(200);
    const { onRequestPost: photo } = await import('../../functions/api/memos/[id]/photos');
    const added = await photo(ctx(new Request('https://example.test/x?name=bowl.jpg', { method: 'POST', body: new Uint8Array([9, 9]), headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '2' } }), env, { id: MEMO }));
    expect(added.status).toBe(201);
    return (await added.json()).memo;
  }

  it('keeps one memo per id, with its recording and photos stored as sent', async () => {
    const memo = await memoWithAudioAndPhoto();
    expect(memo).toMatchObject({ id: MEMO, title: 'Yingge kiln', audio: { mimeType: 'audio/mp4', byteSize: 4 }, photos: [{ name: 'bowl.jpg', mimeType: 'image/jpeg', byteSize: 2 }], transcript: { status: 'none' } });
    expect(memo).not.toHaveProperty('ownerUserId');
    const { onRequestPost: create } = await import('../../functions/api/memos');
    expect((await create(ctx(new Request('https://example.test/api/memos', { method: 'POST', body: JSON.stringify({ id: MEMO }) }), env))).status).toBe(200);
    expect([...bucket.store.keys()].filter((k) => k.endsWith('manifest.json'))).toHaveLength(1);
  });

  it('refuses uploads that are not audio or photos, or say no size', async () => {
    const { onRequestPost: create } = await import('../../functions/api/memos');
    await create(ctx(new Request('https://example.test/api/memos', { method: 'POST', body: JSON.stringify({ id: MEMO }) }), env));
    const { onRequestPost: audio } = await import('../../functions/api/memos/[id]/audio');
    expect((await audio(ctx(new Request('https://example.test/x', { method: 'POST', body: 'x', headers: { 'Content-Type': 'text/plain', 'Content-Length': '1' } }), env, { id: MEMO }))).status).toBe(415);
    expect((await audio(ctx(new Request('https://example.test/x', { method: 'POST', body: 'x', headers: { 'Content-Type': 'audio/mp4', 'Content-Length': String(26 * 1024 * 1024) } }), env, { id: MEMO }))).status).toBe(413);
  });

  it('is private: a visitor without the admin session gets nothing', async () => {
    getSession.mockResolvedValue(null);
    const { onRequestGet } = await import('../../functions/api/memos');
    expect((await onRequestGet(ctx(new Request('https://example.test/api/memos'), env))).status).toBe(401);
  });

  it('lets the VPS claim a memo once, send its transcript, and collect it', async () => {
    await memoWithAudioAndPhoto();
    const { onRequestGet: list } = await import('../../functions/api/oracle/pickup/memos');
    const waiting = await (await list(ctx(pickup('/api/oracle/pickup/memos?waiting=transcript'), env))).json();
    expect(waiting.memos.map((m: { id: string }) => m.id)).toEqual([MEMO]);

    const { onRequestPost: post } = await import('../../functions/api/oracle/pickup/memos/[id]/transcript');
    const claim = await (await post(ctx(pickup('/x', { method: 'POST', body: JSON.stringify({ claim: true }) }), env, { id: MEMO }))).json();
    expect(claim.ok).toBe(true);
    expect((await post(ctx(pickup('/x', { method: 'POST', body: JSON.stringify({ claim: true }) }), env, { id: MEMO }))).status).toBe(409);

    const transcript = { provider: 'groq', model: 'whisper-large-v3-turbo', text: 'The crack records them. I went back.', rawText: 'The crack records them. I went back.', wordFixes: [], duration: 70, segments: [{ start: 0, end: 3, text: 'The crack records them.' }, { start: 66, end: 70, text: 'I went back.' }] };
    expect((await post(ctx(pickup('/x', { method: 'POST', body: JSON.stringify({ startedAt: 'stale', transcript }) }), env, { id: MEMO }))).status).toBe(409);
    const done = await (await post(ctx(pickup('/x', { method: 'POST', body: JSON.stringify({ startedAt: claim.startedAt, transcript }) }), env, { id: MEMO }))).json();
    expect(done.memo.transcript).toMatchObject({ status: 'done', provider: 'groq' });

    const { onRequestGet: one } = await import('../../functions/api/oracle/pickup/memos/[id]');
    const read = await (await one(ctx(pickup('/x'), env, { id: MEMO }))).json();
    expect(read.transcript).toBe('[0:00] The crack records them.\n\n[1:06] I went back.\n');
    expect(read.files.photos).toHaveLength(1);

    const { onRequestGet: file } = await import('../../functions/api/oracle/pickup/memos/[id]/files/[file]');
    expect((await file(ctx(pickup('/x'), env, { id: MEMO, file: 'audio' }))).headers.get('Content-Type')).toBe('audio/mp4');
    expect((await file(ctx(pickup('/x'), env, { id: MEMO, file: read.files.photos[0].id }))).headers.get('Content-Type')).toBe('image/jpeg');

    const collect = async () => (await (await list(ctx(pickup('/api/oracle/pickup/memos?waiting=collect&by=vps'), env))).json()).memos.length;
    expect(await collect()).toBe(1);
    const { onRequestPost: picked } = await import('../../functions/api/oracle/pickup/memos/[id]/picked');
    expect((await picked(ctx(pickup('/x', { method: 'POST', body: JSON.stringify({ by: 'vps' }) }), env, { id: MEMO }))).status).toBe(200);
    expect(await collect()).toBe(0);
  });

  it('keeps the finished plan the VPS leaves for the Mac, and lists it until the Mac takes it in', async () => {
    await memoWithAudioAndPhoto();
    const { onRequestPost: post } = await import('../../functions/api/oracle/pickup/memos/[id]/transcript');
    const { onRequestPost: handoff } = await import('../../functions/api/oracle/pickup/memos/[id]/handoff');
    const plan = JSON.stringify({ schema: 'ar-create.instagram-plan.v1', id: '00000000-0000-4000-8000-0000000000bb', revision: 7, lines: [] });
    const send = (body: string) => handoff(ctx(pickup('/x', { method: 'POST', body, headers: { 'Content-Length': String(body.length) } }), env, { id: MEMO }));
    expect((await send(plan)).status).toBe(409);
    const claim = await (await post(ctx(pickup('/x', { method: 'POST', body: JSON.stringify({ claim: true }) }), env, { id: MEMO }))).json();
    await post(ctx(pickup('/x', { method: 'POST', body: JSON.stringify({ startedAt: claim.startedAt, transcript: { provider: 'groq', model: 'm', text: 'One.', rawText: 'One.', wordFixes: [], duration: 1 } }) }), env, { id: MEMO }));
    expect((await send('{"schema":"something-else"}')).status).toBe(400);
    expect((await send(plan)).status).toBe(200);

    const { onRequestGet: list } = await import('../../functions/api/oracle/pickup/memos');
    const waiting = async () => (await (await list(ctx(pickup('/api/oracle/pickup/memos?waiting=handoff&by=mac'), env))).json()).memos;
    expect((await waiting()).map((m: { handoff: { revision: number } }) => m.handoff.revision)).toEqual([7]);
    const { onRequestGet: file } = await import('../../functions/api/oracle/pickup/memos/[id]/files/[file]');
    expect(await (await file(ctx(pickup('/x'), env, { id: MEMO, file: 'handoff' }))).text()).toBe(plan);

    const { onRequestPost: picked } = await import('../../functions/api/oracle/pickup/memos/[id]/picked');
    await picked(ctx(pickup('/x', { method: 'POST', body: JSON.stringify({ by: 'mac', what: 'handoff' }) }), env, { id: MEMO }));
    expect(await waiting()).toHaveLength(0);
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect((await send(plan.replace('"revision":7', '"revision":8'))).status).toBe(200);
    expect((await waiting()).map((m: { handoff: { revision: number } }) => m.handoff.revision)).toEqual([8]);
  });

  it('refuses the pickup without the key', async () => {
    const { onRequestGet: list } = await import('../../functions/api/oracle/pickup/memos');
    expect((await list(ctx(new Request('https://example.test/api/oracle/pickup/memos'), env))).status).toBe(401);
  });
});

describe('timed transcript text', () => {
  it('starts a paragraph at each long pause or every minute, each with its time, adding no words', () => {
    const text = timedTranscriptText({ text: 'a b c d', segments: [{ start: 0, end: 1, text: 'One.' }, { start: 1.2, end: 2, text: 'Two.' }, { start: 5, end: 6, text: 'Three.' }, { start: 3725, end: 3726, text: 'Late.' }] });
    expect(text).toBe('[0:00] One. Two.\n\n[0:05] Three.\n\n[1:02:05] Late.\n');
  });
  it('falls back to the plain text when there are no timings', () => {
    expect(timedTranscriptText({ text: ' Only text. ' })).toBe('Only text.\n');
  });
});

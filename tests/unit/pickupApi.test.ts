import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyBetter, awaitingBetter, betterView, fromSentenceLines, parseMeta, resolveBetter, toSentenceLines } from '../../utils/oracleBetterTranscript';

const getSession = vi.fn();
vi.mock('../../lib/account/auth.server.js', () => ({ createAuth: () => ({ api: { getSession } }) }));

const KEY = 'p'.repeat(48);
const ID = '00000000-0000-4000-8000-000000000001';
const SESSION = '00000000-0000-4000-8000-000000000002';
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const adminSession = { user: { id: 'admin-1', email: 'a@example.com', emailVerified: true }, session: { id: 's' } };

type Row = Record<string, unknown>;
const makeRow = (overrides: Row = {}): Row => ({
  id: ID, session_id: SESSION, owner_user_id: 'admin-1', sequence: 0, recorded_at: '2026-11-01T08:00:00.000Z', duration_ms: 9000,
  mime_type: 'audio/mp4', byte_size: 6, object_key: `reflections/admin-1/${SESSION}/${ID}`, transcript: 'Lou Yo wrote the classic of tea. It was a book. We drank shaw puerh.',
  transcription_status: 'transcribed', transcription_error: null, transcription_started_at: null,
  provider_metadata_json: JSON.stringify({ provider: 'groq', wordCount: 10 }), created_at: '2026-11-01T08:00:00.000Z', updated_at: '2026-11-01T08:00:00.000Z', hexagram_number: 12,
  ...overrides,
});

/** An in-memory stand-in for the one table the pickup touches, answering exactly the statements the handlers send. */
function fakeDb(rows: Row[]) {
  const find = (id: unknown) => rows.find((row) => row.id === id) ?? null;
  return {
    prepare(sql: string) {
      return {
        bind(...v: unknown[]) {
          return {
            async first() {
              if (sql.startsWith('SELECT object_key')) { const row = find(v[0]); return row ? { object_key: row.object_key, mime_type: row.mime_type, byte_size: row.byte_size } : null; }
              if (sql.startsWith('SELECT transcript,provider_metadata_json')) { const row = find(v[0]); return row && row.owner_user_id === v[1] ? { ...row } : null; }
              if (sql.startsWith('SELECT * FROM oracle_reflection_segments WHERE id=?1')) { const row = find(v[0]); if (!row) return null; if (sql.includes('owner_user_id=?2') && row.owner_user_id !== v[1]) return null; return { ...row }; }
              return null;
            },
            async all() {
              if (sql.includes('JOIN oracle_reflection_sessions')) return { results: rows.filter((r) => ['transcribed', 'failed', 'transcription_pending'].includes(String(r.transcription_status))).map((r) => ({ ...r })) };
              return { results: [] };
            },
            async run() {
              if (sql.includes("SET transcript=?2,transcription_status='transcribed'")) {
                const row = find(v[0]); if (!row || row.updated_at !== v[4]) return { meta: { changes: 0 } };
                Object.assign(row, { transcript: v[1], transcription_status: 'transcribed', transcription_error: null, transcription_started_at: null, provider_metadata_json: v[2], updated_at: v[3] });
                return { meta: { changes: 1 } };
              }
              if (sql.startsWith('UPDATE oracle_reflection_segments SET provider_metadata_json=?2 WHERE id=?1')) {
                const row = find(v[0]); if (!row || row.updated_at !== v[2]) return { meta: { changes: 0 } };
                row.provider_metadata_json = v[1]; return { meta: { changes: 1 } };
              }
              if (sql.includes('SET transcript=?3,provider_metadata_json=?4,updated_at=?5')) {
                const row = find(v[0]); if (!row || row.owner_user_id !== v[1] || row.updated_at !== v[5]) return { meta: { changes: 0 } };
                Object.assign(row, { transcript: v[2], provider_metadata_json: v[3], updated_at: v[4] }); return { meta: { changes: 1 } };
              }
              if (sql.includes("SET transcript=?3,transcription_status='transcribed'")) {
                const row = find(v[0]); if (!row || row.owner_user_id !== v[1]) return { meta: { changes: 0 } };
                Object.assign(row, { transcript: v[2], transcription_status: 'transcribed', provider_metadata_json: v[3], updated_at: v[4] }); return { meta: { changes: 1 } };
              }
              return { meta: { changes: 0 } };
            },
          };
        },
      };
    },
  };
}

/** A real SQLite answering the list query, so its SQL (LIMIT, json_extract) is exercised and not stood in for. */
function sqliteDb(rows: Row[]) {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE oracle_reflection_sessions (id TEXT PRIMARY KEY, hexagram_number INTEGER); CREATE TABLE oracle_reflection_segments (id TEXT PRIMARY KEY, session_id TEXT, recorded_at TEXT, duration_ms INTEGER, mime_type TEXT, byte_size INTEGER, transcript TEXT, transcription_status TEXT, provider_metadata_json TEXT)');
  db.prepare('INSERT INTO oracle_reflection_sessions VALUES (?,?)').run(SESSION, 12);
  const insert = db.prepare('INSERT INTO oracle_reflection_segments VALUES (?,?,?,?,?,?,?,?,?)');
  for (const r of rows) insert.run(...[r.id, r.session_id, r.recorded_at, r.duration_ms, r.mime_type, r.byte_size, r.transcript, r.transcription_status, r.provider_metadata_json] as (string | number | null)[]);
  return { prepare: (sql: string) => ({ bind: (...v: unknown[]) => ({ all: async () => ({ results: db.prepare(sql).all(...v as (string | number)[]) }) }) }) };
}

function fakeBucket() {
  const objects = new Map<string, Uint8Array | string>([[`reflections/admin-1/${SESSION}/${ID}`, new Uint8Array([1, 2, 3, 4, 5, 6])]]);
  return {
    objects,
    async put(key: string, value: string | ArrayBuffer) { objects.set(key, typeof value === 'string' ? value : new Uint8Array(value)); },
    async get(key: string, options?: { range?: { offset: number; length: number } }) {
      const value = objects.get(key); if (value === undefined || typeof value === 'string') return null;
      const bytes = options?.range ? value.slice(options.range.offset, options.range.offset + options.range.length) : value;
      return { body: bytes };
    },
  };
}

const improved = (extra: Record<string, unknown> = {}) => ({
  outcome: 'improved', engine: 'ar-create', text: 'Lu Yu wrote the Classic of Tea. It was a book. We drank Shou Puerh.', resultHash: HASH_A,
  segments: [{ start: 0, end: 2, text: 'Lu Yu wrote the Classic of Tea.', words: [{ start: 0, end: 0.3, text: 'Lu' }] }], speakers: [{ id: 's1' }], ...extra,
});

async function pickup(method: string, route: string, row: Row[], opts: { token?: string | null; env?: Record<string, unknown>; body?: unknown; headers?: Record<string, string> } = {}) {
  const bucket = (opts.env?.ORACLE_PRIVATE as ReturnType<typeof fakeBucket>) ?? fakeBucket();
  const env = { DB: fakeDb(row), ORACLE_PRIVATE: bucket, AR_PICKUP_TOKEN: KEY, ...opts.env };
  const headers: Record<string, string> = { ...(opts.token === null ? {} : { Authorization: `Bearer ${opts.token ?? KEY}` }), ...(opts.headers ?? {}) };
  const request = new Request(`https://example.test${route}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  const context = { request, env, params: { id: ID }, waitUntil: vi.fn() } as never;
  let handler;
  if (route.includes('/audio')) handler = (await import('../../functions/api/oracle/pickup/segments/[id]/audio')).onRequestGet;
  else if (route.includes('/transcript')) handler = (await import('../../functions/api/oracle/pickup/segments/[id]/transcript')).onRequestPost;
  else handler = (await import('../../functions/api/oracle/pickup/segments')).onRequestGet;
  return { response: await handler(context), bucket, env };
}

describe('pickup key', () => {
  it('refuses every route when no key is set, with a wrong key, with no key sent, and with a short key', async () => {
    const rows = [makeRow()];
    for (const route of ['/api/oracle/pickup/segments', `/api/oracle/pickup/segments/${ID}/audio`]) {
      expect((await pickup('GET', route, rows, { env: { AR_PICKUP_TOKEN: undefined } })).response.status).toBe(503);
      expect((await pickup('GET', route, rows, { env: { AR_PICKUP_TOKEN: 'short' }, token: 'short' })).response.status).toBe(503);
      expect((await pickup('GET', route, rows, { token: 'x'.repeat(48) })).response.status).toBe(401);
      expect((await pickup('GET', route, rows, { token: null })).response.status).toBe(401);
    }
    const post = await pickup('POST', `/api/oracle/pickup/segments/${ID}/transcript`, rows, { token: 'x'.repeat(48), body: improved() });
    expect(post.response.status).toBe(401);
    expect(post.response.headers.get('WWW-Authenticate')).toBe('Bearer');
    expect(rows[0].transcript).toBe('Lou Yo wrote the classic of tea. It was a book. We drank shaw puerh.');
  });

  it('is not opened by an admin login alone, and never echoes the key', async () => {
    getSession.mockResolvedValue(adminSession);
    const { response } = await pickup('GET', '/api/oracle/pickup/segments', [makeRow()], { token: null, headers: { Cookie: 'better-auth.session=anything' }, env: { ADMIN_EMAILS: 'a@example.com' } });
    expect(response.status).toBe(401);
    const ok = await pickup('GET', '/api/oracle/pickup/segments', [makeRow()]);
    expect(JSON.stringify(await ok.response.json())).not.toContain(KEY);
  });
});

describe('pickup list and audio', () => {
  it('lists recordings still waiting, oldest first, with the phone draft, and leaves out finished and set-aside ones', async () => {
    const waiting = makeRow();
    const done = makeRow({ id: '00000000-0000-4000-8000-000000000003', provider_metadata_json: JSON.stringify({ provider: 'ar-create', arCreate: { state: 'applied', resultHash: HASH_A } }) });
    const aside = makeRow({ id: '00000000-0000-4000-8000-000000000004', provider_metadata_json: JSON.stringify({ provider: 'groq', pickupSkipped: { reason: 'no speech', at: 'x' } }) });
    const busy = makeRow({ id: '00000000-0000-4000-8000-000000000005', transcription_status: 'transcribing' });
    const { response } = await pickup('GET', '/api/oracle/pickup/segments', [waiting, done, aside, busy]);
    const body = await response.json() as { segments: Row[]; more: boolean };
    expect(response.status).toBe(200);
    expect(body.segments.map((s) => s.id)).toEqual([ID]);
    expect(body.segments[0]).toMatchObject({ hexagramNumber: 12, mimeType: 'audio/mp4', draft: { text: 'Lou Yo wrote the classic of tea. It was a book. We drank shaw puerh.', provider: 'groq' }, audioPath: `/api/oracle/pickup/segments/${ID}/audio` });
    expect(body.more).toBe(false);
  });

  it('still reaches a waiting recording behind more than 200 handled ones, with the rule applied in SQL', async () => {
    const at = (i: number) => new Date(Date.UTC(2026, 9, 1) + i * 60000).toISOString();
    const handled = Array.from({ length: 250 }, (_, i) => makeRow({ id: `h-${i}`, recorded_at: at(i), provider_metadata_json: JSON.stringify(i % 2 ? { provider: 'ar-create', arCreate: { state: 'applied', resultHash: HASH_A } } : { provider: 'groq', pickupSkipped: { reason: 'no speech', at: 'x' } }) }));
    const falsy = [null, false, 0, ''].map((value, i) => makeRow({ id: `f-${i}`, recorded_at: at(300 + i), provider_metadata_json: JSON.stringify({ provider: 'groq', arCreate: value }) }));
    const unreadable = makeRow({ id: 'bad-json', recorded_at: at(310), provider_metadata_json: '{not json' });
    const waiting = makeRow({ recorded_at: at(320) });
    const DB = sqliteDb([...handled, ...falsy, unreadable, waiting]);
    const first = await pickup('GET', '/api/oracle/pickup/segments?limit=3', [], { env: { DB } });
    const body = await first.response.json() as { segments: Row[]; more: boolean };
    expect(first.response.status).toBe(200);
    expect(body.segments.map((s) => s.id)).toEqual(['f-0', 'f-1', 'f-2']);
    expect(body.more).toBe(true);
    const all = await (await pickup('GET', '/api/oracle/pickup/segments?limit=50', [], { env: { DB } })).response.json() as { segments: Row[]; more: boolean };
    expect(all.segments.map((s) => s.id)).toEqual(['f-0', 'f-1', 'f-2', 'f-3', 'bad-json', ID]);
    expect(all.more).toBe(false);
    for (const row of [...handled, ...falsy, unreadable, waiting]) expect(all.segments.some((s) => s.id === row.id)).toBe(awaitingBetter(parseMeta(row.provider_metadata_json)));
  });

  it('serves the audio bytes, and a byte range', async () => {
    const whole = await pickup('GET', `/api/oracle/pickup/segments/${ID}/audio`, [makeRow()]);
    expect(whole.response.status).toBe(200);
    expect(whole.response.headers.get('Content-Type')).toBe('audio/mp4');
    expect(new Uint8Array(await whole.response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]));
    const part = await pickup('GET', `/api/oracle/pickup/segments/${ID}/audio`, [makeRow()], { headers: { Range: 'bytes=2-3' } });
    expect(part.response.status).toBe(206);
    expect(part.response.headers.get('Content-Range')).toBe('bytes 2-3/6');
    expect(new Uint8Array(await part.response.arrayBuffer())).toEqual(new Uint8Array([3, 4]));
    expect((await pickup('GET', `/api/oracle/pickup/segments/${ID}/audio`, [])).response.status).toBe(404);
  });
});

describe('accepting a better transcript', () => {
  it('unedited: the Mac version becomes the working text and the phone draft is kept as the raw record', async () => {
    const rows = [makeRow({ provider_metadata_json: JSON.stringify({ provider: 'groq', wordCount: 10, rawTranscript: 'lou yo wrote', wordFixes: [{ a: 1 }] }) })];
    const { response, bucket } = await pickup('POST', `/api/oracle/pickup/segments/${ID}/transcript`, rows, { body: improved() });
    expect(response.status).toBe(201);
    expect((await response.json() as Row).result).toBe('applied');
    expect(rows[0].transcript).toBe('Lu Yu wrote the Classic of Tea. It was a book. We drank Shou Puerh.');
    const meta = parseMeta(rows[0].provider_metadata_json);
    expect(meta.provider).toBe('ar-create');
    expect(meta.draft).toEqual({ provider: 'groq', text: 'Lou Yo wrote the classic of tea. It was a book. We drank shaw puerh.', rawTranscript: 'lou yo wrote', wordFixes: [{ a: 1 }] });
    expect(meta.arCreate).toMatchObject({ state: 'applied', engine: 'ar-create', resultHash: HASH_A, speakerCount: 1 });
    expect(awaitingBetter(meta)).toBe(false);
    const stored = JSON.parse(String(bucket.objects.get(`reflections/admin-1/${SESSION}/${ID}.ar-create.json`)));
    expect(stored.segments[0].words[0].text).toBe('Lu');
    // the signed-in page sees both
    expect(betterView(meta)).toMatchObject({ state: 'applied', draft: { text: 'Lou Yo wrote the classic of tea. It was a book. We drank shaw puerh.' } });
  });

  it('sending the same result again changes nothing; a new result is a new version and the old one is remembered', async () => {
    const rows = [makeRow()];
    await pickup('POST', `/api/oracle/pickup/segments/${ID}/transcript`, rows, { body: improved() });
    const first = JSON.stringify(rows[0]);
    const again = await pickup('POST', `/api/oracle/pickup/segments/${ID}/transcript`, rows, { body: improved() });
    expect((await again.response.json() as Row).result).toBe('unchanged');
    expect(JSON.stringify(rows[0])).toBe(first);
    const newer = await pickup('POST', `/api/oracle/pickup/segments/${ID}/transcript`, rows, { body: improved({ resultHash: HASH_B, text: 'Lu Yu wrote the Classic of Tea. It was a book. We drank Shou Puerh with Maria.' }) });
    expect((await newer.response.json() as Row).result).toBe('applied');
    const meta = parseMeta(rows[0].provider_metadata_json);
    expect(meta.arCreateEarlier).toEqual([{ resultHash: HASH_A, receivedAt: expect.any(String), wordCount: 15 }]);
    expect(meta.draft?.text).toBe('Lou Yo wrote the classic of tea. It was a book. We drank shaw puerh.');
  });

  it('edited by hand: the words stand, the Mac version waits as a comparison, the draft is kept', async () => {
    const edited = 'Lu Yu wrote the Classic of Tea long ago. It was a book. We drank shaw puerh.';
    const rows = [makeRow({ transcript: edited, provider_metadata_json: JSON.stringify({ provider: 'manual', wordCount: 12, draft: { provider: 'groq', text: 'Lou Yo wrote the classic of tea. It was a book. We drank shaw puerh.' } }) })];
    const { response } = await pickup('POST', `/api/oracle/pickup/segments/${ID}/transcript`, rows, { body: improved() });
    expect(response.status).toBe(201);
    expect((await response.json() as Row).result).toBe('reconcile');
    expect(rows[0].transcript).toBe(edited);
    const meta = parseMeta(rows[0].provider_metadata_json);
    expect(meta.provider).toBe('manual');
    expect(meta.draft?.text).toBe('Lou Yo wrote the classic of tea. It was a book. We drank shaw puerh.');
    expect(meta.arCreate?.state).toBe('reconcile');
    const view = betterView(meta)!;
    expect(view.comparison!.changes.length).toBe(2);
    expect(view.comparison!.changes[0]).toMatchObject({ before: 'Lu Yu wrote the Classic of Tea long ago.\n', after: 'Lu Yu wrote the Classic of Tea.\n' });
  });

  it('edited at a moment the Mac text equals his: nothing to compare, settled quietly', () => {
    const outcome = applyBetter({ transcript: 'Same words.', metadata: { provider: 'manual' } }, { engine: 'ar-create', text: 'Same words.', resultHash: HASH_A }, 'now');
    expect(outcome.outcome).toBe('unchanged');
    expect(outcome.meta.arCreate?.state).toBe('resolved');
  });

  it('a recording the phone could not transcribe takes the Mac version as its first text', async () => {
    const rows = [makeRow({ transcript: '', transcription_status: 'failed', transcription_error: 'Groq down', provider_metadata_json: null })];
    const { response } = await pickup('POST', `/api/oracle/pickup/segments/${ID}/transcript`, rows, { body: improved() });
    expect(response.status).toBe(201);
    expect(rows[0]).toMatchObject({ transcription_status: 'transcribed', transcription_error: null, transcript: 'Lu Yu wrote the Classic of Tea. It was a book. We drank Shou Puerh.' });
    expect(parseMeta(rows[0].provider_metadata_json).draft).toBeUndefined();
  });

  it('a recording the Mac cannot do is set aside and stops being offered, with the draft untouched', async () => {
    const rows = [makeRow()];
    const { response } = await pickup('POST', `/api/oracle/pickup/segments/${ID}/transcript`, rows, { body: { outcome: 'skipped', reason: 'No speech was found.' } });
    expect((await response.json() as Row).result).toBe('skipped');
    expect(rows[0].transcript).toBe('Lou Yo wrote the classic of tea. It was a book. We drank shaw puerh.');
    const list = await pickup('GET', '/api/oracle/pickup/segments', rows);
    expect((await list.response.json() as { segments: Row[] }).segments).toEqual([]);
  });

  it('refuses bad input without changing anything', async () => {
    const rows = [makeRow()];
    const before = JSON.stringify(rows[0]);
    const route = `/api/oracle/pickup/segments/${ID}/transcript`;
    for (const body of [{ outcome: 'nope' }, improved({ text: '   ' }), improved({ resultHash: 'zz' }), improved({ engine: '<script>' }), { outcome: 'skipped' }]) {
      expect((await pickup('POST', route, rows, { body })).response.status).toBe(400);
    }
    expect((await pickup('POST', route, [], { body: improved() })).response.status).toBe(404);
    expect(JSON.stringify(rows[0])).toBe(before);
  });
});

describe('the comparison Adrian answers', () => {
  const edited = () => makeRow({ transcript: 'Lu Yu wrote the Classic of Tea long ago. It was a book. We drank shaw puerh.', provider_metadata_json: JSON.stringify({ provider: 'manual', wordCount: 12, draft: { provider: 'groq', text: 'first draft' } }) });
  async function raise() {
    const rows = [edited()];
    await pickup('POST', `/api/oracle/pickup/segments/${ID}/transcript`, rows, { body: improved() });
    return rows;
  }
  async function answer(rows: Row[], decisions: Record<string, string>) {
    getSession.mockResolvedValue(adminSession);
    const { onRequestPost } = await import('../../functions/api/oracle/reflections/segments/[id]/better');
    return onRequestPost({ request: new Request('https://example.test/better', { method: 'POST', body: JSON.stringify({ decisions }) }), env: { DB: fakeDb(rows), ADMIN_EMAILS: 'a@example.com' }, params: { id: ID }, waitUntil: vi.fn() } as never);
  }

  it('change by change: use the Mac version for one, keep his words for another; defer leaves the words alone', async () => {
    const rows = await raise();
    const original = rows[0].transcript;
    const partial = await answer(rows, { 'change-1': 'accept' });
    expect(partial.status).toBe(200);
    expect((await partial.json() as Row).done).toBe(false);
    expect(rows[0].transcript).toBe(original);
    const deferred = await answer(rows, { 'change-3': 'defer' });
    expect((await deferred.json() as Row).done).toBe(false);
    expect(rows[0].transcript).toBe(original);
    const final = await answer(rows, { 'change-3': 'keep' });
    expect((await final.json() as Row).done).toBe(true);
    expect(rows[0].transcript).toBe('Lu Yu wrote the Classic of Tea. It was a book. We drank shaw puerh.');
    const meta = parseMeta(rows[0].provider_metadata_json);
    expect(meta.arCreate?.state).toBe('resolved');
    expect(meta.arCreate?.reconciliation).toBeUndefined();
    expect(meta.draft?.text).toBe('first draft');
    expect(meta.provider).toBe('manual');
  });

  it('refuses a change that is not in the comparison and a choice that is not a choice', async () => {
    const rows = await raise();
    expect((await answer(rows, { 'change-9': 'accept' })).status).toBe(409);
    expect((await answer(rows, { 'change-1': 'whatever' })).status).toBe(409);
    expect((await answer([makeRow()], { 'change-1': 'accept' })).status).toBe(409);
  });

  it('an edit while the comparison is open ends it and keeps everything on record', async () => {
    const rows = await raise();
    getSession.mockResolvedValue(adminSession);
    const { onRequestPatch } = await import('../../functions/api/oracle/reflections/segments/[id]');
    const response = await onRequestPatch({ request: new Request('https://example.test/p', { method: 'PATCH', body: JSON.stringify({ transcript: 'Brand new words.' }) }), env: { DB: fakeDb(rows), ADMIN_EMAILS: 'a@example.com' }, params: { id: ID }, waitUntil: vi.fn() } as never);
    expect(response.status).toBe(200);
    const meta = parseMeta(rows[0].provider_metadata_json);
    expect(meta.arCreate?.state).toBe('resolved');
    expect(meta.draft?.text).toBe('first draft');
  });

  it('sentence lines round trip, including real line breaks', () => {
    for (const text of ['One. Two! Three?', 'First paragraph.\nSecond one. Another.', 'No end']) expect(fromSentenceLines(toSentenceLines(text))).toBe(text);
  });
});

describe('a manual edit no longer erases the phone draft', () => {
  beforeEach(() => { getSession.mockReset(); vi.spyOn(console, 'error').mockImplementation(() => undefined); });
  afterEach(() => vi.restoreAllMocks());

  it('keeps the first draft beside the edit, and the Mac version if there is one', async () => {
    getSession.mockResolvedValue(adminSession);
    const rows = [makeRow()];
    const { onRequestPatch } = await import('../../functions/api/oracle/reflections/segments/[id]');
    const response = await onRequestPatch({ request: new Request('https://example.test/p', { method: 'PATCH', body: JSON.stringify({ transcript: 'My own words.' }) }), env: { DB: fakeDb(rows), ADMIN_EMAILS: 'a@example.com' }, params: { id: ID }, waitUntil: vi.fn() } as never);
    expect(response.status).toBe(200);
    const meta = parseMeta(rows[0].provider_metadata_json);
    expect(meta).toMatchObject({ provider: 'manual', wordCount: 3, draft: { provider: 'groq', text: 'Lou Yo wrote the classic of tea. It was a book. We drank shaw puerh.' } });
    // editing again does not replace the draft with his earlier edit
    await onRequestPatch({ request: new Request('https://example.test/p', { method: 'PATCH', body: JSON.stringify({ transcript: 'My own words, again.' }) }), env: { DB: fakeDb(rows), ADMIN_EMAILS: 'a@example.com' }, params: { id: ID }, waitUntil: vi.fn() } as never);
    expect(parseMeta(rows[0].provider_metadata_json).draft?.text).toBe('Lou Yo wrote the classic of tea. It was a book. We drank shaw puerh.');
  });
});

describe('resolveBetter on its own', () => {
  it('needs an open comparison', () => {
    expect(resolveBetter({ transcript: 'x', metadata: {} }, { 'change-1': 'accept' }, 'now')).toEqual({ ok: false, error: 'There is no better transcript waiting to be compared.' });
  });
});

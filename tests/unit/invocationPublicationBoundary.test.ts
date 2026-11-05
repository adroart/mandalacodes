import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.hoisted(() => vi.fn());
vi.mock('../../lib/account/auth.server.js', () => ({ createAuth: () => ({ api: { getSession } }) }));

// Disposable schema for the selected route contracts, not a claim about deployed
// D1 migrations. Execute their real ownership queries and transactional batches.
function fixtureDatabase() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(`
    CREATE TABLE oracle_reflection_sessions (id TEXT PRIMARY KEY, owner_user_id TEXT, hexagram_number INTEGER);
    CREATE TABLE oracle_reflection_segments (id TEXT PRIMARY KEY, session_id TEXT, owner_user_id TEXT, transcript TEXT, updated_at TEXT, object_key TEXT, mime_type TEXT, byte_size INTEGER);
    CREATE TABLE oracle_invocation_drafts (id TEXT PRIMARY KEY, admin_user_id TEXT, session_id TEXT, hexagram_number INTEGER, title TEXT, markdown_body TEXT, updated_at TEXT);
    CREATE TABLE oracle_invocation_blocks (id TEXT PRIMARY KEY, draft_id TEXT, kind TEXT, segment_id TEXT, markdown TEXT, sort_order INTEGER, created_at TEXT, updated_at TEXT);
    CREATE TABLE oracle_invocation_versions (id TEXT PRIMARY KEY, hexagram_number INTEGER, draft_id TEXT, version_number INTEGER, title TEXT, markdown_body TEXT, rendered_json TEXT, artifact_key TEXT, author_user_id TEXT, idempotency_key TEXT, created_at TEXT, UNIQUE(hexagram_number,version_number), UNIQUE(hexagram_number,author_user_id,idempotency_key));
    CREATE TABLE oracle_invocation_live (hexagram_number INTEGER PRIMARY KEY, version_id TEXT, updated_at TEXT);
    INSERT INTO oracle_reflection_sessions VALUES ('session-own','owner',22), ('session-foreign','foreign',22);
    INSERT INTO oracle_reflection_segments VALUES ('segment-own','session-own','owner','PRIVATE RAW TRANSCRIPT','before','private-own.webm','audio/webm',4), ('segment-foreign','session-foreign','foreign','FOREIGN PRIVATE TRANSCRIPT','before','private-foreign.webm','audio/webm',4);
    INSERT INTO oracle_invocation_drafts VALUES ('draft-own','owner','session-own',22,'Before','Before','before'), ('draft-foreign','foreign','session-foreign',22,'Foreign','Foreign','before');
    INSERT INTO oracle_invocation_versions VALUES ('version-before',22,'draft-own',1,'Before','Prior reviewed words','[]','prior-artifact.md','owner','prior-key','before');
    INSERT INTO oracle_invocation_live VALUES (22,'version-before','before');
  `);
  let failBatchAt = -1;
  function prepare(text: string, values: unknown[] = []) {
    const order: number[] = [];
    const rewritten = text.replace(/\?(\d+)/g, (_, index) => { order.push(Number(index) - 1); return '?'; });
    const parameters = () => order.map(index => values[index]) as (string | number | null)[];
    return {
      bind: (...next: unknown[]) => prepare(text, next),
      first: async () => sql.prepare(rewritten).get(...parameters()) ?? null,
      all: async () => ({ results: sql.prepare(rewritten).all(...parameters()) }),
      run: async () => sql.prepare(rewritten).run(...parameters()),
    };
  }
  const db = {
    prepare,
    async batch(statements: ReturnType<typeof prepare>[]) {
      sql.exec('BEGIN');
      try {
        for (let index = 0; index < statements.length; index++) {
          if (index === failBatchAt) throw new Error('synthetic batch interruption');
          await statements[index].run();
        }
        sql.exec('COMMIT');
        return [];
      } catch (error) { sql.exec('ROLLBACK'); throw error; }
    },
  };
  return { db, sql, failAt: (index: number) => { failBatchAt = index; } };
}

const session = (id = 'owner', verified = true) => ({ user: { id, email: `${id}@example.test`, emailVerified: verified }, session: { id: 'synthetic-session' } });
const reviewedDraft = () => ({ id: 'draft-own', sessionId: 'session-own', title: 'Reviewed title', updatedAt: 'now', blocks: [{ id: 'reviewed-block', kind: 'segment', segmentId: 'segment-own', markdown: 'Only reviewed words', sortOrder: 0 }] });

describe('synthetic invocation publication storage boundary', () => {
  let fixture: ReturnType<typeof fixtureDatabase>;
  let artifacts: Map<string, string>;
  let bucket: { put: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    getSession.mockReset().mockResolvedValue(session());
    fixture = fixtureDatabase();
    artifacts = new Map([['prior-artifact.md', 'Prior reviewed artifact']]);
    bucket = {
      put: vi.fn(async (key: string, text: string) => { artifacts.set(key, text); }),
      delete: vi.fn(async (key: string) => { artifacts.delete(key); }),
      get: vi.fn(async () => ({ body: new Uint8Array([1, 2, 3, 4]) })),
    };
  });
  afterEach(() => fixture.sql.close());
  function context(body = reviewedDraft(), key = 'review-key') {
    return {
      request: new Request('https://fixture.invalid/publish', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(body) }),
      env: { DB: fixture.db, ORACLE_PRIVATE: bucket, ADMIN_EMAILS: 'owner@example.test,foreign@example.test' }, params: { number: '22' },
    };
  }
  const liveId = (sql: DatabaseSync) => sql.prepare('SELECT version_id FROM oracle_invocation_live WHERE hexagram_number=22').get()?.version_id;

  it.each([['anonymous', null, 401], ['unverified owner', session('owner', false), 403], ['non-admin', session('visitor'), 403]] as const)('refuses %s before artifact writes', async (_, identity, status) => {
    getSession.mockResolvedValue(identity);
    const { onRequestPost } = await import('../../functions/api/oracle/invocations/[number]/publish');
    expect((await onRequestPost(context() as never)).status).toBe(status);
    const { onRequestGet } = await import('../../functions/api/oracle/reflections/segments/[id]/audio');
    expect((await onRequestGet({ ...context(), request: new Request('https://fixture.invalid/audio'), params: { id: 'segment-own' } } as never)).status).toBe(status);
    expect(bucket.put).not.toHaveBeenCalled();
    expect(bucket.get).not.toHaveBeenCalled();
    expect(liveId(fixture.sql)).toBe('version-before');
  });

  it('executes owner predicates against SQL before accepting a foreign draft or segment', async () => {
    const { onRequestPost } = await import('../../functions/api/oracle/invocations/[number]/publish');
    const foreignDraft = { ...reviewedDraft(), id: 'draft-foreign', sessionId: 'session-foreign' };
    expect((await onRequestPost(context(foreignDraft) as never)).status).toBe(404);
    expect((await onRequestPost(context({ ...reviewedDraft(), id: 'draft-foreign' }) as never)).status).toBe(404);
    const foreignSegment = reviewedDraft(); foreignSegment.blocks[0].segmentId = 'segment-foreign';
    expect((await onRequestPost(context(foreignSegment) as never)).status).toBe(400);
    expect(bucket.put).not.toHaveBeenCalled();
    expect(liveId(fixture.sql)).toBe('version-before');
  });

  it('preserves prior publication and private transcript when artifact storage fails', async () => {
    bucket.put.mockRejectedValueOnce(new Error('synthetic R2 failure'));
    const { onRequestPost } = await import('../../functions/api/oracle/invocations/[number]/publish');
    expect((await onRequestPost(context() as never)).status).toBe(503);
    expect(liveId(fixture.sql)).toBe('version-before');
    expect(fixture.sql.prepare("SELECT transcript FROM oracle_reflection_segments WHERE id='segment-own'").get()?.transcript).toBe('PRIVATE RAW TRANSCRIPT');
    expect([...artifacts.keys()]).toEqual(['prior-artifact.md']);
  });

  it.each([4, 5])('rolls back earlier writes and removes only its new artifact after batch interruption at %s', async (index) => {
    fixture.failAt(index);
    const { onRequestPost } = await import('../../functions/api/oracle/invocations/[number]/publish');
    expect((await onRequestPost(context() as never)).status).toBe(503);
    expect(liveId(fixture.sql)).toBe('version-before');
    expect(fixture.sql.prepare("SELECT transcript FROM oracle_reflection_segments WHERE id='segment-own'").get()?.transcript).toBe('PRIVATE RAW TRANSCRIPT');
    expect(fixture.sql.prepare("SELECT title FROM oracle_invocation_drafts WHERE id='draft-own'").get()?.title).toBe('Before');
    expect(fixture.sql.prepare('SELECT COUNT(*) AS count FROM oracle_invocation_versions').get()?.count).toBe(1);
    expect([...artifacts.keys()]).toEqual(['prior-artifact.md']);
    expect(bucket.delete).toHaveBeenCalledExactlyOnceWith(bucket.put.mock.calls[0][0]);
  });

  it('publishes only reviewed words and a retry produces no extra artifact or version', async () => {
    const { onRequestPost } = await import('../../functions/api/oracle/invocations/[number]/publish');
    const first = await onRequestPost(context() as never); expect(first.status).toBe(200);
    const firstBody = await first.json() as { version: { id: string } };
    const second = await onRequestPost(context({ ...reviewedDraft(), title: 'Changed replay body' }) as never);
    expect((await second.json() as { version: { id: string } }).version.id).toBe(firstBody.version.id);
    expect(bucket.put).toHaveBeenCalledTimes(1);
    expect(fixture.sql.prepare('SELECT COUNT(*) AS count FROM oracle_invocation_versions').get()?.count).toBe(2);
    const { onRequestGet } = await import('../../functions/api/oracle/invocations/[number]/live');
    const response = await onRequestGet({ ...context(), request: new Request('https://fixture.invalid/live') } as never);
    const publicBody = await response.text();
    expect(publicBody).toContain('Only reviewed words');
    for (const sentinel of ['PRIVATE RAW TRANSCRIPT', 'FOREIGN PRIVATE TRANSCRIPT', 'private-own.webm', 'prior-artifact.md', 'owner@example.test']) expect(publicBody).not.toContain(sentinel);
    expect(Object.keys(JSON.parse(publicBody)).sort()).toEqual(['blocks', 'title', 'versionNumber']);
  });

  it('denies foreign-owner private audio even to another allowlisted administrator', async () => {
    const { onRequestGet } = await import('../../functions/api/oracle/reflections/segments/[id]/audio');
    const base = context();
    const response = await onRequestGet({ ...base, request: new Request('https://fixture.invalid/audio'), params: { id: 'segment-foreign' } } as never);
    expect(response.status).toBe(404);
    expect(bucket.get).not.toHaveBeenCalled();
    const own = await onRequestGet({ ...base, request: new Request('https://fixture.invalid/audio'), params: { id: 'segment-own' } } as never);
    expect(own.status).toBe(200);
    expect(own.headers.get('Cache-Control')).toBe('private, no-store');
    expect(bucket.get).toHaveBeenCalledExactlyOnceWith('private-own.webm');
  });
});

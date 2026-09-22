import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();
vi.mock('../../lib/account/auth.server.js', () => ({ createAuth: () => ({ api: { getSession } }) }));

describe('invocation API boundary', () => {
  beforeEach(() => getSession.mockReset());

  it('rejects invalid hexagrams before database work', async () => {
    const { onRequestGet } = await import('../../functions/api/oracle/invocations/[number]/live');
    const response = await onRequestGet({ request: new Request('https://example.test/live'), env: {}, params: { number: '65' } } as never);
    expect(response.status).toBe(400);
  });

  it('returns an empty public response when no invocation is live', async () => {
    const first = vi.fn().mockResolvedValue(null);
    const db = { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ first })) })) };
    const { onRequestGet } = await import('../../functions/api/oracle/invocations/[number]/live');
    const response = await onRequestGet({ request: new Request('https://example.test/live'), env: { DB: db }, params: { number: '22' } } as never);
    expect(response.status).toBe(204);
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=0, must-revalidate');
  });

  it('keeps draft access administrator-only', async () => {
    getSession.mockResolvedValue(null);
    const { onRequestGet } = await import('../../functions/api/oracle/invocations/[number]/draft');
    const response = await onRequestGet({ request: new Request('https://example.test/draft?sessionId=x'), env: { DB: {}, ADMIN_EMAILS: 'a@example.com' }, params: { number: '22' } } as never);
    expect(response.status).toBe(401);
  });

  it('returns a direct draft and refreshes linked markdown from recorder transcripts', async () => {
    getSession.mockResolvedValue({ user: { id: 'admin-1', email: 'a@example.com', emailVerified: true }, session: { id: 's' } });
    const draft = { id: 'draft-1', hexagram_number: 22, session_id: 'session-1', title: 'Grace', updated_at: 'now' };
    const blocks = [{ id: 'segment:seg-1', kind: 'segment', segment_id: 'seg-1', markdown: 'Stale', sort_order: 0 }];
    const db = {
      prepare: vi.fn((sql: string) => ({ bind: vi.fn(() => ({
        first: vi.fn().mockResolvedValue(sql.includes('oracle_invocation_drafts') ? draft : null),
        all: vi.fn().mockResolvedValue({ results: sql.includes('oracle_invocation_blocks') ? blocks : [{ id: 'seg-1', transcript: 'Fresh recorder text' }] }),
      })) })),
    };
    const { onRequestGet } = await import('../../functions/api/oracle/invocations/[number]/draft');
    const response = await onRequestGet({ request: new Request('https://example.test/draft?sessionId=session-1'), env: { DB: db, ADMIN_EMAILS: 'a@example.com' }, params: { number: '22' } } as never);
    expect(await response.json()).toEqual({ id: 'draft-1', hexagramNumber: 22, sessionId: 'session-1', title: 'Grace', updatedAt: 'now', blocks: [{ id: 'segment:seg-1', kind: 'segment', segmentId: 'seg-1', markdown: 'Fresh recorder text', sortOrder: 0 }] });
  });

  it('projects only title, version number, and safe blocks publicly', async () => {
    const row = { id: 'secret-version-id', hexagram_number: 22, version_number: 4, title: 'Grace', rendered_json: JSON.stringify([{ type: 'paragraph', children: [{ type: 'text', value: 'Safe' }] }]), created_at: 'private', updated_at: 'private' };
    const db = { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ first: vi.fn().mockResolvedValue(row) })) })) };
    const { onRequestGet } = await import('../../functions/api/oracle/invocations/[number]/live');
    const response = await onRequestGet({ request: new Request('https://example.test/live'), env: { DB: db }, params: { number: '22' } } as never);
    expect(await response.json()).toEqual({ title: 'Grace', versionNumber: 4, blocks: [{ type: 'paragraph', children: [{ type: 'text', value: 'Safe' }] }] });
  });

  it('publishes a full version response and batches blocks, transcripts, version, and live promotion', async () => {
    getSession.mockResolvedValue({ user: { id: 'admin-1', email: 'a@example.com', emailVerified: true }, session: { id: 's' } });
    const sqlSeen: string[] = []; const batches: unknown[][] = [];
    const db = {
      prepare: vi.fn((sql: string) => { sqlSeen.push(sql); return { bind: vi.fn(() => ({
        first: vi.fn().mockResolvedValue(sql.includes('COALESCE(MAX') ? { version: 1 } : sql.includes('idempotency_key') ? null : {}),
      })) }; }),
      batch: vi.fn(async (statements: unknown[]) => { batches.push(statements); return []; }),
    };
    const bucket = { put: vi.fn().mockResolvedValue(undefined), delete: vi.fn().mockResolvedValue(undefined) };
    const draft = { id: 'draft-1', hexagramNumber: 22, sessionId: 'session-1', title: 'Grace', updatedAt: 'now', blocks: [{ id: 'segment:seg-1', kind: 'segment', segmentId: 'seg-1', markdown: 'Fresh', sortOrder: 0 }] };
    const { onRequestPost } = await import('../../functions/api/oracle/invocations/[number]/publish');
    const response = await onRequestPost({ request: new Request('https://example.test/publish', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'retry-1' }, body: JSON.stringify(draft) }), env: { DB: db, ORACLE_PRIVATE: bucket, ADMIN_EMAILS: 'a@example.com' }, params: { number: '22' } } as never);
    const payload = await response.json() as Record<string, any>;
    expect(payload.status).toBe('saved_and_live');
    expect(payload.version).toMatchObject({ hexagramNumber: 22, versionNumber: 1, title: 'Grace', markdownBody: 'Fresh', authorUserId: 'admin-1' });
    expect(batches).toHaveLength(1);
    expect(sqlSeen.join('\n')).toContain('UPDATE oracle_reflection_segments');
    expect(sqlSeen.join('\n')).toContain('INSERT INTO oracle_invocation_blocks');
    expect(sqlSeen.join('\n')).toContain('INSERT INTO oracle_invocation_versions');
    expect(sqlSeen.join('\n')).toContain('INSERT INTO oracle_invocation_live');
  });

  it('rejects a linked segment outside the owned session before writing R2', async () => {
    getSession.mockResolvedValue({ user: { id: 'admin-1', email: 'a@example.com', emailVerified: true }, session: { id: 's' } });
    const db = { prepare: vi.fn((sql: string) => ({ bind: vi.fn(() => ({ first: vi.fn().mockResolvedValue(sql.includes('oracle_reflection_segments') ? null : sql.includes('idempotency_key') ? null : {}) })) })) };
    const bucket = { put: vi.fn() };
    const draft = { id: 'draft-1', hexagramNumber: 22, sessionId: 'session-1', title: 'Grace', updatedAt: 'now', blocks: [{ id: 'segment:foreign', kind: 'segment', segmentId: 'foreign', markdown: 'No', sortOrder: 0 }] };
    const { onRequestPost } = await import('../../functions/api/oracle/invocations/[number]/publish');
    const response = await onRequestPost({ request: new Request('https://example.test/publish', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'retry-2' }, body: JSON.stringify(draft) }), env: { DB: db, ORACLE_PRIVATE: bucket, ADMIN_EMAILS: 'a@example.com' }, params: { number: '22' } } as never);
    expect(response.status).toBe(400);
    expect(bucket.put).not.toHaveBeenCalled();
  });

  it('returns version history as a direct array', async () => {
    getSession.mockResolvedValue({ user: { id: 'admin-1', email: 'a@example.com', emailVerified: true }, session: { id: 's' } });
    const row = { id: 'v1', hexagram_number: 22, version_number: 1, title: 'Grace', markdown_body: 'Body', artifact_key: 'private.md', author_user_id: 'admin-1', created_at: 'now' };
    const db = { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ all: vi.fn().mockResolvedValue({ results: [row] }) })) })) };
    const { onRequestGet } = await import('../../functions/api/oracle/invocations/[number]/versions');
    const response = await onRequestGet({ request: new Request('https://example.test/versions'), env: { DB: db, ADMIN_EMAILS: 'a@example.com' }, params: { number: '22' } } as never);
    expect(await response.json()).toEqual([{ id: 'v1', hexagramNumber: 22, versionNumber: 1, title: 'Grace', markdownBody: 'Body', artifactKey: 'private.md', authorUserId: 'admin-1', createdAt: 'now' }]);
  });

  it('returns rollback as a direct full version', async () => {
    getSession.mockResolvedValue({ user: { id: 'admin-1', email: 'a@example.com', emailVerified: true }, session: { id: 's' } });
    const source = { id: 'v1', hexagram_number: 22, draft_id: 'draft-1', version_number: 1, title: 'Grace', markdown_body: 'Body', artifact_key: 'old.md', author_user_id: 'admin-1', created_at: 'old' };
    const db = { prepare: vi.fn((sql: string) => ({ bind: vi.fn(() => ({ first: vi.fn().mockResolvedValue(sql.includes('COALESCE') ? { version: 2 } : source) })) })), batch: vi.fn().mockResolvedValue([]) };
    const bucket = { put: vi.fn().mockResolvedValue(undefined), delete: vi.fn().mockResolvedValue(undefined) };
    const { onRequestPost } = await import('../../functions/api/oracle/invocations/[number]/versions');
    const response = await onRequestPost({ request: new Request('https://example.test/versions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'rollback', versionId: 'v1' }) }), env: { DB: db, ORACLE_PRIVATE: bucket, ADMIN_EMAILS: 'a@example.com' }, params: { number: '22' } } as never);
    expect(await response.json()).toMatchObject({ hexagramNumber: 22, versionNumber: 2, title: 'Grace', markdownBody: 'Body', authorUserId: 'admin-1' });
  });

  it('rejects publishing a draft not owned by the administrator before R2 writes', async () => {
    getSession.mockResolvedValue({ user: { id: 'admin-1', email: 'a@example.com', emailVerified: true }, session: { id: 's' } });
    const db = { prepare: vi.fn((sql: string) => ({ bind: vi.fn(() => ({ first: vi.fn().mockResolvedValue(sql.includes('oracle_invocation_drafts') ? null : sql.includes('idempotency_key') ? null : {}) })) })) };
    const bucket = { put: vi.fn() };
    const draft = { id: 'foreign-draft', hexagramNumber: 22, sessionId: 'session-1', title: 'Grace', updatedAt: 'now', blocks: [] };
    const { onRequestPost } = await import('../../functions/api/oracle/invocations/[number]/publish');
    const response = await onRequestPost({ request: new Request('https://example.test/publish', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'retry-owner' }, body: JSON.stringify(draft) }), env: { DB: db, ORACLE_PRIVATE: bucket, ADMIN_EMAILS: 'a@example.com' }, params: { number: '22' } } as never);
    expect(response.status).toBe(404);
    expect(bucket.put).not.toHaveBeenCalled();
  });

  it('rejects oversized chunked JSON without relying on Content-Length', async () => {
    const { bodyJson } = await import('../../functions/api/oracle/invocations/_shared');
    const response = await bodyJson(new Request('https://example.test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'x'.repeat(500_001) }) }));
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(413);
  });

  it('cleans up only the losing request artifact on a concurrent version collision', async () => {
    getSession.mockResolvedValue({ user: { id: 'admin-1', email: 'a@example.com', emailVerified: true }, session: { id: 's' } });
    const uuid = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('loser-request-id' as `${string}-${string}-${string}-${string}-${string}`);
    const db = {
      prepare: vi.fn((sql: string) => ({ bind: vi.fn(() => ({ first: vi.fn().mockResolvedValue(sql.includes('COALESCE') ? { version: 3 } : sql.includes('idempotency_key') ? null : {}) })) })),
      batch: vi.fn().mockRejectedValue(new Error('UNIQUE constraint failed: oracle_invocation_versions.hexagram_number, version_number')),
    };
    const bucket = { put: vi.fn().mockResolvedValue(undefined), delete: vi.fn().mockResolvedValue(undefined) };
    const draft = { id: 'draft-1', hexagramNumber: 22, sessionId: 'session-1', title: 'Grace', updatedAt: 'now', blocks: [] };
    const { onRequestPost } = await import('../../functions/api/oracle/invocations/[number]/publish');
    const response = await onRequestPost({ request: new Request('https://example.test/publish', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'loser-key' }, body: JSON.stringify(draft) }), env: { DB: db, ORACLE_PRIVATE: bucket, ADMIN_EMAILS: 'a@example.com' }, params: { number: '22' } } as never);
    expect(response.status).toBe(503);
    expect(bucket.delete).toHaveBeenCalledWith(expect.stringContaining('v000003-loser-request-id.md'));
    expect(bucket.delete).not.toHaveBeenCalledWith(expect.stringContaining('winner-request-id'));
    uuid.mockRestore();
  });
});

/**
 * GET /api/account/pieces — every piece bound to the signed-in steward,
 * read straight off the shared D1 database (keeper_pieces / keeper_intentions,
 * owned by Adrian-Website: migrations/008_living_legacy.sql onward). This
 * table is proven against a minimal schema mirroring those columns exactly
 * — mandalacodes owns no migrations of its own for it, it only reads the
 * shared binding.
 *
 * Auth is mocked the same way tests/unit/reflectionApiHandlers.test.ts mocks
 * it: swap out lib/account/auth.server.js's createAuth so requireUser()
 * resolves against a fake Better Auth session instead of a real cookie.
 */
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();
vi.mock('../../lib/account/auth.server.js', () => ({
  createAuth: () => ({ api: { getSession } }),
}));

const { onRequestGet } = await import('../../functions/api/account/pieces.js');

const SCHEMA = `
CREATE TABLE keeper_pieces (
  id TEXT PRIMARY KEY,
  piece_id TEXT NOT NULL,
  edition_number INTEGER NOT NULL DEFAULT 0,
  keeper_user_id TEXT,
  recovery_code_hash TEXT NOT NULL UNIQUE,
  current_display_location TEXT,
  registered_at TEXT,
  claimed_at TEXT,
  released_at TEXT
);
CREATE TABLE keeper_intentions (
  id TEXT PRIMARY KEY,
  piece_id TEXT NOT NULL,
  edition_number INTEGER NOT NULL DEFAULT 0,
  author_user_id TEXT,
  kind TEXT NOT NULL,
  body TEXT,
  confirmed_at TEXT,
  created_at TEXT NOT NULL,
  erased_at TEXT
);
`;

function d1(sqlite: DatabaseSync) {
  return {
    prepare(sql: string) {
      let values: SQLInputValue[] = [];
      return {
        bind(...args: SQLInputValue[]) {
          values = args;
          return this;
        },
        async all() {
          return { results: sqlite.prepare(sql).all(...values) };
        },
        async first() {
          return sqlite.prepare(sql).get(...values) ?? null;
        },
        async run() {
          const info = sqlite.prepare(sql).run(...values);
          return { success: true, meta: { changes: info.changes } };
        },
      };
    },
  };
}

function freshDatabase() {
  const database = new DatabaseSync(':memory:');
  database.exec(SCHEMA);
  return database;
}

function signedInAs(userId: string, email = 'collector@example.com') {
  getSession.mockResolvedValue({
    user: { id: userId, email, emailVerified: true },
    session: { id: 'sess-1' },
  });
}

function signedOut() {
  getSession.mockResolvedValue(null);
}

function request() {
  return new Request('https://mandalacodes.com/api/account/pieces');
}

describe('GET /api/account/pieces', () => {
  let database: DatabaseSync;

  beforeEach(() => {
    database = freshDatabase();
    getSession.mockReset();
  });

  afterEach(() => {
    database.close();
  });

  it('returns 401 when nobody is signed in', async () => {
    signedOut();
    const env = { DB: d1(database) };
    const response = await onRequestGet({ request: request(), env } as any);
    expect(response.status).toBe(401);
  });

  it('returns only the signed-in steward\'s pieces, with artwork and intention joined in', async () => {
    signedInAs('user-A');
    database
      .prepare(
        `INSERT INTO keeper_pieces
           (id, piece_id, edition_number, keeper_user_id, recovery_code_hash,
            current_display_location, claimed_at)
         VALUES ('kp-1', 'UL-100', 0, 'user-A', 'hash-1', 'Bali, Indonesia', '2026-06-01T00:00:00.000Z')`,
      )
      .run();
    // A second steward's piece — must never appear in user-A's response.
    database
      .prepare(
        `INSERT INTO keeper_pieces
           (id, piece_id, edition_number, keeper_user_id, recovery_code_hash, claimed_at)
         VALUES ('kp-2', 'UL-101', 0, 'user-B', 'hash-2', '2026-06-02T00:00:00.000Z')`,
      )
      .run();
    database
      .prepare(
        `INSERT INTO keeper_intentions
           (id, piece_id, edition_number, kind, body, confirmed_at, created_at)
         VALUES ('int-1', 'UL-100', 0, 'motivation', 'To hold steady through the year.',
                 '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z')`,
      )
      .run();

    const env = { DB: d1(database) };
    const response = await onRequestGet({ request: request(), env } as any);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.pieces).toHaveLength(1);
    const piece = data.pieces[0];
    expect(piece.pieceId).toBe('UL-100');
    expect(piece.title).toBe('Art of Living');
    expect(piece.cardNumber).toBe(32);
    expect(piece.restsIn).toBe('Bali, Indonesia');
    expect(piece.intention).toBe('To hold steady through the year.');
    expect(piece.claimedAt).toBe('2026-06-01T00:00:00.000Z');
    expect(typeof piece.artworkImage).toBe('string');
  });

  it('never surfaces an unconfirmed or erased intention', async () => {
    signedInAs('user-A');
    database
      .prepare(
        `INSERT INTO keeper_pieces (id, piece_id, edition_number, keeper_user_id, recovery_code_hash, claimed_at)
         VALUES ('kp-1', 'UL-100', 0, 'user-A', 'hash-1', '2026-06-01T00:00:00.000Z')`,
      )
      .run();
    database
      .prepare(
        `INSERT INTO keeper_intentions (id, piece_id, edition_number, kind, body, confirmed_at, created_at)
         VALUES ('int-draft', 'UL-100', 0, 'journal', 'not yet confirmed', NULL, '2026-06-01T00:00:00.000Z')`,
      )
      .run();
    database
      .prepare(
        `INSERT INTO keeper_intentions (id, piece_id, edition_number, kind, body, confirmed_at, created_at, erased_at)
         VALUES ('int-erased', 'UL-100', 0, 'motivation', 'erased', '2026-05-01T00:00:00.000Z',
                 '2026-05-01T00:00:00.000Z', '2026-05-02T00:00:00.000Z')`,
      )
      .run();

    const env = { DB: d1(database) };
    const response = await onRequestGet({ request: request(), env } as any);
    const data = await response.json();
    expect(data.pieces[0].intention).toBe(null);
  });

  it('never surfaces a released binding', async () => {
    signedInAs('user-A');
    database
      .prepare(
        `INSERT INTO keeper_pieces (id, piece_id, edition_number, keeper_user_id, recovery_code_hash, claimed_at, released_at)
         VALUES ('kp-1', 'UL-100', 0, 'user-A', 'hash-1', '2026-06-01T00:00:00.000Z', '2026-07-01T00:00:00.000Z')`,
      )
      .run();

    const env = { DB: d1(database) };
    const response = await onRequestGet({ request: request(), env } as any);
    const data = await response.json();
    expect(data.pieces).toHaveLength(0);
  });

  it('returns an empty list, not an error, when the signed-in steward holds nothing', async () => {
    signedInAs('user-nobody');
    const env = { DB: d1(database) };
    const response = await onRequestGet({ request: request(), env } as any);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.pieces).toEqual([]);
  });

  it('reports unavailable when the shared database binding is absent', async () => {
    signedInAs('user-A');
    const response = await onRequestGet({ request: request(), env: {} } as any);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'pieces_unavailable' });
  });

  it('reports unavailable instead of an empty list when keeper schema is absent', async () => {
    signedInAs('user-A');
    const emptyDatabase = new DatabaseSync(':memory:');
    try {
      const response = await onRequestGet({ request: request(), env: { DB: d1(emptyDatabase) } } as any);
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({ ok: false, error: 'pieces_unavailable' });
    } finally {
      emptyDatabase.close();
    }
  });

  it('reports unavailable when keeper intentions schema is absent even with no pieces', async () => {
    signedInAs('user-A');
    const partialDatabase = new DatabaseSync(':memory:');
    partialDatabase.exec(SCHEMA.replace(/CREATE TABLE keeper_intentions[\s\S]*?\n\);/, ''));
    try {
      const response = await onRequestGet({ request: request(), env: { DB: d1(partialDatabase) } } as any);
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({ ok: false, error: 'pieces_unavailable' });
    } finally {
      partialDatabase.close();
    }
  });
});

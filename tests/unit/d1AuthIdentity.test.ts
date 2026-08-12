import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it, vi } from 'vitest';
import * as dbHelpers from '../../functions/api/_lib/db.js';
import {
  selectInscription,
  selectInscriptionsForPiece,
} from '../../functions/api/atlas/_inscriptions';

interface PreparedStatement {
  bind: ReturnType<typeof vi.fn>;
  first: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
}

function recordingDb(firstResult: unknown = null) {
  const sql: string[] = [];
  const bound: unknown[][] = [];
  const statements: PreparedStatement[] = [];
  const db = {
    prepare: vi.fn((query: string) => {
      sql.push(query);
      const statement = {
        bind: vi.fn((...values: unknown[]) => {
          bound.push(values);
          return statement;
        }),
        first: vi.fn().mockResolvedValue(firstResult),
        run: vi.fn().mockResolvedValue({ success: true }),
      };
      statements.push(statement);
      return statement;
    }),
  };
  return { db, sql, bound, statements };
}

type SqliteInput = null | number | bigint | string | NodeJS.ArrayBufferView;

function sqliteD1(sqlite: DatabaseSync) {
  return {
    prepare(sql: string) {
      const statement = sqlite.prepare(sql);
      let values: SqliteInput[] = [];
      return {
        bind(...next: SqliteInput[]) {
          values = next;
          return this;
        },
        async run() {
          statement.run(...values);
          return { success: true };
        },
        async first<T>() {
          return (statement.get(...values) as T | undefined) ?? null;
        },
        async all<T>() {
          return { results: statement.all(...values) as T[] };
        },
      };
    },
  };
}

describe('vendor-neutral D1 auth identity', () => {
  it('looks up app users by auth_user_id through getUserByAuthId', async () => {
    const helpers = dbHelpers as unknown as {
      getUserByAuthId?: (db: unknown, authUserId: string) => Promise<unknown>;
    };
    expect(helpers.getUserByAuthId).toBeTypeOf('function');
    if (!helpers.getUserByAuthId) return;

    const observed = recordingDb({ id: 7, auth_user_id: 'auth-user-1' });
    await helpers.getUserByAuthId(observed.db, 'auth-user-1');

    expect(observed.sql).toEqual(['SELECT * FROM users WHERE auth_user_id = ?1']);
    expect(observed.bound).toEqual([['auth-user-1']]);
  });

  it('upserts authUserId into both rollout identity columns', async () => {
    const observed = recordingDb({ id: 7, auth_user_id: 'auth-user-1' });

    await dbHelpers.upsertUser(observed.db, {
      authUserId: 'auth-user-1',
      email: 'keeper@example.com',
    });

    expect(observed.sql[0]).toContain(
      'INSERT INTO users (auth_user_id, clerk_user_id, email)',
    );
    expect(observed.sql[0]).toContain('ON CONFLICT(auth_user_id)');
    expect(observed.bound).toEqual([
      ['auth-user-1', 'keeper@example.com'],
      ['auth-user-1'],
    ]);
  });

  it('satisfies the retained NOT NULL legacy column in a real SQLite schema', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        auth_user_id TEXT NOT NULL UNIQUE,
        clerk_user_id TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

    const d1 = sqliteD1(sqlite);

    try {
      await dbHelpers.upsertUser(d1, {
        authUserId: 'auth-user-sqlite',
        email: 'keeper@example.com',
      });
      const row = sqlite
        .prepare('SELECT auth_user_id, clerk_user_id, email FROM users')
        .get() as Record<string, unknown>;
      expect(row).toEqual({
        auth_user_id: 'auth-user-sqlite',
        clerk_user_id: 'auth-user-sqlite',
        email: 'keeper@example.com',
      });
    } finally {
      sqlite.close();
    }
  });

  it('falls back only on missing neutral columns against the legacy users schema', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clerk_user_id TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);
    const d1 = sqliteD1(sqlite);

    try {
      const inserted = await dbHelpers.upsertUser(d1, {
        authUserId: 'auth-user-legacy',
        email: 'first@example.com',
      });
      expect(inserted).toMatchObject({
        auth_user_id: 'auth-user-legacy',
        clerk_user_id: 'auth-user-legacy',
        email: 'first@example.com',
      });

      await dbHelpers.upsertUser(d1, {
        authUserId: 'auth-user-legacy',
        email: 'updated@example.com',
      });
      await expect(dbHelpers.getUserByAuthId(d1, 'auth-user-legacy')).resolves.toMatchObject({
        auth_user_id: 'auth-user-legacy',
        email: 'updated@example.com',
      });
      await dbHelpers.deleteUserByAuthId(d1, 'auth-user-legacy');
      expect(sqlite.prepare('SELECT COUNT(*) AS count FROM users').get()).toEqual({ count: 0 });
    } finally {
      sqlite.close();
    }
  });

  it.each(['author_user_id', 'author_clerk_id'])(
    'reads inscriptions through the %s schema during rollout',
    async (authorColumn) => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE atlas_inscriptions (
          id TEXT PRIMARY KEY,
          piece_id TEXT NOT NULL,
          edition_number INTEGER NOT NULL,
          ${authorColumn} TEXT,
          kind TEXT NOT NULL,
          body TEXT,
          body_hash TEXT NOT NULL,
          content_salt TEXT,
          sealed_until TEXT,
          created_at TEXT NOT NULL,
          erased_at TEXT,
          erase_reason TEXT
        );
        INSERT INTO atlas_inscriptions
          (id, piece_id, edition_number, ${authorColumn}, kind, body, body_hash, created_at)
        VALUES
          ('ins-1', 'UL-1', 0, 'auth-author', 'intention', 'A dream', 'hash', '2026-01-01T00:00:00.000Z');
      `);
      const d1 = sqliteD1(sqlite);

      try {
        await expect(selectInscription(d1 as never, 'ins-1')).resolves.toMatchObject({
          id: 'ins-1',
          author_user_id: 'auth-author',
        });
        await expect(
          selectInscriptionsForPiece(d1 as never, 'UL-1', undefined),
        ).resolves.toEqual([
          expect.objectContaining({ id: 'ins-1', author_user_id: 'auth-author' }),
        ]);
      } finally {
        sqlite.close();
      }
    },
  );

  it('deletes app users by auth_user_id through deleteUserByAuthId', async () => {
    const helpers = dbHelpers as unknown as {
      deleteUserByAuthId?: (db: unknown, authUserId: string) => Promise<void>;
    };
    expect(helpers.deleteUserByAuthId).toBeTypeOf('function');
    if (!helpers.deleteUserByAuthId) return;

    const observed = recordingDb();
    await helpers.deleteUserByAuthId(observed.db, 'auth-user-1');

    expect(observed.sql).toEqual(['DELETE FROM users WHERE auth_user_id = ?1']);
    expect(observed.bound).toEqual([['auth-user-1']]);
  });

  it('keeps legacy vendor names out of active D1 runtime surfaces', () => {
    const files = [
      'functions/api/_lib/auth.js',
      'functions/api/_lib/db.js',
      'functions/api/auth/sync-user.js',
      'functions/api/profile/get.js',
      'functions/api/profile/put.js',
      'functions/api/profile/delete.js',
      'functions/api/collections/list.js',
      'functions/api/collections/create.js',
      'functions/api/collections/update.js',
      'functions/api/collections/delete.js',
      'functions/api/collections/add-item.js',
      'functions/api/collections/remove-item.js',
      'functions/api/atlas/holder-chart.ts',
      'functions/api/atlas/_inscriptions.ts',
      'functions/api/atlas/steward/inscribe.ts',
      'functions/api/atlas/steward/share-intention.ts',
      'utils/inscriptions.ts',
      'utils/intentions.ts',
      'lib/account/auth.server.js',
    ];
    const activeRuntime = files
      .map((file) => readFileSync(resolve(process.cwd(), file), 'utf8'))
      .join('\n');

    for (const legacyName of [
      'getUserByClerkId',
      'deleteUserByClerkId',
      'authorClerkId',
    ]) {
      expect(activeRuntime, legacyName).not.toContain(legacyName);
    }
  });
});

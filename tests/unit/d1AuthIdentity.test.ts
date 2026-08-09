import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import * as dbHelpers from '../../functions/api/_lib/db.js';

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

  it('upserts authUserId into auth_user_id and reads the persisted row back', async () => {
    const observed = recordingDb({ id: 7, auth_user_id: 'auth-user-1' });

    await dbHelpers.upsertUser(observed.db, {
      authUserId: 'auth-user-1',
      email: 'keeper@example.com',
    });

    expect(observed.sql[0]).toContain('INSERT INTO users (auth_user_id, email)');
    expect(observed.sql[0]).toContain('ON CONFLICT(auth_user_id)');
    expect(observed.sql[0]).not.toContain('clerk_user_id');
    expect(observed.bound).toEqual([
      ['auth-user-1', 'keeper@example.com'],
      ['auth-user-1'],
    ]);
  });

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
      'clerk_user_id',
      'author_clerk_id',
      'authorClerkId',
    ]) {
      expect(activeRuntime, legacyName).not.toContain(legacyName);
    }
  });
});

/**
 * D1 helpers. Every endpoint that touches user state goes through here so
 * we have a single place to evolve the schema, swap drivers, or add
 * cross-cutting logging later.
 *
 * Mandala Codes scope: users + profiles + collections. No Stripe customer
 * linkage, no orders — sales live on adrianrasmussen.com.
 */

/**
 * Look up a user row by their auth user id. Returns null when the user
 * has not yet been synced (first sign-in hasn't called /api/auth/sync-user).
 *
 * @param {D1Database} db
 * @param {string} authUserId  Better Auth user id
 */
export async function getUserByAuthId(db, authUserId) {
  return db
    .prepare('SELECT * FROM users WHERE auth_user_id = ?1')
    .bind(authUserId)
    .first();
}

/**
 * Upsert by auth_user_id (the Better Auth user id). Used by
 * /api/auth/sync-user on first sign-in.
 * @param {D1Database} db
 * @param {{ authUserId: string; email: string }} input
 */
export async function upsertUser(db, { authUserId, email }) {
  await db
    .prepare(
      `INSERT INTO users (auth_user_id, clerk_user_id, email)
       VALUES (?1, ?1, ?2)
       ON CONFLICT(auth_user_id) DO UPDATE SET
         clerk_user_id = excluded.clerk_user_id,
         email = excluded.email,
         updated_at = unixepoch()`,
    )
    .bind(authUserId, email)
    .run();
  return getUserByAuthId(db, authUserId);
}

/**
 * Remove the app `users` row (profiles/collections follow via FK ON DELETE
 * CASCADE). Called by the Better Auth account-deletion hook
 * (lib/account/auth.server.js), which replaced the retired Clerk webhook.
 * @param {D1Database} db
 * @param {string} authUserId  Better Auth user id
 */
export async function deleteUserByAuthId(db, authUserId) {
  await db
    .prepare('DELETE FROM users WHERE auth_user_id = ?1')
    .bind(authUserId)
    .run();
}

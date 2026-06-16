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
 * NOTE: the `clerk_user_id` column name is retained as the generic
 * external-auth-id; it now stores the Better Auth `user.id`.
 * @param {D1Database} db
 * @param {string} clerkUserId  Better Auth user id
 */
export async function getUserByClerkId(db, clerkUserId) {
  return db
    .prepare('SELECT * FROM users WHERE clerk_user_id = ?1')
    .bind(clerkUserId)
    .first();
}

/**
 * Upsert by clerk_user_id (the Better Auth user id). Used by
 * /api/auth/sync-user on first sign-in.
 * @param {D1Database} db
 * @param {{ clerkUserId: string; email: string }} input
 */
export async function upsertUser(db, { clerkUserId, email }) {
  await db
    .prepare(
      `INSERT INTO users (clerk_user_id, email)
       VALUES (?1, ?2)
       ON CONFLICT(clerk_user_id) DO UPDATE SET
         email = excluded.email,
         updated_at = unixepoch()`,
    )
    .bind(clerkUserId, email)
    .run();
  return getUserByClerkId(db, clerkUserId);
}

/**
 * Remove the app `users` row (profiles/collections follow via FK ON DELETE
 * CASCADE). Called by the Better Auth account-deletion hook
 * (lib/account/auth.server.js), which replaced the retired Clerk webhook.
 * @param {D1Database} db
 * @param {string} clerkUserId  Better Auth user id
 */
export async function deleteUserByClerkId(db, clerkUserId) {
  await db
    .prepare('DELETE FROM users WHERE clerk_user_id = ?1')
    .bind(clerkUserId)
    .run();
}

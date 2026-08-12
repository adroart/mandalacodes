/**
 * Better Auth server instance for the art site's customer accounts.
 *
 * Self-owned login living in the site's own D1 database (binding `DB`). Email
 * one-time-code sign-in for now; Google OAuth can be added later by adding a
 * socialProviders block. See the identity direction in
 * i64os/substrate/directions/identity.md.
 *
 * Built per-request inside Pages Functions because `env` (the D1 binding +
 * secrets) is not a module global there. Better Auth 1.5+ auto-detects a D1
 * binding by duck-typing, so we pass `env.DB` straight in — no adapter wrapper.
 *
 * Required env (Infisical dev / Cloudflare Pages prod):
 *   BETTER_AUTH_SECRET   — random 32+ char string
 *   BETTER_AUTH_URL      — deployed origin, e.g. https://adrianrasmussen.com
 *   RESEND_API_KEY       — existing key, reused for the sign-in code email
 *   RESEND_FROM_EMAIL    — existing verified sender (default below)
 */

import { betterAuth } from 'better-auth';
import { emailOTP } from 'better-auth/plugins';

const DEFAULT_FROM = 'noreply@mandalacodes.com';

/**
 * @param {Record<string, any>} env  Pages Functions env (D1 binding + secrets)
 * @param {(p: Promise<any>) => void} [waitUntil]  context.waitUntil, bound
 */
export function createAuth(env, waitUntil) {
  const baseURL = env.BETTER_AUTH_URL || 'http://localhost:2222';
  const fromEmail = env.RESEND_FROM_EMAIL || DEFAULT_FROM;

  return betterAuth({
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    baseURL,
    basePath: '/api/auth',
    trustedOrigins: [
      baseURL,
      'https://mandalacodes.com',
      'https://www.mandalacodes.com',
      'http://localhost:2222',
      'http://127.0.0.1:2222',
      'http://localhost:8788',
    ],
    advanced: {
      backgroundTasks: {
        handler: (promise) => waitUntil?.(promise),
      },
    },
    // Create-account / log-in with a password. Email verification is NOT
    // required to sign up (kept simple for v1); can be tightened later.
    // NOTE: binding a steward record by email requires a *verified* email
    // (see functions/api/atlas/_helpers.ts findStewardsForUser), so an
    // unverified password signup still cannot claim someone else's piece.
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 8,
    },
    // One person, one account — across every door. Without this, signing in
    // with Google and with an email code at the SAME address creates two
    // separate users and splits the saved chart + orders. Linking by email
    // merges them.
    //
    // The provider ids here are the ones Better Auth actually stores (verified
    // against better-auth 1.6.18): Google's external account is "google"; both
    // the email-code AND the email+password doors store a "credential" account
    // (the OTP plugin has no provider id of its own). So these two entries
    // cover all three doors. Linking is gated on trustedProviders.includes(id)
    // OR a verified email; since we don't require email verification, this list
    // is what authorises the merge.
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ['google', 'credential'],
      },
    },
    // Account deletion. Kept DISABLED by default: the D1 database is SHARED
    // with adrianrasmussen.com (orders/invoices), so exposing self-serve
    // deletion is a cross-site product decision — flip ENABLE_ACCOUNT_DELETION
    // only after that cascade is reviewed on both Pages projects. When it does
    // run, afterDelete removes the app `users` row (separate from Better
    // Auth's `user` table). Atlas cleanup was retired at the 2026-08-09 move:
    // Mandala's R2 steward objects are frozen historical evidence and account
    // deletion here must not mutate them.
    user: {
      deleteUser: {
        enabled: env.ENABLE_ACCOUNT_DELETION === 'true',
        afterDelete: async (deletedUser) => {
          if (!deletedUser?.id) return;
          try {
            const { deleteUserByAuthId } = await import(
              '../../functions/api/_lib/db.js'
            );
            await deleteUserByAuthId(env.DB, deletedUser.id);
          } catch {
            // best-effort; the Better Auth `user` row is already gone
          }
        },
      },
    },
    // "Continue with Google" — only active when the key pair is set in env.
    // Better Auth derives the callback from baseURL:
    //   https://adrianrasmussen.com/api/auth/callback/google
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          socialProviders: {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
            },
          },
        }
      : {}),
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 10 * 60,
        async sendVerificationOTP({ email, otp }) {
          if (!env.RESEND_API_KEY) {
            // Dev without a key set: log so local testing still works.
            console.log(`[auth] sign-in code for ${email}: ${otp}`);
            return;
          }
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: `Adrian Rasmussen Art <${fromEmail}>`,
              to: [email],
              subject: 'Your sign-in code',
              text: `Your sign-in code is ${otp}. It expires in 10 minutes.`,
            }),
          });
          if (!res.ok) {
            const err = await res.text().catch(() => '');
            throw new Error(`Resend failed (${res.status}): ${err}`);
          }
        },
      }),
    ],
  });
}

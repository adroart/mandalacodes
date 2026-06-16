/**
 * Rate-limit guard for the Better Auth routes (/api/auth/*).
 *
 * Runs before the catch-all handler ([[path]].js). Only the abuse-prone POST
 * routes are limited — sending sign-in codes (email-bomb / enumeration) and
 * sign-in / sign-up (credential brute force). Everything else (get-session,
 * OAuth callbacks, sign-out) passes straight through. The limiter itself is
 * fail-open, so this can never lock a real user out.
 */

import { checkRateLimit, clientIp, tooManyRequests } from '../_lib/rate-limit.js';

const RULES = [
  // Email-code send + password reset email: the most abusable (each call may
  // send an email). Tight window.
  {
    match: (p) =>
      p.includes('/email-otp') ||
      p.includes('send-verification') ||
      p.includes('/forget-password') ||
      p.includes('/reset-password') ||
      p.includes('/request-password-reset'),
    bucket: 'otp',
    limit: 5,
    windowMs: 10 * 60 * 1000,
  },
  // Sign-in / sign-up attempts (credential brute force / spray). Backs up
  // Better Auth's own per-code attempt cap.
  {
    match: (p) => p.includes('/sign-in') || p.includes('/sign-up'),
    bucket: 'signin',
    limit: 10,
    windowMs: 5 * 60 * 1000,
  },
];

export async function onRequest(context) {
  const { request, env, next } = context;
  if (request.method === 'POST') {
    const path = new URL(request.url).pathname;
    const rule = RULES.find((r) => r.match(path));
    if (rule) {
      const { ok, retryAfterSec } = await checkRateLimit(
        env,
        `auth:${rule.bucket}:${clientIp(request)}`,
        { limit: rule.limit, windowMs: rule.windowMs },
      );
      if (!ok) return tooManyRequests(retryAfterSec);
    }
  }
  return next();
}

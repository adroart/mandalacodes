/**
 * Durable, edge-safe rate limiting backed by D1.
 *
 * Better Auth ships an in-memory limiter, but on Cloudflare Pages Functions
 * that store is per-isolate and non-durable across the edge — effectively no
 * limit. This uses the shared D1 (`rate_limit_hits`, migration 003) so the
 * window is counted globally.
 *
 * FAIL-OPEN by design: any error (table missing before the migration is
 * applied, a DB hiccup, no DB binding) ALLOWS the request. A limiter problem
 * must never lock a real user out of sign-in.
 */

/**
 * Count one hit against `key` and report whether it is still within `limit`
 * for the rolling `windowMs`. The upsert is atomic (single SQL statement) so
 * concurrent requests can't both read a stale count.
 *
 * @param {{ DB?: any }} env
 * @param {string} key   route-namespaced bucket, e.g. `auth:otp:1.2.3.4`
 * @param {{ limit: number, windowMs: number }} opts
 * @returns {Promise<{ ok: boolean, retryAfterSec: number }>}
 */
export async function checkRateLimit(env, key, { limit, windowMs }) {
  if (!env || !env.DB) return { ok: true, retryAfterSec: 0 };
  const now = Date.now();
  const cutoff = now - windowMs;
  try {
    const row = await env.DB.prepare(
      `INSERT INTO rate_limit_hits (bucket, count, window_start)
       VALUES (?1, 1, ?2)
       ON CONFLICT(bucket) DO UPDATE SET
         count = CASE WHEN window_start < ?3 THEN 1 ELSE count + 1 END,
         window_start = CASE WHEN window_start < ?3 THEN ?2 ELSE window_start END
       RETURNING count, window_start`,
    )
      .bind(key, now, cutoff)
      .first();
    if (!row) return { ok: true, retryAfterSec: 0 };
    const count = Number(row.count) || 0;
    const windowStart = Number(row.window_start) || now;
    if (count > limit) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((windowStart + windowMs - now) / 1000),
      );
      return { ok: false, retryAfterSec };
    }
    return { ok: true, retryAfterSec: 0 };
  } catch {
    return { ok: true, retryAfterSec: 0 }; // fail open
  }
}

/** Best-effort client IP from Cloudflare's edge headers. */
export function clientIp(request) {
  const cf = request.headers.get('CF-Connecting-IP');
  if (cf) return cf;
  const xff = request.headers.get('X-Forwarded-For');
  if (xff) return xff.split(',')[0].trim();
  return 'unknown';
}

/** Standard 429 with a Retry-After header. `extraHeaders` lets callers add CORS. */
export function tooManyRequests(retryAfterSec, extraHeaders = {}) {
  return new Response(
    JSON.stringify({ error: 'rate_limited', retryAfter: retryAfterSec }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Retry-After': String(retryAfterSec),
        ...extraHeaders,
      },
    },
  );
}

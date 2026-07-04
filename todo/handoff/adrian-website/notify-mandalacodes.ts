/**
 * Drop-in sender for Adrian-Website → mandalacodes webhooks.
 *
 * Copy this file into the Adrian-Website repo (e.g. functions/_lib/ or
 * lib/) as-is. Zero dependencies; uses Web Crypto, so it runs unchanged
 * in Cloudflare Pages Functions / Workers.
 *
 * Two senders:
 *   notifyMandalacodesOfSale(env, sale)            — on checkout success
 *   notifyMandalacodesOfContestedClaim(env, input) — optional; when a bind
 *     attempt on this site hits an already-held piece
 *
 * Both are fire-and-forget by contract: they never throw, they retry
 * 3 times with backoff (re-signing with a fresh timestamp each attempt,
 * per the ±5-minute replay window), and on total failure they log and
 * return { ok: false } — the sale/claim still exists in your own records
 * and Adrian handles it manually. Call via context.waitUntil(...) from a
 * Pages Function so retries outlive the response:
 *
 *   context.waitUntil(notifyMandalacodesOfSale(env, sale));
 *
 * Contract: todo/handoff/adrian-website/sale-webhook-spec.md (mandalacodes
 * repo). Secrets: SALE_WEBHOOK_SECRET and CLAIM_BRIDGE_SECRET must match
 * the values set on the mandalacodes Pages project. Distinct values.
 */

const MANDALACODES_ORIGIN = 'https://mandalacodes.com';
const RETRY_DELAYS_MS = [10_000, 60_000, 360_000];

export interface SalePayload {
  saleId: string; // REQUIRED — stable idempotency key (Stripe session id)
  sku?: string;
  pieceId?: string;
  editionNumber?: number;
  buyerEmail: string; // REQUIRED — seeds the steward record, D1 only
  buyerName?: string;
  saleDate: string; // REQUIRED — ISO date or datetime
  priceCents?: number;
  currency?: string;
}

export interface ContestedClaimPayload {
  pieceId: string;
  editionNumber?: number;
  requesterRef: string; // your stable user id for the requester
  requesterEmail: string; // shown to the holder labeled as machine-asserted
  note?: string;
}

export interface SenderEnv {
  SALE_WEBHOOK_SECRET?: string;
  CLAIM_BRIDGE_SECRET?: string;
  /** Override for local testing against wrangler pages dev. */
  MANDALACODES_ORIGIN?: string;
}

export interface SendResult {
  ok: boolean;
  status?: number;
  body?: string;
  attempts: number;
}

/** hex(HMAC-SHA256(secret, timestamp + "." + rawBody)) — the spec's recipe. */
export async function signWebhook(
  secret: string,
  timestamp: string,
  rawBody: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${rawBody}`),
  );
  return Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function postSigned(
  url: string,
  secret: string,
  headerPrefix: 'X-Sale' | 'X-Claim',
  payload: unknown,
): Promise<SendResult> {
  // Serialize ONCE; the signed bytes and the sent bytes must be identical.
  const rawBody = JSON.stringify(payload);
  let attempts = 0;
  for (let i = 0; i <= RETRY_DELAYS_MS.length; i++) {
    attempts = i + 1;
    try {
      // Fresh timestamp + signature on every attempt (replay window).
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = await signWebhook(secret, timestamp, rawBody);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [`${headerPrefix}-Timestamp`]: timestamp,
          [`${headerPrefix}-Signature`]: signature,
        },
        body: rawBody,
      });
      const text = await res.text();
      // 200 = queued or duplicate: both are success, never retry.
      if (res.ok) return { ok: true, status: res.status, body: text, attempts };
      // 400 = payload bug on our side; retrying the same bytes cannot help.
      if (res.status === 400) {
        console.error(`[notify-mandalacodes] payload rejected: ${text}`);
        return { ok: false, status: res.status, body: text, attempts };
      }
      // 401 (possible clock skew), 5xx, 503 (receiver not provisioned):
      // retry with a fresh signature after backoff.
      console.warn(
        `[notify-mandalacodes] attempt ${attempts} got ${res.status}; ` +
          (i < RETRY_DELAYS_MS.length ? 'will retry' : 'giving up'),
      );
    } catch (err) {
      console.warn(
        `[notify-mandalacodes] attempt ${attempts} network error; ` +
          (i < RETRY_DELAYS_MS.length ? 'will retry' : 'giving up'),
        err,
      );
    }
    if (i < RETRY_DELAYS_MS.length) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[i]));
    }
  }
  // Total failure: log and move on. Manual issuance remains source of truth.
  return { ok: false, attempts };
}

/** Fire on checkout success. Never throws. */
export async function notifyMandalacodesOfSale(
  env: SenderEnv,
  sale: SalePayload,
): Promise<SendResult> {
  if (!env.SALE_WEBHOOK_SECRET) {
    console.warn('[notify-mandalacodes] SALE_WEBHOOK_SECRET unset; skipping');
    return { ok: false, attempts: 0 };
  }
  const origin = env.MANDALACODES_ORIGIN || MANDALACODES_ORIGIN;
  return postSigned(
    `${origin}/api/atlas/sale`,
    env.SALE_WEBHOOK_SECRET,
    'X-Sale',
    sale,
  );
}

/**
 * Optional: fire when a bind attempt here hits an already-held piece.
 * Only ever opens a PENDING claim request on the mandalacodes side,
 * routed to the current holder and labeled machine-asserted.
 */
export async function notifyMandalacodesOfContestedClaim(
  env: SenderEnv,
  input: ContestedClaimPayload,
): Promise<SendResult> {
  if (!env.CLAIM_BRIDGE_SECRET) {
    console.warn('[notify-mandalacodes] CLAIM_BRIDGE_SECRET unset; skipping');
    return { ok: false, attempts: 0 };
  }
  const origin = env.MANDALACODES_ORIGIN || MANDALACODES_ORIGIN;
  return postSigned(
    `${origin}/api/atlas/claim-bridge`,
    env.CLAIM_BRIDGE_SECRET,
    'X-Claim',
    input,
  );
}

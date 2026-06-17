# Sale webhook — Adrian-Website → mandalacodes (M4)

Spec for the `notifyMandalacodes(sale)` call Adrian-Website fires on
checkout success. The mandalacodes side is live behind
`POST https://mandalacodes.com/api/atlas/sale`; this document is the
contract the Adrian-Website implementation must match.

What the webhook does — and deliberately does NOT do: a verified call
lands the sale as a **pending** row in the shared D1 table
`atlas_sale_events`. Nothing touches the ledger or steward records until
Adrian confirms the sale in the mandalacodes admin (`/admin/atlas` →
Pending Sales). A forged or duplicated webhook can at worst enqueue a row
that gets dismissed. If the webhook fails entirely, nothing is lost —
Adrian issues the steward manually, exactly as before M4; the queue is a
convenience, not the source of truth.

## Endpoint

```
POST https://mandalacodes.com/api/atlas/sale
Content-Type: application/json
X-Sale-Timestamp: <unix seconds, as a decimal string>
X-Sale-Signature: <hex HMAC, see below>
```

(For local testing against `wrangler pages dev`, substitute the dev
origin; the path is the same.)

## Payload schema

```jsonc
{
  "saleId": "cs_test_a1B2c3",            // REQUIRED — unique, stable per sale.
                                          //   The idempotency key: use the Stripe
                                          //   checkout-session id (or equivalent).
  "sku": "UL-7",                          // optional — your product code; if it
                                          //   equals a mandalacodes archive piece id
                                          //   the admin form pre-fills from it
  "pieceId": "UL-7",                      // optional — mandalacodes piece id when known
  "editionNumber": 2,                     // optional — non-negative integer
  "buyerEmail": "collector@example.com",  // REQUIRED — seeds the steward record
  "buyerName": "Maya Example",            // optional
  "saleDate": "2026-06-10T14:02:11Z",     // REQUIRED — ISO date or datetime
  "priceCents": 120000,                   // optional — non-negative integer
  "currency": "EUR"                       // optional — 3-letter code
}
```

Unknown fields are **rejected** (400). Strings are capped at 300 chars.
Buyer identity and price are stored in D1 only — they never reach the
hash chain, the public atlas state, or the GitHub mirror.

## Signature recipe

```
signature = hex( HMAC-SHA256( SALE_WEBHOOK_SECRET, timestamp + "." + rawBody ) )
```

- `timestamp` — unix **seconds** at send time, the exact string also sent
  in `X-Sale-Timestamp`. The receiver rejects anything more than ±5
  minutes from its clock (replay window), so don't cache/queue the signed
  request for long — sign at send time, re-sign on each retry.
- `rawBody` — the exact bytes of the request body. Serialize once, sign
  that string, send that string. Any re-serialization (key reordering,
  whitespace) breaks the signature.
- Comparison on the receiver is constant-time; failures return a
  detail-free 401.

Node implementation:

```js
const crypto = require('node:crypto');

function signSale(secret, body) {
  const rawBody = JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
  return { rawBody, timestamp, signature };
}
```

### Worked example

With the (sample! never ship it) secret

```
b1946ac92492d2347c6235b4d2611184e0f6a3bea7a1c0f5d9a8f3e2c4b5d6a7
```

timestamp `1765432100`, and this exact body (no whitespace):

```
{"saleId":"cs_test_a1B2c3","sku":"UL-7","buyerEmail":"collector@example.com","saleDate":"2026-06-10T14:02:11Z","priceCents":120000,"currency":"EUR"}
```

the string to MAC is `1765432100.{"saleId":...}` and the signature is

```
7193320cead80526823cdb8804da33fcecb02c708ee98671d5e112bee4d396d3
```

If your implementation produces this value for these inputs, it is
correct (the mandalacodes unit suite pins the same vector).

### curl test

```sh
SECRET='...the shared SALE_WEBHOOK_SECRET...'
BODY='{"saleId":"test-001","buyerEmail":"collector@example.com","saleDate":"2026-06-10"}'
TS=$(date +%s)
SIG=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -hex | sed 's/^.* //')
curl -s -X POST https://mandalacodes.com/api/atlas/sale \
  -H 'Content-Type: application/json' \
  -H "X-Sale-Timestamp: $TS" \
  -H "X-Sale-Signature: $SIG" \
  -d "$BODY"
```

## Responses

| Status | Body | Meaning |
|---|---|---|
| 200 | `{"ok":true,"status":"queued"}` | Sale enqueued for admin confirmation |
| 200 | `{"ok":true,"status":"duplicate"}` | This `saleId` was already received — success, do not retry |
| 400 | `{"ok":false,"error":...}` | Signature OK but payload invalid — fix the sender, do not retry as-is |
| 401 | `{"ok":false,"error":"unauthorized"}` | Bad/missing signature or stale timestamp — check secret + clock |
| 503 | `{"ok":false,"error":...}` | Receiver not ready (secret unprovisioned / D1 migration pending) — retry later |

## Retry policy

On network failure, 5xx, or 401 (clock skew can cause transient 401s):
retry **3 times with exponential backoff** (e.g. 10 s, 60 s, 360 s),
**re-signing with a fresh timestamp on every attempt**. Idempotency makes
this safe: `saleId` is the D1 primary key (`INSERT OR IGNORE`), so any
number of deliveries of the same sale produces exactly one pending row,
and replays of an already-confirmed sale change nothing. Do not retry
400s — they mean the payload itself is wrong. If all retries fail, log it
and move on: the sale still exists in Stripe/your records, and Adrian can
issue the steward manually.

## SALE_WEBHOOK_SECRET provisioning

- Generate **32+ random bytes**, e.g. `openssl rand -hex 32`.
- Set it as `SALE_WEBHOOK_SECRET` on **both** Cloudflare Pages projects
  (Adrian-Website to sign, mandalacodes to verify) — dashboard → Settings
  → Environment variables, production. Same value on both; it is used for
  nothing else (dedicated secret, per `docs/secrets-sync.md` conventions).
- Until it is set on mandalacodes, `/api/atlas/sale` answers 503.
- Rotation: verification is single-valued, so rotate in a quiet window —
  set the new value on mandalacodes, then immediately on Adrian-Website.
  An in-flight retry signed with the old secret gets a 401 and re-signs
  with the new one on its next attempt.

## Adrian-Website implementation checklist

1. Add `notifyMandalacodes(sale)` to the checkout-success path (Stripe
   webhook handler or success callback), built per this spec.
2. Optional SKU → pieceId map so `pieceId` can ride along when known —
   the mandalacodes admin form pre-fills from it but always lets Adrian
   pick the piece (the webhook's word never decides which piece moves).
3. Copy `003_atlas_legacy.sql` (in this folder) into `migrations/` and
   apply — the queue table ships in that migration.
4. Provision the secret (above).

# Bring in Adrian Rasmussen — quote system ↔ recommendation API

How to wire the Adrian Rasmussen quote system to the Mandala Codes
`/api/oracle/recommendation` engine, so a client gets a personalized "art for
your chart" recommendation they can purchase.

The split is fixed: **meaning on Mandala Codes** (the chart, the codes, the
energy, the art match — the recommendation API), **money on Adrian Rasmussen**
(pricing, inventory, Stripe, the quote/proposal, the client page + PDF).

## Step 0 — bring the repo into the session

This work spans two repos. A Claude session scoped to `mandalacodes` can't see
the art site; add it:

- The repo is **`adroart/Adrian-Website`**.
- In a session, run `list_repos` (mcp**claude-code-remote**list_repos) to confirm
  it's available, then `add_repo` to pull it into scope. (Or start a session with
  both repos.)
- Then point Claude at the **quote system page** — Adrian will show which file/
  route it is.

## Step 1 — call the recommendation engine from the quote flow

In the quote builder, once you have the client's chart (or their birth moment):

```
POST {MANDALA}/api/oracle/recommendation
Content-Type: application/json
Authorization: Bearer {ORACLE_API_TOKEN}

{
  "clientName": "Jordan",
  "utcBirth": "1990-06-09T14:30:00Z",     // OR a ready "profile" (11 spheres)
  "recommendation": {                      // optional, the curator's picks
    "intention": "…",
    "picks": [ { "sphere": "lifesWork", "reason": "…" }, { "gate": 45, "reason": "…" } ],
    "closing": "…"
  }
}
```

`{MANDALA}` = `http://localhost:5555` in dev (wrangler pages dev), or
`https://mandalacodes.com` in prod.

**Response** (`LookbookData`): `pieces[]` — each sphere's `{ gate, line,
cardName, essence, giftName, gift, shadowName, siddhiName, lineReading, pieceId,
pieceTitle, image, thumb, recommended }` — plus a resolved `recommendation`.

`pieceId` (e.g. `UL-122`) is the join key into the Adrian-Website inventory for
price + availability.

## Step 2 — render on the Adrian side

- Join each piece's `pieceId` to your inventory → price, edition, stock.
- The curator stars/writes the recommended picks + reasons in the quote UI (the
  `recommendation` block), or send them in the request and echo them back.
- Render the client recommendation **page** (and/or **PDF**). You can reuse the
  layout in `mandalacodes/scripts/chart-lookbook/template.ts` as a starting
  point, or build it native to the quote system.
- Attach the purchase flow (Stripe) — this is the only place checkout lives.

## Step 3 — config

- **Token:** provision `ORACLE_API_TOKEN` as a Mandala Codes Pages secret before
  deploying the access change. Keep the matching key on the Adrian-Website
  server and send `Authorization: Bearer …` on each request. The endpoint returns
  HTTP 503 when its key is unconfigured and HTTP 401 when the request has no
  valid bearer key.
- **CORS:** the endpoint retains `*` and an unauthenticated preflight for
  compatibility. The quote system calls recommendation POST from its server;
  never expose the integration key to browser code or client pages.

## Notes

- Chart computation: pass `utcBirth` and the engine builds the 11-sphere profile
  via `buildHologeneticProfile` — no chart PDF needed. To go from a birthplace to
  `utcBirth`, resolve the timezone first (Mandala Codes has `lib/astrology/places`
  for this if you want a `/api/oracle/chart` step later).
- Keep the recommendation *reasons* (the curation) authored on the Adrian side —
  that's the sales voice, per-client.
- This endpoint is read-only and stateless; no client PII is stored by Mandala
  Codes (the chart is computed and returned, not persisted).

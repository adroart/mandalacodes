# Atlas dim-world: go-live ops checklist

Generated 2026-07-12. Nothing on this list has been run. This is a
copy-pasteable distillation of `todo/handoff/MORNING-AFTER.md` and
`todo/handoff/GO-LIVE-RUNBOOK.md`, cross-checked against the current
`functions/api/atlas/sale.ts` and `functions/api/atlas/_email.ts` source, for
the specific items item 2c of `todo/plans/atlas-dim-world.md` calls out: D1
tables, `SALE_WEBHOOK_SECRET`, and `RESEND_API_KEY` verification. It does not
replace the two handoff docs; it is the command-by-command companion.

All of this requires production Cloudflare credentials (`wrangler login`)
and, for the D1 step, a local checkout of the Adrian-Website repo. None of it
can be run from a Claude session.

RE-VERIFIED 2026-07-18 against current main after the full redesign merged:
every command below still matches the deployed source (sale.ts still gates on
SALE_WEBHOOK_SECRET, claim-bridge.ts on CLAIM_BRIDGE_SECRET, _email.ts
no-ops without RESEND_API_KEY; both migration files and the webhook sender
module sit unchanged in todo/handoff/adrian-website/). Nothing added this
session needs new ops: the claim codes and the Catalog Room live in R2 and
work already.

Prerequisites for the sitting: a machine with node 20+, both repo checkouts
(mandalacodes and Adrian-Website) pulled to latest main, and a browser for
`npx wrangler login`. Infisical is optional; every secret can be set with
the plain wrangler commands shown below. Budget about 40 minutes.

Step 9 (added 2026-07-18, run any time after step 1): the UL genesis
backfill, so all 64 pieces exist in the live ledger:

```bash
# From the mandalacodes checkout, logged in to wrangler:
npx tsx scripts/genesis-all-pieces.ts
```

How to prove it worked: /api/atlas returns 64 pieces, and the atlas caption
counts them. Pieces without a resting city appear in Seeking Ground below
the globe rather than as lights; placing them (or the hearth rendering,
pending Adrian's hearth-city ruling) is Catalog Room work afterward, not
part of this sitting.

---

## 1. D1 migrations: atlas_inscriptions, atlas_sale_events, atlas_piece_content

Three tables ship as two migration files in this repo but must be applied
from the Adrian-Website checkout, since it owns the shared `adrian-website`
D1 database. Read `docs/d1-migrations.md` first: both repos hold migrations
for the same database and D1 tracks them by filename.

```bash
# From either checkout, see what the journal already contains:
npx wrangler d1 migrations list adrian-website --remote

# From the Adrian-Website checkout only:
cp <mandalacodes>/todo/handoff/adrian-website/003_atlas_legacy.sql migrations/
cp <mandalacodes>/todo/handoff/adrian-website/004_piece_content.sql migrations/
npx wrangler d1 migrations apply adrian-website --remote
```

**How to prove it worked:**

```bash
wrangler d1 execute adrian-website --remote --json --command \
  "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('atlas_inscriptions','atlas_sale_events','atlas_piece_content');"
```

The result should list all three table names. Until this lands,
`/api/atlas/sale` returns `503 migration not applied` (confirmed in
`functions/api/atlas/sale.ts`, the `if (!env.DB) return migrationNotApplied();`
check), and `/api/atlas/piece-content` degrades to an empty result rather than
erroring.

---

## 2. SALE_WEBHOOK_SECRET

`functions/api/atlas/sale.ts` reads `env.SALE_WEBHOOK_SECRET` and returns
`503 Sale bridge not configured` when it is unset. The same value must be set
on both Pages projects: mandalacodes verifies incoming webhooks,
adrianrasmussen.com signs outgoing ones.

```bash
openssl rand -hex 32
# -> set the output as SALE_WEBHOOK_SECRET on BOTH projects:
echo "<generated-secret>" | wrangler pages secret put SALE_WEBHOOK_SECRET --project-name mandalacodes
echo "<same-secret>"      | wrangler pages secret put SALE_WEBHOOK_SECRET --project-name <adrian-website-project-name>
```

Redeploy both projects after setting (Pages secrets only take effect on the
next deploy).

**How to prove it worked:**

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://mandalacodes.com/api/atlas/sale \
  -H 'Content-Type: application/json' -d '{}'
```

Expect `401` (secret present, rejecting the unsigned request), not `503`
(secret still missing). For a full end-to-end proof that a correctly signed
payload gets queued:

```bash
SECRET='<the SALE_WEBHOOK_SECRET value>'
BODY='{"saleId":"ops-check-001","buyerEmail":"you@example.com","saleDate":"2026-07-12"}'
TS=$(date +%s)
SIG=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -hex | sed 's/^.* //')
curl -s -X POST https://mandalacodes.com/api/atlas/sale \
  -H 'Content-Type: application/json' \
  -H "X-Sale-Timestamp: $TS" \
  -H "X-Sale-Signature: $SIG" \
  -d "$BODY"
```

Expect `{"ok":true,"status":"queued"}`. Then confirm the row landed and clean
it up from AdminAtlas's sale queue (dismiss it, since `ops-check-001` is not a
real sale).

---

## 3. CLAIM_BRIDGE_SECRET

Not named in `MORNING-AFTER.md` but required by the newer contested-claim
bridge (`functions/api/atlas/claim-bridge.ts`), which reads
`env.CLAIM_BRIDGE_SECRET` and returns `503 Claim bridge not configured` when
unset. Generate a value distinct from `SALE_WEBHOOK_SECRET` and set it on
both projects the same way:

```bash
openssl rand -hex 32
echo "<generated-secret>" | wrangler pages secret put CLAIM_BRIDGE_SECRET --project-name mandalacodes
echo "<same-secret>"      | wrangler pages secret put CLAIM_BRIDGE_SECRET --project-name <adrian-website-project-name>
```

**How to prove it worked:** same pattern as step 2, aimed at
`/api/atlas/claim-bridge` with `X-Claim-Timestamp` / `X-Claim-Signature`
headers instead: a `401` on an unsigned POST means the secret is set; `503`
means it is still missing.

Both secrets can also be set together, from Infisical, in one pass:

```bash
infisical run --env=prod --path=/ -- bash scripts/sync-secrets-to-cloudflare.sh
```

That script only pushes to the mandalacodes Pages project; the
adrianrasmussen.com side still needs the same values set manually (see
`docs/secrets-sync.md`).

---

## 4. RESEND_API_KEY verification (one real test email)

`functions/api/atlas/_email.ts`'s `sendLetterEmail` silently no-ops when
`env.RESEND_API_KEY` is unset (`if (!env.RESEND_API_KEY) return;`), so a
missing key produces no error anywhere, only silence. `RESEND_API_KEY` is
already listed as a live production secret in
`scripts/sync-secrets-to-cloudflare.sh`, so this step is about confirming it
still sends, not provisioning it fresh.

Two ways to prove it works:

**A. Direct API check** (bypasses the app entirely, confirms the key itself
is valid and can send):

```bash
curl -s -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "Adrian Rasmussen Art <noreply@mandalacodes.com>",
    "to": ["<your-own-inbox>"],
    "subject": "Atlas ops check",
    "text": "If this arrived, RESEND_API_KEY is live in prod."
  }'
```

**How to prove it worked:** the response is `200` with an `id` field, and the
email actually arrives in the target inbox (a `200` from Resend means
accepted for delivery, not delivered, so check the inbox too).

**B. In-product path** (proves the whole letter pipeline, not just the key):
trigger a real kin-claim or anniversary/transfer letter for a piece with a
steward bound to an inbox you control (via the normal claim/consent flow or
AdminAtlas), then confirm the courtesy email copy arrives alongside the
in-product letter. `sendLetterEmail` swallows every failure to
`console.warn`, so also tail the Pages Function logs during the test:

```bash
wrangler pages deployment tail --project-name mandalacodes
```

**How to prove it worked:** the email arrives, and the tail log shows no
`[atlas letters] Resend send failed` or `Resend send threw` warnings during
the window of the test.

---

## 5. GitHub mirror (tamper evidence)

Not required to launch (everything degrades gracefully without it), but
listed in both handoff docs as part of go-live:

```bash
# 1. Create a public repo, e.g. technicianofthesacred/adrian-atlas-mirror
# 2. Generate a fine-grained PAT, Contents: Read/Write, scoped to that repo only
# 3. Set on the mandalacodes Pages project:
echo "<PAT>"                       | wrangler pages secret put GITHUB_MIRROR_TOKEN --project-name mandalacodes
echo "owner/adrian-atlas-mirror"   | wrangler pages secret put GITHUB_MIRROR_REPO  --project-name mandalacodes
echo "atlas/public.json"           | wrangler pages secret put GITHUB_MIRROR_PATH  --project-name mandalacodes
```

Redeploy after setting.

**How to prove it worked:** trigger any `public.json` write (e.g. a claim or
consent-ring change), then check the mirror repo for a new dated commit
touching `atlas/public.json`.

---

## 6. Baseline backup

```bash
npx wrangler login    # one-time, local machine
npm run backup:atlas
```

**How to prove it worked:** the command exits 0 and prints a
`backups/atlas-<timestamp>/` path containing `ledger.json` and
`stewards.json` (required; a missing one is an ERROR and a non-zero exit,
which is expected on a system with no steward yet). Move the output offline;
`stewards.json` and `claimRequests.json` contain collector contact
information and must stay private.

---

## 7. Adrian-Website webhook sender

Other repo, code already written here as a drop-in module:

```bash
cp todo/handoff/adrian-website/notify-mandalacodes.ts <Adrian-Website>/functions/_lib/
```

Then, from the Stripe checkout-success handler in that repo, call
`context.waitUntil(notifyMandalacodesOfSale(env, sale))`. Full payload
contract: `todo/handoff/adrian-website/sale-webhook-spec.md`.

**How to prove it worked:** run a real (or sandbox) checkout on
adrianrasmussen.com and confirm the sale appears in AdminAtlas's sale queue
on mandalacodes within a few seconds, status `pending`.

---

## 8. Claim light #1

Not scriptable, and per `GO-LIVE-RUNBOOK.md` "not delegable": sign in to
mandalacodes.com as Adrian, confirm or issue a steward record for Adrian's
own origin piece in AdminAtlas, then complete the full claim flow from that
piece's page (say yes to the Ring 2 map question, write the first
inscription).

**How to prove it worked:** the globe shows light #1 lit, and the piece page
shows the Founding Lights ordinal as 1.

---

## Status snapshot at time of writing

Per `MORNING-AFTER.md`'s status ledger (as of 2026-07-02, unverified since):
step a (merge to main) is done; steps b through h are not. This checklist
covers b, c, the newer `CLAIM_BRIDGE_SECRET`, and the `RESEND_API_KEY`
verification MORNING-AFTER names but does not give exact commands for. Steps
d (Adrian-Website sender), e (GitHub mirror), f (backup), g (claim light 1),
and h (outreach) are covered above as sections 7, 5, 6, 8, and are otherwise
unchanged from the handoff docs.

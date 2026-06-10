# Morning-after checklist — taking the living-art-legacy build live

Everything on this list is a **you** task. Work through it in order; the
items lower in the list depend on the ones above them.

Items marked with a note about "503 until..." describe features that exist in
the deployed code but return a graceful error until a prerequisite is met.
Nothing breaks if you leave them overnight — they just stay dormant.

---

## a) Review and merge the branch

Review the PR for branch `claude/gallant-faraday-kb2y28` and merge it to
`main`. Cloudflare Pages auto-deploys on push to main; wait for the build to
succeed before continuing.

All 157 unit tests pass. TypeScript check is clean.

---

## b) Apply the D1 migration

The two new tables (`atlas_inscriptions` and `atlas_sale_events`) ship in a
migration file that lives in THIS repo for handoff, but must be applied from
the **Adrian-Website** repo (it owns the shared schema):

1. Copy `todo/handoff/adrian-website/003_atlas_legacy.sql` into the
   Adrian-Website repo's `migrations/` directory.
2. From the Adrian-Website checkout, run:

   ```bash
   wrangler d1 migrations apply adrian-website --remote
   ```

3. Verify the migration applied: the command should print two `CREATE TABLE`
   statements as executed.

**Until this is done:** the following endpoints return `503 migration not
applied` and are otherwise harmless:
- `/api/atlas/steward/inscribe` (Ring 1 legacy entries)
- `/api/atlas/steward/inscriptions`
- `/api/atlas/steward/export`
- `/api/atlas/inscriptions/erase`
- `/api/atlas/sale` (incoming sale webhook)
- `/api/atlas/sales` and `/api/atlas/sales/confirm`

Everything else — the globe, piece pages, claiming, consent, heirs, letters,
kinship arcs — works immediately after merge.

---

## c) Generate and set SALE_WEBHOOK_SECRET

Generate a strong random secret and set it on **both** Cloudflare Pages
projects:

```bash
openssl rand -hex 32
```

Set the output as `SALE_WEBHOOK_SECRET` on:
- **mandalacodes** Pages project (verifies incoming webhooks)
- **adrianrasmussen.com** Pages project (will sign outgoing webhooks once the
  sender is implemented in step d)

Dashboard path: Pages project → Settings → Environment variables → Production.
Add as encrypted. Redeploy both projects after setting.

Until this secret is set on mandalacodes, `/api/atlas/sale` returns 503.
The rest of the sale queue (listing, confirming, dismissing) requires only the
D1 migration and admin auth, which already works.

See `todo/handoff/adrian-website/sale-webhook-spec.md` for the full
signing protocol, worked example, and curl test.

---

## d) Implement the webhook sender on Adrian-Website

Adrian-Website needs to call `POST https://mandalacodes.com/api/atlas/sale`
on checkout success. The full contract is in:

```
todo/handoff/adrian-website/sale-webhook-spec.md
```

Key points:
- Sign with `HMAC-SHA256(SALE_WEBHOOK_SECRET, timestamp + "." + rawBody)`.
- Re-sign with a fresh timestamp on every retry (the receiver enforces a ±5-minute
  replay window).
- Idempotent: `saleId` is the D1 primary key, so retries are safe.
- If all retries fail, log it and move on — Adrian issues the steward manually
  as before; the queue is convenience, not source of truth.

The optional SKU → pieceId map lets the admin form pre-fill, but Adrian always
picks the piece manually; the webhook's word never decides which piece moves.

---

## e) Activate the GitHub mirror

The public mirror provides external tamper evidence: every `public.json`
write becomes a dated commit, and the commit history is what a third party
can verify. Without the mirror, chain integrity is only self-attested (R2 is
mutable storage).

**What gets mirrored:** `public.json` only. This is correct and required. The
ledger and steward files contain or reference personal data and must never be
mirrored. The code in `functions/api/atlas/_mirror.ts` enforces this.

To activate:
1. Create a public GitHub repository (e.g. `<username>/adrian-atlas-mirror`).
2. Generate a fine-grained PAT with Contents: Read/Write on that repo.
3. Set these three environment variables on the **mandalacodes** Pages project:
   - `GITHUB_MIRROR_TOKEN` — the PAT (encrypted)
   - `GITHUB_MIRROR_REPO` — `owner/repo` (e.g. `technicianofthesacred/adrian-atlas-mirror`)
   - `GITHUB_MIRROR_PATH` — path inside the repo (e.g. `atlas/public.json`)
4. Redeploy.

Until all three vars are set the mirror silently no-ops; nothing breaks.

---

## f) Production Clerk (if not done)

The site currently uses a shared dev Clerk instance. For production, follow:

```
todo/plans/clerk-launch.md
```

This covers: creating a free production Clerk instance with its own domain and
DNS, setting up Google OAuth, and pointing it at the shared `adrian-website` D1
while collectors stay unified.

This is a prerequisite for the full public accounts surface, but the atlas
admin and steward claim flow work today with the dev instance.

---

## g) Take a baseline backup

Before any real collector data lands:

```bash
npm run backup:atlas
```

This pulls `atlas/ledger.json` and `atlas/stewards.json` from the production
bucket into a gitignored `backups/atlas-<timestamp>/` folder. Move the output
to offline storage. `stewards.json` contains collector contact information;
keep it private.

Run `npm run backup:atlas` before any structural change in the future. It takes
seconds and costs nothing.

---

## h) Claim light #1 — the ignition moment

This is the launch:

1. Sign in to mandalacodes.com with Adrian's account.
2. In AdminAtlas, confirm that Adrian's own piece (the artist's origin piece)
   has a steward record issued to his email. If it does not yet exist, use the
   "Issue steward record" form to create it.
3. Navigate to the piece's public page (via its QR code or the piece-page
   route) and complete the full claim flow:
   - Answer the Ring 2 map question (choose yes — the origin light should burn).
   - Write the first inscription when prompted (the ritual moment: "What do you
     hope this piece holds for you?" — this is Adrian's answer, as the artist,
     about his own work in the world).
4. Verify: the globe shows light #1. The piece page shows the Founding Lights
   ordinal. The claim-order ordinal is chain-recorded permanently.

Adrian is light #1. Nobody can ever take that.

---

## i) Begin the collector outreach campaign

With light #1 lit:

1. In AdminAtlas, review the steward roster (the outreach funnel shows
   `no-contact → invited → claimed`).
2. Reach out to known collectors one by one, in order of relationship strength.
   The "unawakened" dots on the globe (admin-placed city, no steward yet) are
   your campaign dashboard — each successful contact visibly ignites a light.
3. Frame it as: "Claim your certificate, take your founding number, light your
   city." Founding scarcity is honest and chain-recorded: nobody can ever take
   #3 from the person who was third.
4. Early validation: if after contacting ~10 collectors fewer than ~3 claim and
   inscribe, pause before deepening the Ring 1 / inscription campaign and
   reassess where the value actually lives.

The self-serve claim-request flow (M4) handles secondary sales, auctions,
gifts, and retroactive collectors: a buyer who isn't pre-registered can scan
the QR, sign in, and request stewardship; you approve from the admin queue.

---

## Feature availability summary

| Feature | Available after... |
|---|---|
| Globe, piece pages, public history | Merge |
| Claiming + consent (Ring 2) | Merge |
| Heirs, letters, kinship arcs | Merge |
| Ring 1 inscriptions (write/read) | Merge + D1 migration (step b) |
| Holder export | Merge + D1 migration (step b) |
| Inscription erasure | Merge + D1 migration (step b) |
| Sale webhook queue | Merge + D1 migration (step b) + SALE_WEBHOOK_SECRET (step c) |
| Sale queue admin UI | Merge + D1 migration (step b) |
| External tamper evidence | GitHub mirror activated (step e) |
| Full public accounts surface | Production Clerk (step f) |

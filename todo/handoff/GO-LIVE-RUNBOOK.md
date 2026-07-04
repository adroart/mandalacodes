# Go-live runbook — closing out the 2026-07-02 review cycle

This consolidates every step that still needs a human with production
credentials, in order, with exact commands. It supersedes nothing: it wraps
[MORNING-AFTER.md](MORNING-AFTER.md) (whose status ledger stays the tracking
surface) and adds the items the 2026-07-02 review introduced.

**Why these are on you:** the remote Claude environment has no Cloudflare
authentication (no wrangler login, no API token), no access to the
Adrian-Website repo, and no ability to sign in as you. Everything that COULD
be done without credentials has been done and merged: the review
(`docs/reviews/2026-07-02-registration-legacy-review.md`), the plan
amendment, the claim-window/bridge hardening, the core ledger fixes, the
docs sync, and PR #61 itself.

Work through this top to bottom. Check items off in MORNING-AFTER's status
ledger as you go.

---

## 0. After PR #61 merges

```bash
git checkout main && git pull origin main
```

Cloudflare Pages auto-deploys main; wait for the build to go green before
step 2 onward.

## 1. D1 migration (MORNING-AFTER step b) — read the hazard doc first

Before touching the shared database, read `docs/d1-migrations.md` (new):
both repos hold migrations for the same `adrian-website` DB and D1 journals
by FILENAME, with a `001_init.sql` collision between the repos.

```bash
# From BOTH checkouts, see what the journal already contains:
npx wrangler d1 migrations list adrian-website --remote

# Then, from the Adrian-Website checkout only:
cp <mandalacodes>/todo/handoff/adrian-website/003_atlas_legacy.sql migrations/
npx wrangler d1 migrations apply adrian-website --remote
# Expect two CREATE TABLE statements (atlas_inscriptions, atlas_sale_events).
```

Unblocks: inscriptions, holder export, erasure, the whole sale queue.

## 2. Secrets (MORNING-AFTER step c, plus the new bridge secret)

Generate two DISTINCT secrets (do not reuse one for both):

```bash
openssl rand -hex 32   # -> SALE_WEBHOOK_SECRET
openssl rand -hex 32   # -> CLAIM_BRIDGE_SECRET
```

Set each on BOTH Pages projects (mandalacodes verifies, adrianrasmussen.com
signs): Pages project → Settings → Environment variables → Production, add
as encrypted, then redeploy both. Or via the script (it now knows both
secrets plus the mirror vars):

```bash
infisical run --env=prod --path=/ -- bash scripts/sync-secrets-to-cloudflare.sh
```

Until set: `/api/atlas/sale` and `/api/atlas/claim-bridge` return 503
(harmless).

## 3. GitHub mirror (MORNING-AFTER step e) — tamper evidence

1. Create a public repo, e.g. `technicianofthesacred/adrian-atlas-mirror`.
2. Fine-grained PAT, Contents: Read/Write, that repo only.
3. Set on the mandalacodes Pages project: `GITHUB_MIRROR_TOKEN` (encrypted),
   `GITHUB_MIRROR_REPO` (`owner/repo`), `GITHUB_MIRROR_PATH`
   (`atlas/public.json`). Redeploy.

Only `public.json` is ever mirrored; the code enforces this.

## 4. Baseline backup (MORNING-AFTER step f)

```bash
npx wrangler login    # one-time on your machine
npm run backup:atlas
```

Note: on a fresh system `ledger.json`/`stewards.json` are REQUIRED keys; if
they don't exist yet the script errors (exit 1) rather than skipping. That
is expected before any steward has been issued. Move the output offline;
`stewards.json` and `claimRequests.json` contain collector contact info.

## 5. Adrian-Website senders (MORNING-AFTER step d) — other repo

Out of scope for the mandalacodes session (no access to that repo). Two
senders to implement there, both HMAC-SHA256 over `timestamp + "." + rawBody`,
hex, unix seconds, ±5-minute window:

- **Sale webhook** → `POST https://mandalacodes.com/api/atlas/sale`, signed
  with `SALE_WEBHOOK_SECRET`. Full contract + worked example + curl test:
  `todo/handoff/adrian-website/sale-webhook-spec.md`.
- **Claim bridge** (optional, for contested binds on the art site) →
  `POST https://mandalacodes.com/api/atlas/claim-bridge`, signed with
  `CLAIM_BRIDGE_SECRET`. Same signing scheme; body carries
  `{pieceId, editionNumber?, requesterRef, requesterEmail, note?}`. The
  receiving side stamps these requests as machine-asserted
  (`requesterEmailVerified: false`) and only ever opens a pending request.

Retries: re-sign with a fresh timestamp each attempt; idempotent on saleId /
dedupe on the request side; if all retries fail, log and move on (manual
issuance remains the source of truth).

## 6. Claim light #1 (MORNING-AFTER step g) — the ignition, not delegable

Follow MORNING-AFTER step g verbatim: issue your own steward record in
AdminAtlas if it doesn't exist, then complete the full claim flow from the
piece page (say yes to the map question, write the first inscription). This
one is a ritual, not an ops task; nobody else can write that inscription.

## 7. Outreach (MORNING-AFTER step h)

The roster funnel in AdminAtlas is the dashboard. Validation gate from the
plan: if fewer than ~3 of the first ~10 contacted collectors claim and
inscribe, pause before deepening Ring 1 and reassess.

---

## Decision records (2026-07-02)

These two were open "on Adrian" items from the review; recorded here so the
next session can build without re-litigating.

### Notification channel: use Resend (already provisioned)

The claim window's warnings and M5's "the piece writes back" letters both
need out-of-band delivery. The stack already sends transactional email
through Resend (Better Auth sign-in codes; `RESEND_*` secrets are live in
production). Decision: wire atlas letters and, later, claim-window warnings
to Resend email using the existing secret set — no new vendor, no new
account. Build order:

1. **DONE 2026-07-02.** A small `sendLetterEmail` helper beside the letters
   code (`functions/api/atlas/_email.ts`), using the same Resend key/fetch
   pattern Better Auth uses for sign-in codes, addressed to the steward's
   bound email. Fire-and-forget: every failure mode is swallowed inside the
   helper (console.warn at most, no retries); silent no-op when
   `RESEND_API_KEY` is unset.
2. **DONE 2026-07-02.** Kin-claim letters (`functions/api/atlas/_letters.ts`
   `generateKinClaimLetters`) and anniversary/transfer letters
   (`functions/api/atlas/steward/letters.ts` `onRequestGet`, the derived-on-
   read generation) get an email copy on write — the in-product letter
   stays the canonical record, no delivery state is persisted, and each
   email goes only to that piece's own bound steward, never a third party.
   Unit coverage: `tests/unit/letterEmail.test.ts`.
3. **NOT DONE.** Only after delivery lands in `ClaimRequest.warnings[]` may
   the claim window be wired up, per the plan amendment's activation
   preconditions. Claim-window warning emails are a separate, not-yet-built
   sender — step 1/2 above cover only atlas letters.

### Piece-page content: D1 editorial table + admin editor

Answer to piece-page-buildout.md's blocking question ("where does editable
content live"): a new D1 table (e.g. `atlas_piece_content`: piece_id, story,
images JSON, materials, updated_at) owned by the same shared-schema flow as
the other atlas tables, served through a small read endpoint the piece page
merges over `FULL_ARCHIVE` static fields (title/dimensions stay in code).
An admin-gated editor alongside AdminAtlas writes it. The 64 stories
themselves are your voice and stay with you; the editor is buildable by an
agent on request. Rationale: keeps editorial content out of the hash chain,
reuses existing admin auth, no new storage system.

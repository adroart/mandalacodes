# Security & Integrity Audit — Mandala Codes

**Date:** 2026-06-16
**Branch:** `claude/trusting-johnson-0yqtcx`
**Scope:** Authorization & auth correctness, secrets/PII, input handling, client XSS, HTTP headers, and code hygiene (orphans / dead routes / config drift), across the React SPA, Cloudflare Pages Functions backend, and the Atlas ownership subsystem.
**Method:** Read-only investigation across four parallel passes. Safe, reversible fixes were applied on this branch (see "Fixes applied"). Anything touching auth, payments, ownership transfer, or data deletion was left as a written proposal for human review — **not** auto-changed.

---

## TL;DR — look at these three first

1. **`requireEmailVerification: false` enables stewardship account-takeover (HIGH).** The email/password provider doesn't verify email ownership. An attacker who knows a collector's email can register it, sign in, and bind an unclaimed Atlas piece via `POST /api/atlas/steward/claim` (which falls back to matching an *unbound* steward record by email). They become the bound steward; the real collector is locked out. **Fix: gate steward binding on a verified email.**
2. **No durable rate-limiting on the auth/email surface (HIGH).** Better Auth has no `rateLimit` block, and its default limiter is in-memory (per-isolate on Cloudflare edge → effectively none). This exposes email-OTP send to email-bombing/enumeration and password login to brute force. The unauthenticated `POST /api/oracle/recommendation` is also a CPU-DoS amplifier when `ORACLE_API_TOKEN` is unset.
3. **Dead Clerk webhook = account-deletion no longer cleans up (HIGH-ish, data hygiene).** `functions/api/clerk/webhook.js` was the *only* trigger for unbinding a steward record + deleting the D1 `users` row on account deletion. Clerk is gone, so Better Auth account deletions now leave orphaned `users` rows and steward bindings forever. **Re-home that unbind logic onto a Better Auth deletion hook before deleting the webhook.**

**Reassuring news:** No SQL injection (every D1 query is parameterized), no mass-assignment, no client-side XSS, and **no live secrets** in the working tree or git history. The Atlas per-record authorization model (steward ownership checks, admin gating, HMAC-signed sale webhook) is genuinely sound. The real risk cluster is the **half-finished Clerk → Better Auth migration** plus **missing rate-limiting**, not the core data plane.

---

## Remediation status — UPDATED 2026-06-16 (everything fixed on `claude/trusting-johnson-0yqtcx`)

Following the audit, all findings were remediated on this branch (the user
authorized fixing the sensitive auth/ownership/deletion items too). Summary:

| # | Fix | Commit subject |
|---|-----|----------------|
| H1 | Steward email-bind now requires a verified email | `fix(atlas): require a verified email before binding a steward record` |
| H3/M2/O2 | Dead Clerk webhook removed; deletion cleanup re-homed onto a gated Better Auth hook; `svix` dropped; two-table model documented | `fix(auth): retire dead Clerk webhook; wire gated account-deletion cleanup` |
| H2 | Durable D1 rate-limiting on auth + recommendation | `feat(security): durable D1-backed rate limiting on auth + recommendation` |
| M3 | OAuth `callbackURL` validated; CORS fails closed on unset `BETTER_AUTH_URL` | `fix(auth): validate OAuth callbackURL; fail closed on unset BETTER_AUTH_URL` |
| L1 | CSP `script-src 'unsafe-inline'` replaced with a hash | `harden(csp): drop script-src 'unsafe-inline' in favor of a hash` |
| L2/L3/L4 | frame-ancestors; innerHTML→textContent; dead orders link | (earlier safe-fix commits) |
| O1 | Clerk env removed from sync script/types/docs; Better Auth vars added | `chore(config): drop orphaned Clerk env vars; document Better Auth secrets` |
| O3 | `_lib/clerk.{ts,js}` → `_lib/auth.{ts,js}`; dead `bearerToken` removed | `refactor(auth): rename _lib/clerk.{ts,js} to _lib/auth.{ts,js}` |
| D1/D2 | TODO Clerk items corrected; INDEX generator note fixed | `docs: correct stale Clerk roadmap items and dead INDEX generator note` |
| L5 | **Deliberately deferred** — low severity, self-heals; a conditional-write loop in the crown-jewel R2 path is too fragile to add unattended. Documented below. | — |
| D3 | **No action** — `oracle/card.ts` is a deliberate public/cacheable endpoint; having no in-repo caller is correct. | — |

### Deploy checklist (required for the fixes to take full effect)

1. **Apply migration 003** to the shared D1 so the rate-limiter has its table:
   `wrangler d1 migrations apply adrian-website --remote`. Until applied the
   limiter **fails open** (allows traffic) — safe to deploy code first.
2. **Set `BETTER_AUTH_URL`** in the Pages env (the CORS relaxation now fails
   closed if it's unset — intended, but it must be present in prod).
3. **Account deletion stays OFF** unless you set `ENABLE_ACCOUNT_DELETION=true`.
   Before enabling, review the cascade on the **shared** `adrian-website` DB
   (orders/invoices) with the art site — that's why it's gated.
4. **Resync secrets**: the sync script's required vars changed to
   `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` / `ADMIN_EMAILS` (was Clerk).
5. **Verify** sign-in (email-code + Google) and a steward claim on a preview
   deploy — H1 means an *unverified* password session can no longer bind by
   email (it now returns a 403 asking the user to verify via email code).

### L5 — `public.json` write race (deferred, with reasoning)

`regeneratePublicState` writes the derived `public.json` with a plain `put`.
Two concurrent ledger writes can momentarily leave it reflecting the losing
snapshot until the next write heals it. The only correct fix is a
version-guarded conditional-write retry loop (like `mutateJsonArray`) in the
most critical R2 path. Given it is low severity and self-healing, adding that
concurrency machinery unattended carries more risk (a subtle bug could break
public-state writes outright) than the race itself. Recommend doing it
deliberately, with a test, when the ledger write path is next touched.

## Severity index

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| H1 | Unverified-email steward account-takeover | **High** | `[SENSITIVE]` — proposal only |
| H2 | No durable rate-limiting on auth/email/recommendation | **High** | `[SENSITIVE]` — proposal only |
| H3 | Dead Clerk webhook → account-deletion cleanup gone | **High** (hygiene/privacy) | `[SENSITIVE]` — proposal only |
| M1 | `requireEmailVerification: false` (root enabler of H1) | Medium | `[SENSITIVE]` — proposal only |
| M2 | Schema split: Better Auth `user` vs app `users` table | Medium | `[SENSITIVE]` — proposal only |
| M3 | OAuth `callbackURL` relies entirely on `trustedOrigins`; localhost CORS relaxation if `BETTER_AUTH_URL` unset | Medium | `[SENSITIVE]` — proposal only |
| L1 | CSP `script-src 'unsafe-inline'` | Low/Med | `[SENSITIVE]` — proposal only |
| L2 | CSP missing `frame-ancestors` | Low | **✅ Fixed** |
| L3 | Mount-error fallback wrote `${e}` into `innerHTML` | Low | **✅ Fixed** |
| L4 | Dead `/account/orders` menu link → NotFound | Low | **✅ Fixed** |
| L5 | `public.json` written without conditional put (race) | Low | `[SENSITIVE]` — proposal only |
| O1 | Orphaned Clerk env in sync script + `vite-env.d.ts` (fails closed on deploy) | Low | `[SENSITIVE]` — proposal only |
| O2 | `svix` dep orphaned with the webhook | Low | `[SENSITIVE]` — proposal only |
| O3 | `clerk.ts`/`clerk.js` misnamed (live Better Auth helpers); dead `bearerToken` export | Low | `[SENSITIVE]` — proposal only |
| D1 | Stale docs/comments (README, launchFlags, TODO, wrangler, docs/*) | Low | **Partly fixed** (README, launchFlags); rest proposal |
| D2 | Missing `scripts/generate-indexes.ts` (INDEX.md can't regenerate) | Low | Proposal only |
| D3 | `/api/oracle/card` has no in-repo caller (verify before removing) | Info | Proposal only |

---

## Fixes applied on this branch (safe, reversible)

Each is a small, independently revertable commit. None touch auth, payment, ownership, or deletion logic.

- **L3 — XSS-hardening of the mount fallback.** `index.tsx` no longer interpolates a stringified error into `innerHTML`; it builds the fallback node with `textContent`. (Was unexploitable in practice — `e` is a local exception — but it was the only raw-HTML sink in the SPA.)
- **L2 — `frame-ancestors 'none'`** added to the CSP in `public/_headers` (standards-track clickjacking defense; `X-Frame-Options: DENY` was already present).
- **L4 — removed the dead `/account/orders`** menu item in `components/account/AuthButton.tsx` (no such route exists; orders live on adrianrasmussen.com — it landed on NotFound).
- **D1 (partial) — stale-reference cleanup:** corrected the dev port (`5555` → `2222`) and the `/` landing-route description in `README.md`; rewrote the Clerk-era doc block in `launchFlags.ts` and the `ClerkProvider` comment in `index.tsx` to describe the live Better Auth setup.

Verification: `npm run test:unit` → **159/159 pass**; `tsc --noEmit` clean for all edited files (pre-existing errors remain only in `mcp/oracle-server`, a separate sub-package with its own deps).

---

## Detailed findings

### H1 — Unverified email → stewardship account-takeover `[SENSITIVE]`
**Where:** `lib/account/auth.server.js:53-57` (`emailAndPassword: { requireEmailVerification: false }`); bind path `functions/api/atlas/steward/claim.ts` + `functions/api/atlas/_helpers.ts` (`findStewardsForUser`, email fallback match).
**Exploit:** Admin issues a steward record by email only (the collector is meant to sign in later and bind on first claim). Because password sign-up doesn't verify the email, an attacker registers `victim@example.com`, signs in, and POSTs `steward/claim`. The unbound record is matched **by email** and the attacker's `userId` is written onto it — they're now the bound steward (full read of the piece book/inscriptions/export, can drive consent, request/resolve transfers). The legitimate collector can no longer bind.
**Impact:** Ownership/identity takeover of a physical art piece + collector PII exposure.
**Fix (proposal):** Require a verified email at the **bind** point. Either set `requireEmailVerification: true` for the password provider, or in `claim.ts` reject email-fallback binds unless `data.user.emailVerified === true` (OTP and Google sign-ins are already verified). The check must live at bind time, not just login.

### H2 — No durable rate-limiting `[SENSITIVE]`
**Where:** `lib/account/auth.server.js:33-101` (no `rateLimit` block); no `_middleware.ts` / IP limiter anywhere in `functions/**`; `functions/api/oracle/recommendation.ts:50`.
**Exploit:** (a) `emailOTP.sendVerificationOTP` calls Resend per request → loop it to email-bomb any address / enumerate accounts / burn Resend quota. (b) `emailAndPassword` login is unthrottled → credential stuffing / password spraying. (c) Better Auth's built-in limiter defaults to in-memory, which on Cloudflare Pages Functions does not persist across isolates, so even enabling it without external storage is weak. (d) `POST /api/oracle/recommendation` is unauthenticated when `ORACLE_API_TOKEN` is unset and runs astronomy compute per call → CPU-DoS amplifier.
**Fix (proposal):** Add `rateLimit: { enabled: true, storage: 'database' }` (D1) or a KV-backed custom store with tight per-window limits on the OTP-send and sign-in paths; require `ORACLE_API_TOKEN` (or add a limiter) on the recommendation endpoint. A Cloudflare WAF rate-limiting rule on `/api/auth/*` is the most robust durable layer; consider Turnstile on send-code.

### H3 — Dead Clerk webhook; account-deletion cleanup lost `[SENSITIVE]`
**Where:** `functions/api/clerk/webhook.js` (routable, gated by `CLERK_WEBHOOK_SECRET`). On `user.deleted` it called `deleteUserByClerkId` + a `mutateStewards` unbind (`:53-77`).
**Problem:** Clerk no longer fires webhooks, so this is the only (now-dead) path that cleaned up on account deletion. Deleting a Better Auth account leaves the D1 `users` row and the Atlas steward binding **orphaned** — a real correctness/privacy hole, not just a stale file.
**Fix (proposal):** Re-home the steward-unbind + `users` cleanup onto a Better Auth account-deletion hook (`databaseHooks.user.delete`) or a dedicated `/api/auth/delete-account` Function, **then** delete the webhook and the `svix` dep (O2). Removing the webhook first would erase the reference implementation — keep it until the replacement lands.

### M2 — Two-table identity split `[SENSITIVE]`
**Where:** `migrations/002_better_auth.sql` creates `user`/`session`/`account`/`verification`; `migrations/001_init.sql` + `functions/api/_lib/db.js` use `users` keyed by `clerk_user_id` (which now stores the Better Auth `user.id` via `auth/sync-user.js`).
**Problem:** Identity is duplicated across `user` (Better-Auth-owned) and `users` (app-owned), joined only by convention. It works today but is fragile and undocumented; H3 makes it worse (deletes from `user` orphan `users`). **Fix:** Document the relationship in migration 002 and add a deletion hook/cascade so `users` is cleaned when `user` is removed.

### M3 — OAuth redirect / dev CORS relaxation `[SENSITIVE]`
**Where:** `lib/account/authClient.ts:38-40` (`callbackURL` forwarded unvalidated); `lib/account/auth.server.js:30,38-45` (`trustedOrigins`, `BETTER_AUTH_URL` localhost fallback); `functions/api/_lib/clerk.js:60-69` (`isAllowedOrigin` treats any origin as allowed when `BETTER_AUTH_URL` is unset/localhost).
**Problem:** Open-redirect/CSRF protection rests entirely on `trustedOrigins`. If a deployment ever runs with `BETTER_AUTH_URL` unset, the `http://localhost:2222` fallback flips the dev CORS relaxation on in production. **Fix:** Validate `callbackURL` is a same-site relative path before use; keep `trustedOrigins` strict; never deploy with `BETTER_AUTH_URL` unset (consider failing closed instead of falling back to localhost).

### L1 — CSP `script-src 'unsafe-inline'` `[SENSITIVE]`
**Where:** `public/_headers:7`. `'unsafe-inline'` on `script-src`/`script-src-elem` defeats CSP's primary XSS protection. Low exposure today (no known XSS sink remains after L3), but it removes defense-in-depth. **Fix:** Move to nonce/hash-based script CSP (Vite supports build-time hashing) and drop `'unsafe-inline'` from script directives. Tagged sensitive because tightening can break inline bootstrapping / Cloudflare Insights injection — verify the app still loads. (`/design/*` sub-app inherits this same CSP; confirm it's appropriate there.)

### L5 — `public.json` race `[SENSITIVE]`
**Where:** `functions/api/atlas/_helpers.ts:393-395`. Ledger mutations are etag-guarded via `mutateJsonArray`, but the derived `public.json` is written with a plain `put` (no `onlyIf`). Concurrent writes can leave `public.json` reflecting the losing snapshot until the next write. Self-heals; low write rate. **Fix (optional):** Regenerate from the just-persisted `outcome.next` and guard by ledger version.

### O1–O3 — Migration orphans `[SENSITIVE]`
- **O1:** `scripts/sync-secrets-to-cloudflare.sh:21,31,32,49` still requires `VITE_CLERK_PUBLISHABLE_KEY`/`CLERK_SECRET_KEY`/`CLERK_WEBHOOK_SECRET`; the line-49 guard **fails closed** if they're unset, even though the app no longer needs them. `vite-env.d.ts:5` declares an unused `VITE_CLERK_PUBLISHABLE_KEY`. `docs/secrets-sync.md` and `docs/ledger-successor.md` still list the Clerk secrets as required. **Fix:** Drop the three Clerk vars from the script/guard and docs; add the Better Auth vars; delete the dead type decl. (Left as a proposal because it touches deploy config — verify against the live Pages env first.)
- **O2:** `svix` (`package.json:41`) is imported only by the dead webhook — remove together with H3.
- **O3:** `functions/api/_lib/clerk.ts` and `clerk.js` are **not** orphans — they're parallel TS/JS Better Auth helpers, split by importer (atlas `.ts` Functions use `clerk.ts`; profile/collections/auth `.js` Functions use `clerk.js`). Misleading names only. The `bearerToken` export in each is genuinely dead (no importers). **Fix (scheduled):** Rename both to `auth.ts`/`auth.js` and drop `bearerToken`; touches many importers, so do it deliberately with tests. (The `clerkUserId` / `clerk_user_id` column names are intentionally retained as the generic external-auth-id and are **not** cleanup targets.)

### D1–D3 — Docs / dead routes
- **D1 (partial fix):** README port/route and `launchFlags`/`index.tsx` comments corrected (above). **Still stale (proposal):** `TODO.md:9-10,35` ("Launch sign-in" / "Production login" point at Clerk plans and a broken out-of-repo link `../Adrian-Website/.../clerk-production-launch.md`); the Phase-1b provisioning items (`:40-51`) describe removed Clerk infra and a retired `mandalacodes-oracle` DB — they'd send someone to re-provision Clerk. `wrangler.toml:18-26` prose still describes Clerk (bindings themselves are correct). Left for human review since it's your roadmap.
- **D2:** `INDEX.md` says it's generated by `scripts/generate-indexes.ts`, which **does not exist** on disk or in `package.json` scripts — INDEX.md can't be regenerated as documented. Locate or restore the generator.
- **D3:** `functions/api/oracle/card.ts` has no in-repo caller — likely an OG-meta/MCP endpoint (like `oracle/mcp` and `oracle/search`, which *are* used). Verify it's referenced by an external MCP/OG flow before removing.

---

## Verified clean (no action needed)

- **SQL/D1 injection:** none — every query uses `.prepare()` + `.bind()` with `?n` placeholders, including the one dynamically-sized `IN (...)` clause in `collections/list.js` (placeholders generated from row count; values always bound).
- **Mass assignment:** none — write endpoints use strict field whitelists, server-stamped fields (`actorRef`, prices, hashes, `outreachStatus`), and per-record ownership re-checks.
- **Client XSS:** none — no `dangerouslySetInnerHTML`, no markdown→HTML library; all oracle/Learn/API content renders as React-escaped text; Astro JSON-LD uses escaped `set:html={JSON.stringify(...)}`.
- **Bundled secrets:** none — only the (now-unused) Clerk *publishable* key is referenced client-side; all real secrets are runtime `env` in Functions.
- **Secrets in repo/history:** none — `.env.production` is comment-only; no `sk-`/`re_`/`AKIA`/`GOCSPX`/`-----BEGIN`/`client_secret` literals in tree or `git log --all -S`. Collector PII (`stewards.json`) lives only in R2 + gitignored `backups/`, never in the repo or public build.
- **Atlas authorization:** every steward route enforces `record.clerkUserId === auth.userId` for the specific `(pieceId, editionNumber)` (no IDOR); every admin route calls `requireAdmin` (fail-closed `ADMIN_EMAILS` allowlist); the sale webhook uses HMAC-SHA256 + constant-time compare + ±5-min replay window and only enqueues a *pending* row. Profile/collections endpoints scope every query to the caller's `user.id`.
- **Open redirect / SSRF:** none — `qr/*` redirects target hardcoded hosts with validated/encoded path segments; the only non-static `fetch()` (`_mirror.ts`) is driven entirely by env vars.
- **HTTP headers:** HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `object-src 'none'`, `base-uri 'self'` all present and sound (plus the new `frame-ancestors 'none'`); the only weak directive is `script-src 'unsafe-inline'` (L1).
- **Public surfaces are PII-safe by design:** the GitHub mirror pushes only `toPublicState` (strips emails/names/notes/birth data; pinned by `tests/unit/privacy.test.ts`); `holder-chart` is consent-gated and emits only a non-identifying 8-way trigram element.

---

## Suggested order of work (for the morning)

1. **H1** — gate steward binding on a verified email (highest real risk).
2. **H3 + M2** — re-home account-deletion cleanup onto a Better Auth hook; then remove the dead webhook + `svix`; document the two-table identity model.
3. **H2** — durable rate-limiting (D1/KV store + WAF rule) on `/api/auth/*` and the recommendation endpoint.
4. **O1** — fix the secrets-sync script/guard + docs so deploys don't fail closed on removed Clerk vars.
5. **L1** — tighten CSP off `'unsafe-inline'` (verify app + `/design/*` still load).
6. **O3 + D1/D2/D3** — rename `clerk.*` helpers, drop dead `bearerToken`, finish the doc/TODO cleanup, restore the INDEX generator. Low-risk, do with tests.
</content>
</invoke>

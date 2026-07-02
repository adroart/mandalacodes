# Secrets sync — Infisical → Cloudflare Pages

Mandalacodes uses Infisical as the source of truth for environment values
needed by code (local dev + production). Production runtime reads them
from Cloudflare Pages env vars, so we run a one-line sync to push current
Infisical values into Cloudflare whenever they change.

## When to run this

- After adding a new secret to Infisical that production code needs.
- After rotating a key in Infisical.
- After cloning the repo on a new machine and provisioning Cloudflare for
  the first time.

You do **not** need to run this for changes to plaintext-only Cloudflare
config (like build environment toggles); those live in the dashboard.

## How to run

From the repo root:

```bash
infisical run --env=prod --path=/ -- bash scripts/sync-secrets-to-cloudflare.sh
```

What it does:
1. Asks Infisical for the named secrets in the `prod` environment.
2. For each one, pipes the value into `wrangler pages secret put`.
3. No values are printed or written to disk.

After it finishes, Cloudflare uses the new values on the *next* deploy.
Either push to `main` to auto-deploy, or click "Retry deployment" in the
Pages dashboard for an immediate refresh.

## Which secrets are synced

Edit `scripts/sync-secrets-to-cloudflare.sh` and update the two arrays:

- `PLAINTEXT_VARS` — values that are also exposed at build time (Vite uses
  these via `import.meta.env`). The dashboard shows them as encrypted but
  treat them as if they're public — they ship in the JS bundle anyway.
- `ENCRYPTED_VARS` — true secrets, only read by Cloudflare Functions at
  runtime, never embedded in the client bundle.

Current set (updated 2026-06-16 — auth is self-owned Better Auth, not Clerk):

| Name | Type | Projects | Used by |
|---|---|---|---|
| `BETTER_AUTH_SECRET` | encrypted | mandalacodes | Better Auth session signing (32+ random chars) |
| `BETTER_AUTH_URL` | plaintext | mandalacodes | Deployed origin, e.g. `https://mandalacodes.com` (must be set in prod) |
| `RESEND_API_KEY` | encrypted | mandalacodes | Sends the email sign-in code |
| `RESEND_FROM_EMAIL` | plaintext | mandalacodes | Verified sender for the sign-in code email |
| `GOOGLE_CLIENT_ID` | plaintext | mandalacodes | "Continue with Google" OAuth (public by design) |
| `GOOGLE_CLIENT_SECRET` | encrypted | mandalacodes | Google OAuth client secret |
| `ORACLE_API_TOKEN` | encrypted | mandalacodes | Optional bearer gating /api/oracle/recommendation (rate-limited when unset) |
| `ADMIN_EMAILS` | plaintext | mandalacodes | Admin allowlist for /admin/atlas |
| `SALE_WEBHOOK_SECRET` | encrypted | **both** | HMAC-SHA256 verification of sale webhooks from adrianrasmussen.com; mandalacodes verifies, adrianrasmussen.com signs. Same value on both projects. Generate with `openssl rand -hex 32`. See `todo/handoff/adrian-website/sale-webhook-spec.md`. |
| `CLAIM_BRIDGE_SECRET` | encrypted | **both** | HMAC-SHA256 verification of the contested-claim bridge (`functions/api/atlas/claim-bridge.ts`): adrianrasmussen.com signs the request, mandalacodes verifies. Same value on both projects. Distinct from `SALE_WEBHOOK_SECRET` — do not reuse it. Generate with `openssl rand -hex 32`. |
| `GITHUB_MIRROR_TOKEN` | encrypted | mandalacodes | Fine-grained GitHub PAT (Contents: Read/Write) for the public `public.json` mirror. Together with the two vars below, activates the durability mirror in `functions/api/atlas/_mirror.ts`. |
| `GITHUB_MIRROR_REPO` | plaintext | mandalacodes | `owner/repo` of the public mirror repository (e.g. `technicianofthesacred/adrian-atlas-mirror`). |
| `GITHUB_MIRROR_PATH` | plaintext | mandalacodes | Path inside the mirror repo (e.g. `atlas/public.json`). Only `public.json` is ever mirrored — never the ledger or stewards files. |

The sync script `[skip]`s any var with no value in Infisical, so an
unconfigured optional var (e.g. `ORACLE_API_TOKEN`, `GOOGLE_*` before Google
sign-in is wired) is simply skipped rather than erroring. The required-vars
preflight only insists on `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and
`ADMIN_EMAILS`.

`ATLAS_BUCKET` and the D1 binding are configured in `wrangler.toml`, not
via env vars, and need no sync.

## Why not just put values in the dashboard

Two reasons:
1. Infisical is also the source for local dev (`infisical run -- npm run dev`).
   Keeping both in sync is one less place to drift.
2. The dashboard shows values once and then hides them. Lose the page, lose
   the value. Infisical is the recoverable home.

But the dashboard *is* fine as a fallback.

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

Current set (2026-05-28):

| Name | Type | Used by |
|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | plaintext | Clerk widget on /admin, /atlas/claim |
| `CLERK_SECRET_KEY` | encrypted | Clerk JWT verification in Functions |
| `ADMIN_EMAILS` | plaintext | Admin allowlist for /admin/atlas |

`ATLAS_BUCKET` and the D1 binding are configured in `wrangler.toml`, not
via env vars, and need no sync.

## Why not just put values in the dashboard

Two reasons:
1. Infisical is also the source for local dev (`infisical run -- npm run dev`).
   Keeping both in sync is one less place to drift.
2. The dashboard shows values once and then hides them. Lose the page, lose
   the value. Infisical is the recoverable home.

But the dashboard *is* fine as a fallback. The Clerk vars Adrian set up on
2026-05-28 went directly into the dashboard, not Infisical. The next
rotation is the natural moment to migrate them, not an urgent task.

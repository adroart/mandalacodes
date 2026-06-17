# HANDOFF

## State
Security audit + full remediation done on branch `claude/trusting-johnson-0yqtcx`, pushed, open as PR #54 → `main` (not yet merged). `main` auto-deploys to production on merge.

- **Works (committed + validated):** H1 verified-email steward bind; H2 D1 rate-limiter (fail-open) on `/api/auth/*` + `oracle/recommendation`; H3/M2 dead Clerk webhook removed, deletion-cleanup re-homed to Better Auth hook, two-table model documented; M3 OAuth `callbackURL` + CORS fail-closed; L1 CSP hash (no `unsafe-inline`); L2/L3/L4 headers/innerHTML/dead-link; O1/O3 Clerk env + `_lib/clerk`→`_lib/auth` rename (29 importers) + dead `bearerToken` gone; D1/D2 docs. Full report: `docs/security-audit-2026-06-16.md`.
- **Stubbed/gated:** account deletion is wired but OFF unless `ENABLE_ACCOUNT_DELETION=true` (shared `adrian-website` DB — needs art-site review first).
- **Untested at runtime:** `functions/` aren't in the default typecheck or unit tests — validated via dedicated tsc, esbuild bundle-checks, a Better Auth construct smoke test, and `vite build` (CSP hash confirmed). No live Workers run / no preview-deploy verification yet.
- **Deferred:** L5 `public.json` write race (low, self-heals) — see report.
- Local checks green: 159/159 unit tests, SPA typecheck clean, `vite build` OK.

## Next
Merge PR #54 in the cloud app (this triggers the prod deploy).
git checkout main
git pull origin main
npx wrangler d1 migrations apply adrian-website --remote
infisical run --env=prod --path=/ -- bash scripts/sync-secrets-to-cloudflare.sh
Confirm `BETTER_AUTH_URL` is set in Cloudflare Pages env (CORS now fails closed without it).
Do NOT set `ENABLE_ACCOUNT_DELETION` until the shared-DB cascade is reviewed with adrianrasmussen.com.
Verify on the deploy: email-code sign-in, Google sign-in, and a steward claim (unverified-password sessions now get a 403 asking to verify email — that's H1).

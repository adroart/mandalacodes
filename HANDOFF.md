# HANDOFF

## State
The Living Art Legacy build (M0–M5 + docs + final review) is complete on branch `claude/gallant-faraday-kb2y28`, open as PR #28. 159/159 unit tests green; `npm run typecheck` and `npm run build` clean. 11 commits pushed.

**What works (code-complete, tested, runs locally):**
- Hash-chained ledger with concurrency-safe R2 writes, chain-content invariant enforced (no PII in hashed payloads), backdated-event guard, attribution (`actorRef`).
- Public piece page `/piece/:pieceId[/:edition]` + `/qr/piece/*` redirect; zero-signup story view.
- Founding Lights: permanent claim-order ordinal per piece, all series.
- Two-phase consent claim flow (one active Ring 2 map question), claim ritual, retro-consent, country-only placement.
- Ring 1 living book: salted-commitment inscriptions, time capsules, heir hints, audited transfers, holder export (JSON + print).
- Sale bridge (HMAC webhook → admin-confirmed queue) + self-serve claim requests with anti-takeover routing.
- Ring 3 consent-gated kinship + holder-chart attach (element-only, non-identifying) + "the piece writes back" letters (kin-claim, anniversary, transfer).
- Public mirror carries `public.json` + per-piece `chainTips` (tamper-evidence). Backup script covers all five R2 keys.

**What's stubbed / dormant until ops steps:**
- Sale-queue and inscription endpoints return graceful 503 until the D1 migration `todo/handoff/adrian-website/003_atlas_legacy.sql` is applied (must be run from the Adrian-Website repo — it owns the shared schema).
- Sale webhook returns 503 until `SALE_WEBHOOK_SECRET` is set on both Pages projects.
- Public GitHub mirror inactive until `GITHUB_MIRROR_*` env vars are set.
- Adrian-Website webhook sender not implemented (spec: `todo/handoff/adrian-website/sale-webhook-spec.md`).
- No email delivery — letters live in-app only by design.

**What's untested / flagged (from final review, non-blocking):**
- `steward/update.ts` consent-then-event ordering: a 409 (only after an admin forward-dates a chain tip) can leave consent/map momentarily out of sync until retry.
- `resolve-claim-request` cross-object TOCTOU (two R2 objects, no spanning lock) — negligible at human pace.
- Edition-key convention split (`?? undefined` for steward match vs `?? 0` for chain/letters) — admin-error-only collision.
- Post-secondary-sale holder shows as "a previous steward" in generation attribution (cosmetic, never PII).
- No end-to-end/integration tests against live R2/D1; unit tests only.

## Next
- Decide whether to subscribe to PR #28 activity (CI + review comments) — run `subscribe_pr_activity` for the PR, or leave it to manual review.
- Review PR #28: https://github.com/technicianofthesacred/mandalacodes/pull/28
- Merge the branch once reviewed.
- Copy `todo/handoff/adrian-website/003_atlas_legacy.sql` into the Adrian-Website repo's `migrations/`, then from that checkout: `wrangler d1 migrations apply adrian-website --remote`
- Generate the webhook secret: `openssl rand -hex 32` — set `SALE_WEBHOOK_SECRET` on both Cloudflare Pages projects (mandalacodes + Adrian-Website).
- Implement the Adrian-Website webhook sender per `todo/handoff/adrian-website/sale-webhook-spec.md`.
- Set `GITHUB_MIRROR_TOKEN` / `GITHUB_MIRROR_REPO` / `GITHUB_MIRROR_PATH` on Cloudflare Pages to activate the public mirror.
- Run a baseline backup once: `npm run backup:atlas`
- Claim light #1, then begin collector outreach — full sequence in `todo/handoff/MORNING-AFTER.md`.

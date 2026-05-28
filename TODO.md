# TODO — Mandala Codes

Living list of what's outstanding on the oracle. Loose priority order — top items block more than bottom items.

## Soon

- [ ] **Smoke-test Clerk auth on production.** PR #5 merged 2026-05-28. Need to create the Clerk app at clerk.com (name: `mandalacodes`, enable Google + email), copy the publishable + secret keys, add three env vars to Cloudflare Pages → mandalacodes → Settings → Environment variables → Production: `VITE_CLERK_PUBLISHABLE_KEY` (plaintext), `CLERK_SECRET_KEY` (encrypted), `ADMIN_EMAILS=sccsclothing@gmail.com` (plaintext). Then trigger a redeploy and sign in at `/admin/login`. Until the env vars are saved, `/admin/atlas` and `/atlas/claim` show broken Clerk widgets; `/atlas` itself keeps working.

- [ ] **Delete obsolete env vars after Clerk smoke test passes.** Once Clerk auth is verified working, remove `ATLAS_ADMIN_PASSWORD_HASH` and `ATLAS_STEWARD_SECRET` from Cloudflare Pages → mandalacodes → Settings → Environment variables. They're no longer referenced anywhere in the code. `ATLAS_PUBLIC_ONLY_IN_DEV=false` stays (reserved for future use).

- [ ] **Reprint physical cards with `mandalacodes.com/qr/:n` QR codes.** New plaques should encode the new domain directly (one redirect hop instead of two). The old plaques (encoded `adrianrasmussen.com/qr/:n`) keep working forever via the redirect on the art site — so this is an upgrade for new print runs, not a fix. Regenerate via `npm run generate:qr` (BASE_URL is already set to mandalacodes.com in `scripts/generate-ul-qr.ts`).

- [ ] **Merge PR #110 on Adrian-Website** ([link](https://github.com/technicianofthesacred/Adrian-Website/pull/110)) — adds the redirect from `adrianrasmussen.com/qr/:n` (printed plaques) → `mandalacodes.com/universal-language/:n`. Until this merges, scanned plaques still land on the old oracle inside the art site (which works, just goes to the old home). PR is open, mergeable, Cloudflare preview build passed.

- [ ] *(optional polish)* **Set up apex-canonical redirect** for `www.mandalacodes.com` → `mandalacodes.com` via a Cloudflare Bulk Redirect rule. Both URLs work today; this just picks one canonical form for SEO.

### ✅ Done

- ~~Activate `www.mandalacodes.com` as a second custom domain~~ — done 2026-05-23, serves correctly.
- ~~Connect GitHub to Cloudflare Pages for auto-deploy~~ — done 2026-05-23, every push to `main` auto-builds and deploys.

## Phase 1b — Accounts

- [ ] **Merge the accounts/birthdate-energy branch** from Adrian-Website (`origin/claude/oracle-energy-birthdate-4HS3f`) into mandalacodes. Brings Clerk sign-up, hologenetic profile, today/year energy panels. Needs a fresh Clerk instance for the mandalacodes domain (publishable keys are domain-locked). D1 database is already provisioned (`mandalacodes-oracle`, APAC region) and wired in `wrangler.toml`, awaiting the schema.

## Cleanup on the art site (separate PR, not urgent)

- [ ] **Remove dead oracle code from Adrian-Website** after the redirect PR (#110) lands. Components (`OracleGateway`, `UniversalLanguageCard`, etc.), the oracle data files, the `vite.config.ts` OG-page generation plugin, the oracle entry in the Creations grid, the launch flag entry. Touches the route table and nav — worth its own review window.

## Future ("home for all things mandala")

- [ ] **Light Codes deck.** Route shape is already reserved (`/light-codes/*`). Content lives in `Coding/_archive/light-codes/` and needs integration work.

- [ ] **Articles / writing section.** Mandalacodes is meant to become a wisdom hub, not just a deck reader. Route shape TBD (`/writings/*`? `/articles/*`?). Content authoring approach TBD.

- [ ] **Additional decks beyond Universal Language + Light Codes** as they emerge.

## Operational notes (not TODOs — context for future-you)

- The QR Function on adrianrasmussen.com (`functions/qr/[number].js`) must live forever — printed plaques depend on it. Treat the old domain's QR Function as permanent infrastructure even after every other oracle thing is stripped from the art site.

- All physical-piece sales process through adrianrasmussen.com (one Stripe account, one inventory). "View the original" CTAs on mandalacodes card pages link out — no checkout flow lives here. This is intentional cross-pollination.

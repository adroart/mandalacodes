# TODO — Mandala Codes

Living list of what's outstanding on the oracle. Loose priority order — top items block more than bottom items.

## Soon

- [ ] **Reprint physical cards with `mandalacodes.com/qr/:n` QR codes.** New plaques should encode the new domain directly (one redirect hop instead of two). The old plaques (encoded `adrianrasmussen.com/qr/:n`) keep working forever via the redirect on the art site — so this is an upgrade for new print runs, not a fix. Regenerate via `npm run generate:qr` (BASE_URL is already set to mandalacodes.com in `scripts/generate-ul-qr.ts`).

- [ ] **Activate `www.mandalacodes.com`** as a second custom domain in the Cloudflare Pages dashboard, then set up an apex-canonical bulk redirect (www → bare apex).

- [ ] **Connect this GitHub repo to the Cloudflare Pages project** so pushes to `main` auto-deploy. Currently deploys are CLI-driven via `wrangler pages deploy`. Five clicks in the dashboard: Pages → mandalacodes → Settings → Builds & deployments → Connect to Git → pick `technicianofthesacred/mandalacodes` / branch `main` / build command `npm run build` / output `dist`.

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

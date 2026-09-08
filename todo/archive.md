## 2026-09-08
- [x] Give the mobile test suite a `webServer` so it stops reading as broadly red — `playwright.config.ts` now boots `vite --port <PLAYWRIGHT_BASE_URL's port>` (default 2222) before any spec runs, and also runs `npm run build:content` once if `public/learn` is missing (the two `/learn` specs 404'd without it). Wired `test:mobile` into CI as its own job (`.github/workflows/test.yml`, Chromium only, uploads `test-results/` on failure). True baseline measured on a clean run: 67 passed, 9 skipped, 38 failed/timed-out out of 114 (was: every spec failing on connection-refused). See TODO.md "Found in the 2026-09-08 mobile suite audit" for what the 38 failures actually are — most trace to one 2026-07-20 redesign, not new regressions. Branch `claude/mobile-suite-server`.

## 2026-08-20
- [x] Give the empty Atlas its own line of copy — shipped: wall, ledger, and registry now show "the sky is waiting for its first light." when the ledger is truly empty; "Nothing matches. Loosen a filter." only appears when filters reduced a non-empty set. Wording is Adrian's to retune.

## 2026-09-08 · Design section opening sweep (PR #180)

- [x] The Design section repeats one opening on 51 of the 64 cards, the same fault just fixed everywhere else _(band: agent-runnable)_ _(effort: deep)_
  "Where this drive lives in..." across three variants. The I-Ching, Body and Relations sections were cleaned on 2026-09-01 and measure zero; Design was outside that scope and was never swept. The method that worked is written down in [_DIVERSIFY_PASS_THREE.md](oracle/sections/_DIVERSIFY_PASS_THREE.md) and [_DIVERSIFY_PASS_FOUR.md](oracle/sections/_DIVERSIFY_PASS_FOUR.md): ban stems not phrases, and give every agent the test "would this sentence work unchanged on another card".

- [x] Two formulas left standing in the Design section after the 2026-09-02 opening sweep _(band: agent-runnable)_ _(effort: moderate)_
  "That placement is the teaching" closes Where it lives on 31 cards, and "This code is the ..." opens The drive on 21. Both are over the five-card threshold. The method that clears them is in [oracle/sections/_DIVERSIFY_PASS_THREE.md](oracle/sections/_DIVERSIFY_PASS_THREE.md) and [_DIVERSIFY_PASS_FOUR.md](oracle/sections/_DIVERSIFY_PASS_FOUR.md): ban the stem, not the phrase.
  Done 2026-09-08: 35 Drive openings on the "This code is the" stem rewritten card by card, the 21 "That placement is the teaching" signposts removed, the 5 "On its own this" openings varied. Prose lint reports no repeated opening stem in any lens.

## 2026-06-14
- [<] Publish the four Phase 1 SEO articles (what is mandala art, sacred geometry, laser-cut wooden mandalas, commissioning a mandala)   → Plan: [docs/research/seo/2026-05-28-article-cluster-plan.md](docs/research/seo/2026-05-28-article-cluster-plan.md) _(parked → TODO.md)_
- [<] Build the /about stance page and the /artists hub with Adrian's first featured artist page   → Plan: [docs/research/seo/2026-05-28-article-cluster-plan.md](docs/research/seo/2026-05-28-article-cluster-plan.md) _(parked → TODO.md)_
- [<] Publish the Phase 2 editorial-depth articles and the Phase 3 symbolism glossary   → Plan: [docs/research/seo/2026-05-28-article-cluster-plan.md](docs/research/seo/2026-05-28-article-cluster-plan.md) _(parked → TODO.md)_
- [<] Click through the interconnection branch on a preview deploy (card Relations seats, atlas deep links, birth-place marker, steward picker) before merging   → Plan: [interconnection-followups.md](todo/plans/interconnection-followups.md) § Verify _(parked → TODO.md)_
- [<] Do the Phase 2 personal pass on the 63 scaffold RELATIONS files — they now render live on every card's Relations panel   → Plan: [interconnection-followups.md](todo/plans/interconnection-followups.md) § Content _(parked → TODO.md)_
- [<] Provision Clerk for the accounts surface and decide one-app-vs-two: `accounts-branch.md` implies a fresh instance separate from admin sign-in, but the code reads a single key set (`VITE_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY`)   → Plan: [accounts-branch.md](todo/plans/accounts-branch.md) _(parked → TODO.md)_
- [<] Bring sign-up and the energy panels over from Adrian-Website   → Plan: [accounts-branch.md](todo/plans/accounts-branch.md) _(parked → TODO.md)_
- [<] Deploy the hosted oracle Functions (`/api/oracle/{search,card,mcp,recommendation}`) by merging to main; optionally set `ORACLE_MCP_TOKEN` / `ORACLE_API_TOKEN` to gate the remote MCP and the recommendation API   → Plan: [docs/oracle-remote-mcp-plan.md](docs/oracle-remote-mcp-plan.md) _(parked → TODO.md)_
- [<] (Optional) Add embeddings via Workers AI + Vectorize if the concept ontology misses real queries   → Plan: [docs/oracle-remote-mcp-plan.md](docs/oracle-remote-mcp-plan.md) _(parked → TODO.md)_
- [<] Reprint the physical cards so the QR codes point at the new mandalacodes.com domain _(parked → TODO.md)_
- [<] Launch sign-in on the live Mandala Codes site   → Plan: [clerk-launch.md](todo/plans/clerk-launch.md) _(parked → TODO.md)_
- [<] Close Adrian-Website PR #110 in favour of the newer PR #113   → PRs: [#110](https://github.com/adroart/Adrian-Website/pull/110), [#113](https://github.com/adroart/Adrian-Website/pull/113) _(parked → TODO.md)_
- [<] Pick the canonical web address: redirect www to the bare domain for SEO _(parked → TODO.md)_
- [<] Decide what to do with the leftover local atlas/Clerk work branch and its uncommitted files _(parked → TODO.md)_
- [<] Start writing the 384 changing-line texts for the oracle via `/cast-content`   → PR: [#6](https://github.com/adroart/mandalacodes/pull/6) _(parked → TODO.md)_
- [<] Take mandalacodes login to production with its OWN free Clerk instance (own domain + DNS + Google OAuth), still pointed at the shared `adrian-website` D1 so collectors stay unified. NO paid satellite.   → Plan: [clerk-production-launch.md](../Adrian-Website/todo/plans/clerk-production-launch.md) § D _(parked → TODO.md)_
- [<] Apply the D1 schema to the remote database: `wrangler d1 migrations apply mandalacodes-oracle --remote` (until then every account Function returns `503 db_not_configured`)   → Schema: [migrations/001_init.sql](migrations/001_init.sql) _(parked → TODO.md)_
- [<] Set the Clerk env vars on Cloudflare Pages, including `CLERK_WEBHOOK_SECRET` (now wired into the secrets-sync script + doc)   → Plan: [docs/secrets-sync.md](docs/secrets-sync.md) _(parked → TODO.md)_
- [<] Register the Clerk webhook endpoint `https://mandalacodes.com/api/clerk/webhook` for `user.created` / `user.updated` / `user.deleted` _(parked → TODO.md)_
- [<] Flip `LAUNCH_FLAGS.accounts` and `LAUNCH_FLAGS.hologeneticProfile` to true once the infra above is live, then verify sign-up → D1 row, profile round-trip, and `user.deleted` cascade   → File: [launchFlags.ts](launchFlags.ts) _(parked → TODO.md)_
- [<] Decide whether to commit the full deep-pass rewrite for the remaining 61 I Ching and Body cards   → Plan: [oracle/TODO.md](oracle/TODO.md) _(parked → TODO.md)_
- [<] Write invocations for cards 2 to 64 (Adrian's own voice, not delegable)   → Plan: [oracle/TODO.md](oracle/TODO.md) _(parked → TODO.md)_
- [<] Do the Phase 2 personal pass on the Gene Keys and Human Design scaffolds to take each card to final   → Plan: [oracle/TODO.md](oracle/TODO.md) _(parked → TODO.md)_
- [<] Build the acquire detail section and configurator (sizes, editions) on the buy sheet   → Plan: [oracle/TODO.md](oracle/TODO.md) _(parked → TODO.md)_
- [<] Verify all 64 artwork images (Cloudinary URL, correct piece, filename, alt text)   → Plan: [oracle/TODO.md](oracle/TODO.md) _(parked → TODO.md)_
- [<] Retire the legacy oracle data files once every overlay fully covers its content   → Plan: [oracle/TODO.md](oracle/TODO.md) _(parked → TODO.md)_
- [<] Build the OracleSystems lineage page and the network UI (map of placed sculptures plus holder profiles)   → Plan: [oracle/TODO.md](oracle/TODO.md) _(parked → TODO.md)_
- [<] Do the full whole-deck review of all 64 cards against the writing method, then launch   → Plan: [oracle/TODO.md](oracle/TODO.md) _(parked → TODO.md)_
- [<] Wire the Adrian Rasmussen quote system to `POST /api/oracle/recommendation` (chart/birth → art + energy), then add pricing + purchase + the client page/PDF on that side   → Plan: [todo/plans/adrian-quote-integration.md](todo/plans/adrian-quote-integration.md) _(parked → TODO.md)_
- [<] Register the remote oracle MCP as a Claude custom connector once it's live _(parked → TODO.md)_
- [<] Develop the chart→art lookbook into the site — an admin/client flow to generate a personalized lookbook (compute from birth data or upload), with the recommendation step, replacing the CLI   → Tool: [scripts/chart-lookbook/README.md](scripts/chart-lookbook/README.md) _(parked → TODO.md)_
- [<] Write per-artwork readings into `oracle/readings/` over time (UL-122 is the reference)   → Spec: [oracle/readings/README.md](oracle/readings/README.md) _(parked → TODO.md)_
- [<] Integrate the Light Codes deck (route is reserved, content lives in the archive) _(parked → TODO.md)_
- [<] Add more decks beyond Universal Language and Light Codes as they emerge _(parked → TODO.md)_
- [<] Make Mandala Codes the go-to mandala authority site (multi-phase content, outreach, and press campaign)   → Plan: [mandala-authority.md](todo/plans/mandala-authority.md) _(parked → TODO.md)_

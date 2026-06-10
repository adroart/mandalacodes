# TODO: Mandala Codes

Living list of what's outstanding on the oracle. Loose priority order, top items block more than bottom items.

## Soon

- [ ] Reprint the physical cards so the QR codes point at the new mandalacodes.com domain _(band: you-required)_ _(effort: quick)_
- [ ] Launch sign-in on the live Mandala Codes site _(band: you-required)_ _(effort: deep)_ → Plan: [clerk-launch.md](todo/plans/clerk-launch.md)
- [ ] Close Adrian-Website PR #110 in favour of the newer PR #113 _(band: you-required)_ _(effort: quick)_ → PRs: [#110](https://github.com/technicianofthesacred/Adrian-Website/pull/110), [#113](https://github.com/technicianofthesacred/Adrian-Website/pull/113)
- [ ] Pick the canonical web address: redirect www to the bare domain for SEO _(band: you-required)_ _(effort: quick)_
- [ ] Decide what to do with the leftover local atlas/Clerk work branch and its uncommitted files _(band: you-required)_ _(effort: moderate)_
- [ ] Start writing the 384 changing-line texts for the oracle via `/cast-content` _(band: you-required)_ _(effort: deep)_ → PR: [#6](https://github.com/technicianofthesacred/mandalacodes/pull/6)
- [ ] Click through the interconnection branch on a preview deploy (card Relations seats, atlas deep links, birth-place marker, steward picker) before merging _(band: you-required)_ _(effort: quick)_ → Plan: [interconnection-followups.md](todo/plans/interconnection-followups.md) § Verify

### Done

- ~~Activate `www.mandalacodes.com` as a second custom domain~~, done 2026-05-23, serves correctly.
- ~~Connect GitHub to Cloudflare Pages for auto-deploy~~, done 2026-05-23, every push to `main` auto-builds and deploys.

## Phase 1b: Accounts

**Status update 2026-06-09:** shared dev login is now LIVE. accounts flag is on, the D1 binding points at the shared `adrian-website` database (the old `mandalacodes-oracle` DB is retired), and the dev Clerk app is shared with adrianrasmussen.com. The remaining provisioning items below are superseded by the production launch item.

- [ ] Take mandalacodes login to production with its OWN free Clerk instance (own domain + DNS + Google OAuth), still pointed at the shared `adrian-website` D1 so collectors stay unified. NO paid satellite. _(band: you-required)_ _(effort: deep)_ → Plan: [clerk-production-launch.md](../Adrian-Website/todo/plans/clerk-production-launch.md) § D

The original provisioning steps (now mostly done in dev; kept for the production pass):

- [ ] Apply the D1 schema to the remote database: `wrangler d1 migrations apply mandalacodes-oracle --remote` (until then every account Function returns `503 db_not_configured`) _(band: you-required)_ _(effort: quick)_ → Schema: [migrations/001_init.sql](migrations/001_init.sql)
- [ ] Provision Clerk for the accounts surface and decide one-app-vs-two: `accounts-branch.md` implies a fresh instance separate from admin sign-in, but the code reads a single key set (`VITE_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY`) _(band: you-required)_ _(effort: moderate)_ → Plan: [accounts-branch.md](todo/plans/accounts-branch.md)
- [ ] Set the Clerk env vars on Cloudflare Pages, including `CLERK_WEBHOOK_SECRET` (now wired into the secrets-sync script + doc) _(band: you-required)_ _(effort: quick)_ → Plan: [docs/secrets-sync.md](docs/secrets-sync.md)
- [ ] Register the Clerk webhook endpoint `https://mandalacodes.com/api/clerk/webhook` for `user.created` / `user.updated` / `user.deleted` _(band: you-required)_ _(effort: quick)_
- [ ] Flip `LAUNCH_FLAGS.accounts` and `LAUNCH_FLAGS.hologeneticProfile` to true once the infra above is live, then verify sign-up → D1 row, profile round-trip, and `user.deleted` cascade _(band: you-required)_ _(effort: moderate)_ → File: [launchFlags.ts](launchFlags.ts)
- [ ] Bring sign-up and the energy panels over from Adrian-Website _(band: you-required)_ _(effort: deep)_ → Plan: [accounts-branch.md](todo/plans/accounts-branch.md)

### Done

- ~~Decouple `ClerkProvider` from the accounts launch flag~~, branch `claude/migration-completion-requirements-eaDFz`, 2026-06-02. Provider now mounts whenever a Clerk key is present so admin sign-in + atlas steward pages stop throwing "must be wrapped in ClerkProvider"; the accounts flag gates the public surface via `available`. Also fixed stale Stripe comments, the `wrangler.toml` "no tables yet" note, and the missing `CLERK_WEBHOOK_SECRET` in the secrets-sync script/doc.
- ~~Remove dead oracle code from Adrian-Website~~, Adrian-Website PR #113 ([link](https://github.com/technicianofthesacred/Adrian-Website/pull/113)), 2026-05-29. Deletes all oracle components / data / scripts / assets, replaces `/oracle` with a directory page that links to mandalacodes, 301-redirects every old card URL via `_redirects`. Awaiting merge.

## Oracle deck content (Universal Language)

- [ ] Decide whether to commit the full deep-pass rewrite for the remaining 61 I Ching and Body cards _(band: you-required)_ _(effort: deep)_ → Plan: [oracle/TODO.md](oracle/TODO.md)
- [ ] Write invocations for cards 2 to 64 (Adrian's own voice, not delegable) _(band: you-required)_ _(effort: deep)_ → Plan: [oracle/TODO.md](oracle/TODO.md)
- [ ] Do the Phase 2 personal pass on the Gene Keys and Human Design scaffolds to take each card to final _(band: you-required)_ _(effort: deep)_ → Plan: [oracle/TODO.md](oracle/TODO.md)
- [ ] Do the Phase 2 personal pass on the 63 scaffold RELATIONS files — they now render live on every card's Relations panel _(band: you-required)_ _(effort: deep)_ → Plan: [interconnection-followups.md](todo/plans/interconnection-followups.md) § Content
- [ ] Build the acquire detail section and configurator (sizes, editions) on the buy sheet _(band: agent-runnable)_ _(effort: moderate)_ → Plan: [oracle/TODO.md](oracle/TODO.md)
- [ ] Verify all 64 artwork images (Cloudinary URL, correct piece, filename, alt text) _(band: agent-runnable)_ _(effort: moderate)_ → Plan: [oracle/TODO.md](oracle/TODO.md)
- [ ] Retire the legacy oracle data files once every overlay fully covers its content _(band: agent-runnable)_ _(effort: moderate)_ → Plan: [oracle/TODO.md](oracle/TODO.md)
- [ ] Build the OracleSystems lineage page and the network UI (map of placed sculptures plus holder profiles) _(band: agent-runnable)_ _(effort: deep)_ → Plan: [oracle/TODO.md](oracle/TODO.md)
- [ ] Do the full whole-deck review of all 64 cards against the writing method, then launch _(band: you-required)_ _(effort: deep)_ → Plan: [oracle/TODO.md](oracle/TODO.md)

### Done

- ~~Wire the Relations overlay into the live card~~, branch `claude/interconnection-architecture-review-z9vmtw`, 2026-06-10. All 64 RELATIONS files now feed every seat of the Relations panel (pair, inverse, partner, ring, tarot, zodiac, Immortal, Hebrew letter).
- ~~Show a "no moving lines, the hexagram is stable" message when a cast produces no moving lines~~, same branch, 2026-06-10.

## Interconnection (four pillars)

The June 2026 structural review wired the deck ↔ atlas ↔ profile ↔ reading bridges; full write-up of what shipped and what remains: [interconnection-followups.md](todo/plans/interconnection-followups.md).

- [ ] Wire Collections into the card pages (save a card near Acquire/Share; "my collected cards on the atlas" view) _(band: agent-runnable)_ _(effort: moderate)_ → Plan: [interconnection-followups.md](todo/plans/interconnection-followups.md)
- [ ] Dedupe the sphere metadata (PROFILE_POSITIONS vs SPHERES) and the 11-key ProfileKey lists across profile.ts / put.js _(band: agent-runnable)_ _(effort: quick)_ → Plan: [interconnection-followups.md](todo/plans/interconnection-followups.md)
- [ ] Extract one shared city-picker component for AdminAtlas and StewardEdit _(band: agent-runnable)_ _(effort: quick)_ → Plan: [interconnection-followups.md](todo/plans/interconnection-followups.md)
- [ ] Surface the kinship-arc cap ("showing X of Y") in the atlas filters row _(band: agent-runnable)_ _(effort: quick)_ → Plan: [interconnection-followups.md](todo/plans/interconnection-followups.md)
- [ ] Add a "Map your birth chart" link to the Gateway so QR scanners find the profile _(band: agent-runnable)_ _(effort: quick)_ → Plan: [interconnection-followups.md](todo/plans/interconnection-followups.md)
- [ ] Unify the last two hexagram renderers (Gateway orbital, CoinCast animated) onto the shared glyph module — needs visual QA _(band: agent-runnable)_ _(effort: moderate)_ → Plan: [interconnection-followups.md](todo/plans/interconnection-followups.md)
- [ ] Make the CoinCast "becoming" reading per-hexagram instead of one generic sentence _(band: you-required)_ _(effort: deep)_ → Plan: [interconnection-followups.md](todo/plans/interconnection-followups.md) § Content

## Oracle MCP, search & personalization

Framework built on branch `claude/oracle-mcp-artwork-readings-MMa1k` (pending merge): a local MCP server, a shared query layer with concept-expansion search (live on the deck index), the artwork↔code link + an authored-reading layer, staged hosted search + remote-MCP Functions, and a chart→art lookbook generator. Plans: [docs/oracle-mcp-integration-plan.md](docs/oracle-mcp-integration-plan.md), [docs/oracle-remote-mcp-plan.md](docs/oracle-remote-mcp-plan.md).

- [ ] Deploy the hosted oracle Functions (`/api/oracle/{search,card,mcp,recommendation}`) by merging to main; optionally set `ORACLE_MCP_TOKEN` / `ORACLE_API_TOKEN` to gate the remote MCP and the recommendation API _(band: you-required)_ _(effort: quick)_ → Plan: [docs/oracle-remote-mcp-plan.md](docs/oracle-remote-mcp-plan.md)
- [ ] Wire the Adrian Rasmussen quote system to `POST /api/oracle/recommendation` (chart/birth → art + energy), then add pricing + purchase + the client page/PDF on that side _(band: you-required)_ _(effort: deep)_ → Plan: [todo/plans/adrian-quote-integration.md](todo/plans/adrian-quote-integration.md)
- [ ] Register the remote oracle MCP as a Claude custom connector once it's live _(band: you-required)_ _(effort: quick)_
- [ ] Develop the chart→art lookbook into the site — an admin/client flow to generate a personalized lookbook (compute from birth data or upload), with the recommendation step, replacing the CLI _(band: agent-runnable)_ _(effort: deep)_ → Tool: [scripts/chart-lookbook/README.md](scripts/chart-lookbook/README.md)
- [ ] Write per-artwork readings into `oracle/readings/` over time (UL-122 is the reference) _(band: you-required)_ _(effort: deep)_ → Spec: [oracle/readings/README.md](oracle/readings/README.md)
- [ ] (Optional) Add embeddings via Workers AI + Vectorize if the concept ontology misses real queries _(band: agent-runnable)_ _(effort: deep)_ → Plan: [docs/oracle-remote-mcp-plan.md](docs/oracle-remote-mcp-plan.md)

## Future ("home for all things mandala")

- [ ] Integrate the Light Codes deck (route is reserved, content lives in the archive) _(band: agent-runnable)_ _(effort: deep)_
- [ ] Add more decks beyond Universal Language and Light Codes as they emerge _(band: you-required)_ _(effort: deep)_

## Mandala Authority Strategy

- [ ] Make Mandala Codes the go-to mandala authority site (multi-phase content, outreach, and press campaign) _(band: you-required)_ _(effort: deep)_ → Plan: [mandala-authority.md](todo/plans/mandala-authority.md)
- [ ] Publish the four Phase 1 SEO articles (what is mandala art, sacred geometry, laser-cut wooden mandalas, commissioning a mandala) _(band: agent-runnable)_ _(effort: deep)_ → Plan: [docs/research/seo/2026-05-28-article-cluster-plan.md](docs/research/seo/2026-05-28-article-cluster-plan.md)
- [ ] Build the /about stance page and the /artists hub with Adrian's first featured artist page _(band: agent-runnable)_ _(effort: moderate)_ → Plan: [docs/research/seo/2026-05-28-article-cluster-plan.md](docs/research/seo/2026-05-28-article-cluster-plan.md)
- [ ] Publish the Phase 2 editorial-depth articles and the Phase 3 symbolism glossary _(band: agent-runnable)_ _(effort: deep)_ → Plan: [docs/research/seo/2026-05-28-article-cluster-plan.md](docs/research/seo/2026-05-28-article-cluster-plan.md)

## Operational notes (not TODOs: context for future-you)

- The QR Function on adrianrasmussen.com (`functions/qr/[number].js`) must live forever, printed plaques depend on it. Treat the old domain's QR Function as permanent infrastructure even after every other oracle thing is stripped from the art site.

- All physical-piece sales process through adrianrasmussen.com (one Stripe account, one inventory). "View the original" CTAs on mandalacodes card pages link out, no checkout flow lives here. This is intentional cross-pollination.

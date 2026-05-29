# TODO: Mandala Codes

Living list of what's outstanding on the oracle. Loose priority order, top items block more than bottom items.

## Soon

- [ ] Launch sign-in on the live Mandala Codes site _(band: you-required)_ _(effort: deep)_ → Plan: [clerk-launch.md](todo/plans/clerk-launch.md)
- [ ] Reprint the physical cards so the QR codes point at the new mandalacodes.com domain _(band: you-required)_ _(effort: quick)_
- [ ] Close Adrian-Website PR #110 in favour of the newer PR #113 _(band: you-required)_ _(effort: quick)_ → PRs: [#110](https://github.com/technicianofthesacred/Adrian-Website/pull/110), [#113](https://github.com/technicianofthesacred/Adrian-Website/pull/113)
- [ ] Pick the canonical web address: redirect www to the bare domain for SEO _(band: you-required)_ _(effort: quick)_
- [ ] Decide what to do with the leftover local atlas/Clerk work branch and its uncommitted files _(band: you-required)_ _(effort: moderate)_
- [ ] Start writing the 384 changing-line texts for the oracle via `/cast-content` _(band: you-required)_ _(effort: deep)_ → PR: [#6](https://github.com/technicianofthesacred/mandalacodes/pull/6)

### Done

- ~~Activate `www.mandalacodes.com` as a second custom domain~~, done 2026-05-23, serves correctly.
- ~~Connect GitHub to Cloudflare Pages for auto-deploy~~, done 2026-05-23, every push to `main` auto-builds and deploys.

## Phase 1b: Accounts

- [ ] Bring sign-up and the energy panels over from Adrian-Website _(band: you-required)_ _(effort: deep)_ → Plan: [accounts-branch.md](todo/plans/accounts-branch.md)

### Done

- ~~Remove dead oracle code from Adrian-Website~~, Adrian-Website PR #113 ([link](https://github.com/technicianofthesacred/Adrian-Website/pull/113)), 2026-05-29. Deletes all oracle components / data / scripts / assets, replaces `/oracle` with a directory page that links to mandalacodes, 301-redirects every old card URL via `_redirects`. Awaiting merge.

## Oracle deck content (Universal Language)

- [ ] Decide whether to commit the full deep-pass rewrite for the remaining 61 I Ching and Body cards _(band: you-required)_ _(effort: deep)_ → Plan: [oracle/TODO.md](oracle/TODO.md)
- [ ] Write invocations for cards 2 to 64 (Adrian's own voice, not delegable) _(band: you-required)_ _(effort: deep)_ → Plan: [oracle/TODO.md](oracle/TODO.md)
- [ ] Do the Phase 2 personal pass on the Gene Keys and Human Design scaffolds to take each card to final _(band: you-required)_ _(effort: deep)_ → Plan: [oracle/TODO.md](oracle/TODO.md)
- [ ] Wire the Relations overlay into the live card (files exist on disk, not yet rendering) _(band: agent-runnable)_ _(effort: moderate)_ → Plan: [oracle/TODO.md](oracle/TODO.md)
- [ ] Build the acquire detail section and configurator (sizes, editions) on the buy sheet _(band: agent-runnable)_ _(effort: moderate)_ → Plan: [oracle/TODO.md](oracle/TODO.md)
- [ ] Verify all 64 artwork images (Cloudinary URL, correct piece, filename, alt text) _(band: agent-runnable)_ _(effort: moderate)_ → Plan: [oracle/TODO.md](oracle/TODO.md)
- [ ] Retire the legacy oracle data files once every overlay fully covers its content _(band: agent-runnable)_ _(effort: moderate)_ → Plan: [oracle/TODO.md](oracle/TODO.md)
- [ ] Build the OracleSystems lineage page and the network UI (map of placed sculptures plus holder profiles) _(band: agent-runnable)_ _(effort: deep)_ → Plan: [oracle/TODO.md](oracle/TODO.md)
- [ ] Do the full whole-deck review of all 64 cards against the writing method, then launch _(band: you-required)_ _(effort: deep)_ → Plan: [oracle/TODO.md](oracle/TODO.md)
- [ ] Show a "no moving lines, the hexagram is stable" message when a cast produces no moving lines _(band: agent-runnable)_ _(effort: quick)_

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

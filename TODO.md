# TODO: Mandala Codes

Living list of what's outstanding on the oracle. Loose priority order, top items block more than bottom items.

## Go-live ops — ON HOLD 2026-08-09, do not run

**The ownership record moved to the Adrian Rasmussen site.** Adrian ratified on 2026-08-09 that the
registry there is the record of who holds a piece, and that the ceremony layer built here (the four
rings, the dream, letters from the piece, the globe) rehomes onto it. See
[the-collector-journey.md](../Adrian-Website/todo/plans/the-collector-journey.md) and
[the-collector-build.md](../Adrian-Website/todo/plans/the-collector-build.md).

**Every item in this section would write new records into the ledger being retired.** Claiming light
number one in particular is not reversible: it stamps a permanent claim-order number into a chain
that is about to be migrated. Run none of it until the migration lands.

The ledger holds 18 pieces and no real collector exists on either side, which is why the move is
cheap right now and gets more expensive with every claim added.

**What is still worth doing here:** writing the 64 piece stories. Those words are yours, they carry
over unchanged, and they are needed either way.

Exact commands for every item: [todo/handoff/GO-LIVE-RUNBOOK.md](todo/handoff/GO-LIVE-RUNBOOK.md). Check them off in [todo/handoff/MORNING-AFTER.md](todo/handoff/MORNING-AFTER.md)'s status ledger as you go.

- [ ] **Apply the D1 migrations** from the Adrian-Website checkout (003_atlas_legacy + the new 004_piece_content) — read [docs/d1-migrations.md](docs/d1-migrations.md) first, the cross-repo filename collision is real _(you · quick)_
- [ ] **Set the webhook secrets** — generate distinct `SALE_WEBHOOK_SECRET` and `CLAIM_BRIDGE_SECRET`, set on BOTH Pages projects, redeploy _(you · quick)_
- [ ] **Activate the GitHub mirror** — public repo + fine-grained PAT + the three `GITHUB_MIRROR_*` vars; this is the external tamper evidence _(you · quick)_
- [ ] **Baseline backup** — `wrangler login` then `npm run backup:atlas`; move output offline _(you · quick)_
- [ ] **Adrian-Website senders** — copy the drop-in module [todo/handoff/adrian-website/notify-mandalacodes.ts](todo/handoff/adrian-website/notify-mandalacodes.ts) into that repo and call it from checkout success; contract in [sale-webhook-spec.md](todo/handoff/adrian-website/sale-webhook-spec.md) _(you or an agent session scoped to that repo · quick)_
- [ ] **Claim light #1** — the ignition ritual: your own steward record, the map yes, the first inscription. Not delegable _(you · quick)_
- [ ] **Collector outreach** — the roster funnel in AdminAtlas is the dashboard; validation gate: ~3 of the first ~10 must claim and inscribe before deepening Ring 1 _(you · ongoing)_
- [ ] **Write the 64 piece stories** — the piece-content editor gives you a no-code surface for story/materials/photos per piece; the words are yours _(you · deep)_

## Soon

### Current triage — 2026-11-16

- [x] **Mobile recorder hint (local):** “Hold to record” stays inside the deck footer button, leaving scrolling actions clear. The regression fails against the old CSS and passes at 320 px and 393 px; recorder activation and the 44 px hit target remain verified.

- [x] **Mobile navigation visibility (local):** desktop links now hide immediately when the header collapses to its mobile menu. A browser regression captures visibility at the resize transition; the previous `transition-all` fails and the color-only transition passes. Desktop, 393 px and 320 px checks pass.

- [x] **Reconcile existing branches (2026-11-16):** completed against the pinned audit inventory; article-library PR #396 is merged and live at `/learn/`. See [branch integration and release record](todo/plans/unmerged-work-2026-11-16.md). Historical inventory: 57 refs / 34 tips; current disposition of the reviewed 11: 8 incorporated (including #396), 2 superseded, 1 owner-held. No selected missing candidate remains from that review.

- [x] **Article library and local writer, PR #396:** live at [mandalacodes.com/learn](https://mandalacodes.com/learn/). Merged `9de8389e` and deployed build `07c30b99`. Required CI, build/typecheck, unit/article checks, visual review, local draft flow and live-byte proof passed; full evidence and remaining limits are in the [release record](todo/plans/unmerged-work-2026-11-16.md). Hosted Keystatic GitHub mode, physical-phone acceptance, owner-held phrase list and collector hold remain outstanding.

- Voice browser race: test delay removed; immediate action passed five desktop and five emulated-phone repetitions, with no runtime defect reproduced. Owner phone acceptance remains below.
- Offline: production-worker checks prove cached prose only; phone acceptance remains below. Artwork is intentionally network-only.
- Interconnection: collection placement, shared profile keys, shared city picker, kinship cap, and Gateway profile link are implemented locally. Preview/live-ledger acceptance remains in [interconnection-followups.md](todo/plans/interconnection-followups.md); other remaining content decisions stay owner-led.
- Collector ledger writes remain on hold under Go-live ops above. The separate 22 September reliability publication still requires coordinator export clearance; neither item authorizes a release.

- [x] **Oracle voice browser race (2026-11-16):** builder removed the 800 ms test delay; immediate stop/delete/Hear-it passed five desktop and five emulated-phone repetitions. No runtime defect reproduced. Typecheck and unit suite passed. Real phone acceptance remains owner-required below; see [VOICE-STATUS.md](docs/oracle/VOICE-STATUS.md).
- [ ] Oracle app card voice: put it on your phone and run the card 2 check. A device build from main passed on 2026-11-16 with fresh signing (the widget fix is in [#404](https://github.com/adroart/mandalacodes/pull/404)); nothing is installed yet _(band: you-required)_ _(effort: moderate)_ → Check: [VOICE-PHONE-CHECK.md](docs/oracle/VOICE-PHONE-CHECK.md) · State: [VOICE-STATUS.md](docs/oracle/VOICE-STATUS.md) · Plan: [oracle-voice-completion.md](todo/plans/oracle-voice-completion.md)
  1. Install on the phone, only from a build whose signing has at least 6 days 23 hours left; rebuild with `npm --prefix mobile run build:device` if older.
  2. Make sure the email you sign in with on the phone is in `ADMIN_EMAILS` in Cloudflare Pages. Sign in (email code if Google is refused) and check the account screen's last line shows the new build and commit.
  3. Run the twelve steps in VOICE-PHONE-CHECK.md on card 2, about fifteen minutes.
  4. AirDrop the step 12 file to the Mac, run `npm run voice:apply -- --file ~/Downloads/oracle-voice-card-02-YYYY-MM-DD.json --dry-run`, then without `--dry-run` if the report looks right, and read card 2 on the preview before a second card.
  5. Tell the next session which steps failed or confused you, and whether the older studio (Recording settings, Sessions) holds drafts you haven't applied, so it can remove the older studios.
- [ ] Publish the locally verified 22 September reliability repairs after coordinator export clearance and verify deployed behavior → [execution checklist](todo/plans/audit-2026-09-22.md). Existing collector/offline/editorial plans retain their scope; no launch flags are enabled.
- [ ] Check the Deadman and Maciocia point and page references in the 32 organ entries (body/organs in the vault) once the two PDFs are on this Mac; the Neijing and Nanjing chapter citations were checked 2026-09-16, those two books were not, because no copy could be found on disk or in the vault _(band: agent-runnable)_ _(effort: moderate)_
- [x] Restore worker typechecking separately from the browser TypeScript project; current main and the audited repairs now share this boundary.

### Found in the 2026-09-08 audit and build day
- [x] Card 57 Gene Keys nature headings verified on main (Hesitant / Impetuous in `oracle/cards/57.md`; empty-name bug closed 2026-09-22) _(band: agent-runnable)_ _(effort: quick)_
- [x] The cast-content command still points at the deleted changing-lines placeholder; point it at the six lines inside each card's I Ching section — done: `.claude/commands/cast-content.md` now points at the `### Moving lines` subsection of `oracle/cards/<NN>.md`, verified against all 64 cards (all already carry their six lines).
- [x] The atlas status buttons clip off the right edge on desktop, seen in the no-3D screenshots — done: the Series+Status row and the status button group now wrap (`AtlasFilters.tsx`) instead of overflowing the 360px sidebar column, which `html, body { overflow-x: clip }` was silently clipping; regression test added to `tests/atlas-no-webgl.spec.ts`.
- [ ] Decide where a collector anchors intention, at claim on the art site or on the card here, then give it one entrance from live navigation _(band: you-required)_ _(effort: moderate)_ → Plan: [overarching-plan.md](todo/plans/overarching-plan.md) B4
- [ ] The three atlas cuts against the intention statement: the filter panel, dream text on the globe, the drift and gloss mechanics _(band: you-required)_ _(effort: moderate)_ → Plan: [overarching-plan.md](todo/plans/overarching-plan.md) B5

### Found in the 2026-09-08 mobile suite audit

Getting the mobile Playwright suite an actual `webServer` (see `todo/archive.md`) surfaced 38 real failures/timeouts out of 114 that a cold-checkout connection-refused had been masking. Most trace to one root cause, not 38 separate bugs:

Historical baseline on b9da484, before these repairs: 41 failed, 80 passed and 10 skipped. The accepted repairs resolve the affected reading-frame and fixture cases; the integrated release must pass fresh checks before publication.

- [x] Restore reachable administrator recorder and Safari handoff in the current reading frame, expose real progress/navigation semantics, and verify the complete mobile suite — resolved locally 22 September; [evidence](todo/plans/audit-2026-09-22.md). Publication remains above.
- [x] Supply valid canonical Atlas fixtures to the light-mode browser cases — stage, paper and ink assertions pass.
- [x] Align entry-rail tests with the existing birth-time/profile journey — the retired “Your codes” tile is not a current interface requirement.

### Found in the overnight audit, 2026-09-01

- [ ] The sign-in modal is headlined "Keep your chart" no matter what the visitor clicked _(band: you-required)_ _(effort: quick)_
  It now reads oddly after clicking Save on a card, which is a new door as of 2026-09-01. Changing it touches the modal site-wide, so it wants your call on the wording rather than an agent's guess.

- [ ] The registry lists five waiting rows for mandalas, signature pieces and jewelry _(band: you-required)_ _(effort: quick)_
  They claim nothing and count as nothing, so they are honest, but while they are there the registry's own "awaiting first light" line never appears. Keep them or drop them, your call.

- [x] Refresh the two status documents, both of which now undercount what is built — done 2026-09-22: re-measured [DEVELOPMENT-STATUS.md](todo/DEVELOPMENT-STATUS.md) and its paired [launch-readiness.md](todo/plans/launch-readiness.md) against the current repo (not just the 2026-09-02 patch note). All six quick wins verified shipped (not five), three more "Medium feature" items found shipped (#7, #10, #15), section 0 rewritten to name the actual current gate (`livingLegacy: false` on adrian-website, confirmed still false), and a stale "0/384 changing-line texts" row corrected to 384/384 (verified while fixing the cast-content item above).
  Measured 2026-09-01: five of the six "quick wins" in [DEVELOPMENT-STATUS.md](todo/DEVELOPMENT-STATUS.md) had already shipped, and one file it points at no longer exists. Its section 0 blames an ops gate of database tables and secrets for holding features hostage; the secrets are in fact provisioned, and the real cause is two launch flags on the other repo.

- [ ] Verify the /make note form end to end on the deployed preview after merging the piece-page branch (auth + R2 queue cannot run under plain Vite; a note should appear in AdminAtlas "Make Requests") _(band: agent-runnable)_ _(effort: quick)_ → Plan: [piece-page-acquisition.md](todo/plans/piece-page-acquisition.md)

- [ ] Flip finished pieces to the take-it-home door: in the Catalog Room set status available + acquireUrl; the piece page reads it automatically _(band: you-required)_ _(effort: quick)_

- [ ] The making strip on /make: two or three photos of layers being cut ("The making, in layers"); needs your studio photos _(band: you-required)_ _(effort: quick)_

- [x] RequestStewardship still uses bg-white inputs, slightly glaring on the new dark piece page; retoken to paper like the /make fields — done: the textarea had already moved off literal `bg-white` to `bg-wood-50` in an earlier pass but still didn't match `/make`'s `bg-paper-50` field token (and reads near-black in Nightfall, since dark-mode `wood-50` is darker than `paper-50`); now `bg-paper-50` on `RequestStewardship.tsx`, matching the containing piece-page card exactly as `/make`'s fields match their note section.

- [ ] Offline phone acceptance _(you-required)_ → Plan: [offline-oracle-completion.md](todo/plans/offline-oracle-completion.md). The production-worker browser check now verifies all 64 prose chunks are cached and untouched-card text renders with network blocked. Phone confirmation of the text-only promise and interrupted-warm recovery remains outstanding; artwork is excluded by design.

- [ ] Decide whether to state the offline promise in the interface, differentiate offline guidance for Atlas vs queued reflections, support a gallery iPad use case, and expose queued reflections as a first-class saved item. Product choices remain owner-required; old proposed update-check, persistent-storage and baseline-test tasks need fresh evidence before reopening. → Plan: [offline-oracle-completion.md](todo/plans/offline-oracle-completion.md)

- [ ] Rewrite the 64 opening readings so each speaks the whole code (all traditions as lenses on one energy) and ends lifting, not heavy _(band: you-required)_ _(effort: deep)_ → Plan: [reading-rewrite.md](todo/plans/reading-rewrite.md)

- [ ] Scrub the remaining soft source-name phrases in card prose ("the lineage calls this", "the text calls this", "the Eranos source calls this" on cards 1, 4, 5, 6, 13, 40, 60) — your call, since "the lineage" may read as acceptable in-world voice _(band: you-required)_ _(effort: quick)_

- [ ] Finish The Field: the procession (guided founding-story tour) and the piece's yearly ask about its shared words; the three lenses, dream share flow, and tending queue shipped 2026-07-04 on the globe branch _(band: agent-runnable)_ _(effort: moderate)_ → Plan: [living-art-legacy.md](todo/plans/living-art-legacy.md) § M6

  Measured 2026-08-21 against a local dev server on a clean main checkout: dozens of Mobile Chrome specs fail, not five. Spot-checked `typography-contract` and `oracle-entry-codes` fail identically on plain main and on a merge branch, so this is the suite own state, not a regression from any one change. The suite also runs serially (`fullyParallel: false`) and takes over nine minutes, long enough that a full run gets truncated before reaching the later specs — which is why the count kept reading as five. Get one honest full-suite number first, then triage. Until that exists, "the mobile tests pass" is not a claim anyone can make.

- [ ] Make Mandala Codes the go-to mandala authority site (multi-phase content, outreach, and press campaign)   → Plan: [mandala-authority.md](todo/plans/mandala-authority.md) _(band: you-required)_ _(effort: moderate)_

- [ ] Add more decks beyond Universal Language and Light Codes as they emerge _(band: you-required)_ _(effort: moderate)_

- [ ] Integrate the Light Codes deck (route is reserved, content lives in the archive) _(band: you-required)_ _(effort: moderate)_

- [ ] Write per-artwork readings into `oracle/readings/` over time (UL-122 is the reference)   → Spec: [oracle/readings/README.md](oracle/readings/README.md) _(band: you-required)_ _(effort: moderate)_

- [ ] Develop the chart→art lookbook into the site — an admin/client flow to generate a personalized lookbook (compute from birth data or upload), with the recommendation step, replacing the CLI   → Tool: [scripts/chart-lookbook/README.md](scripts/chart-lookbook/README.md) _(band: you-required)_ _(effort: moderate)_

- [ ] Register the remote oracle MCP as a Claude custom connector once it's live _(band: you-required)_ _(effort: moderate)_

- [ ] Wire the Adrian Rasmussen quote system to `POST /api/oracle/recommendation` (chart/birth → art + energy), then add pricing + purchase + the client page/PDF on that side   → Plan: [todo/plans/adrian-quote-integration.md](todo/plans/adrian-quote-integration.md) _(band: you-required)_ _(effort: moderate)_

- [ ] Do the full whole-deck review of all 64 cards against the writing method, then launch   → Plan: [oracle/TODO.md](oracle/TODO.md) _(band: you-required)_ _(effort: moderate)_

- [ ] Build the OracleSystems lineage page and the network UI (map of placed sculptures plus holder profiles)   → Plan: [oracle/TODO.md](oracle/TODO.md) _(band: you-required)_ _(effort: moderate)_

- [ ] Retire the legacy oracle data files once every overlay fully covers its content   → Plan: [oracle/TODO.md](oracle/TODO.md) _(band: you-required)_ _(effort: moderate)_

- [ ] Verify all 64 artwork images (Cloudinary URL, correct piece, filename, alt text)   → Plan: [oracle/TODO.md](oracle/TODO.md) _(band: you-required)_ _(effort: moderate)_

- [ ] Build the acquire detail section and configurator (sizes, editions) on the buy sheet   → Plan: [oracle/TODO.md](oracle/TODO.md) _(band: you-required)_ _(effort: moderate)_

- [ ] Do the Phase 2 personal pass on the Gene Keys and Human Design scaffolds to take each card to final   → Plan: [oracle/TODO.md](oracle/TODO.md) _(band: you-required)_ _(effort: moderate)_

- [ ] Write invocations for cards 2 to 64 (Adrian's own voice, not delegable)   → Plan: [oracle/TODO.md](oracle/TODO.md) _(band: you-required)_ _(effort: moderate)_

- [ ] Decide whether to commit the full deep-pass rewrite for the remaining 61 I Ching and Body cards   → Plan: [oracle/TODO.md](oracle/TODO.md) _(band: you-required)_ _(effort: moderate)_

- [ ] **Voice pass on the 384 changing-line texts** — all 64 cards already carry six written lines each under ICHING > Moving lines (384 total, verified on main); `data/ichingLines.ts` is gone. Remaining work is Adrian's voice pass via `/cast-content`, not authoring from empty placeholders _(band: you-required)_ _(effort: moderate)_ → PR: [#6](https://github.com/adroart/mandalacodes/pull/6)

- [ ] Decide what to do with the leftover local atlas work branch and its uncommitted files _(band: you-required)_ _(effort: moderate)_

- [ ] Pick the canonical web address: redirect www to the bare domain for SEO _(band: you-required)_ _(effort: moderate)_

- [ ] Close Adrian-Website PR #110 in favour of the newer PR #113   → PRs: [#110](https://github.com/adroart/Adrian-Website/pull/110), [#113](https://github.com/adroart/Adrian-Website/pull/113) _(band: you-required)_ _(effort: moderate)_

- [ ] Reprint the physical cards so the QR codes point at the new mandalacodes.com domain _(band: you-required)_ _(effort: moderate)_

- [ ] (Optional) Add embeddings via Workers AI + Vectorize if the concept ontology misses real queries   → Plan: [docs/oracle-remote-mcp-plan.md](docs/oracle-remote-mcp-plan.md) _(band: you-required)_ _(effort: moderate)_

- [ ] Deploy the hosted oracle Functions (`/api/oracle/{search,card,mcp,recommendation}`) by merging to main; optionally set `ORACLE_MCP_TOKEN` / `ORACLE_API_TOKEN` to gate the remote MCP and the recommendation API   → Plan: [docs/oracle-remote-mcp-plan.md](docs/oracle-remote-mcp-plan.md) _(band: you-required)_ _(effort: moderate)_

- [ ] Bring sign-up and the energy panels over from Adrian-Website   → Plan: [accounts-branch.md](todo/plans/accounts-branch.md) _(band: you-required)_ _(effort: moderate)_

- [ ] Do the Phase 2 personal pass on the 63 scaffold RELATIONS files — they now render live on every card's Relations panel   → Plan: [interconnection-followups.md](todo/plans/interconnection-followups.md) § Content _(band: you-required)_ _(effort: moderate)_

- [ ] Click through the interconnection branch on a preview deploy (card Relations seats, atlas deep links, birth-place marker, steward picker, signed-in "your codes" lens on the atlas, dream share + tending round trip) before merging   → Plan: [interconnection-followups.md](todo/plans/interconnection-followups.md) § Verify _(band: you-required)_ _(effort: moderate)_

- [ ] Publish the Phase 2 editorial-depth articles and the Phase 3 symbolism glossary   → Plan: [docs/research/seo/2026-05-28-article-cluster-plan.md](docs/research/seo/2026-05-28-article-cluster-plan.md) _(band: you-required)_ _(effort: moderate)_

- [ ] Build the /about stance page and the /artists hub with Adrian's first featured artist page   → Plan: [docs/research/seo/2026-05-28-article-cluster-plan.md](docs/research/seo/2026-05-28-article-cluster-plan.md) _(band: you-required)_ _(effort: moderate)_

- [ ] Publish the four Phase 1 SEO articles (what is mandala art, sacred geometry, laser-cut wooden mandalas, commissioning a mandala)   → Plan: [docs/research/seo/2026-05-28-article-cluster-plan.md](docs/research/seo/2026-05-28-article-cluster-plan.md) _(band: you-required)_ _(effort: moderate)_

- [x] **Launch sign-in** — DONE 2026-06-15. Account sign-in is live on mandalacodes.com via self-owned Better Auth (email code + password + Google), same-origin, sharing the `adrian-website` collector DB. The old Clerk plan is superseded (see Phase 1b below).

### Done

- ~~Activate `www.mandalacodes.com` as a second custom domain~~, done 2026-05-23, serves correctly.
- ~~Connect GitHub to Cloudflare Pages for auto-deploy~~, done 2026-05-23, every push to `main` auto-builds and deploys.

## Phase 1b: Accounts

**Status update 2026-06-15:** account sign-in is live on mandalacodes.com via self-owned Better Auth (Google + email/password + email code), same-origin, sharing the `adrian-website` collector database with the art site. (Historically this replaced an earlier login attempt; that older plan is superseded.) Live secrets set (BETTER_AUTH_SECRET, BETTER_AUTH_URL, RESEND, GOOGLE_*, ADMIN_EMAILS).

- [x] **Remove old login reference from the pieces admin file** — `components/AdminPieces.tsx` is not on main; nothing to clean here _(agent · quick)_


### Done

- ~~Decouple `ClerkProvider` from the accounts launch flag~~, branch `claude/migration-completion-requirements-eaDFz`, 2026-06-02. Provider now mounts whenever a Clerk key is present so admin sign-in + atlas steward pages stop throwing "must be wrapped in ClerkProvider"; the accounts flag gates the public surface via `available`. Also fixed stale Stripe comments, the `wrangler.toml` "no tables yet" note, and the missing `CLERK_WEBHOOK_SECRET` in the secrets-sync script/doc.
- ~~Remove dead oracle code from Adrian-Website~~, Adrian-Website PR #113 ([link](https://github.com/adroart/Adrian-Website/pull/113)), 2026-05-29. Deletes all oracle components / data / scripts / assets, replaces `/oracle` with a directory page that links to mandalacodes, 301-redirects every old card URL via `_redirects`. Awaiting merge.

## Oracle deck content (Universal Language)

- [ ] Pick card 3's opening line: two versions exist, both recorded as your choice on the same day; card 3's pass shows you both _(band: you-required)_ _(effort: quick)_ → Both lines and the evidence: [card 3's essence](todo/plans/writing-guideline/card-03-essence.md)
- [ ] **Complete the existing card-check command:** `npm run card:gate -- NN` already runs the sentence/prose checks, both entrance checks and worksheet/framework checks; the tells check is still separate. Adding it changes the [locked card method](oracle/CARD-PASS.md) and requires a specific recorded correction from Adrian. Preserve the current method until that correction is recorded. _(band: you-required)_ _(effort: quick)_
- [x] **Settled entrance openings in cards (verified 2026-11-16):** all 64 authored `meta.centre` first sentences match the [settled entrance openings](todo/plans/writing-guideline/entrance-openings.md). No manuscript changes are needed.
- [x] **Card entrance heading (2026-11-16, local):** the existing authored `meta.centre` now appears once under “Message at a glance.” The full CODE reading and native spoken-intro override remain separate. Desktop, 393 px and 320 px browser checks pass; native override switching passes in Chromium. Physical iPhone acceptance remains outstanding. Tests: `oracle-card-intro.spec.ts`, `oracle-section-workflow.spec.ts`.
- [ ] Say once, in the deck's own introduction, what the paintings are: the painting is a window to the energy, it does nothing, you look _(band: you-required)_ _(effort: quick)_
- [x] **Printed hand-pass workbook:** the renderer supports selected cards in order, sixteen four-card booklets, or one whole book with its print pack (`npm run workbook`). The later owner decision in `d9c44cdd` removed sentence numbers, suspect marks and facing rewrite pages; that supersedes the older layout in [personal-pass.md](todo/plans/personal-pass.md). Verified 2026-11-16: booklet 1 renders cards 1–4 as 12 A4 pages / 6 sheets. Physical printing remains below.
- [ ] Print the selected workbook/booklets for the hand pass; choose the card order with `npm run workbook -- --cards 3,14,47,52`, or use the existing booklet/whole-book modes _(band: you-required)_ _(effort: quick)_
- [ ] Do the hand pass: read, mark, rewrite the 64 by hand in the printed workbook, without AI, one card a sitting, in the booklet order the plan sets _(band: you-required)_ _(effort: deep)_ → Plan: [personal-pass.md](todo/plans/personal-pass.md), Phase 2 sections 2, 3 and 5
- [ ] Build the typist loop that carries the handwriting back into the cards: the photo intake folder in the vault, the one-page transcript brief, the no-model apply script that patches by sentence number, and the approved-lines file with its unit test _(band: agent-runnable)_ _(effort: deep)_ → Plan: [personal-pass.md](todo/plans/personal-pass.md), Phase 2 section 4
- [ ] Card 39 carries a Root-centre paragraph copied word for word from card 38; the two DESIGN sections read as one page. Found by the Phase 1 reading pass; fix in the hand pass or before the workbook prints _(band: you-required)_ _(effort: quick)_
- [ ] Pilot the guideline on five cards (3, one bright, one dark, one body-led, one of your choosing) and read them on the live page before the rest _(band: you-required)_ _(effort: deep)_ → Plan: [GUIDELINE.md](oracle/GUIDELINE.md) § 15
- [ ] Author the connective-layer sources the vault never had: one file per trigram, per Immortal, per codon ring, plus the tarot cross-mapping _(band: you-required)_ _(effort: deep)_ → Plan: [GUIDELINE.md](oracle/GUIDELINE.md) § 13
- [x] Card 64 KEYS names its natures Anxious and Manic; the source row says Imitating and Confused. Fix the names and re-read the two paragraphs — already fixed by an earlier pass: `oracle/cards/64.md`'s own in-file changelog records "Imitating and Confused re-confirmed against gene-key-64-communion.md (Repressed: Imitating, Reactive: Confused)... Anxious and Manic survive only in this history" (2026-09-16 migration). Verified 2026-09-22: the live `### Repressive nature — Imitating` / `### Reactive nature — Confused` headings and their two paragraphs already speak to those names, not the old ones. Nothing left to change; TODO was stale.
- [ ] Sweep KEYS for the Repressive/Reactive opening formula (36 of 64 cards) and the Immortals "stands above" opener (52 of 64), the same stem-ban method as the DESIGN sweep _(band: agent-runnable)_ _(effort: moderate)_ → Plan: [writing-guideline.md](todo/plans/writing-guideline.md) § 3
- [ ] Re-lock cards 1 and 2: their KEYS, DESIGN and RELATIONS were final in the source JSON and ship as scaffold in `oracle/cards/` _(band: you-required)_ _(effort: quick)_

### Done

- ~~Wire the Relations overlay into the live card~~, branch `claude/interconnection-architecture-review-z9vmtw`, 2026-06-10. All 64 RELATIONS files now feed every seat of the Relations panel (pair, inverse, partner, ring, tarot, zodiac, Immortal, Hebrew letter).
- ~~Show a "no moving lines, the hexagram is stable" message when a cast produces no moving lines~~, same branch, 2026-06-10.

## Interconnection (four pillars)

The June 2026 structural review wired the deck ↔ atlas ↔ profile ↔ reading bridges; full write-up of what shipped and what remains: [interconnection-followups.md](todo/plans/interconnection-followups.md).

- [x] **Collection placement details** — `/account/collections` now joins saved cards to physical placements, shows city/status and links to the selected Atlas piece (`CollectionsManager.tsx`). Local implementation is present; live/owner acceptance is separate. Spec: [phase-2-field-features.md](todo/plans/repair/phase-2-field-features.md) § E
- [x] **Shared profile key/sphere ordering** — `data/profileKeys.js` now supplies the ordered keys and sequence membership used by profile positions, recommendations, and the profile Function. Surface-specific labels remain intentionally distinct. Evidence: [interconnection-followups.md](todo/plans/interconnection-followups.md).
- [x] **Shared city picker** — AdminAtlas and StewardEdit use `components/shared/TypeaheadPicker.tsx` (AdminAtlas through its `CityAutocomplete` wrapper). Evidence: [interconnection-followups.md](todo/plans/interconnection-followups.md).
- [x] **Kinship-arc cap** — `components/atlas/AtlasFilters.tsx` displays the showing/total thread count when the cap applies. Local implementation evidence; any preview/live acceptance remains separate. See [interconnection-followups.md](todo/plans/interconnection-followups.md).
- [x] **Gateway → birth chart link** — `components/OracleGateway.tsx` already links to `/profile` (“Your Birth Chart”). See [interconnection-followups.md](todo/plans/interconnection-followups.md).
- [x] **Gateway hexagram consistency (2026-11-16, local):** Gateway now uses the shared trigram line patterns while retaining its compressed orbital drawing, animation and historical unknown-symbol fallback. All 64 rendered six-line patterns pass the browser regression; desktop/mobile before-and-after screens reviewed. Further geometry consolidation is unnecessary for this fix. Test: `oracle-gateway-glyphs.spec.ts`.
- [ ] Explore whether a per-hexagram transition reading belongs in the cast experience; the former CoinCast component reference is stale and no current generic "becoming" surface was found. This needs content/product framing before implementation. _(you-required)_ → Plan: [interconnection-followups.md](todo/plans/interconnection-followups.md).

The June 2026 reachability audit found every atlas function is wired and has UI, but the public + owner paths assume knowledge the UI never gives. The two correctness lockouts (returning-owner nav, secondary-buyer flow) shipped on `atlas-globe-hud` / PR #49; these three are the remaining guidance gaps.

- [ ] **Owner-journey thread** — give the steward edit page a guided arc instead of a wall of independent toggles: an intro ("you now steward X, here's what you can do"), surface "Letters from the piece" on arrival (today it's a collapsed button a new owner never finds), and add next-step nudges after placing/inscribing _(agent · moderate)_ _(routed → Backlog)_
  StewardEdit lays out place / inscribe / consent / heirs / letters / export as isolated sections with no connective guidance, so owners discover features by accident and miss letters entirely. Done when a freshly-claimed owner is walked through the core stewardship actions and sees that the piece writes letters back.
- [x] **Atlas terminology (2026-11-16, local):** thread controls explain the shared three-line symbols, Seeking ground explains the absent public map location, and the selected-piece panel explains founding-light claim order. Desktop/mobile filters and selected-piece screens checked; four browser checks, five existing copy/retired-route unit checks and TypeScript pass. The old claim CTA is excluded because that collector route is retired.
  The globe shows "threads", "Founding Lights", and "Seeking ground" with zero explanation, so a visitor sees beautiful but silent jargon and the unplaced-pieces list offers no way to act. Done when each term is explained in place and Seeking ground links into the claim flow.
- [x] **Admin outreach-status control** — built on main (`functions/api/atlas/stewards/outreach.ts`, select in `AdminAtlas.tsx`, `tests/unit/stewardsOutreach.test.ts`); unreachable until go-live ops lift the 410 boundary, not missing _(agent · quick)_ _(routed → Backlog)_

## Oracle MCP, search & personalization

Framework built on branch `claude/oracle-mcp-artwork-readings-MMa1k` (pending merge): a local MCP server, a shared query layer with concept-expansion search (live on the deck index), the artwork↔code link + an authored-reading layer, staged hosted search + remote-MCP Functions, and a chart→art lookbook generator. Plans: [docs/oracle-mcp-integration-plan.md](docs/oracle-mcp-integration-plan.md), [docs/oracle-remote-mcp-plan.md](docs/oracle-remote-mcp-plan.md).


## Future ("home for all things mandala")

### Living art legacy (the piece carries an ever-growing history; the planet is the global mandala)

- [x] **M0 — ledger hardening** — concurrency-safe R2 writes, multi-piece claim-binding fix, edition-key unification, backdated-event guard, admin-notes leak fix, actorRef attribution, first tests _(agent · moderate)_ → Plan: [living-art-legacy.md](todo/plans/living-art-legacy.md) _(built on `claude/gallant-faraday-kb2y28`, 2026-06-10, merged to main — only ops steps in [todo/handoff/MORNING-AFTER.md](todo/handoff/MORNING-AFTER.md) may remain)_
  The review found writes can silently drop ledger events and a collector can never bind a second piece — fatal for an append-only promise. Done when the M0 checklist in the plan is green and the privacy/verifyChain tests run on CI.
- [x] **M1 — public piece page + Founding Lights** — zero-signup QR landing page per piece, `claimed` event + permanent claim-order ordinal (Adrian is light #1), pieceType color, unawakened dots _(agent · deep)_ → Plan: [living-art-legacy.md](todo/plans/living-art-legacy.md) _(built on `claude/gallant-faraday-kb2y28`, 2026-06-10, merged to main — only ops steps in [todo/handoff/MORNING-AFTER.md](todo/handoff/MORNING-AFTER.md) may remain)_
  The QR must land on the piece's story, not a login wall, and claim order turns the sparse early map into the launch story. Done when a scan shows the piece's book cover and Adrian's claim ignites light #1.
- [ ] **M2 + M3 — consent capture + Ring 1 legacy entries** — two-phase claim with one active map question (active opt-in, Rings 3-4 recorded deferred), then holder-authored `inscribed` entries with bodies in D1 (salted commitments on chain), time capsules, heir hints, holder export _(agent · deep)_ → Plan: [living-art-legacy.md](todo/plans/living-art-legacy.md) _(built on `claude/gallant-faraday-kb2y28`, 2026-06-10, merged to main — Ring 1 inscriptions still blocked on the D1 migration in [todo/handoff/MORNING-AFTER.md](todo/handoff/MORNING-AFTER.md))_
  Consent is captured once at claim; free text never enters the hashed payload so erasure stays possible. Done when a steward writes an intention, the chain verifies, erasure tombstones cleanly, and the book exports as signed JSON + PDF.
- [ ] **M4 — sale bridge + claim requests** — HMAC webhook from adrianrasmussen.com into an admin-confirmed queue, plus self-serve stewardship requests for secondary sales/gifts/inheritance _(agent · deep)_ → Plan: [living-art-legacy.md](todo/plans/living-art-legacy.md) _(built on `claude/gallant-faraday-kb2y28`, 2026-06-10, merged to main — sale webhook still blocked on ops steps in [todo/handoff/MORNING-AFTER.md](todo/handoff/MORNING-AFTER.md))_
  A forged sale must never grant ownership, and buyers Adrian didn't pre-register need a path in. Done when a test checkout produces a pending sale Adrian confirms in one click and the buyer's QR claim works end to end.
- [x] **M5 — Ring 3 chart presence + the piece writes back** — consent-gated kinship/chart attach, kin-claim notifications in the piece's voice _(agent · moderate)_ → Plan: [living-art-legacy.md](todo/plans/living-art-legacy.md) _(built on `claude/gallant-faraday-kb2y28`, 2026-06-10, merged to main — only ops steps in [todo/handoff/MORNING-AFTER.md](todo/handoff/MORNING-AFTER.md) may remain)_
  The notification is the return loop that brings holders back. Done when arcs only draw for consenting holders and a kin claim sends the letter. Ring 4's gallery surface is density-gated (≥25 opt-ins) and stays off the roadmap until then.


## Mandala Authority Strategy

- [ ] **Learn editor in the browser** _(band: you-required)_ _(effort: moderate)_ — switch the `/learn` Keystatic editor from local-only mode to GitHub mode so articles can be written from any browser without running the dev server.
  Today writing requires `npm run write` locally; GitHub mode needs a Keystatic GitHub App and a host with server routes. Steps are in [content-site/README.md](content-site/README.md) "Editing from the browser in production." Done when you can open a hosted Keystatic URL, write an article, and it commits to `main`.

## Operational notes (not TODOs: context for future-you)

- The QR Function on adrianrasmussen.com (`functions/qr/[number].js`) must live forever, printed plaques depend on it. Treat the old domain's QR Function as permanent infrastructure even after every other oracle thing is stripped from the art site.

- All physical-piece sales process through adrianrasmussen.com (one Stripe account, one inventory). "View the original" CTAs on mandalacodes card pages link out, no checkout flow lives here. This is intentional cross-pollination.

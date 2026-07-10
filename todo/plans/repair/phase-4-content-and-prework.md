# Phase 4: Authority content + writing-track prework (execution brief)

_Written 2026-07-10 against the audit in `todo/DEVELOPMENT-STATUS.md` (Part I section 3
"Authority / SEO / editorial", plus the agent-doable prework from Part I section 2). Every
claim below was verified against the actual code and content files on this branch before
writing. This brief is self-contained: a fresh agent can execute any task without reading
the audit first._

## Scope

Two tracks, eight tasks:

- **Track A (tasks 1 to 5):** the Phase 4 authority/SEO/editorial work, three missing core
  articles, the symbolism glossary, the about page, the artists hub, and the /articles vs
  /learn path housekeeping.
- **Track B (tasks 6 to 7):** the agent-doable scaffolding that clears the runway for
  Adrian's writing track. None of it is Adrian's voice; all of it is marked draft.
- **Task 8:** what is explicitly out of scope and why.

## Verified facts this brief stands on

- The editorial engine is an Astro sub-site at `content-site/`, built with
  `base: '/learn'` (`content-site/astro.config.mjs`) and copied into `public/learn` by the
  root `build:content` script. Articles are `.mdoc` files in
  `content-site/src/content/articles/`; the schema lives in
  `content-site/src/content.config.ts`; `getPublishedArticles()` in
  `content-site/src/lib/articles.ts` filters out `draft: true`, so drafts never publish.
- 11 articles exist. The one full core article is `what-is-mandala-art.mdoc` (~2,000 words,
  with a References section). The other ten are the short "traditions" teaser set. A
  `_TEMPLATE.mdoc` exists in the same folder.
- The main site is a React SPA (`App.tsx` react-router routes). `/about`, `/artists`, and
  `/symbolism` do not exist anywhere (confirmed: no routes, no components, no static pages).
  SEO for SPA routes today = `useSeoMeta.ts` `ROUTE_META` (three entries) plus one
  Cloudflare Pages Function, `functions/universal-language/[number].js`, which uses
  HTMLRewriter to inject per-card OG meta at the edge. That function is the reusable
  pattern for server-side meta on any new SPA route.
- The featured-artist spec exists in full at
  `docs/research/seo/2026-05-28-featured-artist-page-spec.md` and is implementable as
  written (routes, layout, three schema blocks, a `data/featuredArtists.ts` data model,
  and a per-artist checklist).
- **The audit's "Live changing-line texts 0 / 384" row is stale in an important way.**
  `data/ichingLines.ts` is indeed 384 empty placeholders, but the card page does not
  depend on it: `components/UniversalLanguageCard.tsx` (line ~103) renders each moving
  line from the parsed card Markdown first (`md?.reading`) and only falls back to
  `getLineText()`. All 64 `oracle/cards/NN.md` files are on main (restored in commit
  `53df3a7`) and every one carries six authored-scaffold moving-line readings under
  `### Moving lines`: verified 64 x 6 = 384 non-empty entries. **The scaffold line texts
  are already visitor-visible on the live card pages.** Task 6 below is therefore a
  fallback-parity cleanup, not a content unlock.
- The 384-in-section-files claim also verified: `oracle/sections/iching/NN.json` (64 files)
  each hold a `lines` array of 6 objects (`line`, `image`, `reading`, `becomes`); 384 total,
  zero empty, zero em dashes. Caution: the section-file prose and the card-Markdown prose
  **differ** for some lines (e.g. hexagram 27 line 3 reads differently in `27.json` vs
  `cards/27.md`). `data/cardMarkdown.ts` declares `oracle/cards/NN.md` the single source of
  truth, so any migration must source from the Markdown, not the JSON.
- Per-artwork readings: `oracle/readings/` holds only `README.md` and `UL-122.md`
  (status: final). A working scaffolder exists:
  `npx tsx mcp/oracle-server/src/scaffold-reading.ts <artworkId>` (refuses to overwrite).
  `data/oracle-corpus.json` maps every one of the 64 cards to exactly one artwork id
  (card 1 = UL-122), so the remaining batch is exactly 63 files.
- `/articles` path references survive in exactly three files, all under
  `docs/research/seo/` (task 5 lists them). Nothing in `todo/plans/` or the code
  references `/articles`.

## DRAFT-marking rules (apply across every task)

1. **Articles (`.mdoc`):** set `draft: true` in frontmatter. The build filters these out,
   so they can merge to main without publishing. Adrian's voice pass ends by flipping
   `draft: false`.
2. **Per-artwork readings:** use the README's own status vocabulary. Machine scaffold =
   `status: scaffold`. Agent-rendered prose = `status: in-progress` plus an HTML comment
   directly under the frontmatter: `<!-- AGENT DRAFT: rendered by agent, awaiting Adrian
   voice pass. Do not set status: final. -->`. Only Adrian sets `status: final`.
3. **`data/ichingLines.ts`:** every migrated line gets a trailing comment
   `// DRAFT scaffold from oracle/cards/NN.md, awaiting Adrian voice pass` and the file
   header states the whole file is scaffold. (This content is already public via the
   Markdown path, so the backfill changes nothing visitors see.)
4. **SPA pages and Astro pages (about, artists, symbolism):** these have no draft flag;
   merging to main deploys them (~2 min). Anything whose copy has not had Adrian's voice
   pass stays on its feature branch, or ships behind a flag in `launchFlags.ts`. The PR is
   the gate.
5. **Voice rules for all new agent prose** (from the cluster plan's Editorial Voice Rules):
   never use the em-dash character; editorial "we" or third person, never Adrian's "I";
   no "wall art" anywhere; every historical claim cites a real source; internal links use
   the live `/learn/<slug>` paths, never `/articles/`.

Global acceptance for every task: `npm run typecheck` passes before pushing (CI enforces
it), and `npm run build:content` succeeds when `content-site/` was touched.

---

# Track A: Phase 4 authority / SEO / editorial

## Task 1: Draft the three missing core launch articles

**Goal.** The four-article Phase 1 foundation is 1 of 4 done. Draft the other three in the
existing article format, marked draft, ready for Adrian's voice pass.

**Files to create** (in `content-site/src/content/articles/`):

| File | Working title | Primary keywords |
|---|---|---|
| `sacred-geometry-mandala-art.mdoc` | Sacred Geometry Mandala Art | `sacred geometry mandala art` (1,300/mo), `sacred geometry art` (18,100/mo) |
| `commissioning-a-mandala.mdoc` | Commissioning a Custom Mandala Artwork | `mandala art commission` (140/mo), `custom mandala artwork` (210/mo) |
| `laser-cut-wooden-mandalas.mdoc` | Laser-Cut Wooden Mandalas (Part A of the two-domain pair) | `laser cut mandala art` (1,600/mo), `wooden mandala sculpture` (590/mo) |

**Spec.**
- Match `what-is-mandala-art.mdoc` exactly in structure: frontmatter (`title`,
  `description`, `pubDate`, `tags`, `field`, `culture`, `cover`, `draft`), an opening that
  defines and promises, `##` sections, a closing that routes onward, and a `## References`
  list of real sources. Length 1,500 to 2,500 words each.
- Section-by-section outlines, keyword targets, linking obligations, and cautions for each
  article are already written in
  `docs/research/seo/2026-05-28-article-cluster-plan.md` (Articles 2, 3, and 4 Part A).
  Follow them, with one correction: every internal link the plan writes as
  `/articles/<slug>` becomes `/learn/<slug>`, and links to `/artists` or `/about` only go
  live in the prose once those routes exist (tasks 3 and 4); until then link to the deck
  or omit.
- Research sources: the plan points at `~/Documents/Obsidian Vault/5 Sources/mandalas/`
  subfolders (`sacred-geometry-mandala-art/`, `mandala-art-commission/`, and related).
  That vault path is a readable working directory for agents in this workspace; read the
  curated `_top-sources-for-writing.md` in each folder first when present.
- The sacred-geometry article must separate historically verifiable claims from
  speculative ones explicitly (the plan flags this lane as loose-history territory).
- The commissioning article stays generic and editorial; Adrian's own commission details
  belong on his artist page (task 4), not here.
- The laser-cut article is Part A of a cross-domain pair; leave a placeholder outbound
  link marked `TODO(Adrian)` for Part B, his first-person essay on adrianrasmussen.com,
  which does not exist yet.
- Set `field`/`culture` sensibly (`Symbolism & Geometry` / `Universal` for sacred
  geometry; `Foundations` for the other two is reasonable); pick a deck plate `cover` id
  from Cloudinary or omit it (the Library falls back to deck plates automatically).
- Optionally set `relatedCard` where a card genuinely fits; the article-to-card footer
  link is already built and rendering-ready.

**Marking.** `draft: true` in all three, per rule 1.

**Acceptance.** Three `.mdoc` files parse (`npm run build:content` green); they do NOT
appear on the built `/learn` index (draft filter working); each has 1,500+ words, a
References section with 4+ real sources, zero em dashes, zero `/articles/` links.

**Needs Adrian.** Voice pass on each, choose/approve cover ids, flip `draft: false`
one at a time in the cluster plan's publish order.

**Size.** Moderate: roughly half a day per article including source reading. Independent
of every other task.

## Task 2: Symbolism glossary (hub + two sub-pages)

**Goal.** The quick-reference glossary the SEO plans call `/symbolism` exists nowhere.
Build it as static pages so the `DefinedTermSet` schema is in the served HTML.

**The routing decision (make it explicit).** The plans assume a top-level `/symbolism`,
but the only static-page engine in the repo is the Astro sub-site pinned to
`base: '/learn'`. The SPA could host `/symbolism`, but a reference glossary written for
AI citation should not be client-rendered. **Recommendation: build it inside the content
site at `/learn/symbolism`,** accepting the same path divergence the articles already
accepted (`/articles` became `/learn`). This is a one-line sign-off for Adrian.

**Files to create.**
- `content-site/src/pages/symbolism/index.astro` (hub: the glossary,
  grouped term entries: symbols, colors, directions, geometric forms)
- `content-site/src/pages/symbolism/sacred-geometry.astro` (sub-page 1: Flower of Life,
  Metatron's Cube, Sri Yantra structure, Vesica Piscis, per the cluster plan Phase 3 table)
- `content-site/src/pages/symbolism/by-tradition.astro` (sub-page 2: Tibetan vs Hindu vs
  Jain vs contemporary differences)
- `content-site/src/lib/symbolism.ts` (typed term data: `term`, `definition`, `group`,
  optional `relatedArticleSlug`, optional `relatedCard`)

**Spec.**
- Astro routing is file-based: a new `.astro` file under `src/pages/` ships at
  `/learn/<path>` automatically (that is the whole "how routes are added" answer;
  `[...slug].astro` handles articles, plain files handle everything else).
- Use `layouts/Base.astro` and pass `jsonLd`: the hub gets `DefinedTermSet` with a
  `DefinedTerm` per entry (per the schema table in
  `docs/research/seo/2026-05-28-page-targets.md`); sub-pages get their subset.
- Keep entries short (40 to 120 words each), definitional, cited where a claim is
  historical. 15 to 25 terms on the hub is enough to launch.
- Cross-link: each term that has a matching article links to `/learn/<slug>`; the hub
  links to both sub-pages and back to the Library index.
- The sitemap integration is already configured in `astro.config.mjs`; new pages join it
  automatically.

**Marking.** No draft flag exists for Astro pages: build on a branch, per rule 4. Term
definitions are agent prose under the voice rules (rule 5).

**Acceptance.** `npm run build:content` emits `public/learn/symbolism/index.html` plus
both sub-pages; the built HTML contains the `DefinedTermSet` JSON-LD; pages appear in the
generated sitemap; zero em dashes.

**Needs Adrian.** One-line sign-off on the `/learn/symbolism` path; review of the term
list (which symbols make the cut); light voice pass (definitional prose needs less of his
voice than articles do).

**Size.** Moderate: about one day. Independent; slightly better after task 1 so terms can
link to the new articles.

## Task 3: About stance page

**Goal.** The `/about` page states the editorial mission and Adrian as editor. It is the
entity anchor every schema block and outreach pitch points at, and
`todo/plans/mandala-authority.md` (line 9) and the featured-artist spec both name it as
the thing to ship first.

**Files.**
- `components/AboutPage.tsx` (new)
- `App.tsx` (add `<Route path="/about" element={<AboutPage />} />` in the main Routes
  block)
- `useSeoMeta.ts` (add a `/about` entry to `ROUTE_META`)
- Optional but recommended: `functions/about.js`, an HTMLRewriter meta-injection function
  cloned from `functions/universal-language/[number].js`, adding the `WebSite` + `Person`
  (Adrian, with `sameAs` to `https://adrianrasmussen.com/about`) + `Organization` JSON-LD
  the page-targets schema table requires; remember to add `/about` to the `include` list
  in `public/_routes.json` if a function is added.

**Spec.** Short page, 300 to 500 words: what mandalacodes.com is (an editorial project
and a living oracle), how the Featured Artists selection works (curated, not a
directory), who edits it (Adrian Rasmussen, third person), and how to reach him. Draft
the copy in editorial voice for his pass. Match the site's existing visual language
(dark, warm; check a simple page like `components/OracleSystems.tsx` for the framing
conventions).

**Marking.** SPA page: rule 4. Ship the scaffold on a branch; Adrian's voice pass happens
in PR review before merge (or land it behind a `launchFlags.ts` flag if the branch needs
to merge earlier).

**Acceptance.** `/about` renders with nav, `ROUTE_META` title/description apply,
typecheck green, and (if the function is added) `curl` of `/about` shows the injected
meta and JSON-LD in the raw HTML.

**Needs Adrian.** Voice pass on the whole page (it speaks for him); confirm the contact
path it offers.

**Size.** Quick: 2 to 4 hours. Blocks nothing but is referenced by tasks 1, 2 and 4;
build it first within this track (the SEO plans' own build order says the same).

## Task 4: Artists hub + Adrian's featured-artist page

**Goal.** Turn the complete, implementable spec at
`docs/research/seo/2026-05-28-featured-artist-page-spec.md` into shipped pages:
`/artists` (hub) and `/artists/adrian-rasmussen` (first feature, proves the template).

**Files.**
- `data/featuredArtists.ts` (new; copy the `FeaturedArtist` interface verbatim from the
  spec's Data Model section)
- `components/ArtistsHub.tsx` and `components/ArtistPage.tsx` (new)
- `App.tsx` (routes `/artists` and `/artists/:slug`)
- `useSeoMeta.ts` (`/artists` entry; the per-slug title comes from the function below)
- `functions/artists/[slug].js` (new; clone the HTMLRewriter pattern from
  `functions/universal-language/[number].js` to inject the spec's required meta and its
  three JSON-LD blocks: `Person`, `Article`, `CreativeWork` per selected work; hub schema
  `CollectionPage` can be injected client-side or via a sibling `functions/artists/index.js`)
- `public/_routes.json` (add `/artists/*` to `include`)

**Spec.** The spec document is the spec; follow its Hub Layout, Artist Page Layout
(9 numbered blocks), SEO metadata block, three schema blocks, and the per-artist Value
Capture Checklist. Implementation deltas and content notes:

1. The spec's footer CTA "back to `/artists` and `/articles`" becomes `/artists` and
   `/learn` (task 5 divergence).
2. Populate Adrian's entry from adrianrasmussen.com (about page + mandala portfolio),
   rewritten third person, editorial voice; 5 or 6 selected works with existing Cloudinary
   ids; "Find their work" links to `adrianrasmussen.com/creations/mandala`.
3. Skip the optional filter routes (`/artists/by-medium/*`); the spec itself defers them
   until 6 to 8 artists exist.
4. Skip the "In conversation" block for now (none exists); the data model keeps the
   optional field.
5. The spec's own success test: if Adrian's page reads as an editorial feature rather
   than self-promotion, the template works. Draft accordingly.

**Marking.** SPA pages: rule 4. The editorial intro, bio, and practice prose are agent
drafts of Adrian-approved facts; branch-gated until his pass.

**Acceptance.** Both routes render; the raw HTML of `/artists/adrian-rasmussen` (curl)
contains canonical tag, OG block, and all three schema block types; images load from
Cloudinary; typecheck green; the spec's Value Capture Checklist for Adrian's entry is
fully ticked except the outreach-ledger item (Adrian-side, Obsidian).

**Needs Adrian.** Approve the 5 or 6 selected works and their descriptions' facts
(year, medium); voice pass on editorial intro / bio / practice sections; the `sameAs`
back-link addition on adrianrasmussen.com is his other-repo task.

**Size.** Moderate: about one working day (the spec's own estimate). Ship after task 3
(the About page grounds the Article schema's author URL).

## Task 5: Housekeeping, correct `/articles` to `/learn` in the old plans

**Goal.** Content ships at `/learn/<slug>`; three planning documents still route
everything through `/articles/<slug>`. Correct them so no future agent builds or pitches
against dead paths.

**Files needing the correction (the complete list; verified by repo-wide grep):**

1. `docs/research/seo/2026-05-28-page-targets.md`: the Phase 1 and Phase 2 route tables,
   the Outreach Destination Mapping table (three `mandalacodes.com/articles/...` URLs),
   the "Routing Notes For Implementation" bullet that mandates the `/articles/<slug>`
   pattern, and the Schema Requirements table rows (`/articles/*`, `/articles` hub).
2. `docs/research/seo/2026-05-28-article-cluster-plan.md`: every per-article `Route:`
   line, the Phase 2 route table, and the internal-link instructions inside each
   article's structure recommendation.
3. `docs/research/seo/2026-05-28-featured-artist-page-spec.md`: the footer CTA
   ("soft CTA back to `/artists` and `/articles`") and Build Order item 2
   (`/articles/what-is-mandala-art`).

No other file in `todo/`, `docs/`, or the code references `/articles` (the only other
hit is `todo/DEVELOPMENT-STATUS.md`, which documents the divergence on purpose; leave it).

**Two extra corrections to make in the same pass:**
- Where a planned slug diverges from a live one, map to the live file, e.g. planned
  `/articles/sand-mandalas` is live at `/learn/sand-mandalas-of-tibet`, planned
  `/articles/tibetan-mandalas` territory is covered by `kalachakra-wheel-of-time` and
  `sand-mandalas-of-tibet` stubs. Check `content-site/src/content/articles/` filenames
  before writing each corrected URL.
- Add a one-line note at the top of each corrected doc: "Route correction 2026-07:
  articles ship at /learn/<slug>; /about, /artists, /symbolism status per
  todo/plans/repair/phase-4-content-and-prework.md."

**Marking / needs Adrian.** None; documentation-only.

**Acceptance.** `grep -rn "/articles" docs/ todo/` returns hits only in
`DEVELOPMENT-STATUS.md` and this brief. **Size.** Quick: under an hour.

---

# Track B: Writing-track prework (agent scaffolding only)

## Task 6: Changing-line texts, backfill `data/ichingLines.ts` (scope reduced by audit correction)

**Goal, corrected.** The audit said the 384 scaffold line texts sit unshipped in the
section files. Verified reality: they already render live. All 64 `oracle/cards/NN.md`
files carry six moving-line readings each (384 total, verified complete), and
`UniversalLanguageCard.tsx` renders `md.reading` per line with `getLineText()` from
`ichingLines.ts` only as fallback. What remains is fallback parity and honesty in the
placeholder file, not a content migration.

**The one-line decision for Adrian first:** backfill the fallback, or retire it?
- **Option A (recommended, spec'd below):** backfill `ichingLines.ts` from the card
  Markdown so every consumer (including `components/oracle/CoinCast.tsx`, currently
  unmounted, which reads lines synchronously) sees identical text with or without the
  async Markdown parse.
- **Option B:** leave the placeholders, mark the file's header as legacy-fallback-only.
  Zero work, but CoinCast (if ever remounted) can render empty lines before the Markdown
  primes.

**Spec (Option A).**
- New generator `scripts/backfill-iching-lines.ts` (tsx, matching the other scripts).
  Source of truth: `oracle/cards/NN.md`, NOT `oracle/sections/iching/NN.json`; the prose
  differs between them for some lines (verified on hexagram 27 line 3) and
  `data/cardMarkdown.ts` declares the Markdown canonical.
- Parse each card's `### Moving lines` block: entries are
  `**Line N** · _image:_ ... → becomes Hexagram M, Name.` followed by one prose
  paragraph, which is the reading. Reuse the parsing conventions in
  `data/cardMarkdown.ts` (or import its parser under tsx) rather than inventing a second
  regex dialect.
- Regenerate the `ICHING_LINES` record in `data/ichingLines.ts` in place: reading prose
  as each line string, per-line DRAFT comment per marking rule 3. Preserve the
  `HexagramLineTexts` interface and `getLineText()` untouched.
- Rewrite the stale file-header TODO: it currently says every text is an empty
  placeholder and the UI shows a quiet placeholder; after backfill it should say the
  texts are draft scaffold mirrored from `oracle/cards/NN.md`, that the Markdown is
  canonical, that this file is the synchronous fallback, and that Adrian's voice pass
  happens in the Markdown via `/cast-content` (after which the script re-runs to re-sync).
- Idempotent: running the script twice produces no diff.

**Acceptance.** Script runs green; 384 non-empty strings; a verification pass in the same
script asserts every entry matches its Markdown source exactly; typecheck green; the card
page renders identically before and after (the Markdown path already wins); zero em
dashes introduced (verified: the source prose contains none).

**Needs Adrian.** The A/B decision above (one line). The actual 384-line voice pass stays
his, in the Markdown, unchanged by this task. Also: fold the audit correction into
`todo/DEVELOPMENT-STATUS.md` section 2 (the "0 / 384, all placeholders" row) so the next
planner doesn't re-derive it.

**Size.** Quick to moderate: 2 to 4 hours. Independent of everything.

## Task 7: Per-artwork readings, scaffold the remaining 63

**Goal.** `oracle/readings/UL-122.md` (card 1, Earth's Breath, status: final) is the
authored reference. Scaffold the other 63 artworks' readings in the same structure,
rendered to draft prose by an agent, never marked final.

**Files.** 63 new files `oracle/readings/<artworkId>.md`. The id list comes from
`data/oracle-corpus.json`: each of the 64 cards has exactly one artwork
(`cards[].artworks[0].id`; card 1 is UL-122, already done).

**Process (two stages per artwork, batchable).**
1. **Machine scaffold:** `npx tsx mcp/oracle-server/src/scaffold-reading.ts <id>`.
   It writes the frontmatter (`artwork`, `code`, `card_name`, `voices: [gene_keys]`,
   `length: short`, `status: scaffold`) plus the code's assembled material as an HTML
   comment. It refuses to overwrite, so re-runs are safe.
2. **Agent render:** replace the comment block with draft prose following
   `oracle/readings/README.md` "Method (do not break these)": the Glance first
   (system-agnostic, no tradition named), then the gene_keys voice opened whole, frame
   the specific piece (title, wood and acrylic, its place in the world), quote no source
   prose, match UL-122's register and length (4 to 5 short paragraphs). New prose follows
   voice rule 5 (no em dashes; note UL-122 itself predates that rule, match its register,
   not its punctuation). Set `status: in-progress` and add the AGENT DRAFT comment per
   marking rule 2.

This is 63 independent items: run it as a gated batch (the claude-batch-runner pattern),
one artwork per agent invocation, spot-checking every tenth output against the method.

**Publication caution (resolve before merging the batch).**
`mcp/oracle-server/src/readings-cache.ts` loads any `oracle/readings/<id>.md` present and
the README says the site and the oracle MCP serve readings "when present"; the `status`
field is documented as internal, so a scaffold-status file may be served publicly the
moment it lands on main. Before merging, either confirm consumers filter on
`status: final`, or add that filter (small, agent-doable, do it as step 0 of this task),
or hold the whole batch on its branch until Adrian's pass. Do not let 63 unreviewed
readings deploy silently.

**Acceptance.** 64 files exist in `oracle/readings/`; every new file has valid
frontmatter, `status: in-progress`, the AGENT DRAFT comment, and no em dashes; 3 random
files pass a method review (Glance first, piece framed, voice opened whole); the step-0
status filter is confirmed or added; typecheck green.

**Needs Adrian.** Voice pass per reading (he authors final prose over the draft, sets
`status: final`); the step-0 serve-or-hold policy call if the filter route is not taken.

**Size.** Moderate: one batch session for the 63 renders plus the step-0 check.
Independent of Track A; independent of task 6.

---

# Task 8: Explicitly out of scope for this phase

- **The 64 opening readings rewrite:** gated on Adrian's 5-card pilot in WordForge (must
  include card 3) per `todo/plans/reading-rewrite.md`; nothing here assumes them.
- **Invocations (cards 2 to 64):** explicitly non-delegable, Adrian's voice only.
- **Gene Keys / Human Design / Relations voice passes:** the scaffolds exist; the passes
  are Adrian's, and how far more scaffolding is worth pushing waits on the deep-pass call.
- **Piece stories (story / materials / photos per piece):** live in the production
  database via the built piece-content editor, not in files; Adrian writes them there.
- **The deep-pass rewrite decision (the 122-card question):** deferred until the reading
  pilot passes; the 3-card pilot files sit ready and the loader already prefers them.

---

## Suggested execution order

1. Task 5 (housekeeping, unblocks correct linking everywhere) and task 6 step-0 decision.
2. Task 3 (About) then task 4 (Artists): the entity spine, in the SEO plans' own order.
3. Task 1 (three articles) and task 2 (glossary), in parallel with 3 and 4.
4. Task 6 backfill and task 7 batch: any time, fully parallel to Track A.

Everything lands branch-first; nothing visitor-visible with un-passed voice merges to
main (auto-deploy is ~2 minutes).

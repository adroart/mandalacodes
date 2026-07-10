# Development status — everything not fully fleshed out

_Compiled 2026-07-10 by a five-way audit of every plan file against the actual code on `main`
(the working tree is at parity with `main`, so what's here is what's live). This is the
"where are we, what's left" map for building a single bring-it-together plan. Each item says
what's done, what remains, rough effort, and who has to do it:_

- **agent** — an AI session can build it end to end.
- **agent + Adrian** — agent scaffolds, Adrian supplies the voice/sign-off.
- **Adrian** — only Adrian can write it (his voice) or do it (his credentials).
- **ops** — a live-system action (credentials, migrations, dashboard), Adrian-only.

The single biggest fact: **most of the machine is built and merged.** The two large buckets of
remaining work are (1) a handful of unfinished features, most of them small, and (2) a very large
pile of writing that is Adrian's voice by design. One operations gate is quietly holding several
finished features dormant.

---

## 0. The one thing holding finished features hostage (ops)

The keepsake-book system — inscriptions, the signed export, and the sale hand-off from the art
site — is **fully built and deployed but returns a graceful error on the live site** because the
database tables it needs were never created, and its secrets were never set. Nothing is broken;
these features just stay asleep until the go-live checklist runs. Full command list:
`todo/handoff/GO-LIVE-RUNBOOK.md`; ledger: `todo/handoff/MORNING-AFTER.md` (only step a, the merge,
is done).

| Step | Consequence until done | Owner |
|---|---|---|
| Create the two new database tables (inscriptions + sale events) from the art-site repo | Writing an inscription, exporting the book, and receiving a sale all error out live | ops |
| Set the sale-webhook secret + the claim-bridge secret on both site projects | The sale hand-off and self-serve claim stay closed | ops |
| Build the sale-notification sender on the art site (adrianrasmussen.com) | A sale there never tells this site to open a claim | Adrian (other repo) |
| Turn on the public mirror (tamper-evidence copy of the ledger) | No external proof-of-record | ops |
| Baseline backup, then claim light #1 (the ignition), then begin collector outreach | The map stays dark; the launch story can't start | Adrian |

---

## 1. Agent-doable feature work (no writing required)

### Quick wins — small, self-contained, low risk
1. **"Save this card" button is built but never placed on the card page.** The whole save-to-collection
   system works and has its own page; the button component just isn't dropped next to Acquire/Share on
   the card. → `components/account/SaveToCollectionButton.tsx` (unused), `components/UniversalLanguageCard.tsx`. _Quick · agent._
2. **Today/Year energy panels are built but not shown anywhere.** Two working panels were ported from the
   art site and never mounted on any page. → `components/oracle/{TodayEnergyPanel,YearEnergyPanel}.tsx`. _Quick · agent._
3. **Kinship "threads" silently hide some arcs.** The globe caps how many connection threads it draws and
   only logs it to the console; add a "showing X of Y" line to the filters row. → `components/AtlasPage.tsx:469`. _Quick · agent._
4. **No path from the entry gateway to the birth-chart flow.** The gateway has three links, none into the
   profile; a QR visitor can't find the chart. Add a fourth quiet link. → `components/OracleGateway.tsx:210`. _Quick · agent._
5. **"Founding light" is shown but never defined** for a first-time visitor (the other atlas terms —
   threads, Seeking ground — are already explained). Add one sentence where it appears. → `components/atlas/PieceSidePanel.tsx:143`. _Quick · agent._
6. **A wrong code-comment about hexagram line order** (says top-to-bottom, stores bottom-to-top) invites
   a future bug. → `data/trigrams.ts:4`. _Quick · agent._

### Medium features
7. **"My collected cards on the map" view doesn't exist.** Collections list generically with no join to
   which of your saved cards are actually placed on the globe. → `components/account/CollectionsManager.tsx`. _Moderate · agent._
8. **The globe stacks every piece on the exact city point** — 20 pieces in one town pile into one
   unreadable dot. The plan wants one marker per city, sized and numbered by count, with a city-list
   panel. Nothing built. → `components/AtlasPage.tsx` (globeNodes memo, line 316), `piece-page-buildout.md`. _Deep · agent, Adrian UX sign-off._
9. **The hexagram ring on the globe is decorative, not tappable.** "The Field" lens 1 wants every glyph
   clickable to open that code's pieces; the ring renders as atmosphere with no click handling. → `components/atlas/three/HexagramRing.tsx`. _Moderate · agent._
10. **No flat "all 64 codes" index on the atlas, and no "tap a code → its pieces with honest states"
    view** (e.g. "Earth's Breath · 1 of 3 · Bali, kept · Berlin, seeking"). Part of the same lens-1 gap. _Moderate · agent._
11. **The yearly "shall I keep carrying these words?" ask is missing.** "The Field" lens 2 (the dream map)
    is otherwise shipped — sharing, the tending queue, rehoming letters all work — but the once-a-year
    reconfirmation loop for shared words was never built. → new letter type + a "years since shared" check
    mirroring the existing anniversary logic. → `utils/letters.ts`, `functions/api/atlas/steward/letters.ts`. _Quick–moderate · agent._
12. **The guided founding-story tour ("the procession") doesn't exist.** Meant to be the low-key
    engagement engine that narrates the founding lights in order; grep finds nothing. The ignition opening
    and claim-replay animations exist but are not this. → design-first. _Moderate–deep · agent, brainstorm with Adrian first._
13. **Two duplicated data definitions invite drift:** the 11-position sphere sequence is hardcoded in two
    places, and the profile-key list in two more. Extract one shared source (note: one consumer is a plain-JS
    site function that can't import the typed libs, so it needs a shared plain constants file). → `data/profilePositions.ts`, `lib/oracle/recommendation.ts`, `functions/api/profile/put.js`. _Moderate · agent._
14. **The city picker is copy-pasted three times** (admin map, steward edit, piece editor). Extract one
    shared component. → `components/AdminAtlas.tsx:104`, `components/StewardEdit.tsx:481`, `components/AdminPieceContent.tsx:61`. _Moderate · agent, needs light/dark visual QA._
15. **Admin can see a steward's outreach status but can't change it** — it's read-only, only the claim flow
    flips it. Needs a small edit control + endpoint, and first a decision on what manual states mean. →
    `components/AdminAtlas.tsx:1233`. _Moderate · Adrian policy call, then agent._
16. **Two hexagram drawers still bypass the shared glyph module** (the gateway's orbital one and the
    coin-cast animated one), risking visual drift. Full unification is deep and needs a visual-parity
    sign-off; the comment fix in #6 is the cheap half. → `components/oracle/HexagramGlyph.tsx:8`. _Deep · agent + Adrian sign-off._

---

## 2. Adrian's-voice writing (the real content backlog — not delegable)

Counts verified against the actual content files, not the stale TODO.

| Writing surface | Done / total | Notes |
|---|---|---|
| **Rewrite the 64 opening readings** | 0 / 64 | Not started; gated on a 5-card pilot (must include card 3). Plan wants it built inside the WordForge tool, not a batch. → `todo/plans/reading-rewrite.md` |
| **Invocations (cards 2–64)** | 1 / 64 | Explicitly non-delegable; only card 1 exists. |
| **Gene Keys sections → final** | 2 / 64 | Rest are agent-written scaffold awaiting Adrian's pass. |
| **Human Design sections → final** | 3 / 64 | Same. |
| **Relations sections → final** | 2 / 64 | Same; the panel is now wired live (TODO's "not wired" is stale). |
| **Live changing-line texts** | 0 / 384 | All placeholders in `data/ichingLines.ts`. Scaffold prose for all 384 exists in the section files and could be migrated in as drafts by an agent. |
| **Per-artwork readings** | 1 / 64 | UL-122 is the reference; an agent can scaffold the rest, Adrian authors the final prose. |
| **Piece stories** (story / materials / photos per piece) | unknowable from repo | Lives in the live database via the piece-content editor, not in files. The editor is built; the 64 stories are Adrian's to write. |

**Open decision — the deep-pass rewrite.** A deeper rewrite of the 61 remaining I Ching + Body cards is
drafted only as a 3-card pilot (6 of 128 files). The loader already prefers deep files automatically, so
committing them would swap them in. The "run the full 122-card deep pass?" call is still open. _Agent-doable
structural work; result stays scaffold until Adrian's pass._

---

## 3. Authority / SEO / editorial (mixed agent + Adrian)

The editorial site engine (the **Learn** library) is fully built and deploys at `/learn`; only the article
corpus is thin. **Note two divergences from the old plans:** articles ship at `/learn`, not `/articles`, and
the `/about`, `/artists`, `/symbolism` routes the plans assume **do not exist yet**.

- **Four core launch articles:** 1 of 4 written ("What Is Mandala Art?"). Missing: sacred geometry,
  commissioning a mandala, laser-cut wooden mandalas. _Moderate each · agent draft + Adrian voice._
- **Depth-article cluster:** only ~180-word stubs exist (a "traditions of the world" teaser set), not the
  1,500–2,500-word depth articles specced. _Moderate–deep · agent draft + Adrian voice._
- **Symbolism glossary** (`/symbolism` hub + two sub-pages): not started. _Moderate · agent._
- **About stance page:** not started. _Quick · agent + Adrian voice._
- **Artists hub + Adrian's featured-artist page:** not started; a full spec exists
  (`docs/research/seo/2026-05-28-featured-artist-page-spec.md`). _Moderate (~1 day) · agent scaffold + Adrian._
- **Mandala-authority campaign** (8 phases: outreach, press kit, forums, citation tracking): only fragments
  of phase 1 exist; the rest is mostly Adrian-side / Obsidian work. → `todo/plans/mandala-authority.md`.

---

## 4. Bigger not-started tracks (Adrian-gated)

- **Light Codes deck:** only type-level scaffolding (a color and a series name). Contrary to the TODO,
  **no route is reserved** and no card corpus is in the repo — Adrian must point to the content. _Deep · Adrian + agent._
- **More decks beyond Universal Language:** same — types anticipate it, nothing routes. _Deep · Adrian-gated._
- **In-site chart→art lookbook flow:** the command-line generator is built; the in-site client/admin flow
  and the priced, purchasable client page/PDF live on the **art site**, not here — correctly split. The
  recommendation endpoint on this side is done and live. → `todo/plans/adrian-quote-integration.md`. _Deep · Adrian-Website repo._
- **Search embeddings (optional):** not started, and explicitly optional — the concept-expansion search is
  the shipped floor. Would need new AI/vector infrastructure provisioned. _Deep · agent + ops._
- **Register the remote oracle connector in Claude:** the endpoint is live and valid; registering it is a
  dashboard action. _Quick · ops._

---

## 5. Corrections to the current TODO (stale claims found during the audit)

- The **Relations panel is already wired live** — TODO item calling it "not wired" is stale.
- The **Light Codes route is not reserved** — no such route exists in the app.
- **There is no `AdminPieces.tsx` importing a retired login library** — the file doesn't exist; the admin
  screens that do exist use the current login library. That TODO item is void.
- **Sign-up UI is done** (built into the sign-in panel), not pending.
- Editorial content is at **`/learn`**, not the `/articles` path the SEO plans reference.

---

---
---

# Part II — Wiring & flow map (for the repair plan)

_Added 2026-07-10 from a second three-way audit focused on the registration + living-legacy
system and how every surface connects. This is the "make it one organism" material to hand to
Fable. Verified spot-checks confirmed the highest-stakes claims (see §D)._

**The one fact that makes almost all of this cheap:** every system already shares one number —
**code N = card N = hexagram N = gate N = the piece's card number.** The join key exists on both
ends of nearly every missing link. The site is far closer to "one connected whole" than it looks;
most seams are unrendered links and unmounted components, not missing data.

## A. Broken journeys — where a real person hits a wall (ranked by leverage)

1. **The sale hand-off is silent — the buyer is never told to come claim.** When you confirm a
   sale (or a holder/admin approves a stewardship request), the piece's book is bound to the
   buyer's email, but **no email or notice is ever sent to them.** The whole hand-off ends in a
   queue only you can see; a real buyer never arrives. → `functions/api/atlas/sales/confirm.ts`,
   `steward/resolve-claim-request.ts` (no notify call; the email machinery for letters already
   exists and could be reused). _Ties to the ops gate in §0._ **Highest-leverage fix on the board.**
2. **Anyone not pre-registered hits a dead-end.** A signed-in visitor whose email isn't already on
   the piece is told "send Adrian a note" with no link, no contact, no path to the self-serve
   request. The exact person the system exists for — a gift recipient, secondary owner, auction
   winner — walls off. → `components/atlas/StewardClaim.tsx` (`no-record` branch). And the loudest
   button on the piece page funnels buyers straight into this wall; the correct quiet path sits
   below it.
3. **No globe at all on low-end devices.** The entire globe stage is gated on 3D support with no
   fallback — the simpler globe and side-panel are imported but never rendered. A visitor without
   3D sees only the "Seeking ground" list and a footer, not even the page title. → `components/AtlasPage.tsx`
   (missing non-3D branch; the fallback components are already imported).
4. **The oracle card is a one-way island.** A reader on a card cannot reach the physical piece, its
   living book, or its place on the map — the card only links onward/outward to the deck and the
   external art site. It already computes which piece embodies the code; it just never links to it.
   (A code comment even claims a "See it on the Atlas" bridge exists — it does not.) → `components/UniversalLanguageCard.tsx`.
5. **Owner flow needs at-the-control nudges.** The steward book guides well at the top (a
   state-aware welcome, and letters do auto-open on arrival — that part is done right), but after
   scrolling down and placing or inscribing, there's no nudge toward the next step. → `components/StewardEdit.tsx`.
6. **Selecting a "Seeking ground" piece appears to do nothing** (the panel that would show it lives
   up inside the 3D stage), and **there's no way to acquire or enquire about a non-deck piece from
   the globe** — the only acquire path runs through a card number that non-deck pieces don't have.

## B. Orphans & dead code (built, then stranded)

- **~2,200 lines of superseded oracle-reading code sit dead** — the old reading/index design,
  replaced by the current Oracle Entry deck but never removed. Largest: the old 64-code index
  (933 lines), the coin-cast ritual (629), the old card-entrance (404), a chapter wordmark (242),
  plus a correspondence sheet, constellation, image viewer, reading stage, system overlay, profile
  summary. _Decision needed: delete, or re-mount the pieces worth keeping (see the casting ritual, §C10)._
- **A duplicate account button** (superseded by the nav item) and **leftover longform-reading
  scaffolding** (back-to-top, side-nav, progress bar) render nowhere.
- **The `/gateway` entry page is stranded** — nothing in the app links to it; home redirects past
  it to the deck. Either link it or drop the route.
- **The whole oracle HTTP surface (search / card / recommendation / casting) has no in-app caller** —
  it's currently external-only (for the connector and the build script). Fine if intentional, but
  it means the recommendation engine and full-text search are invisible to visitors (see §C4).
- **The erase / break-glass endpoint has no admin button** — curl-only. Likely intentional; confirm.

## C. Connector opportunities — cheap-first (both ends already exist)

1. **Turn on the Learn-article → card link (one line per article).** The bridge is fully built —
   schema field + a rendered "Explore Card N in the deck →" footer — but **0 of 11 articles fill in
   the card number**, so it ships disabled. Each article's cover image already encodes its card.
   Cheapest high-value connector in the codebase. → `content-site/src/content/articles/*.mdoc`.
2. **Mount the "save this card" button.** The collections system is fully built and its empty state
   literally promises "save cards from any reading," but the button that saves is mounted nowhere —
   collections is non-functional by omission. → put `SaveToCollectionButton` on the card page.
3. **Link the card → its physical piece + its place on the globe.** Additive; the reverse links
   (globe→card, piece→card) already exist. Closes the loop with §A4.
4. **Surface the chart→art lookbook in the site ("The Art of Your Chart").** The engine that turns a
   visitor's birth chart into a personalized gallery of the actual artworks is fully built and
   consumed **only** by an external endpoint and an offline generator — zero in-app use. This is the
   richest built-but-unreachable experience in the codebase, and the client already holds the chart
   data to power it. → `lib/oracle/recommendation.ts`.
5. **The profile is the natural hub the organism is missing.** It already links each chart position
   to its card; it could just as easily be the door to your collections, the lookbook (#4), today's
   real transit (#9), and your pieces on the map. Also: add Profile to the main nav — today it's
   reachable only via in-page links.
6. **Give the public piece page what the globe already shows for the same piece** — the shared
   dream/intention, the kin constellation, the holder's chart element. Today a collector meeting the
   piece by scanning its code sees *less* than a stranger browsing the globe.
7. **Light the signed-in owner's own pieces (and saved cards) on the globe.** Personalization today
   is only the birth-place pin and the "your codes" lens; the map never fetches which pieces you steward.
8. **Deck ↔ Learn is one-directional and mostly dead** — once #1 is on, a card→article reverse link
   is trivial (same number). And Learn bills itself as the library behind the three wisdom systems
   but has no article on any of them; those live only in the systems page, which never links to Learn.
9. **Mount the Today/Year energy panels and make the daily card real.** The engine computes the true
   Sun-transit code, but its only consumers are unmounted, and the live "today" tile is a **date hash,
   not the sky** (verified). Mounting them gives a genuine daily reason to return.
10. **Re-mount the coin-cast divination ritual** (if kept from §B) — a full casting flow that already
    routes its result to the changed code, built and unreachable.
11. **Smaller:** color the kinship threads by their shared trigram and show distance (both computed,
    both discarded); deep-link each "Seeking ground" item to its own claim path and code; include
    letters + heir registrations in the exported keepsake book (today it drops the two richest parts).

## D. Rich data computed but shown nowhere (the latent assets)

The chart→art lookbook; the real daily/yearly transit; each card's traditional colors and color
inspiration (rendered nowhere, despite the art being about color and light); the holder's chart
element and shared dream per piece (globe-only); kinship trigram-binding and great-circle distance;
story/dedication inscriptions and counts (only "intention" ever surfaces); letters and heirs (absent
from export); city region (dropped from every label); stored birth coordinates (only the one pin);
and full-text oracle search (its only UI lived in the now-orphaned old index).

**Verified during this audit:** the casting ritual is imported nowhere (so the "per-hexagram
becoming" task in Part I sits on a dead component — remount first, or drop it); 0 of 11 articles set
their card link; the save button renders nowhere; the daily card is a date hash, not astronomy.

---

## Dependency notes (the constraints Fable should plan around)

The findings above are ranked by leverage, not sequenced. These are the real ordering constraints —
what must precede what, and what is independent:

- **The silent sale hand-off (Part II·A1) can be built any time, but only *works live* after the ops
  gate (§0): the two tables, both secrets, and the art-site sender.** So the code fix and the ops
  steps are a single launch unit — neither delivers value alone. Plan them together.
- **The non-registered dead-end (A2) and the non-3D globe fallback (A3) are fully independent** — pure
  front-end, no ops, no content, no decisions. They can ship immediately and in parallel.
- **The card→piece/globe links and the cheap connectors (C1–C3, C6, C7) are independent of everything
  else** — the join data already exists on both ends. Only gated by nothing.
- **The "per-hexagram becoming" writing task (Part I) sits on dead code.** It depends on first deciding
  the dead-reading-code question (Part II·B / C10): if the casting ritual is deleted, the becoming task
  disappears; if it's re-mounted, the task becomes real. Decide B before scheduling that task.
- **The deep-pass rewrite decision (Part I·§2) gates card content throughput** — an agent can only
  advance Gene Keys / Human Design / Relations so far before it collides with your voice pass; deciding
  the deep pass sets how much scaffolding is worth doing now.
- **The 64-reading rewrite is gated on your 5-card pilot** (must include card 3) — nothing downstream
  should assume readings before that pilot passes.
- **The two refactors (shared sphere data, shared city picker) are independent but must be
  typecheck-verified before pushing** — the enforced check will reject otherwise.
- **The "Field" finish items are independent of each other:** the yearly-words ask, the tappable code
  ring, and the procession can be scheduled in any order or dropped individually.
- **Everything in the writing backlog (Part I·§2) is yours and unblocks nothing else** — it runs on its
  own track in parallel with all agent work; treat it as the long pole, not a dependency.

## Starting hypothesis for the plan (Fable's to reason over, not a plan)

_This document is diagnostic input. Fable is the planner — it should architect the actual sequence
and dependencies. The order below is a starting hypothesis to react to, not the plan itself._

1. **Close the collector journey first — it's the launch path and it's broken end to end.** The sale
   hand-off is silent (Part II·A1), non-registered buyers dead-end (A2), and the whole thing depends on
   the ops gate (§0). Until these three are fixed, a real buyer literally cannot arrive. This is the
   highest-stakes cluster on the board.
2. **Unblock the dormant features** (§0) — one ops sitting wakes the built keepsake-book / sale system.
3. **Sweep the wiring quick wins** (Part I quick wins + Part II·C1–3): turn on the article→card link,
   mount the save button, link the card to its piece and the globe, add the six small connectors. All
   pure wiring over data that already exists — one agent batch.
4. **Decide the two big latent assets** (Part II·C4, C10): surface the chart→art lookbook in the site,
   and whether to re-mount vs delete the ~2,200 lines of superseded reading code (Part II·B).
5. **Pick the "Field" finish line:** the yearly-words ask (Part I·#11) and the tappable code ring/index
   (#9–10) complete the flagship map; the procession (#12) is the optional depth.
6. **Decide the deep-pass rewrite** (Part I·§2) — it gates how far an agent can push card content
   before your voice pass.
7. **Writing is the long pole** and only you can do most of it — the 64 opening readings, invocations,
   line texts, and piece stories. Everything above is scaffolding to make that writing land well.

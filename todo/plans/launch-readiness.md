# Launch readiness: the plan

Written 2026-09-01 from nine measured audit reports (site, API, UI, collector journey, writing pipeline, writing quality, reader experience, engineering health, cross-repo). Every claim below traces to a measurement, not a doc. Where two reports disagreed, the disagreement is resolved here in one line, not listed twice.

## The verdict

The oracle itself is launchable now. Arrive, browse, open any of 64 cards, read six complete lenses, cast the coins, compute a birth chart, share with a real preview image: all of it works, asks for nothing first, and the build, tests, and content pipeline behind it are clean.

The single thing most wrong is the collector layer. Every collector action answers a dead endpoint, the ceremony ends in error loops showing raw machine strings, and the live globe shows five invented pieces with an invented dream. The switch that fixes the journey lives in the other repo. What this repo must do is stop presenting a broken ceremony and an untrue record.

The path: one short pass makes the site honest, one template pass fixes the writing's real weakness, and the expensive rewrite you had scheduled gets re-scoped, because it targets the best prose in the deck.

## What is already good. Do not spend a day here.

- The build compiles clean, typecheck passes, all 696 unit tests pass. The one "failure" was a sandbox artifact.
- Nothing is blocked on secrets or provisioning. Every production secret is set. The ops-gate section of the status doc is stale and points at the wrong cause.
  Detail: todo/DEVELOPMENT-STATUS.md section 0; report 04 measured the secret names live.
- Five of the six "quick wins" the status doc lists as broken already shipped: energy panels, kinship count, gateway birth-chart link, founding-light explainer, trigram comment.
- All 64 cards carry complete prose in all six lenses, enforced by a fail-closed build validator. The generated card data is byte-identical to a fresh rebuild.
- Auth is sound everywhere: no missing admin or steward gate was found in 87 API files. Sign-in works live.
- The card share preview is real edge-rendered art. The QR path to a piece page is intact end to end. The birth-chart math verified against a real fixture, 11 of 11 positions.
- The opening readings are the best-written section of the deck: the only one of six with zero verbatim repetition across cards, and the sampled prose is genuinely strong.

---

# Half one: the site

Owner: agents, on your veto. Clock: days, not weeks.

## Do first

### 1. Take the five invented pieces off the public record
Agent. Two hours.
Detail: lib/atlas/state.ts swaps in data/atlasPlaceholder.ts when the feed is empty; the file's own header names the removal steps.
The record is the product's whole premise, and today it is five fabricated placements and a dream signed "a sample steward." When done, the globe stands empty and honest. Your own words: the globe is piece zero; light means a life is attached. An empty globe keeps that promise. Five invented lights break it.

### 2. Close the broken ceremony on every collector screen
Agent. One to two days.
Detail: about twenty screens still call the endpoints retired 2026-08-09 and render raw strings like "atlas_moved"; the 410 response already carries the canonical destination, and the UI throws it away. Worst cases: the claim page's infinite retry loop, and claim and edit bouncing a signed-in collector between two error screens forever.
When done, a collector or visitor who reaches any retired surface sees one calm sentence saying the record now lives on the artist's site, with a working door there. No error codes, no loops, no dead buttons. This is the honest boundary until the other repo's switch flips; it is not a rebuild, and no retired endpoint gets revived here.

### 3. Stop the reading from silently blanking for QR arrivals offline
Agent. Half a day.
Detail: the offline warm-up runs only on the deck index, never on the card page, which is the QR arrival surface; a failed prose fetch is swallowed and the reading renders permanently empty with no message. The honest on-brand message already exists in the chunk error boundary; extend it to this path and warm from the card page too.
When done, someone who scans a plaque with a weak connection sees either the full reading or one clear sentence, never a stripped page that looks broken.

### 4. Let a visitor actually save a card to a collection
Agent. Two hours.
Detail: the save button exists, the wiring plan exists at todo/plans/repair/phase-1-wiring-queue.md, and nothing renders it; Collections is currently a dead end a visitor can create but never fill.
When done, the account area's one interactive feature works instead of quietly humiliating anyone who tries it.

### 5. Sweep the italics and em-dashes out of visitor-facing and admin text
Agent. One day.
Detail: italic is the default style for error and status text across the admin and steward surfaces and for the live reading header; em-dashes ship in error screens, Gene Keys role descriptions, piece letters, and aria-labels. The reading-header fix also collapses its 108 hardcoded hex colors onto tokens, which is the same edit.
When done, every error message and the reading's own header obey your two locked rules, in exactly the text you read under pressure.

## Second tier, after the five above

- Delete confirmed dead code so nobody edits a fossil: the unused coin-cast file, the superseded seeking-ground list, the unused continue rail. Agent, two hours. Resolves the one report conflict here: a working cast already ships inside the live reading, so the 630-line orphan is deleted, not wired.
- Give the lazy-route fallback a quiet branded loading state instead of a blank rectangle, and restyle the crash screen to the house palette. Agent, half a day.
- Persist a coin cast across reload. The throw is a ritual; it should not evaporate. Agent, half a day.
- Give the shared birth-chart link a real preview image, same edge pattern the card pages already use. Agent, half a day.
- Fix the numbered-card dead end: an out-of-range card URL currently renders one line with no navigation at all. Agent, an hour.
- Add the missing-table fallback to collections and profile queries, matching the hardening the atlas side already got after the migration collision. Agent, half a day.
- Add the web-server block to the Playwright config so the mobile suite stops conflating "no server" with "broken app", then re-measure and fix what is really red. Agent, one day.
- Wire the QR arrival to the built gateway screen. The orbit entrance was purpose-built for plaque scans and nothing points at it. Agent, one hour; look at it once on the dev server and veto if it does not feel like the arrival you want.

## Not before launch

- Sign-up UI port, the procession tour, the lookbook flow, the acquire configurator, SEO article clusters, the authority campaign, Light Codes, the OracleSystems network map, per-hexagram becoming texts, rate limiting on auth-gated writes, PWA precache tuning, dead dependency removal.

---

# Half two: the writing

Owner: you, with agents doing everything that is not taste. Clock: your reading hours are the scarce resource; spend them where the deck is actually weak.

## The inversion, plainly

The section scheduled for a full 64-card rewrite, the opening readings, is the best writing in the deck: zero repeated phrasing, strong imagery, and most endings already lift. The five teaching sections beneath it, which nothing schedules for anything, repeat the same opening sentence on 45 to 64 of 64 cards. A reader feels this the moment they open a second card. The plan below aims the effort at the repetition, and shrinks the rewrite.

## Do first

### 1. Run the diversify pass on the three sections it never reached
You: fifteen minutes approving a banned-phrase list. Agents: three waves of 64 first-and-last-sentence rewrites, roughly a day each.
Detail: the I-Ching section opens identically on 64 of 64 cards, Relations on 61, Body on 57; the exact repair brief already exists and fixed Gene Keys and Human Design this same way. One addition to the copied brief: ban the repeated closing sentences too, which is why two ticks survived the earlier passes.
When done, reading a second card no longer feels like re-reading the first. This is the single largest felt improvement available anywhere in this plan.

### 2. Kill the underscores shipping on the live page
Agent. One hour.
Detail: 136 underscore-wrapped spans, mostly "The inward face of the Shadow" and its sibling on 35 cards each, reach the deployed corpus intact; readers see either literal underscores or italic sentences, both wrong. Strip in the parser or convert to subheadings.
This is the only text defect a visitor can see today.

### 3. Fix the front door so the June failure cannot recur
Agent. Half an hour.
Detail: the agents' entry file routes every writer to an index that omits the canonical structure spec, the template, and the rewrite plan, and six section briefs still instruct writing into a dead JSON tree. Banner the index, reorder it, retire the dead routing.
The supersession work from July was thorough; this is the one path around it, and it costs nothing to close.

### 4. Rescue the orphaned invocation and restore your ledger
You: fifteen minutes confirming which lenses you consider finished. Agent: one hour.
Detail: card 1's invocation, the only sample of a whole planned voice, lives in a file nothing reads; move it into the card manuscript. And the markdown migration silently reset your finished marks: only card 3's survive, so the deck's own ledger says nothing is done, including your locked work on cards 1 and 2.
When done, the deck's status tells the truth and your one invocation cannot be lost the way the deep-pass prose was.

### 5. The skeleton-and-trim pass on the openings
You: one hour reading five cards on the live page first, see decision two below. Agents: a targeted pass on roughly 30 third paragraphs plus a length trim, two to three days.
Detail: what is measurably wrong with the readings is not tone. All 64 share one three-move skeleton, 54 third paragraphs open with the same four turn formulas, six cards use "takes most of a life" verbatim, and all 64 run about thirty percent over their own word budget in a deck whose constitution forbids uniform length.
When done, the deck's best section loses its one visible tic without losing a word you would miss.

## Second tier

- Regenerate the 43 lineage-phrase paragraphs once you rule on decision three. Agent, half a day after a two-minute call from you.
- Vary the uniform lengths where a code genuinely earns more or less. Card 1, pure originating force, currently has the shortest I-Ching section in the deck. Agent proposes, you skim.
- Backfill the missing sourcing and fact-check notes on the 21 undocumented cards, concentrated in cards 52 to 64. Agent, a day.
- Add a build check that the hand-kept color file cannot drift from the card manuscripts. Agent, two hours.

## Not before launch

- The 63 remaining invocations. Yours alone, and the deck is whole without them.
- The 64 per-artwork readings. One exists, it is off-standard, and none of them can reach a visitor anyway until wiring exists. Write none until display wiring is decided.
- The 384 changing-line texts.
- The full deep-pass rewrite of I-Ching and Body. The diversify pass above removes the symptom the deep pass was chasing.

---

# The decisions only you can make

### Decision one: launch the oracle now, or hold for the collector
My recommendation: launch the oracle now. Ship Mandala Codes as what it already is, an oracle that teaches, with the honest boundary from site item two and an empty truthful globe from site item one. The collector switch is a flag on the artist site, and flipping it is that repo's work: verify the journey end to end behind the flag there, then turn it on. Holding this site hostage to that verification gains nothing, and the retired endpoints here should not be revived either way. This resolves the two reports that disagreed: the deliberate wall stands, the fix is on the other side.
Detail: the flag is livingLegacy in the artist site's launch flags; a companion flag there also keeps acquisition an inquiry rather than a checkout, which is why the sale webhook never fires. One dedicated session in that repo settles both.

### Decision two: the reading rewrite, as scoped or re-scoped
My recommendation: re-scope it. The plan's two loudest diagnoses no longer match the shipped text: the endings mostly lift, and the openings mostly start lit. What remains unproven is the synthesis claim, whether each reading speaks all four lenses or only the Gene Keys arc, and that is exactly what your one hour of reading the five pilot cards on the live page settles. So: keep the pilot gate, read the five as they stand today, and if they feel whole, cancel the 64 ratified centre sentences, the plan's only step that cannot be delegated, and let the skeleton-and-trim pass stand in for the rewrite. If the five read as one tradition wearing four names, the original plan stands and runs inside WordForge as designed. Either way you decide from the live page, not from a diagnosis written before the text you would be judging.

### Decision three: is "the lineage calls" a voice or a leak
My recommendation: cut it. Forty-three cards say it because one sentence in one brief licensed it, and your own master rule, convey the concept as if you arrived at it yourself, argues it tells the reader there is an authority behind the page. If you rule the other way and keep it as in-world voice, three instances still go regardless: the card that cites a scholarly edition by name, the card that names the Gene Keys framework outright, and the "every mystical tradition" flourish. Whichever way you rule, the brief is fixed first so the next pass cannot write it back.
Detail: cards 60, 12, and 26 are the three that go regardless; the licensing sentence is in the Human Design bridge brief.

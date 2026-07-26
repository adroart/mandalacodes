# Piece page clarity — the stranger's on-ramp

> Status (2026-07-26): design plan + exact wording, ready to implement.
> Scope: `components/PiecePage.tsx` only. Copy and grouping, no new data,
> no new endpoints. Sibling of `piece-page-buildout.md` (that plan is about
> content plumbing; this one is about comprehension).

## The problem, precisely

The page is written entirely in the project's private language and never
teaches it. A stranger who scans the QR on the back of a piece meets nine
invented terms with zero definitions: sigil, keeper, dream, founding light,
constellation, ledger, book, kin, thread, chart of Fire. The only orienting
sentence on the whole page ("This page is the certificate of the physical
work") is one line, below the fold, after every term has already appeared.

Three specific failures:

1. **No on-ramp.** Nothing tells a newcomer what this page IS, what the
   system IS, or why any of it matters, before the poetry begins.
2. **Grouped by data source, not by reader question.** "The work" holds six
   unrelated blocks (story, specs, materials, provenance, hexagram, gallery).
   The chapter titled "The dream it carries" does not contain the dream (the
   dream lives up in the certificate); it contains kinship links and the
   holder's birth element. Two claim CTAs use two different verbs ("Begin"
   and "Open this piece's book"), so they read as two different features.
3. **Everything at one volume.** The certificate stacks nine centered blocks
   at near-equal visual weight. Apple's grammar is the opposite: one hero
   idea per screenful, each invented term defined the moment it first
   appears, one CTA phrase repeated verbatim.

## The design principle

Do not de-poeticize. The invented language is the brand. The fix is the
Apple move: ground each term with one plain clause at first use, then use it
freely. ("Dynamic Island. A new way to interact with iPhone.") Plain sentence
opens the door; the poetry walks through it. Restraint is the respect
(atlas-experience-intention, essence point 5).

Three mechanical rules:

- **Ground once, then trust.** Every invented term gets exactly one plain
  apposition on its first appearance. Never re-explain.
- **One question per group.** Each section answers a single reader question,
  named by its header.
- **One verb per audience.** "Become its keeper" for a piece without a
  keeper. "Claim your piece" for the person who already holds one. Never mix.

## The structure (six zones, top to bottom)

1. **The certificate** (keep, tighten). Artwork, series, title, sigil, then
   a NEW one-line caption that grounds the entire page. Dream, standing
   line, founding light, seal. Nothing else.
2. **How this works** (NEW, the highest-leverage addition). Three short
   statements directly below the certificate. Teaches the whole system in
   about fifty words. Replaces the lone "This page is the certificate of
   the physical work." line.
3. **The work.** What is this object: story, one museum-style wall label
   line (edition, dimensions, materials), materials/provenance notes,
   gallery. The hexagram block MOVES OUT of this section.
4. **Its story.** The public spine, unchanged in structure, one line
   reworded.
5. **Among the others** (renamed from "The dream it carries"). Its place in
   the whole: the code (moved here), kin, and (decision pending) the holder
   element line. One grounding sentence under the header.
6. **The door.** One claim block, one verb, unchanged position.

## Exact wording

### Zone 1 — the certificate

**New caption, directly under the sigil** (font-display, ~15px, wood-600,
center, max-w-md):

> Made by hand by Adrian Rasmussen. This page is its certificate: what it
> is, the dream it keeps, and the hands it has passed through.

(Not "an original work": the pieces are made to order and one design can
exist in numbered editions, so "original" over-claims. "Made by hand" is
the true superlative.)

**Invitation band** (seeking pieces only).
Before: "This piece is ready for someone to become its keeper and infuse it
with their dream. Begin →"
After:

> This piece has no keeper yet. Whoever takes it home writes one dream into
> it, and that dream stays with the piece for life. **Become its keeper →**

**Founding light explainer.**
Before: "A founding light marks the order in which a piece was claimed by
its keeper."
After (keeps the big ordinal and "the Nth light of the constellation" line
above it):

> Each claimed piece receives its number in the order it came to light. It
> can never change and never be taken away.

**Standing lines.** Keep "alive in Copenhagen" and "In the hands of its
first keeper" exactly as they are. By this point both words are grounded.

**The seal.**
Before: "Recorded in the living ledger. Each page is sealed against the one
before it, and the keeper can always carry the whole book away."
After:

> Recorded in the ledger, the permanent record every piece carries. Each
> entry is sealed against the one before it, so its history can never be
> quietly rewritten.

(The "carry the whole book away" promise moves to the keeper layer, where
it belongs to the person it is for.)

### Zone 2 — How this works (new section)

Small-caps header in the existing LABEL style: **How this works**.
Three items. Each is a short bold lead in the display face plus one
sentence. Vertically stacked on mobile, three quiet columns on desktop,
hairline rules, no cards, no icons.

> **Made by hand.** Every piece is made to order by one artist, layer by
> layer, one at a time.
>
> **One dream.** Whoever keeps a piece writes a single dream into it. The
> artwork holds it on the wall; the record holds it forever.
>
> **Its own record.** Two pieces of the same design are never the same
> piece: each keeps its own place, its own keepers, its own dream, in a
> ledger that cannot be quietly rewritten. This page is that record.

(Corrected 2026-07-26 after a spec pull: the earlier draft said "One of
one," which is false. The facts: all 64 archive pieces are
`availability: MADE_TO_ORDER` (`data/mockData.ts`), the ledger keys physical
pieces as `pieceId:editionNumber` and explicitly "distinguishes editions of
the same piece" (`functions/api/atlas/_helpers.ts:639`), and editions of one
design share one sigil (`utils/pieceCode.ts:127-132`). Uniqueness truthfully
lives in the record and the dream, not the design. The third line now
teaches editions honestly AND the ledger in one breath.)

### Zone 3 — The work

Header unchanged. Story, wall-label line, materials, provenance, gallery
all unchanged. Remove the hexagram block from this section (it moves to
Zone 5).

### Zone 4 — Its story

Header unchanged. One spine entry reworded.
Before: "Seeking ground · not yet placed in the world"
After:

> Seeking ground · waiting for its first home on the map

Trailing line "It is ready for its next keeper" unchanged.

### Zone 5 — Among the others (renamed chapter)

Header: **Among the others** (replaces "The dream it carries").
One grounding sentence under the header (display face, wood-600, center):

> Every piece is one point in a single worldwide constellation. This is
> where this one sits in it.

**The code block** (moved here from "The work"). Label unchanged ("The code
it carries"). Add one grounding sentence before the hexagram name:

> Each work in this series is built on one of sixty-four ancient patterns.
> This one carries:
>
> Peace · Hexagram 11
> **Read Code 11 →**

**Kin.** Label before: "Its kin on the map". After:

> **Its kin** · the pieces nearest to this one in pattern, alive elsewhere
> in the world

(The per-item "· Thunder thread" suffixes stay; the grounding line above
carries them.)

**Holder element line** ("Held by a chart of Fire"): see decision below.

### Zone 6 — The door

**Foot claim block.**
Before: "Your piece already has a story. Signing in lets you add to it:
place it on the map, write its intentions, pass it on." + button "Open this
piece's book"
After:

> If this piece is yours, the next page is blank and waiting. Claim it to
> place it on the map, write the dream it will keep, and pass it on when
> the time comes.
>
> [ **Claim your piece** ]
>
> Sign in with the email your piece was registered to.

RequestStewardship lead-in unchanged ("Came to it another way? An auction,
a gift, an inheritance:").

**Keeper layer** ("For the keeper"): unchanged, plus one line above "open
your book →":

> The book is yours. You can always carry the whole record away.

**Not-found page.** The first link currently reads "Open this piece's book
→" which is confusing when no piece was found. After:

> Claim a piece you hold →

## Truth sweep: "one of one" claimed elsewhere on the site

Adrian confirmed the art is NOT one of one (2026-07-26). These live
surfaces currently claim it and should be corrected in the same spirit
("made by hand" / "its own record"), each in its own voice:

- `components/FamilyReveal.tsx:45` — "The art is real, one of one."
- `components/oracle/OracleBottomNavigation.tsx:17` — "The Piece (the real
  one-of-one…)"
- `components/oracle/reading/generated/CardReadingDesktop.generated.tsx:116`
  — "The one-of-one physical work"
- `utils/universalLanguage.ts:31,43-46` — SEO strings: "Original
  multi-dimensional wooden sculpture… One of 64 sculptures". ("One of 64
  works in the series" is fine; "original sculpture" is the part that
  over-claims.)
- `components/PiecePage.tsx:513` — image alt text "Original work by Adrian
  Rasmussen."

Suggested replacement register per surface: "made by hand by one artist" /
"the physical work, made to order" / for SEO, "handmade wooden artwork, one
of 64 designs in the Universal Language series."

## Decisions for Adrian

1. **"Held by a chart of Fire"** (public page, placed pieces). Pick: cut it
   from the public page. It is astrology shorthand with zero payoff for a
   stranger, and the keeper's chart is the keeper's business. Alternatives:
   ground it ("Its keeper was born under Fire") or move it to the keeper
   layer. Cutting is the Apple move; the atlas HUD still carries it for
   those who speak the language.
2. **"Become its keeper" vs "Claim your piece."** The plan keeps both on
   purpose: they address different people (a stranger meeting an unclaimed
   piece; the owner arriving via QR). If one single verb is wanted
   everywhere, "Become its keeper" wins, and the foot block becomes "This
   piece is yours? Become its keeper."

## Implementation notes

- All changes live in `components/PiecePage.tsx`; the triptych is ~30 lines
  of JSX using the existing LABEL/Rule primitives. No new components needed.
- Copy rules in force: no em dashes anywhere (Adrian's locked rule), no
  italics in UI copy, bold leads use font-weight only.
- Run `npm run typecheck` before pushing; verify on the live dev server and
  link the URL (feedback_link_to_visual).

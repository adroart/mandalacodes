# Piece page v2 — the certificate deepened, and the two doors

> Status (2026-07-26, later): BUILT on branch `redesign-piece-section-clarity`
> (uncommitted). Signature block, plate line, state-aware doors, Make yours
> crescendo, /make page, make-request backend (R2 queue mirroring homecoming:
> lib/atlas/make.ts, functions/api/atlas/_make.ts + make/{submit,index,resolve}),
> and an AdminAtlas "Make Requests" section. Ready-to-ship door activates
> whenever a catalog row is 'available' with an acquireUrl. Decisions resolved
> per Adrian's go: price stays off the certificate (the acquire link carries
> it); typeset maker signature for now (scan can replace it later).
> Adrian's brief, in his words: some pieces may be ready to take right away;
> if not ready, not the right size, or not the right color, it should lead
> into a creation process; people should know what they are clicking for,
> why, and feel "I want to make my dream art piece."

## The central insight

A certificate documents the past. Commerce enters it gracefully only as the
future: a line not yet written. So the page never says "buy." It shows the
visitor the blank line that could be theirs.

Two embodiments:

1. **The blank keeper line.** Real certificates end in signatures. Give the
   certificate a signature block: the maker's line signed (Adrian), the
   keeper's line empty, ruled, labeled "awaiting its keeper." An unclaimed
   piece then sells itself with certificate grammar alone. Once claimed,
   the keeper's line carries their mark (the existing DreamSignature).
2. **Creation as the first ledger event.** Every certificate begins with
   "Created." A commission is not customizing a product; it is causing a
   piece's Created line to exist. That is the inspiring frame for the
   journey door: you are not ordering, you are starting a story that will
   be kept forever.

## What makes it read MORE like a certificate (elegance additions)

In order of impact, all inside the existing paper object:

1. **Signature block** (new, above the seal). Two ruled lines side by side:

   > ________________          ________________
   > ADRIAN RASMUSSEN          AWAITING ITS KEEPER
   > Maker                     Keeper

   Claimed state: right line carries the keeper's signature or "its first
   keeper" when anonymous. Labels in the existing LABEL style. If Adrian
   has a real drawn signature, scan it and set it over the left line
   (an image, so the no-italics rule is untouched).

2. **The plate line** (new, the certificate's last line). One engraved
   fine-print row at the very foot of the paper, like the bottom line of a
   banknote:

   > UL № 42 · Universal Language · laser-cut wood and acrylic · 58 cm square · cut 2024

   Small caps, wide tracking, wood-500. This also gives the specs a formal
   home ON the document (they currently float in "The work" as a dot line).

3. **Issue line** (optional, under the seal): "Issued by the Mandala Codes
   atlas" or simply "Mandala Codes · the living ledger". One line, only if
   the seal feels unanchored without it.

## The two doors (state-aware acquisition band)

The invitation band inside the certificate becomes state-aware, driven by
the `availability` field that already exists in `types.ts`
(`READY_TO_SHIP | MADE_TO_ORDER | SOLD`). One primary door per state,
always with the alternate door beneath as one quiet line.

**READY_TO_SHIP (finished, waiting in the studio):**

> This piece is finished and waiting in the studio. It can be on your wall
> within the week. **Take it home →**
>
> Not the right size or palette? **Have yours made →**

**MADE_TO_ORDER (design exists, no finished piece):**

> This design is waiting to be made. Yours would be cut layer by layer:
> your size, your palette, your dream sealed into it. **Begin your piece →**

**Placed/claimed (not for sale):** no band; the dream, standing line, and
lineage already tell that story. The alternate door lives in "Make yours"
below instead, so a visitor who fell in love with a taken piece still has
a path:

> This piece is spoken for. Its design can be made again, for you. **Begin
> your piece →**

## "Make yours" — the journey teaser (new section, the crescendo)

Placement: the last section of the page, after the owner's claim block, so
the stranger's path ends on the most alive door. Header in LABEL style:
**Make yours**. Lead sentence, then three beats in the same triptych
grammar as "How this works" (the page now has a rhyme: three statements
that explain, three statements that invite).

Lead:

> Every piece in the atlas began the same way: someone decided its story
> should exist.

The three beats:

> **Choose its code.** Begin from this design, or enter your birth date and
> find the codes that point to you.
>
> **Shape its form.** Size, woods, palette: decided with the artist, cut
> layer by layer for your wall.
>
> **Write its dream.** When it arrives, you inscribe the dream it will
> keep, and its light joins the map.

CTA button (same style as "Claim your piece"):

> **Begin your piece**

Expectation line directly under the button (this is Adrian's "people should
know what they are clicking" requirement, answered honestly):

> This opens a short note to the studio: which code, what size, what
> palette. Adrian replies himself within a few days. No payment, no
> commitment, just the beginning of a conversation.

Optional but high-desire: **the making strip.** Two or three photographs of
layers being cut and stacked, one row, captioned "The making, in layers."
Nothing sells a commission like seeing the layers. Needs 2-3 real studio
photos from Adrian; slot exists in `PieceContent.images` already.

The birth-date line in beat one links to the existing For Me flow: the
oracle already knows how to point a person to their codes. That is the
inspiration loop: this page teaches "you can make yours," For Me answers
"which one is mine."

## Page order after v2

1. The certificate (artwork, title, sigil, caption, dream or invitation
   band, ordinal, standing line, signature block, seal, plate line)
2. How this works (exists)
3. The work (exists; dot-spec line may slim down since the plate line
   carries the formal specs)
4. Its story (exists)
5. Among the others (exists)
6. The owner's claim block (exists)
7. Make yours (new crescendo)

## Decisions for Adrian

1. **Destination of "Begin your piece."** Nothing exists yet behind that
   click. Pick: a dedicated `/make` page carrying the three beats, the
   making strip, and a short request form (code, size, palette, note),
   posting to the studio. Alternatives: a form section that unfolds in
   place on the piece page (fastest, less room to breathe); a mailto link
   (honest but breaks the spell). The journey Adrian describes deserves its
   own surface, and every piece page, oracle card, and the atlas can all
   point at one door.
2. **Price presence.** Recommendation: no price anywhere on the
   certificate; the ready-to-ship door may carry it quietly on the next
   step, and commissions hear it in the conversation. A certificate with a
   price tag stops being a certificate.
3. **The signature.** Does Adrian want to scan a real signature for the
   maker line? Typeset small caps works, but a real mark makes the paper
   feel signed.

## Implementation notes

- `availability` already types all three states; all 64 pieces are
  currently MADE_TO_ORDER and the catalog mapper never emits READY_TO_SHIP
  (`utils/catalog.ts:319-341` maps available → MADE_TO_ORDER). Ready-to-
  ship therefore needs one small plumbing change: let a catalog/admin row
  mark a piece as in stock. Until then the band simply always shows the
  made-to-order door, which is true.
- The signature block and plate line are pure JSX in `PiecePage.tsx` using
  existing tokens (Rule, LABEL).
- The request form endpoint can start as a D1 row + email notification,
  same pattern as RequestStewardship.
- Copy rules in force: no em dashes, no italics, warm earth palette only.

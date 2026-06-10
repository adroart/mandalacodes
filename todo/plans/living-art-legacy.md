---
name: living-art-legacy
status: draft
created: 2026-06-10
last_updated: 2026-06-10
owner: mandalacodes
also_touches: adrian-website
source_conversation: 2026-06-10 — "item ledgers and certificates" → became the living-history legacy + planetary atlas vision. The piece carries an ever-growing record; the planet is the global mandala; holders place pieces on a map, opt into charts/identity, and a future social gallery of art owners forms.
---

# Plan — The living art legacy: every piece carries an ever-growing history, the planet is the global mandala

> Owned by mandalacodes (ledger, atlas, steward, social gallery all live here).
> Adrian-Website only feeds the first sale event in via the sale → ledger bridge.

## The one-paragraph why

A piece of Adrian's art is not a static object with a certificate stapled to
it. It is a vessel that accumulates history. The collector who buys it, the
intentions they hold for it, the places it travels, the children who inherit
it and add their own entries — all of this lives *with the piece*, forever,
as an append-only record that only ever gets longer. The certificate is the
first page of a book that never closes. And because every placed piece glows
as a point of light on a world map, the sum of all pieces is a **global
mandala** — a living constellation of art and the people who hold it across
the planet.

## What is already built (survey, 2026-06-10 — do not rebuild)

This vision is ~70% built, and it lives in **mandalacodes**, not
Adrian-Website. The honest state:

**mandalacodes already has:**
- **Append-only hash-chained ledger** — `utils/ledger.ts`. SHA-256 chain per
  `(pieceId, editionNumber)`; tampering invalidates every later hash. This IS
  the "ever-growing record." Designed to read/write R2 and mirror to GitHub.
- **Ledger projection** — `utils/ledgerProjection.ts` (`projectAll`) folds the
  event chain into current `PieceRecord` state.
- **Atlas globe + the world map** — `components/atlas/Globe.tsx`,
  `AtlasPage.tsx`. The planet with placed pieces as points.
- **Kinship layer** — `utils/kinship.ts`, `components/atlas/KinshipLayer.tsx`.
  Two UL pieces are kin when their I-Ching hexagrams share a trigram; arcs
  drawn across the globe, capped at 200. This is "connect compatible charts."
- **Steward (holder) system** — `functions/api/atlas/steward/{claim,update}.ts`,
  `stewards/issue.ts`. Artist issues a steward record bound to a collector's
  email; collector signs in via Clerk and `claim` binds their `clerkUserId`;
  `update` lets them edit. `StewardRecord.outreachStatus`:
  no-contact → invited → claimed → declined.
- **Backend** — D1 + Clerk auth + Cloudflare Functions under
  `functions/api/atlas/*`. Admin atlas (`AdminAtlas.tsx`), steward edit
  (`StewardEdit.tsx`), filters, side panel, seed data.
- **Public/private split** — `PublicAtlasState` (`isPublic`, city-level only)
  is the projection that leaves the server; the private ledger never does.

**Adrian-Website has (thin):**
- **QR registry** — `data/qrRegistry.ts`. Codes 1-64 already redirect into
  mandalacodes. Artwork-code section is empty, awaiting engraved pieces.
- **Certificate page** — `components/WorksPage.tsx` at `/works/:id`.
  Print-styled cert, render-only provenance stub with no data.

**The gap is therefore NOT "build a ledger."** It's: (1) wire the
Adrian-Website *sale* into the mandalacodes ledger as the first event; (2)
extend the existing model for the new vision (multi-piece-type, the four
rings, holder intentions/legacy entries, lost-code recovery).

## Settled decisions (ratified 2026-06-10)

1. **Ownership: mandalacodes owns the living history + atlas. Adrian-Website
   owns the sale + prints the cert/QR.** The sale is a moment; the legacy is
   forever. The buyer crosses over naturally (QR → mandalacodes). One holder
   identity in one accounts DB. The sale event is the *first* entry written
   into the mandalacodes ledger.

2. **Lost-code recovery: the account is the key, not the paper.** First claim
   binds the piece to the collector's mandalacodes (Clerk) account. After
   that, losing the printed code doesn't matter — normal account recovery
   restores access. The artist is root-of-trust for never-claimed pieces
   (can re-issue / re-bind, writing a new event; chain stays intact).
   Anti-theft: a stolen code can't take over an already-claimed piece.

3. **Every piece can live on the globe, not just mandalas.** Non-mandala
   Adrian Rasmussen pieces place too, styled a different color. The planet is
   the global mandala; every piece is a point of light. `pieceType`
   (mandala / other) drives color. **Charts/kinship are mandala-only** —
   non-mandalas place and glow but don't join the kinship constellation
   (they have no hexagram). [DEFAULT — confirm if non-mandalas with birth
   data should ever get charts.]

4. **The four rings of holder consent:**
   - **Ring 1 — Private legacy (always on).** Holder/children add intentions
     and legacy entries; pass the piece on. Nobody else sees it.
   - **Ring 2 — Map presence (ON by default, opt-out).** A city-level dot
     appears when the piece is claimed. No name, no chart. The claim screen
     must say "your piece will appear on the map; deselect to hide."
   - **Ring 3 — Chart presence (OFF, must select).** Holder's hologenetic
     chart attaches to the placed piece; kinship arcs can draw.
   - **Ring 4 — Identity / social gallery (OFF, must select, per-field).**
     Face, name, intention text, business, mission — each its own toggle.

5. **Onboarding trap solved by claim-time consent.** All four rings are asked
   at claim time, defaulting per #4. The data model and toggles exist from day
   one; rings 2-4 render when each is built. No holder is ever re-onboarded —
   you reveal rooms as you build them.

## What the existing model is missing (the build)

The current ledger/steward model covers placement and stewardship but not the
*legacy* and *consent* depth this vision needs. Gaps to design:

- **Holder legacy entries.** The ledger today has admin/steward events of type
  `created|placed|moved|withdrawn|revealed|retired`. The vision needs holders
  (and their heirs) to append **intention / story / dedication** entries — a
  new event type (e.g. `inscribed`) authored by `actor: 'steward'`, carrying
  free text. This is the "living history, not just a ledger" core.
- **Transfer / inheritance.** Passing a piece to another person, and granting
  family members append rights. Needs a `transferred` event + a way for a
  steward to invite another account (or pre-register an heir).
- **Per-field visibility flags.** Ring 4 is per-field opt-in (face / name /
  intention / business / mission). The model needs a visibility object on the
  steward (or holder-profile) record, not a single `isPublic` bool.
- **Map-default-on consent capture.** Ring 2 default-on means claim must
  record an explicit opt-out choice, surfaced in the claim UI.
- **pieceType on the piece record** — drives globe color and the
  charts-eligible gate.
- **Sale → ledger bridge.** Adrian-Website checkout success must create (or
  trigger creation of) the steward record + `created`/sale event in
  mandalacodes, so the buyer's QR claim flow works end to end.

## Build sequence (ship order)

1. **Ring 1 legacy entries + lost-code-as-account.** Extend the ledger with
   holder-authored `inscribed` events; confirm claim binds to account as the
   durable key. This is the standalone-valuable "living certificate" — ships
   first, fully private.
2. **Sale → ledger bridge.** Wire Adrian-Website checkout to seed the steward
   record + first event in mandalacodes. Now a real sale lights the pipeline.
3. **Ring 2 map presence (default-on).** Already mostly built; add
   pieceType/color + the claim-time opt-out consent line.
4. **Ring 3 chart presence.** Already mostly built (kinship exists); gate it
   behind the explicit opt-in + attach holder chart.
5. **Ring 4 identity / social gallery.** Per-field visibility, the public
   gallery of art owners (intentions / faces / business / mission). Last and
   most exposing.

## Slop tests (reject a proposal if…)

- It proposes building a ledger / globe / steward system on Adrian-Website.
  → It already exists in mandalacodes. Wire into it.
- It makes map/chart/identity a single on/off. → Rings are independent and
  per-field; collapsing them breaks the consent model.
- It treats the certificate as the end artifact. → The certificate is page one
  of an ever-growing record; the record is the product.
- It asks holders to "come back later" to add social data. → Re-onboarding is
  the failure. Consent is captured once, at claim.
- It resets a code to recover a lost one. → The chain is append-only; recovery
  is an account/ownership operation, never a chain edit.

## Deprioritize (not now)

- The full social-network gallery (Ring 4) before the ledger holds real holder
  data.
- Connecting compatible charts *between strangers* / matchmaking — interesting,
  but downstream of Rings 3-4 existing at all.
- Non-mandala charts — default is mandala-only; revisit only if Adrian wants
  birth-data pieces.

## Open questions (Adrian to run through the details)

- Charts for non-mandala pieces: permanently mandala-only, or allowed if birth
  data exists? (Defaulted mandala-only.)
- Heir model: does a steward pre-register an heir (email), or does inheritance
  happen via artist-mediated re-bind at the time it's needed?
- Does the public gallery (Ring 4) live on mandalacodes, or get its own
  surface? (Assume mandalacodes for now.)
- What exactly does the sale event carry into the ledger (edition number,
  buyer email for steward seeding, sale date) and does it auto-fire or does
  Adrian confirm each one?

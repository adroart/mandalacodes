// ── LEDGER WAITING ROWS — SINGLE SOURCE, DELETE WHEN REAL ENTRIES LAND. ──
//
// This file once also carried five fabricated sample pieces that stood in on
// the globe whenever the canonical feed was empty, complete with invented
// claim ordinals and a dream signed by "a sample steward". They were removed
// on 2026-09-01: the record is the premise, a light means a life is attached,
// and an empty sky is the only honest way to say nothing has been claimed yet.
// An empty canonical state now passes through loadAtlasState untouched.
// Nothing in this file invents a piece, a placement, a claim, or a dream.
//
// What remains is the living ledger's waiting rows (Part II.6, ruling 2). The
// OTHER KINDS sections — mandalas, signature pieces, jewelry — are built from
// the public catalog and public state. Until the first real works of a kind
// are entered, that kind's section shows a few rows that say so in their own
// words, so the section reads as a waiting ledger rather than an empty void.
// They claim nothing: each says the work is yet to be entered, carries the
// status line below, and is never counted in any tally.
//
// Removal is one motion: delete this file and the fallbacks that read it in
// components/atlas/TheLedger.tsx, components/atlas/TheRegistry.tsx, and
// components/atlas/LedgerPieceRow.tsx. Fable authored the titles.

/** The status line every waiting row carries, in the placeholder style. */
export const LEDGER_PLACEHOLDER_STATUS = 'placeholder · until the first works are entered';

/** Per-kind waiting rows shown while a kind has no real entries. Trivially
 *  removable: drop a kind's array (or the whole export) when its works land. */
export const LEDGER_KIND_PLACEHOLDERS: Readonly<
  Record<'mandala' | 'signature' | 'jewelry', readonly string[]>
> = {
  mandala: [
    'A mandala yet to be entered',
  ],
  signature: [
    'A signature work yet to be entered',
  ],
  jewelry: [
    'A piece yet to be entered',
    'A piece yet to be entered',
    'A piece yet to be entered',
  ],
};

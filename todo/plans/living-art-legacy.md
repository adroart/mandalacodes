---
name: living-art-legacy
status: built-pending-ops
created: 2026-06-10
last_updated: 2026-06-10
owner: mandalacodes
also_touches: adrian-website
source_conversation: 2026-06-10 — "item ledgers and certificates" → became the living-history legacy + planetary atlas vision. The piece carries an ever-growing record; the planet is the global mandala; holders place pieces on a map, opt into charts/identity, and a future social gallery of art owners forms.
review: 2026-06-10 — v2 after a six-agent adversarial review (ground-truth vs code, security/privacy red-team, product/UX walkthrough, architecture, strategy stress-test, repo sweep). Every finding is folded in below; superseded v1 decisions are marked REVISED with the reason.
---

# Plan — The living art legacy: every piece carries an ever-growing history, the planet is the global mandala

> Owned by mandalacodes (ledger, atlas, steward, piece pages all live here).
> Adrian-Website only feeds the first sale event in via the sale → ledger bridge,
> and hosts the D1 migration file (it owns the shared schema — see Ops).

## The one-paragraph why

A piece of Adrian's art is not a static object with a certificate stapled to
it. It is a vessel that accumulates history. The collector who buys it, the
intentions they hold for it, the places it travels, the children who inherit
it and add their own entries — all of this lives *with the piece*, as an
append-only record that only ever gets longer. The certificate is the first
page of a book that never closes — **and the holder can always export and
keep that book themselves**, independent of any vendor or server. Because
every placed piece glows as a numbered point of light on a world map, the sum
of all pieces is a **global mandala** — a constellation that ignites one
light at a time, starting with the artist's own.

> Wording note (ratified): the product promise is *"a record that travels
> with the piece and that you can always export and hold yourself"* — not
> "forever." "Forever" is a claim a solo artist on rented infrastructure
> cannot underwrite; exportability + the printed book + the public mirror is
> the version of forever we can actually keep. See **Continuity** below.

## What the six-agent review changed (read this first)

1. **The chain must never contain personal data.** Free text, names, emails,
   birth data, photos — none of it ever enters the hashed payload. The chain
   carries opaque IDs, event types, dates, cityIds, and *salted* content
   commitments; the content itself lives in mutable D1 rows that can be
   edited or erased (GDPR) without breaking a single hash. This is the
   load-bearing invariant of the whole plan. (Security finding, CRITICAL.)
2. **Ring 2 flips from default-ON to active opt-in.** Pre-ticked/default
   consent for location-linked personal data fails GDPR (Planet49) and
   creates a burglary-targeting dataset when combined with identity. The map
   question becomes a prominent, celebrated, *unticked* choice at claim.
   (REVISES v1 settled decision #4.)
3. **The QR must land on a beautiful zero-signup piece page, not a login
   wall.** Today `/atlas/claim` is a bare sign-in form. The story, the art, the
   edition, and the public spine of the piece's history are viewable with no
   account; claiming is the upgrade for people who want to *write into* the
   record. (Product + strategy findings — this was the single biggest
   missing artifact in v1's build sequence.)
4. **Founding Lights (new feature, Adrian's).** Every first claim appends a
   chain event, so each claimed piece carries a permanent, tamper-evident
   ordinal — *the 1st light, the 2nd light…* Adrian claims light #1 as the
   origin point; early collectors hold founding numbers nobody can ever take.
   This converts the cold-start weakness (a sparse map reads as failure) into
   the launch story (the constellation ignites one light at a time), and it
   is the hook for the outreach campaign to existing collectors.
5. **A self-serve claim-request flow is required, not optional.** Today a
   claim only works if Adrian pre-issued a record with the buyer's exact
   email (one typo = silent dead end). A request → admin-approval queue fixes
   five lifecycle moments at once: secondary sales, auctions, gifts,
   retroactive collectors, and inheritance.
6. **Ring 4's public gallery surface is cut from the roadmap.** The schema
   flags ship (so consent is captured once), but the gallery page is not
   built until ≥25 holders have opted in — realistic math says 5–10 profiles,
   and a seven-face "social gallery" reads as a ghost town. (Strategy +
   product findings; goes further than v1's deprioritization.)
7. **Hardening comes first.** The review found real defects that must be
   fixed before holder-authored events multiply the write rate: no
   concurrency control on R2 writes (events can be silently dropped — fatal
   for an append-only promise), a multi-piece claim-binding bug, an
   edition-key mismatch between kinship and ledger, backdated admin events
   corrupting verification, and admin `notes` leaking to stewards.

## Ground truth — what is actually built (corrected survey, 2026-06-10)

The vision is ~60% built and lives in **mandalacodes**. v1 misdescribed the
storage layer; the corrected state:

**Confirmed working:**
- **Append-only hash-chained ledger** — `utils/ledger.ts`. SHA-256 chain per
  `(pieceId, editionNumber)`; `verifyChain` validates; `groupChains` groups.
  Event types: `created|placed|moved|withdrawn|revealed|retired` exactly.
- **Projection** — `utils/ledgerProjection.ts` (`projectAll` → `PieceRecord`).
  Unknown event types are silently ignored (no `default` branch), so new
  event types are backward-compatible with deployed code. Optional fields
  never invalidate existing hashes (canonicalize drops `undefined`).
- **Atlas globe** — `components/atlas/Globe.tsx`, `AtlasPage.tsx`. Live data
  from `/api/atlas` with seed fallback.
- **Kinship** — `utils/kinship.ts`, `KinshipLayer.tsx`. Shared-trigram arcs,
  capped at 200, **Universal Language pieces only** (non-mandalas already
  can't join — the v1 "mandala-only charts" default is enforced by accident).
- **Steward system** — `functions/api/atlas/steward/{claim,update}.ts`,
  `stewards/issue.ts`. Email-pre-binding: admin issues a record, collector
  signs in, claim binds `clerkUserId`. `outreachStatus:
  no-contact → invited → claimed → declined`. The claim endpoint takes **no
  body** — consent capture requires reworking it.
- **Public/private split** — `toPublicState` strips private data
  **server-side**; city-level only via a curated ~99-city centroid catalog.
  This is the best part of the codebase; preserve the discipline.
- **Admin/steward UI** — `AdminAtlas.tsx` (seed events, issue stewards,
  roster with outreach funnel), `StewardEdit.tsx` (city picker, visibility).

**v1 said these exist; they do not:**
- **Storage is R2 JSON, not D1.** Ledger, stewards, and public state are
  three JSON objects in the `mandalacodes-atlas` R2 bucket
  (`atlas/ledger.json`, `atlas/stewards.json`, `atlas/public.json`). D1
  (shared `adrian-website` DB — schema owned by that repo) holds only
  users/profiles/collections.
- **GitHub mirror is wired but disabled** — `_mirror.ts` needs three env
  vars that are not in the production secret set. It mirrors only
  `public.json` (correct); but `docs/ledger-successor.md` describes
  mirroring *the full ledger*, which must never happen (see chain invariant).
- **No `pieceType` field** anywhere; globe color is derivable from `series`.
- **No holder charts** — only visitor birth charts in D1 `profiles`.
- **Visibility is a single `isPublic` bool** — the four rings are 100% unbuilt.
- **Zero test files** in the repo.

**Adrian-Website has (thin):** QR registry (`data/qrRegistry.ts`, codes 1–64
redirect into mandalacodes; artwork-code section empty), print-styled cert
page (`WorksPage.tsx`). The QR is a *pointer*, never a credential.

## Settled decisions (v2, ratified 2026-06-10)

1. **Ownership: unchanged.** mandalacodes owns the living history + atlas;
   Adrian-Website owns the sale + prints the cert/QR. The sale event is the
   first entry in the mandalacodes ledger. One holder identity in one
   accounts DB.

2. **Lost-code recovery: the account is the key — with hardening.** First
   claim binds the piece to the collector's account; losing the printed
   code doesn't matter. Additions from review:
   - The chain references holders only by **opaque IDs** (`actorRef` = auth
     userId); a mutable holder registry maps opaque ID → current auth
     identity, so changing auth provider is a registry update, never a chain
     rewrite.
   - **Re-binding a claimed piece is impossible** except via an audited
     `transferred` event (server-enforced, not just the issuance dup-check).
   - **Confirmation emails** fire at issuance and at successful claim ("if
     this wasn't you, reply") — the issued email is the real credential and a
     typo'd or recycled mailbox is the real attack, so make it observable.
   - A documented **dispute process**: the Adrian-Website sale record is the
     evidence; the artist (or successor) adjudicates; resolution is always a
     ledger event, never a silent edit.

3. **Every piece can live on the globe.** Unchanged. `pieceType`
   (`mandala`/`other`) is *derived* in `toPublicState` from
   `series === 'Universal Language'` (overridable on the genesis event for
   pieces outside the archive) and drives marker color. Charts/kinship stay
   mandala-only — **ratified permanently**; the non-mandala-charts open
   question is closed.

4. **The four rings — REVISED consent model:**
   - **Ring 1 — Private legacy (always on).** Holder/heirs add intentions and
     legacy entries; pass the piece on. Nobody else sees it. Content written
     by or about **minors is hard-locked to Ring 1** (no toggle exists to
     make it public) until the subject is an adult and consents themselves;
     minors never hold their own steward accounts — a guardian authors on
     their behalf, recorded as such.
   - **Ring 2 — Map presence (ACTIVE OPT-IN — revised).** At claim, one
     prominent, celebrated, *unticked* question: "Place your piece as a light
     on the world map?" City-level dot only, no name, no chart. Expect ~90%
     yes with honest consent and zero legal exposure. A **city floor**
     applies: cities below ~100k population resolve to the nearest regional
     centroid, and "country only" is offered. Artist-placed inventory (no
     steward yet) may default visible — that's Adrian's own data.
   - **Ring 3 — Chart presence (opt-in, deferred at claim).** Requires a
     birth-data intake — far too heavy for the claim screen. Claim records
     the consent state as `deferred`; the piece's home screen offers it
     later. Holder charts derive from D1 `profiles`; **raw birth
     datetime/place never goes public**, only derived chart fields.
   - **Ring 4 — Identity (per-field flags in schema; surface cut).** Face,
     name, intention, business, mission — each its own flag, all default
     false, captured/deferrable at claim. The public gallery page is **not
     built** until ≥25 opted-in holders exist. When it is: warning copy per
     toggle, no scrape-friendly list API, annual consent re-confirmation, and
     identity + city never joined on one surface without a separate opt-in.

5. **Claim-time consent, amended.** The claim screen asks **one active
   question** (Ring 2) and records Rings 3–4 as `deferred` — capturing the
   consent *state* at claim satisfies the no-re-onboarding principle without
   front-loading a chart-intake form on a 60-year-old collector. Consent is
   versioned (`CONSENT_VERSION`), timestamped, and appended to a
   `consentHistory` audit on the steward record (mutable storage — consent is
   revocable and must never be chain-immutable). Existing claimed stewards
   see the consent step once on their next visit (unavoidable; accepted).

6. **NEW — The chain content invariant.** The hashed payload may contain
   only: opaque IDs, event types, dates, cityIds, and salted content
   commitments (`SHA-256(salt || body)`, salt stored beside the body in D1,
   deleted together on erasure so the commitment becomes unlinkable). Names,
   emails, free text, birth data, photos live exclusively in mutable storage.
   **Erasure semantics (ratified 2026-06-10): the history lives with the
   piece, forever.** Entries persist across account deletion and ownership
   transfer; whoever holds the piece — now or in fifty years — can read its
   whole book. What a holder controls is the opt-in display layer only
   (map presence, identity fields, what's publicly shown). The erasure
   mechanism (delete body+salt, tombstone, "[entry removed]") exists solely
   as the legal escape hatch for an explicit data-erasure demand the law
   compels us to honor — it is never triggered by account deletion or
   transfer. A distinct moderator-redaction path exists with the reason
   logged. **Only the contentless chain and `public.json` may ever reach
   the public GitHub mirror** — Software Heritage archives that repo
   indefinitely, so anything personal that touches it is unerasable
   globally. The existing `LedgerEvent.note` field is restricted to
   non-personal operational text from now on.

7. **NEW — Founding Lights (claim-order provenance).** First successful claim
   appends a `claimed` chain event (actor `steward`, `actorRef`, no PII).
   Each piece's permanent ordinal = rank of its `claimed` event date across
   all chains (ties broken by event id). Adrian claims **light #1**. Founding
   status (e.g. the first 64 lights, mirroring the hexagrams) renders on the
   piece page and may be printed on certificate addenda. The ordinal attaches
   to the *piece*, never reveals the holder; identity stays behind Ring 4.

8. **NEW — Honest continuity (the "forever" machinery):**
   - **Holder export, one click**: the piece's full book as signed JSON + a
     print-styled PDF. The record can always leave the system intact.
   - **The printed certificate is self-sufficient**: piece identity, edition,
     first provenance, and a human-readable code (QR-wear fallback) plus a
     printed line telling a future heir the living record exists and how to
     reach it. If every server dies, the collector still holds the proof.
   - **Public mirror becomes load-bearing**: enable `GITHUB_MIRROR_*`, mirror
     `public.json` *and* per-piece chain-tip hashes with commit history — the
     commit log is the actual tamper-evidence (the server can otherwise
     rewrite R2 and recompute every hash).
   - **Quarterly encrypted full export** (ledger + stewards + D1 inscriptions)
     to artist-controlled offline storage, scripted.
   - **Succession is part of the product**: rewrite `docs/ledger-successor.md`
     (it currently points at retired infrastructure — `MUSIC_BUCKET`,
     `UPLOAD_SECRET`); name the successor mechanism (credential escrow,
     `ADMIN_EMAILS` transfer, dispute handling in the interregnum); updating
     it joins the definition-of-done for every auth/infra change.

## The build

### M0 — Hardening (must precede holder-authored events) — ~2–3 days

- **Write integrity**: R2 conditional writes (If-Match etag) with retry — or
  serialize ledger/steward mutations through a Durable Object — for
  `claim.ts`, `update.ts`, `issue.ts`, `event.ts`. Concurrent writes
  currently last-write-win and can silently drop ledger events.
- **Bug — multi-piece binding**: `findStewardsForUser` (`_helpers.ts`) skips
  the email fallback when any userId match exists, so a collector can never
  bind their second piece. Merge userId matches with unbound email matches.
- **Bug — edition key mismatch**: `kinship.ts` keys `${pieceId}:${edition ?? ''}`
  vs `ledger.ts`/`claim.ts` `?? 0`. Unify on `?? 0` before editions ship.
  Also exclude same-pieceId pairs from `isKin` (sibling editions trivially
  share both trigrams and would flood the constellation with self-kin arcs).
- **Bug — backdated events**: `event.ts` accepts arbitrary dates but chains
  sort by date → `verifyChain` breaks. Reject events dated before the chain
  tip (or move to explicit sequence numbers).
- **Leak — admin notes**: `claim.ts` returns `StewardRecord.notes` and event
  `note`s to stewards. Strip from all non-admin responses.
- **Attribution**: add `actorRef` (auth userId) to every event written from
  now on; alert the bound steward email on any admin action touching their
  piece.
- **First tests** (none exist): `verifyChain` round-trip, projection rules,
  and a privacy assertion that `toPublicState` output contains no email /
  inscription / consent / birth fields. Run on CI.
- **Backup**: script `wrangler r2 object get` of `ledger.json` +
  `stewards.json` into private storage before any structural change ships.

### M1 — Public piece page + Founding Lights — ~3–4 days

Demoable: scan a QR → a beautiful page with the artwork, Adrian's story, the
edition, the public history spine ("Created 2024 · First placed, Lisbon · 2
inscriptions, private") and "Open this piece's book" as the claim CTA. Adrian
claims light #1 and the dot ignites.

- Public piece route (pre-auth) fed by `public.json` + archive metadata.
- `claimed` event type; ordinal derivation; founding-light badge on the page.
- `pieceType` derivation in `toPublicState` (bump `schemaVersion` → 2),
  `OTHER_COLOR` branch in `Globe.tsx`.
- Sold-but-unclaimed pieces render as dim "unawakened" points (admin-placed
  city) — makes the early map honest and doubles as Adrian's outreach
  dashboard.
- Map framing at low density: "Adrian's body of work across the world," not
  "the constellation of strangers." The collective framing unlocks as density
  grows.

### M2 — Consent capture + claim rework — ~3–4 days

Demoable: claim a piece, answer the one map question, watch the dot ignite
(or stay private); consent recorded with version + timestamp.

- Two-phase `claim.ts`: Phase A binds userId and returns `needsConsent`;
  Phase B accepts the consent body, stamps `ConsentState`, appends to
  `consentHistory`, flips `outreachStatus`, appends the `claimed` event, and
  applies Ring 2 choice via the existing `withdrawn`/`revealed` event
  semantics. `outreachStatus → claimed` gates on consent, not `lastClaimAt`.
- `StewardClaim.tsx` → consent step UI; extract `ConsentRings.tsx` for reuse
  in `StewardEdit` (legacy capture + later edits). One active question; Ring
  1 is explanatory text; Rings 3–4 recorded `deferred`.
- Claim-as-ritual: one prompt — "What do you hope this piece holds for you?"
  — and the map dot ignites only after the first inscription (seeded at the
  single moment attention is guaranteed). The first inscription lands in M3's
  model; until then store it as the pending first entry.
- City floor + "country only" option in the city picker.

### M3 — Ring 1 legacy entries, export, heirs — ~4–5 days

Demoable: a steward writes an intention; it appears in the piece's living
history; the chain verifies; erasure tombstones cleanly; the holder downloads
their book.

- **D1 migration** `003_atlas_legacy.sql` (ships in the Adrian-Website repo,
  which owns the shared schema): `atlas_inscriptions` (id, piece_id,
  edition_number, author_clerk_id nullable, kind, body nullable, body_hash,
  **content_salt**, created_at, erased_at, **sealed_until** nullable) +
  `atlas_sale_events` (see M4 — ship both tables in one migration).
- Endpoints: `steward/inscribe.ts` (write D1 row + salted commitment +
  `inscribed` chain event), `steward/inscriptions.ts` (list own; erase own =
  tombstone), with the chain event carrying only
  `actorRef/inscriptionId/contentHash/inscriptionKind`.
- **Time capsules** (small, high value): `sealed_until` date *or*
  seal-until-next-`transferred` — a letter to whoever inherits the piece.
  This is the reason a parent writes in the book at all.
- `StewardEdit.tsx` legacy timeline + add-entry + "Pass it on" heir form
  (`heirs[]` on the steward record — **hints for the executor, never
  auto-binding credentials**; activation is always a mediated `transferred`
  event).
- **Holder export**: signed JSON + print-styled PDF of the full book.
- Account-deletion hook → unbind steward records (piece reverts to
  artist root-of-trust; chain intact). **Inscriptions are NOT erased** —
  the history lives with the piece forever (ratified); the erasure endpoint
  is reserved for explicit legal demands only.
- `transferred` event type live for admin use (artist-mediated transfer);
  `event.ts` VALID_TYPES gains `inscribed|transferred|claimed`.

### M4 — Sale bridge + self-serve claim requests — ~3–4 days (+1 day Adrian-Website)

Demoable: a test checkout on adrianrasmussen.com produces a pending sale in
AdminAtlas; one click issues the steward + genesis event; the buyer's QR
claim works end to end. Separately: a secondary buyer with no pre-issued
record requests stewardship and Adrian approves.

- `POST /api/atlas/sale`: HMAC-SHA256 (`X-Sale-Signature` over
  `timestamp + "." + rawBody`, dedicated `SALE_WEBHOOK_SECRET`), ±5-min
  replay window, idempotent on `saleId` (`INSERT OR IGNORE`). Payload:
  `{saleId, sku?, pieceId?, editionNumber?, buyerEmail, buyerName?, saleDate,
  priceCents?, currency?}`. Never writes the ledger directly. Price is
  D1-only, never chain/public, visible to the admin **and the piece's
  current steward** (ratified).
- **Admin-confirmed queue** (ratified — no auto-fire at this volume; a forged
  webhook would otherwise grant ownership): `GET /api/atlas/sales` +
  `POST /api/atlas/sales/confirm` → steward record + `created` (or
  `transferred`) event; AdminAtlas "Pending sales" card. `buyerEmail` seeds
  the steward record only — never the chain. Webhook failure degrades to
  today's manual issuance; the queue is convenience, not source of truth.
- **Claim-request flow**: scan QR → sign in with any email → "Request
  stewardship" (with optional evidence note) → admin queue → approval writes
  `transferred`/`claimed`. Requests against an already-claimed piece route to
  the current holder, not Adrian (anti-takeover). Covers secondary sale,
  auction, gift, retroactive collectors, and inheritance with one mechanism.
- Adrian-Website side: `notifyMandalacodes(sale)` on checkout success, 3×
  retry w/ backoff, SKU→pieceId map optional.

### M5 — Ring 3 chart presence + the piece writes back — ~3 days

- Gate kinship/chart exposure on `ring3ChartPresence`; thread the consent
  flag into `toPublicState` and filter in `buildKinshipIndex`. Holder chart
  (derived fields only) attaches in `PieceSidePanel.tsx`.
- **The piece writes back** (highest magic-per-effort in the review): when a
  kin piece is claimed anywhere on Earth, the holder receives a letter *from
  their piece* — "Tonight a piece sharing my Water trigram came to light in
  Buenos Aires." Same voice for claim anniversaries and transfers. The
  kinship index already computes the pairs; the build is a notification
  trigger + careful prose. This is the return loop — without it, nothing
  ever brings a holder back.

### Later, density-gated (not scheduled)

- **Ring 4 gallery surface** — only at ≥25 opted-in holders.
- **Annual printed addendum page** — yearly print-styled page of that year's
  entries, downloadable or mailed (small revenue line; makes "the book that
  never closes" literal). Builds on Adrian-Website's print-styled rendering.
- **Completion of the 64** — when the last UL piece is claimed and placed,
  the global mandala is *complete*: treat it as a planned artwork (yearly
  "state of the constellation" signed render; a completion print for all
  holders showing their own light). The 50-year version of this product is
  an archive of 64 books and one finished planetary artwork — not a social
  network.
- **Holder roles** (co-ownership/institutions): one steward per piece for
  now; the claim-request flow is the workaround. If a couple or institution
  buys, revisit `StewardRecord` → holder list with `steward|contributor`
  roles and `holderType: person|organization` (Rings 3–4 don't render for
  orgs). Design new code so this widening stays cheap.
- **Memorial state**: `retired` (destroyed/lost) pieces keep their record
  forever and render as a faint ember at the last city — a destroyed piece's
  story is the most poignant page in its book. `stolen` flag freezes claim
  requests pending the holder.

## Launch motion (Adrian's, runs alongside M1–M2)

1. Adrian claims **light #1** the day M1 ships — the origin point.
2. Outreach to known collectors, one by one, via the existing roster funnel
   (`no-contact → invited → claimed` in AdminAtlas): claim your certificate,
   take your founding number, light your city. The unawakened-dots view *is*
   the campaign dashboard; each successful contact visibly ignites.
3. Founding scarcity is honest and chain-recorded: nobody can ever take #3
   from the person who was third.
4. **Validation check** (from the strategy review): if after contacting
   ~10 collectors fewer than ~3 claim and inscribe, pause before M3+ and
   reassess where the value actually lives (the object and story vs. the
   digital book) before building deeper.

## Data model (concrete; all chain changes additive and hash-safe)

```ts
// types.ts
export type LedgerEventType =
  | 'created' | 'placed' | 'moved' | 'withdrawn' | 'revealed' | 'retired'
  | 'claimed'      // first bind; Founding Lights ordinal source; no PII
  | 'inscribed'    // body lives in D1; chain holds pointer + salted commitment
  | 'transferred'; // stewardship passed; opaque refs only

export interface LedgerEvent {
  // ...existing fields unchanged...
  actor: 'admin' | 'steward' | 'heir';
  actorRef?: string;            // opaque (auth userId) — never email/name
  inscriptionId?: string;       // 'inscribed' only
  contentHash?: string;         // SHA-256(salt || body); salt lives in D1
  inscriptionKind?: 'intention' | 'story' | 'dedication';
  fromRef?: string;             // 'transferred' only — opaque
  toRef?: string;
  transferKind?: 'sale' | 'gift' | 'inheritance' | 'artist-rebind';
  pieceType?: 'mandala' | 'other';  // 'created' only, overrides series-derived
}

export const CONSENT_VERSION = 1;
export interface Ring4Fields { face: boolean; name: boolean; intention: boolean; business: boolean; mission: boolean; }
export interface ConsentState {
  version: number; capturedAt: string; capturedBy: string;
  ring2MapPresence: boolean;                    // active opt-in, unticked
  ring3ChartPresence: boolean | 'deferred';
  ring4: Ring4Fields | 'deferred';
}
export interface HeirRegistration {
  email: string; name?: string; registeredAt: string; registeredBy: string;
  status: 'pending' | 'active' | 'revoked';     // hint only; never auto-binds
}
// StewardRecord gains: consent?, consentHistory?: ConsentState[], heirs?: HeirRegistration[]
```

Storage placement (the PII table):

| Datum | Store | Mutability |
|---|---|---|
| Event existence, type, date, actorRef, inscriptionId, contentHash | R2 chain | immutable |
| Inscription body + salt (+ sealed_until) | D1 `atlas_inscriptions` | editable / erasable |
| Steward email, name, consent, heirs | R2 `atlas/stewards.json` | mutable (exists) |
| Sale payloads (incl. buyerEmail, price) | D1 `atlas_sale_events` | mutable |
| Public projection + chain-tip hashes | `public.json` + GitHub mirror | regenerated; never personal |

## Ops checklist

- D1 migration ships as `003_atlas_legacy.sql` in **Adrian-Website**
  `migrations/` (that repo owns the shared `adrian-website` DB per
  `wrangler.toml` policy); apply with
  `wrangler d1 migrations apply adrian-website --remote` from that checkout.
  Additive only; D1 has no down-migrations.
- Secrets: new `SALE_WEBHOOK_SECRET` (32+ random bytes) on both Pages
  projects; enable `GITHUB_MIRROR_*` (mirror becomes load-bearing per
  Continuity); existing `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` /
  `ADMIN_EMAILS` / `GOOGLE_*` / `RESEND_*` per `docs/secrets-sync.md`. Auth is
  self-owned Better Auth and already live, so no auth provisioning is a
  prerequisite for M2.
- Rollback: code rollback is safe (old projector ignores new event types);
  data rollback = restore the backed-up R2 objects. Run `verifyChain` after
  every write once stewards can author events; refuse writes on a broken
  chain.
- Backup (shipped in M0): `npm run backup:atlas` pulls `atlas/ledger.json` +
  `atlas/stewards.json` from the production bucket into a gitignored
  `backups/atlas-<timestamp>/` dir via `wrangler r2 object get --remote`.
  Run it before any structural change ships; move long-term copies offline.
- Local dev of claim/inscribe: `wrangler pages dev` with local R2 simulation
  + `--local` D1 — never the production bucket/DB.
- Doc hygiene (part of M0): supersede-notes on `docs/ledger-architecture.md`
  ("steward keys" recovery section — replaced by account recovery, decision
  #2) and `docs/ledger-api.md` (pre-Clerk, `MUSIC_BUCKET`-era); **rewrite**
  `docs/ledger-successor.md` against current infrastructure; cross-link the
  TODO.md "OracleSystems network" entry to this plan (same work).

## Slop tests (reject a proposal if…)

- It proposes building a ledger / globe / steward system on Adrian-Website.
  → Exists in mandalacodes. Wire into it.
- It puts a name, email, free text, birth datum, or photo into the hashed
  payload — or mirrors anything beyond the contentless chain + public.json.
  → Violates the chain content invariant; erasure becomes impossible.
- It makes map/chart/identity a single on/off, OR it front-loads Ring 3/4
  data collection at claim. → Rings are independent; claim asks one active
  question and records the rest as `deferred`. (Amended: capturing
  "deferred" at claim satisfies no-re-onboarding; a birth-data form at claim
  does not.)
- It treats the certificate as the end artifact. → The certificate is page
  one; the record is the product — and the record must be exportable.
- It resets or reuses a code to recover a lost one, or rebinds a claimed
  piece outside an audited `transferred` event. → Recovery is an
  account/ownership operation, never a chain edit.
- It treats the printed QR as a bearer credential. → The QR is a pointer;
  any claim secret is ≥128-bit, per-piece, out-of-band, single-use.
- It adds a public surface whose magic depends on density we don't have.
  → Density-gate it (Ring 4 ≥25 opt-ins; collective map framing as it grows).

## Cut / closed

- Ring 4 gallery surface before ≥25 opted-in holders (schema ships; page
  doesn't).
- Stranger chart matchmaking — the kin-claim notification (M5) delivers 80%
  of the feeling with zero social surface.
- Non-mandala charts — **closed**: mandala-only, permanently (already
  enforced by the UL-only kinship gate).
- Auto-firing sale → ledger — **closed**: admin-confirmed queue (a forged
  webhook must never grant ownership).

## Open questions — RATIFIED 2026-06-10 (Adrian's answers)

1. **Heir model — ratified: hints + mediated transfer.** Pre-registered
   heirs are hints for the executor; activation is always artist/executor-
   mediated `transferred`. Never auto-binding.
2. **Piece registry — ratified: archive entries per piece.** Adrian adds a
   `FULL_ARCHIVE` entry for each sellable piece; no separate registry built.
3. **User-deletion semantics — ratified: the history lives with the piece,
   forever.** This is an art project; account deletion unbinds the steward
   record (piece reverts to artist root-of-trust) but inscriptions persist
   and travel with the piece — every current and future owner can read the
   whole book. Holders control only the opt-in display layer (map, identity,
   what's shown publicly). The erasure/tombstone mechanism is retained
   strictly as the legal escape hatch for an explicit erasure demand.
4. **Sale price — ratified: record it.** D1-only, never chain/public;
   visible to the admin (master ledger holder) and the piece's current
   steward.
5. **Founding Lights scope — ratified: all pieces, all series.** Not just
   the 64 — every claimed piece in every series gets its permanent
   claim-order number, recorded in the ledger and living with the digital
   certificate. Series drive their own colors and numbering. No founding-
   tier badge system is pre-built — tiering/celebration ideas come later;
   the ordinal itself is the permanent artifact.

## Build record (2026-06-10)

All six milestones implemented on branch `claude/gallant-faraday-kb2y28` across
six commits:

| Commit | Milestone | Content |
|---|---|---|
| `06fa436` | M0 — Hardening | Concurrency-safe R2 writes (If-Match etag), multi-piece claim-binding fix, edition-key unification, backdated-event guard, admin-notes leak fix, actorRef attribution, first tests, `scripts/backup-atlas.ts` |
| `a5fb402` | M1 — Public piece page + Founding Lights | Zero-signup piece page, `claimed` event type, Founding Lights ordinal, `pieceType` derivation, unawakened dots |
| `0002730` | M2 — Consent capture + two-phase claim | Two-phase `claim.ts` (Phase A bind / Phase B consent), `ConsentState`, `consentHistory`, Ring 2 active opt-in, first-inscription ritual, `utils/consent.ts` |
| `c92b956` | M3 — Ring 1 legacy entries, export, heirs | `atlas_inscriptions` D1 table (via `003_atlas_legacy.sql`), salted commitments, time capsules, heir registrations, holder export, `utils/inscriptions.ts` |
| `7c1b8a7` | M4 — Sale bridge + claim requests | HMAC-SHA256 sale webhook, admin-confirmed queue, `atlas_sale_events` D1 table, self-serve claim-request flow (routing + anti-takeover), `utils/saleBridge.ts`, `utils/claimRequests.ts` |
| `21fb27b` | M5 — Ring 3 chart presence + the piece writes back | Ring 3 consent gate on kinship, kin-claim letters, anniversary letters, transfer letters, `utils/letters.ts`, `atlas/letters.json` R2 key |

**Final test count: 159 unit tests across 9 test files** (`tests/unit/`).

Final review pass (same date): per-piece chain-tip hashes now ride in
`public.json` (`chainTips`, visible pieces only — hashes only, additive, no
schema bump), closing the Continuity item about mirror tamper-evidence; the
M2→M3 pendingFirstInscription conversion id is author-scoped so a second
steward's claim-ritual answer survives a transfer; the public holder-chart
endpoint returns the 8-way trigram element only (the Gene Key gift word was
a 1:1 proxy for the gate number); `scripts/backup-atlas.ts` fetches all five
atlas keys; `scripts/sync-secrets-to-cloudflare.sh` knows
`SALE_WEBHOOK_SECRET` + `GITHUB_MIRROR_*`.

**Operations required before features are fully live:** see
`todo/handoff/MORNING-AFTER.md`.

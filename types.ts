export type AvailabilityStatus = 'READY_TO_SHIP' | 'MADE_TO_ORDER' | 'SOLD';

export type VariantAvailability = 'IN_STOCK' | 'MADE_TO_ORDER';

export interface SizeVariant {
  size: string;                        // e.g., '16"', '24"', '36"'
  price: number;                       // [DUMMY] placeholder — replace before going live
  stripePriceId?: string;              // Stripe Price ID for this size (e.g. price_xxx)
  availability: VariantAvailability;   // Per-variant stock status
  editionNumber?: number;              // For in-stock pieces: which number in the edition
}

export interface Artwork {
  id: string;
  title: string;
  category: string; // e.g. "Multidimensional Art", "Jewelry"
  series?: string; // e.g. "Universal Language", "Mandala", "Light Codes"
  cardNumber?: number; // 1–64 — the oracle code this piece embodies (UL series). The
                       // explicit artwork↔code link, derived from the "- N" title suffix.
  coverImage: string;
  images: string[];
  description: string;
  longDescription?: string;
  seriesDescription?: string; // Series boilerplate; description becomes piece-specific
  year: string;
  dimensions?: string;
  material?: string;

  // Master Doc Fields
  featured?: boolean; // For "Selected Works"
  availability: AvailabilityStatus;
  price?: number; // Optional if Sold. For MTO with madeToOrderSizes, use lowest size price.
  edition?: string; // e.g. "Edition of 10"
  editionSize?: number; // Total edition size (e.g. 10)
  editionSold?: number; // How many have sold
  editionNumber?: number; // This specific piece's number in the edition

  createdDate?: Date;

  // Commerce
  stripePriceId?: string; // Stripe Price ID (price_xxx) for Checkout Session API
  stripeUrl?: string;     // Legacy: direct Stripe Payment Link (fallback)

  // Size variants — if set, piece page shows unified configurator with per-variant availability.
  // Each variant has its own Stripe Price ID and stock status.
  sizeVariants?: SizeVariant[];
  madeToOrderSizes?: SizeVariant[]; // Legacy alias — still read as fallback in PiecePage + GalleryTileCard

  // Architecture update fields
  illuminated?: boolean; // Piece has LED/light work
  finish?: string; // e.g. "Natural", "Painted", "Gold Leaf"
  subcategory?: string; // Light Codes: "Frequency Foundations" | "Embodied Vibrations" | "Resonant Formations"
  relatedStorySlug?: string; // Links to Story.slug for bidirectional story linking
  isSignaturePiece?: boolean; // Multidimensional Art pieces outside any named series

  // Configurator opt-in: when set, the configurator only shows these add-ons.
  // When undefined, defaults to the full set (crystals, woodFrame, illumination
  // — illumination still gated by size tier). Use this to hide add-ons that
  // don't apply to a piece (e.g. jewelry shouldn't offer a wood frame).
  availableAddOns?: Array<'crystals' | 'woodFrame' | 'illumination'>;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  coverImage?: string;
  category: string;
  matchSeries?: string;
  pieceIds?: string[];
}

export interface Product {
  id: string;
  title: string;
  price: number;            // Lowest price (for sorting and "From $X")
  highPrice?: number;       // Highest price (for range display: "$X to $Y")
  category: string;
  image: string;
  available: boolean;
  description?: string;
  longDescription?: string;
  dimensions?: string;
  weight?: string;
  origin?: string;
  material?: string;
  edition?: string;
  isReadyToShip: boolean;
  hasVariants?: boolean;    // True when piece has sizeVariants (always goes to Configure)
  stripeUrl?: string;       // Legacy: direct Stripe Payment Link (fallback)
  stripePriceId?: string;   // Stripe Price ID (price_xxx) for Checkout Session API
  // For configured made-to-order items: add-on Stripe Price IDs sent as additional line items
  addOnPriceIds?: string[];
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type StoryCategory = 'Living Knowledge' | 'Beneath the Surface' | 'The Practice' | 'The Path';

export interface AudioTrack {
  title: string;
  url: string;
  duration?: string;
}

export interface Stanza {
  lines: string[];           // one entry per line; rendered with whitespace-pre-line
  startSeconds?: number;     // optional click-to-seek anchor; absent on all stanzas → page falls back to pure tide marker
}

export interface Track {
  id: string;                // 'river-poem-2026'
  slug: string;              // /poetry/<slug>
  title: string;
  openingLine?: string;      // first line, used as the index entry (falls back to poem[0].lines[0])
  audioUrl: string;          // https://audio.adrianrasmussen.com/<file>
  poem: Stanza[];            // the poem as structured stanzas
  coverImage?: string;       // Cloudinary public_id or full URL — rendered as a small seal, not a hero
  duration?: string;         // '3:42'
  durationSeconds?: number;
  releaseDate: string;       // ISO
  dedication?: string;       // optional Cormorant italic line under the title
  themes?: string[];
  aiNote?: string;           // optional honest credit line shown subtly at the page bottom
}

export interface Story {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  date: string;
  category: StoryCategory; // Updated from 'type'
  excerpt: string;
  content: string[];
  image?: string;
  readMinutes: number;
  tags: string[];
  tracks?: AudioTrack[];
  lyrics?: string[];

  isFeatured?: boolean;
  relatedArtifactId?: string;
}

/* ─── Atlas ────────────────────────────────────────────────────────────────
 * Types for the /atlas page: a globe of placed Universal Language pieces.
 * Ported from Adrian-Website. The ledger / steward backend lives in a
 * follow-up PR; this repo only consumes the public projection.
 * ──────────────────────────────────────────────────────────────────────── */

export interface CityCentroid {
  id: string;            // 'lisbon-pt', 'denpasar-id' — stable kebab-case slug
  city: string;
  region?: string;
  country: string;
  countryCode: string;   // ISO 3166-1 alpha-2, uppercase
  lat: number;
  lng: number;
}

export interface PublicAtlasState {
  generatedAt: string;
  /** Bumped to 2 in M1: pieces gained pieceType, claimOrdinal, and the
   *  'unawakened' status. All three are additive — schemaVersion-1 consumers
   *  read the shared fields and ignore the rest. */
  schemaVersion: number;
  pieces: Array<{
    pieceId: string;
    editionNumber?: number;
    series?: string;
    category?: string;
    cityId: string | null;
    /** 'unawakened' = sold-but-unclaimed: the chain places it at a city but
     *  no `claimed` event has landed yet. Renders as a dim point distinct
     *  from 'placed' (claimed + placed) and 'seeking' (no city). Carries no
     *  holder data — its existence is already public via the chain. */
    status: 'seeking' | 'placed' | 'unawakened';
    placedAt?: string;
    /** Marker color category. 'mandala' for Universal Language pieces, 'other'
     *  for everything else; overridable per piece via the genesis event. */
    pieceType?: 'mandala' | 'other';
    /** Founding Lights ordinal — this piece's permanent claim-order number
     *  across ALL chains (1 = first light ever claimed). Present only once the
     *  piece carries a `claimed` event. Never reveals the holder. */
    claimOrdinal?: number;
    /** M5 — whether this piece may join the kinship constellation (shared-
     *  trigram arcs + holder-chart attach). A single derived BOOLEAN, never
     *  the consent object: a piece with a `claimed` event needs its current
     *  steward's Ring 3 (ring3ChartPresence === true) to be eligible; an
     *  artist-placed piece with no claim keeps today's behavior (eligible —
     *  it's the artist's own data). Absent is treated as eligible by readers
     *  for backward compatibility with schemaVersion-2 consumers. Carries no
     *  holder data: it answers only "draw arcs to this piece?" */
    kinshipEligible?: boolean;
  }>;
  cities: CityCentroid[];
  /** Per-piece chain-tip hashes, keyed `pieceId:editionNumber ?? 0` → the
   *  last event's `hash` on that chain. This is the Continuity plank: the
   *  public GitHub mirror's commit history over these tips is the actual
   *  tamper-evidence (the server could otherwise rewrite R2 and recompute
   *  every hash). Hashes only — a tip reveals nothing about events, holders,
   *  or places. Scope: ONLY chains of pieces visible in `pieces` above —
   *  withdrawn/retired pieces stay entirely undisclosed, same rule as the
   *  pieces array. Additive (older readers ignore it). */
  chainTips?: Record<string, string>;
}

/* ─── Ledger (private) ─────────────────────────────────────────────────────
 * Append-only event log + steward records that back the public projection.
 * These never leave the Cloudflare Functions side except via the public
 * state derivation. Server-only types live alongside their public siblings
 * so the projector (utils/ledgerProjection.ts) can be imported by both.
 * ──────────────────────────────────────────────────────────────────────── */

export type LedgerEventType =
  | 'created'
  | 'placed'
  | 'moved'
  | 'withdrawn'
  | 'revealed'
  | 'retired'
  | 'claimed'     // first bind; Founding Lights ordinal source; no PII
  | 'inscribed'   // body lives in D1; chain holds pointer + salted commitment
  | 'transferred'; // stewardship passed; opaque refs only

export interface LedgerEvent {
  id: string;
  pieceId: string;
  editionNumber?: number;
  type: LedgerEventType;
  date: string;
  cityId?: string | null;
  /** Non-personal operational text only — admin-authored notes are stripped
   *  from steward-facing responses. Never put names/emails/free prose here. */
  note?: string;
  actor: 'admin' | 'steward' | 'heir';
  /** Opaque actor reference (Clerk userId today) — never an email or name.
   *  Optional and additive: the canonicalizer drops undefined, so events
   *  written before this field existed keep their original hashes. */
  actorRef?: string;
  /** 'inscribed' only — id of the D1 atlas_inscriptions row. The body lives
   *  exclusively in mutable D1 storage; the chain carries the pointer plus
   *  a salted commitment so the entry's existence is tamper-evident while
   *  its content stays erasable (chain content invariant). */
  inscriptionId?: string;
  /** 'inscribed' only — SHA-256(salt || body), hex. The salt lives beside
   *  the body in D1 and is deleted with it on legal erasure, making the
   *  commitment unlinkable. Never a hash of the bare body. */
  contentHash?: string;
  /** 'inscribed' only — non-personal category label. */
  inscriptionKind?: 'intention' | 'story' | 'dedication';
  /** 'transferred' only — opaque ref of the outgoing steward. Never an
   *  email or name. */
  fromRef?: string;
  /** 'transferred' only — opaque ref of the incoming steward. */
  toRef?: string;
  /** 'transferred' only — why stewardship moved. */
  transferKind?: 'sale' | 'gift' | 'inheritance' | 'artist-rebind';
  /** Marker type override, set on `created` (genesis) only. Lets a piece that
   *  lives outside FULL_ARCHIVE declare its globe color category without a
   *  series lookup. When absent, `pieceType` is derived from the series in
   *  toPublicState (Universal Language → mandala, else other). Additive &
   *  optional: dropped by the canonicalizer when undefined, so pre-existing
   *  hashes stay valid. Never personal. */
  pieceType?: 'mandala' | 'other';
  prevHash: string | null;
  hash: string;
}

export interface PieceRecord {
  pieceId: string;
  editionNumber?: number;
  currentCityId: string | null;
  status: 'seeking' | 'placed' | 'withdrawn' | 'retired';
  history: LedgerEvent[];
  isPublic: boolean;
  /** Date of the first `claimed` event on this chain, when one exists. The
   *  Founding Lights ordinal (rank across all chains) is derived from this in
   *  a second pass; here we only record the per-piece "when". Additive. */
  claimedAt?: string;
  /** Marker-type override carried on the genesis `created` event, if any.
   *  Surfaces to toPublicState which falls back to a series-derived value. */
  pieceType?: 'mandala' | 'other';
}

/* ─── Consent (M2) ─────────────────────────────────────────────────────────
 * The four-rings consent model, captured at claim (or retroactively on the
 * steward's next visit). Consent is revocable, so it lives ONLY on the
 * mutable StewardRecord — never in a hashed ledger payload, never in the
 * public projection. `consentHistory` is the append-style audit trail of
 * every captured state; the chain content invariant (no PII, nothing
 * revocable in hashes) is law here.
 * ──────────────────────────────────────────────────────────────────────── */

/** Bump when the consent wording/shape changes; stamped onto every capture. */
export const CONSENT_VERSION = 1;

/** Ring 4 — identity, per-field flags. All default false; the public gallery
 *  surface is density-gated and unbuilt — only the schema ships. */
export interface Ring4Fields {
  face: boolean;
  name: boolean;
  intention: boolean;
  business: boolean;
  mission: boolean;
}

/**
 * One captured consent state. Ring 1 (the private living record) is always
 * on and needs no flag. Ring 2 is the single active question at claim —
 * map presence, city-level only, active opt-in (never pre-ticked). Rings 3
 * and 4 are not asked at claim; they're recorded as 'deferred' and can be
 * opened later from the piece's book.
 */
export interface ConsentState {
  version: number;
  /** ISO timestamp, stamped server-side at capture. */
  capturedAt: string;
  /** Opaque Clerk userId of the consenting steward, stamped server-side. */
  capturedBy: string;
  /** Ring 2 — "Place your piece as a light on the world map?" */
  ring2MapPresence: boolean;
  /** Ring 3 — chart presence. 'deferred' until the holder opts in/out later. */
  ring3ChartPresence: boolean | 'deferred';
  /** Ring 4 — identity flags. 'deferred' until the holder opens them later. */
  ring4: Ring4Fields | 'deferred';
}

/**
 * Heir registration (M3) — a HINT for whoever settles the steward's estate,
 * never an auto-binding credential. Activation is always a mediated
 * `transferred` event issued by the artist/executor. Lives ONLY on the
 * mutable StewardRecord: heir emails/names never enter a hashed payload,
 * the public projection, or the GitHub mirror.
 */
export interface HeirRegistration {
  email: string;
  name?: string;
  /** ISO timestamp, stamped server-side at registration. */
  registeredAt: string;
  /** Opaque Clerk userId of the steward who registered the heir. */
  registeredBy: string;
  /** 'pending' on registration; 'active'/'revoked' via later edits.
   *  Status is informational only — no value ever grants access. */
  status: 'pending' | 'active' | 'revoked';
}

/* ─── Claim requests (M4) ──────────────────────────────────────────────────
 * Self-serve "Request stewardship": a signed-in visitor asks to become the
 * steward of a piece (secondary sale, auction, gift, retroactive collector,
 * inheritance — one mechanism for all five). Requests live in mutable R2
 * storage only (atlas/claimRequests.json); nothing here ever enters a hashed
 * payload or the public projection. Anti-takeover: requests against a piece
 * with a BOUND steward route to that holder, never to the admin by default —
 * the current holder decides who inherits their record.
 * ──────────────────────────────────────────────────────────────────────── */

export interface ClaimRequest {
  id: string;
  pieceId: string;
  editionNumber?: number;
  /** Opaque Clerk userId of the requester. */
  requesterRef: string;
  /** Requester's email from the verified JWT — needed to seed the steward
   *  record on approval. Mutable storage only, never the chain. */
  requesterEmail: string;
  /** Optional evidence ("bought at the Vienna auction, lot 12"). ≤500 chars. */
  note?: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'declined';
  /** 'holder' when the piece has a bound steward (the CURRENT holder
   *  decides — anti-takeover); 'admin' otherwise. */
  routedTo: 'admin' | 'holder';
  /** Stamped on resolution. resolvedBy is an opaque Clerk userId. */
  resolvedAt?: string;
  resolvedBy?: string;
}

/* ─── Letters — the piece writes back (M5) ─────────────────────────────────
 * In-app letters a piece writes to its steward: a kin piece lit somewhere on
 * Earth, a claim anniversary, a change of hands. No email infrastructure
 * exists — letters live in the product (a future ops layer could bolt on a
 * sender). They are MUTABLE R2 (atlas/letters.json), NEVER chain events: the
 * chain content invariant is law and a letter is generated prose, not a
 * tamper-evident fact.
 *
 * The body references ONLY public facts: a piece lit in a city that is itself
 * ring2-public, the shared trigram (an attribute of the hexagram, not the
 * holder), an ordinal. Never a name, never an email, never an opaque ref.
 * Letters live in private R2 and are served only to the bound steward, but
 * the body discipline holds regardless: nothing in here could identify a
 * person even if it leaked.
 * ──────────────────────────────────────────────────────────────────────── */

export type LetterKind = 'kin-claim' | 'anniversary' | 'transfer';

export interface AtlasLetter {
  id: string;
  /** Recipient piece, keyed `pieceId:editionNumber ?? 0` — the steward of
   *  THIS piece reads the letter. Never a userId: the binding to a holder is
   *  resolved at read time through the steward record, so a transfer carries
   *  the unread letters to the new holder automatically. */
  recipientKey: string;
  kind: LetterKind;
  /** ISO timestamp the letter was generated. */
  createdAt: string;
  /** The prose, in the piece's own voice. Public facts only — never PII. */
  body: string;
  /** ISO timestamp the recipient opened it, when read. Absent = unread. */
  readAt?: string;
}

/**
 * Steward record — binds a piece to a Clerk user identity.
 *
 * Admin creates the record with the collector's `email`. On first sign-in
 * matching that email, the steward `claim` Function fills `clerkUserId`.
 * From then on, lookups can match by `clerkUserId` even if the user's
 * primary email later changes.
 *
 * `name` and `notes` are admin-only context. `outreachStatus` tracks where
 * the collector is in the bind funnel for the admin dashboard:
 *   no-contact → invited (email sent) → claimed (clerkUserId bound) → declined
 */
export interface StewardRecord {
  pieceId: string;
  editionNumber?: number;
  /** Collector's email, set by admin at issuance. */
  email: string;
  /** Bound after the collector's first signed-in /atlas/claim hit matches the email. */
  clerkUserId?: string;
  /** Display name, admin-set. Optional. */
  name?: string;
  /** Admin-only notes — never returned to non-admin Functions. */
  notes?: string;
  /** When the record was created. */
  issuedAt: string;
  outreachStatus: 'no-contact' | 'invited' | 'claimed' | 'declined';
  /** When the collector most recently exercised the claim or edit flow. */
  lastClaimAt?: string;
  /** Current consent state. Absent on records issued before M2 — the
   *  steward sees the consent step once on their next visit. */
  consent?: ConsentState;
  /** Audit trail: every consent state ever captured, oldest first. */
  consentHistory?: ConsentState[];
  /**
   * The claim-ritual answer — "What do you hope this piece holds for you?"
   * Private Ring 1 content belonging to the AUTHORING steward only: never
   * in any hashed payload, never in public state, never returned to other
   * parties (admin roster included). M3 migrates this into the real
   * inscription model (D1 row + salted commitment + `inscribed` event).
   */
  pendingFirstInscription?: { text: string; createdAt: string };
  /**
   * "Pass it on" registrations — hints for the executor (see
   * HeirRegistration). The transfer itself always happens through the
   * artist via an audited `transferred` event; nothing here binds anyone.
   */
  heirs?: HeirRegistration[];
}

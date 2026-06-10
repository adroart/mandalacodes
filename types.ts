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
  }>;
  cities: CityCentroid[];
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
  | 'claimed'; // first bind; Founding Lights ordinal source; no PII

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
  actor: 'admin' | 'steward';
  /** Opaque actor reference (Clerk userId today) — never an email or name.
   *  Optional and additive: the canonicalizer drops undefined, so events
   *  written before this field existed keep their original hashes. */
  actorRef?: string;
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
}

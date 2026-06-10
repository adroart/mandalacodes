/**
 * Project the append-only Atlas ledger into derived state.
 *
 * Events are immutable; the current state of every piece is computed by
 * replaying its chain from genesis. This module owns those rules so the
 * downstream UI and API never have to interpret event types directly.
 *
 * Public projection rules (important):
 *   - `withdrawn` pieces are omitted from PublicAtlasState entirely. We
 *     never expose the fact that a piece was hidden — the public projection
 *     just shows it as if it never existed publicly.
 *   - `retired` pieces are also omitted from public output. They live on
 *     in the raw ledger for posterity but the globe shouldn't show them.
 *   - `seeking` pieces (created, never placed) ARE included publicly so
 *     the "seeking ground" cluster works.
 *   - Cities are filtered down to only those referenced by visible pieces.
 */
import type {
  CityCentroid,
  LedgerEvent,
  PieceRecord,
  PublicAtlasState,
} from '../types';

/**
 * Replay a single piece's chain into its current state. Caller is responsible
 * for sorting events by date ascending before calling — same convention as
 * utils/ledger.ts.
 *
 * Throws nothing: malformed chains produce a best-effort projection. The
 * verifyChain helper in ledger.ts is the place to enforce integrity.
 */
export function projectPiece(events: LedgerEvent[]): PieceRecord {
  if (events.length === 0) {
    throw new Error('projectPiece: cannot project an empty chain');
  }

  // Anchor identity from the first event (genesis).
  const genesis = events[0];
  const record: PieceRecord = {
    pieceId: genesis.pieceId,
    editionNumber: genesis.editionNumber,
    currentCityId: null,
    status: 'seeking',
    history: events,
    isPublic: true,
  };

  for (const e of events) {
    switch (e.type) {
      case 'created':
        // Genesis. Optional cityId is allowed (e.g. studio of origin) but
        // doesn't count as "placed" — the piece is still seeking ground
        // until an explicit 'placed' event.
        if (e.cityId) record.currentCityId = e.cityId;
        record.status = 'seeking';
        // pieceType override travels on the genesis event only.
        if (e.pieceType) record.pieceType = e.pieceType;
        break;
      case 'claimed':
        // First bind. Records *when* the piece was first claimed; the
        // Founding Lights ordinal (rank across all chains) is derived
        // separately. Claiming does not move or place the piece — those are
        // their own events — so we touch nothing but claimedAt, and only the
        // first claim counts (re-claims after a transfer keep the original).
        if (!record.claimedAt) record.claimedAt = e.date;
        break;
      case 'placed':
        record.currentCityId = e.cityId ?? null;
        record.status = 'placed';
        break;
      case 'moved':
        record.currentCityId = e.cityId ?? null;
        record.status = 'placed';
        break;
      case 'withdrawn':
        record.isPublic = false;
        // currentCityId is retained internally so admin can still see it;
        // only the public projection strips it.
        break;
      case 'revealed':
        record.isPublic = true;
        break;
      case 'retired':
        record.status = 'retired';
        record.currentCityId = null;
        break;
    }
  }

  return record;
}

/**
 * Group a flat list of events into per-piece chains and project each one.
 * Returned map is keyed by `${pieceId}:${editionNumber ?? 0}` so that
 * editioned works each get their own record.
 */
export function projectAll(events: LedgerEvent[]): Map<string, PieceRecord> {
  const groups = new Map<string, LedgerEvent[]>();
  for (const e of events) {
    const key = `${e.pieceId}:${e.editionNumber ?? 0}`;
    const arr = groups.get(key);
    if (arr) arr.push(e);
    else groups.set(key, [e]);
  }

  const out = new Map<string, PieceRecord>();
  for (const [key, chain] of groups) {
    chain.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    out.set(key, projectPiece(chain));
  }
  return out;
}

/**
 * Founding Lights ordinals.
 *
 * Each claimed piece carries a permanent claim-order number — the 1st light,
 * the 2nd light… — equal to the rank of its first `claimed` event date
 * across ALL chains. Ratified scope: every claimed piece in every series gets
 * a number (no founding-tier system; the ordinal itself is the artifact).
 *
 * Derivation:
 *   - Consider only chains that have a claim (PieceRecord.claimedAt set).
 *   - Sort by claimedAt ascending; ties broken by the first `claimed` event's
 *     id (stable, deterministic — never depends on Map iteration order).
 *   - Ordinals are dense and 1-based: 1, 2, 3, …
 *
 * Returned map is keyed the same way as projectAll (`pieceId:editionNumber ?? 0`).
 * Pieces with no claim are absent from the map (no ordinal).
 */
export function deriveClaimOrdinals(
  records: Map<string, PieceRecord>,
): Map<string, number> {
  interface ClaimedRef {
    key: string;
    claimedAt: string;
    /** id of the chain's first `claimed` event — the tie-breaker. */
    eventId: string;
  }

  const claimed: ClaimedRef[] = [];
  for (const [key, record] of records) {
    if (!record.claimedAt) continue;
    // Find the first claimed event's id for a stable tie-break. history is in
    // append/date order (projectAll sorts it), so the earliest claim is first.
    let eventId = '';
    for (const e of record.history) {
      if (e.type === 'claimed') {
        eventId = e.id;
        break;
      }
    }
    claimed.push({ key, claimedAt: record.claimedAt, eventId });
  }

  claimed.sort((a, b) => {
    if (a.claimedAt !== b.claimedAt) return a.claimedAt < b.claimedAt ? -1 : 1;
    if (a.eventId !== b.eventId) return a.eventId < b.eventId ? -1 : 1;
    return 0;
  });

  const ordinals = new Map<string, number>();
  claimed.forEach((c, i) => ordinals.set(c.key, i + 1));
  return ordinals;
}

/**
 * Derive a piece's marker-type category. The genesis `created` event may
 * carry an explicit override (record.pieceType); otherwise Universal Language
 * pieces are 'mandala' and everything else is 'other'. Series drives color;
 * charts/kinship stay mandala-only elsewhere.
 */
export function derivePieceType(
  record: PieceRecord,
  series: string | undefined,
): 'mandala' | 'other' {
  if (record.pieceType) return record.pieceType;
  return series === 'Universal Language' ? 'mandala' : 'other';
}

/**
 * Whether a piece may join the kinship constellation (M5).
 *
 * Ratified rule: a piece that carries a `claimed` event requires its current
 * steward's Ring 3 consent (ring3ChartPresence === true) to be eligible —
 * the constellation is the chart-presence surface and joining it is an active
 * opt-in. A piece with NO claim keeps today's behavior: it's artist-placed
 * inventory (the artist's own data), so it stays eligible.
 *
 * The consent value is a SINGLE BOOLEAN-or-'deferred' read off the mutable
 * steward record — the consent OBJECT never enters this function, let alone
 * the public state. Absent consent on a claimed piece means not-yet-opted-in,
 * so it is ineligible (fail-closed, consistent with active opt-in).
 */
export function isKinshipEligible(
  record: PieceRecord,
  ring3: boolean | 'deferred' | undefined,
): boolean {
  if (!record.claimedAt) return true; // artist-placed, no claim → unchanged
  return ring3 === true;
}

/**
 * Build the safe, public-facing projection. Strips private fields, hides
 * withdrawn and retired pieces, and includes only the cities those pieces
 * reference. The result is what gets cached at /api/atlas and mirrored to
 * the GitHub redundancy repo.
 *
 * @param records   Output of projectAll(events).
 * @param artworks  Lookup of artwork metadata (series + category) keyed by
 *                  pieceId. We accept a Map so callers can build it from
 *                  whatever source they want (mockData.ts at first, a CMS
 *                  later) without coupling this util to a particular data
 *                  source.
 * @param cities    The full city catalog. Filtered down to referenced ones.
 * @param ring3ByKey  Optional map of chain key (`pieceId:editionNumber ?? 0`)
 *                  → the steward's ring3ChartPresence value. Used ONLY to
 *                  derive the kinshipEligible boolean — the consent object
 *                  itself never reaches this projection. Absent map = every
 *                  claimed piece is treated as not-opted-in (fail-closed).
 */
export function toPublicState(
  records: Map<string, PieceRecord>,
  artworks: Map<string, { series?: string; category?: string }>,
  cities: CityCentroid[],
  ring3ByKey?: Map<string, boolean | 'deferred'>,
): PublicAtlasState {
  const referencedCityIds = new Set<string>();
  const pieces: PublicAtlasState['pieces'] = [];

  // Founding Lights ordinals are a property of the whole ledger, derived once
  // across every chain (not per piece) so ranks are globally consistent.
  const ordinals = deriveClaimOrdinals(records);

  for (const [key, record] of records) {
    if (record.status === 'retired') continue;
    if (!record.isPublic) continue;

    const meta = artworks.get(record.pieceId);

    // Public status, three-way:
    //   placed      — has a city AND has been claimed (a lit light)
    //   unawakened  — has a city but no claim yet (sold-but-unclaimed; the
    //                 admin-placed dim point that doubles as the outreach
    //                 dashboard). Carries no holder data.
    //   seeking     — no city yet
    // The internal 'withdrawn' state never reaches the public projection.
    let publicStatus: 'seeking' | 'placed' | 'unawakened';
    if (record.status === 'placed') {
      publicStatus = record.claimedAt ? 'placed' : 'unawakened';
    } else {
      publicStatus = 'seeking';
    }

    // Most recent placed/moved event's date, for client-side sorting and
    // the "recently placed" view.
    let placedAt: string | undefined;
    for (let i = record.history.length - 1; i >= 0; i--) {
      const h = record.history[i];
      if (h.type === 'placed' || h.type === 'moved') {
        placedAt = h.date;
        break;
      }
    }

    if (record.currentCityId) referencedCityIds.add(record.currentCityId);

    pieces.push({
      pieceId: record.pieceId,
      editionNumber: record.editionNumber,
      series: meta?.series,
      category: meta?.category,
      cityId: record.currentCityId,
      status: publicStatus,
      placedAt,
      pieceType: derivePieceType(record, meta?.series),
      claimOrdinal: ordinals.get(key),
      kinshipEligible: isKinshipEligible(record, ring3ByKey?.get(key)),
    });
  }

  const filteredCities = cities.filter((c) => referencedCityIds.has(c.id));

  return {
    generatedAt: new Date().toISOString(),
    schemaVersion: 2,
    pieces,
    cities: filteredCities,
  };
}

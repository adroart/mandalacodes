/**
 * GET /api/atlas/steward/export?pieceId=…&editionNumber=…
 *
 * The holder's one-click export: the piece's full book as JSON. The record
 * can always leave the system intact — this is the honest-continuity
 * promise ("a record you can always export and hold yourself").
 *
 * Contents:
 *   - the complete event chain for the piece. SELF-VERIFYING: every event
 *     carries its `hash` and `prevHash`, so the chain's own hashes ARE the
 *     integrity mechanism — anyone can re-run utils/ledger.ts verifyChain
 *     (or any SHA-256 of the canonical sorted-key JSON, `hash` field
 *     excluded) against this file with no server involved. One caveat,
 *     stated in the export itself: admin-authored operational `note`s are
 *     redacted from steward-facing copies (M0 rule), so an event flagged
 *     `noteRedacted: true` will not recompute locally — its prevHash
 *     LINKAGE still verifies, and the full payload remains verifiable via
 *     the admin ledger / public mirror.
 *   - every inscription the requester may see (same visibility rules as
 *     the inscriptions endpoint: tombstones for erased entries, sealed
 *     entries without their body unless the requester authored them,
 *     role+generation attribution).
 *   - placement history with human place labels (formatPlaceLabel).
 *   - the Founding Lights claim ordinal, derived across all chains.
 *   - the holder's current consent state (their own data).
 */

import type { LedgerEvent } from '../../../../types';
import { groupChains } from '../../../../utils/ledger';
import { deriveClaimOrdinals, projectAll } from '../../../../utils/ledgerProjection';
import { projectInscription } from '../../../../utils/inscriptions';
import type { InscriptionView } from '../../../../utils/inscriptions';
import { getCityById, formatPlaceLabel } from '../../../../data/cities';
import { FULL_ARCHIVE } from '../../../../data/mockData';
import type { PagesContext } from '../_helpers';
import {
  isMissingTableError,
  json,
  readLedger,
  readStewards,
} from '../_helpers';
import { chainKey, selectInscriptionsForPiece } from '../_inscriptions';
import { requireUser, isAuthResponse } from '../../_lib/clerk';

/** A chain event as exported to the steward: admin operational notes are
 *  redacted (M0 rule) but flagged, so the holder knows exactly which
 *  events will not recompute from the redacted copy. */
type ExportEvent = LedgerEvent & { noteRedacted?: boolean };

function toExportEvent(e: LedgerEvent): ExportEvent {
  if (e.actor !== 'admin' || e.note === undefined) return e;
  const { note: _note, ...rest } = e;
  return { ...rest, noteRedacted: true } as ExportEvent;
}

export async function onRequestGet(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  const auth = await requireUser(request, env);
  if (isAuthResponse(auth)) return auth;
  const userId = auth.userId;

  const url = new URL(request.url);
  const pieceId = url.searchParams.get('pieceId') ?? '';
  if (!pieceId) return json({ ok: false, error: 'Missing pieceId' }, 400);
  const editionRaw = url.searchParams.get('editionNumber');
  const editionNumber =
    editionRaw !== null && editionRaw !== '' ? Number(editionRaw) : undefined;
  if (editionNumber !== undefined && !Number.isFinite(editionNumber)) {
    return json({ ok: false, error: 'Invalid editionNumber' }, 400);
  }

  // Authorize: bound steward only — the book belongs to the holder.
  const stewards = await readStewards(env);
  const record = stewards.find(
    (s) =>
      s.pieceId === pieceId &&
      (s.editionNumber ?? undefined) === (editionNumber ?? undefined),
  );
  if (!record || record.clerkUserId !== userId) {
    return json({ ok: false, error: 'forbidden' }, 403);
  }

  const events = await readLedger(env);
  const chain = groupChains(events).get(chainKey(pieceId, editionNumber)) ?? [];
  if (chain.length === 0) {
    return json({ ok: false, error: 'No chain for this piece' }, 404);
  }

  // Inscriptions — same visibility projection as the inscriptions GET.
  // Degrades quietly (with a stated reason) until the D1 migration lands:
  // the export must never be blocked by an optional table.
  const now = new Date().toISOString();
  let inscriptions: Array<InscriptionView & { contentSalt?: string }> = [];
  let inscriptionsNote: string | undefined;
  if (env.DB) {
    try {
      const rows = await selectInscriptionsForPiece(env.DB, pieceId, editionNumber);
      inscriptions = rows.map((row) => {
        const view = projectInscription(row, userId, chain, now);
        // Include the salt wherever the body is visible, so the holder can
        // recompute SHA-256(salt + body) against the chain's contentHash
        // offline — the book verifies itself.
        return view.body !== undefined && row.content_salt
          ? { ...view, contentSalt: row.content_salt }
          : view;
      });
    } catch (err) {
      if (!isMissingTableError(err)) throw err;
      inscriptionsNote = 'Legacy archive not yet available (D1 migration pending).';
    }
  } else {
    inscriptionsNote = 'Legacy archive not yet available (D1 migration pending).';
  }

  // Placement history, human-labeled. City-level only — the same
  // granularity the chain itself carries.
  const placements = chain
    .filter((e) => e.type === 'placed' || e.type === 'moved')
    .map((e) => {
      const place = e.cityId ? getCityById(e.cityId) : undefined;
      return {
        date: e.date,
        type: e.type,
        cityId: e.cityId ?? null,
        place: place ? formatPlaceLabel(place) : null,
      };
    });

  // Founding Lights ordinal — rank across ALL chains, so it's derived from
  // the whole ledger, not just this piece.
  const ordinals = deriveClaimOrdinals(projectAll(events));
  const claimOrdinal = ordinals.get(chainKey(pieceId, editionNumber));

  const artwork = FULL_ARCHIVE.find((a) => a.id === pieceId);

  const book = {
    format: 'mandalacodes-piece-book',
    formatVersion: 1,
    exportedAt: now,
    piece: {
      pieceId,
      ...(editionNumber !== undefined ? { editionNumber } : {}),
      ...(artwork?.title ? { title: artwork.title } : {}),
      ...(artwork?.series ? { series: artwork.series } : {}),
      ...(artwork?.year ? { year: artwork.year } : {}),
      ...(claimOrdinal !== undefined ? { claimOrdinal } : {}),
    },
    verification: {
      how: 'Each event is hashed as SHA-256 of its canonical JSON (keys sorted recursively, undefined dropped, `hash` field excluded; `prevHash` included). The first event has prevHash null; every later event\'s prevHash must equal the previous event\'s hash. utils/ledger.ts verifyChain in the mandalacodes repository implements this; the chain\'s own hashes are the integrity mechanism — no server signature needed.',
      caveat: 'Events flagged noteRedacted carried an admin operational note that is redacted from steward exports; their stored hash and the prevHash linkage still verify, but local payload recomputation requires the unredacted ledger.',
      inscriptionCommitments:
        'Each inscribed event\'s contentHash is SHA-256 over UTF-8 of (contentSalt + body) — recomputable from this file for every entry whose body and salt you can see.',
    },
    chain: chain.map(toExportEvent),
    inscriptions,
    ...(inscriptionsNote ? { inscriptionsNote } : {}),
    placements,
    consent: record.consent ?? null,
  };

  return json(book, 200, {
    'Content-Disposition': `attachment; filename="piece-book-${pieceId}${
      editionNumber !== undefined ? `-ed${editionNumber}` : ''
    }.json"`,
  });
}

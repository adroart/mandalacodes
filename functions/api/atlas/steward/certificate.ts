/**
 * GET /api/atlas/steward/certificate?piece=pieceId[:edition]
 *
 * The keeper's layer on the certificate (Part II.5 item 6, ratified
 * 2026-07-18). Authenticated; served ONLY to the piece's BOUND steward. It is
 * what opens the public certificate further for the person who actually holds
 * the piece — nothing here ever reaches the public projection, the meta tags,
 * or the share card.
 *
 * Authorization mirrors steward/inscriptions.ts: the requester must be bound
 * (by userId, or by verified-email fallback) to the steward record for this
 * exact piece + edition. When they are NOT the bound steward we answer a bare
 * 404 {ok:false} — never 403, never any hint about whether the piece has a
 * steward at all. No information leak either way.
 *
 * When bound, the response carries:
 *   - acquisition: { amount, currency, saleDate } | null — price paid and
 *     date, lifted from the CONFIRMED atlas_sale_events row for this piece
 *     (D1-only data, ratified visible to the current steward). `amount` is the
 *     integer price_cents; the client formats it. Many pieces have no sale
 *     record (gift, inheritance, pre-sale-bridge) → null, and the certificate
 *     shows nothing rather than a placeholder. Degrades to null (never a 503)
 *     when D1 is unbound or the 003_atlas_legacy table is missing.
 *   - history: the full sanitized event spine, including the private events
 *     the public certificate never shows (sanitizeEventsForSteward strips the
 *     admin-authored notes — the only admin-only content on an event).
 *   - claimedAt / firstInscriptionAt: cheap milestones read off the same
 *     projected chain.
 *
 * Admin `notes` on the steward record are NEVER included. The endpoint sets
 * `Cache-Control: private, no-store` so a shared/intermediary cache can never
 * hold the price.
 */

import type { LedgerEvent } from '../../../../types';
import { projectAll } from '../../../../utils/ledgerProjection';
import type { PagesContext } from '../_helpers';
import {
  findStewardsForUser,
  isMissingTableError,
  json,
  readLedger,
  readStewards,
  sanitizeEventsForSteward,
} from '../_helpers';
import { requireUser, isAuthResponse } from '../../_lib/auth';

/** Private, uncacheable — the price must never sit in any shared cache. */
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' } as const;

/** The keeper-facing 404: identical whether the piece has no steward, has a
 *  different steward, or does not exist. No oracle for probing. */
function notBound(): Response {
  return json({ ok: false }, 404, PRIVATE_HEADERS);
}

interface Acquisition {
  /** Integer price in the currency's minor units (price_cents). Null when the
   *  confirmed row carries no price. The client formats it. */
  amount: number | null;
  /** ISO-4217 code, when recorded. */
  currency: string | null;
  /** ISO sale date from the confirmed row. */
  saleDate: string;
}

/** Confirmed-row shape we read — a narrow slice of atlas_sale_events. */
interface ConfirmedSaleRow {
  price_cents: number | null;
  currency: string | null;
  sale_date: string;
}

/** Parse `?piece=pieceId[:edition]` into its parts. A trailing `:<digits>`
 *  is the edition (matching the chain-key convention used everywhere else);
 *  anything else is the whole pieceId. */
function parsePieceParam(
  raw: string,
): { pieceId: string; editionNumber?: number } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const m = /^(.*):(\d+)$/.exec(trimmed);
  if (m) return { pieceId: m[1], editionNumber: Number(m[2]) };
  return { pieceId: trimmed };
}

export async function onRequestGet(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  const auth = await requireUser(request, env);
  if (isAuthResponse(auth)) return auth;

  const url = new URL(request.url);
  const pieceParam = url.searchParams.get('piece') ?? '';
  const parsed = parsePieceParam(pieceParam);
  if (!parsed) return json({ ok: false, error: 'Missing piece' }, 400, PRIVATE_HEADERS);
  const { pieceId, editionNumber } = parsed;

  // Authorize: the requester must be the BOUND steward of THIS piece. We look
  // up every record the session owns (userId, or verified-email fallback) and
  // keep only the one for this piece + edition. Anything else → a bare 404, so
  // a signed-in stranger learns nothing about the piece's stewardship.
  const stewards = await readStewards(env);
  const owned = findStewardsForUser(stewards, auth.userId, auth.email, auth.emailVerified);
  const record = owned.find(
    (s) =>
      s.pieceId === pieceId &&
      (s.editionNumber ?? undefined) === (editionNumber ?? undefined),
  );
  if (!record) return notBound();

  // The full spine: project the chain and hand back the sanitized events
  // (admin notes stripped), same discipline the claim/edit surfaces use.
  const events = await readLedger(env);
  const chainKey = `${pieceId}:${editionNumber ?? 0}`;
  const pieceRecord = projectAll(events).get(chainKey);
  const rawHistory: LedgerEvent[] = pieceRecord ? pieceRecord.history : [];
  const history = sanitizeEventsForSteward(rawHistory);

  const claimedAt = pieceRecord?.claimedAt;
  const firstInscription = rawHistory.find((e) => e.type === 'inscribed');
  const firstInscriptionAt = firstInscription?.date;

  // Acquisition: the CONFIRMED sale record for this piece, if one exists.
  // D1-only, current-steward-visible (ratified). Degrades to null — never a
  // 503 — when D1 is unbound or the legacy table is absent: most pieces have
  // no sale record and the certificate simply shows nothing.
  let acquisition: Acquisition | null = null;
  if (env.DB) {
    try {
      const sale = await env.DB.prepare(
        `SELECT price_cents, currency, sale_date
           FROM atlas_sale_events
          WHERE piece_id = ?1 AND edition_number = ?2 AND status = 'confirmed'
          ORDER BY confirmed_at DESC
          LIMIT 1`,
      )
        .bind(pieceId, editionNumber ?? 0)
        .first<ConfirmedSaleRow>();
      if (sale) {
        acquisition = {
          amount: sale.price_cents,
          currency: sale.currency,
          saleDate: sale.sale_date,
        };
      }
    } catch (err) {
      if (!isMissingTableError(err)) throw err;
      // Table not migrated yet — no price to show, not an error.
    }
  }

  return json(
    {
      ok: true,
      acquisition,
      history,
      ...(claimedAt ? { claimedAt } : {}),
      ...(firstInscriptionAt ? { firstInscriptionAt } : {}),
    },
    200,
    PRIVATE_HEADERS,
  );
}

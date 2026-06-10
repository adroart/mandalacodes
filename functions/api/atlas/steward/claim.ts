/**
 * POST /api/atlas/steward/claim
 *
 * Signed-in via Clerk. The collector hits this endpoint after signing in.
 * We look up steward records matching either their Clerk userId or email
 * (unbound email matches merge with existing userId matches, so one
 * collector can bind several pieces), bind the userId on first match, flip
 * outreachStatus to 'claimed' on first claim, and return the piece(s) they
 * steward.
 *
 * No body required — identity comes from the bearer token.
 *
 * Responses are steward-facing: admin-only `notes` on the steward record
 * and admin-authored event `note`s are stripped before returning.
 */

import type { LedgerEvent, PieceRecord, StewardRecord } from '../../../../types';
import { projectAll } from '../../../../utils/ledgerProjection';
import type { PagesContext } from '../_helpers';
import {
  findStewardsForUser,
  json,
  mutateStewards,
  readLedger,
  sanitizeEventsForSteward,
  toStewardView,
} from '../_helpers';
import { requireUser, isAuthResponse } from '../../_lib/clerk';

interface ClaimedPiece {
  steward: Omit<StewardRecord, 'notes'>;
  piece: PieceRecord | null;
}

function findRecord(
  events: LedgerEvent[],
  pieceId: string,
  editionNumber?: number,
): PieceRecord | undefined {
  const records = projectAll(events);
  const key = `${pieceId}:${editionNumber ?? 0}`;
  return records.get(key);
}

/** Steward-facing copy of a projected piece: admin event notes removed. */
function sanitizePiece(piece: PieceRecord | undefined): PieceRecord | null {
  if (!piece) return null;
  return { ...piece, history: sanitizeEventsForSteward(piece.history) };
}

export async function onRequestPost(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  const auth = await requireUser(request, env);
  if (isAuthResponse(auth)) return auth;

  // Bind clerkUserId on every matched record that doesn't have one yet,
  // and flip outreachStatus to 'claimed' on first claim. lastClaimAt always
  // bumps so the admin dashboard sees activity. The lookup re-runs inside
  // the mutator so a concurrent steward write can't be clobbered.
  const now = new Date().toISOString();
  const outcome = await mutateStewards(env, (stewards) => {
    const matches = findStewardsForUser(stewards, auth.userId, auth.email);
    if (matches.length === 0) {
      return json(
        {
          ok: false,
          error:
            'No steward record is bound to your account. Ask Adrian to add you (he needs the email you signed in with).',
        },
        404,
      );
    }
    const next = stewards.map((s) => {
      if (!matches.includes(s)) return s;
      return {
        ...s,
        clerkUserId: s.clerkUserId ?? auth.userId,
        lastClaimAt: now,
        outreachStatus: s.lastClaimAt ? s.outreachStatus : 'claimed',
      } satisfies StewardRecord;
    });
    return { next, result: undefined };
  });
  if (outcome instanceof Response) return outcome;

  const events = await readLedger(env);
  const claimed: ClaimedPiece[] = outcome.next
    .filter((s) => s.clerkUserId === auth.userId)
    .map((s) => ({
      steward: toStewardView(s),
      piece: sanitizePiece(findRecord(events, s.pieceId, s.editionNumber)),
    }));

  return json({ ok: true, claimed });
}

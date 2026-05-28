/**
 * POST /api/atlas/steward/claim
 *
 * Signed-in via Clerk. The collector hits this endpoint after signing in.
 * We look up a steward record matching either their Clerk userId or email,
 * bind the userId on first match, flip outreachStatus to 'claimed' on
 * first claim, and return the piece(s) they steward.
 *
 * No body required — identity comes from the bearer token.
 */

import type { LedgerEvent, PieceRecord, StewardRecord } from '../../../../types';
import { projectAll } from '../../../../utils/ledgerProjection';
import type { PagesContext } from '../_helpers';
import {
  findStewardsForUser,
  json,
  readLedger,
  readStewards,
  writeStewards,
} from '../_helpers';
import { requireUser, isAuthResponse } from '../../_lib/clerk';

interface ClaimedPiece {
  steward: StewardRecord;
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

export async function onRequestPost(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  const auth = await requireUser(request, env);
  if (isAuthResponse(auth)) return auth;

  const stewards = await readStewards(env);
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

  // Bind clerkUserId on every matched record that doesn't have one yet,
  // and flip outreachStatus to 'claimed' on first claim. lastClaimAt always
  // bumps so the admin dashboard sees activity.
  const now = new Date().toISOString();
  const updated = stewards.map((s) => {
    if (!matches.includes(s)) return s;
    return {
      ...s,
      clerkUserId: s.clerkUserId ?? auth.userId,
      lastClaimAt: now,
      outreachStatus: s.lastClaimAt ? s.outreachStatus : 'claimed',
    } satisfies StewardRecord;
  });
  await writeStewards(env, updated);

  const events = await readLedger(env);
  const claimed: ClaimedPiece[] = updated
    .filter((s) => s.clerkUserId === auth.userId)
    .map((s) => ({
      steward: s,
      piece: findRecord(events, s.pieceId, s.editionNumber) ?? null,
    }));

  return json({ ok: true, claimed });
}

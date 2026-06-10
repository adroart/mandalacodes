/**
 * POST /api/atlas/steward/update
 *
 * Clerk-authenticated. Body specifies which piece the steward is editing
 * (since one Clerk user can steward multiple pieces). We verify a steward
 * record exists for (pieceId, editionNumber) AND its clerkUserId matches
 * the bearer token's user.
 *
 * Diff rules (unchanged from HMAC version):
 *   - cityId differs (and current isPublic) → 'placed' if no prior city,
 *     else 'moved'.
 *   - isPublic flipping false (currently public) → 'withdrawn'.
 *   - isPublic flipping true (currently withdrawn) → 'revealed'.
 *   - No-op → return current record, no event appended.
 *
 * Since M2 the isPublic toggle IS the Ring 2 consent control: when the
 * steward record carries a captured consent, flipping visibility also
 * updates consent.ring2MapPresence and appends the new state to
 * consentHistory — one write path for the choice and its audit trail.
 *
 * cityId must validate via getCityById (cities AND country-level centroids
 * — the "country only" option is just a country centroid in the catalog);
 * notes are admin-only and ignored.
 * Ledger and steward writes go through the conditional-put mutators, and
 * every appended event carries the steward's opaque Clerk userId as
 * `actorRef`. Responses strip admin-authored event notes.
 */

import type { LedgerEvent, LedgerEventType, PieceRecord } from '../../../../types';
import { appendEvent, groupChains, BackdatedEventError } from '../../../../utils/ledger';
import { projectPiece } from '../../../../utils/ledgerProjection';
import { nextConsentState } from '../../../../utils/consent';
import { getCityById } from '../../../../data/cities';
import type { PagesContext } from '../_helpers';
import {
  json,
  mutateLedger,
  mutateStewards,
  readStewards,
  regeneratePublicState,
  sanitizeEventsForSteward,
} from '../_helpers';
import { requireUser, isAuthResponse } from '../../_lib/clerk';

interface UpdateBody {
  pieceId?: unknown;
  editionNumber?: unknown;
  cityId?: unknown;
  isPublic?: unknown;
}

function genEventId(): string {
  const rnd = crypto.getRandomValues(new Uint8Array(10));
  let hex = '';
  for (let i = 0; i < rnd.length; i++) hex += rnd[i].toString(16).padStart(2, '0');
  return `evt-${Date.now().toString(36)}-${hex}`;
}

/** Steward-facing copy of a projected piece: admin event notes removed. */
function sanitizePiece(piece: PieceRecord): PieceRecord {
  return { ...piece, history: sanitizeEventsForSteward(piece.history) };
}

export async function onRequestPost(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  const auth = await requireUser(request, env);
  if (isAuthResponse(auth)) return auth;
  // Captured by the mutator closure below — TS doesn't carry the narrowing
  // of `auth` into nested function declarations.
  const actorUserId = auth.userId;

  let body: UpdateBody;
  try {
    body = (await request.json()) as UpdateBody;
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const pieceId = typeof body.pieceId === 'string' ? body.pieceId : '';
  if (!pieceId) {
    return json({ ok: false, error: 'Missing pieceId' }, 400);
  }
  const editionNumber =
    typeof body.editionNumber === 'number' ? body.editionNumber : undefined;

  // Authorize: steward record must exist for this piece AND be bound to
  // this Clerk user.
  const stewards = await readStewards(env);
  const record = stewards.find(
    (s) =>
      s.pieceId === pieceId &&
      (s.editionNumber ?? undefined) === (editionNumber ?? undefined),
  );
  if (!record || record.clerkUserId !== auth.userId) {
    return json({ ok: false, error: 'forbidden' }, 403);
  }

  const cityIdProvided = body.cityId !== undefined && body.cityId !== null;
  const cityId = cityIdProvided
    ? typeof body.cityId === 'string'
      ? body.cityId
      : ''
    : null;
  if (cityIdProvided && (!cityId || !getCityById(cityId))) {
    return json({ ok: false, error: 'Unknown cityId' }, 400);
  }

  const isPublicProvided = typeof body.isPublic === 'boolean';
  const desiredIsPublic = isPublicProvided ? (body.isPublic as boolean) : undefined;

  const now = new Date().toISOString();

  // Bump steward activity timestamp, and — when the visibility toggle is
  // exercised — keep the Ring 2 consent in sync: write the updated
  // ConsentState and push it onto consentHistory. Records without a
  // captured consent are left untouched (the UI gates them through the
  // retro-consent step first; an API-only caller keeps legacy single-
  // toggle behavior until consent is captured via /claim Phase B).
  // Conditional write — a concurrent claim or issue must not be clobbered.
  const stewardOutcome = await mutateStewards(env, (current) => ({
    next: current.map((s) => {
      if (
        s.pieceId !== record.pieceId ||
        (s.editionNumber ?? undefined) !== (record.editionNumber ?? undefined)
      ) {
        return s;
      }
      if (
        desiredIsPublic === undefined ||
        !s.consent ||
        s.consent.ring2MapPresence === desiredIsPublic
      ) {
        return { ...s, lastClaimAt: now };
      }
      const consent = nextConsentState(
        { ring2MapPresence: desiredIsPublic },
        s.consent,
        actorUserId,
        now,
      );
      return {
        ...s,
        lastClaimAt: now,
        consent,
        consentHistory: [...(s.consentHistory ?? []), consent],
      };
    }),
    result: undefined,
  }));
  if (stewardOutcome instanceof Response) return stewardOutcome;

  // The diff is computed INSIDE the mutator so it re-applies against fresh
  // chain state if a concurrent ledger write forces a retry.
  const outcome = await mutateLedger(env, async (events) => {
    const chains = groupChains(events);
    const chainKey = `${pieceId}:${editionNumber ?? 0}`;
    const chain = chains.get(chainKey);
    if (!chain || chain.length === 0) {
      return json({ ok: false, error: 'No chain for this piece' }, 403);
    }

    const current: PieceRecord = projectPiece(chain);

    const appended: LedgerEvent[] = [];
    let runningChain = chain.slice();
    let runningCity = current.currentCityId;
    let runningIsPublic = current.isPublic;
    let runningStatus = current.status;

    async function pushEvent(
      type: LedgerEventType,
      eventCityId: string | null,
    ): Promise<void> {
      const draft: Omit<LedgerEvent, 'hash' | 'prevHash'> = {
        id: genEventId(),
        pieceId,
        editionNumber,
        type,
        date: now,
        cityId: eventCityId,
        actor: 'steward',
        actorRef: actorUserId,
      };
      const full = await appendEvent(runningChain, draft);
      runningChain = [...runningChain, full];
      appended.push(full);
    }

    try {
      if (cityIdProvided && cityId && cityId !== runningCity) {
        if (runningStatus === 'placed') {
          await pushEvent('moved', cityId);
        } else {
          await pushEvent('placed', cityId);
        }
        runningCity = cityId;
        runningStatus = 'placed';
      }

      if (isPublicProvided) {
        if (desiredIsPublic === false && runningIsPublic) {
          await pushEvent('withdrawn', runningCity);
          runningIsPublic = false;
        } else if (desiredIsPublic === true && !runningIsPublic) {
          await pushEvent('revealed', runningCity);
          runningIsPublic = true;
        }
      }
    } catch (err) {
      // Only reachable when the chain tip is dated in the future (an admin
      // event with a forward date) — appending "now" would backdate.
      if (err instanceof BackdatedEventError) {
        return json({ ok: false, error: err.message }, 409);
      }
      throw err;
    }

    if (appended.length === 0) {
      // No-op: nothing to write. Short-circuit with the current record.
      return json({ ok: true, piece: sanitizePiece(current), appended: [] });
    }

    return {
      next: events.concat(appended),
      result: { piece: projectPiece(runningChain), appended },
    };
  });
  if (outcome instanceof Response) return outcome;

  await regeneratePublicState(env, outcome.next);

  return json({
    ok: true,
    piece: sanitizePiece(outcome.result.piece),
    appended: outcome.result.appended,
  });
}

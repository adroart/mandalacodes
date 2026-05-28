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
 * cityId must validate via getCityById; notes are admin-only and ignored.
 */

import type { LedgerEvent, LedgerEventType, PieceRecord } from '../../../../types';
import { appendEvent, groupChains } from '../../../../utils/ledger';
import { projectPiece } from '../../../../utils/ledgerProjection';
import { getCityById } from '../../../../data/cities';
import type { PagesContext } from '../_helpers';
import {
  json,
  readLedger,
  writeLedger,
  readStewards,
  writeStewards,
  regeneratePublicState,
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

export async function onRequestPost(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  const auth = await requireUser(request, env);
  if (isAuthResponse(auth)) return auth;

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

  const events = await readLedger(env);
  const chains = groupChains(events);
  const chainKey = `${pieceId}:${editionNumber ?? 0}`;
  const chain = chains.get(chainKey);
  if (!chain || chain.length === 0) {
    return json({ ok: false, error: 'No chain for this piece' }, 403);
  }

  const current: PieceRecord = projectPiece(chain);

  const now = new Date().toISOString();
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
    };
    const full = await appendEvent(runningChain, draft);
    runningChain = [...runningChain, full];
    appended.push(full);
  }

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

  // Bump steward activity timestamp.
  const updatedStewards = stewards.map((s) =>
    s === record ? { ...s, lastClaimAt: now } : s,
  );
  await writeStewards(env, updatedStewards);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };

  if (appended.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, piece: current, appended: [] }),
      { status: 200, headers },
    );
  }

  const allEvents = events.concat(appended);
  await writeLedger(env, allEvents);
  await regeneratePublicState(env, allEvents);

  const updated = projectPiece(runningChain);
  return new Response(
    JSON.stringify({ ok: true, piece: updated, appended }),
    { status: 200, headers },
  );
}

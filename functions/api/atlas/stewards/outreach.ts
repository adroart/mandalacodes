/**
 * POST /api/atlas/stewards/outreach
 *
 * Admin-only. Manually sets a steward record's `outreachStatus` from the
 * roster (`components/AdminAtlas.tsx`). Every value except `claimed` is
 * admin-settable here; `claimed` stays machine-owned, it is set ONLY by
 * the two-phase claim/consent flow (`../steward/claim.ts` Phase B, on
 * consent capture), so a manual write of `claimed` is rejected with a 400
 * regardless of admin auth. The claim flow itself does not read this
 * endpoint and is unaffected by any manual state set here.
 *
 * PLACEHOLDER STATES: `contacted` and `paused` are provisional manual
 * labels (see `todo/plans/repair/phase-2-field-features.md` item F).
 * Adrian renames the manual states before this ships to steward-facing
 * prose; the endpoint and the `types.ts` enum are structurally final, the
 * words are not.
 *
 * Identifies the record by `pieceId` + `editionNumber`, same tuple used
 * everywhere else in the steward records (see `issue.ts`). Writes through
 * `mutateStewards`: there are deliberately no bare write helpers, so this
 * can never race a concurrent steward write (e.g. a claim landing at the
 * same moment).
 */

import type { PagesContext } from '../_helpers';
import { json, mutateStewards } from '../_helpers';
import { requireAdmin, isAuthResponse } from '../../_lib/auth';
import type { StewardRecord } from '../../../../types';

/** Every outreachStatus value an admin may write manually. `claimed` is
 *  deliberately absent: it is checked and rejected explicitly below so
 *  the error message can name it, rather than falling into the generic
 *  "invalid" branch. */
const MANUAL_STATUSES: ReadonlySet<StewardRecord['outreachStatus']> = new Set([
  'no-contact',
  'invited',
  'contacted',
  'paused',
  'declined',
]);

interface OutreachBody {
  pieceId?: unknown;
  editionNumber?: unknown;
  outreachStatus?: unknown;
}

export async function onRequestPost(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  const auth = await requireAdmin(request, env);
  if (isAuthResponse(auth)) return auth;

  let body: OutreachBody;
  try {
    const parsed = (await request.json()) as unknown;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return json({ ok: false, error: 'Body must be a JSON object' }, 400);
    }
    body = parsed as OutreachBody;
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  for (const key of Object.keys(body)) {
    if (key !== 'pieceId' && key !== 'editionNumber' && key !== 'outreachStatus') {
      return json({ ok: false, error: `Unknown field "${key}"` }, 400);
    }
  }

  const pieceId = typeof body.pieceId === 'string' ? body.pieceId : '';
  if (!pieceId) {
    return json({ ok: false, error: 'Missing pieceId' }, 400);
  }

  const editionNumber =
    typeof body.editionNumber === 'number' ? body.editionNumber : undefined;

  const outreachStatus =
    typeof body.outreachStatus === 'string' ? body.outreachStatus : '';

  if (outreachStatus === 'claimed') {
    return json(
      {
        ok: false,
        error: '"claimed" cannot be set manually, it is set by the claim flow only',
      },
      400,
    );
  }
  if (!MANUAL_STATUSES.has(outreachStatus as StewardRecord['outreachStatus'])) {
    return json({ ok: false, error: 'Invalid outreachStatus' }, 400);
  }

  const outcome = await mutateStewards(env, (stewards) => {
    const idx = stewards.findIndex(
      (s) =>
        s.pieceId === pieceId &&
        (s.editionNumber ?? undefined) === (editionNumber ?? undefined),
    );
    if (idx === -1) {
      return json({ ok: false, error: 'No steward record for this piece' }, 404);
    }
    const next = stewards.slice();
    next[idx] = {
      ...next[idx],
      outreachStatus: outreachStatus as StewardRecord['outreachStatus'],
    };
    return { next, result: next[idx] };
  });
  if (outcome instanceof Response) return outcome;

  return json({ ok: true, record: outcome.result });
}

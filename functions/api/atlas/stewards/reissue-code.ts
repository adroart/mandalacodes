/**
 * POST /api/atlas/stewards/reissue-code
 *
 * Admin-only. Generate a FRESH claim code for an existing UNCLAIMED steward
 * record. Reissuing invalidates the previous code: the stored hash is
 * overwritten, `claimCodeVersion` is bumped, and `claimCodeIssuedAt` is
 * refreshed, so a previously-printed insert stops working the moment a new one
 * is minted (single-use, reissuable — the sanctioned envelope).
 *
 * Refuses for a claimed piece: a code is inert once the piece is claimed
 * (`claimCodeUsedAt` set, the record already 'claimed', or the chain carries a
 * `claimed` event). The audited transfer path — never a reissued code — moves a
 * claimed piece.
 *
 * The plaintext is generated here, hashed, and returned ONCE; only the hash is
 * ever stored. Never logged.
 *
 * Body: { pieceId: string, editionNumber?: number }.
 */

import type { PagesContext } from '../_helpers';
import { json, mutateStewards, readLedger } from '../_helpers';
import { requireAdmin, isAuthResponse } from '../../_lib/auth';
import { groupChains } from '../../../../utils/ledger';
import { chainHasClaimedEvent } from '../event';
import { generateClaimCode, hashClaimCode } from '../../../../utils/claimCode';

interface ReissueBody {
  pieceId?: unknown;
  editionNumber?: unknown;
}

const sameKey = (
  a: { pieceId: string; editionNumber?: number },
  b: { pieceId: string; editionNumber?: number },
): boolean =>
  a.pieceId === b.pieceId &&
  (a.editionNumber ?? undefined) === (b.editionNumber ?? undefined);

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  const auth = await requireAdmin(request, env);
  if (isAuthResponse(auth)) return auth;

  let body: ReissueBody;
  try {
    body = (await request.json()) as ReissueBody;
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const pieceId = typeof body.pieceId === 'string' ? body.pieceId : '';
  if (!pieceId) return json({ ok: false, error: 'Missing pieceId' }, 400);
  const editionNumber =
    typeof body.editionNumber === 'number' ? body.editionNumber : undefined;
  const target = { pieceId, editionNumber };

  // The piece is claimed once its chain carries a `claimed` event — the
  // authoritative "inert" signal. Read it up front; the steward-record checks
  // below (claimCodeUsedAt / outreachStatus) cover records whose chain hasn't
  // been seeded yet.
  const events = await readLedger(env);
  const chain = groupChains(events).get(`${pieceId}:${editionNumber ?? 0}`);
  if (chain && chainHasClaimedEvent(chain)) {
    return json(
      { ok: false, error: 'This piece is already claimed — its code is inert.' },
      409,
    );
  }

  // Mint the plaintext + hash outside the mutator; store only the hash.
  const plaintextCode = generateClaimCode();
  const claimCodeHash = await hashClaimCode(plaintextCode);
  const now = new Date().toISOString();

  const outcome = await mutateStewards(env, (stewards) => {
    const rec = stewards.find((s) => sameKey(s, target));
    if (!rec) {
      return json({ ok: false, error: 'No steward record for this piece' }, 404);
    }
    if (rec.claimCodeUsedAt || rec.outreachStatus === 'claimed') {
      return json(
        { ok: false, error: 'This piece is already claimed — its code is inert.' },
        409,
      );
    }
    const next = stewards.map((s) =>
      sameKey(s, target)
        ? {
            ...s,
            claimCodeHash,
            claimCodeIssuedAt: now,
            claimCodeVersion: (s.claimCodeVersion ?? 0) + 1,
            // A reissue is a fresh, unused code.
            claimCodeUsedAt: undefined,
          }
        : s,
    );
    return { next, result: undefined };
  });
  if (outcome instanceof Response) return outcome;

  // Plaintext returned once; nowhere else.
  return json({ ok: true, claimCode: plaintextCode });
}

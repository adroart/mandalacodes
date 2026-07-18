/**
 * POST /api/atlas/stewards/issue
 *
 * Admin-only. Add a steward record binding a piece to a collector's email.
 *
 * The collector signs in to mandalacodes using this email. The first
 * signed-in /atlas/claim hit matching the email writes their user id into
 * the record. From then on the record looks them up by user id.
 *
 * No one-shot keys, no HMAC. Auth is "signed in AND email matches a steward
 * record."
 */

import type { PagesContext } from '../_helpers';
import { json, issueStewardRecord } from '../_helpers';
import { requireAdmin, isAuthResponse } from '../../_lib/auth';
import {
  CLAIM_CODE_VERSION,
  generateClaimCode,
  hashClaimCode,
} from '../../../../utils/claimCode';

interface IssueBody {
  pieceId?: unknown;
  editionNumber?: unknown;
  email?: unknown;
  name?: unknown;
  notes?: unknown;
  /** When true, mint a claim code for this record. Email becomes optional: a
   *  code-carrying record can exist with no email (the printed code is the
   *  credential). The plaintext is returned ONCE in the response. */
  mintClaimCode?: unknown;
}

function isValidEmail(s: string): boolean {
  // Cheap surface-level shape check. Auth does the real validation on sign-in.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function onRequestPost(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  const auth = await requireAdmin(request, env);
  if (isAuthResponse(auth)) return auth;

  let body: IssueBody;
  try {
    body = (await request.json()) as IssueBody;
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const pieceId = typeof body.pieceId === 'string' ? body.pieceId : '';
  if (!pieceId) {
    return json({ ok: false, error: 'Missing pieceId' }, 400);
  }

  const mintClaimCode = body.mintClaimCode === true;

  // Email is required unless we are minting a claim code. When present it must
  // still be well-shaped; when minting, an absent email is allowed (the code is
  // the credential and the collector's account anchors the bind at claim time).
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (email && !isValidEmail(email)) {
    return json({ ok: false, error: 'Invalid email' }, 400);
  }
  if (!email && !mintClaimCode) {
    return json({ ok: false, error: 'Missing email (or set mintClaimCode)' }, 400);
  }

  const editionNumber =
    typeof body.editionNumber === 'number' ? body.editionNumber : undefined;
  const name = typeof body.name === 'string' ? body.name : undefined;
  const notes = typeof body.notes === 'string' ? body.notes : undefined;

  // Mint the code (if asked) BEFORE the mutator: the plaintext is generated
  // here, hashed, and only the hash is stored. The plaintext rides back in the
  // response exactly once and is never logged or persisted.
  let plaintextCode: string | undefined;
  let claimCodeHash: string | undefined;
  let claimCodeIssuedAt: string | undefined;
  if (mintClaimCode) {
    plaintextCode = generateClaimCode();
    claimCodeHash = await hashClaimCode(plaintextCode);
    claimCodeIssuedAt = new Date().toISOString();
  }

  // Shared issuance helper (also used by the sale-queue confirm path).
  // The dup-check runs INSIDE the mutator so it re-applies against fresh
  // data if a concurrent steward write forces a retry — two racing
  // issuances for the same piece can't both land. One steward per
  // (pieceId, editionNumber) tuple; editioned pieces can have separate
  // stewards per copy.
  const outcome = await issueStewardRecord(env, {
    pieceId,
    editionNumber,
    ...(email ? { email } : {}),
    name,
    notes,
    ...(claimCodeHash
      ? {
          claimCodeHash,
          claimCodeIssuedAt,
          claimCodeVersion: CLAIM_CODE_VERSION,
        }
      : {}),
  });
  if (outcome instanceof Response) return outcome;

  // The plaintext code is returned once, here, and nowhere else. `record`
  // itself never carries it (only the hash).
  return json({
    ok: true,
    record: outcome.result,
    ...(plaintextCode ? { claimCode: plaintextCode } : {}),
  });
}

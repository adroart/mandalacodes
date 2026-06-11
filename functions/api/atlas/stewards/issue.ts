/**
 * POST /api/atlas/stewards/issue
 *
 * Admin-only. Add a steward record binding a piece to a collector's email.
 *
 * The collector signs in to mandalacodes with Clerk using this email. The
 * first signed-in /atlas/claim hit matching the email writes their Clerk
 * user id into the record. From then on the record looks them up by user id.
 *
 * No one-shot keys, no HMAC. Auth is "signed in to Clerk AND email matches
 * a steward record."
 */

import type { PagesContext } from '../_helpers';
import { json, issueStewardRecord } from '../_helpers';
import { requireAdmin, isAuthResponse } from '../../_lib/clerk';

interface IssueBody {
  pieceId?: unknown;
  editionNumber?: unknown;
  email?: unknown;
  name?: unknown;
  notes?: unknown;
}

function isValidEmail(s: string): boolean {
  // Cheap surface-level shape check. Clerk does the real validation on sign-in.
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

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!email || !isValidEmail(email)) {
    return json({ ok: false, error: 'Missing or invalid email' }, 400);
  }

  const editionNumber =
    typeof body.editionNumber === 'number' ? body.editionNumber : undefined;
  const name = typeof body.name === 'string' ? body.name : undefined;
  const notes = typeof body.notes === 'string' ? body.notes : undefined;

  // Shared issuance helper (also used by the sale-queue confirm path).
  // The dup-check runs INSIDE the mutator so it re-applies against fresh
  // data if a concurrent steward write forces a retry — two racing
  // issuances for the same piece can't both land. One steward per
  // (pieceId, editionNumber) tuple; editioned pieces can have separate
  // stewards per copy.
  const outcome = await issueStewardRecord(env, {
    pieceId,
    editionNumber,
    email,
    name,
    notes,
  });
  if (outcome instanceof Response) return outcome;

  return json({ ok: true, record: outcome.result });
}

/**
 * GET  /api/atlas/steward/letters?pieceId=…&editionNumber=…
 * POST /api/atlas/steward/letters   { pieceId, editionNumber?, markRead: true }
 *
 * The piece's letters (M5) — "the piece writes back." Authenticated;
 * the steward record for the piece must be bound to the bearer's userId, and
 * letters are addressed to the PIECE (recipientKey), so a transferred piece
 * carries its unread letters to whoever now holds it.
 *
 * GET is read-only. It returns every already-stored letter for the piece,
 * newest first, with the unread count. Letter derivation and courtesy email
 * belong to explicit mutation/event paths.
 *
 * POST marks the piece's letters read (mark-on-open). Body is whitelisted.
 *
 * Letters are MUTABLE R2 (atlas/letters.json) — never chain events. Bodies
 * reference public facts only (a ring2-public city, a shared trigram, an
 * ordinal, a count of years): no name, email, or opaque ref ever appears.
 */

import {
  letterRecipientKey,
  lettersForRecipient,
  unreadCount,
} from '../../../../utils/letters';
import type { StewardRecord } from '../../../../types';
import type { PagesContext } from '../_helpers';
import {
  json,
  mutateLetters,
  readLetters,
  readStewards,
} from '../_helpers';
import { requireUser, isAuthResponse } from '../../_lib/auth';

interface RouteArgs {
  pieceId: string;
  editionNumber?: number;
}

function parsePieceFromQuery(url: URL): RouteArgs | Response {
  const pieceId = url.searchParams.get('pieceId') ?? '';
  if (!pieceId) return json({ ok: false, error: 'Missing pieceId' }, 400);
  const raw = url.searchParams.get('editionNumber');
  const editionNumber = raw !== null && raw !== '' ? Number(raw) : undefined;
  if (editionNumber !== undefined && !Number.isFinite(editionNumber)) {
    return json({ ok: false, error: 'Invalid editionNumber' }, 400);
  }
  return { pieceId, editionNumber };
}

type AuthorizeResult =
  | { ok: true; record: StewardRecord }
  | { ok: false; response: Response };

/** Confirms the bearer owns the steward record for this piece. */
async function authorize(
  env: PagesContext['env'],
  userId: string,
  args: RouteArgs,
): Promise<AuthorizeResult> {
  const stewards = await readStewards(env);
  const record = stewards.find(
    (s) =>
      s.pieceId === args.pieceId &&
      (s.editionNumber ?? undefined) === (args.editionNumber ?? undefined),
  );
  if (!record || record.clerkUserId !== userId) {
    return { ok: false, response: json({ ok: false, error: 'forbidden' }, 403) };
  }
  return { ok: true, record };
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const auth = await requireUser(request, env);
  if (isAuthResponse(auth)) return auth;
  const userId = auth.userId;

  const args = parsePieceFromQuery(new URL(request.url));
  if (args instanceof Response) return args;

  const auth2 = await authorize(env, userId, args);
  if (auth2.ok === false) return auth2.response;

  const recipientKey = letterRecipientKey(args.pieceId, args.editionNumber);

  const letters = await readLetters(env);
  return json({
    ok: true,
    letters: lettersForRecipient(letters, recipientKey),
    unread: unreadCount(letters, recipientKey),
  });
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const auth = await requireUser(request, env);
  if (isAuthResponse(auth)) return auth;
  const userId = auth.userId;

  let body: Record<string, unknown>;
  try {
    const parsed = (await request.json()) as unknown;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return json({ ok: false, error: 'Body must be a JSON object' }, 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }
  for (const key of Object.keys(body)) {
    if (key !== 'pieceId' && key !== 'editionNumber' && key !== 'markRead') {
      return json({ ok: false, error: `Unknown field "${key}"` }, 400);
    }
  }
  if (body.markRead !== true) {
    return json({ ok: false, error: 'markRead must be true' }, 400);
  }
  const pieceId = typeof body.pieceId === 'string' ? body.pieceId : '';
  if (!pieceId) return json({ ok: false, error: 'Missing pieceId' }, 400);
  const editionNumber =
    typeof body.editionNumber === 'number' ? body.editionNumber : undefined;

  const auth2 = await authorize(env, userId, { pieceId, editionNumber });
  if (auth2.ok === false) return auth2.response;

  const recipientKey = letterRecipientKey(pieceId, editionNumber);
  const now = new Date().toISOString();
  const outcome = await mutateLetters(env, (current) => ({
    next: current.map((l) =>
      l.recipientKey === recipientKey && !l.readAt ? { ...l, readAt: now } : l,
    ),
    result: undefined,
  }));
  if (outcome instanceof Response) return outcome;

  return json({
    ok: true,
    letters: lettersForRecipient(outcome.next, recipientKey),
    unread: 0,
  });
}

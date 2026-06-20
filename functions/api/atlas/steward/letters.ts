/**
 * GET  /api/atlas/steward/letters?pieceId=…&editionNumber=…
 * POST /api/atlas/steward/letters   { pieceId, editionNumber?, markRead: true }
 *
 * The piece's letters (M5) — "the piece writes back." Authenticated;
 * the steward record for the piece must be bound to the bearer's userId, and
 * letters are addressed to the PIECE (recipientKey), so a transferred piece
 * carries its unread letters to whoever now holds it.
 *
 * GET derives-on-read (no cron exists):
 *   - Anniversary letters: when a claim anniversary has passed since the last
 *     'anniversary' letter, generate one — at most one per call, one per year
 *     (idempotent via anniversaryYearDue counting prior letters).
 *   - Transfer letters: when the CURRENT holder arrived via a `transferred`
 *     event (their userId is a toRef on the chain) and no 'transfer' letter
 *     exists yet, generate one for their first visit.
 * Then returns every letter for the piece, newest first, with the unread
 * count.
 *
 * POST marks the piece's letters read (mark-on-open). Body is whitelisted.
 *
 * Letters are MUTABLE R2 (atlas/letters.json) — never chain events. Bodies
 * reference public facts only (a ring2-public city, a shared trigram, an
 * ordinal, a count of years): no name, email, or opaque ref ever appears.
 */

import { groupChains } from '../../../../utils/ledger';
import { projectPiece } from '../../../../utils/ledgerProjection';
import {
  anniversaryYearDue,
  buildLetter,
  composeAnniversaryBody,
  composeTransferBody,
  letterRecipientKey,
  lettersForRecipient,
  unreadCount,
} from '../../../../utils/letters';
import type { AtlasLetter } from '../../../../types';
import { getCityById, formatPlaceLabel } from '../../../../data/cities';
import type { PagesContext } from '../_helpers';
import {
  json,
  mutateLetters,
  readLedger,
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

async function authorize(
  env: PagesContext['env'],
  userId: string,
  args: RouteArgs,
): Promise<Response | null> {
  const stewards = await readStewards(env);
  const record = stewards.find(
    (s) =>
      s.pieceId === args.pieceId &&
      (s.editionNumber ?? undefined) === (args.editionNumber ?? undefined),
  );
  if (!record || record.clerkUserId !== userId) {
    return json({ ok: false, error: 'forbidden' }, 403);
  }
  return null;
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const auth = await requireUser(request, env);
  if (isAuthResponse(auth)) return auth;
  const userId = auth.userId;

  const args = parsePieceFromQuery(new URL(request.url));
  if (args instanceof Response) return args;

  const forbidden = await authorize(env, userId, args);
  if (forbidden) return forbidden;

  const recipientKey = letterRecipientKey(args.pieceId, args.editionNumber);
  const now = new Date().toISOString();

  // Resolve the piece's chain for the derived-on-read letters.
  const events = await readLedger(env);
  const chain = groupChains(events).get(recipientKey) ?? [];

  if (chain.length > 0) {
    const record = projectPiece(chain);

    // Public city label for the anniversary body — only when the piece is
    // currently ring2-public. A private piece's location never enters a body,
    // so we pass null and the prose omits the place.
    const cityLabel =
      record.isPublic && record.currentCityId
        ? (() => {
            const city = getCityById(record.currentCityId as string);
            return city ? formatPlaceLabel(city) : null;
          })()
        : null;

    // Did the CURRENT holder arrive by transfer? The piece has changed hands
    // if the chain carries ANY `transferred` event, and the bound steward is
    // by definition the CURRENT holder — so a transfer in the history means
    // this viewer is a post-transfer holder. We deliberately do NOT require
    // toRef === userId: after a secondary sale the `transferred.toRef` may be
    // `sale:<saleId>` (not a userId) until the buyer claims, and the buyer's
    // Phase B consent — not a new event — is their return signal (M4 fact).
    const arrivedByTransfer = chain.some((e) => e.type === 'transferred');

    // Generate the due derived letters in one mutator pass so the existing-
    // letters checks (idempotency) read fresh, concurrent-safe state.
    await mutateLetters(env, (current) => {
      const mine = current.filter((l) => l.recipientKey === recipientKey);
      const toAppend: AtlasLetter[] = [];

      if (record.claimedAt) {
        const priorAnniversaries = mine.filter((l) => l.kind === 'anniversary');
        const yearDue = anniversaryYearDue(record.claimedAt, priorAnniversaries, now);
        if (yearDue !== null) {
          toAppend.push(
            buildLetter({
              recipientKey,
              kind: 'anniversary',
              createdAt: now,
              body: composeAnniversaryBody({ years: yearDue, cityLabel, seed: recipientKey }),
            }),
          );
        }
      }

      if (arrivedByTransfer && !mine.some((l) => l.kind === 'transfer')) {
        toAppend.push(
          buildLetter({
            recipientKey,
            kind: 'transfer',
            createdAt: now,
            body: composeTransferBody({ seed: recipientKey }),
          }),
        );
      }

      if (toAppend.length === 0) return { next: current, result: undefined };
      return { next: [...current, ...toAppend], result: undefined };
    });
  }

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

  const forbidden = await authorize(env, userId, { pieceId, editionNumber });
  if (forbidden) return forbidden;

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

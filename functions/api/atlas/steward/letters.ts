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
import type { AtlasLetter, StewardRecord } from '../../../../types';
import { getCityById, formatPlaceLabel } from '../../../../data/cities';
import type { PagesContext } from '../_helpers';
import {
  json,
  mutateLetters,
  readLedger,
  readLetters,
  readStewards,
} from '../_helpers';
import { letterEmailBody, letterEmailSubject, sendLetterEmail } from '../_email';
import type { LetterEmailEnv } from '../_email';
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

/**
 * Confirms the bearer owns the steward record for this piece and returns it
 * (the caller needs the bound email for the courtesy letter-email copy —
 * see onRequestGet below).
 */
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
  if (!auth2.ok) return auth2.response;
  const stewardRecord = auth2.record;

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
    // letters checks (idempotency) read fresh, concurrent-safe state. The
    // mutator may retry on a write conflict, so the generated list is
    // threaded out through `result` rather than emailed from inside the
    // closure — a retry must never send a duplicate courtesy email.
    const genOutcome = await mutateLetters(env, (current) => {
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

      if (toAppend.length === 0) return { next: current, result: toAppend };
      return { next: [...current, ...toAppend], result: toAppend };
    });

    // Courtesy email copy (decision record, GO-LIVE-RUNBOOK.md 2026-07-02):
    // fire-and-forget, sent only to this piece's own bound steward email —
    // the authorized viewer themselves, never a third party. Never blocks or
    // fails the response. Prefer context.waitUntil when the runtime exposes
    // it (PagesContext doesn't declare the field, so it's read defensively);
    // otherwise a detached promise with .catch, same as the public-state
    // GitHub mirror side-effect elsewhere in this API.
    const newLetters = genOutcome instanceof Response ? [] : genOutcome.result;
    if (newLetters.length > 0 && stewardRecord.email) {
      const waitUntil = (context as unknown as {
        waitUntil?: (p: Promise<unknown>) => void;
      }).waitUntil;
      for (const letter of newLetters) {
        // See functions/api/atlas/_letters.ts for why this cast is needed:
        // AtlasEnv and LetterEmailEnv share no property names by design.
        const send = sendLetterEmail(env as unknown as LetterEmailEnv, {
          to: stewardRecord.email,
          subject: letterEmailSubject(letter.kind),
          body: letterEmailBody(letter.body),
        }).catch(() => undefined);
        if (typeof waitUntil === 'function') waitUntil.call(context, send);
      }
    }
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

  const auth2 = await authorize(env, userId, { pieceId, editionNumber });
  if (!auth2.ok) return auth2.response;

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

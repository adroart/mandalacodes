/**
 * POST /api/atlas/catalog/invite — the PAST path (admin only).
 *
 * A piece sold years ago whose keeper's email Adrian knows: one action issues
 * the steward record (the existing issueStewardRecord, NO claim code — the
 * email is the credential, exactly the legacy path) and sends the claim
 * invitation through the existing claimInvite email machinery (sendLetterEmail;
 * a silent no-op without RESEND_API_KEY, same as _email.ts). It also stamps the
 * entry's claimIssuedAt so the room shows the invitation went out and the entry
 * becomes permanent (undeletable).
 *
 * Idempotent: refuses politely if a steward record already exists for the
 * piece — the invitation is issued once.
 *
 * Body: { id }. The entry must carry keeperEmail; keeperEmail and notes never
 * leave this server except as the invitation's own `to` address.
 */

import type { PagesContext } from '../_helpers';
import {
  issueStewardRecord,
  json,
  mutateCatalog,
  readCatalog,
  readStewards,
} from '../_helpers';
import { requireAdmin, isAuthResponse } from '../../_lib/auth';
import {
  claimInviteEmailBody,
  claimInviteEmailSubject,
  sendLetterEmail,
} from '../_email';
import type { LetterEmailEnv } from '../_email';

interface InviteBody {
  id?: unknown;
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const auth = await requireAdmin(request, env);
  if (isAuthResponse(auth)) return auth;

  let body: InviteBody;
  try {
    body = (await request.json()) as InviteBody;
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id) return json({ ok: false, error: 'Missing id' }, 400);

  const catalog = await readCatalog(env);
  const entry = catalog.entries.find((e) => e.id === id);
  if (!entry) return json({ ok: false, error: 'No such entry' }, 404);
  if (!entry.keeperEmail) {
    return json(
      { ok: false, error: 'This piece has no keeper email to invite.' },
      400,
    );
  }

  // Idempotency guard: refuse if the piece already has a steward record.
  const stewards = await readStewards(env);
  if (stewards.some((s) => s.pieceId === id)) {
    return json(
      { ok: false, error: 'Its keeper has already been invited.' },
      409,
    );
  }

  // Issue the record — email only, no claim code (the legacy email-match path).
  // The helper re-runs its own dedupe inside the mutator, so a racing invite
  // can't double-issue.
  const outcome = await issueStewardRecord(env, {
    pieceId: id,
    email: entry.keeperEmail,
  });
  if (outcome instanceof Response) return outcome;

  // Stamp claimIssuedAt so the room shows the invitation went out.
  const now = new Date().toISOString();
  await mutateCatalog<null>(env, (store) => {
    const idx = store.entries.findIndex((e) => e.id === id);
    if (idx === -1) return { next: store, result: null };
    const entries = store.entries.slice();
    entries[idx] = { ...entries[idx], claimIssuedAt: now };
    return {
      next: { nextNumberByPrefix: store.nextNumberByPrefix, entries },
      result: null,
    };
  });

  // Send the claim invitation. Fire-and-forget, same discipline as
  // sales/confirm.ts: never awaited on the response path, every failure
  // swallowed inside the helper (a missing RESEND_API_KEY is a silent no-op).
  void sendLetterEmail(env as unknown as LetterEmailEnv, {
    to: entry.keeperEmail,
    subject: claimInviteEmailSubject('sale'),
    body: claimInviteEmailBody('sale', entry.title),
  }).catch(() => undefined);

  return json({ ok: true, record: outcome.result });
}

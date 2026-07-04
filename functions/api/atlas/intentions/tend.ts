/**
 * POST /api/atlas/intentions/tend
 *
 * Admin-only. The quality-assurance pass on the map of dreams AFTER
 * publication (M6, Lens 2) — never a gate before it (Adrian, 2026-07-04).
 *
 * Body: { id, action: 'keep' | 'rehome' | 'withdraw' }
 *   - keep: marks the entry tended, changes nothing else.
 *   - rehome: sets status 'rehomed' + tended, and writes the piece a
 *     'tending' letter in its own voice (utils/letters.ts
 *     TENDING_REHOME_BODY) — only when the entry was actually live (a
 *     rehome on an already-withdrawn/rehomed entry still marks it tended,
 *     but owes no letter).
 *   - withdraw: sets status 'withdrawn' + tended.
 *
 * All three regenerate public state (a status change off 'live' always
 * needs the globe to catch up; 'keep' leaves status alone but regenerating
 * is cheap and keeps the derivation path uniform).
 */

import { buildLetter, letterRecipientKey, TENDING_REHOME_BODY } from '../../../../utils/letters';
import { planTendIntention } from '../../../../utils/intentions';
import type { TendAction } from '../../../../utils/intentions';
import type { PagesContext } from '../_helpers';
import {
  json,
  mutateLetters,
  mutateSharedIntentions,
  readLedger,
  regeneratePublicState,
} from '../_helpers';
import { requireAdmin, isAuthResponse } from '../../_lib/auth';

const TEND_ACTIONS: readonly TendAction[] = ['keep', 'rehome', 'withdraw'];

export async function onRequestPost(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  const auth = await requireAdmin(request, env);
  if (isAuthResponse(auth)) return auth;

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
    if (key !== 'id' && key !== 'action') {
      return json({ ok: false, error: `Unknown field "${key}"` }, 400);
    }
  }
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) return json({ ok: false, error: 'Missing id' }, 400);
  const action = typeof body.action === 'string' ? (body.action as TendAction) : undefined;
  if (!action || !TEND_ACTIONS.includes(action)) {
    return json({ ok: false, error: "action must be 'keep', 'rehome', or 'withdraw'" }, 400);
  }

  const now = new Date().toISOString();
  let wasLive = false;

  const outcome = await mutateSharedIntentions(env, (current) => {
    const plan = planTendIntention(current, id, action, now);
    if (!plan.entry) {
      return json({ ok: false, error: 'No such entry' }, 404);
    }
    wasLive = plan.entry.status === 'live';
    return { next: plan.next, result: plan.entry };
  });
  if (outcome instanceof Response) return outcome;

  if (action === 'rehome' && wasLive) {
    const recipientKey = letterRecipientKey(
      outcome.result.pieceId,
      outcome.result.editionNumber,
    );
    await mutateLetters(env, (current) => ({
      next: [
        ...current,
        buildLetter({
          recipientKey,
          kind: 'tending',
          createdAt: now,
          body: TENDING_REHOME_BODY,
        }),
      ],
      result: undefined,
    }));
  }

  const events = await readLedger(env);
  await regeneratePublicState(env, events);

  const updated = outcome.next.find((e) => e.id === id);
  return json({ ok: true, entry: updated ?? null });
}

// GET /api/lw/poll/:id
// Card polls every ~1s for pending commands. Returns whatever the customer's
// browser most recently wrote and atomically clears the slot — at-most-once
// delivery per command. If nothing pending, returns { ok: true, pending: null }.

import { RelayEnv, CardMeta, PendingCommand, jsonResponse, corsPreflight, cardMetaKey, cardPendingKey } from '../_lib';

export const onRequestOptions: PagesFunction = async () => corsPreflight();

export const onRequestGet: PagesFunction<RelayEnv, 'id'> = async ({ params, request, env }) => {
  const id = String(params.id || '');
  if (!id) return jsonResponse({ ok: false, error: 'missing id' }, { status: 400 });

  const token = request.headers.get('X-LW-Token') || '';
  const meta = await env.LIGHTWEAVER_RELAY.get<CardMeta>(cardMetaKey(id), 'json');
  if (!meta) return jsonResponse({ ok: false, error: 'unknown card' }, { status: 404 });
  if (meta.ownerToken !== token) return jsonResponse({ ok: false, error: 'bad token' }, { status: 401 });

  const pending = await env.LIGHTWEAVER_RELAY.get<PendingCommand>(cardPendingKey(id), 'json');
  if (pending) await env.LIGHTWEAVER_RELAY.delete(cardPendingKey(id));
  return jsonResponse({ ok: true, pending: pending ?? null });
};

// POST /api/lw/control/:id
// Customer browser writes a command bundle. We overwrite the pending slot
// so only the most recent command is delivered — slider drags don't queue
// up. The card polls every ~1s and applies + clears.

import { RelayEnv, PagesFunction, CardMeta, PendingCommand, jsonResponse, corsPreflight, readJson, cardMetaKey, cardPendingKey, PENDING_TTL } from '../_lib';

export const onRequestOptions: PagesFunction = async () => corsPreflight();

export const onRequestPost: PagesFunction<RelayEnv, 'id'> = async ({ params, request, env }) => {
  const id = String(params.id || '');
  if (!id) return jsonResponse({ ok: false, error: 'missing id' }, { status: 400 });

  const token = request.headers.get('X-LW-Token') || '';
  const meta = await env.LIGHTWEAVER_RELAY.get<CardMeta>(cardMetaKey(id), 'json');
  if (!meta) return jsonResponse({ ok: false, error: 'unknown card' }, { status: 404 });
  if (meta.ownerToken !== token) return jsonResponse({ ok: false, error: 'bad token' }, { status: 401 });

  const body = await readJson<PendingCommand>(request);
  if (!body) return jsonResponse({ ok: false, error: 'empty body' }, { status: 400 });

  // Merge with any existing pending so multiple browsers within ~1s don't
  // overwrite each other's distinct fields. Last write wins per key.
  const existing = await env.LIGHTWEAVER_RELAY.get<PendingCommand>(cardPendingKey(id), 'json');
  const merged: PendingCommand = { ...(existing || {}), ...body };
  await env.LIGHTWEAVER_RELAY.put(cardPendingKey(id), JSON.stringify(merged), { expirationTtl: PENDING_TTL });
  return jsonResponse({ ok: true });
};

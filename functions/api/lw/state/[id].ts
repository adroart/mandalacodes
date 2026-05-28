// GET /api/lw/state/:id
// Customer browser reads card's last reported state. We compute "online"
// based on how recently the card heartbeat'd (60s threshold).
// Auth: same X-LW-Token the pair endpoint returned to the browser.

import { RelayEnv, PagesFunction, CardState, CardMeta, jsonResponse, corsPreflight, cardMetaKey, cardStateKey, ONLINE_THRESHOLD_MS } from '../_lib';

export const onRequestOptions: PagesFunction = async () => corsPreflight();

export const onRequestGet: PagesFunction<RelayEnv, 'id'> = async ({ params, request, env }) => {
  const id = String(params.id || '');
  if (!id) return jsonResponse({ ok: false, error: 'missing id' }, { status: 400 });

  const token = request.headers.get('X-LW-Token') || '';
  const meta = await env.LIGHTWEAVER_RELAY.get<CardMeta>(cardMetaKey(id), 'json');
  if (!meta) return jsonResponse({ ok: false, error: 'unknown card' }, { status: 404 });
  if (meta.ownerToken !== token) return jsonResponse({ ok: false, error: 'bad token' }, { status: 401 });

  const state = await env.LIGHTWEAVER_RELAY.get<CardState>(cardStateKey(id), 'json');
  if (!state) {
    return jsonResponse({ ok: true, state: { id, label: meta.label, online: false, lastSeenAt: 0 } });
  }
  const online = Date.now() - state.lastSeenAt < ONLINE_THRESHOLD_MS;
  return jsonResponse({ ok: true, state: { ...state, online } });
};

// GET /api/lw/poll/:id
// Card polls every ~1s for pending commands. Commands stay pending until the
// card applies them and POSTs an ack, so diagnostic polls cannot steal a
// browser command before the card sees it.

import { RelayEnv, PagesFunction, CardMeta, PendingCommand, AckRequest, jsonResponse, corsPreflight, readJson, cardMetaKey, cardPendingKey, PENDING_TTL, newCommandId } from '../_lib';

export const onRequestOptions: PagesFunction = async () => corsPreflight();

async function authorize(params: Record<'id', string | string[]>, request: Request, env: RelayEnv) {
  const id = String(params.id || '');
  if (!id) return { id, response: jsonResponse({ ok: false, error: 'missing id' }, { status: 400 }) };

  const token = request.headers.get('X-LW-Token') || '';
  const meta = await env.LIGHTWEAVER_RELAY.get<CardMeta>(cardMetaKey(id), 'json');
  if (!meta) return { id, response: jsonResponse({ ok: false, error: 'unknown card' }, { status: 404 }) };
  if (meta.ownerToken !== token) return { id, response: jsonResponse({ ok: false, error: 'bad token' }, { status: 401 }) };
  return { id };
}

export const onRequestGet: PagesFunction<RelayEnv, 'id'> = async ({ params, request, env }) => {
  const auth = await authorize(params, request, env);
  if (auth.response) return auth.response;

  const pending = await env.LIGHTWEAVER_RELAY.get<PendingCommand>(cardPendingKey(auth.id), 'json');
  if (pending && !pending.commandId) {
    pending.commandId = newCommandId();
    await env.LIGHTWEAVER_RELAY.put(cardPendingKey(auth.id), JSON.stringify(pending), { expirationTtl: PENDING_TTL });
  }
  return jsonResponse({ ok: true, pending: pending ?? null });
};

export const onRequestPost: PagesFunction<RelayEnv, 'id'> = async ({ params, request, env }) => {
  const auth = await authorize(params, request, env);
  if (auth.response) return auth.response;

  const body = await readJson<AckRequest>(request);
  if (!body?.commandId) return jsonResponse({ ok: false, error: 'missing commandId' }, { status: 400 });

  const pending = await env.LIGHTWEAVER_RELAY.get<PendingCommand>(cardPendingKey(auth.id), 'json');
  const cleared = pending?.commandId === body.commandId;
  if (cleared) await env.LIGHTWEAVER_RELAY.delete(cardPendingKey(auth.id));
  return jsonResponse({ ok: true, cleared });
};

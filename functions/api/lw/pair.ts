// POST /api/lw/pair
// Browser submits a pairing code; we return the cardId + ownerToken so the
// browser can authenticate future control/state requests.
// One-time use — the pair entry is deleted on successful pair.

import { RelayEnv, PagesFunction, CardMeta, jsonResponse, corsPreflight, readJson, cardMetaKey, pairKey } from './_lib';

interface PairRequest { code: string; }

export const onRequestOptions: PagesFunction = async () => corsPreflight();

export const onRequestPost: PagesFunction<RelayEnv> = async ({ request, env }) => {
  const body = await readJson<PairRequest>(request);
  const code = (body?.code || '').trim().toUpperCase();
  if (!code || code.length !== 6) {
    return jsonResponse({ ok: false, error: 'invalid code' }, { status: 400 });
  }
  const pair = await env.LIGHTWEAVER_RELAY.get<{ cardId: string; expiresAt: number }>(pairKey(code), 'json');
  if (!pair) return jsonResponse({ ok: false, error: 'code not found' }, { status: 404 });
  if (pair.expiresAt < Date.now()) {
    await env.LIGHTWEAVER_RELAY.delete(pairKey(code));
    return jsonResponse({ ok: false, error: 'code expired' }, { status: 410 });
  }
  const meta = await env.LIGHTWEAVER_RELAY.get<CardMeta>(cardMetaKey(pair.cardId), 'json');
  if (!meta) return jsonResponse({ ok: false, error: 'card disappeared' }, { status: 404 });

  await env.LIGHTWEAVER_RELAY.delete(pairKey(code));
  return jsonResponse({
    ok: true,
    cardId: pair.cardId,
    ownerToken: meta.ownerToken,
    label: meta.label,
  });
};

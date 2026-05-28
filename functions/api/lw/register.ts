// POST /api/lw/register
//
// Called by the card the first time it boots (or after factory reset). The
// card sends its UUID; we generate an owner token and a one-time pairing
// code. The card prints the pairing code on its onboard page; the customer
// types it once at led.mandalacodes.com to bind the card to their browser.

import { RelayEnv, PagesFunction, CardMeta, jsonResponse, corsPreflight, readJson, cardMetaKey, pairKey, newToken, newPairCode, PAIR_TTL } from './_lib';

interface RegisterRequest {
  cardId: string;
  label?: string;
  fw?: string;
}

interface RegisterResponse {
  ok: true;
  ownerToken: string;
  pairCode: string;
  pairExpiresInSec: number;
}

export const onRequestOptions: PagesFunction = async () => corsPreflight();

export const onRequestPost: PagesFunction<RelayEnv> = async ({ request, env }) => {
  const body = await readJson<RegisterRequest>(request);
  if (!body?.cardId || body.cardId.length < 8) {
    return jsonResponse({ ok: false, error: 'invalid cardId' }, { status: 400 });
  }

  // If the card is already registered, just rotate the pair code (so the
  // customer can re-pair after losing the browser binding) and return the
  // existing ownerToken.
  const existing = await env.LIGHTWEAVER_RELAY.get<CardMeta>(cardMetaKey(body.cardId), 'json');
  const ownerToken = existing?.ownerToken ?? newToken();
  const meta: CardMeta = {
    ownerToken,
    label: body.label || existing?.label || 'Lightweaver',
    pairedAt: existing?.pairedAt ?? Date.now(),
  };
  await env.LIGHTWEAVER_RELAY.put(cardMetaKey(body.cardId), JSON.stringify(meta));

  const pairCode = newPairCode();
  await env.LIGHTWEAVER_RELAY.put(
    pairKey(pairCode),
    JSON.stringify({ cardId: body.cardId, expiresAt: Date.now() + PAIR_TTL * 1000 }),
    { expirationTtl: PAIR_TTL }
  );

  const response: RegisterResponse = {
    ok: true,
    ownerToken,
    pairCode,
    pairExpiresInSec: PAIR_TTL,
  };
  return jsonResponse(response);
};

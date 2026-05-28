// POST /api/lw/heartbeat
// Card pings this every ~15s with its current state. We store it under
// card:<id>:state with a 24h TTL — long enough that "card is offline" is a
// clear signal but short enough that abandoned cards drop off.
//
// Auth: header `X-LW-Token: <ownerToken>` proves this card owns its meta
// entry. Cheap: we just check the token matches the stored meta.

import { RelayEnv, PagesFunction, CardState, CardMeta, jsonResponse, corsPreflight, readJson, cardMetaKey, cardStateKey, STATE_TTL } from './_lib';

export const onRequestOptions: PagesFunction = async () => corsPreflight();

export const onRequestPost: PagesFunction<RelayEnv> = async ({ request, env }) => {
  const token = request.headers.get('X-LW-Token') || '';
  const body = await readJson<Partial<CardState>>(request);
  if (!body?.id) return jsonResponse({ ok: false, error: 'missing id' }, { status: 400 });

  const meta = await env.LIGHTWEAVER_RELAY.get<CardMeta>(cardMetaKey(body.id), 'json');
  if (!meta) return jsonResponse({ ok: false, error: 'unknown card' }, { status: 404 });
  if (meta.ownerToken !== token) return jsonResponse({ ok: false, error: 'bad token' }, { status: 401 });

  const state: CardState = {
    id: body.id,
    label: meta.label,
    online: true,
    lastSeenAt: Date.now(),
    pixels: body.pixels,
    currentPatternId: body.currentPatternId,
    brightness: body.brightness,
    hue: body.hue,
    saturation: body.saturation,
    breathe: body.breathe,
    drift: body.drift,
    blackout: body.blackout,
    fw: body.fw,
  };
  await env.LIGHTWEAVER_RELAY.put(cardStateKey(body.id), JSON.stringify(state), { expirationTtl: STATE_TTL });
  return jsonResponse({ ok: true });
};

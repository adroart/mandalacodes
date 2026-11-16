import type { R2Bucket } from '@cloudflare/workers-types';
import { isResponse, json, requireBinding } from '../../../reflections/_shared';
import { parseAudioRange } from '../../../reflections/segments/[id]/audio';
import { requirePickup, type PickupContext } from '../../_shared';
import { parseTakeId, readTakeDetails } from '../_shared';

/** A card recording's audio for the Mac, with Range like the segments audio route. Only the one key the id names is read. */
export async function onRequestGet({ request, env, params }: PickupContext) {
  const refused = await requirePickup(request, env); if (refused) return refused;
  const bucket = requireBinding(env.ORACLE_PRIVATE, 'ORACLE_PRIVATE') as R2Bucket | Response; if (isResponse(bucket)) return bucket;
  const take = parseTakeId(params.id);
  if (!take) return json({ ok: false, error: 'invalid take id' }, 400);
  const head = await bucket.head(take.audioKey);
  if (!head) return json({ ok: false, error: 'take not found' }, 404);
  const size = head.size;
  const range = request.headers.get('Range');
  const headers = new Headers({ 'Content-Type': readTakeDetails(head).mimeType, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, no-store' });
  let object; let status = 200;
  if (range) {
    const parsed = parseAudioRange(range, size);
    if (!parsed) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    const { start, end } = parsed;
    object = await bucket.get(take.audioKey, { range: { offset: start, length: end - start + 1 } });
    status = 206; headers.set('Content-Range', `bytes ${start}-${end}/${size}`); headers.set('Content-Length', String(end - start + 1));
  } else { object = await bucket.get(take.audioKey); headers.set('Content-Length', String(size)); }
  return object ? new Response(object.body as unknown as BodyInit, { status, headers }) : json({ ok: false, error: 'audio unavailable' }, 404);
}

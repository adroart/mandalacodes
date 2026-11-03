import { isResponse, json, requireBinding } from '../../../reflections/_shared';
import { parseAudioRange } from '../../../reflections/segments/[id]/audio';
import { requirePickup, type PickupContext } from '../../_shared';

/** The recording's audio for the Mac. Same bytes the phone's own player gets, behind the pickup key instead of a login. */
export async function onRequestGet({ request, env, params }: PickupContext) {
  const refused = await requirePickup(request, env); if (refused) return refused;
  const db = requireBinding(env.DB, 'DB'); if (isResponse(db)) return db;
  const bucket = requireBinding(env.ORACLE_PRIVATE, 'ORACLE_PRIVATE'); if (isResponse(bucket)) return bucket;
  const row = await db.prepare('SELECT object_key,mime_type,byte_size FROM oracle_reflection_segments WHERE id=?1').bind(params.id).first<{ object_key: string; mime_type: string; byte_size: number }>();
  if (!row) return json({ ok: false, error: 'segment not found' }, 404);
  const range = request.headers.get('Range');
  const headers = new Headers({ 'Content-Type': row.mime_type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, no-store' });
  let object; let status = 200;
  if (range) {
    const parsed = parseAudioRange(range, row.byte_size);
    if (!parsed) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${row.byte_size}` } });
    const { start, end } = parsed;
    object = await bucket.get(row.object_key, { range: { offset: start, length: end - start + 1 } });
    status = 206; headers.set('Content-Range', `bytes ${start}-${end}/${row.byte_size}`); headers.set('Content-Length', String(end - start + 1));
  } else { object = await bucket.get(row.object_key); headers.set('Content-Length', String(row.byte_size)); }
  return object ? new Response(object.body, { status, headers }) : json({ ok: false, error: 'audio unavailable' }, 404);
}

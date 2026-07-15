import { admin, isAuthResponse, isResponse, json, requireBinding, type ReflectionContext } from '../../_shared';

export function parseAudioRange(value: string, size: number): { start: number; end: number } | null {
  if (!Number.isSafeInteger(size) || size <= 0 || value.includes(',')) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2])) return null;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
    const length = Math.min(suffixLength, size);
    return { start: size - length, end: size - 1 };
  }
  const start = Number(match[1]);
  if (!Number.isSafeInteger(start) || start >= size) return null;
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(requestedEnd) || requestedEnd < start) return null;
  return { start, end: Math.min(requestedEnd, size - 1) };
}

export async function onRequestGet({ request, env, params }: ReflectionContext) {
  const auth = await admin(request, env); if (isAuthResponse(auth)) return auth;
  const db = requireBinding(env.DB, 'DB'); if (isResponse(db)) return db;
  const bucket = requireBinding(env.ORACLE_PRIVATE, 'ORACLE_PRIVATE'); if (isResponse(bucket)) return bucket;
  const row = await db.prepare('SELECT object_key,mime_type,byte_size FROM oracle_reflection_segments WHERE id=?1 AND owner_user_id=?2').bind(params.id, auth.userId).first<{ object_key: string; mime_type: string; byte_size: number }>();
  if (!row) return json({ ok: false, error: 'segment not found' }, 404);
  const range = request.headers.get('Range'); let object; let status = 200; const headers = new Headers({ 'Content-Type': row.mime_type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, no-store' });
  if (range) {
    const parsed = parseAudioRange(range, row.byte_size); if (!parsed) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${row.byte_size}` } });
    const { start, end } = parsed;
    object = await bucket.get(row.object_key, { range: { offset: start, length: end - start + 1 } }); status = 206; headers.set('Content-Range', `bytes ${start}-${end}/${row.byte_size}`); headers.set('Content-Length', String(end - start + 1));
  } else { object = await bucket.get(row.object_key); headers.set('Content-Length', String(row.byte_size)); }
  return object ? new Response(object.body, { status, headers }) : json({ ok: false, error: 'audio unavailable' }, 404);
}

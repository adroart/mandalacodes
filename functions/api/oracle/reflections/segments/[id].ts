import { admin, isAuthResponse, isResponse, json, requireBinding, segmentFromRow, type ReflectionContext } from '../_shared';
export async function onRequestPatch({ request, env, params }: ReflectionContext) {
  const auth = await admin(request, env); if (isAuthResponse(auth)) return auth;
  const db = requireBinding(env.DB, 'DB'); if (isResponse(db)) return db;
  let body: Record<string, unknown>; try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid JSON' }, 400); }
  if (typeof body.transcript !== 'string' || new TextEncoder().encode(body.transcript).length > 100_000) return json({ ok: false, error: 'transcript must be at most 100000 UTF-8 bytes' }, 400);
  const now = new Date().toISOString(); const result = await db.prepare('UPDATE oracle_reflection_segments SET transcript=?3,updated_at=?4 WHERE id=?1 AND owner_user_id=?2').bind(params.id, auth.userId, body.transcript.trim(), now).run();
  if (result.meta.changes !== 1) return json({ ok: false, error: 'segment not found' }, 404);
  const row = await db.prepare('SELECT * FROM oracle_reflection_segments WHERE id=?1 AND owner_user_id=?2').bind(params.id, auth.userId).first<Record<string, unknown>>();
  return json({ segment: segmentFromRow(row!) });
}

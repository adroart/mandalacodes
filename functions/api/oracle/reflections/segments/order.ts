import { reorderSegments } from '../../../../../utils/oracleReflection';
import { admin, isAuthResponse, isResponse, json, requireBinding, segmentFromRow, validUuid, type ReflectionContext } from '../_shared';
export async function onRequestPut({ request, env }: ReflectionContext) {
  const auth = await admin(request, env); if (isAuthResponse(auth)) return auth;
  const db = requireBinding(env.DB, 'DB'); if (isResponse(db)) return db;
  let body: Record<string, unknown>; try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid JSON' }, 400); }
  if (!validUuid(body.sessionId) || !Array.isArray(body.segmentIds) || body.segmentIds.some((id) => !validUuid(id))) return json({ ok: false, error: 'invalid ordering' }, 400);
  const rows = (await db.prepare('SELECT * FROM oracle_reflection_segments WHERE session_id=?1 AND owner_user_id=?2 ORDER BY sequence ASC').bind(body.sessionId, auth.userId).all<Record<string, unknown>>()).results;
  let ordered; try { ordered = reorderSegments(rows as never[], body.segmentIds as string[]); } catch (error) { return json({ ok: false, error: (error as Error).message }, 400); }
  const now = new Date().toISOString();
  const temporaryBase = Math.max(-1, ...rows.map((row) => Number(row.sequence))) + 1;
  const temporary = ordered.map((row, index) => db.prepare('UPDATE oracle_reflection_segments SET sequence=?3 WHERE id=?1 AND session_id=?2 AND owner_user_id=?4').bind(row.id, body.sessionId, temporaryBase + index, auth.userId));
  const final = ordered.map((row, index) => db.prepare('UPDATE oracle_reflection_segments SET sequence=?3,updated_at=?5 WHERE id=?1 AND session_id=?2 AND owner_user_id=?4').bind(row.id, body.sessionId, index, auth.userId, now));
  await db.batch([...temporary, ...final]); return json({ segments: ordered.map((row, sequence) => segmentFromRow({ ...row, sequence, updated_at: now })) });
}

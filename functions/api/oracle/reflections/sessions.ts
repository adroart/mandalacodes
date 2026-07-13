import { validateHexagramNumber } from '../../../../utils/oracleReflection';
import { admin, isAuthResponse, isResponse, json, requireBinding, sessionFromRow, validUuid, type ReflectionContext } from './_shared';

export async function onRequestPost({ request, env }: ReflectionContext) {
  const auth = await admin(request, env); if (isAuthResponse(auth)) return auth;
  const db = requireBinding(env.DB, 'DB'); if (isResponse(db)) return db;
  let body: Record<string, unknown>; try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid JSON' }, 400); }
  if (!validUuid(body.id)) return json({ ok: false, error: 'id must be a UUID' }, 400);
  let hexagram: number; try { hexagram = validateHexagramNumber(body.hexagramNumber); } catch (error) { return json({ ok: false, error: (error as Error).message }, 400); }
  const now = new Date().toISOString();
  await db.prepare('INSERT INTO oracle_reflection_sessions (id,owner_user_id,hexagram_number,created_at,updated_at,finished_at) VALUES (?1,?2,?3,?4,?4,NULL) ON CONFLICT(id) DO NOTHING').bind(body.id, auth.userId, hexagram, now).run();
  const row = await db.prepare('SELECT * FROM oracle_reflection_sessions WHERE id=?1 AND owner_user_id=?2').bind(body.id, auth.userId).first<Record<string, unknown>>();
  return row ? json({ session: sessionFromRow(row) }, row.created_at === now ? 201 : 200) : json({ ok: false, error: 'session not found' }, 404);
}
export async function onRequestGet({ request, env }: ReflectionContext) {
  const auth = await admin(request, env); if (isAuthResponse(auth)) return auth;
  const db = requireBinding(env.DB, 'DB'); if (isResponse(db)) return db;
  let hexagram: number; try { hexagram = validateHexagramNumber(Number(new URL(request.url).searchParams.get('hexagram'))); } catch (error) { return json({ ok: false, error: (error as Error).message }, 400); }
  const result = await db.prepare('SELECT * FROM oracle_reflection_sessions WHERE owner_user_id=?1 AND hexagram_number=?2 ORDER BY created_at DESC').bind(auth.userId, hexagram).all<Record<string, unknown>>();
  const rows = result.results.map(sessionFromRow); const currentIndex = rows.findIndex((row) => row.finishedAt === null);
  return json({ current: currentIndex < 0 ? null : rows[currentIndex], history: rows.filter((_, index) => index !== currentIndex) });
}

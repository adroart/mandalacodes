import { resolveBetter, parseMeta } from '../../../../../../utils/oracleBetterTranscript';
import { admin, isAuthResponse, isResponse, json, requireBinding, segmentFromRow, type ReflectionContext } from '../../_shared';

/**
 * Adrian's answer on a better transcript from the Mac that waits beside words he edited.
 * Body: { decisions: { "change-1": "accept" | "keep" | "defer", ... } }
 * The words change only when every change has been answered accept or keep.
 */
export async function onRequestPost({ request, env, params }: ReflectionContext) {
  const auth = await admin(request, env); if (isAuthResponse(auth)) return auth;
  const db = requireBinding(env.DB, 'DB'); if (isResponse(db)) return db;
  let body: Record<string, unknown>; try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid JSON' }, 400); }
  const decisions = body.decisions;
  if (!decisions || typeof decisions !== 'object' || Array.isArray(decisions)) return json({ ok: false, error: 'decisions are required' }, 400);
  const row = await db.prepare('SELECT * FROM oracle_reflection_segments WHERE id=?1 AND owner_user_id=?2').bind(params.id, auth.userId).first<Record<string, unknown>>();
  if (!row) return json({ ok: false, error: 'segment not found' }, 404);
  const now = new Date().toISOString();
  const resolved = resolveBetter({ transcript: String(row.transcript ?? ''), metadata: parseMeta(row.provider_metadata_json) }, decisions as Record<string, unknown>, now);
  if (resolved.ok === false) return json({ ok: false, error: resolved.error }, 409);
  const changed = await db.prepare("UPDATE oracle_reflection_segments SET transcript=?3,provider_metadata_json=?4,updated_at=?5 WHERE id=?1 AND owner_user_id=?2 AND updated_at=?6")
    .bind(params.id, auth.userId, resolved.transcript, JSON.stringify(resolved.meta), now, row.updated_at).run();
  if (changed.meta.changes !== 1) return json({ ok: false, error: 'this recording changed; refresh and compare again' }, 409);
  const fresh = await db.prepare('SELECT * FROM oracle_reflection_segments WHERE id=?1 AND owner_user_id=?2').bind(params.id, auth.userId).first<Record<string, unknown>>();
  return json({ ok: true, done: resolved.done, segment: segmentFromRow(fresh ?? row) });
}

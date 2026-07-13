import { reorderSegments, validateHexagramNumber, validateSegmentMetadata } from '../../../../utils/oracleReflection';
import { admin, isAuthResponse, isResponse, json, requireBinding, segmentFromRow, validUuid, type ReflectionContext } from './_shared';

export function isSameCommittedSegment(row: Record<string, unknown>, input: { ownerId: string; sessionId: string; segmentId: string; byteSize: number; mimeType: string; durationMs: number; recordedAt: string }) {
  return row.owner_user_id === input.ownerId && row.session_id === input.sessionId && row.byte_size === input.byteSize && row.mime_type === input.mimeType && row.duration_ms === input.durationMs && row.recorded_at === input.recordedAt && row.object_key === `reflections/${input.ownerId}/${input.sessionId}/${input.segmentId}`;
}
export const sequencesAfterNewestInsert = <T extends { id: string; sequence: number }>(rows: T[]) => rows.map((row) => ({ ...row, sequence: row.sequence + 1 }));

export async function onRequestPost({ request, env }: ReflectionContext) {
  const auth = await admin(request, env); if (isAuthResponse(auth)) return auth;
  const db = requireBinding(env.DB, 'DB'); if (isResponse(db)) return db;
  const bucket = requireBinding(env.ORACLE_PRIVATE, 'ORACLE_PRIVATE'); if (isResponse(bucket)) return bucket;
  let form: FormData; try { form = await request.formData(); } catch { return json({ ok: false, error: 'multipart form required' }, 400); }
  const audio = form.get('audio'); const raw = form.get('metadata');
  if (!(audio instanceof Blob) || typeof raw !== 'string') return json({ ok: false, error: 'metadata and audio are required' }, 400);
  let metadata: Record<string, unknown>; try { metadata = JSON.parse(raw); } catch { return json({ ok: false, error: 'invalid metadata' }, 400); }
  if (!validUuid(metadata.id) || !validUuid(metadata.sessionId)) return json({ ok: false, error: 'invalid segment identity' }, 400);
  try { validateHexagramNumber(metadata.hexagramNumber); validateSegmentMetadata(metadata as never); } catch (error) { return json({ ok: false, error: (error as Error).message }, 400); }
  if (audio.size !== metadata.byteSize || audio.type !== metadata.mimeType) return json({ ok: false, error: 'audio does not match metadata' }, 400);
  const session = await db.prepare('SELECT id FROM oracle_reflection_sessions WHERE id=?1 AND owner_user_id=?2 AND hexagram_number=?3').bind(metadata.sessionId, auth.userId, metadata.hexagramNumber).first();
  if (!session) return json({ ok: false, error: 'session not found' }, 404);
  const existing = await db.prepare('SELECT * FROM oracle_reflection_segments WHERE id=?1').bind(metadata.id).first<Record<string, unknown>>();
  if (existing) return isSameCommittedSegment(existing, { ownerId: auth.userId, sessionId: metadata.sessionId, segmentId: metadata.id, byteSize: Number(metadata.byteSize), mimeType: String(metadata.mimeType), durationMs: Number(metadata.durationMs), recordedAt: String(metadata.recordedAt) }) ? json({ segment: segmentFromRow(existing) }) : json({ ok: false, error: 'segment identity conflict' }, 409);
  const current = (await db.prepare('SELECT id,sequence FROM oracle_reflection_segments WHERE session_id=?1 AND owner_user_id=?2 ORDER BY sequence ASC').bind(metadata.sessionId, auth.userId).all<{ id: string; sequence: number }>()).results;
  const key = `reflections/${auth.userId}/${metadata.sessionId}/${metadata.id}`; const now = new Date().toISOString();
  await bucket.put(key, await audio.arrayBuffer(), { httpMetadata: { contentType: audio.type }, customMetadata: { sessionId: String(metadata.sessionId), segmentId: String(metadata.id) } });
  try {
    const temporaryBase = Math.max(-1, ...current.map((row) => row.sequence)) + 1;
    const temporary = current.map((row, index) => db.prepare('UPDATE oracle_reflection_segments SET sequence=?3 WHERE id=?1 AND session_id=?2').bind(row.id, metadata.sessionId, temporaryBase + index));
    const shifted = sequencesAfterNewestInsert(current).map((row) => db.prepare('UPDATE oracle_reflection_segments SET sequence=?3 WHERE id=?1 AND session_id=?2').bind(row.id, metadata.sessionId, row.sequence));
    const insert = db.prepare('INSERT INTO oracle_reflection_segments (id,session_id,owner_user_id,sequence,recorded_at,duration_ms,mime_type,byte_size,object_key,transcript,transcription_status,transcription_error,provider_metadata_json,created_at,updated_at) VALUES (?1,?2,?3,0,?4,?5,?6,?7,?8,\'\',\'transcription_pending\',NULL,NULL,?9,?9)').bind(metadata.id, metadata.sessionId, auth.userId, metadata.recordedAt, metadata.durationMs, metadata.mimeType, metadata.byteSize, key, now);
    await db.batch([...temporary, ...shifted, insert]);
  } catch { await bucket.delete(key); return json({ ok: false, error: 'segment commit failed' }, 500); }
  const row = await db.prepare('SELECT * FROM oracle_reflection_segments WHERE id=?1 AND owner_user_id=?2').bind(metadata.id, auth.userId).first<Record<string, unknown>>();
  return json({ segment: segmentFromRow(row!) }, 201);
}

export async function onRequestGet({ request, env }: ReflectionContext) {
  const auth = await admin(request, env); if (isAuthResponse(auth)) return auth;
  const db = requireBinding(env.DB, 'DB'); if (isResponse(db)) return db;
  const sessionId = new URL(request.url).searchParams.get('sessionId'); if (!validUuid(sessionId)) return json({ ok: false, error: 'invalid sessionId' }, 400);
  const result = await db.prepare('SELECT * FROM oracle_reflection_segments WHERE session_id=?1 AND owner_user_id=?2 ORDER BY sequence ASC').bind(sessionId, auth.userId).all<Record<string, unknown>>();
  return json({ segments: reorderSegments(result.results as never[], result.results.map((row) => String(row.id))).map(segmentFromRow) });
}

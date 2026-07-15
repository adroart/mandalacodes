import { admin, isAuthResponse, isResponse, json, requireBinding, segmentFromRow, transcribeCommittedAudio, type ReflectionContext } from '../../_shared';
export async function onRequestPost({ request, env, params }: ReflectionContext) {
  const auth = await admin(request, env); if (isAuthResponse(auth)) return auth;
  const db = requireBinding(env.DB, 'DB'); if (isResponse(db)) return db;
  const bucket = requireBinding(env.ORACLE_PRIVATE, 'ORACLE_PRIVATE'); if (isResponse(bucket)) return bucket;
  if (!env.GROQ_API_KEY && !env.AI) return json({ ok: false, error: 'transcription provider unavailable' }, 503);
  let row = await db.prepare('SELECT * FROM oracle_reflection_segments WHERE id=?1 AND owner_user_id=?2').bind(params.id, auth.userId).first<Record<string, unknown>>();
  if (!row) return json({ ok: false, error: 'segment not found' }, 404);
  if (row.transcription_status === 'transcribed') return json({ segment: segmentFromRow(row) });
  const now = new Date().toISOString();
  const leaseCutoff = new Date(Date.parse(now) - 5 * 60 * 1000).toISOString();
  const claim = await db.prepare("UPDATE oracle_reflection_segments SET transcription_status='transcribing',transcription_error=NULL,transcription_started_at=?3,updated_at=?3 WHERE id=?1 AND owner_user_id=?2 AND (transcription_status IN ('transcription_pending','failed') OR (transcription_status='transcribing' AND (transcription_started_at IS NULL OR transcription_started_at<=?4)))").bind(params.id, auth.userId, now, leaseCutoff).run();
  if (claim.meta.changes !== 1) { row = await db.prepare('SELECT * FROM oracle_reflection_segments WHERE id=?1 AND owner_user_id=?2').bind(params.id, auth.userId).first<Record<string, unknown>>(); return json({ segment: segmentFromRow(row!) }, 202); }
  try {
    const object = await bucket.get(String(row.object_key));
    if (!object) {
      console.error('[oracle-reflection-transcription]', { stage: 'r2-read', errorCode: 'audio_object_missing', segmentId: String(row.id).slice(0, 64) });
      throw new Error('reflection audio object missing');
    }
    const result = await transcribeCommittedAudio(env, await object.arrayBuffer(), String(row.mime_type)); const updatedAt = new Date().toISOString();
    await db.prepare("UPDATE oracle_reflection_segments SET transcript=?3,transcription_status='transcribed',transcription_error=NULL,transcription_started_at=NULL,provider_metadata_json=?4,updated_at=?5 WHERE id=?1 AND owner_user_id=?2 AND transcription_status='transcribing' AND transcription_started_at=?6").bind(params.id, auth.userId, result.text, result.metadataJson, updatedAt, now).run();
    row = await db.prepare('SELECT * FROM oracle_reflection_segments WHERE id=?1 AND owner_user_id=?2').bind(params.id, auth.userId).first<Record<string, unknown>>(); return json({ segment: segmentFromRow(row!) });
  } catch (error) {
    const detail = String((error as Error).message);
    const message = /reflection audio object missing/i.test(detail)
      ? 'Private audio is missing; this recording cannot be transcribed'
      : /quota|allocation/i.test(detail)
      ? 'Transcription allocation exhausted; retry later'
      : /Groq and Cloudflare/i.test(detail)
        ? 'Groq and Cloudflare transcription failed; retry later'
        : /Groq/i.test(detail)
          ? 'Groq transcription failed; retry later'
          : 'Cloudflare transcription failed; retry later';
    await db.prepare("UPDATE oracle_reflection_segments SET transcription_status='failed',transcription_error=?3,transcription_started_at=NULL,updated_at=?4 WHERE id=?1 AND owner_user_id=?2 AND transcription_status='transcribing' AND transcription_started_at=?5").bind(params.id, auth.userId, message, new Date().toISOString(), now).run();
    row = await db.prepare('SELECT * FROM oracle_reflection_segments WHERE id=?1 AND owner_user_id=?2').bind(params.id, auth.userId).first<Record<string, unknown>>(); return json({ segment: segmentFromRow(row!) }, 202);
  }
}

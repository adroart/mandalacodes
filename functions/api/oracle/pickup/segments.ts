import { awaitingBetter, parseMeta } from '../../../../utils/oracleBetterTranscript';
import { json, requireBinding, isResponse } from '../reflections/_shared';
import { requirePickup, type PickupContext } from './_shared';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
// Recordings whose first draft is done, or that never got one. A recording the phone is transcribing right now is left alone.
const LISTED = "('transcribed','failed','transcription_pending')";
/** JavaScript truthiness of one metadata field, in SQL. Only evaluated on valid JSON, so a malformed row cannot fail the query. */
const truthy = (path: string) => {
  const type = `json_type(s.provider_metadata_json,'${path}')`, value = `json_extract(s.provider_metadata_json,'${path}')`;
  // A missing field gives NULL, which would make the whole test NULL and drop the row; COALESCE makes it plainly false.
  return `COALESCE(${type} IN ('true','object','array') OR (${type}='text' AND ${value}<>'') OR (${type} IN ('integer','real') AND ${value}<>0),0)`;
};
/** awaitingBetter() in SQL: no AR Create result and not skipped. Unreadable metadata counts as waiting, as parseMeta() reads it as empty. */
const WAITING = `NOT (CASE WHEN json_valid(s.provider_metadata_json) THEN (${truthy('$.arCreate')} OR ${truthy('$.pickupSkipped')}) ELSE 0 END)`;

/** Recordings still waiting for a better transcript, oldest first. Read only. */
export async function onRequestGet({ request, env }: PickupContext) {
  const refused = await requirePickup(request, env); if (refused) return refused;
  const db = requireBinding(env.DB, 'DB'); if (isResponse(db)) return db;
  const asked = Number(new URL(request.url).searchParams.get('limit'));
  const limit = Number.isInteger(asked) && asked > 0 ? Math.min(asked, MAX_LIMIT) : DEFAULT_LIMIT;
  const rows = (await db.prepare(
    `SELECT s.*, r.hexagram_number AS hexagram_number FROM oracle_reflection_segments s JOIN oracle_reflection_sessions r ON r.id=s.session_id WHERE s.transcription_status IN ${LISTED} AND ${WAITING} ORDER BY s.recorded_at ASC LIMIT ?1`,
  ).bind(limit + 1).all<Record<string, unknown>>()).results;
  // The SQL applies the rule; the same check in JavaScript stays as a guard.
  const waiting = rows.filter((row) => awaitingBetter(parseMeta(row.provider_metadata_json)));
  const segments = waiting.slice(0, limit).map((row) => {
    const meta = parseMeta(row.provider_metadata_json);
    return {
      id: row.id,
      sessionId: row.session_id,
      hexagramNumber: row.hexagram_number,
      recordedAt: row.recorded_at,
      durationMs: row.duration_ms,
      mimeType: row.mime_type,
      byteSize: row.byte_size,
      status: row.transcription_status,
      draft: { text: row.transcript ?? '', provider: meta.provider ?? null },
      audioPath: `/api/oracle/pickup/segments/${row.id}/audio`,
    };
  });
  return json({ ok: true, segments, more: waiting.length > segments.length });
}

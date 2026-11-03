import { applyBetter, MAX_BETTER_TEXT_BYTES, parseMeta, type SegmentMeta } from '../../../../../../utils/oracleBetterTranscript';
import { isResponse, json, requireBinding, segmentFromRow, validUuid } from '../../../reflections/_shared';
import { requirePickup, resultKeyFor, type PickupContext } from '../../_shared';

const MAX_BODY_BYTES = 2_000_000;
const MAX_RESULT_BYTES = 1_500_000;
const HASH = /^[a-f0-9]{16,128}$/i;
const ENGINE = /^[A-Za-z0-9 ._-]{1,64}$/;

const reply = (status: number, error: string) => json({ ok: false, error }, status);

/**
 * The Mac brings back a better transcript for one recording.
 * - The phone's first draft is kept, always.
 * - If Adrian has not edited the text, the Mac's version becomes the working text.
 * - If he has, the Mac's version waits as a comparison; his words stand until he decides.
 * - Sending the same result again changes nothing.
 */
export async function onRequestPost({ request, env, params }: PickupContext) {
  const refused = await requirePickup(request, env); if (refused) return refused;
  const db = requireBinding(env.DB, 'DB'); if (isResponse(db)) return db;
  if (!validUuid(params.id)) return reply(400, 'invalid segment id');
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return reply(413, 'result is too large');
  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { return reply(400, 'invalid JSON'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400, 'invalid JSON');

  const row = await db.prepare('SELECT * FROM oracle_reflection_segments WHERE id=?1').bind(params.id).first<Record<string, unknown>>();
  if (!row) return reply(404, 'segment not found');
  const meta = parseMeta(row.provider_metadata_json);
  const transcript = String(row.transcript ?? '');
  const now = new Date().toISOString();

  const save = async (nextTranscript: string, nextMeta: SegmentMeta) => {
    const changed = await db.prepare("UPDATE oracle_reflection_segments SET transcript=?2,transcription_status='transcribed',transcription_error=NULL,transcription_started_at=NULL,provider_metadata_json=?3,updated_at=?4 WHERE id=?1 AND updated_at=?5")
      .bind(params.id, nextTranscript, JSON.stringify(nextMeta), now, row.updated_at).run();
    if (changed.meta.changes !== 1) return reply(409, 'this recording changed while the result was arriving; send it again');
    const fresh = await db.prepare('SELECT * FROM oracle_reflection_segments WHERE id=?1').bind(params.id).first<Record<string, unknown>>();
    return fresh ?? row;
  };

  if (body.outcome === 'skipped') {
    // The Mac could not do better for this one. Stop offering it; the phone's draft stays exactly as it is.
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 280) : '';
    if (!reason) return reply(400, 'say why it was set aside');
    if (meta.arCreate) return json({ ok: true, result: 'unchanged', segment: segmentFromRow(row) });
    const next: SegmentMeta = { ...meta, pickupSkipped: { reason, at: now } };
    const changed = await db.prepare('UPDATE oracle_reflection_segments SET provider_metadata_json=?2 WHERE id=?1 AND updated_at=?3').bind(params.id, JSON.stringify(next), row.updated_at).run();
    if (changed.meta.changes !== 1) return reply(409, 'this recording changed while the result was arriving; send it again');
    return json({ ok: true, result: 'skipped', segment: segmentFromRow({ ...row, provider_metadata_json: JSON.stringify(next) }) });
  }
  if (body.outcome !== 'improved') return reply(400, 'outcome must be improved or skipped');

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return reply(400, 'text must not be empty');
  if (new TextEncoder().encode(text).length > MAX_BETTER_TEXT_BYTES) return reply(400, 'text must be at most 100000 UTF-8 bytes');
  if (typeof body.resultHash !== 'string' || !HASH.test(body.resultHash)) return reply(400, 'resultHash must be a hex digest');
  const engine = typeof body.engine === 'string' ? body.engine.trim() : '';
  if (!ENGINE.test(engine)) return reply(400, 'engine must name the transcriber');
  const engineVersion = typeof body.engineVersion === 'string' && ENGINE.test(body.engineVersion.trim()) ? body.engineVersion.trim() : undefined;
  const speakers = Array.isArray(body.speakers) ? body.speakers : undefined;
  const optionalId = (value: unknown) => (typeof value === 'string' && validUuid(value) ? value : undefined);

  let resultKey: string | undefined;
  if (Array.isArray(body.segments) && body.segments.length) {
    const detail = JSON.stringify({ engine, engineVersion: engineVersion ?? null, receivedAt: now, resultHash: body.resultHash, text, segments: body.segments, speakers: speakers ?? [] });
    if (detail.length > MAX_RESULT_BYTES) return reply(413, 'word timing is too large to keep');
    const bucket = requireBinding(env.ORACLE_PRIVATE, 'ORACLE_PRIVATE'); if (isResponse(bucket)) return bucket;
    resultKey = resultKeyFor(String(row.object_key));
    await bucket.put(resultKey, detail, { httpMetadata: { contentType: 'application/json' }, customMetadata: { segmentId: String(row.id), resultHash: body.resultHash } });
  }

  const outcome = applyBetter({ transcript, metadata: meta }, {
    engine, engineVersion, text, resultHash: body.resultHash.toLowerCase(), resultKey,
    speakerCount: speakers?.length, jobId: optionalId(body.jobId), sourceId: optionalId(body.sourceId),
  }, now);
  if (outcome.outcome === 'unchanged' && outcome.meta === meta) return json({ ok: true, result: 'unchanged', segment: segmentFromRow(row) });

  const saved = await save(outcome.transcript, outcome.meta);
  if (saved instanceof Response) return saved;
  return json({ ok: true, result: outcome.outcome, segment: segmentFromRow(saved) }, outcome.outcome === 'unchanged' ? 200 : 201);
}

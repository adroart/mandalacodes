import { json, requireBinding, isResponse, validUuid } from '../../../reflections/_shared';
import { requirePickup, type PickupContext } from '../../_shared';
import { canClaimTranscript, findManifestKey, memoPrefix, memoView, readManifest, timedTranscriptText, writeManifest, type MemoManifest } from '../../../../memos/_shared';
import type { QuickTranscript } from '../../../../_lib/quickTranscription';

const MAX_BODY_BYTES = 3_000_000;
const MAX_TEXT_CHARS = 200_000;
const MAX_SEGMENTS = 6_000;

const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
function validTranscript(value: unknown): value is QuickTranscript {
  const t = value as QuickTranscript;
  if (!t || typeof t !== 'object' || typeof t.text !== 'string' || !t.text.trim() || t.text.length > MAX_TEXT_CHARS) return false;
  if (t.provider !== 'groq' && t.provider !== 'cloudflare') return false;
  if (t.segments === undefined) return true;
  return Array.isArray(t.segments) && t.segments.length <= MAX_SEGMENTS && t.segments.every((s) => finite(s.start) && finite(s.end) && typeof s.text === 'string');
}

/**
 * The transcriber on the VPS claims a memo ({claim:true}), then sends its first transcript ({transcript}) or why it
 * could not ({failed}). The claim is a guarded manifest write with a five-minute lease, so two transcribers never
 * both pay for the same recording.
 */
export async function onRequestPost({ request, env, params }: PickupContext) {
  const refused = await requirePickup(request, env); if (refused) return refused;
  const bucket = requireBinding(env.ORACLE_PRIVATE, 'ORACLE_PRIVATE'); if (isResponse(bucket)) return bucket;
  if (!validUuid(params.id)) return json({ ok: false, error: 'invalid memo id' }, 400);
  if (Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES) return json({ ok: false, error: 'transcript too large' }, 413);
  let body: { claim?: boolean; startedAt?: string; transcript?: unknown; failed?: string };
  try { body = await request.json(); } catch { return json({ ok: false, error: 'json body required' }, 400); }
  const key = await findManifestKey(bucket, params.id);
  const read = key ? await readManifest(bucket, key) : null;
  if (!key || !read) return json({ ok: false, error: 'memo not found' }, 404);
  const { manifest, etag } = read;
  if (!manifest.audio) return json({ ok: false, error: 'the memo has no recording yet' }, 409);

  if (body.claim) {
    if (!canClaimTranscript(manifest)) return json({ ok: false, error: 'already claimed or done', memo: memoView(manifest) }, 409);
    const claimed: MemoManifest = { ...manifest, transcript: { ...manifest.transcript, status: 'transcribing', startedAt: new Date().toISOString(), error: null } };
    if (!(await writeManifest(bucket, key, claimed, etag))) return json({ ok: false, error: 'the memo changed; read it again' }, 409);
    return json({ ok: true, memo: memoView(claimed), startedAt: claimed.transcript.startedAt });
  }

  // Only the holder of the current claim may finish it; a recording replaced meanwhile keeps its own empty transcript.
  if (manifest.transcript.status !== 'transcribing' || manifest.transcript.startedAt !== body.startedAt) return json({ ok: false, error: 'this claim is no longer current', memo: memoView(manifest) }, 409);
  let transcript: MemoManifest['transcript'];
  if (typeof body.failed === 'string') {
    transcript = { ...manifest.transcript, status: 'failed', error: body.failed.slice(0, 200) || 'transcription failed' };
  } else {
    if (!validTranscript(body.transcript)) return json({ ok: false, error: 'invalid transcript' }, 400);
    const resultKey = `${memoPrefix(manifest.ownerUserId, manifest.id)}transcript.json`;
    await bucket.put(resultKey, JSON.stringify(body.transcript), { httpMetadata: { contentType: 'application/json' } });
    await bucket.put(resultKey.replace(/\.json$/, '.md'), timedTranscriptText(body.transcript), { httpMetadata: { contentType: 'text/markdown; charset=utf-8' } });
    transcript = { status: 'done', startedAt: manifest.transcript.startedAt, provider: body.transcript.provider, error: null, key: resultKey };
  }
  const finished = { ...manifest, transcript };
  if (!(await writeManifest(bucket, key, finished, etag))) return json({ ok: false, error: 'the memo changed; read it again' }, 409);
  return json({ ok: true, memo: memoView(finished) });
}

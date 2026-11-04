import { json, requireBinding, isResponse, validUuid } from '../../../../reflections/_shared';
import { requirePickup, type PickupContext } from '../../../_shared';
import { findManifestKey, readManifest } from '../../../../../memos/_shared';

/** A memo's recording ("audio"), full transcript ("transcript"), the plan left for the Mac ("handoff") or one photo (its id). */
export async function onRequestGet({ request, env, params }: PickupContext) {
  const refused = await requirePickup(request, env); if (refused) return refused;
  const bucket = requireBinding(env.ORACLE_PRIVATE, 'ORACLE_PRIVATE'); if (isResponse(bucket)) return bucket;
  if (!validUuid(params.id)) return json({ ok: false, error: 'invalid memo id' }, 400);
  const manifestKey = await findManifestKey(bucket, params.id);
  const read = manifestKey ? await readManifest(bucket, manifestKey) : null;
  if (!read) return json({ ok: false, error: 'memo not found' }, 404);
  const { manifest } = read;
  const key = params.file === 'audio' ? manifest.audio?.key
    : params.file === 'transcript' ? manifest.transcript.key
    : params.file === 'handoff' ? manifest.handoff?.key
    : manifest.photos.find((photo) => photo.id === params.file)?.key;
  const object = key ? await bucket.get(key) : null;
  if (!object) return json({ ok: false, error: 'file not found' }, 404);
  return new Response(object.body as never, { headers: { 'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream', 'Content-Length': String(object.size), 'Cache-Control': 'no-store', ETag: object.httpEtag } });
}

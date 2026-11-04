import { json, requireBinding, isResponse, validUuid } from '../../reflections/_shared';
import { requirePickup, type PickupContext } from '../_shared';
import { findManifestKey, memoView, readManifest } from '../../../memos/_shared';

/** One memo for the pickup: what it holds, where each file is, and its timed transcript once there is one. */
export async function onRequestGet({ request, env, params }: PickupContext) {
  const refused = await requirePickup(request, env); if (refused) return refused;
  const bucket = requireBinding(env.ORACLE_PRIVATE, 'ORACLE_PRIVATE'); if (isResponse(bucket)) return bucket;
  if (!validUuid(params.id)) return json({ ok: false, error: 'invalid memo id' }, 400);
  const key = await findManifestKey(bucket, params.id);
  const read = key ? await readManifest(bucket, key) : null;
  if (!read) return json({ ok: false, error: 'memo not found' }, 404);
  const { manifest } = read;
  const transcriptKey = manifest.transcript.key;
  const transcript = transcriptKey ? await (await bucket.get(transcriptKey.replace(/\.json$/, '.md')))?.text() ?? null : null;
  const base = `/api/oracle/pickup/memos/${manifest.id}`;
  return json({
    ok: true,
    memo: memoView(manifest),
    files: {
      audio: manifest.audio ? `${base}/files/audio` : null,
      photos: manifest.photos.map((photo) => ({ id: photo.id, name: photo.name, path: `${base}/files/${photo.id}` })),
      transcriptJson: transcriptKey ? `${base}/files/transcript` : null,
    },
    transcript,
  });
}

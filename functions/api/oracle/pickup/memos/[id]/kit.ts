import { json, requireBinding, isResponse, validUuid } from '../../../reflections/_shared';
import { requirePickup, type PickupContext } from '../../_shared';
import { declaredLength, findManifestKey, MAX_FRAME_BYTES, MAX_KIT_FRAMES, memoPrefix, memoView, readManifest, writeManifest, type MemoManifest } from '../../../../memos/_shared';

const FORMATS = new Set(['story', 'reel', 'post', 'carousel']);

/**
 * The VPS feeder leaves the posting kit for Adrian's phone: the finished frames and the caption he said yes to.
 * JSON {format, caption, frames} starts a new kit (frames = how many will follow); then each frame is sent as a raw
 * PNG with ?frame=<1-based number>. The memo page shows the kit with Save to Photos and Copy caption. Nothing posts.
 */
export async function onRequestPost({ request, env, params }: PickupContext) {
  const refused = await requirePickup(request, env); if (refused) return refused;
  const bucket = requireBinding(env.ORACLE_PRIVATE, 'ORACLE_PRIVATE'); if (isResponse(bucket)) return bucket;
  if (!validUuid(params.id)) return json({ ok: false, error: 'invalid memo id' }, 400);
  const key = await findManifestKey(bucket, params.id);
  const read = key ? await readManifest(bucket, key) : null;
  if (!key || !read) return json({ ok: false, error: 'memo not found' }, 404);
  const { manifest, etag } = read;
  const type = (request.headers.get('Content-Type') ?? '').toLowerCase();
  let next: MemoManifest;
  if (type.startsWith('application/json')) {
    let body: { format?: unknown; caption?: unknown; frames?: unknown };
    try { body = await request.json(); } catch { return json({ ok: false, error: 'json body required' }, 400); }
    if (typeof body.format !== 'string' || !FORMATS.has(body.format)) return json({ ok: false, error: 'format is story, reel, post or carousel' }, 400);
    if (typeof body.caption !== 'string' || body.caption.length > 2200) return json({ ok: false, error: 'the caption is text up to 2,200 characters' }, 400);
    if (!Number.isInteger(body.frames) || (body.frames as number) < 1 || (body.frames as number) > MAX_KIT_FRAMES) return json({ ok: false, error: `frames is how many frames follow, 1 to ${MAX_KIT_FRAMES}` }, 400);
    next = { ...manifest, kit: { format: body.format, caption: body.caption, frames: Array.from({ length: body.frames as number }, () => ({ key: '', name: '', byteSize: 0 })), at: new Date().toISOString() } };
  } else if (type === 'image/png') {
    if (!manifest.kit) return json({ ok: false, error: 'start the kit first (JSON format, caption, frames)' }, 409);
    const n = Number(new URL(request.url).searchParams.get('frame'));
    if (!Number.isInteger(n) || n < 1 || n > manifest.kit.frames.length) return json({ ok: false, error: `frame is 1 to ${manifest.kit.frames.length}` }, 400);
    const length = declaredLength(request, MAX_FRAME_BYTES, 'a frame is at most 10 MB'); if (isResponse(length)) return length;
    const frameKey = `${memoPrefix(manifest.ownerUserId, manifest.id)}kit/${n}.png`;
    await bucket.put(frameKey, request.body as never, { httpMetadata: { contentType: 'image/png' } });
    const frames = manifest.kit.frames.map((f, i) => i === n - 1 ? { key: frameKey, name: `${manifest.kit!.format}-${n}.png`, byteSize: length } : f);
    next = { ...manifest, kit: { ...manifest.kit, frames } };
  } else return json({ ok: false, error: 'send JSON to start the kit, or a PNG frame' }, 415);
  if (!(await writeManifest(bucket, key, next, etag))) return json({ ok: false, error: 'the memo changed; read it again' }, 409);
  return json({ ok: true, memo: memoView(next) });
}

import { json, isResponse } from '../../oracle/reflections/_shared';
import { conflict, declaredLength, isPhotoType, MAX_PHOTO_BYTES, MAX_PHOTOS, memoPrefix, memoView, ownMemo, writeManifest, type MemoContext } from '../_shared';

const cleanName = (value: string | null) => (value ?? '').replace(/[\\/\u0000-\u001f]/g, '').trim().slice(0, 120) || 'photo';

/** One photo, sent as the raw request body and streamed into storage; ?name= carries the phone's file name. Kept as sent. */
export async function onRequestPost(context: MemoContext) {
  const own = await ownMemo(context); if (isResponse(own)) return own;
  const type = (context.request.headers.get('Content-Type') ?? '').toLowerCase();
  if (!isPhotoType(type)) return json({ ok: false, error: 'a JPEG, PNG, HEIC or WebP photo is required' }, 415);
  if (own.manifest.photos.length >= MAX_PHOTOS) return json({ ok: false, error: `a memo holds at most ${MAX_PHOTOS} photos` }, 409);
  const length = declaredLength(context.request, MAX_PHOTO_BYTES, 'the photo is over 20 MB'); if (isResponse(length)) return length;
  const id = crypto.randomUUID();
  const key = `${memoPrefix(own.auth.userId, own.manifest.id)}photos/${id}`;
  await own.bucket.put(key, context.request.body as never, { httpMetadata: { contentType: type } });
  const photo = { id, name: cleanName(new URL(context.request.url).searchParams.get('name')), mimeType: type, byteSize: length, key, addedAt: new Date().toISOString() };
  const manifest = { ...own.manifest, photos: [...own.manifest.photos, photo] };
  if (!(await writeManifest(own.bucket, own.key, manifest, own.etag))) { await own.bucket.delete(key); return conflict(); }
  return json({ ok: true, memo: memoView(manifest) }, 201);
}

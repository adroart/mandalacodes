import { json, isResponse } from '../../oracle/reflections/_shared';
import { conflict, declaredLength, isAudioType, MAX_AUDIO_BYTES, memoPrefix, memoView, ownMemo, writeManifest, type MemoContext } from '../_shared';

/**
 * The memo's recording, sent as the raw request body and streamed straight into storage (copying 25 MB inside the
 * function would spend the free plan's CPU allowance). Sending again replaces it and clears the old transcript.
 */
export async function onRequestPost(context: MemoContext) {
  const own = await ownMemo(context, { upload: true }); if (isResponse(own)) return own;
  const type = context.request.headers.get('Content-Type') ?? '';
  if (!isAudioType(type)) return json({ ok: false, error: 'an audio file is required' }, 415);
  const length = declaredLength(context.request, MAX_AUDIO_BYTES, 'the recording is over 25 MB; send it in parts'); if (isResponse(length)) return length;
  const key = `${memoPrefix(own.auth.userId, own.manifest.id)}audio`;
  await own.bucket.put(key, context.request.body as never, { httpMetadata: { contentType: type } });
  const manifest = { ...own.manifest, audio: { key, mimeType: type, byteSize: length, addedAt: new Date().toISOString() }, transcript: { status: 'none' as const, startedAt: null, provider: null, error: null, key: null } };
  if (!(await writeManifest(own.bucket, own.key, manifest, own.etag))) return conflict();
  return json({ ok: true, memo: memoView(manifest) });
}

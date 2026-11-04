import { json } from '../../oracle/reflections/_shared';
import type { MemoContext } from '../_shared';
import { onRequestPost as postAudio } from './audio';
import { onRequestPost as postPhoto } from './photos';

// The phone Shortcut sends whatever was shared, one file at a time, with its name; the type comes from the name.
const TYPES: Record<string, string> = { m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac', mp3: 'audio/mpeg', wav: 'audio/wav', caf: 'audio/x-caf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', heif: 'image/heif', webp: 'image/webp' };

/** One shared file (?name=<file name>), sent raw: a recording becomes the memo's audio, a photo is added to it. */
export async function onRequestPost(context: MemoContext) {
  const name = new URL(context.request.url).searchParams.get('name') ?? '';
  const type = TYPES[name.split('.').pop()?.toLowerCase() ?? ''];
  if (!type) return json({ ok: false, error: 'send a recording (m4a, mp3, wav, aac) or a photo (jpg, png, heic, webp)' }, 415);
  const headers = new Headers(context.request.headers); headers.set('Content-Type', type);
  const request = new Request(context.request, { headers });
  return (type.startsWith('audio/') ? postAudio : postPhoto)({ ...context, request });
}

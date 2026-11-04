import { json, isResponse } from '../../../oracle/reflections/_shared';
import { ownMemo, type MemoContext } from '../../_shared';

/** One finished frame of the memo's posting kit, for the phone page to show and save. */
export async function onRequestGet(context: MemoContext) {
  const own = await ownMemo(context); if (isResponse(own)) return own;
  const n = Number(context.params.frame);
  const frame = own.manifest.kit?.frames[n - 1];
  const object = Number.isInteger(n) && frame?.key ? await own.bucket.get(frame.key) : null;
  if (!object) return json({ ok: false, error: 'frame not found' }, 404);
  return new Response(object.body as never, { headers: { 'Content-Type': 'image/png', 'Content-Length': String(object.size), 'Cache-Control': 'private, max-age=300', 'Content-Disposition': `inline; filename="${frame!.name}"` } });
}

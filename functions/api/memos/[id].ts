import { json, isResponse } from '../oracle/reflections/_shared';
import { memoView, ownMemo, type MemoContext } from './_shared';

/** One memo, with its timed transcript once there is one. */
export async function onRequestGet(context: MemoContext) {
  const own = await ownMemo(context); if (isResponse(own)) return own;
  const key = own.manifest.transcript.key;
  const transcript = key ? await (await own.bucket.get(key.replace(/\.json$/, '.md')))?.text() ?? null : null;
  return json({ ok: true, memo: memoView(own.manifest), transcript });
}

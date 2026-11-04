import { json, requireBinding, isResponse, validUuid } from '../../../reflections/_shared';
import { requirePickup, type PickupContext } from '../../_shared';
import { findManifestKey, memoView, PICKERS, readManifest, writeManifest } from '../../../../memos/_shared';

/** Marks a memo as collected by the VPS feeder or the Mac ({what:"handoff"} for the plan left for the Mac), so it is not listed for that picker again. */
export async function onRequestPost({ request, env, params }: PickupContext) {
  const refused = await requirePickup(request, env); if (refused) return refused;
  const bucket = requireBinding(env.ORACLE_PRIVATE, 'ORACLE_PRIVATE'); if (isResponse(bucket)) return bucket;
  if (!validUuid(params.id)) return json({ ok: false, error: 'invalid memo id' }, 400);
  let body: { by?: string; what?: string }; try { body = await request.json(); } catch { return json({ ok: false, error: 'json body required' }, 400); }
  if (!body.by || !PICKERS.has(body.by)) return json({ ok: false, error: 'by is vps or mac' }, 400);
  if (body.what !== undefined && body.what !== 'memo' && body.what !== 'handoff') return json({ ok: false, error: 'what is memo or handoff' }, 400);
  const mark = body.what === 'handoff' ? `${body.by}:handoff` : body.by;
  const key = await findManifestKey(bucket, params.id);
  const read = key ? await readManifest(bucket, key) : null;
  if (!key || !read) return json({ ok: false, error: 'memo not found' }, 404);
  if (mark === body.by && read.manifest.picked[mark]) return json({ ok: true, memo: memoView(read.manifest) });
  const manifest = { ...read.manifest, picked: { ...read.manifest.picked, [mark]: new Date().toISOString() } };
  if (!(await writeManifest(bucket, key, manifest, read.etag))) return json({ ok: false, error: 'the memo changed; read it again' }, 409);
  return json({ ok: true, memo: memoView(manifest) });
}

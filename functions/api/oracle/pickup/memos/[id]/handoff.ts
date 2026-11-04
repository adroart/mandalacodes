import { json, requireBinding, isResponse, validUuid } from '../../../reflections/_shared';
import { requirePickup, type PickupContext } from '../../_shared';
import { findManifestKey, memoPrefix, memoView, readManifest, writeManifest } from '../../../../memos/_shared';

const MAX_PLAN_BYTES = 2_000_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * The VPS feeder leaves a finished Instagram plan here for the Mac's AR Create to take in, one way (the laptop stays
 * the source of record; the VPS only feeds it). The site keeps the plan as sent and never reads inside it beyond its
 * id and revision; the Mac checks every line against the memo's own transcript before it adopts anything.
 */
export async function onRequestPost({ request, env, params }: PickupContext) {
  const refused = await requirePickup(request, env); if (refused) return refused;
  const bucket = requireBinding(env.ORACLE_PRIVATE, 'ORACLE_PRIVATE'); if (isResponse(bucket)) return bucket;
  if (!validUuid(params.id)) return json({ ok: false, error: 'invalid memo id' }, 400);
  const length = Number(request.headers.get('Content-Length'));
  if (!Number.isInteger(length) || length <= 0 || length > MAX_PLAN_BYTES) return json({ ok: false, error: 'send the plan as JSON, up to 2 MB' }, 413);
  const body = await request.text();
  // AR Create sends the plan with the hash of each Library file it names: {schema: handoff, plan, sources}.
  let bundle: { schema?: unknown; plan?: { id?: unknown; revision?: unknown; schema?: unknown }; sources?: unknown };
  try { bundle = JSON.parse(body); } catch { return json({ ok: false, error: 'the plan is not JSON' }, 400); }
  const plan = bundle.plan ?? {};
  if (bundle.schema !== 'ar-create.instagram-handoff.v1' || !Array.isArray(bundle.sources) || plan.schema !== 'ar-create.instagram-plan.v1' || typeof plan.id !== 'string' || !UUID.test(plan.id) || !Number.isSafeInteger(plan.revision)) return json({ ok: false, error: 'not an AR Create Instagram plan hand-off' }, 400);
  const key = await findManifestKey(bucket, params.id);
  const read = key ? await readManifest(bucket, key) : null;
  if (!key || !read) return json({ ok: false, error: 'memo not found' }, 404);
  const { manifest, etag } = read;
  if (manifest.transcript.status !== 'done') return json({ ok: false, error: 'the memo has no transcript yet' }, 409);
  const handoffKey = `${memoPrefix(manifest.ownerUserId, manifest.id)}handoff.json`;
  await bucket.put(handoffKey, body, { httpMetadata: { contentType: 'application/json' } });
  const next = { ...manifest, handoff: { key: handoffKey, planId: plan.id, revision: plan.revision as number, at: new Date().toISOString() } };
  if (!(await writeManifest(bucket, key, next, etag))) return json({ ok: false, error: 'the memo changed; read it again' }, 409);
  return json({ ok: true, memo: memoView(next) });
}

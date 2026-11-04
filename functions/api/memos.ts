import { admin, isAuthResponse, isResponse, json, requireBinding, validUuid } from './oracle/reflections/_shared';
import { cleanTitle, manifestKey, memoView, newManifest, readManifest, writeManifest, type MemoContext, type MemoManifest } from './memos/_shared';

const LIST_LIMIT = 30;

/** The admin's memos, newest first. */
export async function onRequestGet({ request, env }: MemoContext) {
  const auth = await admin(request, env); if (isAuthResponse(auth)) return auth;
  const bucket = requireBinding(env.ORACLE_PRIVATE, 'ORACLE_PRIVATE'); if (isResponse(bucket)) return bucket;
  const listed = await bucket.list({ prefix: `memos/${auth.userId}/`, delimiter: '/' });
  const manifests = (await Promise.all(listed.delimitedPrefixes.map(async (prefix) => (await bucket.get(`${prefix}manifest.json`))?.json<MemoManifest>() ?? null)))
    .filter((m): m is MemoManifest => m !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, LIST_LIMIT);
  return json({ ok: true, memos: manifests.map(memoView) });
}

/** Starts a memo. The phone picks the id, so a retried request finds the same memo instead of making a second. */
export async function onRequestPost({ request, env }: MemoContext) {
  const auth = await admin(request, env); if (isAuthResponse(auth)) return auth;
  const bucket = requireBinding(env.ORACLE_PRIVATE, 'ORACLE_PRIVATE'); if (isResponse(bucket)) return bucket;
  let body: Record<string, unknown>; try { body = await request.json(); } catch { return json({ ok: false, error: 'json body required' }, 400); }
  if (!validUuid(body.id)) return json({ ok: false, error: 'invalid memo id' }, 400);
  const key = manifestKey(auth.userId, body.id);
  const existing = await readManifest(bucket, key);
  if (existing) return json({ ok: true, memo: memoView(existing.manifest) });
  const manifest = newManifest(auth.userId, body.id, cleanTitle(body.title));
  if (!(await writeManifest(bucket, key, manifest, null))) {
    const raced = await readManifest(bucket, key);
    return raced ? json({ ok: true, memo: memoView(raced.manifest) }) : json({ ok: false, error: 'memo could not be saved' }, 500);
  }
  return json({ ok: true, memo: memoView(manifest) }, 201);
}

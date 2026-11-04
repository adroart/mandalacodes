import { admin, isAuthResponse, isResponse, json, requireBinding, validUuid } from './oracle/reflections/_shared';
import { cleanTitle, manifestKey, memoView, newManifest, readManifest, SHORTCUT_OWNER, uploader, writeManifest, type MemoContext, type MemoManifest } from './memos/_shared';

const LIST_LIMIT = 30;

/** The admin's memos, newest first. */
export async function onRequestGet({ request, env }: MemoContext) {
  const auth = await admin(request, env); if (isAuthResponse(auth)) return auth;
  const bucket = requireBinding(env.ORACLE_PRIVATE, 'ORACLE_PRIVATE'); if (isResponse(bucket)) return bucket;
  // The admin's own memos and the ones the phone Shortcut sent.
  const prefixes = (await Promise.all([auth.userId, SHORTCUT_OWNER].map(async (owner) => (await bucket.list({ prefix: `memos/${owner}/`, delimiter: '/' })).delimitedPrefixes))).flat();
  const manifests = (await Promise.all(prefixes.map(async (prefix) => (await bucket.get(`${prefix}manifest.json`))?.json<MemoManifest>() ?? null)))
    .filter((m): m is MemoManifest => m !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, LIST_LIMIT);
  return json({ ok: true, memos: manifests.map(memoView) });
}

/**
 * Starts a memo. The page picks the id, so a retried request finds the same memo instead of making a second; the
 * phone Shortcut (upload key) may leave the id out and gets one made for it.
 */
export async function onRequestPost({ request, env }: MemoContext) {
  const auth = await uploader(request, env); if (auth instanceof Response) return auth;
  const bucket = requireBinding(env.ORACLE_PRIVATE, 'ORACLE_PRIVATE'); if (isResponse(bucket)) return bucket;
  let body: Record<string, unknown>; try { body = await request.json(); } catch { return json({ ok: false, error: 'json body required' }, 400); }
  if (body.id === undefined && auth.viaShortcut) body.id = crypto.randomUUID();
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

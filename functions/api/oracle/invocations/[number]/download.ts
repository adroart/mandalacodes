import { authorized, json, numberParam, validId, type InvocationContext } from '../_shared';
export async function onRequestGet(context: InvocationContext) {
  const access = await authorized(context); if (access instanceof Response) return access; const number = numberParam(context.params.number); if (!number) return json({ error: 'invalid hexagram' }, 400); if (!context.env.ORACLE_PRIVATE) return json({ error: 'ORACLE_PRIVATE binding unavailable' }, 503);
  const versionId = new URL(context.request.url).searchParams.get('versionId'); if (!validId(versionId)) return json({ error: 'versionId is required' }, 400);
  const row = await access.db.prepare('SELECT artifact_key,title FROM oracle_invocation_versions WHERE id=?1 AND hexagram_number=?2').bind(versionId, number).first<{ artifact_key: string; title: string }>(); if (!row) return json({ error: 'version not found' }, 404);
  const object = await context.env.ORACLE_PRIVATE.get(row.artifact_key); if (!object) return json({ error: 'artifact not found' }, 404); const slug = row.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'invocation';
  return new Response(object.body, { headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="invocation-${String(number).padStart(2, '0')}-${slug}.md"`, 'Cache-Control': 'private, no-store' } });
}

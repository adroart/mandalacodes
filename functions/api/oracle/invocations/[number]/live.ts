import { json, numberParam, publicHeaders, type InvocationContext } from '../_shared';
export async function onRequestGet(context: InvocationContext) {
  const number = numberParam(context.params.number); if (!number) return json({ error: 'hexagram must be from 1 to 64' }, 400);
  if (!context.env.DB) return json({ error: 'DB binding unavailable' }, 503);
  const row = await context.env.DB.prepare('SELECT v.id,v.hexagram_number,v.version_number,v.title,v.rendered_json,v.created_at,l.updated_at FROM oracle_invocation_live l JOIN oracle_invocation_versions v ON v.id=l.version_id WHERE l.hexagram_number=?1').bind(number).first<Record<string, unknown>>();
  if (!row) return new Response(null, { status: 204, headers: publicHeaders });
  const etag = `"invocation-${number}-${row.version_number}"`; if (context.request.headers.get('If-None-Match') === etag) return new Response(null, { status: 304, headers: { ...publicHeaders, ETag: etag } });
  let blocks: unknown; try { blocks = JSON.parse(String(row.rendered_json)); } catch { return json({ error: 'live invocation unavailable' }, 503); }
  return json({ title: row.title, versionNumber: row.version_number, blocks }, 200, { ...publicHeaders, ETag: etag });
}

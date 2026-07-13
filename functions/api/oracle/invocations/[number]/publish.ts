import { authorized, bodyJson, buildInvocationArtifact, json, nextVersion, normalizeDraft, numberParam, parseInvocationMarkdown, serializeBlocks, validateLinkedSegments, type InvocationContext } from '../_shared';
export async function onRequestPost(context: InvocationContext) {
  const access = await authorized(context); if (access instanceof Response) return access;
  const number = numberParam(context.params.number); if (!number) return json({ error: 'hexagram must be from 1 to 64' }, 400);
  if (!context.env.ORACLE_PRIVATE) return json({ error: 'ORACLE_PRIVATE binding unavailable' }, 503);
  const key = context.request.headers.get('Idempotency-Key'); if (!key || key.length > 128) return json({ error: 'Idempotency-Key is required' }, 400);
  const duplicate = await access.db.prepare('SELECT * FROM oracle_invocation_versions WHERE hexagram_number=?1 AND author_user_id=?2 AND idempotency_key=?3').bind(number, access.auth.userId, key).first<Record<string, unknown>>();
  if (duplicate) return json({ status: 'saved_and_live', version: versionFromRow(duplicate), liveUpdatedAt: duplicate.created_at });
  const raw = await bodyJson(context.request); if (raw instanceof Response) return raw;
  let draft; try { draft = normalizeDraft(raw, number); } catch (error) { return json({ error: (error as Error).message }, 400); }
  const owner = await access.db.prepare('SELECT id FROM oracle_reflection_sessions WHERE id=?1 AND owner_user_id=?2 AND hexagram_number=?3').bind(draft.sessionId, access.auth.userId, number).first(); if (!owner) return json({ error: 'session not found' }, 404);
  const ownedDraft = await access.db.prepare('SELECT id FROM oracle_invocation_drafts WHERE id=?1 AND admin_user_id=?2 AND session_id=?3 AND hexagram_number=?4').bind(draft.id, access.auth.userId, draft.sessionId, number).first();
  if (!ownedDraft) return json({ error: 'draft not found' }, 404);
  if (!await validateLinkedSegments(access.db, draft.blocks, draft.sessionId, access.auth.userId)) return json({ error: 'linked segment not found in session' }, 400);
  const body = serializeBlocks(draft.blocks); const parsed = parseInvocationMarkdown(body); const version = await nextVersion(access.db, number); const now = new Date().toISOString(); const id = crypto.randomUUID();
  const artifact = buildInvocationArtifact({ hexagramNumber: number, title: draft.title, versionNumber: version, artifactId: id, author: access.auth.userId, createdAt: now, updatedAt: now, body });
  try { await context.env.ORACLE_PRIVATE.put(artifact.key, artifact.contents, { httpMetadata: { contentType: 'text/markdown; charset=utf-8' } }); } catch { return json({ error: 'invocation artifact unavailable' }, 503); }
  try {
    await access.db.batch([
      ...draft.blocks.filter((block) => block.segmentId).map((block) => access.db.prepare('UPDATE oracle_reflection_segments SET transcript=?4,updated_at=?5 WHERE id=?1 AND session_id=?2 AND owner_user_id=?3').bind(block.segmentId, draft.sessionId, access.auth.userId, block.markdown, now)),
      access.db.prepare('DELETE FROM oracle_invocation_blocks WHERE draft_id=?1').bind(draft.id),
      ...draft.blocks.map((block) => access.db.prepare('INSERT INTO oracle_invocation_blocks (id,draft_id,kind,segment_id,markdown,sort_order,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?7)').bind(block.id, draft.id, block.kind, block.segmentId, block.markdown, block.sortOrder, now)),
      access.db.prepare('UPDATE oracle_invocation_drafts SET title=?3,markdown_body=?4,updated_at=?5 WHERE id=?1 AND admin_user_id=?2').bind(draft.id, access.auth.userId, draft.title, body, now),
      access.db.prepare('INSERT INTO oracle_invocation_versions (id,hexagram_number,draft_id,version_number,title,markdown_body,rendered_json,artifact_key,author_user_id,idempotency_key,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)').bind(id, number, draft.id, version, draft.title, body, JSON.stringify(parsed.blocks), artifact.key, access.auth.userId, key, now),
      access.db.prepare('INSERT INTO oracle_invocation_live (hexagram_number,version_id,updated_at) VALUES (?1,?2,?3) ON CONFLICT(hexagram_number) DO UPDATE SET version_id=excluded.version_id,updated_at=excluded.updated_at').bind(number, id, now),
    ]);
  } catch { await context.env.ORACLE_PRIVATE.delete(artifact.key).catch(() => undefined); return json({ error: 'invocation publish failed' }, 503); }
  return json({ status: 'saved_and_live', version: { id, hexagramNumber: number, versionNumber: version, title: draft.title, markdownBody: body, artifactKey: artifact.key, authorUserId: access.auth.userId, createdAt: now }, liveUpdatedAt: now });
}

function versionFromRow(row: Record<string, unknown>) {
  return { id: row.id, hexagramNumber: row.hexagram_number, versionNumber: row.version_number, title: row.title, markdownBody: row.markdown_body, artifactKey: row.artifact_key, authorUserId: row.author_user_id, createdAt: row.created_at };
}

import { blocksFromSegments } from '../../../../../lib/oracle/invocationSync';
import { authorized, bodyJson, draftFromRows, json, normalizeDraft, numberParam, validateLinkedSegments, validId, type InvocationContext } from '../_shared';

async function loadDraft(db: NonNullable<InvocationContext['env']['DB']>, number: number, userId: string) {
  const draft = await db.prepare('SELECT * FROM oracle_invocation_drafts WHERE hexagram_number=?1 AND admin_user_id=?2').bind(number, userId).first<Record<string, unknown>>();
  if (!draft) return null;
  const blocks = (await db.prepare('SELECT * FROM oracle_invocation_blocks WHERE draft_id=?1 ORDER BY sort_order ASC').bind(draft.id).all<Record<string, unknown>>()).results;
  const recorderRows = (await db.prepare('SELECT id,transcript FROM oracle_reflection_segments WHERE session_id=?1 AND owner_user_id=?2').bind(draft.session_id, userId).all<Record<string, unknown>>()).results;
  const transcripts = new Map(recorderRows.map((row) => [String(row.id), String(row.transcript ?? '')]));
  return draftFromRows(draft, blocks.map((block) => block.segment_id && transcripts.has(String(block.segment_id)) ? { ...block, markdown: transcripts.get(String(block.segment_id)) } : block));
}

export async function onRequestGet(context: InvocationContext) {
  const access = await authorized(context); if (access instanceof Response) return access;
  const number = numberParam(context.params.number); if (!number) return json({ error: 'hexagram must be from 1 to 64' }, 400);
  const existing = await loadDraft(access.db, number, access.auth.userId); if (existing) return json(existing);
  const sessionId = new URL(context.request.url).searchParams.get('sessionId'); if (!validId(sessionId)) return json({ error: 'sessionId is required' }, 400);
  const session = await access.db.prepare('SELECT id FROM oracle_reflection_sessions WHERE id=?1 AND hexagram_number=?2 AND owner_user_id=?3').bind(sessionId, number, access.auth.userId).first();
  if (!session) return json({ error: 'session not found' }, 404);
  const segments = (await access.db.prepare('SELECT id,transcript,sequence AS sortOrder,created_at AS createdAt FROM oracle_reflection_segments WHERE session_id=?1 AND owner_user_id=?2 ORDER BY sequence ASC').bind(sessionId, access.auth.userId).all<Record<string, unknown>>()).results;
  const now = new Date().toISOString(); const id = crypto.randomUUID(); const blocks = blocksFromSegments(segments.map((row) => ({ id: String(row.id), transcript: String(row.transcript ?? ''), sortOrder: Number(row.sortOrder), createdAt: String(row.createdAt) })));
  const statements = [access.db.prepare('INSERT INTO oracle_invocation_drafts (id,hexagram_number,session_id,admin_user_id,title,markdown_body,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,\'\',?6,?6)').bind(id, number, sessionId, access.auth.userId, `Invocation ${number}`, now), ...blocks.map((block) => access.db.prepare('INSERT INTO oracle_invocation_blocks (id,draft_id,kind,segment_id,markdown,sort_order,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?7)').bind(block.id, id, block.kind, block.segmentId, block.markdown, block.sortOrder, now))];
  await access.db.batch(statements); return json({ id, hexagramNumber: number, sessionId, title: `Invocation ${number}`, blocks, updatedAt: now }, 201);
}

export async function onRequestPut(context: InvocationContext) {
  const access = await authorized(context); if (access instanceof Response) return access;
  const number = numberParam(context.params.number); if (!number) return json({ error: 'hexagram must be from 1 to 64' }, 400);
  const raw = await bodyJson(context.request); if (raw instanceof Response) return raw;
  let draft; try { draft = normalizeDraft(raw, number); } catch (error) { return json({ error: (error as Error).message }, 400); }
  const current = await loadDraft(access.db, number, access.auth.userId); if (!current || current.id !== draft.id) return json({ error: 'draft not found' }, 404);
  if (current.updatedAt !== draft.updatedAt) return json({ error: 'draft_changed', draft: current }, 409);
  const session = await access.db.prepare('SELECT id FROM oracle_reflection_sessions WHERE id=?1 AND owner_user_id=?2 AND hexagram_number=?3').bind(draft.sessionId, access.auth.userId, number).first(); if (!session) return json({ error: 'session not found' }, 404);
  if (!await validateLinkedSegments(access.db, draft.blocks, draft.sessionId, access.auth.userId)) return json({ error: 'linked segment not found in session' }, 400);
  const now = new Date().toISOString(); const linked = draft.blocks.filter((block) => block.segmentId);
  const statements = [
    ...linked.map((block) => access.db.prepare('UPDATE oracle_reflection_segments SET transcript=?3,updated_at=?4 WHERE id=?1 AND owner_user_id=?2 AND session_id=?5').bind(block.segmentId, access.auth.userId, block.markdown, now, draft.sessionId)),
    access.db.prepare('DELETE FROM oracle_invocation_blocks WHERE draft_id=?1').bind(draft.id),
    ...draft.blocks.map((block) => access.db.prepare('INSERT INTO oracle_invocation_blocks (id,draft_id,kind,segment_id,markdown,sort_order,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?7)').bind(block.id, draft.id, block.kind, block.segmentId, block.markdown, block.sortOrder, now)),
    access.db.prepare('UPDATE oracle_invocation_drafts SET session_id=?3,title=?4,markdown_body=?5,updated_at=?6 WHERE id=?1 AND admin_user_id=?2').bind(draft.id, access.auth.userId, draft.sessionId, draft.title, draft.blocks.map((block) => block.markdown).join('\n\n'), now),
  ];
  await access.db.batch(statements); return json({ ...draft, updatedAt: now });
}

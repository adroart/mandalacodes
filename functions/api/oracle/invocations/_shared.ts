import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { isAuthResponse, requireAdmin, type AuthContext } from '../../_lib/auth.ts';
import { buildInvocationArtifact, parseInvocationMarkdown, serializeBlocks } from '../../../../lib/oracle/invocationMarkdown';
import type { InvocationBlock, InvocationDraft } from '../../../../lib/oracle/invocationTypes';

export interface InvocationEnv { DB?: D1Database; ORACLE_PRIVATE?: R2Bucket; ADMIN_EMAILS?: string; BETTER_AUTH_SECRET?: string; BETTER_AUTH_URL?: string }
export interface InvocationContext { request: Request; env: InvocationEnv; params: Record<string, string> }
export const json = (body: unknown, status = 200, headers?: HeadersInit) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });
export const publicHeaders = { 'Cache-Control': 'public, max-age=0, must-revalidate' };
export async function authorized(context: InvocationContext): Promise<{ auth: AuthContext; db: D1Database } | Response> {
  const auth = await requireAdmin(context.request, context.env); if (isAuthResponse(auth)) return auth;
  if (!context.env.DB) return json({ error: 'DB binding unavailable' }, 503);
  return { auth, db: context.env.DB };
}
export const numberParam = (value: string) => { const number = Number(value); return Number.isInteger(number) && number >= 1 && number <= 64 ? number : null; };
export const validId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 128;
export async function bodyJson(request: Request): Promise<Record<string, unknown> | Response> {
  if (!(request.headers.get('content-type') || '').toLowerCase().includes('application/json')) return json({ error: 'application/json required' }, 415);
  const length = Number(request.headers.get('content-length') || 0); if (length > 500_000) return json({ error: 'request body too large' }, 413);
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > 500_000) return json({ error: 'request body too large' }, 413);
    return JSON.parse(text) as Record<string, unknown>;
  } catch { return json({ error: 'invalid JSON' }, 400); }
}
export function normalizeDraft(body: Record<string, unknown>, number: number): InvocationDraft {
  if (!validId(body.id) || !validId(body.sessionId) || typeof body.title !== 'string' || !Array.isArray(body.blocks) || typeof body.updatedAt !== 'string') throw new Error('invalid draft');
  const title = body.title.trim(); if (!title || title.length > 200) throw new Error('title is required');
  const blocks = body.blocks as InvocationBlock[]; const ids = new Set<string>(); const segments = new Set<string>();
  blocks.forEach((block, index) => {
    if (!validId(block.id) || ids.has(block.id) || block.sortOrder !== index || !['segment', 'prose'].includes(block.kind) || typeof block.markdown !== 'string') throw new Error('invalid invocation blocks');
    ids.add(block.id); if (block.kind === 'segment') { if (!validId(block.segmentId) || segments.has(block.segmentId)) throw new Error('invalid linked segment'); segments.add(block.segmentId); }
    else if (block.segmentId !== null) throw new Error('prose cannot link a segment');
  });
  parseInvocationMarkdown(serializeBlocks(blocks));
  return { id: body.id, hexagramNumber: number, sessionId: body.sessionId, title, blocks, updatedAt: body.updatedAt };
}
export const draftFromRows = (draft: Record<string, unknown>, blocks: Record<string, unknown>[]): InvocationDraft => ({
  id: String(draft.id), hexagramNumber: Number(draft.hexagram_number), sessionId: String(draft.session_id), title: String(draft.title), updatedAt: String(draft.updated_at),
  blocks: blocks.map((row) => ({ id: String(row.id), kind: row.kind as 'segment' | 'prose', segmentId: row.segment_id ? String(row.segment_id) : null, markdown: String(row.markdown), sortOrder: Number(row.sort_order) })),
});
export async function validateLinkedSegments(db: D1Database, blocks: InvocationBlock[], sessionId: string, ownerId: string): Promise<boolean> {
  const linked = blocks.filter((block) => block.kind === 'segment');
  for (const block of linked) {
    const row = await db.prepare('SELECT id FROM oracle_reflection_segments WHERE id=?1 AND session_id=?2 AND owner_user_id=?3').bind(block.segmentId, sessionId, ownerId).first();
    if (!row) return false;
  }
  return true;
}
export async function nextVersion(db: D1Database, number: number) { const row = await db.prepare('SELECT COALESCE(MAX(version_number),0)+1 AS version FROM oracle_invocation_versions WHERE hexagram_number=?1').bind(number).first<{ version: number }>(); return row?.version ?? 1; }
export { buildInvocationArtifact, parseInvocationMarkdown, serializeBlocks };

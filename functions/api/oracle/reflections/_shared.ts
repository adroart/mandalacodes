import type { Ai, D1Database, R2Bucket } from '@cloudflare/workers-types';
import { isAuthResponse, requireAdmin, type AuthContext } from '../../_lib/auth.ts';
import { normalizeTranscript } from '../../../../utils/oracleReflection';

export interface ReflectionEnv { DB?: D1Database; ORACLE_PRIVATE?: R2Bucket; AI?: Ai; ADMIN_EMAILS?: string; BETTER_AUTH_SECRET?: string; BETTER_AUTH_URL?: string }
export interface ReflectionContext { request: Request; env: ReflectionEnv; params: Record<string, string>; waitUntil(promise: Promise<unknown>): void }
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export const admin = (request: Request, env: ReflectionEnv): Promise<AuthContext | Response> => requireAdmin(request, env);
export { isAuthResponse };
export function requireBinding<T>(value: T | undefined, name: string): T | Response { return value ?? json({ ok: false, error: `${name} binding unavailable` }, 503); }
export const isResponse = <T>(value: T | Response): value is Response => value instanceof Response;
export const validUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const sessionFromRow = (row: Record<string, unknown>) => ({ id: row.id, hexagramNumber: row.hexagram_number, createdAt: row.created_at, updatedAt: row.updated_at, finishedAt: row.finished_at ?? null });
export const segmentFromRow = (row: Record<string, unknown>) => ({ id: row.id, sessionId: row.session_id, sequence: row.sequence, recordedAt: row.recorded_at, durationMs: row.duration_ms, mimeType: row.mime_type, byteSize: row.byte_size, transcript: row.transcript ?? '', transcriptionStatus: row.transcription_status, transcriptionError: row.transcription_error ?? null, transcriptionStartedAt: row.transcription_started_at ?? null, updatedAt: row.updated_at });

const TRANSCRIPTION_LEASE_MS = 5 * 60 * 1000;
export function canClaimTranscription(status: unknown, startedAt: unknown, nowMs = Date.now()) {
  if (status === 'transcription_pending' || status === 'failed') return true;
  if (status !== 'transcribing') return false;
  const started = typeof startedAt === 'string' ? Date.parse(startedAt) : NaN;
  return !Number.isFinite(started) || started <= nowMs - TRANSCRIPTION_LEASE_MS;
}

function bytesToBase64(bytes: Uint8Array) {
  const chunkSize = 32 * 1024;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, bytes.length);
    let chunk = '';
    for (let index = offset; index < end; index += 1) chunk += String.fromCharCode(bytes[index]);
    binary += chunk;
  }
  return btoa(binary);
}

export async function transcribeCommittedAudio(ai: Ai, bytes: ArrayBuffer): Promise<{ text: string; metadataJson: string }> {
  const run = ai.run as unknown as (model: string, input: { audio: string | number[] }) => Promise<unknown>;
  const audio = new Uint8Array(bytes);
  let raw: unknown;
  try {
    raw = await run('@cf/openai/whisper-large-v3-turbo', { audio: bytesToBase64(audio) });
  } catch {
    raw = await run('@cf/openai/whisper', { audio: Array.from(audio) });
  }
  const normalized = normalizeTranscript(raw);
  const row = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  return { text: normalized.text, metadataJson: JSON.stringify({ wordCount: normalized.text.split(/\s+/).filter(Boolean).length, duration: typeof row.duration === 'number' ? row.duration : null }) };
}

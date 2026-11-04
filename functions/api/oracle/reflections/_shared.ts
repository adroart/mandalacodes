import type { Ai, D1Database, R2Bucket } from '@cloudflare/workers-types';
import { isAuthResponse, requireAdmin, type AuthContext } from '../../_lib/auth.ts';
import { betterView, parseMeta } from '../../../../utils/oracleBetterTranscript';
import { buildWordsPrompt } from '../../../../shared/words';
import { quickTranscribe } from '../../_lib/quickTranscription';
import { ORACLE_WORDS_PROFILE } from '../../../../shared/oracleWords';

export interface ReflectionEnv { DB?: D1Database; ORACLE_PRIVATE?: R2Bucket; AI?: Ai; GROQ_API_KEY?: string; ADMIN_EMAILS?: string; BETTER_AUTH_SECRET?: string; BETTER_AUTH_URL?: string }
export interface ReflectionContext { request: Request; env: ReflectionEnv; params: Record<string, string>; waitUntil(promise: Promise<unknown>): void }
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export const admin = (request: Request, env: ReflectionEnv): Promise<AuthContext | Response> => requireAdmin(request, env);
export { isAuthResponse };
export function requireBinding<T>(value: T | undefined, name: string): T | Response { return value ?? json({ ok: false, error: `${name} binding unavailable` }, 503); }
export const isResponse = <T>(value: T | Response): value is Response => value instanceof Response;
export const validUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const sessionFromRow = (row: Record<string, unknown>) => ({ id: row.id, hexagramNumber: row.hexagram_number, createdAt: row.created_at, updatedAt: row.updated_at, finishedAt: row.finished_at ?? null });
export const segmentFromRow = (row: Record<string, unknown>) => {
  // A better transcript from the Mac, and the first draft it sits beside, appear only once the Mac has sent one.
  const better = row.provider_metadata_json ? betterView(parseMeta(row.provider_metadata_json)) : null;
  return { id: row.id, sessionId: row.session_id, sequence: row.sequence, recordedAt: row.recorded_at, durationMs: row.duration_ms, mimeType: row.mime_type, byteSize: row.byte_size, transcript: row.transcript ?? '', transcriptionStatus: row.transcription_status, transcriptionError: row.transcription_error ?? null, transcriptionStartedAt: row.transcription_started_at ?? null, updatedAt: row.updated_at, ...(better ? { betterTranscript: better } : {}) };
};

const TRANSCRIPTION_LEASE_MS = 5 * 60 * 1000;
export function canClaimTranscription(status: unknown, startedAt: unknown, nowMs = Date.now()) {
  if (status === 'transcription_pending' || status === 'failed') return true;
  if (status !== 'transcribing') return false;
  const started = typeof startedAt === 'string' ? Date.parse(startedAt) : NaN;
  return !Number.isFinite(started) || started <= nowMs - TRANSCRIPTION_LEASE_MS;
}

/** The speech model's vocabulary prompt: the oracle's own sentence, then the shared library's words for this project. */
export function oracleTranscriptionPrompt() { return buildWordsPrompt(undefined, ORACLE_WORDS_PROFILE).prompt; }

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

/** The oracle's first transcript of a reflection, through the site's one quick-transcription service. */
export async function transcribeCommittedAudio(
  env: Pick<ReflectionEnv, 'GROQ_API_KEY' | 'AI'>,
  bytes: ArrayBuffer,
  mimeType: string,
  fetcher: Fetcher = (input, init) => globalThis.fetch(input, init),
): Promise<{ text: string; metadataJson: string }> {
  const result = await quickTranscribe(env, bytes, mimeType, {
    prompt: oracleTranscriptionPrompt(),
    fileName: mimeType.includes('mp4') ? 'reflection.m4a' : 'reflection.webm',
    logTag: '[oracle-reflection-transcription]',
    fetcher,
  });
  // Known mishearings are fixed in the text the person sees; what the speech model returned is kept in the metadata.
  return {
    text: result.text,
    metadataJson: JSON.stringify({
      provider: result.provider,
      wordCount: result.text.split(/\s+/).filter(Boolean).length,
      duration: result.duration,
      ...(result.wordFixes.length ? { rawTranscript: result.rawText, wordFixes: result.wordFixes } : {}),
    }),
  };
}

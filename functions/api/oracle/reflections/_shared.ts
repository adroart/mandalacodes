import type { Ai, D1Database, R2Bucket } from '@cloudflare/workers-types';
import { isAuthResponse, requireAdmin, type AuthContext } from '../../_lib/auth.ts';
import { normalizeTranscript } from '../../../../utils/oracleReflection';
import { betterView, parseMeta } from '../../../../utils/oracleBetterTranscript';
import { applyKnownFixes, buildWordsPrompt } from '../../../../shared/words';
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

type TranscriptionProvider = 'groq' | 'cloudflare';
type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
const LEGACY_CLOUDFLARE_FALLBACK_MAX_BYTES = 4 * 1024 * 1024;

function logTranscriptionFailure(details: {
  provider: TranscriptionProvider;
  model: string;
  status?: number;
  requestId?: string | null;
  errorName?: string;
  errorMessage?: string;
}) {
  const safeMessage = details.errorMessage
    ?.replace(/https?:\/\/\S+/gi, '[url]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/gsk_[A-Za-z0-9_-]+/g, '[redacted]')
    .slice(0, 160);
  console.error('[oracle-reflection-transcription]', {
    provider: details.provider,
    model: details.model,
    ...(details.status === undefined ? {} : { status: details.status }),
    ...(details.requestId ? { requestId: details.requestId.slice(0, 128) } : {}),
    ...(details.errorName ? { errorName: details.errorName.slice(0, 64) } : {}),
    ...(safeMessage ? { errorMessage: safeMessage } : {}),
  });
}

function transcriptionResult(raw: unknown, provider: TranscriptionProvider) {
  const normalized = normalizeTranscript(raw);
  const row = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  // Known mishearings from the shared word library are fixed in the text the person sees; what the speech model
  // actually returned is kept beside it in the segment's provider metadata.
  const fixed = applyKnownFixes(normalized.text);
  return {
    text: fixed.text,
    metadataJson: JSON.stringify({
      provider,
      wordCount: fixed.text.split(/\s+/).filter(Boolean).length,
      duration: typeof row.duration === 'number' ? row.duration : null,
      ...(fixed.fixes.length ? { rawTranscript: normalized.text, wordFixes: fixed.fixes } : {}),
    }),
  };
}

async function transcribeWithCloudflare(ai: Ai, bytes: ArrayBuffer) {
  const run = ai.run.bind(ai) as unknown as (model: string, input: { audio: string | number[]; initial_prompt?: string }) => Promise<unknown>;
  const audio = new Uint8Array(bytes);
  let raw: unknown;
  try {
    raw = await run('@cf/openai/whisper-large-v3-turbo', { audio: bytesToBase64(audio), initial_prompt: oracleTranscriptionPrompt() });
  } catch (error) {
    logTranscriptionFailure({ provider: 'cloudflare', model: '@cf/openai/whisper-large-v3-turbo', errorName: error instanceof Error ? error.name : 'UnknownError', errorMessage: error instanceof Error ? error.message : undefined });
    if (audio.byteLength > LEGACY_CLOUDFLARE_FALLBACK_MAX_BYTES) throw error;
    try {
      raw = await run('@cf/openai/whisper', { audio: Array.from(audio) });
    } catch (legacyError) {
      logTranscriptionFailure({ provider: 'cloudflare', model: '@cf/openai/whisper', errorName: legacyError instanceof Error ? legacyError.name : 'UnknownError', errorMessage: legacyError instanceof Error ? legacyError.message : undefined });
      throw legacyError;
    }
  }
  return transcriptionResult(raw, 'cloudflare');
}

export async function transcribeCommittedAudio(
  env: Pick<ReflectionEnv, 'GROQ_API_KEY' | 'AI'>,
  bytes: ArrayBuffer,
  mimeType: string,
  fetcher: Fetcher = (input, init) => globalThis.fetch(input, init),
): Promise<{ text: string; metadataJson: string }> {
  let groqFailure: Error | null = null;
  const groqApiKey = env.GROQ_API_KEY?.trim();
  if (groqApiKey) {
    const form = new FormData();
    form.set('model', 'whisper-large-v3-turbo');
    form.set('response_format', 'json');
    form.set('prompt', oracleTranscriptionPrompt());
    form.set('file', new File([bytes], mimeType.includes('mp4') ? 'reflection.m4a' : 'reflection.webm', { type: mimeType }));
    try {
      const response = await fetcher('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${groqApiKey}` },
        body: form,
      });
      if (!response.ok) {
        logTranscriptionFailure({ provider: 'groq', model: 'whisper-large-v3-turbo', status: response.status, requestId: response.headers.get('x-request-id') });
        throw new Error(`Groq HTTP ${response.status}`);
      }
      return transcriptionResult(await response.json(), 'groq');
    } catch (error) {
      groqFailure = error instanceof Error ? error : new Error('Groq request failed');
      if (!/^Groq HTTP \d+$/.test(groqFailure.message)) {
        logTranscriptionFailure({ provider: 'groq', model: 'whisper-large-v3-turbo', errorName: groqFailure.name, errorMessage: groqFailure.message });
      }
    }
  }
  if (env.AI) {
    try {
      return await transcribeWithCloudflare(env.AI, bytes);
    } catch {
      throw new Error(groqFailure ? 'Groq and Cloudflare transcription failed' : 'Cloudflare transcription failed');
    }
  }
  throw groqFailure ?? new Error('No transcription provider configured');
}

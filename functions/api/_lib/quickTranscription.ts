import type { Ai } from '@cloudflare/workers-types';
import { normalizeTranscript } from '../../../utils/oracleReflection';
import { applyKnownFixes } from '../../../shared/words';

/**
 * Quick transcription: one place every recording on this site goes for its first transcript.
 * Groq first, then Workers AI, then the legacy Workers AI model for short clips. Known mishearings from the shared
 * word library are fixed in the text; what the speech model returned is kept beside it.
 * The Mac's deep transcription (AR Create) may later bring back a better one; this is the draft.
 */
export interface QuickTranscriptionEnv { GROQ_API_KEY?: string; AI?: Ai }
export type QuickProvider = 'groq' | 'cloudflare';
export interface QuickWord { word: string; start: number; end: number }
export interface QuickSegment { start: number; end: number; text: string; words?: QuickWord[] }
export interface QuickTranscript {
  provider: QuickProvider;
  model: string;
  text: string;
  rawText: string;
  wordFixes: { from: string; to: string; count: number }[];
  duration: number | null;
  /** Only when timings were asked for and the provider returned them. */
  segments?: QuickSegment[];
}
type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
export interface QuickOptions {
  /** The vocabulary prompt: the project's own sentence, then the shared library's words. */
  prompt: string;
  /** Ask for sentence and word timestamps (larger response; needed to place moments in a long recording). */
  timings?: boolean;
  /** The name the file is sent under; the provider reads the container from it. */
  fileName?: string;
  /** Prefix for failure logs, so each caller's failures stay findable. */
  logTag?: string;
  /** Another Groq Whisper model, for a second opinion (e.g. 'whisper-large-v3'); default whisper-large-v3-turbo. */
  groqModel?: string;
  fetcher?: Fetcher;
}

const GROQ_MODEL = 'whisper-large-v3-turbo';
const CLOUDFLARE_MODEL = '@cf/openai/whisper-large-v3-turbo';
const LEGACY_CLOUDFLARE_MODEL = '@cf/openai/whisper';
const LEGACY_CLOUDFLARE_FALLBACK_MAX_BYTES = 4 * 1024 * 1024;

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

function logFailure(tag: string, details: { provider: QuickProvider; model: string; status?: number; requestId?: string | null; errorName?: string; errorMessage?: string }) {
  const safeMessage = details.errorMessage
    ?.replace(/https?:\/\/\S+/gi, '[url]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/gsk_[A-Za-z0-9_-]+/g, '[redacted]')
    .slice(0, 160);
  console.error(tag, {
    provider: details.provider,
    model: details.model,
    ...(details.status === undefined ? {} : { status: details.status }),
    ...(details.requestId ? { requestId: details.requestId.slice(0, 128) } : {}),
    ...(details.errorName ? { errorName: details.errorName.slice(0, 64) } : {}),
    ...(safeMessage ? { errorMessage: safeMessage } : {}),
  });
}

const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value);

/** Groq (verbose_json) and Workers AI both return OpenAI-shaped segments; keep only well-formed ones. */
function readSegments(raw: Record<string, unknown>): QuickSegment[] | undefined {
  if (!Array.isArray(raw.segments)) return undefined;
  const flatWords = Array.isArray(raw.words) ? raw.words as Record<string, unknown>[] : [];
  return (raw.segments as Record<string, unknown>[]).flatMap((segment) => {
    if (!finite(segment.start) || !finite(segment.end) || typeof segment.text !== 'string') return [];
    const start = segment.start as number; const end = segment.end as number;
    const own = Array.isArray(segment.words) ? segment.words as Record<string, unknown>[] : flatWords.filter((word) => finite(word.start) && (word.start as number) >= start && (word.start as number) < end);
    const words = own.flatMap((word) => typeof word.word === 'string' && finite(word.start) && finite(word.end) ? [{ word: word.word, start: word.start as number, end: word.end as number }] : []);
    return [{ start, end, text: applyKnownFixes(segment.text.trim()).text, ...(words.length ? { words } : {}) }];
  });
}

function result(raw: unknown, provider: QuickProvider, model: string, timings: boolean): QuickTranscript {
  const normalized = normalizeTranscript(raw);
  const row = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const fixed = applyKnownFixes(normalized.text);
  const segments = timings ? readSegments(row) : undefined;
  return {
    provider, model, text: fixed.text, rawText: normalized.text, wordFixes: fixed.fixes,
    duration: finite(row.duration) ? row.duration as number : null,
    ...(segments?.length ? { segments } : {}),
  };
}

/** Workers AI, then its legacy model for short clips. `read` turns a reply into the caller's shape; a reply it rejects counts as a failure. */
async function runWorkersAi<T>(ai: Ai, bytes: ArrayBuffer | Uint8Array, options: { prompt: string; logTag: string }, read: (raw: unknown, model: string) => T): Promise<T> {
  const run = ai.run.bind(ai) as unknown as (model: string, input: { audio: string | number[]; initial_prompt?: string }) => Promise<unknown>;
  const audio = new Uint8Array(bytes);
  try {
    return read(await run(CLOUDFLARE_MODEL, { audio: bytesToBase64(audio), initial_prompt: options.prompt }), CLOUDFLARE_MODEL);
  } catch (error) {
    logFailure(options.logTag, { provider: 'cloudflare', model: CLOUDFLARE_MODEL, errorName: error instanceof Error ? error.name : 'UnknownError', errorMessage: error instanceof Error ? error.message : undefined });
    if (audio.byteLength > LEGACY_CLOUDFLARE_FALLBACK_MAX_BYTES) throw error;
  }
  try {
    return read(await run(LEGACY_CLOUDFLARE_MODEL, { audio: Array.from(audio) }), LEGACY_CLOUDFLARE_MODEL);
  } catch (legacyError) {
    logFailure(options.logTag, { provider: 'cloudflare', model: LEGACY_CLOUDFLARE_MODEL, errorName: legacyError instanceof Error ? legacyError.name : 'UnknownError', errorMessage: legacyError instanceof Error ? legacyError.message : undefined });
    throw legacyError;
  }
}

function viaCloudflare(ai: Ai, bytes: ArrayBuffer, options: Required<Pick<QuickOptions, 'prompt' | 'logTag'>> & { timings: boolean }) {
  return runWorkersAi(ai, bytes, options, (raw, model) => result(raw, 'cloudflare', model, options.timings));
}

/**
 * The same Workers AI fallback for a caller that runs its own Groq request and reads the reply itself (hosted
 * authoring keeps its own error contract and word timings). Returns the provider's reply untouched with the model
 * that gave it; a reply without text is a failure, as it is for quickTranscribe.
 */
export function workersAiTranscription(ai: Ai, bytes: ArrayBuffer | Uint8Array, options: { prompt: string; logTag?: string }): Promise<{ model: string; raw: unknown }> {
  return runWorkersAi(ai, bytes, { prompt: options.prompt, logTag: options.logTag ?? '[quick-transcription]' }, (raw, model) => { normalizeTranscript(raw); return { model, raw }; });
}

export async function quickTranscribe(env: QuickTranscriptionEnv, bytes: ArrayBuffer, mimeType: string, options: QuickOptions): Promise<QuickTranscript> {
  const timings = options.timings === true;
  const logTag = options.logTag ?? '[quick-transcription]';
  const fetcher: Fetcher = options.fetcher ?? ((input, init) => globalThis.fetch(input, init));
  const groqModel = options.groqModel ?? GROQ_MODEL;
  let groqFailure: Error | null = null;
  const groqApiKey = env.GROQ_API_KEY?.trim();
  if (groqApiKey) {
    const form = new FormData();
    form.set('model', groqModel);
    form.set('response_format', timings ? 'verbose_json' : 'json');
    if (timings) { form.append('timestamp_granularities[]', 'segment'); form.append('timestamp_granularities[]', 'word'); }
    form.set('prompt', options.prompt);
    form.set('file', new File([bytes], options.fileName ?? (mimeType.includes('mp4') ? 'audio.m4a' : 'audio.webm'), { type: mimeType }));
    try {
      const response = await fetcher('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${groqApiKey}` }, body: form });
      if (!response.ok) {
        logFailure(logTag, { provider: 'groq', model: groqModel, status: response.status, requestId: response.headers.get('x-request-id') });
        throw new Error(`Groq HTTP ${response.status}`);
      }
      return result(await response.json(), 'groq', groqModel, timings);
    } catch (error) {
      groqFailure = error instanceof Error ? error : new Error('Groq request failed');
      if (!/^Groq HTTP \d+$/.test(groqFailure.message)) logFailure(logTag, { provider: 'groq', model: groqModel, errorName: groqFailure.name, errorMessage: groqFailure.message });
    }
  }
  if (env.AI) {
    try {
      return await viaCloudflare(env.AI, bytes, { prompt: options.prompt, logTag, timings });
    } catch {
      throw new Error(groqFailure ? 'Groq and Cloudflare transcription failed' : 'Cloudflare transcription failed');
    }
  }
  throw groqFailure ?? new Error('No transcription provider configured');
}

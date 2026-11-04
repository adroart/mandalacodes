import type { R2Bucket } from '@cloudflare/workers-types';
import { admin, isAuthResponse, isResponse, json, requireBinding, validUuid, type ReflectionEnv } from '../oracle/reflections/_shared';
import type { QuickSegment, QuickTranscript } from '../_lib/quickTranscription';
import { buildWordsPrompt } from '../../../shared/words';

/**
 * Voice memos and photos sent from the phone for AR Create: a memo is a folder in the private bucket with one
 * manifest, one audio file, its photos and its first transcript. No database table; the manifest's etag guards
 * every change, so two tabs (or a retry) never overwrite each other.
 */
export interface MemoEnv extends ReflectionEnv { AR_PICKUP_TOKEN?: string }
export interface MemoContext { request: Request; env: MemoEnv; params: Record<string, string>; waitUntil(promise: Promise<unknown>): void }

export interface MemoPhoto { id: string; name: string; mimeType: string; byteSize: number; key: string; addedAt: string }
export interface MemoManifest {
  schema: 'mandalacodes.memo.v1';
  id: string;
  ownerUserId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  audio: { key: string; mimeType: string; byteSize: number; addedAt: string } | null;
  photos: MemoPhoto[];
  transcript: { status: 'none' | 'transcribing' | 'done' | 'failed'; startedAt: string | null; provider: string | null; error: string | null; key: string | null };
  /** Who has collected this memo, and when (the VPS feeder first; the Mac may later). */
  picked: Record<string, string>;
}

// Groq's upload limit; Workers AI takes the same file as base64.
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
export const MAX_PHOTOS = 20;
export const TRANSCRIPTION_LEASE_MS = 5 * 60 * 1000;

export const memoPrefix = (ownerUserId: string, memoId: string) => `memos/${ownerUserId}/${memoId}/`;
export const manifestKey = (ownerUserId: string, memoId: string) => `${memoPrefix(ownerUserId, memoId)}manifest.json`;

export function newManifest(ownerUserId: string, id: string, title: string, now = new Date().toISOString()): MemoManifest {
  return { schema: 'mandalacodes.memo.v1', id, ownerUserId, title, createdAt: now, updatedAt: now, audio: null, photos: [], transcript: { status: 'none', startedAt: null, provider: null, error: null, key: null }, picked: {} };
}

export async function readManifest(bucket: R2Bucket, key: string): Promise<{ manifest: MemoManifest; etag: string } | null> {
  const object = await bucket.get(key);
  if (!object) return null;
  return { manifest: await object.json<MemoManifest>(), etag: object.etag };
}

/** Writes only if nobody changed the manifest since it was read. Returns false when someone did. */
export async function writeManifest(bucket: R2Bucket, key: string, manifest: MemoManifest, etag: string | null): Promise<boolean> {
  const body = JSON.stringify({ ...manifest, updatedAt: new Date().toISOString() });
  const options = { httpMetadata: { contentType: 'application/json' }, ...(etag ? { onlyIf: { etagMatches: etag } } : { onlyIf: { etagDoesNotMatch: '*' } }) };
  return (await bucket.put(key, body, options as never)) !== null;
}

export const conflict = () => json({ ok: false, error: 'the memo changed; read it again' }, 409);

/** Storage needs the size before the stream starts, so an upload must say how long it is. */
export function declaredLength(request: Request, max: number, tooLarge: string): number | Response {
  const length = Number(request.headers.get('Content-Length'));
  if (!request.body || !Number.isInteger(length) || length <= 0) return json({ ok: false, error: 'the file is empty or its size is unknown' }, 411);
  if (length > max) return json({ ok: false, error: tooLarge }, 413);
  return length;
}
export const cleanTitle = (value: unknown) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
export const isAudioType = (type: string) => /^audio\/[\w.+-]+(;.*)?$/i.test(type) || /^video\/mp4(;.*)?$/i.test(type);
export const isPhotoType = (type: string) => /^image\/(jpeg|png|heic|heif|webp)$/i.test(type);

export function canClaimTranscript(manifest: MemoManifest, nowMs = Date.now()) {
  const { status, startedAt } = manifest.transcript;
  if (status === 'none' || status === 'failed') return true;
  if (status !== 'transcribing') return false;
  const started = startedAt ? Date.parse(startedAt) : NaN;
  return !Number.isFinite(started) || started <= nowMs - TRANSCRIPTION_LEASE_MS;
}

/** The memo's vocabulary prompt: its own sentence, then the shared library's words (tea, people and places first). */
export const memoTranscriptionPrompt = () => buildWordsPrompt(undefined, {
  intro: 'A voice memo about tea, ceramics, art, travel and the people met. Preserve these spellings and natural punctuation.',
  head: 'Terms: ',
  order: 'category-first',
  categories: ['person', 'place', 'tea-term', 'other'],
}).prompt;

const clock = (seconds: number) => {
  const whole = Math.max(0, Math.floor(seconds));
  const h = Math.floor(whole / 3600), m = Math.floor(whole / 60) % 60, s = whole % 60;
  return (h ? `${h}:${String(m).padStart(2, '0')}` : String(m)) + ':' + String(s).padStart(2, '0');
};

// A new paragraph at a pause this long, or once a paragraph has run this long; each one starts with its time.
const PARAGRAPH_PAUSE_S = 2;
const PARAGRAPH_MAX_S = 60;

/**
 * The transcript as AR Create reads it: paragraphs separated by blank lines, each opening with "[m:ss]" so every
 * moment keeps its real time. The words are the transcript's own; nothing is added between them.
 */
export function timedTranscriptText(transcript: Pick<QuickTranscript, 'text' | 'segments'>): string {
  const segments: QuickSegment[] = transcript.segments ?? [];
  if (!segments.length) return transcript.text.trim() + '\n';
  const paragraphs: { at: number; parts: string[] }[] = [];
  let previousEnd = -Infinity;
  for (const segment of segments) {
    const current = paragraphs[paragraphs.length - 1];
    if (!current || segment.start - previousEnd >= PARAGRAPH_PAUSE_S || segment.start - current.at >= PARAGRAPH_MAX_S) paragraphs.push({ at: segment.start, parts: [] });
    paragraphs[paragraphs.length - 1].parts.push(segment.text.trim());
    previousEnd = segment.end;
  }
  return paragraphs.map((p) => `[${clock(p.at)}] ${p.parts.filter(Boolean).join(' ')}`).join('\n\n') + '\n';
}

/** What the phone page and the pickup see of a memo (never bucket keys of other owners, never the owner id). */
export const memoView = (manifest: MemoManifest) => ({
  id: manifest.id, title: manifest.title, createdAt: manifest.createdAt, updatedAt: manifest.updatedAt,
  audio: manifest.audio ? { mimeType: manifest.audio.mimeType, byteSize: manifest.audio.byteSize } : null,
  photos: manifest.photos.map(({ id, name, mimeType, byteSize }) => ({ id, name, mimeType, byteSize })),
  transcript: { status: manifest.transcript.status, provider: manifest.transcript.provider, error: manifest.transcript.error },
  picked: manifest.picked,
});

/** A memo's manifest key found by id alone, for the pickup (which holds a site key, not a person's session). */
export async function findManifestKey(bucket: R2Bucket, memoId: string): Promise<string | null> {
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix: 'memos/', cursor });
    const hit = page.objects.find((object) => object.key.endsWith(`/${memoId}/manifest.json`));
    if (hit) return hit.key;
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return null;
}

/** Every memo's manifest, oldest first, for the pickup. */
export async function allManifests(bucket: R2Bucket): Promise<{ manifest: MemoManifest; key: string }[]> {
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix: 'memos/', cursor });
    keys.push(...page.objects.map((object) => object.key).filter((key) => key.endsWith('/manifest.json')));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  const read = await Promise.all(keys.map(async (key) => { const found = await readManifest(bucket, key); return found ? { manifest: found.manifest, key } : null; }));
  return read.filter((entry): entry is { manifest: MemoManifest; key: string } => entry !== null).sort((a, b) => a.manifest.createdAt.localeCompare(b.manifest.createdAt));
}

export const needsTranscript = (manifest: MemoManifest, nowMs = Date.now()) => Boolean(manifest.audio) && canClaimTranscript(manifest, nowMs);
export const PICKERS = new Set(['vps', 'mac']);

/** The signed-in admin's own memo, read fresh. Returns a response to send back when it cannot be used. */
export async function ownMemo({ request, env, params }: MemoContext) {
  const auth = await admin(request, env); if (isAuthResponse(auth)) return auth;
  const bucket = requireBinding(env.ORACLE_PRIVATE, 'ORACLE_PRIVATE'); if (isResponse(bucket)) return bucket;
  if (!validUuid(params.id)) return json({ ok: false, error: 'invalid memo id' }, 400);
  const key = manifestKey(auth.userId, params.id);
  const read = await readManifest(bucket, key);
  if (!read) return json({ ok: false, error: 'memo not found' }, 404);
  return { auth, bucket, key, ...read };
}

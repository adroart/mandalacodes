/**
 * Card recordings ("takes") made in the Oracle iPhone app, as kept in the private R2 bucket by the private copy:
 *   authoring/<encoded user id>/audio/<sha256>         the audio, written once by `audio-put`
 *   authoring/<encoded user id>/better/<sha256>.json   the Mac's better transcript for that audio, written by the pickup
 * Nothing here reads or writes outside those two prefixes.
 */
import type { R2Object } from '@cloudflare/workers-types';

export const AUDIO_HASH = /^[a-f0-9]{64}$/;
/** What encodeURIComponent can produce. The user segment of a key is always encoded that way by private.ts. */
const USER_SEGMENT = /^[A-Za-z0-9_.!~*'()%-]{1,256}$/;
const AUDIO_TYPE = /^audio\/[a-zA-Z0-9.+-]+(?:;[a-zA-Z0-9=._, -]+)?$/;

export const audioKeyOf = (user: string, hash: string) => `authoring/${user}/audio/${hash}`;
export const betterKeyOf = (user: string, hash: string) => `authoring/${user}/better/${hash}.json`;

const toBase64Url = (value: string) => btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  return atob(padded);
}

/** True for a user segment exactly as encodeURIComponent writes it: canonical, and never "." or "..". */
export function validUserSegment(user: string) {
  if (!USER_SEGMENT.test(user) || user === '.' || user === '..') return false;
  try { return encodeURIComponent(decodeURIComponent(user)) === user; } catch { return false; }
}

/** The take's id: base64url of "<user segment>/<audio hash>". Opaque to the Mac; it cannot be guessed without the audio's hash. */
export const takeIdOf = (user: string, hash: string) => toBase64Url(`${user}/${hash}`);

export interface TakeRef { user: string; hash: string; audioKey: string; betterKey: string }

/** Strict: only an id this site would have issued is accepted, so no other key or prefix can be named through it. */
export function parseTakeId(id: unknown): TakeRef | null {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{88,440}$/.test(id)) return null;
  let decoded: string;
  try { decoded = fromBase64Url(id); } catch { return null; }
  if (!/^[\x21-\x7e]+$/.test(decoded) || toBase64Url(decoded) !== id) return null;
  const slash = decoded.lastIndexOf('/');
  if (slash < 1) return null;
  const user = decoded.slice(0, slash), hash = decoded.slice(slash + 1);
  if (!validUserSegment(user) || !AUDIO_HASH.test(hash)) return null;
  return { user, hash, audioKey: audioKeyOf(user, hash), betterKey: betterKeyOf(user, hash) };
}

/** What the phone says about a take when it uploads it, kept as R2 custom metadata (string values, small). */
export interface TakeDetails { durationMs?: number; cardNumber?: number; sectionId?: string; captureId?: string; recordedAt?: string }
export const DETAILS_VERSION = '1';
const MAX_DURATION_MS = 6 * 60 * 60 * 1000;

/** Keeps only fields that are valid and bounded; anything else is dropped, never trusted. Returns R2 custom metadata. */
export function cleanTakeDetails(input: unknown): Record<string, string> {
  const out: Record<string, string> = { v: DETAILS_VERSION };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  const value = input as Record<string, unknown>;
  if (Number.isSafeInteger(value.durationMs) && (value.durationMs as number) >= 0 && (value.durationMs as number) <= MAX_DURATION_MS) out.durationMs = String(value.durationMs);
  if (Number.isSafeInteger(value.cardNumber) && (value.cardNumber as number) >= 1 && (value.cardNumber as number) <= 64) out.cardNumber = String(value.cardNumber);
  if (typeof value.sectionId === 'string' && /^[\x20-\x7e]{1,200}$/.test(value.sectionId) && value.sectionId.trim()) out.sectionId = value.sectionId;
  if (typeof value.captureId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value.captureId)) out.captureId = value.captureId;
  if (typeof value.recordedAt === 'string' && value.recordedAt.length <= 40) {
    const time = Date.parse(value.recordedAt);
    if (Number.isFinite(time) && time >= Date.UTC(2000, 0, 1) && time <= Date.UTC(2100, 0, 1)) out.recordedAt = new Date(time).toISOString();
  }
  return out;
}

/** The details read back. Objects uploaded before details were kept have none: `detailsKnown` is false. */
export function readTakeDetails(object: Pick<R2Object, 'customMetadata' | 'httpMetadata'>) {
  const meta = object.customMetadata ?? {};
  const clean = cleanTakeDetails({
    durationMs: meta.durationMs === undefined ? undefined : Number(meta.durationMs),
    cardNumber: meta.cardNumber === undefined ? undefined : Number(meta.cardNumber),
    sectionId: meta.sectionId, captureId: meta.captureId, recordedAt: meta.recordedAt,
  });
  const type = object.httpMetadata?.contentType;
  return {
    detailsKnown: meta.v === DETAILS_VERSION,
    mimeType: typeof type === 'string' && type.length <= 160 && AUDIO_TYPE.test(type) ? type : 'application/octet-stream',
    durationMs: clean.durationMs === undefined ? null : Number(clean.durationMs),
    cardNumber: clean.cardNumber === undefined ? null : Number(clean.cardNumber),
    sectionId: clean.sectionId ?? null,
    captureId: clean.captureId ?? null,
    recordedAt: clean.recordedAt ?? null,
  };
}

/** The better transcript as stored next to the audio, and as handed to the phone by `better-get`. */
export interface StoredBetterTake {
  format: 'oracle-take-better'; version: 1;
  audioHash: string; outcome: 'improved' | 'skipped'; receivedAt: string;
  resultHash?: string; engine?: string; engineVersion?: string | null; text?: string;
  segments?: { startMs: number; endMs: number; text: string; speaker?: string }[];
  words?: { text: string; startMs: number; endMs: number; probability?: number }[];
  speakers?: unknown[]; reason?: string;
}

export function parseStoredBetter(value: unknown): StoredBetterTake | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as StoredBetterTake;
  if (record.format !== 'oracle-take-better' || !AUDIO_HASH.test(String(record.audioHash))) return null;
  if (record.outcome !== 'improved' && record.outcome !== 'skipped') return null;
  return record;
}

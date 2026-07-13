import { REFLECTION_LIMITS } from '../types/oracleReflection';

const MIME_CANDIDATES = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'] as const;

export function chooseRecorderMimeType(isSupported: (type: string) => boolean): string | null {
  return MIME_CANDIDATES.find(isSupported) ?? null;
}

export function validateHexagramNumber(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 64) throw new Error('hexagramNumber must be an integer from 1 to 64');
  return Number(value);
}

export function validateSegmentMetadata<T extends { durationMs: number; byteSize: number; mimeType: string }>(value: T): T {
  if (!Number.isFinite(value.durationMs) || value.durationMs <= 0) throw new Error('segment duration must be positive');
  if (value.durationMs > REFLECTION_LIMITS.maxSegmentDurationMs) throw new Error('segment duration exceeds 20 minutes');
  if (!Number.isInteger(value.byteSize) || value.byteSize <= 0) throw new Error('segment byte size must be positive');
  if (value.byteSize > REFLECTION_LIMITS.maxSegmentBytes) throw new Error('segment exceeds 10 MiB');
  if (!/^audio\/(mp4|webm)(;|$)/.test(value.mimeType)) throw new Error('unsupported audio MIME type');
  return value;
}

export function normalizeTranscript(value: unknown): { text: string } {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const text = typeof row.text === 'string' ? row.text : typeof row.transcription === 'string' ? row.transcription : '';
  if (!text.trim()) throw new Error('transcription response did not contain text');
  return { text: text.trim() };
}

export function reorderSegments<T extends { id: string; sequence: number }>(rows: T[], ids: string[]): T[] {
  const rowIds = new Set(rows.map((row) => row.id));
  if (ids.length !== rows.length || new Set(ids).size !== rows.length || ids.some((id) => !rowIds.has(id))) {
    throw new Error('segmentIds must contain every segment exactly once');
  }
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id, sequence) => ({ ...byId.get(id)!, sequence }));
}

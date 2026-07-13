import { describe, expect, it } from 'vitest';
import {
  chooseRecorderMimeType,
  normalizeTranscript,
  reorderSegments,
  validateHexagramNumber,
  validateSegmentMetadata,
} from '../../utils/oracleReflection';

describe('oracle reflection contracts', () => {
  it('selects the first Safari-compatible supported MIME type', () => {
    const supported = new Set(['audio/mp4;codecs=mp4a.40.2']);
    expect(chooseRecorderMimeType((type) => supported.has(type))).toBe('audio/mp4;codecs=mp4a.40.2');
    expect(chooseRecorderMimeType(() => false)).toBeNull();
  });

  it('accepts only King Wen numbers', () => {
    expect(validateHexagramNumber(1)).toBe(1);
    expect(validateHexagramNumber(64)).toBe(64);
    expect(() => validateHexagramNumber(0)).toThrow('hexagramNumber must be an integer from 1 to 64');
  });

  it('rejects oversize and overlong segment metadata', () => {
    expect(() => validateSegmentMetadata({ durationMs: 1_200_001, byteSize: 10, mimeType: 'audio/mp4' })).toThrow('segment duration exceeds 20 minutes');
    expect(() => validateSegmentMetadata({ durationMs: 1000, byteSize: 10_485_761, mimeType: 'audio/mp4' })).toThrow('segment exceeds 10 MiB');
  });

  it('caps private audio at 10 MiB', () => {
    expect(() => validateSegmentMetadata({ durationMs: 1000, byteSize: 10 * 1024 * 1024 + 1, mimeType: 'audio/mp4' })).toThrow('segment exceeds 10 MiB');
  });

  it('normalizes Workers AI transcript shapes without leaking provider fields', () => {
    expect(normalizeTranscript({ text: '  First breath.  ', words: ['private'] })).toEqual({ text: 'First breath.' });
    expect(normalizeTranscript({ transcription: 'Second breath.' })).toEqual({ text: 'Second breath.' });
  });

  it('reorders by complete identity list without changing timestamps', () => {
    const rows = [
      { id: 'a', sequence: 0, recordedAt: '2026-07-13T01:00:00Z' },
      { id: 'b', sequence: 1, recordedAt: '2026-07-13T02:00:00Z' },
    ];
    expect(reorderSegments(rows, ['b', 'a'])).toEqual([
      { id: 'b', sequence: 0, recordedAt: '2026-07-13T02:00:00Z' },
      { id: 'a', sequence: 1, recordedAt: '2026-07-13T01:00:00Z' },
    ]);
    expect(() => reorderSegments(rows, ['a'])).toThrow('segmentIds must contain every segment exactly once');
  });
});

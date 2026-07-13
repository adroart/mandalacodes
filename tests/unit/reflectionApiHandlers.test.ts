import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();
vi.mock('../../lib/account/auth.server.js', () => ({ createAuth: () => ({ api: { getSession } }) }));

describe('reflection API boundary', () => {
  beforeEach(() => getSession.mockReset());

  it('returns capability only for an allowlisted server session', async () => {
    getSession.mockResolvedValue({ user: { id: 'admin-1', email: 'a@example.com' }, session: { id: 's' } });
    const { onRequestGet } = await import('../../functions/api/oracle/reflections/capability');
    const response = await onRequestGet({ request: new Request('https://example.test/api/oracle/reflections/capability'), env: { DB: {}, ADMIN_EMAILS: 'A@example.com' }, params: {}, waitUntil: vi.fn() } as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, admin: true });
  });

  it('fails closed for missing allowlist and missing sessions', async () => {
    getSession.mockResolvedValue({ user: { id: 'admin-1', email: 'a@example.com' }, session: { id: 's' } });
    const { onRequestGet } = await import('../../functions/api/oracle/reflections/capability');
    expect((await onRequestGet({ request: new Request('https://example.test'), env: { DB: {} }, params: {}, waitUntil: vi.fn() } as never)).status).toBe(403);
    getSession.mockResolvedValue(null);
    expect((await onRequestGet({ request: new Request('https://example.test'), env: { DB: {}, ADMIN_EMAILS: 'a@example.com' }, params: {}, waitUntil: vi.fn() } as never)).status).toBe(401);
  });

  it('normalizes Workers AI output and calls only the approved model', async () => {
    const run = vi.fn().mockResolvedValue({ text: '  Breath. ', duration: 1.2, private: 'omitted' });
    const { transcribeCommittedAudio } = await import('../../functions/api/oracle/reflections/_shared');
    const result = await transcribeCommittedAudio({ run } as never, new Uint8Array([1, 2]).buffer);
    expect(run).toHaveBeenCalledWith('@cf/openai/whisper-large-v3-turbo', { audio: 'AQI=' });
    expect(result).toEqual({ text: 'Breath.', metadataJson: JSON.stringify({ wordCount: 1, duration: 1.2 }) });
  });

  it('reclaims only expired transcription leases', async () => {
    const { canClaimTranscription } = await import('../../functions/api/oracle/reflections/_shared');
    const now = Date.parse('2026-07-13T01:00:00.000Z');
    expect(canClaimTranscription('transcription_pending', null, now)).toBe(true);
    expect(canClaimTranscription('failed', null, now)).toBe(true);
    expect(canClaimTranscription('transcribing', '2026-07-13T00:54:59.999Z', now)).toBe(true);
    expect(canClaimTranscription('transcribing', '2026-07-13T00:55:00.001Z', now)).toBe(false);
  });

  it('requires every immutable upload identity field to match on retry', async () => {
    const { isSameCommittedSegment } = await import('../../functions/api/oracle/reflections/segments');
    const row = { owner_user_id: 'admin-1', session_id: 'session-1', byte_size: 5, mime_type: 'audio/mp4', duration_ms: 1000, recorded_at: '2026-07-13T00:00:00Z', object_key: 'reflections/admin-1/session-1/seg-1' };
    expect(isSameCommittedSegment(row, { ownerId: 'admin-1', sessionId: 'session-1', segmentId: 'seg-1', byteSize: 5, mimeType: 'audio/mp4', durationMs: 1000, recordedAt: '2026-07-13T00:00:00Z' })).toBe(true);
    expect(isSameCommittedSegment(row, { ownerId: 'admin-1', sessionId: 'session-1', segmentId: 'seg-1', byteSize: 5, mimeType: 'audio/webm', durationMs: 1000, recordedAt: '2026-07-13T00:00:00Z' })).toBe(false);
    expect(isSameCommittedSegment(row, { ownerId: 'admin-1', sessionId: 'session-1', segmentId: 'seg-1', byteSize: 5, mimeType: 'audio/mp4', durationMs: 999, recordedAt: '2026-07-13T00:00:00Z' })).toBe(false);
  });

  it('places newly committed recordings first while preserving prior relative order', async () => {
    const { sequencesAfterNewestInsert } = await import('../../functions/api/oracle/reflections/segments');
    expect(sequencesAfterNewestInsert([{ id: 'recent', sequence: 0 }, { id: 'older', sequence: 1 }])).toEqual([
      { id: 'recent', sequence: 1 }, { id: 'older', sequence: 2 },
    ]);
  });
});

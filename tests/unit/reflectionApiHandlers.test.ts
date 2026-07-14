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

  it('sends Safari audio to Groq before using Workers AI', async () => {
    const run = vi.fn();
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: '  Breath. ', duration: 1.2 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    const { transcribeCommittedAudio } = await import('../../functions/api/oracle/reflections/_shared');

    const result = await transcribeCommittedAudio(
      { GROQ_API_KEY: 'groq-secret', AI: { run } as never },
      new Uint8Array([1, 2]).buffer,
      'audio/mp4;codecs=mp4a.40.2',
      fetcher,
    );

    expect(fetcher).toHaveBeenCalledWith('https://api.groq.com/openai/v1/audio/transcriptions', expect.objectContaining({
      method: 'POST',
      headers: { Authorization: 'Bearer groq-secret' },
    }));
    const form = fetcher.mock.calls[0][1].body as FormData;
    expect(form.get('model')).toBe('whisper-large-v3-turbo');
    expect((form.get('file') as File).type).toBe('audio/mp4;codecs=mp4a.40.2');
    expect(run).not.toHaveBeenCalled();
    expect(result).toEqual({ text: 'Breath.', metadataJson: JSON.stringify({ provider: 'groq', wordCount: 1, duration: 1.2 }) });
  });

  it('uses Workers AI when Groq is not configured', async () => {
    const run = vi.fn().mockResolvedValue({ text: '  Breath. ', duration: 1.2, private: 'omitted' });
    const { transcribeCommittedAudio } = await import('../../functions/api/oracle/reflections/_shared');
    const result = await transcribeCommittedAudio({ AI: { run } as never }, new Uint8Array([1, 2]).buffer, 'audio/webm');
    expect(run).toHaveBeenCalledWith('@cf/openai/whisper-large-v3-turbo', { audio: 'AQI=' });
    expect(result).toEqual({ text: 'Breath.', metadataJson: JSON.stringify({ provider: 'cloudflare', wordCount: 1, duration: 1.2 }) });
  });

  it('falls back through Groq and both approved Workers AI models', async () => {
    const run = vi.fn()
      .mockRejectedValueOnce(new Error('model is unavailable'))
      .mockResolvedValueOnce({ text: '  Returning breath. ', word_count: 2 });
    const fetcher = vi.fn().mockResolvedValue(new Response('temporary Groq failure', { status: 503 }));
    const { transcribeCommittedAudio } = await import('../../functions/api/oracle/reflections/_shared');

    const result = await transcribeCommittedAudio(
      { GROQ_API_KEY: 'groq-secret', AI: { run } as never },
      new Uint8Array([1, 2]).buffer,
      'audio/webm',
      fetcher,
    );

    expect(fetcher).toHaveBeenCalledOnce();
    expect(run).toHaveBeenNthCalledWith(1, '@cf/openai/whisper-large-v3-turbo', { audio: 'AQI=' });
    expect(run).toHaveBeenNthCalledWith(2, '@cf/openai/whisper', { audio: [1, 2] });
    expect(result).toEqual({ text: 'Returning breath.', metadataJson: JSON.stringify({ provider: 'cloudflare', wordCount: 2, duration: null }) });
  });

  it('reports which transcription providers failed without exposing provider response bodies', async () => {
    const run = vi.fn().mockRejectedValue(new Error('private upstream details'));
    const fetcher = vi.fn().mockResolvedValue(new Response('private Groq response', { status: 503 }));
    const { transcribeCommittedAudio } = await import('../../functions/api/oracle/reflections/_shared');

    await expect(transcribeCommittedAudio(
      { GROQ_API_KEY: 'groq-secret', AI: { run } as never },
      new Uint8Array([1, 2]).buffer,
      'audio/webm',
      fetcher,
    )).rejects.toThrow('Groq and Cloudflare transcription failed');
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

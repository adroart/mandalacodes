import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();
vi.mock('../../lib/account/auth.server.js', () => ({ createAuth: () => ({ api: { getSession } }) }));

const adminSession = { user: { id: 'admin-1', email: 'a@example.com' }, session: { id: 's' } };

type SegmentRow = Record<string, unknown> & {
  id: string;
  owner_user_id: string;
  object_key: string;
  mime_type: string;
  transcript: string;
  transcription_status: string;
  transcription_error: string | null;
  transcription_started_at: string | null;
};

function segmentRow(overrides: Partial<SegmentRow> = {}): SegmentRow {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    session_id: '00000000-0000-4000-8000-000000000002',
    owner_user_id: 'admin-1', sequence: 0, recorded_at: '2026-07-13T00:00:00.000Z',
    duration_ms: 1_000, mime_type: 'audio/webm', byte_size: 2,
    object_key: 'reflections/admin-1/session/segment', transcript: '',
    transcription_status: 'transcription_pending', transcription_error: null,
    transcription_started_at: null, provider_metadata_json: null,
    created_at: '2026-07-13T00:00:00.000Z', updated_at: '2026-07-13T00:00:00.000Z',
    ...overrides,
  };
}

function fakeSegmentDb(row: SegmentRow) {
  return {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async first() { return { ...row }; },
            async run() {
              if (sql.includes("SET transcription_status='transcribing'")) {
                row.transcription_status = 'transcribing';
                row.transcription_error = null;
                row.transcription_started_at = String(values[2]);
                return { meta: { changes: 1 } };
              }
              if (sql.includes("SET transcript=?3,transcription_status='transcribed'") && sql.includes('transcription_started_at=?6')) {
                const claimMatches = row.transcription_status === 'transcribing' && row.transcription_started_at === values[5];
                if (!claimMatches) return { meta: { changes: 0 } };
                row.transcript = String(values[2]);
                row.transcription_status = 'transcribed';
                row.transcription_error = null;
                row.transcription_started_at = null;
                row.provider_metadata_json = String(values[3]);
                return { meta: { changes: 1 } };
              }
              if (sql.includes("SET transcription_status='failed'")) {
                const claimMatches = row.transcription_status === 'transcribing' && row.transcription_started_at === values[4];
                if (!claimMatches) return { meta: { changes: 0 } };
                row.transcription_status = 'failed';
                row.transcription_error = String(values[2]);
                row.transcription_started_at = null;
                return { meta: { changes: 1 } };
              }
              if (sql.includes("SET transcription_status='transcription_pending'")) {
                row.transcription_status = 'transcription_pending';
                row.transcription_error = String(values[2]);
                row.transcription_started_at = null;
                return { meta: { changes: 1 } };
              }
              if (sql.includes('SET transcript=?3')) {
                row.transcript = String(values[2]).trim();
                if (sql.includes("transcription_status='transcribed'")) row.transcription_status = 'transcribed';
                if (sql.includes('transcription_error=NULL')) row.transcription_error = null;
                if (sql.includes('transcription_started_at=NULL')) row.transcription_started_at = null;
                if (sql.includes('provider_metadata_json=?4')) row.provider_metadata_json = String(values[3]);
                return { meta: { changes: 1 } };
              }
              return { meta: { changes: 0 } };
            },
          };
        },
      };
    },
  };
}

describe('reflection API boundary', () => {
  beforeEach(() => {
    getSession.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

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
    expect(form.get('prompt')).toContain('I Ching');
    expect(form.get('prompt')).toContain('Siddhi');
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

  it('invokes the Workers AI method with its binding as the receiver', async () => {
    const ai = {
      async run(this: unknown) {
        if (this !== ai) throw new TypeError('Illegal invocation');
        return { text: 'Bound breath.' };
      },
    };
    const { transcribeCommittedAudio } = await import('../../functions/api/oracle/reflections/_shared');

    await expect(transcribeCommittedAudio(
      { AI: ai as never }, new Uint8Array([1, 2]).buffer, 'audio/webm',
    )).resolves.toMatchObject({ text: 'Bound breath.' });
  });

  it('invokes the worker fetch method with the global receiver', async () => {
    const previousFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(function (this: unknown) {
      if (this !== globalThis) throw new TypeError('Illegal invocation');
      return Promise.resolve(new Response(JSON.stringify({ text: 'Global breath.' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    }) as never;

    try {
      const { transcribeCommittedAudio } = await import('../../functions/api/oracle/reflections/_shared');
      await expect(transcribeCommittedAudio(
        { GROQ_API_KEY: 'groq-secret' }, new Uint8Array([1, 2]).buffer, 'audio/mp4',
      )).resolves.toMatchObject({ text: 'Global breath.' });
    } finally {
      globalThis.fetch = previousFetch;
    }
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

  it('does not allocate the legacy byte array fallback for large recordings', async () => {
    const run = vi.fn().mockRejectedValue(new Error('turbo unavailable'));
    const { transcribeCommittedAudio } = await import('../../functions/api/oracle/reflections/_shared');

    await expect(transcribeCommittedAudio(
      { AI: { run } as never },
      new Uint8Array(4 * 1024 * 1024 + 1).buffer,
      'audio/webm',
    )).rejects.toThrow('Cloudflare transcription failed');

    expect(run).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledWith('@cf/openai/whisper-large-v3-turbo', expect.any(Object));
  });

  it('logs bounded Groq failure diagnostics without response bodies or secrets', async () => {
    const log = vi.mocked(console.error);
    log.mockClear();
    const fetcher = vi.fn().mockResolvedValue(new Response('private upstream response body', {
      status: 503,
      headers: { 'x-request-id': 'request-123' },
    }));
    const { transcribeCommittedAudio } = await import('../../functions/api/oracle/reflections/_shared');

    await expect(transcribeCommittedAudio(
      { GROQ_API_KEY: 'do-not-log-this' }, new Uint8Array([1, 2]).buffer, 'audio/webm', fetcher,
    )).rejects.toThrow('Groq HTTP 503');

    const diagnostic = JSON.stringify(log.mock.calls);
    expect(diagnostic).toContain('groq');
    expect(diagnostic).toContain('503');
    expect(diagnostic).toContain('request-123');
    expect(diagnostic).not.toContain('private upstream response body');
    expect(diagnostic).not.toContain('do-not-log-this');
  });

  it('manual transcript edits finalize the segment and clear a transcription lease', async () => {
    getSession.mockResolvedValue(adminSession);
    const row = segmentRow({
      transcription_status: 'transcribing', transcription_error: 'old error',
      transcription_started_at: '2026-07-13T00:00:00.000Z',
      provider_metadata_json: JSON.stringify({ provider: 'groq', wordCount: 99 }),
    });
    const { onRequestPatch } = await import('../../functions/api/oracle/reflections/segments/[id]');
    const response = await onRequestPatch({
      request: new Request('https://example.test/api/oracle/reflections/segments/segment', { method: 'PATCH', body: JSON.stringify({ transcript: '  My own words.  ' }) }),
      env: { DB: fakeSegmentDb(row), ADMIN_EMAILS: 'a@example.com' },
      params: { id: row.id }, waitUntil: vi.fn(),
    } as never);

    expect(response.status).toBe(200);
    expect(row).toMatchObject({ transcript: 'My own words.', transcription_status: 'transcribed', transcription_error: null, transcription_started_at: null });
    expect(row.provider_metadata_json).toBe(JSON.stringify({ provider: 'manual', wordCount: 3 }));
  });

  it('rejects a whitespace-only manual transcript without changing the segment', async () => {
    getSession.mockResolvedValue(adminSession);
    const row = segmentRow({ transcript: 'Existing words.', transcription_status: 'transcribed' });
    const { onRequestPatch } = await import('../../functions/api/oracle/reflections/segments/[id]');
    const response = await onRequestPatch({
      request: new Request('https://example.test/api/oracle/reflections/segments/segment', { method: 'PATCH', body: JSON.stringify({ transcript: ' \n\t ' }) }),
      env: { DB: fakeSegmentDb(row), ADMIN_EMAILS: 'a@example.com' },
      params: { id: row.id }, waitUntil: vi.fn(),
    } as never);

    expect(response.status).toBe(400);
    expect(row.transcript).toBe('Existing words.');
  });

  it('does not overwrite a manual edit made while provider transcription is in flight', async () => {
    getSession.mockResolvedValue(adminSession);
    const row = segmentRow();
    const db = fakeSegmentDb(row);
    const run = vi.fn().mockImplementation(async () => {
      row.transcript = 'My own words.';
      row.transcription_status = 'transcribed';
      row.transcription_started_at = null;
      return { text: 'Provider words.' };
    });
    const { onRequestPost } = await import('../../functions/api/oracle/reflections/segments/[id]/transcribe');
    const response = await onRequestPost({
      request: new Request('https://example.test/api/oracle/reflections/segments/segment/transcribe', { method: 'POST' }),
      env: { DB: db, ORACLE_PRIVATE: { get: vi.fn().mockResolvedValue({ arrayBuffer: () => new Uint8Array([1, 2]).buffer }) }, AI: { run }, ADMIN_EMAILS: 'a@example.com' },
      params: { id: row.id }, waitUntil: vi.fn(),
    } as never);

    expect(response.status).toBe(200);
    expect(row.transcript).toBe('My own words.');
    expect(row.transcription_status).toBe('transcribed');
  });

  it('marks provider failures as failed instead of automatically pending again', async () => {
    getSession.mockResolvedValue(adminSession);
    const row = segmentRow();
    const { onRequestPost } = await import('../../functions/api/oracle/reflections/segments/[id]/transcribe');
    const response = await onRequestPost({
      request: new Request('https://example.test/api/oracle/reflections/segments/segment/transcribe', { method: 'POST' }),
      env: { DB: fakeSegmentDb(row), ORACLE_PRIVATE: { get: vi.fn().mockResolvedValue({ arrayBuffer: () => new Uint8Array([1, 2]).buffer }) }, AI: { run: vi.fn().mockRejectedValue(new Error('provider down')) }, ADMIN_EMAILS: 'a@example.com' },
      params: { id: row.id }, waitUntil: vi.fn(),
    } as never);

    expect(response.status).toBe(202);
    expect(row.transcription_status).toBe('failed');
  });

  it('does not let a late provider failure replace a newer manual transcript state', async () => {
    getSession.mockResolvedValue(adminSession);
    const row = segmentRow();
    const run = vi.fn().mockImplementation(async () => {
      row.transcript = 'My newer words.';
      row.transcription_status = 'transcribed';
      row.transcription_error = null;
      row.transcription_started_at = null;
      throw new Error('late provider failure');
    });
    const { onRequestPost } = await import('../../functions/api/oracle/reflections/segments/[id]/transcribe');
    await onRequestPost({
      request: new Request('https://example.test/api/oracle/reflections/segments/segment/transcribe', { method: 'POST' }),
      env: { DB: fakeSegmentDb(row), ORACLE_PRIVATE: { get: vi.fn().mockResolvedValue({ arrayBuffer: () => new Uint8Array([1, 2]).buffer }) }, AI: { run }, ADMIN_EMAILS: 'a@example.com' },
      params: { id: row.id }, waitUntil: vi.fn(),
    } as never);

    expect(row).toMatchObject({
      transcript: 'My newer words.', transcription_status: 'transcribed',
      transcription_error: null, transcription_started_at: null,
    });
  });

  it('classifies missing committed audio as a terminal audio failure', async () => {
    getSession.mockResolvedValue(adminSession);
    const row = segmentRow();
    const { onRequestPost } = await import('../../functions/api/oracle/reflections/segments/[id]/transcribe');
    await onRequestPost({
      request: new Request('https://example.test/api/oracle/reflections/segments/segment/transcribe', { method: 'POST' }),
      env: { DB: fakeSegmentDb(row), ORACLE_PRIVATE: { get: vi.fn().mockResolvedValue(null) }, AI: { run: vi.fn() }, ADMIN_EMAILS: 'a@example.com' },
      params: { id: row.id }, waitUntil: vi.fn(),
    } as never);

    expect(row.transcription_status).toBe('failed');
    expect(row.transcription_error).toBe('Private audio is missing; this recording cannot be transcribed');
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

  it('supports Safari media byte ranges, including open-ended and suffix requests', async () => {
    const { parseAudioRange } = await import('../../functions/api/oracle/reflections/segments/[id]/audio');
    expect(parseAudioRange('bytes=0-', 100)).toEqual({ start: 0, end: 99 });
    expect(parseAudioRange('bytes=40-999', 100)).toEqual({ start: 40, end: 99 });
    expect(parseAudioRange('bytes=-20', 100)).toEqual({ start: 80, end: 99 });
    expect(parseAudioRange('bytes=100-', 100)).toBeNull();
    expect(parseAudioRange('bytes=0-1,4-5', 100)).toBeNull();
  });
});

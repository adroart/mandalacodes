import { afterEach, describe, expect, it, vi } from 'vitest';
import { getReflectionCapability, uploadReflectionSegment } from '../../lib/oracle/reflectionApi';

describe('reflection recorder browser API', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses credentialed no-store requests', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, admin: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    await getReflectionCapability();
    expect(fetch).toHaveBeenCalledWith('/api/oracle/reflections/capability', expect.objectContaining({ credentials: 'include' }));
    expect(new Headers(fetch.mock.calls[0][1].headers).get('Cache-Control')).toBe('no-store');
  });

  it('uploads metadata and the Blob as multipart fields', async () => {
    const segment = { id: 'segment-1' };
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ segment }), { status: 201 }));
    vi.stubGlobal('fetch', fetch);
    const blob = new Blob(['voice'], { type: 'audio/mp4' });
    await uploadReflectionSegment({
      id: 'segment-1', sessionId: 'session-1', hexagramNumber: 22,
      recordedAt: '2026-07-13T00:00:00Z', durationMs: 1000,
      mimeType: blob.type, byteSize: blob.size, blob,
    });
    const form = fetch.mock.calls[0][1].body as FormData;
    expect(form.get('audio')).toBeInstanceOf(Blob);
    expect(JSON.parse(String(form.get('metadata')))).not.toHaveProperty('blob');
  });

  it('throws a bounded status and message for non-success responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })));
    await expect(getReflectionCapability()).rejects.toMatchObject({ status: 403, message: 'Forbidden' });
  });
});

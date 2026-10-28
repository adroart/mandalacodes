import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reflectionTranscription } from '../../../lib/oracle/authoring/reflectionTranscription';
import { createSession, sourceSnapshot } from '../../../lib/oracle/authoring/workflow';
import * as api from '../../../lib/oracle/reflectionApi';
vi.mock('../../../lib/oracle/reflectionApi', () => ({ getReflectionCapability: vi.fn(), createReflectionSession: vi.fn(), uploadReflectionSegment: vi.fn(), transcribeReflectionSegment: vi.fn() }));
async function fixture() {
  const s = createSession(await sourceSnapshot(1, 'r', 'words', [{ id: 'CODE', title: 'Code', start: 0, end: 5 }]));
  const c = { id: crypto.randomUUID(), durationMs: 2000, recordedAt: s.createdAt, origin: 'microphone' as const, status: 'ready' as const, mimeType: 'audio/webm' };
  s.captures.push(c); s.markers.push({ captureId: c.id, atMs: 0, sectionId: 'CODE' });
  return { s, c, audio: new Blob(['audio'], { type: 'audio/webm' }) };
}
describe('existing reflection service adapter', () => {
  beforeEach(() => vi.resetAllMocks());
  it('preserves recording-level granularity and never manufactures transition times', async () => {
    vi.mocked(api.transcribeReflectionSegment).mockResolvedValue({ transcriptionStatus: 'transcribed', transcript: 'original response' } as never);
    const { s, c, audio } = await fixture();
    const single = await reflectionTranscription(s, c, audio);
    expect(single.segments[0]).toEqual({ text: 'original response', startMs: 0, endMs: 2000, sectionId: 'CODE', timing: 'recording' });
    s.markers.push({ captureId: c.id, atMs: 1000, sectionId: null });
    expect((await reflectionTranscription(s, c, audio)).segments[0].sectionId).toBeNull();
    expect(api.uploadReflectionSegment).toHaveBeenCalledWith(expect.objectContaining({ id: c.id, sessionId: s.id, blob: audio }));
  });
  it('retries the original private upload session after a portable review moves devices', async () => {
    const { s, c, audio } = await fixture();
    const remoteId = crypto.randomUUID();
    (s as typeof s & { reflectionSessionId: string }).reflectionSessionId = remoteId;
    vi.mocked(api.transcribeReflectionSegment).mockResolvedValue({ transcriptionStatus: 'transcribed', transcript: 'original response' } as never);
    await reflectionTranscription(s, c, audio);
    expect(api.createReflectionSession).toHaveBeenCalledWith(remoteId, 1);
    expect(api.uploadReflectionSegment).toHaveBeenCalledWith(expect.objectContaining({ sessionId: remoteId, id: c.id }));
  });
  it('surfaces provider or authentication failures without changing local audio', async () => {
    const { s, c, audio } = await fixture();
    vi.mocked(api.transcribeReflectionSegment).mockResolvedValue({ transcriptionStatus: 'failed', transcriptionError: 'Provider unavailable' } as never);
    await expect(reflectionTranscription(s, c, audio)).rejects.toThrow('Provider unavailable');
    expect(s.transcript).toEqual([]);
    expect(await audio.text()).toBe('audio');
    vi.mocked(api.getReflectionCapability).mockRejectedValue(new Error('Not authorized'));
    await expect(reflectionTranscription(s, c, audio)).rejects.toThrow('Not authorized');
  });
});

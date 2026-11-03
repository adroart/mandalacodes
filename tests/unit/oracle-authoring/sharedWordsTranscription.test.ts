import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../../functions/api/_lib/auth', () => ({ requireUser: vi.fn(async () => ({ userId: 'owner' })) }));
import { onRequestPost } from '../../../functions/api/oracle/authoring/process';
import type { AuthoringEnv } from '../../../functions/api/oracle/authoring/_shared';
import { addTranscript, createSession } from '../../../lib/oracle/authoring/workflow';

const audioBase64 = btoa('audio');
const call = (body: unknown) => onRequestPost({ request: new Request('https://mandalacodes.com/api/oracle/authoring/process', { method: 'POST', headers: { Origin: 'capacitor://localhost' }, body: JSON.stringify(body) }), env: { GROQ_API_KEY: 'fixture' } as AuthoringEnv });

afterEach(() => vi.unstubAllGlobals());
beforeEach(() => vi.clearAllMocks());

describe('hosted oracle transcription uses the shared word library', () => {
  it('primes the speech model with library words and returns fixed text beside the raw words', async () => {
    const upstream = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: 'Jean keys.', segments: [{ start: 0, end: 1, text: 'Jean keys.' }, { start: 1, end: 2, text: 'Nothing to fix.' }], words: [] }), { headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', upstream);
    const response = await call({ operation: 'transcribe', audioBase64, mimeType: 'audio/webm', durationMs: 3000, context: { cardNumber: 2, sectionTitles: ['The drive'], glossary: [] } });
    expect(response.status).toBe(200);
    const sent = (upstream.mock.calls[0][1].body as FormData).get('prompt') as string;
    expect(sent).toContain('Siddhi');
    expect(sent).toContain('Card 2.');
    expect(sent).toContain('The drive');
    expect(sent.length).toBeLessThanOrEqual(1000);
    const { segments } = await response.json() as { segments: Array<{ text: string; corrected?: string }> };
    expect(segments[0]).toMatchObject({ text: 'Jean keys.', corrected: 'Gene Keys.' });
    expect(segments[1].corrected).toBeUndefined();
  });

  it('keeps the raw words as raw and the fixed words as corrected when the session stores them', () => {
    const base = createSession({ cardNumber: 2, revision: 'r', hash: 'h', markdown: 'x', sections: [] } as never);
    const withCapture = { ...base, captures: [{ id: 'c1', status: 'complete', durationMs: 3000 }] } as never;
    const next = addTranscript(withCapture, 'c1', [{ startMs: 0, endMs: 1000, text: 'Jean keys.', corrected: 'Gene Keys.', sectionId: null, timing: 'provider' }], 'groq');
    expect(next.transcript[0]).toMatchObject({ raw: 'Jean keys.', corrected: 'Gene Keys.' });
    const plain = addTranscript(withCapture, 'c1', [{ startMs: 0, endMs: 1000, text: 'Hello.', sectionId: null, timing: 'provider' }], 'groq');
    expect(plain.transcript[0]).toMatchObject({ raw: 'Hello.', corrected: 'Hello.' });
  });
});

import { describe, expect, it, vi } from 'vitest';
import { quickTranscribe, workersAiTranscription } from '../../functions/api/_lib/quickTranscription';

const audio = new Uint8Array([1, 2]).buffer;
const groqReply = (body: unknown) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));

describe('quick transcription', () => {
  it('asks Groq for sentence and word timings when timings are wanted, and keeps them', async () => {
    const fetcher = groqReply({
      text: ' The crack records every person. ', duration: 3.2,
      segments: [{ start: 0, end: 3.2, text: ' The crack records every person.' }],
      words: [{ word: 'The', start: 0, end: 0.2 }, { word: 'crack', start: 0.2, end: 0.6 }, { word: 'late', start: 9, end: 9.5 }],
    });
    const result = await quickTranscribe({ GROQ_API_KEY: 'k' }, audio, 'audio/mp4', { prompt: 'tea bowl', timings: true, fetcher });
    const form = fetcher.mock.calls[0][1].body as FormData;
    expect(form.get('response_format')).toBe('verbose_json');
    expect(form.getAll('timestamp_granularities[]')).toEqual(['segment', 'word']);
    expect(form.get('prompt')).toBe('tea bowl');
    expect(result).toMatchObject({ provider: 'groq', text: 'The crack records every person.', duration: 3.2 });
    expect(result.segments).toEqual([{ start: 0, end: 3.2, text: 'The crack records every person.', words: [{ word: 'The', start: 0, end: 0.2 }, { word: 'crack', start: 0.2, end: 0.6 }] }]);
  });

  it('keeps the plain json request and returns no segments when timings are not wanted', async () => {
    const fetcher = groqReply({ text: 'Breath.', segments: [{ start: 0, end: 1, text: 'Breath.' }] });
    const result = await quickTranscribe({ GROQ_API_KEY: 'k' }, audio, 'audio/webm', { prompt: 'p', fetcher });
    const form = fetcher.mock.calls[0][1].body as FormData;
    expect(form.get('response_format')).toBe('json');
    expect(form.getAll('timestamp_granularities[]')).toEqual([]);
    expect(result.segments).toBeUndefined();
  });

  it('reads the segments Workers AI returns, with their own words', async () => {
    const run = vi.fn().mockResolvedValue({ text: 'One. Two.', segments: [{ start: 0, end: 1, text: ' One.', words: [{ word: 'One.', start: 0, end: 0.8 }] }, { start: 1.1, end: 2, text: ' Two.' }, { start: 'bad', text: 'x' }] });
    const result = await quickTranscribe({ AI: { run } as never }, audio, 'audio/mp4', { prompt: 'p', timings: true });
    expect(result.provider).toBe('cloudflare');
    expect(result.segments).toEqual([{ start: 0, end: 1, text: 'One.', words: [{ word: 'One.', start: 0, end: 0.8 }] }, { start: 1.1, end: 2, text: 'Two.' }]);
  });

  it('fixes known mishearings inside each segment as well as the whole text', async () => {
    const fetcher = groqReply({ text: 'I was reading jean keys.', segments: [{ start: 0, end: 2, text: 'I was reading jean keys.' }] });
    const result = await quickTranscribe({ GROQ_API_KEY: 'k' }, audio, 'audio/mp4', { prompt: 'p', timings: true, fetcher });
    expect(result.text).toBe('I was reading Gene Keys.');
    expect(result.rawText).toBe('I was reading jean keys.');
    expect(result.segments?.[0].text).toBe('I was reading Gene Keys.');
  });

  it('shares the Workers AI fallback with a caller that reads the reply itself, untouched, and falls to the legacy model', async () => {
    const reply = { text: ' One. ', segments: [{ start: 0, end: 1, text: ' One.' }] };
    const run = vi.fn().mockResolvedValue(reply);
    expect(await workersAiTranscription({ run } as never, new Uint8Array([1, 2]), { prompt: 'p' })).toEqual({ model: '@cf/openai/whisper-large-v3-turbo', raw: reply });
    expect(run.mock.calls[0][1]).toEqual({ audio: 'AQI=', initial_prompt: 'p' });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const legacy = vi.fn().mockResolvedValueOnce({ text: ' ' }).mockResolvedValueOnce({ text: 'Two.' });
    expect(await workersAiTranscription({ run: legacy } as never, audio, { prompt: 'p' })).toEqual({ model: '@cf/openai/whisper', raw: { text: 'Two.' } });
    vi.restoreAllMocks();
  });
});

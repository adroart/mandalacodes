import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../../functions/api/_lib/auth', () => ({ requireUser: vi.fn(async () => ({ userId: 'owner' })) }));
import { onRequestPost } from '../../../functions/api/oracle/authoring/process';
import { cardSections } from '../../../lib/oracle/authoring/cardSections';
import { manuscriptSource } from '../../../lib/oracle/authoring/source';
import { buildWordsPrompt, estimateTokens } from '../../../shared/words';
import { ORACLE_WORDS_PROFILE } from '../../../shared/oracleWords';

afterEach(() => vi.unstubAllGlobals());

async function sentPrompt(context: Record<string, unknown>) {
  const upstream = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: 'A spoken thought.' }), { headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('fetch', upstream);
  const response = await onRequestPost({
    request: new Request('https://mandalacodes.com/api/oracle/authoring/process', {
      method: 'POST', headers: { Origin: 'capacitor://localhost' },
      body: JSON.stringify({ operation: 'transcribe', mimeType: 'audio/mp4;codecs=mp4a.40.2', durationMs: 1000, audioBase64: 'AQID', context }),
    }),
    env: { GROQ_API_KEY: 'fixture' },
  });
  expect(response.status).toBe(200);
  const form = upstream.mock.calls[0][1].body as FormData;
  return form.get('prompt') as string;
}

describe('complete hosted transcription prompt budget', () => {
  it('fits a real full-card context below the speech provider limit without cutting the shared vocabulary', async () => {
    const markdown = readFileSync(new URL('../../../oracle/cards/01.md', import.meta.url), 'utf8');
    const source = await manuscriptSource(1, 'fixture', markdown);
    const prompt = await sentPrompt({
      cardNumber: 1, sectionTitles: cardSections(source).map(section => section.title),
      glossary: ['I Ching', 'Gene Keys', 'Human Design', 'hexagram', 'trigram', 'codon ring', 'Shadow', 'Gift', 'Siddhi'],
    });
    expect(estimateTokens(prompt)).toBeLessThanOrEqual(160);
    expect(prompt).toContain('Card 1.');
    expect(prompt).toContain(buildWordsPrompt(undefined, { ...ORACLE_WORDS_PROFILE, intro: '', budget: 90 }).prompt);
  });

  it('drops oversized context pieces whole while retaining useful context that fits', async () => {
    const oversized = '漢字'.repeat(500);
    const prompt = await sentPrompt({ cardNumber: 1, glossary: [oversized], sectionTitles: ['The drive'] });
    expect(estimateTokens(prompt)).toBeLessThanOrEqual(160);
    expect(prompt).not.toContain('漢');
    expect(prompt).toContain('The drive');
  });
});

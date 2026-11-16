import { describe, expect, it, vi } from 'vitest';
import { fetchBetterTranscripts, mergeBetterTranscript, resolveBetterTake, type BetterTranscript, type TakeTranscript } from '../../../src/mobile/authoring/betterTake';

const HASH = 'a'.repeat(64);
const draft = { text: 'I trust the slow way. It hold.', provider: 'groq' };
const take = (extra: Partial<TakeTranscript> = {}): TakeTranscript => ({ draft, proposedWords: draft.text, editedByHand: false, uncertainWords: [], ...extra });
const better = (extra: Partial<BetterTranscript> = {}): BetterTranscript => ({
  hash: HASH, resultHash: 'c'.repeat(64), engine: 'ar-create', engineVersion: '2.1', receivedAt: '2026-11-02T00:00:00.000Z',
  text: 'I trust the slow way. It holds.', segments: [{ startMs: 0, endMs: 2600, text: 'I trust the slow way. It holds.' }],
  words: [{ text: 'I', startMs: 0, endMs: 200, probability: 0.99 }, { text: 'trust', startMs: 200, endMs: 600, probability: 0.41 }, { text: 'holds.', startMs: 2000, endMs: 2600, probability: 0.5 }, { text: 'trust', startMs: 2700, endMs: 2900, probability: 0.3 }],
  ...extra,
});

describe('mergeBetterTranscript', () => {
  it('an unedited take takes the better words, keeps its draft, and flags the doubtful words', () => {
    const current = take();
    const merged = mergeBetterTranscript(current, better());
    expect(merged.outcome).toBe('applied');
    expect(merged.take.proposedWords).toBe('I trust the slow way. It holds.');
    expect(merged.take.draft).toEqual(draft);
    expect(merged.take.uncertainWords).toEqual(['trust', 'holds.']);
    expect(merged.take.words).toHaveLength(4);
    expect(merged.take.better).toMatchObject({ state: 'applied', resultHash: 'c'.repeat(64), engine: 'ar-create' });
    expect(current).toEqual(take());
  });

  it('an already merged take is unchanged by the same result', () => {
    const once = mergeBetterTranscript(take(), better()).take;
    const twice = mergeBetterTranscript(once, better());
    expect(twice.outcome).toBe('unchanged');
    expect(twice.take).toBe(once);
  });

  it('an edited take is left exactly as it is and a comparison is returned', () => {
    const current = take({ proposedWords: 'I trust the slow road. It hold.', editedByHand: true, uncertainWords: ['road'] });
    const merged = mergeBetterTranscript(current, better());
    expect(merged.outcome).toBe('compare');
    expect(merged.take).toBe(current);
    if (merged.outcome !== 'compare') return;
    expect(merged.comparison.choices).toEqual(['accept', 'keep', 'defer']);
    expect(merged.comparison.changes.length).toBeGreaterThan(0);
    expect(merged.comparison.base).toContain('slow road');
    expect(merged.comparison.suggested).toContain('slow way');
  });

  it('an edit that already says what the Mac heard is recorded as settled, words unchanged', () => {
    const current = take({ proposedWords: 'I trust the slow way. It holds.', editedByHand: true });
    const merged = mergeBetterTranscript(current, better());
    expect(merged.outcome).toBe('unchanged');
    expect(merged.take.proposedWords).toBe(current.proposedWords);
    expect(merged.take.better?.state).toBe('resolved');
  });

  it('a newer result after a settled one is compared, never applied', () => {
    const settled = mergeBetterTranscript(take({ proposedWords: 'I trust the slow way. It holds.', editedByHand: true }), better()).take;
    const merged = mergeBetterTranscript(settled, better({ resultHash: 'd'.repeat(64), text: 'I trust a slow way. It holds.' }));
    expect(merged.outcome).toBe('compare');
    expect(merged.take).toBe(settled);
  });

  it('resolving a comparison: decide later keeps the take, accepting every change takes the Mac words', () => {
    const current = take({ proposedWords: 'I trust the slow road. It hold.', editedByHand: true });
    const merged = mergeBetterTranscript(current, better());
    if (merged.outcome !== 'compare') throw Error('expected a comparison');
    const later = resolveBetterTake(current, better(), Object.fromEntries(merged.comparison.changes.map((change) => [change.id, 'defer'])), '2026-11-03T00:00:00.000Z');
    expect(later).toEqual({ ok: true, done: false, take: current });
    const accepted = resolveBetterTake(current, better(), Object.fromEntries(merged.comparison.changes.map((change) => [change.id, 'accept'])), '2026-11-03T00:00:00.000Z');
    expect(accepted).toMatchObject({ ok: true, done: true, take: { proposedWords: 'I trust the slow way. It holds.', editedByHand: true, draft, better: { state: 'resolved' } } });
    expect(resolveBetterTake(take(), better(), {}, 'now')).toMatchObject({ ok: false });
  });
});

describe('fetchBetterTranscripts', () => {
  it('asks in batches of at most 50, keeps only valid results for the hashes asked, and follows `more`', async () => {
    const hashes = Array.from({ length: 60 }, (_, i) => i.toString(16).padStart(64, '0'));
    let deferred = false;
    const transport = vi.fn(async (_path: string, init?: RequestInit) => {
      const body = JSON.parse(String(init!.body));
      expect(body.operation).toBe('better-get');
      expect(body.hashes.length).toBeLessThanOrEqual(50);
      const results = body.hashes.filter((hash: string) => hash.endsWith('1') || hash.endsWith('2')).map((hash: string) => ({ ...better({ hash }) }));
      if (!deferred && body.hashes.includes(hashes[2])) { deferred = true; return Response.json({ results: results.filter((r: any) => r.hash !== hashes[2]), skipped: [], more: [hashes[2]] }); }
      return Response.json({ results: [...results, { ...better({ hash: 'f'.repeat(64) }) }, { hash: hashes[3], text: '' }], skipped: [], more: [] });
    });
    const found = await fetchBetterTranscripts([...hashes, 'not-a-hash', hashes[0]], transport);
    expect(transport.mock.calls.length).toBe(2);expect(found.has(hashes[2])).toBe(true);
    expect([...found.keys()].sort()).toEqual(hashes.filter((hash) => hash.endsWith('1') || hash.endsWith('2')).sort());
    expect(found.has('f'.repeat(64))).toBe(false);
    expect(found.get(hashes[1])?.words[1].probability).toBe(0.41);
  });

  it('says plainly when the account cannot be reached, and sends nothing for no hashes', async () => {
    await expect(fetchBetterTranscripts([HASH], async () => new Response('', { status: 401 }))).rejects.toThrow('Sign in');
    await expect(fetchBetterTranscripts([HASH], async () => Response.json({ error: 'Private storage is not configured.' }, { status: 503 }))).rejects.toThrow('not configured');
    const transport = vi.fn();
    expect((await fetchBetterTranscripts([], transport)).size).toBe(0);
    expect(transport).not.toHaveBeenCalled();
  });
});

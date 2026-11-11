import { describe, expect, it } from 'vitest';
import { transcriptDoubts } from '../../functions/api/_lib/transcriptDoubts';

describe('transcript doubts', () => {
  it('finds the words two transcriptions heard differently, as exact slices of the kept text', () => {
    const kept = 'I went back to the potter in Yingj this morning. The ones I tried to hide.';
    const second = 'I went back to the potter in Yingge this morning. The ones I try to hide.';
    const doubts = transcriptDoubts(kept, second);
    expect(doubts).toEqual([{ heard: 'Yingj', alt: 'Yingge', at: kept.indexOf('Yingj') }, { heard: 'tried', alt: 'try', at: kept.indexOf('tried') }]);
    for (const d of doubts) expect(kept.slice(d.at, d.at + d.heard.length)).toBe(d.heard);
  });

  it('ignores case and punctuation, and words only the second heard', () => {
    expect(transcriptDoubts('Then he poured tea. And I understood.', 'then he poured tea and, I understood')).toEqual([]);
    expect(transcriptDoubts('He said three weeks.', 'He said about three weeks.')).toEqual([]);
  });

  it('keeps a word the second missed as a doubt with nothing heard instead', () => {
    expect(transcriptDoubts('The mend was not hiding anything.', 'The mend was hiding anything.')).toEqual([{ heard: 'not', alt: '', at: 13 }]);
  });

  it('skips long misaligned runs and empty input', () => {
    expect(transcriptDoubts('one two three four five six seven eight', 'alpha beta gamma delta epsilon zeta eta theta')).toEqual([]);
    expect(transcriptDoubts('', 'something')).toEqual([]);
  });

  it('lets the caller drop a difference its own corrections already settle, seeing both runs with their neighbours', () => {
    const seen: [string, string][] = [];
    const same = (kept: string, second: string) => { seen.push([kept, second]); return kept.replace('Jean keys', 'Gene Keys') === second; };
    expect(transcriptDoubts('Reading Jean keys tonight. The potter in Yingj.', 'Reading Gene Keys tonight. The potter in Yingge.', { same })).toEqual([{ heard: 'Yingj', alt: 'Yingge', at: 41 }]);
    expect(seen[0]).toEqual(['Reading Jean keys tonight.', 'Reading Gene Keys tonight.']);
    expect(transcriptDoubts('The potter in Yingj.', 'The potter in Yingge.', { same: () => false, context: 0 })).toEqual([{ heard: 'Yingj', alt: 'Yingge', at: 14 }]);
  });
});

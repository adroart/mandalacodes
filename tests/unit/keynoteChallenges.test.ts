import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { KEYNOTE_CHALLENGES, splitKeynotes } from '../../lib/oracle/keynoteChallenges';

const cardsDir = join(__dirname, '../../oracle/cards');
const keynotesByCard = readdirSync(cardsDir)
  .filter((name) => /^\d{2}\.md$/.test(name))
  .map((name) => {
    const line = readFileSync(join(cardsDir, name), 'utf8').match(/^_Keywords:_\s*(.+)$/m)?.[1] ?? '';
    return line.split('·').map((s) => s.trim()).filter(Boolean);
  });

describe('keynote challenges', () => {
  it('lists only phrases that are on a card', () => {
    const all = new Set(keynotesByCard.flat());
    expect([...KEYNOTE_CHALLENGES].filter((phrase) => !all.has(phrase))).toEqual([]);
  });

  it('leaves at least four lived-well keynotes on every card', () => {
    for (const keynotes of keynotesByCard) expect(splitKeynotes(keynotes).gifts.length).toBeGreaterThanOrEqual(4);
  });

  it('keeps card order inside each half', () => {
    expect(splitKeynotes(['A', 'Feeling Stuck', 'B', 'Never Enough'])).toEqual({ gifts: ['A', 'B'], challenges: ['Feeling Stuck', 'Never Enough'] });
  });
});

import { cp, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { loadCorpus, loadCorpusFromDirectory } from '../../mcp/oracle-server/src/corpus';

const authoredCards = resolve('oracle/cards');
const temporaryDirectories: string[] = [];

async function copiedCards(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'mandala-oracle-corpus-'));
  temporaryDirectories.push(root);
  const cards = join(root, 'cards');
  await cp(authoredCards, cards, { recursive: true });
  return cards;
}

async function replaceFrontmatterNumber(file: string, number: number): Promise<void> {
  const raw = await readFile(file, 'utf8');
  await writeFile(file, raw.replace(/^number:\s+\d+$/m, `number: ${number}`), 'utf8');
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

describe('Markdown-only Oracle corpus', () => {
  it('loads exactly 64 numerically ordered canonical cards from Markdown', async () => {
    const cards = await loadCorpus();

    expect(cards).toHaveLength(64);
    expect(cards.map(card => card.number)).toEqual(Array.from({ length: 64 }, (_, i) => i + 1));
    expect(new Set(cards.map(card => card.number))).toHaveLength(64);
  });

  it('maps all six Card 3 lenses, moving lines, and linked artwork without an invocation merge', async () => {
    const cards = await loadCorpus();
    const card = cards[2];

    expect(card.number).toBe(3);
    expect(card.card_name).toBe('Messengers of the Infinite');
    expect(card.keywords).toContain('New Beginnings');
    // Deliberately mid-paragraph prose fixtures (see cardMarkdown.test.ts) so an
    // editorial pass on opening sentences cannot break the parser contract.
    expect(card.glance.reading).toContain('Something new is already alive in you and it does not have a shape yet');
    expect(card.glance.invocation).toBeUndefined();
    expect(card.iching.reading).toContain('does not yet have ground to stand on');
    expect(card.iching.lines).toHaveLength(6);
    expect(card.iching.lines[0]?.becomes).toEqual({ hexagram: 8, name: 'Holding Together' });
    expect(card.iching.upper_trigram).toMatchObject({ symbol: '☵', name: "Water (K'an)" });
    expect(card.iching.lower_trigram).toMatchObject({ symbol: '☳', name: 'Thunder (Chen)' });
    expect(card.reference?.binary).toBe('100010');
    expect(card.gene_keys.gift).toContain('making something new out of what is changing');
    expect(card.human_design.gate).toContain('a shape that can last');
    expect(card.body.physiology).toContain('where a beginning was once made the hard way');
    expect(card.relations.codon_ring.name).toBe('Ring of Life and Death');
    expect(card.relations.unity_line).toContain(
      'the whole arc of first arrival, the birth that comes in a storm and the long apprenticeship',
    );
    expect(card.artworks).toContainEqual(expect.objectContaining({ id: 'UL-124', title: 'Messengers of the Infinite - 3' }));
  });

  it('honours the Markdown-authoritative self-pair for Card 29', async () => {
    const cards = await loadCorpus();
    expect(cards[28]?.relations.pair.number).toBe(29);
  });

  it('derives one unique six-line binary for every card from the fixed trigram table', async () => {
    const cards = await loadCorpus();
    const binaries = cards.map(card => card.reference?.binary);

    expect(binaries.every(binary => typeof binary === 'string' && /^[01]{6}$/.test(binary))).toBe(true);
    expect(new Set(binaries)).toHaveLength(64);
  });

  it('fails closed if a future trigram edit duplicates another card binary', async () => {
    const cardsDir = await copiedCards();
    const file = join(cardsDir, '64.md');
    const raw = await readFile(file, 'utf8');
    await writeFile(
      file,
      raw.replace(/trigrams:\n  upper: Fire\n  lower: Water/, 'trigrams:\n  upper: Water\n  lower: Fire'),
      'utf8',
    );

    await expect(loadCorpusFromDirectory(cardsDir, new Map())).rejects.toThrow(
      /64\.md.*duplicate binary 101010.*63\.md/i,
    );
  });

  it('fails closed when a required numbered file is missing', async () => {
    const cardsDir = await copiedCards();
    await unlink(join(cardsDir, '17.md'));

    await expect(loadCorpusFromDirectory(cardsDir, new Map())).rejects.toThrow(
      /17\.md.*(?:missing|ENOENT)/i,
    );
  });

  it('fails closed on filename/frontmatter mismatch and duplicate numbers', async () => {
    const cardsDir = await copiedCards();
    await replaceFrontmatterNumber(join(cardsDir, '02.md'), 1);

    const message = await loadCorpusFromDirectory(cardsDir, new Map()).then(
      () => '',
      error => (error as Error).message,
    );
    expect(message).toMatch(/02\.md: frontmatter number 1 does not match filename number 2/i);
    expect(message).toMatch(/02\.md: duplicate frontmatter number 1/i);
  });

  it('fails closed on an out-of-range number', async () => {
    const cardsDir = await copiedCards();
    await replaceFrontmatterNumber(join(cardsDir, '64.md'), 65);

    await expect(loadCorpusFromDirectory(cardsDir, new Map())).rejects.toThrow(
      /64\.md.*65.*outside.*1.*64/i,
    );
  });

  it('fails closed on an unknown editorial status key', async () => {
    const cardsDir = await copiedCards();
    const file = join(cardsDir, '23.md');
    const raw = await readFile(file, 'utf8');
    await writeFile(file, raw.replace(
      '  relations: scaffold\n',
      '  relations: scaffold\n  editorial_note: scaffold\n',
    ), 'utf8');

    await expect(loadCorpusFromDirectory(cardsDir, new Map())).rejects.toThrow(
      /23\.md.*unknown status keys.*editorial_note/i,
    );
  });

  it('fails closed when the relations editorial status is missing', async () => {
    const cardsDir = await copiedCards();
    const file = join(cardsDir, '24.md');
    const raw = await readFile(file, 'utf8');
    await writeFile(file, raw.replace('  relations: scaffold\n', ''), 'utf8');

    await expect(loadCorpusFromDirectory(cardsDir, new Map())).rejects.toThrow(
      /24\.md.*status\.relations.*missing/i,
    );
  });

  it('fails closed on an invalid relations editorial status', async () => {
    const cardsDir = await copiedCards();
    const file = join(cardsDir, '25.md');
    const raw = await readFile(file, 'utf8');
    await writeFile(file, raw.replace('  relations: scaffold\n', '  relations: done\n'), 'utf8');

    await expect(loadCorpusFromDirectory(cardsDir, new Map())).rejects.toThrow(
      /25\.md.*status\.relations.*done.*scaffold.*in-progress.*final/i,
    );
  });

  it('fails closed when any required authored lens is missing', async () => {
    const cardsDir = await copiedCards();
    const file = join(cardsDir, '12.md');
    const raw = await readFile(file, 'utf8');
    const withoutBody = raw.replace(/\n## BODY\n[\s\S]*?(?=\n## RELATIONS\n)/, '\n');
    expect(withoutBody).not.toBe(raw);
    await writeFile(file, withoutBody, 'utf8');

    await expect(loadCorpusFromDirectory(cardsDir, new Map())).rejects.toThrow(
      new RegExp(`${basename(file)}.*required lens BODY`, 'i'),
    );
  });

  it('fails closed when a required top-level lens is duplicated', async () => {
    const cardsDir = await copiedCards();
    const file = join(cardsDir, '12.md');
    const raw = await readFile(file, 'utf8');
    await writeFile(file, raw.replace('\n## ICHING\n', '\n## ICHING\n\n## ICHING\n'), 'utf8');

    await expect(loadCorpusFromDirectory(cardsDir, new Map())).rejects.toThrow(
      /12\.md: duplicate top-level section ICHING/i,
    );
  });
});

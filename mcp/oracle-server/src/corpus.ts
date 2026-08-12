/**
 * Canonical Oracle corpus loader.
 *
 * Authored card prose comes exclusively from oracle/cards/01.md through 64.md.
 * Missing or malformed manuscripts fail closed; aggregate, synthesis, section,
 * archive, and generated JSON never refill prose. Artwork metadata is linked
 * from data/mockData.ts. Live invocations are a separate versioned D1/private
 * R2 publication layer and are deliberately not merged here.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { FULL_ARCHIVE } from '../../../data/mockData.ts';
import {
  parseCardMarkdown,
  type ParsedCard,
} from '../../../lib/oracle/card-markdown.ts';
import { compileParsedCard } from '../../../lib/oracle/compiler.ts';
import { parseLegacyStatusMap } from '../../../lib/oracle/manuscript-schema.ts';
import type { CanonicalCard, MovingLine, CardArtwork } from '../../../lib/oracle/types.ts';
import { ORACLE_DIR, pad2 } from './paths.ts';

export type { CanonicalCard, MovingLine, CardArtwork };

type ArtworkMap = ReadonlyMap<number, readonly CardArtwork[]>;

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function artworkMapFromArchive(): Map<number, CardArtwork[]> {
  const artworks = new Map<number, CardArtwork[]>();

  for (const artwork of FULL_ARCHIVE) {
    if (artwork.series !== 'Universal Language') continue;

    let number = typeof artwork.cardNumber === 'number' ? artwork.cardNumber : Number.NaN;
    if (!Number.isFinite(number)) {
      const match = String(artwork.title ?? '').match(/-\s*(\d{1,2})\s*$/) ??
        String(artwork.description ?? '').match(/Number\s+(\d{1,2})/i);
      if (match) number = Number(match[1]);
    }
    if (!Number.isInteger(number) || number < 1 || number > 64) continue;

    const linked: CardArtwork = {
      id: artwork.id,
      title: artwork.title,
      coverImage: artwork.coverImage,
      year: artwork.year,
      availability: artwork.availability,
    };
    artworks.set(number, [...(artworks.get(number) ?? []), linked]);
  }

  return artworks;
}

function validateCard(parsed: ParsedCard, expected: number, file: string): string[] {
  const issues: string[] = [];
  const number = parsed.frontmatter.number;

  if (!Number.isInteger(number) || typeof number !== 'number') {
    issues.push(`${file}: frontmatter number must be an integer`);
  } else {
    if (number < 1 || number > 64) {
      issues.push(`${file}: frontmatter number ${number} is outside the allowed range 1-64`);
    }
    if (number !== expected) {
      issues.push(`${file}: frontmatter number ${number} does not match filename number ${expected}`);
    }
  }

  if (!asString(parsed.frontmatter.card_name)) {
    issues.push(`${file}: card_name is required`);
  }

  try {
    parseLegacyStatusMap(parsed.frontmatter.status, file);
  } catch (error) {
    issues.push((error as Error).message);
  }

  for (const lens of ['CODE', 'ICHING', 'KEYS', 'DESIGN', 'BODY', 'RELATIONS']) {
    if (!parsed.sections[lens]) issues.push(`${file}: required lens ${lens} is missing`);
  }

  return issues;
}

/**
 * Build from an explicit cards directory. Exported so fail-closed validation
 * can be tested against disposable fixtures without changing authored cards.
 */
export async function loadCorpusFromDirectory(
  cardsDir: string,
  artworkMap: ArtworkMap = new Map(),
): Promise<CanonicalCard[]> {
  const parsedCards: Array<{ expected: number; file: string; parsed: ParsedCard }> = [];
  const issues: string[] = [];

  for (let expected = 1; expected <= 64; expected += 1) {
    const file = resolve(cardsDir, `${pad2(expected)}.md`);
    let raw: string;
    try {
      raw = await readFile(file, 'utf8');
    } catch (error) {
      issues.push(`${file}: missing required Markdown file (${(error as Error).message})`);
      continue;
    }

    try {
      const parsed = parseCardMarkdown(raw, file);
      issues.push(...validateCard(parsed, expected, file));
      parsedCards.push({ expected, file, parsed });
    } catch (error) {
      issues.push((error as Error).message);
    }
  }

  const firstFileByNumber = new Map<number, string>();
  for (const { file, parsed } of parsedCards) {
    const number = parsed.frontmatter.number;
    if (typeof number !== 'number' || !Number.isInteger(number)) continue;
    const first = firstFileByNumber.get(number);
    if (first) issues.push(`${file}: duplicate frontmatter number ${number} (also in ${first})`);
    else firstFileByNumber.set(number, file);
  }

  if (issues.length > 0) {
    throw new Error(`Oracle Markdown corpus validation failed:\n- ${issues.join('\n- ')}`);
  }

  const cards = parsedCards.map(({ expected, file, parsed }) =>
    compileParsedCard(parsed, file, artworkMap.get(expected) ?? []));
  const firstFileByBinary = new Map<string, string>();
  const binaryIssues: string[] = [];

  cards.forEach((card, index) => {
    const file = parsedCards[index].file;
    const binary = card.reference?.binary;
    if (typeof binary !== 'string' || !/^[01]{6}$/.test(binary)) {
      binaryIssues.push(`${file}: reference.binary must be exactly 6 binary digits`);
      return;
    }

    const first = firstFileByBinary.get(binary);
    if (first) binaryIssues.push(`${file}: duplicate binary ${binary} (also in ${first})`);
    else firstFileByBinary.set(binary, file);
  });

  if (binaryIssues.length > 0) {
    throw new Error(`Oracle Markdown corpus binary validation failed:\n- ${binaryIssues.join('\n- ')}`);
  }

  return cards;
}

let cache: Promise<CanonicalCard[]> | undefined;

export function loadCorpus(): Promise<CanonicalCard[]> {
  cache ??= loadCorpusFromDirectory(resolve(ORACLE_DIR, 'cards'), artworkMapFromArchive());
  return cache;
}

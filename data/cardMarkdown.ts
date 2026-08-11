import {
  mapIching,
  parseCardMarkdown,
  type ParsedCard,
} from '../lib/oracle/card-markdown';

export * from '../lib/oracle/card-markdown';

const cardMarkdownModules = import.meta.glob([
  '../oracle/cards/0[1-9].md',
  '../oracle/cards/[1-5][0-9].md',
  '../oracle/cards/6[0-4].md',
], {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>;

const parsedCardCache = new Map<number, ParsedCard | undefined>();
const lineTextCache = new Map<number, string[]>();

function pad2(number: number): string {
  return number < 10 ? `0${number}` : String(number);
}

function loaderFor(cardNumber: number): (() => Promise<string>) | undefined {
  return cardMarkdownModules[`../oracle/cards/${pad2(cardNumber)}.md`];
}

function primeLineTextCache(cardNumber: number, parsed: ParsedCard): void {
  const iching = mapIching(parsed);
  if (!iching || !Array.isArray(iching.lines)) return;

  const texts: string[] = ['', '', '', '', '', ''];
  for (const line of iching.lines) {
    if (line.line >= 1 && line.line <= 6) texts[line.line - 1] = line.reading ?? '';
  }
  lineTextCache.set(cardNumber, texts);
}

/** True when an `oracle/cards/NN.md` manuscript exists for this card. */
export function hasCardMarkdown(cardNumber: number): boolean {
  return Boolean(loaderFor(cardNumber));
}

export async function getParsedCard(cardNumber: number): Promise<ParsedCard | undefined> {
  if (parsedCardCache.has(cardNumber)) {
    const cached = parsedCardCache.get(cardNumber);
    if (cached && !lineTextCache.has(cardNumber)) primeLineTextCache(cardNumber, cached);
    return cached;
  }

  const loader = loaderFor(cardNumber);
  if (!loader) {
    parsedCardCache.set(cardNumber, undefined);
    return undefined;
  }

  const raw = await loader();
  const context = `oracle/cards/${pad2(cardNumber)}.md`;
  const parsed = parseCardMarkdown(raw, context);
  parsedCardCache.set(cardNumber, parsed);
  primeLineTextCache(cardNumber, parsed);
  return parsed;
}

/** Synchronous moving-line reading from the already-loaded Markdown card. */
export function getMarkdownLineText(cardNumber: number, position: number): string {
  if (position < 1 || position > 6) return '';
  return lineTextCache.get(cardNumber)?.[position - 1] ?? '';
}

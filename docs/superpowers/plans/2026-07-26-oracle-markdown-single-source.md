# Oracle Markdown Single-Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `oracle/cards/01.md` through `64.md` the sole source of authored card prose for the browser, generated REST/search artifacts, hosted Oracle MCP, and local Oracle MCP.

**Architecture:** Extract the existing Markdown parser into a runtime-neutral library, add a normalized Relations mapper, and make both the Vite browser adapter and Node corpus loader consume that library. Keep artwork linkage and live invocation publication as separate linked data; remove all legacy prose fallbacks from runtime paths.

**Tech Stack:** TypeScript, Vite `import.meta.glob`, Node `fs`, Vitest, Playwright, Cloudflare Pages Functions, MCP stdio/HTTP.

---

## File structure

- Create `lib/oracle/card-markdown.ts`: pure parser and six-lens mappers with no Vite or filesystem dependency.
- Modify `data/cardMarkdown.ts`: browser-only glob/cache adapter that re-exports pure mappers.
- Modify `data/synthesisData.ts`: use Markdown Relations and remove relation-JSON runtime loading.
- Modify `lib/oracle/types.ts`: one normalized `OracleRelations` contract shared by browser, corpus, REST, and MCP.
- Modify `mcp/oracle-server/src/corpus.ts`: read and validate all 64 Markdown manuscripts and build `CanonicalCard` objects.
- Add focused tests under `tests/unit/` and extend the MCP smoke test.
- Regenerate `data/oracle-corpus.json` and `data/oracle-search-index.json`; these remain deployment artifacts, never authoring surfaces.

## Task 1: Runtime-neutral Markdown parser

**Files:**

- Create: `lib/oracle/card-markdown.ts`
- Modify: `data/cardMarkdown.ts`
- Test: `tests/unit/cardMarkdown.test.ts`

- [x] **Step 1: Write failing parser tests**

Read `oracle/cards/03.md` with Node and assert frontmatter, CODE keywords/reading, six moving lines, Keys, Design, and Body. Add fixtures proving inline maps/arrays, CRLF input, whole HTML-comment removal, and descriptive failure for missing frontmatter.

```ts
const raw = await readFile(resolve('oracle/cards/03.md'), 'utf8');
const card = parseCardMarkdown(raw, 'oracle/cards/03.md');
expect(card.frontmatter.number).toBe(3);
expect(mapCode(card)?.keywords).toContain('New Beginnings');
expect(mapIching(card)?.lines).toHaveLength(6);
expect(mapIching(card)?.lines[0]?.becomes.hexagram).toBe(8);
```

- [x] **Step 2: Verify red**

Run `npx vitest run tests/unit/cardMarkdown.test.ts --reporter=verbose`.

Expected: failure because `lib/oracle/card-markdown.ts` does not exist.

- [x] **Step 3: Extract the pure parser and mappers**

Move parser types/functions and `mapCode`, `mapKeys`, `mapDesign`, `mapIching`, and `mapBody` out of the Vite adapter. Give `parseCardMarkdown` an optional context argument and reject invalid frontmatter with that context.

```ts
export function parseCardMarkdown(raw: string, context = 'oracle card'): ParsedCard {
  const normalized = raw.replace(/\r\n?/g, '\n').replace(/<!--[\s\S]*?-->/g, '');
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error(`${context}: missing YAML frontmatter`);
  return { frontmatter: parseFrontmatter(match[1]), sections: parseBody(match[2]) };
}
```

Keep only `import.meta.glob`, async cache, and moving-line cache in `data/cardMarkdown.ts`.

- [x] **Step 4: Verify green**

Run:

```bash
npx vitest run tests/unit/cardMarkdown.test.ts --reporter=verbose
npm run typecheck
```

Expected: all parser tests pass and typecheck exits 0.

## Task 2: Markdown-native Relations

**Files:**

- Modify: `lib/oracle/card-markdown.ts`
- Modify: `lib/oracle/types.ts`
- Modify: `data/synthesisData.ts`
- Test: `tests/unit/oracleRelationsSource.test.ts`

- [x] **Step 1: Write failing Relations tests**

Cover Cards 1, 3, 28, 29, and 64. Assert normal pair, self-inverse, combined headings, Card 29's Markdown-authoritative pair `29`, Tarot/Immortals/Sky/Hebrew extraction, and absence of comment/sourcing text.

```ts
expect(mapRelations(card29)?.pair.number).toBe(29);
expect(mapRelations(card3)?.codon_ring.name).toBe('Ring of Life and Death');
expect(JSON.stringify(mapRelations(card64))).not.toContain('SOURCING LOG');
```

- [x] **Step 2: Verify red**

Run `npx vitest run tests/unit/oracleRelationsSource.test.ts --reporter=verbose`.

Expected: failure because `mapRelations` and the shared type do not exist.

- [x] **Step 3: Add the normalized shared contract**

Define `OracleRelations` in `lib/oracle/types.ts`. Make fields not represented in Markdown optional; never refill missing virtues, Hebrew path details, or legacy teaching prose from JSON.

```ts
export interface OracleRelations {
  number: number;
  card_name: string;
  status?: string;
  unity_line: string;
  pair: { number: number; card_name?: string; hexagram_name?: string; teaching: string };
  inverse: { number: number; is_self_inverse: boolean; teaching: string };
  programming_partner: { number: number; card_name?: string; teaching: string };
  codon_ring: { name: string; tarot?: string; siblings: number[]; teaching: string };
  tarot?: { card?: string; teaching: string };
  sky?: { value: string; type?: string; teaching: string };
  immortals?: { upper: { trigram?: string; name: string }; lower: { trigram?: string; name: string }; same_trigram: boolean; teaching: string };
  hebrew_letter?: { letter: string; teaching: string };
}
```

- [x] **Step 4: Implement `mapRelations`**

Use `relations_data` for structural values and RELATIONS headings/body for prose. Match heading variants by referenced `UL N`, not just a fixed prefix. Remove outer Markdown emphasis from the unity line.

- [x] **Step 5: Switch the browser merge**

In `data/synthesisData.ts`, set `merged.relations` from `mapRelations(md)` and delete the `relationsModules` glob/fallback. All 64 Markdown files exist, so missing/invalid Markdown is an error rather than permission to reintroduce JSON prose.

- [x] **Step 6: Verify green and rendered behavior**

Run:

```bash
npx vitest run tests/unit/cardMarkdown.test.ts tests/unit/oracleRelationsSource.test.ts --reporter=verbose
npm run typecheck
npx playwright test tests/oracle-visual-foundation.spec.ts
```

Inspect `/universal-language/3`, `/29`, and `/64` for Relations text and leaked Markdown/comment syntax.

## Task 3: Markdown-only canonical corpus

**Files:**

- Modify: `mcp/oracle-server/src/corpus.ts`
- Modify: `lib/oracle/types.ts`
- Test: `tests/unit/oracleCorpus.test.ts`

- [x] **Step 1: Write failing corpus tests**

Assert exactly 64 numerically ordered cards, distinctive Markdown prose for each lens of Card 3, all six moving lines, Card 29 pair `29`, and artwork linkage. Add failure cases for missing file, filename/frontmatter mismatch, duplicate/out-of-range number, and missing required lens.

- [x] **Step 2: Verify red**

Run `npx vitest run tests/unit/oracleCorpus.test.ts --reporter=verbose`.

Expected: legacy corpus text or validation failures do not match the required behavior.

- [x] **Step 3: Replace the legacy corpus merge**

Read `oracle/cards/01.md` through `64.md`, parse them with the shared library, and build `CanonicalCard` from the six mappers. Derive eight-trigram structural glyph/nature values from a fixed lookup. Keep only `data/mockData.ts` as linked artwork metadata.

```ts
for (let number = 1; number <= 64; number += 1) {
  const file = resolve(ORACLE_DIR, 'cards', `${pad2(number)}.md`);
  const parsed = parseCardMarkdown(await readFile(file, 'utf8'), file);
  validateCard(parsed, number, file);
  cards.push(buildCanonicalCard(parsed, artworkMap.get(number) ?? []));
}
```

Do not read `synthesis`, `sections`, `oracle_cards_complete`, or `generated` for authored prose. Invocation publication remains a separate D1/R2 system.

- [x] **Step 4: Verify green**

Run:

```bash
npx vitest run tests/unit/oracleCorpus.test.ts --reporter=verbose
npm --prefix mcp/oracle-server run typecheck
npm --prefix mcp/oracle-server run smoke
```

## Task 4: Deterministic generated artifacts

**Files:**

- Test: `tests/unit/oracleArtifacts.test.ts`
- Regenerate: `data/oracle-corpus.json`
- Regenerate: `data/oracle-search-index.json`

- [x] **Step 1: Write failing artifact tests**

Assert 64 unique numbers, Markdown-specific Card 3 phrases, Card 29 pair `29`, rich Relations retention in the corpus artifact, no sourcing comments, and deterministic serialization.

- [x] **Step 2: Verify red**

Run `npx vitest run tests/unit/oracleArtifacts.test.ts --reporter=verbose`.

- [x] **Step 3: Regenerate both artifacts**

Run:

```bash
npm run build:oracle-corpus
npm run build:search-index
```

Inspect the intentional first diff. Run both commands again and expect `git diff --exit-code -- data/oracle-corpus.json data/oracle-search-index.json` to exit 0 relative to the first generated state.

- [x] **Step 4: Verify green**

Run `npx vitest run tests/unit/oracleArtifacts.test.ts --reporter=verbose`.

## Task 5: REST and MCP parity

**Files:**

- Test: `tests/unit/oracleHostedApi.test.ts`
- Test: `tests/unit/oracleHostedTools.test.ts`
- Modify: `mcp/oracle-server/src/smoke.ts`

- [x] **Step 1: Write failing parity tests**

Assert REST card lookup, hosted MCP `get_card`, hosted search, local `loadCorpus`, and local `get_line` all expose the same Markdown-derived card data. Preserve all current public tool names and schemas.

- [x] **Step 2: Verify red, then make the smallest transport/type adjustments**

Run the focused tests. Change only transport types/adapters that fail under the richer shared Relations contract; do not add tools or voices.

- [x] **Step 3: Verify green**

Run:

```bash
npx vitest run tests/unit/oracleHostedApi.test.ts tests/unit/oracleHostedTools.test.ts --reporter=verbose
npm --prefix mcp/oracle-server run smoke
npm --prefix mcp/oracle-server run typecheck
```

## Task 6: Documentation and full verification

**Files:**

- Modify: `oracle/PARSER_SPEC.md`
- Modify: `mcp/oracle-server/README.md`
- Modify: `README.md`
- Modify: `scripts/build-oracle-corpus.ts`
- Modify: `scripts/build-search-index.ts`
- Modify: `mcp/oracle-server/src/corpus.ts`

- [x] **Step 1: Remove stale source claims**

Document Markdown authority, linked artwork metadata, separate live invocations, generated-artifact rules, and fail-closed validation. Remove “dual path” and legacy merge language.

- [x] **Step 2: Run the complete verification**

```bash
npm run typecheck
npm run test:unit
npm --prefix mcp/oracle-server run typecheck
npm --prefix mcp/oracle-server run smoke
npm run build
```

Expected baseline: typecheck exits 0, all unit tests pass, MCP typecheck/smoke exit 0, and the production build exits 0.

## Explicit source decisions

- Card 29 resolves in favor of Markdown pair `29`.
- Scaffold prose remains available; status is not a runtime visibility filter.
- Card 17's `Peral of Christos` spelling is not silently corrected during infrastructure work. Record it for Adrian unless independent source evidence makes the correction unambiguous.
- Names on Cards 51, 58, and 61 follow Markdown and are tested as visible contract changes.
- Missing or malformed Markdown fails closed. There is no silent legacy prose fallback.

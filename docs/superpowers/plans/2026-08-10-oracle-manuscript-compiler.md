# Oracle Manuscript Compiler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the monolithic Oracle card-file reader with one strict, pure per-lens compiler while preserving browser, REST, search, hosted MCP, and local MCP behavior and migrating only Card 23 as the first proof.

**Architecture:** A runtime-neutral compiler accepts either a legacy `oracle/cards/NN.md` adapter or the target `oracle/manuscripts/NN/` bundle and emits the existing `CanonicalCard` public contract plus non-public editorial diagnostics. Node and browser adapters resolve files, but all parsing, validation, ring normalization, public-field stripping, and card construction live in the compiler. During migration exactly one active source layout is allowed per card; malformed V2 files fail closed and never fall back to legacy.

**Tech Stack:** TypeScript, `yaml`, Vite raw imports, Node filesystem adapters, Vitest, Playwright, deterministic JSON artifacts, Git.

---

## Scope and invariants

This plan changes publication infrastructure only. It does not rewrite Oracle prose, generate a new candidate, promote any lens to `final`, push a branch, open a pull request, merge, or deploy.

The public `CanonicalCard` shape remains stable except for two intentional repairs:

- the undocumented internal `relations.status` field disappears;
- codon-ring display names normalize to 22 identities while legacy ring strings remain accepted as filter input.

The target source tree is:

```text
oracle/
  manuscripts/
    23/
      _card.md
      code.md
      iching.md
      keys.md
      design.md
      body.md
      relations.md
  editorial/
    23/
      CARD.md
      CODE.md
      ICHING.md
      KEYS.md
      DESIGN.md
      BODY.md
      RELATIONS.md
```

Moving lines stay in `iching.md`. Editorial sidecars are durable receipts and findings; they never refill public prose.

## File responsibility map

Create:

```text
lib/oracle/authoring-error.ts                 Typed actionable compiler failures
lib/oracle/manuscript-schema.ts               Lens, status, metadata, and bundle types
lib/oracle/manuscript-bundle.ts               Strict YAML and legacy/V2 bundle parsing
lib/oracle/rings.ts                           The 22 canonical ring identities and aliases
lib/oracle/compiler.ts                        Pure bundle-to-CanonicalCard compiler
lib/oracle/editorial-sidecar.ts               Strict durable receipt/finding parser
components/oracle/OracleAuthoringFailure.tsx  Visible reader failure state
scripts/check-oracle-manuscripts.ts            Read-only readiness report
scripts/migrate-oracle-card.ts                 Dry-run/apply one-card splitter
tests/unit/oraclePublicContract.test.ts
tests/unit/oracleRings.test.ts
tests/unit/oracleCompiler.test.ts
tests/unit/oracleEditorialSidecar.test.ts
tests/unit/oracleAuthoringErrors.test.tsx
tests/unit/oracleManuscriptMigration.test.ts
oracle/CONSTITUTION.md
oracle/rubrics/CODE.md
oracle/rubrics/ICHING.md
oracle/rubrics/KEYS.md
oracle/rubrics/DESIGN.md
oracle/rubrics/BODY.md
oracle/rubrics/RELATIONS.md
```

Modify:

```text
package.json
package-lock.json
lib/oracle/card-markdown.ts
lib/oracle/types.ts
lib/oracle/hosted.ts
mcp/oracle-server/src/corpus.ts
data/cardMarkdown.ts
data/synthesisData.ts
data/oracleData.ts
components/UniversalLanguageCard.tsx
components/oracle/reading/CardReadingData.tsx
scripts/build-oracle-corpus.ts
scripts/build-search-index.ts
tests/unit/cardMarkdown.test.ts
tests/unit/oracleBrowserSource.test.ts
tests/unit/oracleCorpus.test.ts
tests/unit/oracleRelationsSource.test.ts
tests/unit/oracleArtifacts.test.ts
tests/unit/oracleHostedApi.test.ts
tests/unit/oracleHostedTools.test.ts
oracle/INDEX.md
oracle/PARSER_SPEC.md
```

Archive during the relevant tasks:

```text
oracle/cards/example-01-earths-breath.md
oracle/cards/1.json
oracle/cards/23.md
the obsolete authority documents listed in Task 9
```

## Baseline

The focused suite was green before this plan was written:

```text
7 test files passed
44 tests passed
```

Command:

```bash
npx vitest run tests/unit/cardMarkdown.test.ts tests/unit/oracleRelationsSource.test.ts tests/unit/oracleCorpus.test.ts tests/unit/oracleArtifacts.test.ts tests/unit/oracleBrowserSource.test.ts tests/unit/oracleHostedApi.test.ts tests/unit/oracleHostedTools.test.ts
```

---

### Task 1: Freeze the public Oracle contract

**Files:**
- Create: `tests/unit/oraclePublicContract.test.ts`
- Modify: none

- [ ] **Step 1: Write the failing internal-field test**

Create `tests/unit/oraclePublicContract.test.ts` with recursive key inspection and the exact current public tool names:

```ts
import { describe, expect, it } from 'vitest';

import corpusData from '../../data/oracle-corpus.json';
import { PUBLIC_TOOL_DEFS } from '../../lib/oracle/tool-defs';
import type { CanonicalCard } from '../../lib/oracle/types';

function findForbiddenKeys(value: unknown, path = '$'): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => findForbiddenKeys(entry, `${path}[${index}]`));
  }
  if (!value || typeof value !== 'object') return [];

  const forbidden = new Set(['status', 'meta', 'sourcing_log', 'fact_check']);
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => [
    ...(forbidden.has(key) ? [`${path}.${key}`] : []),
    ...findForbiddenKeys(child, `${path}.${key}`),
  ]);
}

describe('Oracle public contract', () => {
  const cards = (corpusData as { cards: CanonicalCard[] }).cards;

  it('publishes 64 cards without internal editorial fields', () => {
    expect(cards).toHaveLength(64);
    expect(findForbiddenKeys(cards)).toEqual([]);
  });

  it('keeps the documented card surface stable for Card 23', () => {
    const card = cards.find(candidate => candidate.number === 23);
    expect(card).toBeDefined();
    expect(Object.keys(card!).sort()).toEqual([
      'artworks', 'body', 'card_name', 'essence', 'gene_keys', 'glance',
      'human_design', 'iching', 'keywords', 'number', 'reference', 'relations',
      'ring_name', 'ring_tarot', 'tarot',
    ]);
    expect(card).toMatchObject({
      number: 23,
      card_name: 'Beneath the Surface',
      ring_name: 'Ring of Life and Death',
      keywords: expect.arrayContaining(['Simplicity', 'Speaking Clearly', 'Right Timing']),
      relations: {
        pair: { number: 24 },
        inverse: { number: 24 },
        programming_partner: { number: 43 },
        codon_ring: { siblings: [3, 20, 24, 27, 42] },
      },
    });
  });

  it('keeps all seven public tool names stable', () => {
    expect(PUBLIC_TOOL_DEFS.map(tool => tool.name)).toEqual([
      'search_oracle',
      'get_card',
      'get_voice',
      'get_line',
      'list_cards',
      'find_artworks',
      'cast_hexagram',
    ]);
  });
});
```

- [ ] **Step 2: Run the contract test and confirm the status leak**

Run:

```bash
npx vitest run tests/unit/oraclePublicContract.test.ts
```

Expected: FAIL because all 64 cards contain `$.cards[N].relations.status`.

- [ ] **Step 3: Commit the red contract test**

```bash
git add tests/unit/oraclePublicContract.test.ts
git commit -m "test(oracle): freeze the public card contract"
```

---

### Task 2: Repair the browser glob and public status leak

**Files:**
- Create: `lib/oracle/manuscript-schema.ts`
- Modify: `data/cardMarkdown.ts`
- Modify: `lib/oracle/card-markdown.ts`
- Modify: `lib/oracle/types.ts`
- Modify: `mcp/oracle-server/src/corpus.ts`
- Modify: `tests/unit/cardMarkdown.test.ts`
- Modify: `tests/unit/oracleBrowserSource.test.ts`
- Move: `oracle/cards/example-01-earths-breath.md` to `oracle/_archive/examples/example-01-earths-breath.md`
- Move: `oracle/cards/1.json` to `oracle/_archive/examples/1.json`

- [ ] **Step 1: Add failing tests for exact source discovery and status validation**

Add to `tests/unit/oracleBrowserSource.test.ts`:

```ts
it('bundles only zero-padded numbered legacy manuscripts', async () => {
  const source = await readFile(resolve('data/cardMarkdown.ts'), 'utf8');
  expect(source).toContain("../oracle/cards/[0-9][0-9].md");
  expect(source).not.toContain("../oracle/cards/*.md");
});
```

Add to `tests/unit/cardMarkdown.test.ts`:

```ts
import { parseLegacyStatusMap } from '../../lib/oracle/manuscript-schema';

it('rejects unknown, missing, and invalid lens statuses', () => {
  expect(() => parseLegacyStatusMap({
    code: 'scaffold', iching: 'scaffold', keys: 'scaffold',
    design: 'scaffold', body: 'scaffold', relations: 'done',
  }, 'oracle/cards/23.md')).toThrow(/relations.*done.*scaffold.*in-progress.*final/i);

  expect(() => parseLegacyStatusMap({
    code: 'scaffold', iching: 'scaffold', keys: 'scaffold',
    design: 'scaffold', body: 'scaffold',
  }, 'oracle/cards/23.md')).toThrow(/relations.*missing/i);
});
```

- [ ] **Step 2: Run the focused tests and confirm failure**

```bash
npx vitest run tests/unit/cardMarkdown.test.ts tests/unit/oracleBrowserSource.test.ts tests/unit/oraclePublicContract.test.ts
```

Expected: FAIL because the glob is broad, `parseLegacyStatusMap` does not exist, and public status still leaks.

- [ ] **Step 3: Define the shared lens and status contract**

Create `lib/oracle/manuscript-schema.ts`:

```ts
export const ORACLE_LENSES = [
  'CODE', 'ICHING', 'KEYS', 'DESIGN', 'BODY', 'RELATIONS',
] as const;

export type OracleLens = typeof ORACLE_LENSES[number];
export type EditorialStatus = 'scaffold' | 'in-progress' | 'final';

const EDITORIAL_STATUSES = new Set<EditorialStatus>([
  'scaffold', 'in-progress', 'final',
]);

export function parseEditorialStatus(value: unknown, context: string): EditorialStatus {
  if (typeof value !== 'string' || !EDITORIAL_STATUSES.has(value as EditorialStatus)) {
    throw new Error(
      `${context}: expected scaffold | in-progress | final; received ${JSON.stringify(value)}`,
    );
  }
  return value as EditorialStatus;
}

export function parseLegacyStatusMap(
  value: unknown,
  context: string,
): Record<Lowercase<OracleLens>, EditorialStatus> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${context}: frontmatter status must be a map`);
  }

  const source = value as Record<string, unknown>;
  const allowed = ORACLE_LENSES.map(lens => lens.toLowerCase());
  const unknown = Object.keys(source).filter(key => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new Error(`${context}: unknown status keys: ${unknown.join(', ')}`);
  }

  return Object.fromEntries(allowed.map(key => {
    if (!(key in source)) throw new Error(`${context}: status.${key} is missing`);
    return [key, parseEditorialStatus(source[key], `${context}: status.${key}`)];
  })) as Record<Lowercase<OracleLens>, EditorialStatus>;
}
```

- [ ] **Step 4: Restrict active legacy sources and archive pollution**

Change `data/cardMarkdown.ts` to:

```ts
const cardMarkdownModules = import.meta.glob('../oracle/cards/[0-9][0-9].md', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>;
```

Move the two noncanonical files:

```bash
mkdir -p oracle/_archive/examples
git mv oracle/cards/example-01-earths-breath.md oracle/_archive/examples/example-01-earths-breath.md
git mv oracle/cards/1.json oracle/_archive/examples/1.json
```

- [ ] **Step 5: Validate status internally and remove it from the public type**

In `mcp/oracle-server/src/corpus.ts`, call this from `validateCard()`:

```ts
try {
  parseLegacyStatusMap(parsed.frontmatter.status, file);
} catch (error) {
  issues.push((error as Error).message);
}
```

Remove `status?: string` from `OracleRelations` in `lib/oracle/types.ts`. Remove `statusData` and the `status:` assignment from `mapRelations()` in `lib/oracle/card-markdown.ts`.

- [ ] **Step 6: Regenerate artifacts and run the focused suite**

```bash
npm run build:oracle-corpus
npm run build:search-index
npx vitest run tests/unit/cardMarkdown.test.ts tests/unit/oracleBrowserSource.test.ts tests/unit/oraclePublicContract.test.ts tests/unit/oracleCorpus.test.ts tests/unit/oracleArtifacts.test.ts tests/unit/oracleHostedApi.test.ts tests/unit/oracleHostedTools.test.ts
```

Expected: PASS; generated corpus and hosted results contain no internal status.

- [ ] **Step 7: Commit the urgent repairs**

```bash
git add lib/oracle/manuscript-schema.ts data/cardMarkdown.ts lib/oracle/card-markdown.ts lib/oracle/types.ts mcp/oracle-server/src/corpus.ts tests/unit/cardMarkdown.test.ts tests/unit/oracleBrowserSource.test.ts oracle/_archive/examples data/oracle-corpus.json data/oracle-search-index.json
git commit -m "fix(oracle): close manuscript and status leaks"
```

---

### Task 3: Normalize the 22 codon-ring identities

**Files:**
- Create: `lib/oracle/rings.ts`
- Create: `tests/unit/oracleRings.test.ts`
- Modify: `lib/oracle/card-markdown.ts`
- Modify: `lib/oracle/hosted.ts`
- Modify: `data/oracleData.ts`
- Modify: `tests/unit/oracleRelationsSource.test.ts`
- Modify: `tests/unit/oracleHostedTools.test.ts`

- [ ] **Step 1: Write failing normalization and grouping tests**

Create `tests/unit/oracleRings.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { CODON_RINGS } from '../../data/oracleData';
import { normalizeCodonRing } from '../../lib/oracle/rings';

describe('Oracle codon-ring identities', () => {
  it('normalizes legacy prefixes and the Illuminati article', () => {
    expect(normalizeCodonRing('Codon Ring of Alchemy')).toEqual({
      id: 'alchemy', name: 'Ring of Alchemy',
    });
    expect(normalizeCodonRing('Ring of the Illuminati')).toEqual({
      id: 'illuminati', name: 'Ring of Illuminati',
    });
    expect(normalizeCodonRing('Codon Ring of Illuminati')).toEqual({
      id: 'illuminati', name: 'Ring of Illuminati',
    });
  });

  it('rejects an unknown ring', () => {
    expect(() => normalizeCodonRing('Ring of Something New')).toThrow(
      /unknown codon ring/i,
    );
  });

  it('groups the deck into exactly 22 rings', () => {
    expect(CODON_RINGS).toHaveLength(22);
  });
});
```

- [ ] **Step 2: Run the test and confirm current 35-group failure**

```bash
npx vitest run tests/unit/oracleRings.test.ts
```

Expected: FAIL because `normalizeCodonRing` is absent and `CODON_RINGS` currently has 35 string groups.

- [ ] **Step 3: Implement the closed ring registry**

Create `lib/oracle/rings.ts`:

```ts
const RING_NAMES = {
  alchemy: 'Ring of Alchemy',
  destiny: 'Ring of Destiny',
  divinity: 'Ring of Divinity',
  fire: 'Ring of Fire',
  gaia: 'Ring of Gaia',
  humanity: 'Ring of Humanity',
  illuminati: 'Ring of Illuminati',
  illusion: 'Ring of Illusion',
  'life-and-death': 'Ring of Life and Death',
  light: 'Ring of Light',
  matter: 'Ring of Matter',
  miracles: 'Ring of Miracles',
  'no-return': 'Ring of No Return',
  origin: 'Ring of Origin',
  prosperity: 'Ring of Prosperity',
  purification: 'Ring of Purification',
  secrets: 'Ring of Secrets',
  seeking: 'Ring of Seeking',
  trials: 'Ring of Trials',
  union: 'Ring of Union',
  water: 'Ring of Water',
  whirlwind: 'Ring of the Whirlwind',
} as const;

export type CodonRingId = keyof typeof RING_NAMES;

const ALIASES = new Map<string, CodonRingId>();
for (const [id, name] of Object.entries(RING_NAMES) as Array<[CodonRingId, string]>) {
  ALIASES.set(name.toLowerCase(), id);
  ALIASES.set(name.replace(/^Ring /, 'Codon Ring ').toLowerCase(), id);
}
ALIASES.set('ring of the illuminati', 'illuminati');
ALIASES.set('codon ring of the illuminati', 'illuminati');

export function normalizeCodonRing(value: string): { id: CodonRingId; name: string } {
  const id = ALIASES.get(value.trim().replace(/\s+/g, ' ').toLowerCase());
  if (!id) throw new Error(`Unknown codon ring ${JSON.stringify(value)}`);
  return { id, name: RING_NAMES[id] };
}

export function sameCodonRing(left: string, right: string): boolean {
  return normalizeCodonRing(left).id === normalizeCodonRing(right).id;
}
```

- [ ] **Step 4: Normalize at compilation and input filtering**

In `mapRelations()`, normalize `relations_data.codon_ring` before assigning `codon_ring.name`. In corpus validation, compare the BODY ring and RELATIONS ring with `sameCodonRing()` and report a mismatch as an authoring error.

In `lib/oracle/hosted.ts`, replace exact lowercased ring filtering with:

```ts
function requestedRingName(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    return normalizeCodonRing(value).name;
  } catch {
    return value.trim();
  }
}
```

Use the returned canonical name in `list_cards`; unknown filters continue returning an empty list rather than changing the public error behavior.

- [ ] **Step 5: Regenerate and verify ring compatibility**

```bash
npm run build:oracle-corpus
npm run build:search-index
npx vitest run tests/unit/oracleRings.test.ts tests/unit/oracleRelationsSource.test.ts tests/unit/oracleArtifacts.test.ts tests/unit/oracleHostedTools.test.ts
```

Expected: PASS; every output ring name is canonical, `CODON_RINGS` has 22 entries, and old filter aliases still find the same cards.

- [ ] **Step 6: Commit ring normalization**

```bash
git add lib/oracle/rings.ts lib/oracle/card-markdown.ts lib/oracle/hosted.ts data/oracleData.ts tests/unit/oracleRings.test.ts tests/unit/oracleRelationsSource.test.ts tests/unit/oracleHostedTools.test.ts data/oracle-corpus.json data/oracle-search-index.json
git commit -m "fix(oracle): normalize the 22 codon rings"
```

---

### Task 4: Introduce strict YAML and the pure compiler

**Files:**
- Create: `lib/oracle/authoring-error.ts`
- Create: `lib/oracle/manuscript-bundle.ts`
- Create: `lib/oracle/compiler.ts`
- Create: `tests/unit/oracleCompiler.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `lib/oracle/card-markdown.ts`
- Modify: `mcp/oracle-server/src/corpus.ts`
- Modify: `tests/unit/cardMarkdown.test.ts`
- Modify: `tests/unit/oracleCorpus.test.ts`

- [ ] **Step 1: Install the YAML parser**

```bash
npm install yaml
```

Expected: `yaml` appears in `dependencies` and `package-lock.json` changes.

- [ ] **Step 2: Write failing strict-YAML and compiler tests**

Create `tests/unit/oracleCompiler.test.ts` with these cases:

```ts
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { compileOracleCard } from '../../lib/oracle/compiler';
import { legacyCardToBundle, parseYamlRecord } from '../../lib/oracle/manuscript-bundle';

describe('Oracle manuscript compiler', () => {
  it('rejects duplicate YAML keys with a repository-relative location', () => {
    expect(() => parseYamlRecord('number: 23\nnumber: 24\n', 'oracle/manuscripts/23/_card.md'))
      .toThrow(/ORACLE_YAML_INVALID.*_card\.md.*duplicate/i);
  });

  it('parses existing folded provenance scalars correctly', () => {
    expect(parseYamlRecord('fact_check: >\n  first line\n  second line\n', 'fixture.md'))
      .toEqual({ fact_check: 'first line second line\n' });
  });

  it('compiles legacy Card 23 through the new pure compiler', async () => {
    const file = resolve('oracle/cards/23.md');
    const raw = await readFile(file, 'utf8');
    const result = compileOracleCard(legacyCardToBundle(raw, 'oracle/cards/23.md'), {
      artworks: [],
    });
    expect(result.card).toMatchObject({
      number: 23,
      card_name: 'Beneath the Surface',
      ring_name: 'Ring of Life and Death',
    });
    expect(JSON.stringify(result.card)).not.toMatch(/sourcing_log|fact_check|status/i);
  });
});
```

Extend `tests/unit/cardMarkdown.test.ts` to reject unknown top-level V2 metadata and duplicate lens headings.

- [ ] **Step 3: Run the compiler tests and confirm failure**

```bash
npx vitest run tests/unit/oracleCompiler.test.ts tests/unit/cardMarkdown.test.ts
```

Expected: FAIL because the strict parser, bundle adapter, and compiler do not exist.

- [ ] **Step 4: Add typed authoring failures**

Create `lib/oracle/authoring-error.ts`:

```ts
import type { OracleLens } from './manuscript-schema';

export interface OracleAuthoringIssue {
  code: string;
  card?: number;
  lens?: OracleLens;
  file: string;
  path?: string;
  message: string;
  hint: string;
}

export class OracleAuthoringError extends Error {
  constructor(public readonly issues: readonly OracleAuthoringIssue[]) {
    super([
      'Oracle manuscript compilation failed:',
      ...issues.map(issue =>
        `[${issue.code}] ${issue.file}${issue.path ? ` ${issue.path}` : ''}: ${issue.message} ${issue.hint}`,
      ),
    ].join('\n'));
    this.name = 'OracleAuthoringError';
  }
}
```

- [ ] **Step 5: Define bundle types and strict YAML parsing**

Extend `lib/oracle/manuscript-schema.ts`:

```ts
export interface ManuscriptFile {
  path: string;
  raw: string;
}

export interface OracleManuscriptBundle {
  cardNumber: number;
  layout: 'legacy' | 'v2';
  card: ManuscriptFile;
  lenses: Record<Lowercase<OracleLens>, ManuscriptFile>;
  editorial: Partial<Record<OracleLens | 'CARD', ManuscriptFile>>;
}
```

Create `lib/oracle/manuscript-bundle.ts`. Use `parseDocument()` and fail on every parser error:

```ts
import { parseDocument } from 'yaml';

import { OracleAuthoringError } from './authoring-error';

export function parseYamlRecord(raw: string, file: string): Record<string, unknown> {
  const document = parseDocument(raw, {
    prettyErrors: true,
    strict: true,
    uniqueKeys: true,
  });
  if (document.errors.length > 0) {
    throw new OracleAuthoringError(document.errors.map(error => ({
      code: 'ORACLE_YAML_INVALID',
      file,
      message: error.message,
      hint: 'Fix the YAML before compiling this card.',
    })));
  }
  const value = document.toJS();
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new OracleAuthoringError([{
      code: 'ORACLE_YAML_ROOT_INVALID',
      file,
      message: 'Frontmatter must be a mapping.',
      hint: 'Use key: value fields at the frontmatter root.',
    }]);
  }
  return value as Record<string, unknown>;
}
```

Implement `legacyCardToBundle()` by parsing the one legacy file once, preserving each lens body byte-for-byte in virtual `ManuscriptFile` records. It must derive the six lens statuses from the legacy status map and keep structural frontmatter in the virtual `_card.md` record.

- [ ] **Step 6: Extract one canonical card builder**

Move `buildCanonicalCard()` and `buildSearchText()` from `mcp/oracle-server/src/corpus.ts` into `lib/oracle/compiler.ts`. Export:

```ts
export interface CompiledOracleCard {
  card: CanonicalCard;
  editorial: {
    statuses: Record<Lowercase<OracleLens>, EditorialStatus>;
  };
  diagnostics: OracleAuthoringIssue[];
}

export function compileOracleCard(
  bundle: OracleManuscriptBundle,
  options: { artworks: readonly CardArtwork[] },
): CompiledOracleCard;
```

Both legacy and V2 paths must produce one `ParsedCard`-equivalent internal value and call one private `compileParsedCard()` implementation. Do not retain a browser builder and Node builder.

- [ ] **Step 7: Reject unknown V2 fields and malformed lens files**

Use closed allowed-key sets:

```ts
const CARD_KEYS = new Set([
  'schema', 'number', 'card_name', 'hexagram_name', 'trigrams',
  'gene_keys', 'human_design', 'body', 'relations', 'iching_lines',
]);
const LENS_KEYS = new Set(['schema', 'status']);
```

V2 `_card.md` must use `schema: oracle-card/v2`; lens files must use `schema: oracle-lens/v1`, one expected `## LENS` heading, and no other top-level section. Unknown or duplicate structural fields are authoring errors.

- [ ] **Step 8: Make the Node corpus an adapter around the compiler**

In `mcp/oracle-server/src/corpus.ts`, retain artwork linking, filesystem reads, 1–64 enumeration, number uniqueness, and binary uniqueness. Replace its card construction with `compileOracleCard(bundle, { artworks }).card`.

- [ ] **Step 9: Run focused compiler and corpus verification**

```bash
npx vitest run tests/unit/oracleCompiler.test.ts tests/unit/cardMarkdown.test.ts tests/unit/oracleCorpus.test.ts tests/unit/oracleRelationsSource.test.ts
npm run typecheck
npm --prefix mcp/oracle-server run typecheck
```

Expected: PASS; all 64 legacy cards compile through the new pure module.

- [ ] **Step 10: Commit the strict compiler foundation**

```bash
git add package.json package-lock.json lib/oracle/authoring-error.ts lib/oracle/manuscript-schema.ts lib/oracle/manuscript-bundle.ts lib/oracle/compiler.ts lib/oracle/card-markdown.ts mcp/oracle-server/src/corpus.ts tests/unit/oracleCompiler.test.ts tests/unit/cardMarkdown.test.ts tests/unit/oracleCorpus.test.ts tests/unit/oracleRelationsSource.test.ts
git commit -m "feat(oracle): add the strict manuscript compiler"
```

---

### Task 5: Add dual-layout filesystem resolution and deterministic artifacts

**Files:**
- Modify: `mcp/oracle-server/src/corpus.ts`
- Modify: `mcp/oracle-server/src/paths.ts`
- Modify: `scripts/build-oracle-corpus.ts`
- Modify: `scripts/build-search-index.ts`
- Modify: `tests/unit/oracleCorpus.test.ts`
- Modify: `tests/unit/oracleArtifacts.test.ts`

- [ ] **Step 1: Write failing mixed-layout resolution tests**

Add tests using a temporary Oracle root:

```ts
it('prefers neither source when legacy and V2 are both active', async () => {
  const root = await copiedOracleRoot();
  await createV2Card23(root);
  await expect(loadCorpusFromOracleDirectory(root, new Map())).rejects.toThrow(
    /Card 23.*both legacy and V2.*archive one/i,
  );
});

it('does not fall back when an active V2 lens is missing', async () => {
  const root = await copiedOracleRoot();
  await createV2Card23(root);
  await unlink(join(root, 'cards', '23.md'));
  await unlink(join(root, 'manuscripts', '23', 'body.md'));
  await expect(loadCorpusFromOracleDirectory(root, new Map())).rejects.toThrow(
    /manuscripts\/23\/body\.md.*missing/i,
  );
});
```

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/unit/oracleCorpus.test.ts
```

Expected: FAIL because `loadCorpusFromOracleDirectory()` and V2 resolution do not exist.

- [ ] **Step 3: Implement exact one-source resolution**

Add to `mcp/oracle-server/src/corpus.ts`:

```ts
export async function readOracleManuscriptBundle(
  oracleRoot: string,
  cardNumber: number,
): Promise<OracleManuscriptBundle>;

export async function loadCorpusFromOracleDirectory(
  oracleRoot: string,
  artworkMap: ArtworkMap = new Map(),
): Promise<CanonicalCard[]>;
```

Resolution rules:

1. Legacy is active only at `cards/NN.md`.
2. V2 is active only when `manuscripts/NN/_card.md` exists.
3. Both active is `ORACLE_SOURCE_AMBIGUOUS`.
4. Neither active is `ORACLE_SOURCE_MISSING`.
5. Once V2 is active, require all six exact lowercase lens filenames; never consult legacy.

Change `loadCorpus()` to call:

```ts
cache ??= loadCorpusFromOracleDirectory(ORACLE_DIR, artworkMapFromArchive());
```

- [ ] **Step 4: Keep artifact writers on the shared loader**

Both build scripts continue calling `loadCorpus()`. Add comments stating that `CanonicalCard` has already been stripped by the compiler; `build-oracle-corpus.ts` still removes only `searchText`.

- [ ] **Step 5: Prove deterministic generation**

```bash
npm run build:oracle-corpus
npm run build:search-index
shasum -a 256 data/oracle-corpus.json data/oracle-search-index.json > /tmp/oracle-artifacts-first.sha
npm run build:oracle-corpus
npm run build:search-index
shasum -a 256 data/oracle-corpus.json data/oracle-search-index.json > /tmp/oracle-artifacts-second.sha
diff -u /tmp/oracle-artifacts-first.sha /tmp/oracle-artifacts-second.sha
```

Expected: `diff` exits 0 with no output.

- [ ] **Step 6: Run corpus and artifact tests**

```bash
npx vitest run tests/unit/oracleCorpus.test.ts tests/unit/oracleArtifacts.test.ts tests/unit/oracleHostedApi.test.ts tests/unit/oracleHostedTools.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the source resolver**

```bash
git add mcp/oracle-server/src/corpus.ts mcp/oracle-server/src/paths.ts scripts/build-oracle-corpus.ts scripts/build-search-index.ts tests/unit/oracleCorpus.test.ts tests/unit/oracleArtifacts.test.ts data/oracle-corpus.json data/oracle-search-index.json
git commit -m "feat(oracle): resolve legacy and per-lens manuscripts safely"
```

---

### Task 6: Add editorial sidecars and structured findings

**Files:**
- Create: `lib/oracle/editorial-sidecar.ts`
- Create: `scripts/check-oracle-manuscripts.ts`
- Create: `tests/unit/oracleEditorialSidecar.test.ts`
- Modify: `lib/oracle/compiler.ts`
- Modify: `lib/oracle/manuscript-schema.ts`
- Modify: `package.json`

- [ ] **Step 1: Write failing receipt and finding tests**

Create `tests/unit/oracleEditorialSidecar.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { parseEditorialSidecar, validateFinality } from '../../lib/oracle/editorial-sidecar';

const receipt = `---
schema: oracle-editorial/v1
kind: lens
card: 23
lens: CODE
work_id: work-23-code
revision: 1
lane: standard
status: final
manuscript_sha256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
source_bundle_sha256: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
evidence_sha256: cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
constitution_sha256: dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd
center_sha256: eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
candidate_sha256: ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
deck_corpus_sha256: 1111111111111111111111111111111111111111111111111111111111111111
models:
  evidence: null
  center: null
  writer: null
  critic: null
  sameness: null
humanizer: null
approved_by: Adrian Rasmussen
approved_at: 2026-08-10T13:00:00Z
finality:
  decision: approved
  approved_by: Adrian Rasmussen
  approved_at: 2026-08-10T13:00:00Z
  manuscript_sha256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
proposal: null
---
## Human center

The accepted center is a research judgment, not replacement manuscript prose.

## Evidence map

## Tensions and gaps

- F23-CODE-001 · warning · provenance-gap · One inherited interpretation needs a stronger locator.

## Critique

## Whole-card sameness

## Deck sameness

## Decision history

- 2026-08-10T13:00:00Z · finality approved by Adrian Rasmussen
`;

describe('Oracle editorial sidecars', () => {
  it('parses a digest-bound human receipt', () => {
    expect(parseEditorialSidecar(receipt, 'oracle/editorial/23/CODE.md')).toMatchObject({
      card: 23,
      lens: 'CODE',
      schema: 'oracle-editorial/v1',
      approved_by: 'Adrian Rasmussen',
      manuscript_sha256: 'a'.repeat(64),
    });
  });

  it('rejects final status when the receipt digest is stale', () => {
    const parsed = parseEditorialSidecar(receipt, 'oracle/editorial/23/CODE.md');
    expect(() => validateFinality('final', parsed, 'e'.repeat(64)))
      .toThrow(/ORACLE_FINALITY_STALE/i);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/unit/oracleEditorialSidecar.test.ts
```

Expected: FAIL because the sidecar parser does not exist.

- [ ] **Step 3: Define strict receipt fields**

Create `lib/oracle/editorial-sidecar.ts` and export:

```ts
export type FindingSeverity = 'note' | 'warning' | 'blocker';

export interface EditorialFinding {
  id: string;
  severity: FindingSeverity;
  kind: 'provenance-gap' | 'source-conflict' | 'rights-risk' | 'sameness' | 'structure';
  message: string;
}

export interface ModelRunReceipt {
  provider_family: string;
  model: string;
  run_id: string;
  input_sha256: string;
  output_sha256: string;
}

export interface HumanizerReceipt {
  plugin_id: string;
  plugin_version: string;
  input_sha256: string;
  output_sha256: string;
  status: 'passed' | 'bypassed';
}

export interface FinalityReceipt {
  decision: 'approved';
  approved_by: string;
  approved_at: string;
  manuscript_sha256: string;
}

export interface ProposalReceipt {
  state: 'prepared';
  commit: string;
}

export interface EvidenceReceiptRow {
  evidence_id: string;
  source_version_id: string;
  content_sha256: string;
  locator: string;
}

export interface DecisionReceipt {
  actor: string;
  at: string;
  decision: string;
  reason: string;
}

export interface EditorialReceipt {
  schema: 'oracle-editorial/v1';
  kind: 'lens' | 'card';
  card: number;
  lens: Lens | 'ALL';
  work_id: string;
  revision: number;
  lane: 'standard' | 'deep' | 'fast';
  status: 'in-progress' | 'final';
  manuscript_sha256: string;
  source_bundle_sha256: string;
  evidence_sha256: string;
  constitution_sha256: string;
  center_sha256: string;
  candidate_sha256: string;
  deck_corpus_sha256: string;
  models: Record<'evidence' | 'center' | 'writer' | 'critic' | 'sameness', ModelRunReceipt | null>;
  humanizer: HumanizerReceipt | null;
  approved_by: string | null;
  approved_at: string | null;
  finality: FinalityReceipt | null;
  proposal: ProposalReceipt | null;
  sections: {
    human_center: string;
    evidence_map: readonly EvidenceReceiptRow[];
    tensions_and_gaps: readonly EditorialFinding[];
    critique: readonly EditorialFinding[];
    whole_card_sameness: readonly EditorialFinding[];
    deck_sameness: readonly EditorialFinding[];
    decision_history: readonly DecisionReceipt[];
  };
}

export function parseEditorialSidecar(raw: string, file: string): EditorialReceipt;
export function validateFinality(
  status: EditorialStatus,
  receipt: EditorialReceipt | undefined,
  manuscriptDigest: string,
): void;
```

Validate SHA-256 values with `^[0-9a-f]{64}$`. Reject unknown root keys, unknown finding types, missing named approvers, invalid timestamps, or any body heading outside the shared fixed sequence. Sidecar bodies may contain accepted-center and decision notes but are never passed to `CanonicalCard` construction. This is the same `oracle-editorial/v1` field contract used by WordForge; do not add `*_digest` aliases.

- [ ] **Step 4: Convert prose markers into diagnostics, not regex deletion**

Add a scanner for:

```ts
const LEGACY_EDITORIAL_MARKERS = [
  /\[FLAG:/i,
  /\bCONFLICT FLAGGED:/i,
  /\(Derived[\s\S]*?see note\.\)/i,
] as const;
```

Legacy cards report these as readiness warnings. V2 lens files reject them with `ORACLE_EDITORIAL_MARKER_IN_PROSE`, pointing to the lens and asking the author to move the issue into its sidecar. Remove `cleanRelationsProse()` marker deletion only after Card 23 is migrated and every remaining legacy card still receives the compatibility cleaner inside the legacy adapter.

- [ ] **Step 5: Require matching finality only for V2**

In `compileOracleCard()`, call `validateFinality()` for every V2 lens. Existing legacy `final` values remain readable during migration, but the readiness report labels them `legacy-finality-unreceipted`.

- [ ] **Step 6: Add the read-only readiness command**

Create `scripts/check-oracle-manuscripts.ts` to compile all 64 cards, collect warnings/errors, and print deterministic JSON with:

```ts
interface OracleReadinessReport {
  cards: 64;
  active_layouts: { legacy: number; v2: number };
  issues: OracleAuthoringIssue[];
  counts: Record<string, number>;
}
```

Add to `package.json`:

```json
"verify:oracle-manuscripts": "tsx scripts/check-oracle-manuscripts.ts"
```

The command is read-only and exits 1 only for compiler errors; warnings remain visible and exit 0.

- [ ] **Step 7: Run sidecar and readiness verification**

```bash
npx vitest run tests/unit/oracleEditorialSidecar.test.ts tests/unit/oracleCompiler.test.ts
npm run verify:oracle-manuscripts
```

Expected: tests PASS; readiness reports 64 cards, 64 legacy layouts, and explicit legacy marker/provenance warnings without changing files.

- [ ] **Step 8: Commit sidecars and findings**

```bash
git add lib/oracle/editorial-sidecar.ts lib/oracle/compiler.ts lib/oracle/manuscript-schema.ts scripts/check-oracle-manuscripts.ts tests/unit/oracleEditorialSidecar.test.ts package.json
git commit -m "feat(oracle): preserve editorial receipts and findings"
```

---

### Task 7: Make the browser use one compiled revision and show authoring errors

**Files:**
- Create: `components/oracle/OracleAuthoringFailure.tsx`
- Create: `tests/unit/oracleAuthoringErrors.test.tsx`
- Modify: `data/cardMarkdown.ts`
- Modify: `data/synthesisData.ts`
- Modify: `data/oracleData.ts`
- Modify: `components/UniversalLanguageCard.tsx`
- Modify: `components/oracle/reading/CardReadingData.tsx`
- Modify: `tests/unit/oracleBrowserSource.test.ts`

- [ ] **Step 1: Write failing browser-source and visible-error tests**

Add to `tests/unit/oracleBrowserSource.test.ts`:

```ts
it('uses the shared compiler and never keeps an independent browser card builder', async () => {
  const source = await readFile(resolve('data/synthesisData.ts'), 'utf8');
  expect(source).toContain('toCardSynthesis');
  expect(source).not.toContain('function buildSynthesis(');
});

it('does not swallow Oracle compilation errors', async () => {
  const sources = await Promise.all([
    'components/UniversalLanguageCard.tsx',
    'components/oracle/reading/CardReadingData.tsx',
  ].map(file => readFile(resolve(file), 'utf8')));
  expect(sources.join('\n')).not.toMatch(/getSynthesis\([^)]*\)[\s\S]{0,120}\.catch\(\(\) => \{\}\)/);
});
```

Create `tests/unit/oracleAuthoringErrors.test.tsx`:

```tsx
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import OracleAuthoringFailure from '../../components/oracle/OracleAuthoringFailure';

describe('Oracle authoring failure', () => {
  it('shows an actionable repository-relative error in development', () => {
    const html = renderToStaticMarkup(<OracleAuthoringFailure cardNumber={23} issue={{
      code: 'ORACLE_REQUIRED_PROSE_MISSING',
      card: 23,
      lens: 'CODE',
      file: 'oracle/manuscripts/23/code.md',
      path: '## CODE',
      message: 'CODE reading is empty.',
      hint: 'Add reader prose below the CODE keywords.',
    }} development />);
    expect(html).toContain('ORACLE_REQUIRED_PROSE_MISSING');
    expect(html).toContain('oracle/manuscripts/23/code.md');
    expect(html).toContain('Add reader prose below the CODE keywords.');
  });
});
```

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/unit/oracleBrowserSource.test.ts tests/unit/oracleAuthoringErrors.test.tsx
```

Expected: FAIL because the browser still has an independent builder, errors are swallowed, and the failure view is absent.

- [ ] **Step 3: Load exact browser bundles through the compiler**

In `data/cardMarkdown.ts`, define exact globs for legacy, `_card.md`, and each lens filename. Export:

```ts
export async function getCompiledCard(cardNumber: number): Promise<CanonicalCard>;
export function getMarkdownLineText(cardNumber: number, position: number): string;
```

Use the same source-resolution rules as Node: both layouts fail, missing V2 lens fails, and V2 never falls back. Cache the resolved `CanonicalCard`, not a separate parsed representation.

- [ ] **Step 4: Make browser projections pure**

Replace `buildSynthesis(parsed: ParsedCard, cardNumber: number, context: string)` with:

```ts
export function toCardSynthesis(card: CanonicalCard): CardSynthesis;

export async function getSynthesis(cardNumber: number): Promise<CardSynthesis> {
  return toCardSynthesis(await getCompiledCard(cardNumber));
}
```

Export `toOracleCard()` from `data/oracleData.ts` so the reading route derives structural display data from the same compiled card revision. `ALL_CARDS` may continue using the generated artifact for the deck index, but one card-reading render must never combine artifact structure with live manuscript prose.

- [ ] **Step 5: Render errors instead of blank fallbacks**

Create `OracleAuthoringFailure.tsx`. In development, render code, card/lens, repository-relative file, message, and hint. In production, render:

```text
This card could not be compiled.
Card 23 is temporarily unavailable. Return to the 64 cards.
```

Do not expose absolute filesystem paths in production.

In `UniversalLanguageCard.tsx`, model loading as:

```ts
type CardLoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; canonical: CanonicalCard; card: OracleCard; synthesis: CardSynthesis }
  | { kind: 'error'; issue: OracleAuthoringIssue };
```

Pass the ready `card` and `synthesis` into `CardReadingData`. Remove its independent effect and change its props to include both values.

- [ ] **Step 6: Run browser tests and typecheck**

```bash
npx vitest run tests/unit/oracleBrowserSource.test.ts tests/unit/oracleAuthoringErrors.test.tsx tests/unit/oracleCorpus.test.ts
npm run typecheck
```

Expected: PASS; no reader code silently swallows compiler errors.

- [ ] **Step 7: Commit the browser adapter**

```bash
git add data/cardMarkdown.ts data/synthesisData.ts data/oracleData.ts components/UniversalLanguageCard.tsx components/oracle/reading/CardReadingData.tsx components/oracle/OracleAuthoringFailure.tsx tests/unit/oracleBrowserSource.test.ts tests/unit/oracleAuthoringErrors.test.tsx
git commit -m "fix(oracle): render one compiled card revision"
```

---

### Task 8: Build the Card 23 check/apply migration

**Files:**
- Create: `scripts/migrate-oracle-card.ts`
- Create: `tests/unit/oracleManuscriptMigration.test.ts`
- Create on apply: `oracle/manuscripts/23/_card.md`
- Create on apply: `oracle/manuscripts/23/code.md`
- Create on apply: `oracle/manuscripts/23/iching.md`
- Create on apply: `oracle/manuscripts/23/keys.md`
- Create on apply: `oracle/manuscripts/23/design.md`
- Create on apply: `oracle/manuscripts/23/body.md`
- Create on apply: `oracle/manuscripts/23/relations.md`
- Create on apply: seven `oracle/editorial/23/*.md` sidecars
- Move on apply: `oracle/cards/23.md` to `oracle/_archive/legacy-cards/23.md`
- Modify: `package.json`

**External dependency gate:** Before `--apply`, the i64 OS WordForge publisher must support the V2 target. Its separate plan must update `apps/core/lib/wordforge/oracle-card-file.ts`, `apps/core/lib/wordforge/oracle-publish.ts`, and their tests so one selected lens and permitted sidecars are patched. This Mandala plan must not edit the i64 OS repository. `--check` may land before that dependency; `--apply` may not.

- [ ] **Step 1: Write failing no-write, parity, and ambiguity tests**

Create `tests/unit/oracleManuscriptMigration.test.ts` to copy `oracle/cards/23.md` into a temporary Oracle root and assert:

```ts
it('checks Card 23 without writing and preserves every lens body', async () => {
  const before = await snapshotTree(root);
  const report = await migrateOracleCard({ oracleRoot: root, cardNumber: 23, mode: 'check' });
  const after = await snapshotTree(root);

  expect(after).toEqual(before);
  expect(report.public_card_equal).toBe(true);
  expect(report.search_doc_equal).toBe(true);
  expect(report.lens_body_hashes_equal).toBe(true);
  expect(report.planned_paths).toEqual([
    'manuscripts/23/_card.md',
    'manuscripts/23/code.md',
    'manuscripts/23/iching.md',
    'manuscripts/23/keys.md',
    'manuscripts/23/design.md',
    'manuscripts/23/body.md',
    'manuscripts/23/relations.md',
  ]);
});

it('applies one active V2 card and archives the legacy source', async () => {
  await migrateOracleCard({ oracleRoot: root, cardNumber: 23, mode: 'apply' });
  expect(await activeSourceCount(root, 23)).toBe(1);
  expect(await pathExists(join(root, 'cards', '23.md'))).toBe(false);
  expect(await pathExists(join(root, '_archive', 'legacy-cards', '23.md'))).toBe(true);
});
```

- [ ] **Step 2: Run and confirm failure**

```bash
npx vitest run tests/unit/oracleManuscriptMigration.test.ts
```

Expected: FAIL because the migration module does not exist.

- [ ] **Step 3: Implement explicit CLI modes**

Export from `scripts/migrate-oracle-card.ts`:

```ts
export interface MigrationReport {
  card: number;
  mode: 'check' | 'apply';
  public_card_equal: boolean;
  search_doc_equal: boolean;
  lens_body_hashes_equal: boolean;
  planned_paths: string[];
}

export async function migrateOracleCard(input: {
  oracleRoot: string;
  cardNumber: number;
  mode: 'check' | 'apply';
}): Promise<MigrationReport>;
```

The CLI requires exactly one of `--check` or `--apply` and rejects any card other than 23 during the pilot. `--check` performs zero writes. `--apply` refuses to run unless an environment-independent command-line acknowledgement is present:

```text
--publisher-v2-ready
```

This flag records that the external i64 dependency was verified; it does not test or modify i64 itself.

- [ ] **Step 4: Split without reserializing prose**

Locate the six `## LENS` offsets in the original normalized-LF text. Copy each complete section substring into its lens file below strict frontmatter. Do not trim, wrap, normalize punctuation, or run a formatter over section bodies.

Move shared structural fields into `_card.md`. Remove duplicated `line_change_targets`; derive it from `iching_lines`. Convert `relations_data.codon_ring` to canonical `relations.ring_id: life-and-death`.

Move internal metadata as follows:

- `status.<lens>` → the matching lens frontmatter;
- `meta.sourcing_log.<lens>` → matching lens sidecar findings/source receipt;
- `meta.fact_check` → `editorial/23/CARD.md` imported finding;
- `meta.generated` and legacy source path → `editorial/23/CARD.md` migration receipt.

No sidecar may contain a copy of any lens manuscript body.

- [ ] **Step 5: Compare compiled outputs before every apply**

The script must compile the legacy bundle and proposed in-memory V2 bundle, then require:

```ts
assert.deepEqual(v2.card, legacy.card);
assert.deepEqual(toSearchDoc(v2.card), toSearchDoc(legacy.card));
assert.deepEqual(hashV2LensBodies(v2), hashLegacyLensBodies(legacy));
```

Any mismatch exits nonzero before creating a directory.

- [ ] **Step 6: Add package commands**

Add:

```json
"check:migrate-oracle-card": "tsx scripts/migrate-oracle-card.ts --card 23 --check",
"apply:migrate-oracle-card": "tsx scripts/migrate-oracle-card.ts --card 23 --apply --publisher-v2-ready"
```

- [ ] **Step 7: Run the safe check**

```bash
npm run check:migrate-oracle-card
git status --short
```

Expected: report says all three equality fields are `true`; Git status is unchanged by the command.

- [ ] **Step 8: Verify the external dependency, then apply once**

Confirm the reviewed i64 publisher branch accepts `oracle/manuscripts/23/code.md` and `oracle/editorial/23/CODE.md`, patches no other card, and keeps remote actions false. Then run:

```bash
npm run apply:migrate-oracle-card
```

Expected: Card 23 has exactly one active V2 source, its legacy file is archived, and no prose body hash changed.

- [ ] **Step 9: Regenerate and run full Card 23 parity**

```bash
npm run build:oracle-corpus
npm run build:search-index
npx vitest run tests/unit/oracleManuscriptMigration.test.ts tests/unit/oracleCompiler.test.ts tests/unit/oracleCorpus.test.ts tests/unit/oracleArtifacts.test.ts tests/unit/oracleBrowserSource.test.ts tests/unit/oracleHostedApi.test.ts tests/unit/oracleHostedTools.test.ts
npm run typecheck
npm --prefix mcp/oracle-server run typecheck
```

Expected: PASS; Card 23 browser, REST, search, hosted MCP, and local MCP projections match the pre-migration compiler output.

- [ ] **Step 10: Commit the one-card migration**

```bash
git add scripts/migrate-oracle-card.ts tests/unit/oracleManuscriptMigration.test.ts package.json oracle/manuscripts/23 oracle/editorial/23 oracle/_archive/legacy-cards/23.md data/oracle-corpus.json data/oracle-search-index.json
git commit -m "refactor(oracle): migrate Card 23 to per-lens manuscripts"
```

---

### Task 9: Repair contradictory Oracle authority documents

**Files:**
- Create: `oracle/CONSTITUTION.md`
- Create: six files under `oracle/rubrics/`
- Modify: `oracle/INDEX.md`
- Modify: `oracle/PARSER_SPEC.md`
- Move: obsolete instructions into `oracle/_archive/instructions-2026-08-10/`

- [ ] **Step 1: Write the short constitution**

`oracle/CONSTITUTION.md` must state these exact authorities and gates:

```text
Obsidian owns research truth.
WordForge owns production and review state but is not canon.
Mandala per-lens Markdown owns accepted publication prose.
Generated JSON is deterministic output, never an authoring source.
Center approval, exact-manuscript finality approval, and proposal authorization are separate human decisions.
Automation never marks prose final, pushes, opens a PR, merges, or deploys.
Public Oracle interfaces compile from one CanonicalCard contract.
```

It must link the approved lifecycle spec and the six rubrics, and name `oracle/manuscripts/NN/` plus `oracle/editorial/NN/` as the current Mandala paths.

- [ ] **Step 2: Create six concrete lens rubrics**

Each rubric must contain these headings:

```text
# <LENS> Editorial Rubric
## Purpose
## Allowed evidence traditions
## Required manuscript shape
## Mechanical compiler checks
## Editorial checks
## Findings that block finality
```

Apply these exact role separations:

- `CODE`: synthesizes only approved lens interpretations; never blends raw traditions.
- `ICHING`: owns hexagram situation, trigrams, Judgment, Image, and six moving lines.
- `KEYS`: owns Shadow, repressive/reactive faces, Gift, and Siddhi.
- `DESIGN`: owns gate drive, center, and channel context without leaking Gene Keys prose.
- `BODY`: owns embodied, organ, amino-acid, and biological correspondences with uncertainty stated.
- `RELATIONS`: owns pair, inverse, programming partner, ring, Tarot, sky, immortals, and Hebrew relationships.

- [ ] **Step 3: Update the front door and parser contract**

Rewrite `oracle/INDEX.md` path references from `oracle/cards/NN.md` to the V2 target, while explicitly noting that unmigrated cards temporarily resolve through the compiler's legacy adapter. Update `oracle/PARSER_SPEC.md` to document `_card.md`, six lens files, strict YAML, sidecars, 22 ring IDs, one-active-layout rule, and public-field stripping.

- [ ] **Step 4: Archive stale authorities after preserving binding rules**

Move this exact set:

```text
oracle/SCHEMA.md
oracle/WRITE.md
oracle/WRITING_METHOD.md
oracle/HANDOFF-TECHNICAL.md
oracle/GAMEPLAN.md
oracle/BATCH_PLAN.md
oracle/ANCHOR.md
oracle/PROJECT_PLAN.md
oracle/TODO.md
oracle/00_MASTER_WRITING_GUIDE.md
oracle/01_DESCRIPTION_SPEC.md
oracle/03_ICHING_GUIDE.md
oracle/04_TRANSLATION_METHOD.md
oracle/05_KEYWORDS_GUIDE.md
oracle/06_CONNECTIONS_GUIDE.md
```

to `oracle/_archive/instructions-2026-08-10/` with `git mv`. Keep `oracle/CONCEPT.md` as project intent and `oracle/02_INVOCATION_GUIDE.md` as the separate invocation workflow.

- [ ] **Step 5: Verify there is one active authority chain**

Run:

```bash
rg -n "oracle/cards/NN|oracle/cards/01|cards/NN.json|sections/.+NN.json|single entry point for writing" oracle --glob '!_archive/**'
```

Expected: active matches occur only in migration-history notes in `INDEX.md` and `PARSER_SPEC.md`; no active document instructs an author to edit legacy files or JSON.

- [ ] **Step 6: Commit the documentation repair**

```bash
git add oracle/CONSTITUTION.md oracle/rubrics oracle/INDEX.md oracle/PARSER_SPEC.md oracle/_archive/instructions-2026-08-10
git commit -m "docs(oracle): establish one editorial constitution"
```

---

### Task 10: Final verification and rollback proof

**Files:**
- Modify only if tests expose a defect: files already named in Tasks 1–9
- Test: all Oracle unit and browser suites

- [ ] **Step 1: Run the full Oracle unit boundary**

```bash
npx vitest run tests/unit/cardMarkdown.test.ts tests/unit/oraclePublicContract.test.ts tests/unit/oracleRings.test.ts tests/unit/oracleCompiler.test.ts tests/unit/oracleEditorialSidecar.test.ts tests/unit/oracleAuthoringErrors.test.tsx tests/unit/oracleManuscriptMigration.test.ts tests/unit/oracleRelationsSource.test.ts tests/unit/oracleCorpus.test.ts tests/unit/oracleArtifacts.test.ts tests/unit/oracleBrowserSource.test.ts tests/unit/oracleHostedApi.test.ts tests/unit/oracleHostedTools.test.ts
```

Expected: every test passes.

- [ ] **Step 2: Run type and build verification**

```bash
npm run typecheck
npm --prefix mcp/oracle-server run typecheck
npm run build
```

Expected: all commands exit 0. The build regenerates both Oracle artifacts before Vite compilation.

- [ ] **Step 3: Run local MCP smoke verification**

```bash
npm --prefix mcp/oracle-server run smoke
```

Expected: the server loads 64 cards and its smoke calls complete without a corpus error.

- [ ] **Step 4: Inspect the real Card 23 reader on desktop and mobile**

Start the preview and run:

```bash
npx playwright test tests/oracle-visual-foundation.spec.ts tests/oracle-card-shell-chrome.spec.ts --project='Desktop Chrome' --project='Mobile Chrome'
```

Expected: Card 23 renders its six lenses with no console error, empty authoring fallback, layout regression, or horizontal overflow.

- [ ] **Step 5: Prove rollback in a disposable clone**

In a temporary clone at the commit immediately before Card 23 migration, apply only the compiler commits and confirm legacy Card 23 compiles. Then apply the Card 23 migration commit and revert it:

```bash
migration_commit="$(git log -1 --format=%H --grep='^refactor(oracle): migrate Card 23 to per-lens manuscripts$')"
test -n "$migration_commit"
git revert --no-edit "$migration_commit"
npm run build:oracle-corpus
npm run build:search-index
npx vitest run tests/unit/oracleCorpus.test.ts tests/unit/oracleArtifacts.test.ts
```

Expected: the revert restores `oracle/cards/23.md`, removes the active Card 23 V2 source, regenerates valid artifacts, and all tests pass. Perform this proof only in the disposable clone; do not revert the working implementation branch.

- [ ] **Step 6: Confirm the final diff stays in scope**

```bash
git status --short
git diff --stat HEAD~5..HEAD
git diff --name-only HEAD~5..HEAD
```

Expected: changes are limited to the files named by this plan. No Oracle prose body has changed, no i64 OS file is present, and no remote action has occurred.

## Stop conditions

Stop before Card 23 `--apply` if any of these is true:

- i64 WordForge still writes `oracle/cards/NN.md` only;
- legacy and V2 compilers differ for Card 23;
- any lens body hash changes;
- a V2 final status lacks a digest-matched named-human receipt;
- a generated artifact contains editorial metadata;
- the reader hides an authoring error or mixes two revisions;
- REST, search, hosted MCP, or local MCP parity fails;
- rollback cannot restore a valid legacy corpus with one Git revert.

Do not migrate Card 52 or any second card in this plan. Card 23 is the sole manuscript migration proof.

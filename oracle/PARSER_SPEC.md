# Oracle Markdown parser and runtime contract

`oracle/cards/01.md` through `oracle/cards/64.md` are the sole authored-prose
source for the Universal Language cards. Edit a manuscript once; the browser,
local MCP corpus, and generated hosted artifacts must all reflect that file.

This contract is fail-closed. Missing, duplicated, or malformed required
content is an error. Runtime code must never silently refill prose from the
older aggregate, synthesis, section, or generated JSON collections.

## Manuscript format

Each zero-padded `oracle/cards/NN.md` file contains YAML frontmatter followed by
these six required top-level lenses:

1. `## CODE`
2. `## ICHING`
3. `## KEYS`
4. `## DESIGN`
5. `## BODY`
6. `## RELATIONS`

Frontmatter carries the card number and name, editorial status, trigrams,
system labels, structural relationships, and six moving-line destinations.
The body carries the authored reading. `oracle/cards/03.md` is the most useful
reference for the complete shape, but its `status` values are not defaults for
other cards.

Important rules:

- The filename number and frontmatter `number` must match and be within 1–64.
- Every required lens must occur once. Duplicate top-level lenses are errors.
- Every I Ching lens must map moving lines 1–6 in order.
- HTML comments are editorial/source notes and are removed before runtime
  mapping; they must not leak into browser, REST, search, or MCP output.
- `status: scaffold` does not hide substantial prose. It records editorial
  state and must not be promoted to `final` without editorial approval.
- Relations prose comes from `## RELATIONS`; `relations_data` supplies its
  structural numbers and labels.

## Parser boundaries

- `lib/oracle/card-markdown.ts` is the runtime-neutral parser and six-lens
  mapper. It has no Vite or filesystem dependency.
- `data/cardMarkdown.ts` is the browser adapter. It supplies raw Markdown with
  `import.meta.glob`, caching, and moving-line lookup.
- `data/synthesisData.ts` maps all six browser panels from Markdown. There is
  no JSON prose fallback.
- `mcp/oracle-server/src/corpus.ts` reads and validates all 64 manuscripts for
  Node, then builds the shared `CanonicalCard` representation.

The shared mapping preserves the existing public shapes:

- CODE → keywords, glance reading, and essence.
- ICHING → name, trigrams, reading, judgement, image, and six moving lines.
- KEYS → Shadow, repressive/reactive natures, Gift, and Siddhi.
- DESIGN → gate/drive, centre, and channel.
- BODY → physiology and amino acid.
- RELATIONS → unity line, pair, inverse, programming partner, codon ring,
  Tarot, Immortals, sky, and Hebrew-letter material when authored.

## Linked and separate data

Two systems deliberately remain outside the card manuscripts:

- `data/mockData.ts` links artwork identifiers and presentation metadata to a
  card number. It is linked metadata, not authored Oracle prose.
- Personal/live invocations use the reflection composer and its versioned D1
  metadata/live pointer plus private R2 Markdown artifact. Invocations are not
  merged into the canonical card corpus.

## Browser, REST, search, and MCP flow

```text
oracle/cards/01.md … 64.md
        ├── Vite raw-Markdown adapter ──> browser reader
        └── validated Node corpus
                ├── local stdio Oracle MCP
                ├── data/oracle-corpus.json ──> REST + hosted MCP card tools
                └── data/oracle-search-index.json ──> browser/REST/hosted search
```

The JSON files under `data/` are deterministic deployment artifacts. They are
never editing surfaces. Regenerate them after any manuscript or artwork-link
change:

```bash
npm run build:oracle-corpus
npm run build:search-index
```

The complete search fields are retained so hosted search and local MCP search
rank the same manuscript text.

## Validation and verification

The corpus loader rejects missing files, filename/frontmatter mismatches,
duplicates, out-of-range numbers, unknown trigrams, duplicate six-line binary
structures, missing lenses, missing required prose, and incomplete moving
lines. Do not replace these failures with compatibility fallbacks.

Before reporting parser or runtime work complete, run:

```bash
npm run typecheck
npm run test:unit
npm --prefix mcp/oracle-server run typecheck
npm --prefix mcp/oracle-server run smoke
npm run build
```

For browser-facing changes, also inspect representative rendered cards,
including Relations and moving lines, on desktop and mobile. A typecheck alone
does not prove the reader is visually correct.

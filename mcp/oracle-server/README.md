# Oracle MCP server

An MCP server for the Universal Language Oracle. It makes the 64 codes
queryable — search them by meaning, read any voice whole, draw a moving line,
cast a hexagram, find the artwork for a code, and assemble a reading scaffold —
from your Claude client, with no network and no auth.

Phase 1 of [`docs/oracle-mcp-integration-plan.md`](../../docs/oracle-mcp-integration-plan.md).

## What it indexes

The corpus is built **in memory** at startup by merging every complete on-disk
source — it does **not** write to `oracle/generated/` (the live site renders
from there), so the website is untouched:

| Source | Contributes |
|---|---|
| `oracle/oracle_cards_complete.json` | structural facts (trigrams, ring, gate), all 64 |
| `oracle/synthesis/key_N.json` | synthesis prose + keywords + essence, all 64 |
| `oracle/sections/{keys,design,iching,body}/NN(.deep).json` | bridge rewrites + the 6 moving lines |
| `oracle/generated/NN.json` | `glance.reading` / `invocation` (card 01) |
| `data/mockData.ts` `FULL_ARCHIVE` | the artwork ↔ code link (UL pieces) |

All 64 codes load with their keywords, six moving lines, and linked artwork.

## Tools

| Tool | What it does |
|---|---|
| `search_oracle` | Rank the 64 codes for a free-text query (`"creation and new beginnings"`). Explainable: reports the matched keywords + a snippet. |
| `get_card` | Full canonical object for one code (by number or name). |
| `get_voice` | One voice whole: `glance` · `iching` · `gene_keys` · `human_design` · `tarot` · `body`. |
| `get_line` | One of the six moving lines, with the hexagram it transitions into. |
| `list_cards` | All 64 (number, name, ring, keywords, artwork count); filter by ring. |
| `find_artworks` | The UL artwork(s) for a code — by number/name **or** by query (searches first). |
| `compose_reading` | Assemble the *material* for a reading (Glance + chosen voices + optional artwork/line) for you to render in the deck's voice. |
| `cast_hexagram` | Three-coin cast → primary code, moving lines, resulting code. |

## Run

```bash
cd mcp/oracle-server
npm install        # installs the MCP SDK + tsx
npm run smoke      # sanity-check the corpus, search, and cast against real data
npm start          # start the stdio server
```

## Register in a client

**Claude Code (this repo).** Run `npm install` in this folder once, then add the
server (run from the repo root):

```bash
claude mcp add oracle -- npx tsx mcp/oracle-server/src/server.ts
```

To make it available to anyone who opens the repo, commit a project-scoped
`.mcp.json` at the repo root with the same `command`/`args` (note: Claude Code
prompts each user to approve project MCP servers before they run).

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "oracle": {
      "command": "npx",
      "args": ["tsx", "/ABSOLUTE/PATH/TO/mandalacodes/mcp/oracle-server/src/server.ts"]
    }
  }
}
```

Paths resolve relative to the server file, so the working directory the client
spawns it in does not matter.

## Notes & roadmap

- **Rights (CONCEPT §11).** This local server may surface the deck's own
  synthesized prose for authoring. Any *hosted/public* surface (Phase 3) must
  serve own-voice content only — never the raw vault source translations. Bake
  that as a build-time allowlist before going remote.
- **Search is keyword + concept-expansion, transparent, offline.** The shared
  ranker (`lib/oracle/ranker.ts`) expands a query through a concept ontology
  tuned to the deck's vocabulary, so lexically-distant intent matches land — e.g.
  *Earth's Breath* now tops "creation and new beginnings" via its keywords
  *Originating Force / Creative Impulse / Genesis / Pure Potential*, and the hit
  explains itself ("related keywords: …"). Pass `literal: true` to match only the
  typed terms. Hosted embeddings can later layer on behind the same `rank()`
  signature for cases the ontology doesn't cover.
- **Moving-line coverage** depends on the `oracle/sections/iching/` files; lines
  not yet authored return a clear note rather than inventing text.
- The corpus loader (`src/corpus.ts`) is the single merge point. When the
  Phase-0 normalization to canonical `oracle/generated/` lands, point it there;
  every tool keeps working unchanged.

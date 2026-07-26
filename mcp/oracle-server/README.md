# Oracle MCP server

The Oracle MCP makes all 64 Universal Language cards queryable from an MCP
client: search by meaning, read a complete card or lens, draw a moving line,
cast a hexagram, find linked artwork, or assemble a reading scaffold.

## Content authority

The local server reads `oracle/cards/01.md` through `oracle/cards/64.md` at
startup. Those manuscripts are the sole source of authored card prose. The
loader validates the complete set and fails closed when a numbered file,
required lens, required passage, moving line, or structural mapping is missing
or malformed.

It does not refill prose from `oracle/oracle_cards_complete.json`,
`oracle/synthesis/`, `oracle/sections/`, `oracle/generated/`, or archives.

Two linked systems remain deliberately separate:

| Source | Role |
| --- | --- |
| `data/mockData.ts` | Artwork identifiers and presentation metadata linked by card number. |
| D1 + private R2 invocation publication | Versioned personal/live invocations; not merged into the canonical card corpus. |

The hosted REST API and remote MCP cannot read repository files at runtime, so
they consume deterministic `data/oracle-corpus.json` and
`data/oracle-search-index.json` artifacts built from this same loader. These
JSON files are deployment outputs, not places to write Oracle prose.

## Tools

| Tool | What it does |
| --- | --- |
| `search_oracle` | Rank the 64 cards for free-text meaning and return explainable matches. |
| `get_card` | Return the complete canonical object by number or name. |
| `get_voice` | Return `glance`, `iching`, `gene_keys`, `human_design`, `tarot`, or `body`. |
| `get_line` | Return one of six moving lines and its resulting hexagram. |
| `list_cards` | List all cards, optionally filtered by codon ring. |
| `find_artworks` | Find artwork linked to a card number/name or the top search match. |
| `get_reading` | Return an authored local artwork reading, or a scaffold when none exists. |
| `compose_reading` | Assemble source material for a reading without inventing final prose. |
| `cast_hexagram` | Perform a three-coin cast and return primary/resulting cards. |

The hosted MCP exposes the read-only public subset defined in
`lib/oracle/tool-defs.ts`. Local-only reading composition helpers are not added
to the hosted surface.

## Run and verify

From the repository root:

```bash
npm --prefix mcp/oracle-server install
npm --prefix mcp/oracle-server run typecheck
npm --prefix mcp/oracle-server run smoke
npm --prefix mcp/oracle-server start
```

The smoke test loads all 64 Markdown cards and checks corpus, moving-line,
artwork, casting, and one representative hosted/local search-parity query. Full
64-card and complete-search-document parity lives in
`tests/unit/oracleHostedApi.test.ts` and `tests/unit/oracleHostedTools.test.ts`.

After a manuscript or artwork-link change, regenerate the hosted artifacts:

```bash
npm run build:oracle-corpus
npm run build:search-index
```

## Register the local stdio server

Claude Code, from the repository root:

```bash
claude mcp add oracle -- npx tsx mcp/oracle-server/src/server.ts
```

Claude Desktop (`claude_desktop_config.json`):

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

Paths used by the server resolve from its own file, so the spawning client's
working directory does not matter.

## Hosted endpoint

The existing stateless Streamable HTTP endpoint is:

```text
https://mandalacodes.com/api/oracle/mcp
```

Repository changes do not alter production until they are committed and
deployed. Verify the deployed endpoint separately from local tests.

## Writing rule

Never edit generated artifacts or legacy JSON to change a card. Edit the
matching `oracle/cards/NN.md`, preserve its editorial status and provenance,
regenerate both artifacts, and run the parity tests. See
[`../../oracle/INDEX.md`](../../oracle/INDEX.md) for the complete human/AI
workflow.

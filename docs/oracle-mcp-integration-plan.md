# Oracle MCP + Artwork Readings + Search — Integration Plan

How to make the Universal Language Oracle queryable over MCP, generate readings
that pair with the artworks, and search the whole corpus by *meaning* ("art
about creation and new beginnings" → the right code → the right piece).

This is a method document. It maps the current state to a working system in
phases, names the exact data and tools to build, and shows how each part wires
into everything else already running (the website, the Atlas, the content
pipeline, accounts/collections, and the mandala-authority SEO push).

**Read alongside:** `oracle/CONCEPT.md` (what the deck is), `oracle/SCHEMA.md`
(the canonical card shape), `oracle/PROJECT_PLAN.md` (deck content state),
`docs/ledger-architecture.md` (the Atlas backend pattern this reuses).

---

## 1. What you're actually asking for

Three capabilities, one spine:

1. **MCP access** — expose the oracle (the 64 codes, all four voices, the 384
   moving lines, the reference layer) as tools any MCP client can call: your
   Claude Code / Claude Desktop while authoring, and — later — the live site
   itself.
2. **Readings for artworks** — given a piece (a Universal Language sculpture),
   produce the reading that belongs to it. The link already exists: every UL
   piece *is* one of the 64 codes. We make that link explicit and let a tool
   compose the reading from the code's own material.
3. **Search by meaning** — "I'm looking for art about creation and new
   beginnings" resolves to Code 1 (*Earth's Breath* — originating force, first
   movement, pure beginning) and surfaces the artwork(s) and reading for it.

The spine that serves all three is **one canonical, indexed oracle dataset**
with **one query layer** on top, reachable from **two surfaces** (a local MCP
server now, a hosted one later that also powers on-site search).

---

## 2. Where things stand today (verified)

**Stack.** Vite + React SPA on Cloudflare Pages. Backend is Pages Functions
(`functions/api/*`). State in D1 (`mandalacodes-oracle`) + R2 (Atlas ledger).
Auth via Clerk. The public oracle reader is otherwise static JSON.

**Oracle data is fragmented across four shapes** — this is the first thing to
fix, because search and MCP both need one source:

| File set | What it is | Coverage | Verdict |
|---|---|---|---|
| `oracle/oracle_cards_complete.json` | Legacy flat data, live via `data/oracleData.ts` | 64 | In use, to be replaced |
| `oracle/generated/NN.json` | New canonical shape (`SCHEMA.md`) | **1 of 64** | The target format |
| `oracle/cards/NN.json` | Earlier per-card structure (`expandedOracleData.ts`) | **1 of 64** | Archive |
| `oracle/synthesis/key_N.json` | Rich generated synthesis — iching / gene_keys / tarot / human_design / body + keywords | **64 of 64** | **The richest on-disk corpus** |
| `oracle/reference/*.json` | Rings, channels, centers, trigrams, immortals (per SCHEMA §10) | **0** (not built yet) | To build |

The deepest source corpus (~2,460 files) lives in an **Obsidian vault outside
this repo**. The repo holds the *compiled* material. For MCP/search we index
what's in the repo; the vault feeds the authoring pipeline (§7.3).

**Artwork ↔ code link is implicit.** In `data/mockData.ts`, UL pieces are
titled `"<name> - <N>"` (e.g. `UL-122 → "Earth's Breath - 1"`), and the Atlas
seed comments map piece → hexagram. There is **no `cardNumber` field** on the
`Artwork` type yet. We make the link a real field (§6).

**No search exists.** Cards carry `keywords[]` but nothing indexes the prose.

**No MCP anything.** No `@modelcontextprotocol/sdk`, no server.

---

## 3. Architecture at a glance

```
                       ┌─────────────────────────────────────────┐
                       │  CANONICAL CORPUS  (oracle/generated/*,  │
                       │  oracle/reference/*, artwork↔code map)   │
                       │  built once from synthesis/ + vault      │
                       └───────────────┬─────────────────────────┘
                                       │  build step (scripts/build-oracle-index.ts)
                       ┌───────────────▼─────────────────────────┐
                       │  ORACLE INDEX  (cards.json + lines.json  │
                       │  + search index: keyword/BM25 now,       │
                       │  embeddings later)                       │
                       └───────┬───────────────────────┬─────────┘
                               │ (same query lib)       │
            ┌──────────────────▼─────┐        ┌─────────▼───────────────────┐
            │  LOCAL MCP SERVER      │        │  REMOTE MCP + /api/oracle/*  │
            │  (stdio, Node/TS)      │        │  (Cloudflare Worker, later)  │
            │  for Claude authoring  │        │  powers on-site search + a   │
            │  now                   │        │  hosted MCP endpoint         │
            └────────────────────────┘        └─────────┬───────────────────┘
                                                         │
                                              ┌──────────▼──────────┐
                                              │  WEBSITE  (oracle    │
                                              │  index, atlas, card  │
                                              │  pages, collections) │
                                              └─────────────────────┘
```

One corpus, one query library (`oracle/query/`), two transports (stdio MCP +
HTTP). The website and the hosted MCP call the *same* query code so search
behaves identically whether you ask from Claude or from the site.

---

## 4. Phase 0 — Unify the corpus (the prerequisite)

Everything downstream needs one source. Build it; don't let search read four
shapes.

**0.1 — Generate all 64 `oracle/generated/NN.json`** in the `SCHEMA.md` shape.
The `synthesis/key_N.json` files already hold the prose for every voice
(iching `reading`, gene_keys shadow/gift/siddhi, human_design gate/channel,
tarot, body, keywords). Write `scripts/normalize-synthesis.ts` to map
`synthesis/key_N.json` → `generated/NN.json`, carrying structural facts from
the existing `oracle_cards_complete.json`. Card 01 already exists as the
reference for the target shape. Mark every voice `status: "scaffold"` so the
Phase-2 authoring work (TODO) stays trackable. *This is reusable work the deck
needs regardless of MCP — it's the migration `oracle/TODO.md` already wants
(“retire the legacy oracle data files”).*

**0.2 — Build `oracle/reference/*.json`** (rings, channels, centers, trigrams,
immortals) per SCHEMA §10, from the synthesis `reference` blocks + the vault.
Single-sources the shared teachings so cards reference by slug.

**0.3 — One loader.** Add `oracle/query/corpus.ts` — the single module that
loads `generated/*` + `reference/*` into typed objects. The website's
`data/oracleData.ts`, the MCP server, and the search index all import from
here. Delete the duplicate type definitions over time.

**Rights guardrail (CONCEPT §11).** The corpus that ships to *any* public or
remote surface contains **only the deck's own synthesized prose** — never the
raw Wilhelm/Rudd/Legge source text from the vault. The local authoring MCP may
read sources (you're the author); the hosted MCP and site serve own-voice only.
Bake this as a field-level allowlist in the build step, not a manual rule.

---

## 5. Phase 1 — The local MCP server (do this first, ship value immediately)

A Node/TS stdio server using `@modelcontextprotocol/sdk`, living at
`mcp/oracle-server/` (or a sibling package). It reads the canonical corpus
directly from disk — no network, no deploy, works offline. You add it to Claude
Code / Claude Desktop and immediately query the oracle while you write, place
pieces, or draft pages.

### 5.1 Tools

| Tool | Input | Returns |
|---|---|---|
| `search_oracle` | `query`, optional `{ systems[], limit, mode: keyword\|semantic }` | Ranked codes with score + the matched snippet + why |
| `get_card` | `number` **or** `name` | Full canonical card object |
| `get_voice` | `number`, `voice: glance\|iching\|gene_keys\|human_design\|relations` | That one voice, whole |
| `get_line` | `number`, `line: 1–6` | The moving-line reading + `transition_to` |
| `list_cards` | optional `{ ring, center, trigram }` | Index rows (number, name, keywords) |
| `get_reference` | `kind: ring\|channel\|center\|trigram\|immortal`, `slug` | The shared teaching |
| `find_artworks` | `query` **or** `card` | UL pieces for that code (id, title, image, Atlas placement, buy URL) |
| `compose_reading` | `{ card \| artwork }`, `{ context?, length, voices[], includeLine? }` | A structured reading scaffold + the source voices, for Claude to render into final prose |
| `cast_hexagram` | optional `{ question }` | A draw: primary code, moving lines, resulting code — mirrors `CoinCast.tsx` |

Notes that matter:

- **`search_oracle` is the headline.** "art about creation and new beginnings"
  → Code 1 because its keywords (*Origination, First Movement, Pure
  Beginning*) and its `reading`/`iching` prose carry those terms. Phase 1 uses
  a transparent keyword/BM25 rank over `keywords + glance.reading +
  iching.intro/interpretation + gene_keys` so results are explainable. Phase 3
  adds embeddings for true semantic matching (§8).
- **`compose_reading` does not fake prose.** It assembles the *right material*
  (the chosen voices, the artwork's context, an optional drawn line) into a
  scaffold and hands it back; Claude writes the final reading in the deck's
  voice, on method. This keeps every generated reading faithful to
  CONCEPT/`00`–`06` instead of inventing a parallel voice. Optionally it caches
  the result to `oracle/readings/<artworkId>.md` (§6.2).
- **`find_artworks` is the artwork bridge.** It reads the artwork↔code map
  (§6) + the Atlas state, so a code answer always knows its physical pieces.

### 5.2 Why local first

No infra, no auth, no cost. It's useful the day it's written — for authoring
the 384 lines, drafting artwork copy, checking connections, and answering your
own "which code is about X" questions. It also de-risks the query library
before you expose it on the web.

---

## 6. Phase 2 — Make the artwork ↔ code link real, and attach readings

**6.1 — Add the link as data.** Put `cardNumber?: number` on the `Artwork`
type (`types.ts`) and populate it for the UL series (derive once from the
`"- N"` title suffix via a script, then it's explicit and queryable). Now an
artwork knows its code without string-parsing, and `find_artworks` /
`search_oracle` can join cleanly. This also lets the card page list "where this
code lives in the world" (Atlas) and the piece page show its reading.

**6.2 — Reading storage.** Two modes, pick per surface:
- **On-demand** — `compose_reading` builds it live (good for Claude sessions,
  for variation, for a fresh draw).
- **Cached** — store an authored, final reading per artwork at
  `oracle/readings/<artworkId>.md` (front-matter: card, voices used, length).
  Cached readings are what the *website* renders (stable, reviewable,
  SEO-indexable). The same content already exists per *code* in
  `generated/NN.json`; per-*artwork* readings add the piece-specific frame
  (its title, its materials, its place in the Atlas) on top of the code.

**6.3 — Reading shape.** A reading = the code's `glance.reading` (the woven,
system-agnostic heart) + optionally one voice opened + optionally a drawn line,
wrapped with the artwork's identity. This is exactly the CONCEPT §4 “Glance,
then a voice” structure — readings reuse the deck's own architecture rather
than a new format.

---

## 7. How it connects into everything you're doing

### 7.1 The website (on-site search + richer pages)
The hosted query layer (§8) backs a new Function `GET /api/oracle/search?q=…`
(sits alongside `functions/api/*`, added to `public/_routes.json`). Wire a
search box into `OracleGateway` / `UniversalLanguageIndex`: a seeker types
"creation and new beginnings," lands on Code 1, sees the reading, and — via the
artwork link — the actual sculpture and its Atlas placement, with the "view the
original" CTA out to adrianrasmussen.com (the existing cross-pollination, TODO
op-note). Search turns the index from a grid into a *doorway by meaning*.

### 7.2 The Atlas
`find_artworks` already joins code → piece → city. The reverse is powerful too:
clicking a placed piece on the globe can pull its reading. Search → code →
"see where this code is in the world" closes the loop between the oracle and
the map (CONCEPT §8, "the map teaches the global structure").

### 7.3 The content pipeline (the 384 lines, the invocations, Phase-2 passes)
This is the biggest near-term lever. `oracle/TODO.md` wants the 384
changing-line texts and the Phase-2 personal passes written on method. With the
MCP server, your authoring Claude can `get_voice`, `get_line`, `get_reference`,
and pull the *vault* synthesis for a code in one call — instead of you
hand-feeding context. The `/cast-content` work (TODO line 12) gets a tool
backend. *MCP makes the deck cheaper to finish, not just cheaper to query.*

### 7.4 Accounts & collections
`collection_items.kind` already reserves `'artwork'` (migration 001). Once
artworks carry readings, "save this reading / save this piece" drops straight
into the existing collections API — no schema change. A signed-in seeker builds
a personal set of codes + pieces + readings.

### 7.5 The mandala-authority / SEO push
Cached per-artwork readings (§6.2) are real, original, on-topic content for the
card and piece pages — exactly the editorial depth the authority strategy
wants. Semantic search improves on-site discovery and dwell. The MCP also lets
you draft the SEO article cluster (TODO §Mandala Authority) with the oracle as
a research tool.

### 7.6 Future decks (Light Codes, others)
Build the corpus + query + MCP generically over a `deck` dimension. The route
for Light Codes is already reserved (TODO "Future"). Same tools, second deck —
the MCP server becomes "the home for all things mandala," queryable.

---

## 8. Phase 3 — Hosted query layer + semantic search

When local MCP proves the shape, lift the *same* `oracle/query/` library into a
Cloudflare Worker. Two endpoints from one codebase:

- **`/api/oracle/*` Pages Functions** — `search`, `card`, `reading` — for the
  website (§7.1). Reuses the existing Functions + `_routes.json` pattern.
- **A remote MCP endpoint** (HTTP/SSE) — the oracle as a *hosted* MCP server,
  callable from Claude anywhere, not just your laptop. Cloudflare supports
  remote MCP on Workers; auth can reuse Clerk or a scoped key.

**Semantic search.** Replace/augment keyword rank with embeddings so "art about
creation and new beginnings" matches Code 1 even with zero shared words.
- Embed each code's `keywords + glance.reading + voice essences` once at build
  time (Voyage or OpenAI embeddings; or a local model for offline).
- Store vectors in **Cloudflare Vectorize** (native to the Workers stack you're
  already on) for the hosted path; a flat `oracle/index/embeddings.json` for
  the local path.
- `search_oracle` ranks by cosine similarity, with the keyword score as a
  tie-breaker and for explainability ("matched on: First Movement, Pure
  Beginning").

Keep keyword search as the floor — it's transparent, needs no API key, and is a
correct fallback when embeddings are unavailable.

---

## 9. Build order (each step ships something usable)

1. **Phase 0** — normalize all 64 → `generated/NN.json`, build `reference/*`,
   add `oracle/query/corpus.ts`. *(Also clears an existing deck-migration
   TODO.)*
2. **Phase 1** — local MCP server (`mcp/oracle-server/`) with `search_oracle`,
   `get_card`, `get_voice`, `get_line`, `list_cards`, `get_reference`,
   `cast_hexagram`. Keyword search. **Usable in Claude the same day.**
3. **Phase 2** — `cardNumber` on `Artwork`, the artwork↔code map,
   `find_artworks` + `compose_reading`, optional `oracle/readings/` cache.
4. **Phase 3a** — lift `oracle/query/` into `/api/oracle/search`; add the
   website search box.
5. **Phase 3b** — embeddings + Vectorize; semantic ranking.
6. **Phase 3c** — hosted remote MCP endpoint.
7. **Later** — generalize over `deck` for Light Codes.

Phases 0–2 need no new infrastructure or spend. Phase 3 reuses Cloudflare
primitives already provisioned (Functions, D1, R2) plus Vectorize.

---

## 10. Decisions worth your call before building

- **Reading authorship.** Should website-facing artwork readings be *authored
  once and cached* (stable, reviewable, on-method — recommended) or *generated
  live* (fresh, variable, but unreviewed)? Recommend cached for the site,
  on-demand only inside Claude sessions.
- **Embedding provider.** Hosted (Voyage/OpenAI — best quality, an API key +
  small cost) vs local model (free, offline, slightly weaker). The query layer
  is provider-agnostic; this is swappable later. Keyword search ships first
  regardless.
- **Remote MCP auth.** Public read-only, or gated behind Clerk / a scoped key?
  Recommend public read-only for `search`/`get_card` (it's published deck
  content) and keep `compose_reading`/authoring tools local-only.
- **Scope of "info".** This plan covers the oracle corpus + artworks. If "the
  info" also means the SEO research docs, the Atlas ledger, or the poetry, say
  so — each can become an additional MCP resource over the same query layer.

---

## 11. The one-paragraph version

Unify the 64 codes into one canonical, own-voice corpus; put one query library
over it; expose that first as a local MCP server you use today to author and to
ask "which code is about X," then lift the same library onto Cloudflare to power
both on-site semantic search and a hosted MCP. Make the artwork→code link a real
field so every piece resolves to its reading, and let readings reuse the deck's
own Glance-plus-voice structure. Search by meaning becomes the doorway into the
deck; the MCP becomes the engine that both finishes the deck and serves it.

# Oracle Phase 3c — Hosted search + remote MCP (deployment plan)

The last piece of [`oracle-mcp-integration-plan.md`](./oracle-mcp-integration-plan.md):
put the query layer that already runs locally onto a public URL — a REST search
endpoint for the website and external callers, and the oracle as a **hosted MCP
server** callable from Claude anywhere, not just your laptop.

Nothing here is live yet. This is the review-before-deploy plan: architecture,
paste-ready code matched to your existing `functions/api/*` conventions, auth
options, the embeddings upgrade path, and the exact deploy/verify/rollback
steps. Deploying touches your Cloudflare account, so it waits for your go.

**Already shipped (Phases 1–3b):** the local MCP server (`mcp/oracle-server/`),
the shared ranker (`lib/oracle/ranker.ts`) with concept expansion, the prebuilt
search index (`data/oracle-search-index.json`), the artwork↔code link, and the
on-site client-side search. 3c reuses every one of these.

---

## 1. What 3c delivers

| Surface | Route | For |
|---|---|---|
| **REST search** | `GET /api/oracle/search?q=…` | external callers, server-rendered search, the Atlas, future decks — anything that can't bundle the index |
| **REST card** | `GET /api/oracle/card?n=…` | fetch one code server-side |
| **Remote MCP** | `POST /api/oracle/mcp` | the oracle as a hosted MCP server — Claude (web/desktop/anywhere) calls `search_oracle`, `get_card`, `get_voice`, `find_artworks`, `cast_hexagram` without your machine |

All three are **read-only published deck content.** The authoring tools
(`compose_reading`, the readings scaffolder) stay local-only — they're for you,
not the public.

---

## 2. The one hard constraint, and how we satisfy it

**Pages Functions run on the Workers runtime — there is no `fs`.** The local MCP
server builds its corpus by reading 64 `synthesis/*.json` files from disk; that
cannot happen in a Worker. So 3c reads **prebuilt JSON artifacts bundled into
the Function** instead:

- `data/oracle-search-index.json` — already built (the compact SearchDoc array).
- `data/oracle-corpus.json` — **new**: the full 64 `CanonicalCard` objects, for
  `get_card` / `get_voice` / `find_artworks`. Built from the same
  `mcp/oracle-server/src/corpus.ts` loader at build time (Node, has `fs`), then
  imported by the Function (Workers, no `fs`).

Both are small (index ~84 KB gzip; full corpus ~150 KB gzip) — fine to bundle.
If they ever grow past the Functions bundle budget, move them to **KV** or an
**R2** object fetched at request time; the code below isolates loading so that's
a one-function change.

```
build (Node, fs)                       request (Workers, no fs)
─────────────────                      ────────────────────────
corpus.ts ──► data/oracle-corpus.json ─┐
            ► data/oracle-search-index ─┤──► import ──► lib/oracle/ranker.ts
                                        │                (shared, pure)
                                        └──► /api/oracle/{search,card,mcp}
```

The ranker is the **same `lib/oracle/ranker.ts`** the local MCP and the website
use. One scoring brain, now three hosts.

---

## 3. Step 1 — Build the full-corpus artifact

New script, mirroring `scripts/build-search-index.ts`:

```ts
// scripts/build-oracle-corpus.ts
import { writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCorpus } from '../mcp/oracle-server/src/corpus.ts';
import { loadReadings } from '../mcp/oracle-server/src/readings-cache.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const corpus = await loadCorpus();
// Strip the giant searchText blob (the index already carries search fields).
const slim = corpus.map(({ searchText, ...card }) => card);
const readings = [...(await loadReadings()).values()];
await writeFile(
  resolve(root, 'data/oracle-corpus.json'),
  JSON.stringify({ cards: slim, readings }, null, 0) + '\n',
);
console.log(`[corpus] wrote ${slim.length} cards + ${readings.length} readings`);
```

Wire it into `prebuild` alongside the index so it never goes stale:

```jsonc
// package.json
"prebuild": "tsx scripts/build-search-index.ts && tsx scripts/build-oracle-corpus.ts",
```

---

## 4. Step 2 — Extract a shared tool dispatch (so local + remote are identical)

Today the tool *logic* lives inside `mcp/oracle-server/src/server.ts`, coupled to
the fs corpus. Factor the pure part out so both the local stdio server and the
remote Function call the **same handlers**:

```ts
// mcp/oracle-server/src/tools.ts  (new — pure, no fs, no transport)
import type { CanonicalCard } from './corpus.ts';
import type { CachedReading } from './readings-cache.ts';
import { searchCorpus } from './search.ts';
import { castHexagram } from './cast.ts';

export interface ToolDeps { corpus: CanonicalCard[]; readings: Map<string, CachedReading>; }

export const TOOL_DEFS = [ /* the JSON-schema tool list, moved out of server.ts */ ];

export function dispatch(name: string, args: any, deps: ToolDeps) {
  // the existing switch from server.ts, operating on deps.corpus / deps.readings
  // returns a plain JS value (the tool result payload)
}
```

- `server.ts` (local) keeps building the corpus from `fs`, then calls
  `dispatch(...)`. No behaviour change.
- The remote Function builds `deps` from the bundled JSON, then calls the same
  `dispatch(...)`. Identical results, guaranteed.

`compose_reading` and any authoring tool are simply **omitted from `TOOL_DEFS`
on the remote** (a `PUBLIC_TOOLS` subset), so the hosted server exposes only the
read surface.

---

## 5. Step 3 — The REST search Function

```ts
// functions/api/oracle/search.ts
import { rank, type SearchDoc } from '../../../lib/oracle/ranker';
import index from '../../../data/oracle-search-index.json';

const DOCS = index as unknown as SearchDoc[];
const CORS = {
  'Access-Control-Allow-Origin': '*',          // published content; tighten if desired
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'public, max-age=300',
};

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { headers: CORS });

export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').slice(0, 200);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 8, 24);
  const literal = url.searchParams.get('literal') === '1';
  if (!q.trim()) {
    return new Response(JSON.stringify({ hits: [] }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
  const hits = rank(DOCS, q, { limit, expand: !literal });
  return new Response(JSON.stringify({ query: q, hits }), {
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
};
```

`_routes.json` already includes `/api/*`, so this is invoked automatically on
deploy. (`/api/oracle/card` is the same shape, reading `data/oracle-corpus.json`
and returning one card by `?n=`.)

**Note on the site search box:** the client-side search shipped in 3a stays — it's
instant and offline. This endpoint is for *external* callers and server-side
needs. They share the ranker, so results match. Optionally switch the box to the
endpoint later to shrink the bundle; not required.

---

## 6. Step 4 — The remote MCP endpoint (stateless Streamable HTTP)

**The key design choice.** Cloudflare's headline remote-MCP path (`agents` /
`McpAgent`) needs **Durable Objects**, which are awkward to define inside Pages
Functions. But the oracle's tools are **stateless reads** — no session, no
memory between calls. So the right fit here is a **stateless Streamable HTTP MCP
server**: one POST endpoint that speaks JSON-RPC and answers each request with
`application/json`. No Durable Objects, no sessions, drops straight into Pages.

```ts
// functions/api/oracle/mcp.ts
import { PUBLIC_TOOL_DEFS, dispatch, type ToolDeps } from '../../../mcp/oracle-server/src/tools';
import index from '../../../data/oracle-search-index.json';
import corpusData from '../../../data/oracle-corpus.json';

// Build deps once per isolate from the bundled artifacts (no fs).
const deps: ToolDeps = {
  corpus: (corpusData as any).cards,
  readings: new Map(),            // authored readings stay local; none served remotely
};

const PROTOCOL = '2024-11-05';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  // optional bearer gate — see §7
  const msg = await request.json<any>();
  const reply = (result: unknown) => json({ jsonrpc: '2.0', id: msg.id, result });

  switch (msg.method) {
    case 'initialize':
      return reply({
        protocolVersion: PROTOCOL,
        capabilities: { tools: {} },
        serverInfo: { name: 'oracle', version: '0.1.0' },
      });
    case 'notifications/initialized':
      return new Response(null, { status: 202 });        // ack, no body
    case 'tools/list':
      return reply({ tools: PUBLIC_TOOL_DEFS });
    case 'tools/call': {
      try {
        const value = dispatch(msg.params.name, msg.params.arguments ?? {}, deps);
        return reply({ content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] });
      } catch (e) {
        return reply({ content: [{ type: 'text', text: `Error: ${(e as Error).message}` }], isError: true });
      }
    }
    default:
      return json({ jsonrpc: '2.0', id: msg.id ?? null,
        error: { code: -32601, message: `method not found: ${msg.method}` } });
  }
};
```

Register it in Claude as a **custom connector / remote MCP server** pointing at
`https://mandalacodes.com/api/oracle/mcp`. Claude's Streamable-HTTP client
accepts a plain `application/json` response, so no SSE is required for these
read tools.

> **Alternative (only if you later want sessions/OAuth/streaming):** a standalone
> Worker using Cloudflare's `agents` `McpAgent` + a Durable Object, deployed
> separately from the Pages site. More moving parts; unnecessary for read-only
> tools. Keep the stateless Function unless a future tool needs per-session state.

---

## 7. Auth — recommendation and options

The hosted surface is **published deck content**, so the simplest correct stance
is **public, read-only**:

- **REST search/card** — public, CORS `*`, cached 5 min. (Tighten the origin to
  `mandalacodes.com` if you'd rather not let other sites call it.)
- **Remote MCP** — public read-only, OR a **shared-secret bearer** if you want it
  private to you:

  ```ts
  // top of onRequestPost, before parsing
  const required = env.ORACLE_MCP_TOKEN;
  if (required) {
    const tok = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (tok !== required) return json({ error: 'unauthorized' }, 401);
  }
  ```

  Set `ORACLE_MCP_TOKEN` in the Pages dashboard (and via the secrets-sync
  script) and put the same token in Claude's connector config. Leave it unset
  for public access.

- **Clerk** is already wired (`functions/api/_lib/clerk.ts`) if you ever want
  per-user gating, but it's overkill for read-only published content.

**Authoring tools never go remote.** `compose_reading` and the scaffolder remain
in the local stdio server only — the `PUBLIC_TOOL_DEFS` subset enforces this.

---

## 8. The embeddings upgrade — no external key needed

Phase 3b shipped concept-expansion (offline, no key). If you later want **true
vector semantics** for queries the ontology doesn't cover, the cleanest path on
your stack avoids the OpenAI/Voyage key-and-cost decision entirely:

- **Workers AI** runs an embedding model *on Cloudflare* — e.g.
  `@cf/baai/bge-base-en-v1.5` (768-dim). Just an `AI` binding in `wrangler.toml`;
  no third-party key, billed through your CF account.
- **Vectorize** stores the 64 code vectors. Embed each code's text once at build
  (or via a one-off Worker), `upsert` into a Vectorize index.
- At query time the MCP/search Function embeds the query via Workers AI, queries
  Vectorize for nearest codes, and **blends** that score with the lexical+concept
  score from `rank()` — same `RankHit` shape, same `/search` surface.

This is additive and optional: the ontology already handles the common cases.
Vectors are worth adding only if you see real queries it misses. Documented here
so the path is known; not part of the core 3c deploy.

---

## 9. Deploy / verify / rollback

**Deploy (your account):**
1. `npm run build` locally — confirms the two artifacts generate and the
   Functions typecheck/bundle.
2. Commit the new Function files + `data/oracle-corpus.json`.
3. Push to `main` → Cloudflare Pages auto-builds and deploys (per your existing
   GitHub→Pages hookup). The new routes go live; nothing existing changes.
4. (If gating) set `ORACLE_MCP_TOKEN` in the Pages dashboard + secrets-sync.

**Verify:**
- `curl 'https://mandalacodes.com/api/oracle/search?q=creation+and+new+beginnings'`
  → top hit `#1 Earth's Breath`.
- `npx @modelcontextprotocol/inspector` (or Claude's connector UI) against
  `/api/oracle/mcp` → `initialize` + `tools/list` show the public tools;
  `search_oracle` returns hits.

**Rollback:** the Functions are purely additive on new routes. To disable,
delete the files (or remove the routes) and redeploy — no migrations, no state,
zero impact on the existing site, accounts, or Atlas.

---

## 10. Effort & sequencing

| Step | Effort | Notes |
|---|---|---|
| 1 · `build-oracle-corpus.ts` + prebuild wire-in | quick | mirrors the index script |
| 2 · extract `tools.ts` shared dispatch | moderate | refactor of existing `server.ts`, no behaviour change |
| 3 · `/api/oracle/search` (+ `/card`) | quick | code above, paste-ready |
| 4 · `/api/oracle/mcp` stateless server | moderate | code above; test with MCP Inspector |
| 5 · auth decision + (optional) token gate | quick | one env var |
| 6 · embeddings via Workers AI + Vectorize | deep | **optional**, defer until needed |

Steps 1–4 are a single focused session and need **no new Cloudflare primitives**
(no D1/R2/DO/Vectorize) — just two bundled JSON files and three Functions on
routes you already serve. Step 6 is the only part that provisions anything, and
it's optional.

---

## 11. Decisions for you

1. **Remote MCP visibility** — public read-only (simplest, it's published
   content) **or** private behind `ORACLE_MCP_TOKEN`? *Recommend: start with the
   token gate so it's yours, drop it later if you want it public.*
2. **REST CORS** — open (`*`, lets the Atlas/other tools call it) or locked to
   `mandalacodes.com`? *Recommend: open; it's read-only public content.*
3. **Embeddings** — leave at concept-expansion for now, or add Workers AI +
   Vectorize? *Recommend: wait until you see queries the ontology misses.*
4. **Who deploys** — you push to `main` and let Pages build, or want me to stage
   the Function files on a branch for you to review and merge?

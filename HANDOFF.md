## State — what works, what's stubbed, what's untested.

PR #9 merged to `main` (2026-06-09): oracle MCP, semantic search, artwork↔code link + readings, hosted Functions, chart→art lookbook + recommendation engine. Cloudflare Pages auto-deploys `main`.

Works (verified locally / at handler level):
- Local MCP server, 9 tools, all 64 codes — `mcp/oracle-server/` (stdio + smoke pass).
- Shared ranker + concept-expansion search — `lib/oracle/ranker.ts`; live on the `/universal-language` deck-index search box.
- Functions `/api/oracle/{search,card,mcp,recommendation}` — handlers + token gate verified over the bundled JSON artifacts.
- Recommendation engine — `lib/oracle/recommendation.ts`: a ready `profile` OR `utcBirth` → pieces + energy + resolved curator picks.
- Chart→art lookbook CLI — `scripts/chart-lookbook/` (HTML always; PDF via Playwright or browser print).

Stubbed / partial:
- `oracle/readings/`: only UL-122 authored; other 63 absent (engine falls back to scaffold).
- Embeddings not built — concept-expansion only (Workers AI + Vectorize is the optional later path).
- No UI for the curation/recommendation flow yet — engine only.

Untested:
- Live deployed endpoints not yet curl-verified against `mandalacodes.com` (only local + handler-level).
- PDF render not run here (sandbox: Cloudinary 403 + no Playwright browser) — renders on a real machine.

Cross-site: meaning engine lives here; the **Curation Desk + purchase** belong on the Adrian Rasmussen quote system (repo `technicianofthesacred/Adrian-Website`, not in this session's scope) — not started.

## Next — the exact commands or steps to continue, one per line, specific enough to paste.

curl 'https://mandalacodes.com/api/oracle/search?q=creation+and+new+beginnings'   # expect top hit #1 Earth's Breath
curl -X POST https://mandalacodes.com/api/oracle/recommendation -H 'content-type: application/json' -d '{"clientName":"Test","utcBirth":"1990-06-09T14:30:00Z"}'   # expect 11 pieces + energy
cd mcp/oracle-server && npm install && cd ../.. && claude mcp add oracle -- npx tsx mcp/oracle-server/src/server.ts   # local MCP in Claude
npx tsx scripts/chart-lookbook/generate.ts scripts/chart-lookbook/sample-profile.json --name "Adrian" --pdf   # sample lookbook → HTML/PDF
# In Cloudflare Pages dashboard: set ORACLE_MCP_TOKEN and/or ORACLE_API_TOKEN to gate the remote MCP / recommendation API (optional)
# In Claude: add custom connector → https://mandalacodes.com/api/oracle/mcp
# To build the Curation Desk: list_repos → add_repo technicianofthesacred/Adrian-Website, open the quote-system page, wire it to POST /api/oracle/recommendation per todo/plans/adrian-quote-integration.md

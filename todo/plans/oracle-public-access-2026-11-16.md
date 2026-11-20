# Oracle public access — Adrian’s decisions, 2026-11-16

## Owner decisions

Adrian selected:

- **“Keep read-only Oracle tools public (Recommended)”** for the hosted Oracle’s seven tools, which expose published deck content rather than authoring tools.
- **“Only integrations with a server-held key (Recommended)”** for personalized chart-to-art recommendations. The shared integration key stays on the server, never in browser code.
- **“Use the synthetic chart (Recommended)”** for this exact verification input:

```json
{"profile":{"lifesWork":{"gate":1,"line":1}}}
```

The synthetic input contains no client name or birth date. It authorizes the stated recommendation check, not use of a real person’s data.

## Scope

REST card/search and public read-only MCP remain available. Recommendation POST requires `ORACLE_API_TOKEN`; missing configuration must fail closed. This is a service-to-service key, not a visitor login. Existing input/output contracts, public endpoint metadata, unauthenticated CORS preflight and no-store responses remain intact. Authoring, private recordings, invocations and collector routes retain their existing access boundaries.

## Verification and release

Local implementation is complete in `functions/api/oracle/recommendation.ts`. POST returns HTTP 503 when `ORACLE_API_TOKEN` is absent or empty; a configured endpoint rejects missing, incorrect or non-Bearer credentials with HTTP 401. A correct bearer key preserves the existing recommendation response. Endpoint metadata and CORS preflight remain unauthenticated, with no-store responses. Public card/search/MCP handlers are unchanged.

The approved synthetic chart was sent once to the live production recommendation endpoint for a baseline: HTTP 200 without authorization, returning Gate 1, line 1, “Earth's Breath”, artwork `UL-122`. This verifies computation and establishes that production was still public before the local policy change. No real person’s chart, name or birth date was sent.

Focused real-handler tests verify missing configuration, invalid credentials, correct-key chart/artwork output, preflight, metadata and public read-only routes. `npx vitest run tests/unit/oracleRecommendationAccess.test.ts tests/unit/oracleHostedTools.test.ts` passed all nine tests; `npm run typecheck` passed. No production secrets were read or changed.

The reviewed policy shipped through [PR #416](https://github.com/adroart/mandalacodes/pull/416) on 2026-11-16 as `0ed51dc1191e7f46a2e2d904a4df7806b6bed411`, deployment `be8fe4c9-475a-46e6-b465-d01d3655cf27`. The immutable and canonical deployments matched. On production at that revision, recommendation POST returned 401 without credentials and 200 with the approved authenticated synthetic chart. Card and search returned 200, and MCP listed seven public tools. The matching server-side consumer release also passed its live verification. The key stays on the server.

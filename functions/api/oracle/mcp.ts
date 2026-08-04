/**
 * POST /api/oracle/mcp — the hosted oracle MCP server.
 *
 * A stateless Streamable-HTTP MCP endpoint: each request is one JSON-RPC
 * message, answered with application/json. The tools are stateless reads, so no
 * sessions and no Durable Objects are needed — it drops straight into Pages.
 *
 * Exposes the read-only PUBLIC tools only; authoring tools stay in the local
 * stdio server. Optionally gated by a shared bearer token (ORACLE_MCP_TOKEN);
 * leave the env var unset for public read-only access.
 *
 * Register in Claude as a custom connector at
 *   https://mandalacodes.com/api/oracle/mcp
 */
import { dispatch, ToolError, type HostedData } from '../../../lib/oracle/hosted';
import { PUBLIC_TOOL_DEFS } from '../../../lib/oracle/tool-defs';
import type { SearchDoc } from '../../../lib/oracle/ranker';
import type { CanonicalCard } from '../../../lib/oracle/types';
import index from '../../../data/oracle-search-index.json';
import corpusData from '../../../data/oracle-corpus.json';

interface Env { ORACLE_MCP_TOKEN?: string }

const DATA: HostedData = {
  cards: (corpusData as { cards: CanonicalCard[] }).cards,
  docs: index as unknown as SearchDoc[],
};

const PROTOCOL = '2024-11-05';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const rpcResult = (id: unknown, result: unknown) => json({ jsonrpc: '2.0', id, result });
const rpcError = (id: unknown, code: number, message: string) =>
  json({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  // optional shared-secret gate
  const required = env.ORACLE_MCP_TOKEN;
  if (required) {
    const tok = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (tok !== required) return json({ error: 'unauthorized' }, 401);
  }

  let msg: any;
  try {
    msg = await request.json();
  } catch {
    return rpcError(null, -32700, 'parse error');
  }

  switch (msg.method) {
    case 'initialize':
      return rpcResult(msg.id, {
        protocolVersion: PROTOCOL,
        capabilities: { tools: {} },
        serverInfo: { name: 'oracle', version: '0.1.0' },
      });

    case 'notifications/initialized':
      return new Response(null, { status: 202 });

    case 'tools/list':
      return rpcResult(msg.id, { tools: PUBLIC_TOOL_DEFS });

    case 'tools/call': {
      const name = msg.params?.name;
      try {
        const value = dispatch(name, msg.params?.arguments ?? {}, DATA);
        return rpcResult(msg.id, { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] });
      } catch (e) {
        const text = e instanceof ToolError ? e.message : `internal error: ${(e as Error).message}`;
        return rpcResult(msg.id, { content: [{ type: 'text', text: `Error: ${text}` }], isError: true });
      }
    }

    default:
      return rpcError(msg.id, -32601, `method not found: ${msg.method}`);
  }
};

// A friendly GET so hitting the URL in a browser explains the endpoint.
export const onRequestGet = async () =>
  json({ server: 'oracle', transport: 'streamable-http (stateless)', tools: PUBLIC_TOOL_DEFS.map((t) => t.name) });

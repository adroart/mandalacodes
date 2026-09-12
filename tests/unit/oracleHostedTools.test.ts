import { describe, expect, it } from 'vitest';

import { onRequestPost as callHostedMcp } from '../../functions/api/oracle/mcp';
import { PUBLIC_TOOL_DEFS } from '../../lib/oracle/tool-defs';
import type { CanonicalCard } from '../../lib/oracle/types';
import { getLineResult } from '../../lib/oracle/tool-results';
import { loadCorpus } from '../../mcp/oracle-server/src/corpus';
import { localGetLineResult } from '../../mcp/oracle-server/src/local-tools';
import { searchCorpus } from '../../mcp/oracle-server/src/search';

interface McpBody {
  result: { content: Array<{ type: 'text'; text: string }>; isError?: boolean };
}

async function hostedTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const response = await callHostedMcp({
    request: new Request('https://example.test/api/oracle/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name, arguments: args },
      }),
    }),
    env: {},
  } as never);
  const body = await response.json() as McpBody;
  expect(body.result.isError).not.toBe(true);
  return JSON.parse(body.result.content[0]!.text);
}

function withoutSearchText(card: CanonicalCard): Omit<CanonicalCard, 'searchText'> {
  const { searchText: _searchText, ...published } = card;
  return published;
}

describe('hosted and local Oracle MCP parity', () => {
  it('preserves the hosted public tool names and input schemas', async () => {
    const response = await callHostedMcp({
      request: new Request('https://example.test/api/oracle/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      }),
      env: {},
    } as never);
    const body = await response.json() as { result: { tools: unknown[] } };

    expect(body.result.tools).toEqual(PUBLIC_TOOL_DEFS);
  });

  it('returns the local Markdown-derived card through hosted get_card', async () => {
    const local = (await loadCorpus())[2]!;

    expect(await hostedTool('get_card', { number: 3 })).toEqual(withoutSearchText(local));
  });

  it('returns the same Markdown-derived moving line locally and when hosted', async () => {
    const local = (await loadCorpus())[2]!;
    const line = local.iching.lines.find(candidate => candidate.line === 1)!;
    const shared = getLineResult(local, 1);

    expect(await hostedTool('get_line', { number: 3, line: 1 })).toEqual(
      shared,
    );
    expect(localGetLineResult(local, 1)).toEqual(shared);
    expect(line.image).toContain('marker that will not be moved');
    expect(line.becomes).toEqual({ hexagram: 8, name: 'Holding Together' });
  });

  it('ranks complete Markdown prose the same way in hosted and local search', async () => {
    const local = searchCorpus(await loadCorpus(), 'cows field', { limit: 8, expand: false })
      .map(({ artwork_count: _artworkCount, ...hit }) => hit);

    expect(await hostedTool('search_oracle', {
      query: 'cows field',
      limit: 8,
      literal: true,
    })).toEqual(local);
  });
});

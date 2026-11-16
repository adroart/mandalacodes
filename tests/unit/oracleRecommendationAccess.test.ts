import { describe, expect, it } from 'vitest';

import {
  onRequestGet as recommendationInfo,
  onRequestOptions as recommendationPreflight,
  onRequestPost as recommend,
} from '../../functions/api/oracle/recommendation';
import { onRequestGet as getCard } from '../../functions/api/oracle/card';
import { onRequestGet as search } from '../../functions/api/oracle/search';
import { onRequestGet as mcpInfo, onRequestPost as callMcp } from '../../functions/api/oracle/mcp';

const chart = { profile: { lifesWork: { gate: 1, line: 1 } } };
const url = 'https://mandalacodes.com/api/oracle/recommendation';

function post(token?: string, key?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token !== undefined) headers.Authorization = token;
  return recommend({
    request: new Request(url, { method: 'POST', headers, body: JSON.stringify(chart) }),
    env: key === undefined ? {} : { ORACLE_API_TOKEN: key },
  });
}

describe('Oracle recommendation integration access', () => {
  it('fails closed when the service key is not configured', async () => {
    for (const key of [undefined, '']) {
      const response = await post('Bearer synthetic-key', key);
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: 'service unavailable' });
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    }
  });

  it('rejects missing, incorrect, and non-bearer credentials', async () => {
    for (const token of [undefined, 'Bearer wrong-key', 'synthetic-key']) {
      const response = await post(token, 'synthetic-key');
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'unauthorized' });
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    }
  });

  it('returns the published Gate 1 card and artwork to the authorized integration', async () => {
    const response = await post('Bearer synthetic-key', 'synthetic-key');
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const data = await response.json();
    expect(data.pieces).toHaveLength(1);
    expect(data.pieces[0]).toMatchObject({
      sphere: "Life's Work",
      gate: 1,
      line: 1,
      cardName: "Earth's Breath",
      pieceId: 'UL-122',
    });
    expect(data.pieces[0].image).toContain('/media/image/1_');
  });

  it('keeps preflight and endpoint information available without credentials', async () => {
    const preflight = await recommendationPreflight();
    expect(preflight.status).toBe(200);
    expect(preflight.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    expect(preflight.headers.get('Cache-Control')).toBe('no-store');

    const info = await recommendationInfo();
    expect(info.status).toBe(200);
    expect(info.headers.get('Cache-Control')).toBe('no-store');
  });

  it('keeps published card, search, and read-only MCP tools public', async () => {
    const cardResponse = await getCard({ request: new Request('https://mandalacodes.com/api/oracle/card?n=1') });
    expect(cardResponse.status).toBe(200);
    expect((await cardResponse.json()).card_name).toBe("Earth's Breath");

    const searchResponse = await search({ request: new Request('https://mandalacodes.com/api/oracle/search?q=Earth%27s%20Breath') });
    expect(searchResponse.status).toBe(200);
    expect((await searchResponse.json()).hits.length).toBeGreaterThan(0);

    const infoResponse = await mcpInfo();
    expect(infoResponse.status).toBe(200);
    expect((await infoResponse.json()).tools).toHaveLength(7);

    const toolsResponse = await callMcp({
      request: new Request('https://mandalacodes.com/api/oracle/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      }),
      env: {},
    });
    expect(toolsResponse.status).toBe(200);
    expect((await toolsResponse.json()).result.tools).toHaveLength(7);
  });
});

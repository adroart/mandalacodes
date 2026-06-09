/**
 * Public MCP tool definitions — the read-only subset exposed by the HOSTED
 * oracle MCP server (functions/api/oracle/mcp.ts). Authoring tools
 * (compose_reading, get_reading) are intentionally absent: they stay in the
 * local stdio server only.
 *
 * The local server keeps its own (fuller) tool list; this file is the contract
 * for what goes public.
 */
const VOICES = ['glance', 'iching', 'gene_keys', 'human_design', 'tarot', 'body'];

export const PUBLIC_TOOL_DEFS = [
  {
    name: 'search_oracle',
    description:
      'Search the 64 oracle codes by meaning/keyword (e.g. "art about creation and new beginnings"). Returns ranked codes with matched/concept-related keywords and a snippet. A concept ontology bridges intent to the deck\'s vocabulary. Pass literal:true to match only typed terms.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number' },
        systems: { type: 'array', items: { type: 'string', enum: ['iching', 'gene_keys', 'human_design', 'tarot', 'body'] } },
        literal: { type: 'boolean' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_card',
    description: 'Get the full object for one code, by number (1–64) or name.',
    inputSchema: { type: 'object', properties: { number: { type: 'number' }, name: { type: 'string' } } },
  },
  {
    name: 'get_voice',
    description: 'Get one voice of a code whole: glance, iching, gene_keys, human_design, tarot, or body.',
    inputSchema: {
      type: 'object',
      properties: { number: { type: 'number' }, name: { type: 'string' }, voice: { type: 'string', enum: VOICES } },
      required: ['voice'],
    },
  },
  {
    name: 'get_line',
    description: 'Get one of a code\'s six moving lines (1–6), with the hexagram it transitions into.',
    inputSchema: {
      type: 'object',
      properties: { number: { type: 'number' }, name: { type: 'string' }, line: { type: 'number' } },
      required: ['line'],
    },
  },
  {
    name: 'list_cards',
    description: 'List all 64 codes (number, name, ring, keywords, artwork count). Optionally filter by codon ring.',
    inputSchema: { type: 'object', properties: { ring: { type: 'string' } } },
  },
  {
    name: 'find_artworks',
    description: 'Find the Universal Language artwork(s) for a code (by number/name) or for a free-text query (searches first).',
    inputSchema: { type: 'object', properties: { number: { type: 'number' }, name: { type: 'string' }, query: { type: 'string' } } },
  },
  {
    name: 'cast_hexagram',
    description: 'Cast a hexagram (three-coin method): six lines, primary code, moving lines, resulting code.',
    inputSchema: { type: 'object', properties: { question: { type: 'string' } } },
  },
];

export const PUBLIC_TOOL_NAMES = new Set(PUBLIC_TOOL_DEFS.map((t) => t.name));

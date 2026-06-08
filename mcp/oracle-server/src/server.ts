#!/usr/bin/env -S npx tsx
/**
 * Universal Language Oracle — MCP server (stdio).
 *
 * Exposes the 64 codes, their four voices, moving lines, hexagram casting, the
 * artwork↔code link, and a reading-scaffold assembler as MCP tools. Reads the
 * canonical corpus straight from the repo's oracle data — no network, no auth,
 * works offline. Launch with `npm start` (tsx) and register in an MCP client.
 *
 * See README.md for client configuration.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { loadCorpus, type CanonicalCard } from './corpus.ts';
import { searchCorpus, type Voice } from './search.ts';
import { composeReading } from './reading.ts';
import { castHexagram } from './cast.ts';
import { loadReadings } from './readings-cache.ts';

const VOICES: Voice[] = ['glance', 'iching', 'gene_keys', 'human_design', 'tarot', 'body'];

const corpus = await loadCorpus();
const readings = await loadReadings();
const byNumber = new Map<number, CanonicalCard>(corpus.map((c) => [c.number, c]));
const byName = new Map<string, CanonicalCard>(corpus.map((c) => [c.card_name.toLowerCase(), c]));

function resolveCard(args: { number?: number; name?: string }): CanonicalCard | undefined {
  if (typeof args.number === 'number') return byNumber.get(args.number);
  if (args.name) {
    const n = byName.get(args.name.toLowerCase());
    if (n) return n;
    // loose contains match
    return corpus.find((c) => c.card_name.toLowerCase().includes(args.name!.toLowerCase()));
  }
  return undefined;
}

function text(value: unknown) {
  return { content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] };
}
function err(message: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
}

/* ─── Tool definitions ───────────────────────────────────────────────────── */

const tools = [
  {
    name: 'search_oracle',
    description:
      'Search the 64 oracle codes by meaning/keyword. Use for queries like "art about creation and new beginnings" — returns the codes that match, ranked, with the matched keywords and a snippet. Each hit also reports how many artworks exist for that code.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free-text intent, e.g. "creation and new beginnings".' },
        limit: { type: 'number', description: 'Max results (default 8).' },
        systems: {
          type: 'array',
          items: { type: 'string', enum: ['iching', 'gene_keys', 'human_design', 'tarot', 'body'] },
          description: 'Optional: restrict the deep-prose fields searched to these voices (name/keywords/glance are always searched).',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_card',
    description: 'Get the full canonical object for one code, by number (1–64) or card name.',
    inputSchema: {
      type: 'object',
      properties: { number: { type: 'number' }, name: { type: 'string' } },
    },
  },
  {
    name: 'get_voice',
    description: 'Get one voice of a code, whole: glance, iching, gene_keys, human_design, tarot, or body.',
    inputSchema: {
      type: 'object',
      properties: {
        number: { type: 'number' },
        name: { type: 'string' },
        voice: { type: 'string', enum: VOICES },
      },
      required: ['voice'],
    },
  },
  {
    name: 'get_line',
    description: 'Get one of a code\'s six moving lines (1–6), including which hexagram it transitions into. Some lines may not be authored yet.',
    inputSchema: {
      type: 'object',
      properties: { number: { type: 'number' }, name: { type: 'string' }, line: { type: 'number' } },
      required: ['line'],
    },
  },
  {
    name: 'list_cards',
    description: 'List all 64 codes (number, name, ring, keywords, artwork count). Optionally filter by codon ring name.',
    inputSchema: {
      type: 'object',
      properties: { ring: { type: 'string', description: 'Filter to a codon ring, e.g. "Ring of Fire".' } },
    },
  },
  {
    name: 'find_artworks',
    description:
      'Find the Universal Language artwork(s) for a code (by number/name) OR for a free-text query (runs search_oracle first, then returns the pieces for the top match).',
    inputSchema: {
      type: 'object',
      properties: { number: { type: 'number' }, name: { type: 'string' }, query: { type: 'string' } },
    },
  },
  {
    name: 'get_reading',
    description:
      'Get the authored, cached reading for a specific artwork (e.g. "UL-122") if one exists in oracle/readings/. Returns the final prose. If none is authored yet, falls back to a compose_reading scaffold for that piece\'s code.',
    inputSchema: {
      type: 'object',
      properties: { artworkId: { type: 'string' } },
      required: ['artworkId'],
    },
  },
  {
    name: 'compose_reading',
    description:
      'Assemble the material for a reading of a code (optionally framed around one of its artworks and/or a drawn line). Returns a structured scaffold for you to render into final prose in the deck\'s voice — it does not write the prose itself.',
    inputSchema: {
      type: 'object',
      properties: {
        number: { type: 'number' },
        name: { type: 'string' },
        artworkId: { type: 'string', description: 'Frame the reading around this piece (e.g. "UL-122").' },
        voices: { type: 'array', items: { type: 'string', enum: VOICES }, description: 'Voices to open beneath the Glance (default ["gene_keys"]).' },
        line: { type: 'number', description: 'Include a drawn moving line (1–6).' },
        length: { type: 'string', enum: ['glance', 'short', 'full'] },
      },
    },
  },
  {
    name: 'cast_hexagram',
    description: 'Cast a hexagram by the three-coin method. Returns the six lines, the primary code, any moving lines, and the resulting code.',
    inputSchema: {
      type: 'object',
      properties: { question: { type: 'string', description: 'Optional: the seeker\'s question, echoed back.' } },
    },
  },
];

/* ─── Server ─────────────────────────────────────────────────────────────── */

const server = new Server(
  { name: 'oracle', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name } = req.params;
  const a = (req.params.arguments ?? {}) as any;

  switch (name) {
    case 'search_oracle': {
      if (!a.query) return err('query is required');
      return text(searchCorpus(corpus, a.query, { limit: a.limit, systems: a.systems }));
    }

    case 'get_card': {
      const card = resolveCard(a);
      return card ? text(card) : err('card not found (give a number 1–64 or a card name)');
    }

    case 'get_voice': {
      const card = resolveCard(a);
      if (!card) return err('card not found');
      const voice = a.voice as Voice;
      const map: Record<Voice, unknown> = {
        glance: card.glance,
        iching: card.iching,
        gene_keys: card.gene_keys,
        human_design: card.human_design,
        tarot: card.tarot,
        body: card.body,
      };
      return text({ code: card.number, card_name: card.card_name, anchor: card.essence, voice, content: map[voice] });
    }

    case 'get_line': {
      const card = resolveCard(a);
      if (!card) return err('card not found');
      const line = card.iching.lines.find((l) => l.line === a.line);
      if (!line) return text({ code: card.number, line: a.line, note: 'This line is not yet authored for this code.' });
      return text({ code: card.number, card_name: card.card_name, ...line });
    }

    case 'list_cards': {
      const rows = corpus
        .filter((c) => !a.ring || c.ring_name.toLowerCase() === String(a.ring).toLowerCase())
        .map((c) => ({ number: c.number, card_name: c.card_name, ring: c.ring_name, keywords: c.keywords, artworks: c.artworks.length }));
      return text(rows);
    }

    case 'find_artworks': {
      let card = resolveCard(a);
      let via: string | undefined;
      if (!card && a.query) {
        const hit = searchCorpus(corpus, a.query, { limit: 1 })[0];
        if (hit) { card = byNumber.get(hit.number); via = `top search match for "${a.query}"`; }
      }
      if (!card) return err('give a number, name, or query');
      const artworks = card.artworks.map((art) => ({
        ...art,
        reading: readings.has(art.id) ? 'authored' : 'none',
      }));
      return text({ code: card.number, card_name: card.card_name, via, artworks });
    }

    case 'get_reading': {
      if (!a.artworkId) return err('artworkId is required');
      const cached = readings.get(a.artworkId);
      if (cached) return text({ source: 'authored', ...cached });
      // fall back to a scaffold for the piece's code
      const card = corpus.find((c) => c.artworks.some((art) => art.id === a.artworkId));
      if (!card) return err(`no reading and no artwork found for ${a.artworkId}`);
      return text({
        source: 'scaffold',
        note: `No authored reading for ${a.artworkId} yet — returning material to write one.`,
        ...composeReading(card, { artworkId: a.artworkId }),
      });
    }

    case 'compose_reading': {
      const card = resolveCard(a);
      if (!card) return err('card not found');
      return text(composeReading(card, { artworkId: a.artworkId, voices: a.voices, line: a.line, length: a.length }));
    }

    case 'cast_hexagram': {
      const result = castHexagram(corpus);
      const primary = result.primary.number ? byNumber.get(result.primary.number) : undefined;
      const resulting = result.resulting?.number ? byNumber.get(result.resulting.number) : undefined;
      return text({
        question: a.question,
        ...result,
        primary_card: primary ? { number: primary.number, card_name: primary.card_name, essence: primary.essence } : null,
        resulting_card: resulting ? { number: resulting.number, card_name: resulting.card_name, essence: resulting.essence } : null,
      });
    }

    default:
      return err(`unknown tool: ${name}`);
  }
});

await server.connect(new StdioServerTransport());
console.error('[oracle-mcp] ready —', corpus.length, 'codes loaded');

/**
 * Pure dispatch for the hosted oracle tools — fs-free, transport-free. The
 * Cloudflare Functions (REST + remote MCP) build `HostedData` from the bundled
 * JSON artifacts and call `dispatch()`; the result is serialised to JSON.
 *
 * Read-only public tools only. Ranking reuses the shared ranker; casting reuses
 * the shared cast — the same logic the local MCP and the website run.
 */
import { rank, type SearchDoc } from './ranker';
import { castHexagram } from './cast';
import { getLineResult } from './tool-results';
import type { CanonicalCard, Voice } from './types';

export interface HostedData {
  cards: CanonicalCard[];
  docs: SearchDoc[];
}

export class ToolError extends Error {}

function index(data: HostedData) {
  const byNumber = new Map<number, CanonicalCard>(data.cards.map((c) => [c.number, c]));
  const byName = new Map<string, CanonicalCard>(data.cards.map((c) => [c.card_name.toLowerCase(), c]));
  return { byNumber, byName };
}

function resolveCard(data: HostedData, a: { number?: number; name?: string }): CanonicalCard | undefined {
  const { byNumber, byName } = index(data);
  if (typeof a.number === 'number') return byNumber.get(a.number);
  if (a.name) {
    return byName.get(a.name.toLowerCase()) ??
      data.cards.find((c) => c.card_name.toLowerCase().includes(a.name!.toLowerCase()));
  }
  return undefined;
}

/** Run a public tool. Returns a plain JS value; throws ToolError on bad input. */
export function dispatch(name: string, a: any, data: HostedData): unknown {
  switch (name) {
    case 'search_oracle': {
      if (!a.query) throw new ToolError('query is required');
      return rank(data.docs, String(a.query).slice(0, 200), {
        limit: Math.min(Number(a.limit) || 8, 24),
        systems: a.systems,
        expand: !a.literal,
      });
    }

    case 'get_card': {
      const card = resolveCard(data, a);
      if (!card) throw new ToolError('card not found (number 1–64 or a card name)');
      return card;
    }

    case 'get_voice': {
      const card = resolveCard(data, a);
      if (!card) throw new ToolError('card not found');
      const voice = a.voice as Voice;
      const map: Record<Voice, unknown> = {
        glance: card.glance, iching: card.iching, gene_keys: card.gene_keys,
        human_design: card.human_design, tarot: card.tarot, body: card.body,
      };
      if (!(voice in map)) throw new ToolError('voice must be one of glance|iching|gene_keys|human_design|tarot|body');
      return { code: card.number, card_name: card.card_name, anchor: card.essence, voice, content: map[voice] };
    }

    case 'get_line': {
      const card = resolveCard(data, a);
      if (!card) throw new ToolError('card not found');
      return getLineResult(card, a.line);
    }

    case 'list_cards': {
      return data.cards
        .filter((c) => !a.ring || c.ring_name.toLowerCase() === String(a.ring).toLowerCase())
        .map((c) => ({ number: c.number, card_name: c.card_name, ring: c.ring_name, keywords: c.keywords, artworks: c.artworks.length }));
    }

    case 'find_artworks': {
      let card = resolveCard(data, a);
      let via: string | undefined;
      if (!card && a.query) {
        const hit = rank(data.docs, String(a.query), { limit: 1 })[0];
        if (hit) { card = index(data).byNumber.get(hit.number); via = `top search match for "${a.query}"`; }
      }
      if (!card) throw new ToolError('give a number, name, or query');
      return { code: card.number, card_name: card.card_name, via, artworks: card.artworks };
    }

    case 'cast_hexagram': {
      const result = castHexagram(data.cards);
      const { byNumber } = index(data);
      const primary = result.primary.number ? byNumber.get(result.primary.number) : undefined;
      const resulting = result.resulting?.number ? byNumber.get(result.resulting.number) : undefined;
      return {
        question: a.question,
        ...result,
        primary_card: primary ? { number: primary.number, card_name: primary.card_name, essence: primary.essence } : null,
        resulting_card: resulting ? { number: resulting.number, card_name: resulting.card_name, essence: resulting.essence } : null,
      };
    }

    default:
      throw new ToolError(`unknown tool: ${name}`);
  }
}

/**
 * Keyword search over the canonical corpus.
 *
 * Transparent and explainable by design (Phase 1 of the integration plan):
 * every hit reports which query terms matched and where, so a result can always
 * be justified. Phase 3 swaps/augments this ranker with embeddings for true
 * semantic matching — the tool surface (search_oracle) stays identical.
 */
import type { CanonicalCard } from './corpus.ts';

export type Voice = 'glance' | 'iching' | 'gene_keys' | 'human_design' | 'tarot' | 'body';

export interface SearchHit {
  number: number;
  card_name: string;
  ring_name: string;
  score: number;
  keywords: string[];
  matched: string[]; // which query terms hit
  why: string; // human-readable reason
  snippet: string; // best matching sentence
  artwork_count: number;
}

const STOP = new Set([
  'a', 'an', 'and', 'the', 'of', 'to', 'in', 'on', 'for', 'about', 'with', 'is',
  'are', 'i', 'im', 'looking', 'art', 'want', 'card', 'oracle', 'me', 'something',
  'that', 'this', 'into', 'it', 'my', 'new', // 'new' is generic; "beginnings" carries it
]);

/** Light stem so "beginnings" matches "beginning", "creating" → "creat". */
function stem(t: string): string {
  return t
    .replace(/(ings|ing|ies|ied|s|ed|ly|ness)$/i, '')
    .replace(/e$/i, '');
}

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9']+/g) ?? []).filter((t) => t.length > 1);
}

function queryTerms(query: string): string[] {
  const raw = tokenize(query).filter((t) => !STOP.has(t));
  // keep both the surface form and a stem for each term
  const out = new Set<string>();
  for (const t of raw) {
    out.add(t);
    const st = stem(t);
    if (st.length > 2) out.add(st);
  }
  return [...out];
}

/** Field weights — a keyword or name match means more than a body-prose match. */
const FIELD_WEIGHTS: Record<string, number> = {
  card_name: 8,
  keywords: 6,
  essence: 4,
  glance: 3,
  iching: 1,
  gene_keys: 1,
  human_design: 1,
  tarot: 1,
  body: 1,
};

function fieldText(card: CanonicalCard, field: string): string {
  switch (field) {
    case 'card_name': return card.card_name;
    case 'keywords': return (card.keywords ?? []).join(' ');
    case 'essence': return card.essence ?? '';
    case 'glance': return card.glance.reading ?? '';
    case 'iching': return [card.iching.reading, card.iching.trigram_combination, card.iching.hexagram_name].filter(Boolean).join(' ');
    case 'gene_keys': return [card.gene_keys.shadow_name, card.gene_keys.gift_name, card.gene_keys.siddhi_name, card.gene_keys.gift, card.gene_keys.shadow, card.gene_keys.siddhi].filter(Boolean).join(' ');
    case 'human_design': return [card.human_design.gate_keyword, card.human_design.gate].filter(Boolean).join(' ');
    case 'tarot': return [card.tarot.ring_role, card.tarot.tarot_resonance].filter(Boolean).join(' ');
    case 'body': return [card.body.physiology, card.body.amino_acid].filter(Boolean).join(' ');
    default: return '';
  }
}

function bestSnippet(card: CanonicalCard, terms: string[]): string {
  const sources = [card.glance.reading, card.essence, card.iching.reading, card.gene_keys.gift]
    .filter(Boolean) as string[];
  for (const src of sources) {
    const sentences = src.split(/(?<=[.?!])\s+/);
    for (const sent of sentences) {
      const low = sent.toLowerCase();
      if (terms.some((t) => low.includes(t))) {
        return sent.trim().slice(0, 220);
      }
    }
  }
  return (card.essence ?? card.glance.reading ?? '').slice(0, 160);
}

export function searchCorpus(
  corpus: CanonicalCard[],
  query: string,
  opts: { limit?: number; systems?: string[] } = {},
): SearchHit[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];
  const fields = opts.systems?.length
    ? ['card_name', 'keywords', 'essence', 'glance', ...opts.systems]
    : Object.keys(FIELD_WEIGHTS);

  const hits: SearchHit[] = [];
  for (const card of corpus) {
    let score = 0;
    const matched = new Set<string>();
    const matchedKeywords: string[] = [];

    for (const field of fields) {
      const weight = FIELD_WEIGHTS[field] ?? 1;
      const text = fieldText(card, field).toLowerCase();
      if (!text) continue;
      for (const term of terms) {
        // word-ish boundary so "creat" matches "creation"/"creative"
        const re = new RegExp(`\\b${escapeRe(term)}`, 'g');
        const count = (text.match(re) ?? []).length;
        if (count > 0) {
          score += weight * (1 + Math.log(count));
          matched.add(term);
          if (field === 'keywords') {
            for (const kw of card.keywords) {
              if (kw.toLowerCase().includes(term)) matchedKeywords.push(kw);
            }
          }
        }
      }
    }

    if (score <= 0) continue;
    // reward breadth: hitting more distinct query terms beats one term many times
    score *= 1 + 0.5 * (matched.size - 1);

    const uniqKw = [...new Set(matchedKeywords)];
    const why = uniqKw.length
      ? `matched keywords: ${uniqKw.join(', ')}`
      : `matched: ${[...matched].join(', ')}`;

    hits.push({
      number: card.number,
      card_name: card.card_name,
      ring_name: card.ring_name,
      score: Math.round(score * 100) / 100,
      keywords: card.keywords,
      matched: [...matched],
      why,
      snippet: bestSnippet(card, [...matched]),
      artwork_count: card.artworks.length,
    });
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, opts.limit ?? 8);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

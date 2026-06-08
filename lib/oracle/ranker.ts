/**
 * Shared oracle ranker — the single source of truth for how the 64 codes are
 * scored against a free-text query. Pure, dependency-free, no Node/DOM APIs, so
 * it runs identically in three places:
 *   - the local MCP server (mcp/oracle-server/src/search.ts)
 *   - the website's client-side search (lib/oracle/search.ts)
 *   - a future Cloudflare Worker (hosted MCP / /api/oracle/search)
 *
 * Keyword/BM25-ish ranking, transparent by design: every hit reports which
 * query terms matched and a snippet. Phase 3b swaps/augments this with
 * embeddings behind the same `rank()` signature.
 */

/** The minimal searchable shape. Built from the canonical corpus. */
export interface SearchDoc {
  number: number;
  card_name: string;
  ring_name: string;
  keywords: string[];
  /** Field name → text, kept separate so fields can be weighted. */
  fields: {
    essence?: string;
    glance?: string;
    iching?: string;
    gene_keys?: string;
    human_design?: string;
    tarot?: string;
    body?: string;
  };
  /** Optional UI extras carried through to hits. */
  artwork?: { id?: string; image?: string; count: number };
}

export interface RankHit {
  number: number;
  card_name: string;
  ring_name: string;
  score: number;
  keywords: string[];
  matched: string[];
  why: string;
  snippet: string;
  artwork: { id?: string; image?: string; count: number };
}

export interface RankOptions {
  limit?: number;
  /** Restrict the deep-prose fields searched (name/keywords/essence/glance always on). */
  systems?: string[];
}

const STOP = new Set([
  'a', 'an', 'and', 'the', 'of', 'to', 'in', 'on', 'for', 'about', 'with', 'is',
  'are', 'i', 'im', 'looking', 'art', 'want', 'card', 'oracle', 'me', 'something',
  'that', 'this', 'into', 'it', 'my', 'new',
]);

/** Light stem so "beginnings" → "beginn", "creating" → "creat". */
function stem(t: string): string {
  return t.replace(/(ings|ing|ies|ied|s|ed|ly|ness)$/i, '').replace(/e$/i, '');
}

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9']+/g) ?? []).filter((t) => t.length > 1);
}

export function queryTerms(query: string): string[] {
  const raw = tokenize(query).filter((t) => !STOP.has(t));
  const out = new Set<string>();
  for (const t of raw) {
    out.add(t);
    const st = stem(t);
    if (st.length > 2) out.add(st);
  }
  return [...out];
}

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

function fieldText(doc: SearchDoc, field: string): string {
  if (field === 'card_name') return doc.card_name;
  if (field === 'keywords') return (doc.keywords ?? []).join(' ');
  return (doc.fields as Record<string, string | undefined>)[field] ?? '';
}

function bestSnippet(doc: SearchDoc, terms: string[]): string {
  const sources = [doc.fields.glance, doc.fields.essence, doc.fields.iching, doc.fields.gene_keys]
    .filter(Boolean) as string[];
  for (const src of sources) {
    for (const sent of src.split(/(?<=[.?!])\s+/)) {
      if (terms.some((t) => sent.toLowerCase().includes(t))) return sent.trim().slice(0, 220);
    }
  }
  return (doc.fields.essence ?? doc.fields.glance ?? '').slice(0, 160);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function rank(docs: SearchDoc[], query: string, opts: RankOptions = {}): RankHit[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];
  const fields = opts.systems?.length
    ? ['card_name', 'keywords', 'essence', 'glance', ...opts.systems]
    : Object.keys(FIELD_WEIGHTS);

  const hits: RankHit[] = [];
  for (const doc of docs) {
    let score = 0;
    const matched = new Set<string>();
    const matchedKeywords: string[] = [];

    for (const field of fields) {
      const weight = FIELD_WEIGHTS[field] ?? 1;
      const text = fieldText(doc, field).toLowerCase();
      if (!text) continue;
      for (const term of terms) {
        const re = new RegExp(`\\b${escapeRe(term)}`, 'g');
        const count = (text.match(re) ?? []).length;
        if (count > 0) {
          score += weight * (1 + Math.log(count));
          matched.add(term);
          if (field === 'keywords') {
            for (const kw of doc.keywords) if (kw.toLowerCase().includes(term)) matchedKeywords.push(kw);
          }
        }
      }
    }

    if (score <= 0) continue;
    score *= 1 + 0.5 * (matched.size - 1); // reward breadth

    const uniqKw = [...new Set(matchedKeywords)];
    hits.push({
      number: doc.number,
      card_name: doc.card_name,
      ring_name: doc.ring_name,
      score: Math.round(score * 100) / 100,
      keywords: doc.keywords,
      matched: [...matched],
      why: uniqKw.length ? `matched keywords: ${uniqKw.join(', ')}` : `matched: ${[...matched].join(', ')}`,
      snippet: bestSnippet(doc, [...matched]),
      artwork: doc.artwork ?? { count: 0 },
    });
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, opts.limit ?? 8);
}

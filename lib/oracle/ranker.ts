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
  /** Expand the query through the concept ontology (default true). Set false for literal-only. */
  expand?: boolean;
}

const STOP = new Set([
  'a', 'an', 'and', 'the', 'of', 'to', 'in', 'on', 'for', 'about', 'with', 'is',
  'are', 'i', 'im', 'looking', 'art', 'want', 'card', 'oracle', 'me', 'something',
  'that', 'this', 'into', 'it', 'my', 'new',
]);

/**
 * Concept ontology — the semantic layer for a *bounded* symbolic deck. Each
 * cluster ties a seeker's intent words to the deck's own keyword vocabulary, so
 * "creation" reaches a code keyworded "Originating Force / Creative Impulse" and
 * "new beginnings" reaches "Pure Potential / Renewal / Genesis". A member found
 * in the query pulls in its whole cluster as secondary (reduced-weight) terms.
 *
 * This is query expansion over a known vocabulary — well suited to 64 fixed
 * codes. Phase 3b-vectors (hosted embeddings) can later layer on top behind the
 * same rank() signature; this needs no model, no key, and runs offline.
 */
const CONCEPT_CLUSTERS: string[][] = [
  ['creation', 'create', 'creative', 'creativity', 'creator', 'originating', 'origination', 'genesis', 'source', 'impulse', 'generative', 'making', 'manifestation', 'expression'],
  ['beginning', 'beginnings', 'origin', 'first', 'start', 'threshold', 'dawn', 'inception', 'seed', 'potential', 'renewal', 'emergence', 'birth', 'rebirth', 'awakening', 'initiative', 'early', 'bud'],
  ['surrender', 'yield', 'yielding', 'letting', 'release', 'acceptance', 'allow', 'trust', 'flow', 'receptive', 'softness', 'relaxation'],
  ['power', 'strength', 'force', 'will', 'mastery', 'potency', 'indomitable', 'unshakable', 'sublime', 'victory', 'authority', 'sovereignty', 'throne'],
  ['conflict', 'tension', 'opposition', 'struggle', 'friction', 'fight', 'dispute', 'rupture', 'provocation', 'resistance'],
  ['love', 'union', 'heart', 'intimacy', 'connection', 'bond', 'communion', 'devotion', 'tenderness', 'affinity', 'belonging', 'fellowship', 'kindness', 'compassion', 'relationship'],
  ['fear', 'anxiety', 'dread', 'threat', 'doubt', 'victim', 'wound', 'suffering'],
  ['death', 'dying', 'ending', 'completion', 'closure', 'dissolution', 'decay', 'deathless'],
  ['shadow', 'dark', 'darkness', 'abyss', 'void', 'hidden', 'concealed', 'veiled', 'stuck', 'laziness'],
  ['joy', 'joyful', 'delight', 'pleasure', 'bliss', 'ecstatic', 'celebration', 'lightness', 'play', 'playing', 'enthusiasm'],
  ['truth', 'authentic', 'authenticity', 'integrity', 'sincerity', 'transparency', 'real', 'impeccable', 'uncompromised'],
  ['stillness', 'still', 'rest', 'resting', 'silence', 'peace', 'calm', 'quiet', 'pause', 'retreat', 'withdrawal', 'waiting', 'patience', 'slowing'],
  ['transformation', 'transform', 'change', 'mutation', 'alchemy', 'alchemical', 'metamorphosis', 'becoming', 'shift', 'turning', 'tempering', 'refining', 'purification'],
  ['wisdom', 'knowing', 'understanding', 'insight', 'perception', 'vision', 'intelligence', 'discernment', 'contemplative', 'intuitive'],
  ['freedom', 'liberation', 'free', 'deliverance', 'rebellion', 'revolutionary', 'boundless'],
  ['purpose', 'purposeful', 'destiny', 'direction', 'path', 'calling', 'aspiration', 'longing', 'vocation'],
  ['abundance', 'prosperity', 'fullness', 'harvest', 'fortune', 'increase', 'enrichment', 'superabundant', 'nourishment', 'wealth'],
  ['growth', 'gradual', 'unfolding', 'ripening', 'organic', 'expansion', 'evolutionary', 'progress', 'maturation', 'blossoming'],
  ['courage', 'brave', 'bold', 'warrior', 'noble', 'valor', 'chivalric', 'daring'],
  ['service', 'contribution', 'giving', 'altruistic', 'devotional', 'sacrifice', 'help'],
];

/** term (and stem) → the set of cluster-mate terms it expands into. */
const EXPANSION_INDEX: Map<string, Set<string>> = (() => {
  const idx = new Map<string, Set<string>>();
  for (const cluster of CONCEPT_CLUSTERS) {
    for (const member of cluster) {
      const mates = cluster.filter((m) => m !== member);
      for (const key of [member, stem(member)]) {
        const set = idx.get(key) ?? new Set<string>();
        for (const mate of mates) set.add(mate);
        idx.set(key, set);
      }
    }
  }
  return idx;
})();

/** How much a concept-expanded term counts vs. a term the seeker actually typed. */
const EXPANSION_WEIGHT = 0.4;

/** Light stem so "beginnings" → "beginn", "creating" → "creat". */
function stem(t: string): string {
  return t.replace(/(ings|ing|ies|ied|s|ed|ly|ness)$/i, '').replace(/e$/i, '');
}

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9']+/g) ?? ([] as string[])).filter((t) => t.length > 1);
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

interface WeightedTerm {
  term: string;
  weight: number; // 1 = typed by seeker; EXPANSION_WEIGHT = pulled in by a concept cluster
  primary: boolean;
}

/** Typed terms (+stems) at full weight, plus concept-cluster expansions at reduced weight. */
function weightedQueryTerms(query: string, expand: boolean): WeightedTerm[] {
  const primary = queryTerms(query);
  const byTerm = new Map<string, WeightedTerm>();
  for (const t of primary) byTerm.set(t, { term: t, weight: 1, primary: true });

  if (expand) {
    for (const t of primary) {
      for (const mate of EXPANSION_INDEX.get(t) ?? []) {
        for (const exp of [mate, stem(mate)]) {
          if (exp.length < 3 || byTerm.has(exp)) continue; // never downgrade a primary
          byTerm.set(exp, { term: exp, weight: EXPANSION_WEIGHT, primary: false });
        }
      }
    }
  }
  return [...byTerm.values()];
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
  const terms = weightedQueryTerms(query, opts.expand !== false);
  if (terms.length === 0) return [];
  const fields = opts.systems?.length
    ? ['card_name', 'keywords', 'essence', 'glance', ...opts.systems]
    : Object.keys(FIELD_WEIGHTS);

  const hits: RankHit[] = [];
  for (const doc of docs) {
    let score = 0;
    const matchedPrimary = new Set<string>();
    const matchedExpansion = new Set<string>();
    const primaryKw = new Set<string>();
    const relatedKw = new Set<string>();

    for (const field of fields) {
      const weight = FIELD_WEIGHTS[field] ?? 1;
      const text = fieldText(doc, field).toLowerCase();
      if (!text) continue;
      for (const { term, weight: tw, primary } of terms) {
        const re = new RegExp(`\\b${escapeRe(term)}`, 'g');
        const count = (text.match(re) ?? []).length;
        if (count > 0) {
          score += weight * tw * (1 + Math.log(count));
          (primary ? matchedPrimary : matchedExpansion).add(term);
          if (field === 'keywords') {
            for (const kw of doc.keywords) {
              if (kw.toLowerCase().includes(term)) (primary ? primaryKw : relatedKw).add(kw);
            }
          }
        }
      }
    }

    if (score <= 0) continue;
    // reward breadth — typed terms full, concept-expanded terms half
    const breadth = matchedPrimary.size + 0.5 * matchedExpansion.size;
    score *= 1 + 0.5 * Math.max(0, breadth - 1);

    // explain: prefer literal keyword hits; else concept-related keywords; else terms
    const related = [...relatedKw].filter((k) => !primaryKw.has(k));
    const why = primaryKw.size
      ? `matched keywords: ${[...primaryKw].join(', ')}${related.length ? `; related: ${related.slice(0, 3).join(', ')}` : ''}`
      : related.length
        ? `related keywords: ${related.slice(0, 4).join(', ')}`
        : matchedPrimary.size
          ? `matched: ${[...matchedPrimary].join(', ')}`
          : `related to: ${[...matchedExpansion].slice(0, 4).join(', ')}`;

    hits.push({
      number: doc.number,
      card_name: doc.card_name,
      ring_name: doc.ring_name,
      score: Math.round(score * 100) / 100,
      keywords: doc.keywords,
      matched: [...matchedPrimary, ...matchedExpansion],
      why,
      snippet: bestSnippet(doc, [...matchedPrimary, ...matchedExpansion]),
      artwork: doc.artwork ?? { count: 0 },
    });
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, opts.limit ?? 8);
}

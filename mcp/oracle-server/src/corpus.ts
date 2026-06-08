/**
 * The canonical oracle corpus — built in memory by merging every complete
 * on-disk source into one typed object per code (1–64).
 *
 * Why in-memory and not oracle/generated/NN.json: the live website globs
 * oracle/generated/*.json and renders glance.reading / glance.invocation from
 * it. Only card 01 is authored there; writing scaffold files for 02–64 would
 * change the live reader. So the corpus is assembled at load time instead,
 * leaving the site untouched. This mirrors the merge that data/synthesisData.ts
 * performs for the website.
 *
 * Sources merged (precedence: section overlays > synthesis base > complete):
 *   - oracle/oracle_cards_complete.json   structural facts, all 64
 *   - oracle/synthesis/key_N.json         rich synthesis prose, all 64
 *   - oracle/sections/{keys,design,iching,body}/NN(.deep).json   bridge rewrites
 *   - oracle/generated/NN.json            glance.reading / invocation (card 01)
 *   - data/mockData.ts FULL_ARCHIVE       artwork ↔ code link
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ORACLE_DIR, DATA_DIR, pad2 } from './paths.ts';

/* ─── Public shape ───────────────────────────────────────────────────────── */

export interface MovingLine {
  line: number;
  image?: string;
  reading: string;
  becomes?: { hexagram: number; name: string };
}

export interface CardArtwork {
  id: string;
  title: string;
  coverImage?: string;
  year?: string;
  availability?: string;
}

export interface CanonicalCard {
  number: number;
  card_name: string;
  ring_name: string;
  ring_tarot?: string;
  keywords: string[];
  essence?: string;

  glance: { reading?: string; invocation?: string };

  iching: {
    hexagram_name?: string;
    trigram_combination?: string;
    reading?: string;
    judgement_lines?: string[];
    image_lines?: string[];
    upper_trigram?: { symbol?: string; name?: string; nature?: string };
    lower_trigram?: { symbol?: string; name?: string; nature?: string };
    lines: MovingLine[];
  };

  gene_keys: {
    shadow_name?: string;
    gift_name?: string;
    siddhi_name?: string;
    shadow?: string;
    repressive?: string;
    reactive?: string;
    gift?: string;
    siddhi?: string;
    programming_partner?: string;
  };

  human_design: {
    gate_number?: number;
    gate_keyword?: string;
    gate?: string;
    centre?: string;
    channel?: string;
  };

  tarot: { arcana?: string; ring_role?: string; tarot_resonance?: string };

  body: { physiology?: string; amino_acid?: string };

  relations: {
    programming_partner_number?: number | null;
    programming_partner?: string;
    codon_ring_siblings: number[];
  };

  reference?: Record<string, unknown>;

  artworks: CardArtwork[];

  /** Pre-joined lowercase blob of every searchable field. */
  searchText: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

async function readJson<T>(path: string): Promise<T | undefined> {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch (err) {
    console.error(`[corpus] failed to parse ${path}:`, (err as Error).message);
    return undefined;
  }
}

/** Prefer NN.deep.json over NN.json (pilot deep-pass overlays). */
function sectionPath(folder: string, n: number): string | undefined {
  const deep = resolve(ORACLE_DIR, 'sections', folder, `${pad2(n)}.deep.json`);
  if (existsSync(deep)) return deep;
  const base = resolve(ORACLE_DIR, 'sections', folder, `${pad2(n)}.json`);
  return existsSync(base) ? base : undefined;
}

/** Load FULL_ARCHIVE from the TS data module and index UL pieces by code. */
async function loadArtworkMap(): Promise<Map<number, CardArtwork[]>> {
  const map = new Map<number, CardArtwork[]>();
  try {
    const mod = await import(pathToFileURL(resolve(DATA_DIR, 'mockData.ts')).href);
    const archive: any[] = mod.FULL_ARCHIVE ?? [];
    for (const a of archive) {
      if (a?.series !== 'Universal Language') continue;
      // Title convention: "<name> - <N>". Fall back to description "Number N".
      const m = String(a.title ?? '').match(/-\s*(\d{1,2})\s*$/) ||
        String(a.description ?? '').match(/Number\s+(\d{1,2})/i);
      if (!m) continue;
      const n = Number(m[1]);
      if (!Number.isFinite(n) || n < 1 || n > 64) continue;
      const list = map.get(n) ?? [];
      list.push({
        id: a.id,
        title: a.title,
        coverImage: a.coverImage,
        year: a.year,
        availability: a.availability,
      });
      map.set(n, list);
    }
  } catch (err) {
    console.error('[corpus] artwork map unavailable:', (err as Error).message);
  }
  return map;
}

/* ─── Source shapes (loose) ──────────────────────────────────────────────── */

interface CompleteCard {
  number: number;
  card_name: string;
  iching?: any;
  element?: string;
  nature?: string;
  traditional_colors?: string;
  gene_keys?: { shadow?: string; gift?: string; siddhi?: string; description?: string };
  codon_ring_siblings?: number[];
  human_design?: { gate?: number; keyword?: string; description?: string };
  ring_name?: string;
  ring_tarot?: string;
}

/* ─── Build ──────────────────────────────────────────────────────────────── */

let cache: Promise<CanonicalCard[]> | undefined;

export function loadCorpus(): Promise<CanonicalCard[]> {
  if (!cache) cache = build();
  return cache;
}

async function build(): Promise<CanonicalCard[]> {
  const complete = await readJson<{ codon_rings: Array<{ ring_name: string; tarot: string; cards: CompleteCard[] }> }>(
    resolve(ORACLE_DIR, 'oracle_cards_complete.json'),
  );
  const completeByNum = new Map<number, CompleteCard>();
  for (const ring of complete?.codon_rings ?? []) {
    for (const c of ring.cards) {
      completeByNum.set(c.number, { ...c, ring_name: ring.ring_name, ring_tarot: ring.tarot });
    }
  }

  const artworkMap = await loadArtworkMap();
  const cards: CanonicalCard[] = [];

  for (let n = 1; n <= 64; n++) {
    const comp = completeByNum.get(n);
    const synth = await readJson<any>(resolve(ORACLE_DIR, 'synthesis', `key_${n}.json`));
    const keysSec = await readJson<any>(sectionPath('keys', n) ?? '');
    const designSec = await readJson<any>(sectionPath('design', n) ?? '');
    const ichingSec = await readJson<any>(sectionPath('iching', n) ?? '');
    const bodySec = await readJson<any>(sectionPath('body', n) ?? '');
    const generated = await readJson<any>(resolve(ORACLE_DIR, 'generated', `${pad2(n)}.json`));

    if (!comp && !synth) continue; // no source at all

    const s = synth?.synthesis ?? {};
    const card: CanonicalCard = {
      number: n,
      card_name: synth?.card_name ?? comp?.card_name ?? `Card ${n}`,
      ring_name: synth?.ring_name ?? comp?.ring_name ?? '',
      ring_tarot: comp?.ring_tarot,
      keywords: synth?.keywords ?? [],
      essence: synth?.essence,

      glance: {
        reading: generated?.glance?.reading,
        invocation: generated?.glance?.invocation,
      },

      iching: {
        hexagram_name: ichingSec?.hexagram_name ?? comp?.iching?.hexagram_name,
        trigram_combination: ichingSec?.combination ?? s.iching?.trigram_combination,
        reading: ichingSec?.reading ?? s.iching?.reading,
        judgement_lines: ichingSec?.judgement_lines ?? s.iching?.judgement_lines,
        image_lines: ichingSec?.image_lines ?? s.iching?.image_lines,
        upper_trigram: comp?.iching?.upper_trigram,
        lower_trigram: comp?.iching?.lower_trigram,
        lines: (ichingSec?.lines ?? []).map((l: any) => ({
          line: l.line,
          image: l.image,
          reading: l.reading,
          becomes: l.becomes,
        })),
      },

      gene_keys: {
        shadow_name: keysSec?.shadow_name ?? comp?.gene_keys?.shadow,
        gift_name: keysSec?.gift_name ?? comp?.gene_keys?.gift,
        siddhi_name: keysSec?.siddhi_name ?? comp?.gene_keys?.siddhi,
        shadow: keysSec?.shadow ?? s.gene_keys?.shadow ?? comp?.gene_keys?.description,
        repressive: keysSec?.repressive ?? s.gene_keys?.repressive,
        reactive: keysSec?.reactive ?? s.gene_keys?.reactive,
        gift: keysSec?.gift ?? s.gene_keys?.gift,
        siddhi: keysSec?.siddhi ?? s.gene_keys?.siddhi,
        programming_partner: s.gene_keys?.programming_partner,
      },

      human_design: {
        gate_number: designSec?.gate_number ?? comp?.human_design?.gate ?? synth?.reference?.hd_gate,
        gate_keyword: designSec?.gate_keyword ?? comp?.human_design?.keyword ?? synth?.reference?.hd_keyword,
        gate: designSec?.gate ?? s.human_design?.gate ?? comp?.human_design?.description,
        centre: designSec?.centre_field ?? s.human_design?.channel,
        channel: designSec?.channel ?? s.human_design?.circuit,
      },

      tarot: {
        arcana: synth?.reference?.tarot_card ?? comp?.ring_tarot,
        ring_role: s.tarot?.ring_role,
        tarot_resonance: s.tarot?.tarot_resonance,
      },

      body: {
        physiology: bodySec?.physiology ?? s.body?.physiology,
        amino_acid: bodySec?.amino_acid ?? s.body?.amino_acid,
      },

      relations: {
        programming_partner_number: synth?.reference?.programming_partner ?? null,
        programming_partner: s.gene_keys?.programming_partner,
        codon_ring_siblings: comp?.codon_ring_siblings ?? [],
      },

      reference: synth?.reference,
      artworks: artworkMap.get(n) ?? [],
      searchText: '',
    };

    card.searchText = buildSearchText(card);
    cards.push(card);
  }

  return cards;
}

function buildSearchText(c: CanonicalCard): string {
  const parts: (string | undefined)[] = [
    c.card_name,
    c.ring_name,
    ...(c.keywords ?? []),
    c.essence,
    c.glance.reading,
    c.iching.hexagram_name,
    c.iching.trigram_combination,
    c.iching.reading,
    ...(c.iching.judgement_lines ?? []),
    ...(c.iching.image_lines ?? []),
    c.gene_keys.shadow_name,
    c.gene_keys.gift_name,
    c.gene_keys.siddhi_name,
    c.gene_keys.shadow,
    c.gene_keys.gift,
    c.gene_keys.siddhi,
    c.human_design.gate_keyword,
    c.human_design.gate,
    c.tarot.ring_role,
    c.tarot.tarot_resonance,
    c.body.physiology,
    ...c.artworks.map((a) => a.title),
  ];
  return parts.filter(Boolean).join(' \n ').toLowerCase();
}

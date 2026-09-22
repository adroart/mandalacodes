/**
 * The one record, assembled once.
 *
 * The atlas page (globe + wall + ledger) and the registry page read the SAME
 * public sources — the public atlas state and the public catalog — and reduce
 * them to the same rows. That assembly used to live inside AtlasPage; it lives
 * here so a second surface can read the record without a second copy of the
 * rules drifting away from the first.
 *
 * Nothing here touches the DOM and nothing here filters: the row grammar is
 * still components/atlas/ledgerRow.ts, and the views compose their own filters
 * over what this returns.
 */

import { useEffect, useState } from 'react';
import { CITIES_BY_ID, formatPlaceLabel } from '../../data/cities';
import { FULL_ARCHIVE } from '../../data/mockData';
import { ulCardNumber } from '../../utils/universalLanguage';
import { pieceCode } from '../../utils/pieceCode';
import type { PublicCatalogEntry } from '../../utils/catalog';
import type { PublicAtlasState } from '../../types';
import { loadAtlasState } from './state';
import {
  atlasPieceToRow,
  cleanLedgerTitle,
  ledgerKindLabel,
  normFromAtlasStatus,
  normFromCatalogStatus,
  LEDGER_KIND_ORDER,
  type LedgerRow,
} from '../../components/atlas/ledgerRow';
import type { CodeIndexEntry } from '../../components/atlas/CodesIndex';
import type { LedgerKindSection } from '../../components/atlas/TheLedger';

/* ─── Helpers ──────────────────────────────────────────────────────────────
   Moved verbatim from AtlasPage; the atlas imports them from here now, so the
   two surfaces resolve a title, a city label, a code and a kind identically. */

/* Same key convention as the ledger (groupChains / projectAll) and the
   kinship index: pieces with no editionNumber use `0`. */
export function makeKey(pieceId: string, editionNumber?: number): string {
  return `${pieceId}:${editionNumber ?? 0}`;
}

export function titleFor(pieceId: string): string {
  const a = FULL_ARCHIVE.find((art) => art.id === pieceId);
  return a?.title ?? pieceId;
}

export function categoryFor(pieceId: string): string | undefined {
  return FULL_ARCHIVE.find((art) => art.id === pieceId)?.category;
}

export function coverImageFor(pieceId: string): string | undefined {
  return FULL_ARCHIVE.find((art) => art.id === pieceId)?.coverImage;
}

export function cityLabelFor(cityId: string | null | undefined): string | undefined {
  if (!cityId) return undefined;
  const c = CITIES_BY_ID.get(cityId);
  if (!c) return undefined;
  return formatPlaceLabel(c);
}

/** Universal Language card number for a piece, when it has one (1–64). */
export function cardNumberFor(pieceId: string): number | undefined {
  const a = FULL_ARCHIVE.find((art) => art.id === pieceId);
  if (!a || a.series !== 'Universal Language') return undefined;
  return ulCardNumber(a.coverImage) ?? undefined;
}

/** Signature-piece flag from the archive, so its sigil reads `SG` everywhere. */
export function signatureFor(pieceId: string): boolean | undefined {
  return FULL_ARCHIVE.find((art) => art.id === pieceId)?.isSignaturePiece;
}

/** Curated sigil-number lock from the archive, when one is pinned. */
export function sigilNumberFor(pieceId: string): number | undefined {
  return FULL_ARCHIVE.find((art) => art.id === pieceId)?.sigilNumber;
}

/** The ledger kind facet for an atlas-state piece — the server-derived `kind`
 *  when present, else derived from the archive. 'sixty-four' pieces belong to
 *  the code index; everything else groups under its kind in OTHER KINDS. */
export function kindForPiece(
  pieceId: string,
  serverKind?: string,
  category?: string,
  pieceType?: 'mandala' | 'other',
): string | null {
  if (serverKind) return serverKind;
  const art = FULL_ARCHIVE.find((a) => a.id === pieceId);
  if (art) {
    if (art.series === 'Universal Language') return 'sixty-four';
    if (art.series === 'Mandala' || pieceType === 'mandala') return 'mandala';
    if (art.isSignaturePiece) return 'signature';
    if (art.category === 'Jewelry') return 'jewelry';
    if (art.category) {
      return art.category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
  }
  if (category) {
    return category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  return null;
}

/** The frozen sigil a piece is known by (`UL № 1`, `SG № 4`, ...). The archive
 *  answers first; a catalog-only piece hands in its own series/category so its
 *  sigil is built from the same frozen tables (utils/pieceCode). */
export function sigilFor(
  pieceId: string,
  meta?: { series?: string; category?: string; cardNumber?: number },
): string {
  const art = FULL_ARCHIVE.find((a) => a.id === pieceId);
  return pieceCode({
    pieceId,
    series: meta?.series ?? art?.series,
    category: meta?.category ?? art?.category,
    cardNumber: meta?.cardNumber ?? cardNumberFor(pieceId),
    isSignaturePiece: signatureFor(pieceId),
    sigilNumber: sigilNumberFor(pieceId),
  });
}

/* ─── The pieces of the public state, with their titles ────────────────────── */

export type EnrichedPiece = PublicAtlasState['pieces'][number] & {
  key: string;
  title: string;
};

export function enrichPieces(data: PublicAtlasState): EnrichedPiece[] {
  return data.pieces.map((p) => ({
    ...p,
    key: makeKey(p.pieceId, p.editionNumber),
    title: titleFor(p.pieceId),
  }));
}

/* ─── The sixty-four ───────────────────────────────────────────────────────
   The flat all-64 index reads the FULL atlas state, never any view's active
   filters: it is a fixed catalogue of the whole language, so its counts stay
   honest regardless of what a globe above is currently showing. Only UL pieces
   (those carrying a code number) belong here. */

export function buildCodeEntries(enriched: readonly EnrichedPiece[]): CodeIndexEntry[] {
  const out: CodeIndexEntry[] = [];
  for (const p of enriched) {
    const cardNumber = cardNumberFor(p.pieceId);
    if (typeof cardNumber !== 'number') continue;
    out.push({
      cardNumber,
      key: p.key,
      pieceId: p.pieceId,
      editionNumber: p.editionNumber,
      title: p.title,
      status: p.status,
      cityLabel: cityLabelFor(p.cityId),
      cityName: p.cityId ? CITIES_BY_ID.get(p.cityId)?.city : undefined,
      // The public dream rides only on placed public pieces; the ledger
      // writes it inline (Part II.6, ruling 2).
      intention: p.intention,
      signedBy: p.signedBy,
      // Sort keys for the ledger's "most recently anchored" order.
      placedAt: p.placedAt,
      claimOrdinal: p.claimOrdinal,
    });
  }
  return out;
}

/* ─── The other kinds ──────────────────────────────────────────────────────
   Mandalas, signature pieces, jewelry, and any data-driven extras, merged from
   the public atlas state (status, city, dream) and the public catalog (title,
   kind, city). Keyed by pieceId so a catalogued piece already placed on the map
   is not doubled. The sixty-four stay in the code index above; only
   non-'sixty-four' kinds land here. Kinds with no real rows fall back to
   placeholders in the view that renders them. */

export function buildKindSections(
  enriched: readonly EnrichedPiece[],
  catalog: readonly PublicCatalogEntry[],
): LedgerKindSection[] {
  const byKind = new Map<string, LedgerRow[]>();
  const seen = new Set<string>();
  const push = (kind: string, row: LedgerRow) => {
    const arr = byKind.get(kind);
    if (arr) arr.push(row);
    else byKind.set(kind, [row]);
  };

  for (const p of enriched) {
    const k = kindForPiece(
      p.pieceId,
      p.kind,
      p.category ?? categoryFor(p.pieceId),
      p.pieceType,
    );
    if (!k || k === 'sixty-four') continue;
    seen.add(p.pieceId);
    push(k, {
      ...atlasPieceToRow({
        key: p.key,
        pieceId: p.pieceId,
        editionNumber: p.editionNumber,
        title: p.title,
        status: p.status,
        cityName: p.cityId ? CITIES_BY_ID.get(p.cityId)?.city : undefined,
        cityLabel: cityLabelFor(p.cityId),
        intention: p.intention,
        signedBy: p.signedBy,
        placedAt: p.placedAt,
        claimOrdinal: p.claimOrdinal,
      }),
      sigil: sigilFor(p.pieceId, {
        series: p.series,
        category: p.category ?? categoryFor(p.pieceId),
      }),
    });
  }

  for (const e of catalog) {
    if (seen.has(e.id)) continue;
    const k = e.kind === 'other' ? 'other' : e.kind; // mandala/signature/jewelry align
    const stated = enriched.find((pp) => pp.pieceId === e.id);
    const cityId = e.cityId ?? stated?.cityId ?? undefined;
    push(k, {
      key: `${e.id}:0`,
      pieceId: e.id,
      title: cleanLedgerTitle(e.title),
      norm: stated ? normFromAtlasStatus(stated.status) : normFromCatalogStatus(e.status),
      cityName: cityId ? CITIES_BY_ID.get(cityId)?.city : undefined,
      cityLabel: cityId ? cityLabelFor(cityId) : undefined,
      dream:
        stated?.intention && stated.intention.trim()
          ? stated.intention.trim()
          : undefined,
      onGlobe:
        !!stated && (stated.status === 'placed' || stated.status === 'unawakened'),
      placedAt: stated?.placedAt,
      claimOrdinal: stated?.claimOrdinal,
      availableForClaim: !stated && e.status === 'available',
      sigil: sigilFor(e.id, {
        series: e.series,
        category: e.kind === 'jewelry' ? 'Jewelry' : undefined,
      }),
    });
  }

  const sections: LedgerKindSection[] = [];
  for (const k of LEDGER_KIND_ORDER) {
    sections.push({ kind: k, label: ledgerKindLabel(k), rows: byKind.get(k) ?? [] });
    byKind.delete(k);
  }
  for (const k of Array.from(byKind.keys()).sort()) {
    if (k === 'sixty-four') continue;
    sections.push({ kind: k, label: ledgerKindLabel(k), rows: byKind.get(k) ?? [] });
  }
  return sections;
}

/* ─── The whole record, for a surface that has nothing else to load ─────────
   The atlas keeps its own fetch (it needs the enriched pieces for the globe,
   the kinship index and the HUD). A page that only wants the record — the
   registry — reaches for this. Both loaders are session-cached, so a visitor
   crossing between the two surfaces pays for neither twice. */

export type AtlasRecordStatus = 'loading' | 'ready' | 'error';

export interface AtlasRecord {
  status: AtlasRecordStatus;
  codeEntries: CodeIndexEntry[];
  kindSections: LedgerKindSection[];
  /** When the public mirror was last gathered, for the footer note. */
  generatedAt?: string;
}

const EMPTY_CODES: CodeIndexEntry[] = [];
const EMPTY_SECTIONS: LedgerKindSection[] = [];

export function useAtlasRecord(): AtlasRecord {
  const [record, setRecord] = useState<AtlasRecord>({
    status: 'loading',
    codeEntries: EMPTY_CODES,
    kindSections: EMPTY_SECTIONS,
  });

  useEffect(() => {
    let active = true;
    loadAtlasState()
      .then((data) => {
        if (!active) return;
        const enriched = enrichPieces(data);
        setRecord({
          status: 'ready',
          codeEntries: buildCodeEntries(enriched),
          kindSections: buildKindSections(enriched, []),
          generatedAt: data.generatedAt,
        });
      })
      .catch(() => {
        if (active) {
          setRecord({
            status: 'error',
            codeEntries: EMPTY_CODES,
            kindSections: EMPTY_SECTIONS,
          });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return record;
}

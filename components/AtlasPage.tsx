import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Globe, { type GlobeNode } from './atlas/Globe';
import AtlasFilters, { type AtlasStatusFilter } from './atlas/AtlasFilters';
import PieceSidePanel, { type KinEntry, type SelectedPiece } from './atlas/PieceSidePanel';
import SeekingGround, { type SeekingPiece } from './atlas/SeekingGround';
import KinshipLayer from './atlas/KinshipLayer';
import { FULL_ARCHIVE } from '../data/mockData';
import { CITIES_BY_ID } from '../data/cities';
import { loadAtlasState } from '../lib/atlas/state';
import { useProfile } from '../lib/profile/context';
import { ulCardNumber } from '../utils/universalLanguage';
import { buildKinshipIndex, greatCircleDistance, MAX_KINSHIP_ARCS } from '../utils/kinship';
import type { PublicAtlasState } from '../types';

const MAX_KIN_PER_PIECE = 6;

/* Selection key for the visitor's own birth place (from their Hologenetic
   Profile) — a globe node that is not a piece. */
const BIRTH_KEY = '__birth-place__';

const EARTH_RADIUS_KM = 6371;

/* ─── State machine ────────────────────────────────────────────────────────── */
type FetchState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; data: PublicAtlasState };

type EnrichedPiece = PublicAtlasState['pieces'][number] & {
  key: string;
  title: string;
};

/* ─── Helpers ──────────────────────────────────────────────────────────────── */
function makeKey(pieceId: string, editionNumber?: number): string {
  return `${pieceId}:${editionNumber ?? ''}`;
}

function titleFor(pieceId: string): string {
  const a = FULL_ARCHIVE.find((art) => art.id === pieceId);
  return a?.title ?? pieceId;
}

function categoryFor(pieceId: string): string | undefined {
  return FULL_ARCHIVE.find((art) => art.id === pieceId)?.category;
}

function cityLabelFor(cityId: string | null | undefined): string | undefined {
  if (!cityId) return undefined;
  const c = CITIES_BY_ID.get(cityId);
  if (!c) return undefined;
  return `${c.city}, ${c.country}`;
}

/** Universal Language card number for a piece, when it has one (1–64). */
function cardNumberFor(pieceId: string): number | undefined {
  const a = FULL_ARCHIVE.find((art) => art.id === pieceId);
  if (!a || a.series !== 'Universal Language') return undefined;
  return ulCardNumber(a.coverImage) ?? undefined;
}

/* ─── Component ────────────────────────────────────────────────────────────── */
const AtlasPage: React.FC = () => {
  const [state, setState] = useState<FetchState>({ kind: 'loading' });
  // ?piece=<pieceId[:edition]> deep-links to a selection — card pages use it
  // for their "See it on the Atlas" bridge, and selections stay shareable.
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedKey, setSelectedKeyState] = useState<string | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<string>('all');
  const [status, setStatus] = useState<AtlasStatusFilter>('all');
  const [kinshipVisible, setKinshipVisible] = useState<boolean>(true);

  /* The visitor's saved birth place (Hologenetic Profile, local-first).
     When present it appears as a sage marker on the globe — the bridge
     between the birthday map and the geography of the placed pieces. */
  const { profile } = useProfile();
  const birthPlace = profile?.inputs.place ?? null;

  /* Selection setter that mirrors the choice into the URL (replace, so
     browsing pieces doesn't pile up history entries). */
  const setSelectedKey = (key: string | null) => {
    setSelectedKeyState(key);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (key) next.set('piece', key.replace(/:$/, ''));
        else next.delete('piece');
        return next;
      },
      { replace: true },
    );
  };

  /* Globe container size — KinshipLayer needs CSS pixels to render the SVG
     overlay at the same dimensions cobe is drawing into. */
  const globeBoxRef = useRef<HTMLDivElement | null>(null);
  const [globeSize, setGlobeSize] = useState({ width: 0, height: 0 });

  /* Fetch the live atlas via the shared loader (falls back to the local
     seed on any failure so the page always renders something). The card
     page's "On the Atlas" seat reads the same cached state. */
  useEffect(() => {
    let active = true;
    loadAtlasState().then((data) => {
      if (active) setState({ kind: 'ready', data });
    });
    return () => {
      active = false;
    };
  }, []);

  /* Enrich pieces with titles, build the series list for the filter. */
  const enriched: EnrichedPiece[] = useMemo(() => {
    if (state.kind !== 'ready') return [];
    return state.data.pieces.map((p) => ({
      ...p,
      key: makeKey(p.pieceId, p.editionNumber),
      title: titleFor(p.pieceId),
    }));
  }, [state]);

  const availableSeries: string[] = useMemo(() => {
    const set = new Set<string>();
    for (const p of enriched) {
      if (p.series) set.add(p.series);
    }
    return Array.from(set).sort();
  }, [enriched]);

  /* Apply the ?piece= deep link once the atlas is loaded. Accepts both
     "UL-122" and "UL-122:2" (piece keys without an edition end in ":"),
     plus the birth-place key when the visitor has a saved profile. */
  useEffect(() => {
    if (enriched.length === 0) return;
    const param = searchParams.get('piece');
    if (!param) return;
    if (param === BIRTH_KEY) {
      if (birthPlace) setSelectedKeyState(BIRTH_KEY);
      return;
    }
    const match = enriched.find((p) => p.key === param || p.key === `${param}:`);
    if (match) setSelectedKeyState(match.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enriched]);

  /* Apply series filter to derive what the rest of the page sees. */
  const seriesFiltered: EnrichedPiece[] = useMemo(() => {
    if (selectedSeries === 'all') return enriched;
    return enriched.filter((p) => p.series === selectedSeries);
  }, [enriched, selectedSeries]);

  /* Counts for filter chrome — based on the series filter, before status filter. */
  const placedCount = useMemo(
    () => seriesFiltered.filter((p) => p.status === 'placed').length,
    [seriesFiltered],
  );
  const seekingCount = useMemo(
    () => seriesFiltered.filter((p) => p.status === 'seeking').length,
    [seriesFiltered],
  );

  /* Pieces visible on the globe respect both filters; status=seeking is shown
     in the seeking section, never on the globe (no coords to plot). */
  const globeNodes: GlobeNode[] = useMemo(() => {
    const visible = seriesFiltered.filter((p) => {
      if (status === 'seeking') return false; // seeking-only filter hides globe markers
      if (p.status !== 'placed') return false;
      if (!p.cityId) return false;
      return true;
    });
    const nodes: GlobeNode[] = [];
    for (const p of visible) {
      const c = p.cityId ? CITIES_BY_ID.get(p.cityId) : undefined;
      if (!c) continue;
      nodes.push({
        id: p.key,
        lat: c.lat,
        lng: c.lng,
        status: 'placed',
        label: p.title,
      });
    }
    // The visitor's birth place rides along regardless of filters — it is
    // not a piece, it is where they entered the map.
    if (birthPlace) {
      nodes.push({
        id: BIRTH_KEY,
        lat: birthPlace.lat,
        lng: birthPlace.lng,
        status: 'origin',
        label: 'Your birth place',
      });
    }
    return nodes;
  }, [seriesFiltered, status, birthPlace]);

  /* Seeking section honors filters — when status=placed, the section hides. */
  const seekingPieces: SeekingPiece[] = useMemo(() => {
    if (status === 'placed') return [];
    return seriesFiltered
      .filter((p) => p.status === 'seeking')
      .map((p) => ({
        pieceId: p.pieceId,
        editionNumber: p.editionNumber,
        title: p.title,
        series: p.series,
      }));
  }, [seriesFiltered, status]);

  /* Selected piece — falls back to null if the current selection got filtered out. */
  const selectedPiece: SelectedPiece | null = useMemo(() => {
    if (!selectedKey) return null;
    const match = seriesFiltered.find((p) => p.key === selectedKey);
    if (!match) return null;
    return {
      pieceId: match.pieceId,
      editionNumber: match.editionNumber,
      title: match.title,
      series: match.series,
      category: categoryFor(match.pieceId),
      status: match.status,
      cityLabel: cityLabelFor(match.cityId),
      placedAt: match.placedAt,
      cardNumber: cardNumberFor(match.pieceId),
    };
  }, [selectedKey, seriesFiltered]);

  /* If the selected piece falls outside the current filters, drop selection
     silently so the side panel doesn't show stale info. The birth place is
     not a piece and is never filtered out. */
  useEffect(() => {
    if (!selectedKey || selectedKey === BIRTH_KEY) return;
    const stillVisible = seriesFiltered.some((p) => p.key === selectedKey);
    if (!stillVisible) setSelectedKey(null);
  }, [selectedKey, seriesFiltered]);

  /* The placed pieces nearest the visitor's birth place — the "what of this
     language lives near where I began" list in the birth-place panel. */
  const nearestToBirth = useMemo(() => {
    if (!birthPlace) return [];
    const out: Array<{ key: string; title: string; cityLabel: string; km: number }> = [];
    for (const p of enriched) {
      if (p.status !== 'placed' || !p.cityId) continue;
      const c = CITIES_BY_ID.get(p.cityId);
      if (!c) continue;
      const rad = greatCircleDistance(birthPlace.lat, birthPlace.lng, c.lat, c.lng);
      out.push({
        key: p.key,
        title: p.title,
        cityLabel: `${c.city}, ${c.country}`,
        km: Math.round(rad * EARTH_RADIUS_KM),
      });
    }
    return out.sort((a, b) => a.km - b.km).slice(0, 3);
  }, [birthPlace, enriched]);

  /* Mirror cobe's square sizing — Globe sets width=height=min(box.w,box.h). The
     SVG overlay reads the same dimensions so arcs land on the canvas pixels. */
  useEffect(() => {
    const el = globeBoxRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        const d = Math.max(120, Math.min(cr.width, cr.height));
        setGlobeSize({ width: d, height: d });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* Kinship index — built off the raw atlas state, never the filtered slice.
     The map shows kinship as a property of the ledger, not of UI filters. */
  const kinshipIndex = useMemo(() => {
    if (state.kind !== 'ready') return null;
    return buildKinshipIndex(state.data, CITIES_BY_ID, FULL_ARCHIVE);
  }, [state]);

  useEffect(() => {
    if (kinshipIndex?.capped) {
      // Surface the cap in the architecture log per the spec.
      // eslint-disable-next-line no-console
      console.info(
        `[atlas/kinship] pair count exceeded MAX_KINSHIP_ARCS (${MAX_KINSHIP_ARCS}); rendering shortest arcs only.`,
      );
    }
  }, [kinshipIndex]);

  /* Kin list for the selected piece — only for UL pieces with kindred peers. */
  const kinForSelected: KinEntry[] = useMemo(() => {
    if (!selectedKey || !kinshipIndex) return [];
    const node = kinshipIndex.nodes.get(selectedKey);
    if (!node) return [];
    const pairs = kinshipIndex.pairsByKey.get(selectedKey) ?? [];
    return pairs
      .slice()
      .sort((a, b) => a.distance - b.distance)
      .slice(0, MAX_KIN_PER_PIECE)
      .map((pair) => {
        const otherKey = pair.aKey === selectedKey ? pair.bKey : pair.aKey;
        const other = kinshipIndex.nodes.get(otherKey);
        return { key: otherKey, title: other?.title ?? otherKey };
      });
  }, [selectedKey, kinshipIndex]);

  /* ─── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-paper-50 text-wood-900">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="px-6 pb-10 max-w-7xl mx-auto pt-[calc(var(--nav-height)+3rem)] sm:pt-[calc(var(--nav-height)+4rem)]">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-2 gap-y-1 font-label text-[11px] sm:text-xs uppercase tracking-[0.12em] sm:tracking-[0.2em] text-wood-700 mb-8 sm:mb-12"
        >
          <Link to="/" className="hover:text-wood-900 transition-colors">
            Home
          </Link>
          <span aria-hidden className="text-wood-400">
            /
          </span>
          <span className="text-wood-900">Atlas</span>
        </nav>

        <h1
          className="font-serif text-5xl md:text-7xl lg:text-8xl text-wood-900 font-medium leading-[0.93] mb-6"
          style={{ fontFamily: 'Cinzel, serif', letterSpacing: '0.04em' }}
        >
          Atlas
        </h1>
        <p className="font-serif text-xl md:text-2xl text-wood-700 max-w-2xl leading-[1.6]">
          Every piece, wherever it has come to rest. City-level only, never an address.
        </p>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="px-6 pb-32 max-w-7xl mx-auto">
        {state.kind === 'loading' && (
          <p
            className="font-serif italic text-lg text-wood-700 py-24 text-center"
            aria-live="polite"
          >
            loading the atlas
          </p>
        )}

        {state.kind === 'error' && (
          <p
            className="font-serif italic text-lg text-wood-700 py-24 text-center"
            aria-live="polite"
          >
            the atlas is briefly out of reach.
          </p>
        )}

        {state.kind === 'ready' && (
          <>
            {/* Filters */}
            <div className="border-t border-wood-200 pt-6 pb-8">
              <AtlasFilters
                series={availableSeries}
                selectedSeries={selectedSeries}
                onSeriesChange={setSelectedSeries}
                status={status}
                onStatusChange={setStatus}
                placedCount={placedCount}
                seekingCount={seekingCount}
                kinshipVisible={kinshipVisible}
                onKinshipChange={setKinshipVisible}
              />
            </div>

            {/* Globe + side panel.
                Globe takes ~60vh; side panel sits beside on lg+, below on smaller. */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
              <div
                ref={globeBoxRef}
                className="lg:col-span-2 w-full max-w-full overflow-hidden relative"
                style={{ height: '60vh', minHeight: 360 }}
              >
                <Globe
                  nodes={globeNodes}
                  selectedId={selectedKey}
                  onSelect={(id) => setSelectedKey(id)}
                  className="w-full h-full"
                />
                {kinshipIndex && (
                  <KinshipLayer
                    index={kinshipIndex}
                    width={globeSize.width}
                    height={globeSize.height}
                    selectedId={selectedKey}
                    visible={kinshipVisible}
                  />
                )}
              </div>
              <div className="lg:col-span-1">
                {selectedKey === BIRTH_KEY && birthPlace ? (
                  /* The visitor's own marker — not a piece, so it gets its
                     own panel: birth place, the bridge to the profile, and
                     the placed pieces nearest their origin. */
                  <aside
                    aria-label="Your birth place"
                    className="bg-paper-100 border border-wood-200 p-6 sm:p-8"
                  >
                    <p className="font-label text-[11px] uppercase tracking-[0.25em] text-bronze-700 mb-3">
                      Your birth place
                    </p>
                    <h3 className="font-serif text-2xl sm:text-3xl text-wood-900 font-medium leading-tight mb-3">
                      {birthPlace.label}
                    </h3>
                    <p className="font-sans text-sm text-wood-700 leading-relaxed mb-5">
                      The sky over this point at the moment you arrived is what
                      your Hologenetic Profile is calculated from.
                    </p>
                    <Link
                      to="/profile"
                      className="font-label text-[11px] uppercase tracking-[0.2em] font-semibold text-bronze-700 hover:text-bronze-600 transition-colors"
                    >
                      View your full chart →
                    </Link>
                    {nearestToBirth.length > 0 && (
                      <div className="border-t border-wood-200 pt-5 mt-5">
                        <p className="font-label text-[11px] uppercase tracking-[0.18em] text-wood-600 mb-2">
                          Pieces nearest your origin
                        </p>
                        <ul className="space-y-1.5">
                          {nearestToBirth.map((n) => (
                            <li key={n.key}>
                              <button
                                type="button"
                                onClick={() => setSelectedKey(n.key)}
                                className="font-serif text-base text-wood-900 hover:text-bronze-700 transition-colors text-left leading-snug"
                              >
                                {n.title}
                                <span className="text-wood-500"> · {n.cityLabel}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </aside>
                ) : (
                  <PieceSidePanel
                    piece={selectedPiece}
                    kin={kinForSelected}
                    onSelectKin={(key) => setSelectedKey(key)}
                  />
                )}
              </div>
            </div>

            {/* Seeking ground */}
            <div className="mt-16">
              <SeekingGround
                seekingPieces={seekingPieces}
                totalPieces={seriesFiltered.length}
                onSelect={(pieceId, editionNumber) =>
                  setSelectedKey(makeKey(pieceId, editionNumber))
                }
                selectedKey={selectedKey}
              />
            </div>

            {/* Generated-at footer note. */}
            <p className="mt-16 font-label text-[11px] uppercase tracking-[0.18em] text-wood-600">
              Last gathered{' '}
              {new Date(state.data.generatedAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default AtlasPage;

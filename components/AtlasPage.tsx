import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Globe, { type GlobeNode } from './atlas/Globe';
import { type AtlasStatusFilter } from './atlas/AtlasFilters';
import AtlasFiltersDark from './atlas/AtlasFiltersDark';
import PieceSidePanel, {
  type KinEntry,
  type SelectedPiece,
  type HolderChartSummary,
} from './atlas/PieceSidePanel';
import SeekingGround, { type SeekingPiece } from './atlas/SeekingGround';
import KinshipLayer from './atlas/KinshipLayer';
import { useIdleFade } from './atlas/useIdleFade';
import { seriesColor } from './atlas/seriesColor';
import PieceHUD from './atlas/PieceHUD';
import { FULL_ARCHIVE } from '../data/mockData';
import { CITIES_BY_ID, formatPlaceLabel } from '../data/cities';
import { loadAtlasState } from '../lib/atlas/state';
import { useProfile } from '../lib/profile/context';
import { ulCardNumber } from '../utils/universalLanguage';
import { buildKinshipIndex, greatCircleDistance, MAX_KINSHIP_ARCS } from '../utils/kinship';
import { SIZE_BANDS, sizeBandFor, type SizeBand } from '../utils/sizeBands';
import type { PublicAtlasState } from '../types';

/* The Three.js globe loads as its own chunk so the page paints immediately;
   browsers without WebGL keep the cobe globe + SVG kinship overlay. */
const Globe3D = lazy(() => import('./atlas/three/Globe3D'));
const GlobeGL = lazy(() => import('./atlas/GlobeGL'));
// The hand-built globe (hexagram ring, kinship arcs, ignition opening,
// mandala view) is the default; ?libglobe falls back to the library-backed
// one for comparison.
const USE_GL_GLOBE =
  typeof window !== 'undefined' && window.location.search.includes('libglobe');

function webglAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

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
/* Same key convention as the ledger (groupChains / projectAll) and the
   kinship index: pieces with no editionNumber use `0`. */
function makeKey(pieceId: string, editionNumber?: number): string {
  return `${pieceId}:${editionNumber ?? 0}`;
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
  return formatPlaceLabel(c);
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
  /* Filters initialize from the URL so filtered views are shareable
     (e.g. /atlas?series=Universal+Language&size=large). */
  const [selectedSeries, setSelectedSeriesState] = useState<string>(
    () => searchParams.get('series') ?? 'all',
  );
  const [status, setStatusState] = useState<AtlasStatusFilter>(() => {
    const s = searchParams.get('status');
    return s === 'placed' || s === 'seeking' ? s : 'all';
  });
  const [selectedCategory, setSelectedCategoryState] = useState<string>(
    () => searchParams.get('category') ?? 'all',
  );
  const [selectedSize, setSelectedSizeState] = useState<SizeBand | 'all'>(() => {
    const s = searchParams.get('size');
    return s && (SIZE_BANDS as readonly string[]).includes(s) ? (s as SizeBand) : 'all';
  });
  const [kinshipVisible, setKinshipVisible] = useState<boolean>(true);
  const [mandala, setMandala] = useState<boolean>(false);
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false);
  /* Lenses (M6): tapping a series in the legend focuses its constellation;
     "your codes" recedes every light that does not carry one of the
     visitor's own codes. Recede, never remove. */
  const [focusSeries, setFocusSeries] = useState<string | null>(null);
  const [yoursMode, setYoursMode] = useState<boolean>(false);
  const [markerScreenPos, setMarkerScreenPos] = useState<{ x: number; y: number } | null>(null);
  // Corner chrome fades when the visitor stops interacting, leaving only the
  // turning world. A selected piece or open filters keep the chrome awake.
  const idle = useIdleFade(4000) && !selectedKey && !filtersOpen;

  // Esc releases the locked piece.
  useEffect(() => {
    if (!selectedKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedKeyState(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedKey]);
  const [use3D] = useState<boolean>(webglAvailable);

  /* Mirror a filter into the URL; 'all' clears the param. */
  const setFilterParam = (key: string, value: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === 'all') next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );
  };
  const setSelectedSeries = (v: string) => {
    setSelectedSeriesState(v);
    setFilterParam('series', v);
  };
  const setStatus = (v: AtlasStatusFilter) => {
    setStatusState(v);
    setFilterParam('status', v);
  };
  const setSelectedCategory = (v: string) => {
    setSelectedCategoryState(v);
    setFilterParam('category', v);
  };
  const setSelectedSize = (v: SizeBand | 'all') => {
    setSelectedSizeState(v);
    setFilterParam('size', v);
  };

  /* The visitor's saved birth place (Hologenetic Profile, local-first).
     When present it appears as a sage marker on the globe — the bridge
     between the birthday map and the geography of the placed pieces. */
  const { profile } = useProfile();
  const birthPlace = profile?.inputs.place ?? null;
  const navigate = useNavigate();

  /* The visitor's own codes: the gates of all eleven profile positions,
     computed locally. Nothing about the profile leaves the device; the
     "your codes" lens is a comparison done entirely in the browser. */
  const yourGates = useMemo(() => {
    const set = new Set<number>();
    const computed = profile?.computed as
      | Record<string, { gate?: number } | undefined>
      | undefined;
    if (computed) {
      for (const v of Object.values(computed)) {
        if (v && typeof v.gate === 'number') set.add(v.gate);
      }
    }
    return set;
  }, [profile]);

  /* Selection setter that mirrors the choice into the URL (replace, so
     browsing pieces doesn't pile up history entries). */
  const setSelectedKey = (key: string | null) => {
    setSelectedKeyState(key);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (key) next.set('piece', key.replace(/:0$/, ''));
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
     "UL-122" and "UL-122:2" (piece keys without an edition end in ":0"),
     plus the birth-place key when the visitor has a saved profile. */
  useEffect(() => {
    if (enriched.length === 0) return;
    const param = searchParams.get('piece');
    if (!param) return;
    if (param === BIRTH_KEY) {
      if (birthPlace) setSelectedKeyState(BIRTH_KEY);
      return;
    }
    const match = enriched.find((p) => p.key === param || p.key === `${param}:0`);
    if (match) setSelectedKeyState(match.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enriched]);

  /* Category and size-band lookups come from the archive, keyed by pieceId. */
  const categoriesAvailable: string[] = useMemo(() => {
    const set = new Set<string>();
    for (const p of enriched) {
      const c = p.category ?? categoryFor(p.pieceId);
      if (c) set.add(c);
    }
    return Array.from(set).sort();
  }, [enriched]);

  const sizeBandByPiece = useMemo(() => {
    const map = new Map<string, SizeBand | null>();
    for (const art of FULL_ARCHIVE) map.set(art.id, sizeBandFor(art));
    return map;
  }, []);

  const availableSizes: SizeBand[] = useMemo(
    () => SIZE_BANDS.filter((b) => enriched.some((p) => sizeBandByPiece.get(p.pieceId) === b)),
    [enriched, sizeBandByPiece],
  );

  /* Apply series, category and size filters to derive what the rest of the
     page sees. Status stays separate so the counts read pre-status. */
  const seriesFiltered: EnrichedPiece[] = useMemo(() => {
    return enriched.filter((p) => {
      if (selectedSeries !== 'all' && p.series !== selectedSeries) return false;
      if (selectedCategory !== 'all') {
        const c = p.category ?? categoryFor(p.pieceId);
        if (c !== selectedCategory) return false;
      }
      if (selectedSize !== 'all' && sizeBandByPiece.get(p.pieceId) !== selectedSize) return false;
      return true;
    });
  }, [enriched, selectedSeries, selectedCategory, selectedSize, sizeBandByPiece]);

  /* Counts for filter chrome — based on the series filter, before status filter. */
  const placedCount = useMemo(
    () => seriesFiltered.filter((p) => p.status === 'placed').length,
    [seriesFiltered],
  );
  const seekingCount = useMemo(
    () => seriesFiltered.filter((p) => p.status === 'seeking').length,
    [seriesFiltered],
  );

  /* Low-density framing: this is Adrian's body of work, not a constellation
     of strangers. A "light" is a claimed piece (carries an ordinal); the
     collective framing earns its place as density grows. */
  const totalCount = enriched.length;
  const lightsLit = useMemo(
    () => enriched.filter((p) => typeof p.claimOrdinal === 'number').length,
    [enriched],
  );

  /* Pieces visible on the globe respect both filters; status=seeking is shown
     in the seeking section, never on the globe (no coords to plot). */
  const globeNodes: GlobeNode[] = useMemo(() => {
    const visible = seriesFiltered.filter((p) => {
      if (status === 'seeking') return false; // seeking-only filter hides globe markers
      // Both lit ('placed') and sold-but-unclaimed ('unawakened') pieces have
      // a city and belong on the globe; only the truly unplaced are hidden.
      if (p.status !== 'placed' && p.status !== 'unawakened') return false;
      if (!p.cityId) return false;
      return true;
    });
    const nodes: GlobeNode[] = [];
    for (const p of visible) {
      const c = p.cityId ? CITIES_BY_ID.get(p.cityId) : undefined;
      if (!c) continue;
      const num = cardNumberFor(p.pieceId);
      nodes.push({
        id: p.key,
        lat: c.lat,
        lng: c.lng,
        status: p.status === 'unawakened' ? 'unawakened' : 'placed',
        label: p.title,
        pieceType: p.pieceType,
        series: p.series,
        ordinal: p.claimOrdinal,
        yours: num != null && yourGates.has(num),
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
  }, [seriesFiltered, status, birthPlace, yourGates]);

  /* Ring tap (mandala view): a lit code travels to its piece in the world;
     an unlit code opens the code itself, where its pieces and the acquire
     path live. */
  const handleRingTap = (n: number) => {
    const match = seriesFiltered.find(
      (p) =>
        cardNumberFor(p.pieceId) === n &&
        (p.status === 'placed' || p.status === 'unawakened') &&
        p.cityId,
    );
    if (match) setSelectedKey(match.key);
    else navigate(`/universal-language/${n}`);
  };

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
      claimOrdinal: match.claimOrdinal,
    };
  }, [selectedKey, seriesFiltered]);

  /* The dream the selected piece publicly carries (present in the public
     state only for live, keeper-shared entries on mapped pieces). */
  const selectedIntention = useMemo(() => {
    if (!selectedKey) return null;
    const match = seriesFiltered.find((p) => p.key === selectedKey) as
      | (EnrichedPiece & { intention?: string })
      | undefined;
    return match?.intention ?? null;
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
        cityLabel: formatPlaceLabel(c),
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

  /* First placed location per hexagram (1–64) — feeds the hexagram ring's
     city-to-glyph threads. Built from the raw ledger, never the filters. */
  const placedByCard = useMemo(() => {
    const map = new Map<number, { lat: number; lng: number }>();
    for (const p of enriched) {
      if (p.status !== 'placed' || !p.cityId) continue;
      const num = cardNumberFor(p.pieceId);
      if (num == null || map.has(num)) continue;
      const c = CITIES_BY_ID.get(p.cityId);
      if (c) map.set(num, { lat: c.lat, lng: c.lng });
    }
    return map;
  }, [enriched]);

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
        // Name the thread that joins them, so following it reads as meaning
        // rather than navigation. "Heaven (Ch'ien)" shortens to "Heaven".
        const self = kinshipIndex.nodes.get(selectedKey);
        let thread = '';
        if (self && other) {
          const otherTrigrams = new Set([other.upperTrigram, other.lowerTrigram]);
          const shared = otherTrigrams.has(self.upperTrigram)
            ? self.upperTrigram
            : otherTrigrams.has(self.lowerTrigram)
              ? self.lowerTrigram
              : null;
          if (shared) thread = ` · ${shared.replace(/\s*\(.*\)$/, '')} thread`;
        }
        return { key: otherKey, title: `${other?.title ?? otherKey}${thread}` };
      });
  }, [selectedKey, kinshipIndex]);

  /* Holder chart (M5) — "held by a chart of…". Derived, non-identifying
     fields only; the endpoint returns chart: null unless the steward opted
     into Ring 3 and has a profile. Fetched per selected piece; cleared
     between selections so one piece's chart never bleeds onto another. */
  const [holderChart, setHolderChart] = useState<HolderChartSummary | null>(null);
  useEffect(() => {
    setHolderChart(null);
    if (!selectedPiece || selectedPiece.status !== 'placed') return;
    let active = true;
    const params = new URLSearchParams({ pieceId: selectedPiece.pieceId });
    if (typeof selectedPiece.editionNumber === 'number') {
      params.set('editionNumber', String(selectedPiece.editionNumber));
    }
    fetch(`/api/atlas/holder-chart?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { chart?: HolderChartSummary | null } | null) => {
        if (active && data?.chart) setHolderChart(data.chart);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [selectedPiece]);

  /* ─── Render ─────────────────────────────────────────────────────────────── */
  // Which series currently have placed pieces on the map — drives the legend.
  const legendSeries: string[] = useMemo(() => {
    const set = new Set<string>();
    for (const n of globeNodes) {
      if (n.status === 'origin') continue;
      set.add(n.series ?? 'Universal Language');
    }
    return Array.from(set).sort();
  }, [globeNodes]);

  const hasBirthOrigin = globeNodes.some((n) => n.status === 'origin');

  // Coordinate of the selected marker, for the HUD's lat-long readout.
  const selectedCoord = useMemo(() => {
    if (!selectedKey) return null;
    const n = globeNodes.find((node) => node.id === selectedKey);
    return n ? { lat: n.lat, lng: n.lng } : null;
  }, [selectedKey, globeNodes]);

  // Chrome opacity easing — one class drives every corner overlay together.
  const chromeOpacity = idle ? 'opacity-25' : 'opacity-100';

  return (
    <div className="min-h-screen bg-paper-50 text-wood-900">
      {/* ── Immersive globe stage ─────────────────────────────────────────── */}
      {state.kind === 'ready' && use3D && (
        <section
          ref={globeBoxRef}
          aria-label="Atlas globe"
          className="relative w-full overflow-hidden bg-[rgb(15,13,11)] block"
          style={{
            height: 'calc(100svh - var(--nav-height))',
            minHeight: 'min(560px, calc(100svh - var(--nav-height)))',
            marginBottom: 0,
            // HUD and corner chrome anchor below the fixed nav using this.
            ['--hud-top' as string]: 'calc(var(--nav-height) + 1rem)',
          }}
        >
          {/* The world, full-bleed. */}
          <div className="absolute inset-0">
            <Suspense
              fallback={
                <div
                  aria-hidden
                  className="w-full h-full"
                  style={{
                    background:
                      'radial-gradient(circle at 50% 50%, rgb(28, 25, 21) 0%, rgb(15, 13, 11) 62%)',
                  }}
                />
              }
            >
              {USE_GL_GLOBE ? (
                <GlobeGL
                  nodes={globeNodes}
                  selectedId={selectedKey}
                  onSelect={(id) => setSelectedKey(id)}
                  kinship={kinshipIndex}
                  kinshipVisible={kinshipVisible}
                  placedByCard={placedByCard}
                  mandala={mandala}
                  mandalaCaption={`The mandala so far · ${placedByCard.size} of 64 placed`}
                  onMarkerScreenPos={setMarkerScreenPos}
                  onBackgroundClick={() => setSelectedKey(null)}
                  className="w-full h-full"
                />
              ) : (
                <Globe3D
                  nodes={globeNodes}
                  selectedId={selectedKey}
                  onSelect={(id) => setSelectedKey(id)}
                  kinship={kinshipIndex}
                  kinshipVisible={kinshipVisible}
                  placedByCard={placedByCard}
                  mandala={mandala}
                  mandalaCaption={`The mandala so far · ${placedByCard.size} of 64 placed · touch a code to visit it`}
                  onMarkerScreenPos={setMarkerScreenPos}
                  onBackgroundClick={() => setSelectedKey(null)}
                  focusSeries={focusSeries}
                  yoursMode={yoursMode}
                  onRingTap={handleRingTap}
                  className="w-full h-full"
                />
              )}
            </Suspense>
          </div>

          {/* ── Corner chrome (fades when idle) ─────────────────────────────── */}
          <div
            className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${chromeOpacity}`}
          >
            {/* Top-left: breadcrumb + title */}
            <div className="pointer-events-auto absolute left-5 sm:left-8 top-[calc(var(--nav-height)+1rem)]">
              <nav
                aria-label="Breadcrumb"
                className="flex items-center gap-2 font-label text-[10px] uppercase tracking-[0.2em] text-bronze-400/60 mb-3"
              >
                <Link to="/" className="hover:text-bronze-400 transition-colors">
                  Home
                </Link>
                <span aria-hidden>/</span>
                <span className="text-bronze-400/90">Atlas</span>
              </nav>
              <h1
                className="text-3xl sm:text-5xl text-bronze-300 font-medium leading-none"
                style={{ fontFamily: 'Cinzel, serif', letterSpacing: '0.05em' }}
              >
                Atlas
              </h1>
            </div>

            {/* Top-right: legend. Each series is a lens: tap to focus its
                constellation; the rest of the lights recede, never vanish. */}
            {legendSeries.length > 0 && (
              <div className="pointer-events-auto absolute right-5 sm:right-8 top-[calc(var(--nav-height)+1rem)] text-right">
                {legendSeries.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={focusSeries === s}
                    onClick={() => setFocusSeries((cur) => (cur === s ? null : s))}
                    className={`block w-full text-right font-label text-[10px] sm:text-[11px] uppercase tracking-[0.18em] leading-relaxed transition-colors ${
                      focusSeries === s
                        ? 'text-bronze-300'
                        : focusSeries
                          ? 'text-wood-500 hover:text-wood-300'
                          : 'text-wood-300/80 hover:text-bronze-300/90'
                    }`}
                  >
                    {s}
                    <span aria-hidden style={{ color: seriesColor(s) }}>
                      {' '}·
                    </span>
                  </button>
                ))}
                {hasBirthOrigin && (
                  <div className="font-label text-[10px] sm:text-[11px] uppercase tracking-[0.18em] text-wood-300/80 leading-relaxed">
                    your origin
                    <span aria-hidden style={{ color: '#9caa87' }}>
                      {' '}·
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Bottom-left: the quiet stat caption, with the vocabulary
                explained in place so the map never reads as silent jargon. */}
            {totalCount > 0 && (
              <div className="pointer-events-none absolute left-5 sm:left-8 bottom-6 max-w-[48vw] sm:max-w-sm">
                <p className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-400/70">
                  {totalCount} {totalCount === 1 ? 'piece' : 'pieces'}
                  <span aria-hidden className="mx-2 text-wood-500">·</span>
                  {lightsLit} {lightsLit === 1 ? 'light lit' : 'lights lit'}
                </p>
                <p className="mt-1.5 font-serif italic text-[12px] leading-snug tracking-[0.03em] text-wood-400/80">
                  a light is a piece claimed by its keeper · threads join pieces
                  that share a code
                </p>
              </div>
            )}

            {/* Bottom gutter: threads · filter · mandala */}
            <div className="pointer-events-auto absolute right-5 sm:right-8 bottom-6 flex items-center gap-4 sm:gap-6">
              {yourGates.size > 0 && (
                <button
                  type="button"
                  aria-pressed={yoursMode}
                  onClick={() => setYoursMode((v) => !v)}
                  title="Lights carrying one of your own codes"
                  className={`font-label text-[10px] uppercase tracking-[0.2em] transition-colors ${
                    yoursMode ? 'text-[#9caa87]' : 'text-wood-400 hover:text-[#9caa87]'
                  }`}
                >
                  your codes
                </button>
              )}
              <button
                type="button"
                aria-pressed={kinshipVisible}
                onClick={() => setKinshipVisible((v) => !v)}
                title="Threads join pieces whose hexagrams share a trigram"
                className={`font-label text-[10px] uppercase tracking-[0.2em] transition-colors ${
                  kinshipVisible
                    ? 'text-bronze-400'
                    : 'text-wood-400 hover:text-bronze-400/80'
                }`}
              >
                threads
              </button>
              <button
                type="button"
                aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen((o) => !o)}
                className="font-label text-[10px] uppercase tracking-[0.2em] text-wood-300 hover:text-bronze-400 transition-colors"
              >
                filter
                {(selectedSeries !== 'all' ||
                  status !== 'all' ||
                  selectedCategory !== 'all' ||
                  selectedSize !== 'all') && (
                  <span className="text-bronze-400"> · ·</span>
                )}
              </button>
              <button
                type="button"
                aria-pressed={mandala}
                onClick={() => setMandala((m) => !m)}
                title="Pull back to see the whole weave at once"
                className="font-label text-[10px] uppercase tracking-[0.2em] text-bronze-400/80 hover:text-bronze-400 transition-colors"
              >
                {mandala ? 'return' : 'mandala'}
              </button>
              {selectedKey && (
                <button
                  type="button"
                  onClick={() => setSelectedKey(null)}
                  className="font-label text-[10px] uppercase tracking-[0.2em] text-bronze-300 hover:text-bronze-200 transition-colors"
                >
                  release
                </button>
              )}
            </div>
          </div>

          {/* ── Filter slide-up (bottom-left), dark translucent ─────────────── */}
          {filtersOpen && (
            <div className="absolute inset-x-4 bottom-20 z-30 sm:inset-x-auto sm:left-8 sm:bottom-16 sm:w-[400px]">
              <div
                className="border border-bronze-400/15 p-6 sm:p-7 shadow-2xl"
                style={{
                  background:
                    'linear-gradient(160deg, rgba(28,23,18,0.95) 0%, rgba(17,14,11,0.96) 100%)',
                  backdropFilter: 'blur(16px)',
                  boxShadow: '0 20px 60px -12px rgba(0,0,0,0.7)',
                }}
              >
                <div className="flex items-center justify-between mb-6">
                  <span className="font-label text-[10px] uppercase tracking-[0.28em] text-bronze-400/70">
                    Refine the map
                  </span>
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(false)}
                    className="font-label text-[10px] uppercase tracking-[0.2em] text-wood-500 hover:text-bronze-300 transition-colors"
                  >
                    close
                  </button>
                </div>
                <AtlasFiltersDark
                  series={availableSeries}
                  selectedSeries={selectedSeries}
                  onSeriesChange={setSelectedSeries}
                  status={status}
                  onStatusChange={setStatus}
                  categories={categoriesAvailable}
                  selectedCategory={selectedCategory}
                  onCategoryChange={setSelectedCategory}
                  availableSizes={availableSizes}
                  selectedSize={selectedSize}
                  onSizeChange={setSelectedSize}
                  placedCount={placedCount}
                  seekingCount={seekingCount}
                  kinshipVisible={kinshipVisible}
                  onKinshipChange={setKinshipVisible}
                />
              </div>
            </div>
          )}

          {/* ── Leader-line: a hairline from the marker to the HUD card ──────── */}
          {selectedKey && markerScreenPos && globeBoxRef.current && (
            <svg
              className="pointer-events-none absolute inset-0 z-20 hidden sm:block"
              width="100%"
              height="100%"
            >
              <line
                x1={markerScreenPos.x}
                y1={markerScreenPos.y}
                x2={globeBoxRef.current.clientWidth - 412}
                y2={Math.min(
                  Math.max(markerScreenPos.y, 120),
                  globeBoxRef.current.clientHeight - 160,
                )}
                stroke={selectedKey === BIRTH_KEY ? 'rgba(156,170,135,0.5)' : 'rgba(196,170,124,0.45)'}
                strokeWidth={1}
              />
              <circle
                cx={markerScreenPos.x}
                cy={markerScreenPos.y}
                r={2.5}
                fill={selectedKey === BIRTH_KEY ? '#9caa87' : '#c4aa7c'}
              />
            </svg>
          )}

          {/* ── Piece HUD: instrument readout in the cleared space ───────────── */}
          {selectedKey && (
            <div
              className="absolute z-30 animate-[hud-in_400ms_ease-out]
                inset-x-3 bottom-3 max-h-[52%]
                sm:inset-x-auto sm:right-8 sm:bottom-auto sm:left-auto sm:w-[380px]"
              style={{ top: 'var(--hud-top)' }}
            >
              {selectedKey === BIRTH_KEY && birthPlace ? (
                <PieceHUD
                  isOrigin
                  piece={{
                    pieceId: 'origin',
                    title: birthPlace.label,
                    status: 'placed',
                    cityLabel: birthPlace.label,
                    category: 'Your birth place',
                  }}
                  coord={selectedCoord}
                  kin={nearestToBirth.map((n) => ({ key: n.key, title: `${n.title} · ${n.cityLabel}` }))}
                  onSelectKin={(key) => setSelectedKey(key)}
                  onRelease={() => setSelectedKey(null)}
                />
              ) : selectedPiece ? (
                <PieceHUD
                  piece={selectedPiece}
                  coord={selectedCoord}
                  kin={kinForSelected}
                  onSelectKin={(key) => setSelectedKey(key)}
                  holderChart={holderChart}
                  onRelease={() => setSelectedKey(null)}
                  carriesYourCode={
                    selectedPiece.cardNumber != null &&
                    yourGates.has(selectedPiece.cardNumber)
                  }
                  intention={selectedIntention}
                />
              ) : null}
            </div>
          )}
        </section>
      )}

      {/* ── Body (below the fold): loading/error + seeking ground ──────────── */}
      <div className="px-6 pb-32 max-w-7xl mx-auto pt-16">
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
            {/* Seeking ground */}
            <div className="mt-4">
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

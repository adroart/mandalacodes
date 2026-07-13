import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Globe, { type GlobeNode } from './atlas/Globe';
import AtlasFilters, { type AtlasStatusFilter } from './atlas/AtlasFilters';
import AtlasFiltersDark from './atlas/AtlasFiltersDark';
import PieceSidePanel, {
  ordinalLabel,
  type KinEntry,
  type SelectedPiece,
  type HolderChartSummary,
} from './atlas/PieceSidePanel';
import SeekingGround, { type SeekingPiece } from './atlas/SeekingGround';
import KinshipLayer from './atlas/KinshipLayer';
import { useIdleFade } from './atlas/useIdleFade';
import { seriesColor } from './atlas/seriesColor';
import PieceHUD from './atlas/PieceHUD';
import { pieceCode } from '../utils/pieceCode';
import { FULL_ARCHIVE } from '../data/mockData';
import { CITIES_BY_ID, formatPlaceLabel } from '../data/cities';
import { loadAtlasState } from '../lib/atlas/state';
import { useProfile } from '../lib/profile/context';
import { useAccount } from '../lib/account/useAccount';
import { useCollections } from '../lib/collections/context';
import { ulCardNumber } from '../utils/universalLanguage';
import { buildKinshipIndex, greatCircleDistance, MAX_KINSHIP_ARCS } from '../utils/kinship';
import { buildDreamRoute } from '../utils/dreamStream';
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

/* Dream Stream: one gesture equals one hop. The cooldown matches the flight so
   gestures during a flight are swallowed; the wheel delta threshold keeps a
   single trackpad flick from firing twice; the swipe threshold ignores small
   drags of the globe. */
const STREAM_COOLDOWN_MS = 1500;
const STREAM_WHEEL_THRESHOLD = 30;
const STREAM_SWIPE_THRESHOLD = 60;

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

function coverImageFor(pieceId: string): string | undefined {
  return FULL_ARCHIVE.find((art) => art.id === pieceId)?.coverImage;
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

  /* Dream Stream: the feed-like drift across the dream-bearing lights. When
     active, one gesture flies to the next light and opens its vessel. */
  const [streamActive, setStreamActive] = useState<boolean>(false);

  // Esc releases the locked piece, and while drifting also exits the stream.
  useEffect(() => {
    if (!selectedKey && !streamActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setStreamActive(false);
        setSelectedKeyState(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedKey, streamActive]);
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
    const computed = profile?.computed as unknown as
      | Record<string, { gate?: number } | undefined>
      | undefined;
    if (computed) {
      for (const v of Object.values(computed)) {
        if (v && typeof v.gate === 'number') set.add(v.gate);
      }
    }
    return set;
  }, [profile]);

  /* Signed-in personalization: the pieces you steward and the cards you
     saved. Own pieces come from the idempotent Phase A bind call, the same
     one StewardEdit makes on mount; saved cards ride the collections
     context. Signed out (or accounts unconfigured), no fetch fires and both
     stay empty, so the globe is unchanged. */
  const { available: accountAvailable, isLoaded, isSignedIn, fetchAuthed } = useAccount();
  const [ownedKeys, setOwnedKeys] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    if (!accountAvailable || !isLoaded || !isSignedIn) {
      setOwnedKeys((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }
    let cancelled = false;
    fetchAuthed('/api/atlas/steward/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          data: {
            claimed?: Array<{
              steward: { pieceId: string; editionNumber?: number | null };
            }>;
          } | null,
        ) => {
          if (cancelled || !data?.claimed) return;
          setOwnedKeys(
            new Set(
              data.claimed.map((c) =>
                makeKey(c.steward.pieceId, c.steward.editionNumber ?? undefined),
              ),
            ),
          );
        },
      )
      .catch(() => {
        /* quiet: personalization only */
      });
    return () => {
      cancelled = true;
    };
  }, [accountAvailable, isLoaded, isSignedIn, fetchAuthed]);

  const { collections } = useCollections();
  const savedCards = useMemo(() => {
    const set = new Set<number>();
    for (const c of collections) {
      for (const item of c.items) {
        if (item.kind !== 'card') continue;
        const n = parseInt(item.ref, 10);
        if (Number.isFinite(n)) set.add(n);
      }
    }
    return set;
  }, [collections]);

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
  // ── TEMPORARY PLACEHOLDER caption ── see data/atlasPlaceholder.ts. True only
  // while the placeholder dots stand in for an unseeded mirror; delete at launch.
  const isPlaceholder = state.kind === 'ready' && state.data.placeholder === true;
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
        // Potency inputs: the size band drives marker brightness; category
        // rides along for future lensing. Price stays undefined until it lands
        // and then flows through untouched.
        sizeBand: sizeBandByPiece.get(p.pieceId) ?? undefined,
        category: p.category ?? categoryFor(p.pieceId),
        // "Your codes" lights pieces whose gate sits in your profile OR whose
        // card you saved to a collection; "owned" marks pieces you steward.
        yours: num != null && (yourGates.has(num) || savedCards.has(num)),
        owned: ownedKeys.has(p.key),
        // The dream rides only on lit ('placed') lights; the sky is written by
        // the pieces that have come to rest with a keeper.
        intention: p.status === 'placed' ? p.intention : undefined,
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
  }, [seriesFiltered, status, birthPlace, yourGates, savedCards, ownedKeys, sizeBandByPiece]);

  /* ─── Dream Stream ───────────────────────────────────────────────────────
     The ordered route across the dream-bearing lights (placed, carrying a
     public dream, mapped to a city). buildDreamRoute is deterministic: it
     starts at the artist's first light and hops to the nearest not-yet-visited
     one. Recomputed as filters change the visible set. */
  const dreamRoute = useMemo(() => {
    const stops = globeNodes
      .filter(
        (n) =>
          n.status === 'placed' &&
          typeof n.intention === 'string' &&
          n.intention.trim().length > 0,
      )
      .map((n) => ({ key: n.id, lat: n.lat, lng: n.lng, claimOrdinal: n.ordinal }));
    return buildDreamRoute(stops);
  }, [globeNodes]);

  /* Fresh reads for the imperative input handlers, so the wheel/key/touch
     listeners never close over a stale route or selection. */
  const dreamRouteRef = useRef(dreamRoute);
  dreamRouteRef.current = dreamRoute;
  const selectedKeyForStreamRef = useRef(selectedKey);
  selectedKeyForStreamRef.current = selectedKey;

  /* One gesture equals one hop. The cooldown (matching the flight) swallows
     gestures fired mid-flight; advancing wraps at both ends. Held in a ref and
     refreshed each render so the listeners can stay subscribed to just
     `streamActive`. */
  const streamCooldownRef = useRef(0);
  const lastInputWasTouchRef = useRef(false);
  const advanceStreamRef = useRef<(dir: 1 | -1) => void>(() => {});
  advanceStreamRef.current = (dir: 1 | -1) => {
    const now =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now < streamCooldownRef.current) return;
    const route = dreamRouteRef.current;
    if (route.length === 0) return;
    const cur = selectedKeyForStreamRef.current
      ? route.indexOf(selectedKeyForStreamRef.current)
      : -1;
    const nextIdx =
      cur === -1
        ? dir === 1
          ? 0
          : route.length - 1
        : (cur + dir + route.length) % route.length;
    streamCooldownRef.current = now + STREAM_COOLDOWN_MS;
    setSelectedKey(route[nextIdx]);
  };

  const enterStream = () => {
    if (dreamRoute.length === 0) return;
    setMandala(false); // leaving mandala view if it was engaged
    setStreamActive(true);
    if (!selectedKey || !dreamRoute.includes(selectedKey)) {
      setSelectedKey(dreamRoute[0]);
    }
  };
  const exitStream = () => setStreamActive(false); // keeps the current selection

  /* If the route empties under a filter change while drifting, leave the
     stream so the "drift" control never lies about being active. */
  useEffect(() => {
    if (streamActive && dreamRoute.length === 0) setStreamActive(false);
  }, [streamActive, dreamRoute]);

  /* Wheel + touch, scoped to the globe stage. A wheel or swipe originating
     inside the piece card must scroll the card (data-atlas-hud), never advance
     the stream. Wheel over the globe is consumed so the page never scrolls out
     from under the reel. */
  useEffect(() => {
    if (!streamActive) return;
    const el = globeBoxRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest('[data-atlas-hud]')) return; // card scrolls itself
      e.preventDefault();
      if (Math.abs(e.deltaY) < STREAM_WHEEL_THRESHOLD) return;
      lastInputWasTouchRef.current = false;
      advanceStreamRef.current(e.deltaY > 0 ? 1 : -1);
    };

    let touchStartY: number | null = null;
    let touchInCard = false;
    const onTouchStart = (e: TouchEvent) => {
      const t = e.target as HTMLElement | null;
      touchInCard = !!(t && t.closest('[data-atlas-hud]'));
      touchStartY = e.touches[0]?.clientY ?? null;
    };
    const onTouchEnd = (e: TouchEvent) => {
      const startY = touchStartY;
      touchStartY = null;
      if (touchInCard || startY == null) return;
      const endY = e.changedTouches[0]?.clientY ?? startY;
      const dy = endY - startY;
      if (Math.abs(dy) < STREAM_SWIPE_THRESHOLD) return;
      lastInputWasTouchRef.current = true;
      advanceStreamRef.current(dy < 0 ? 1 : -1); // swipe up = next
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [streamActive]);

  /* Arrow keys advance the stream: right/down onward, left/up back. */
  useEffect(() => {
    if (!streamActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        lastInputWasTouchRef.current = false;
        advanceStreamRef.current(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        lastInputWasTouchRef.current = false;
        advanceStreamRef.current(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [streamActive]);

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
        cardNumber: cardNumberFor(p.pieceId),
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
      coverImage: coverImageFor(match.pieceId),
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

  /* MOVE 3 · the code the selection is known by, and the quiet label line
     carved beneath its dream. City name only (no country), so the line reads
     "placed in Lisbon" rather than an address-level breadcrumb. */
  const selectedCode = useMemo(() => {
    if (!selectedPiece) return null;
    return pieceCode({
      pieceId: selectedPiece.pieceId,
      series: selectedPiece.series,
      category: selectedPiece.category,
      cardNumber: selectedPiece.cardNumber,
    });
  }, [selectedPiece]);

  const selectedCityName = useMemo(() => {
    if (!selectedKey) return undefined;
    const match = seriesFiltered.find((p) => p.key === selectedKey);
    const c = match?.cityId ? CITIES_BY_ID.get(match.cityId) : undefined;
    return c?.city;
  }, [selectedKey, seriesFiltered]);

  /* One city point can hold many lights. The card lists the others resting
     at the selected piece's point, each one tap away. */
  const alsoHere = useMemo(() => {
    if (!selectedKey || selectedKey === BIRTH_KEY) return [];
    const sel = seriesFiltered.find((p) => p.key === selectedKey);
    if (!sel?.cityId) return [];
    return seriesFiltered
      .filter((p) => p.cityId === sel.cityId && p.key !== selectedKey)
      .map((p) => {
        const codeLabel = pieceCode({
          pieceId: p.pieceId,
          series: p.series,
          category: p.category,
          cardNumber: cardNumberFor(p.pieceId),
        });
        const standing =
          typeof p.claimOrdinal === 'number'
            ? `${ordinalLabel(p.claimOrdinal)} light`
            : 'not yet awakened';
        return { key: p.key, code: codeLabel, standing };
      });
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
    // Re-attach once the globe section actually renders: the box only exists
    // after the atlas state is ready (and its host differs by 3D support).
  }, [state.kind, use3D]);

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
        // The shared trigram now sits on the pair itself.
        const thread = pair.sharedTrigram
          ? ` · ${pair.sharedTrigram.replace(/\s*\(.*\)$/, '')} thread`
          : '';
        const km = ` · ${Math.round(pair.distance * EARTH_RADIUS_KM).toLocaleString('en-US')} km`;
        // Kin are named by their code, not their long title; titles live in
        // the book. Kinship is UL-only (threads share a trigram).
        const otherPieceId = otherKey.split(':')[0];
        const codeLabel = pieceCode({
          pieceId: otherPieceId,
          series: 'Universal Language',
          cardNumber: cardNumberFor(otherPieceId),
        });
        return { key: otherKey, title: `${codeLabel}${thread}${km}` };
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
                <p className="mt-1.5 font-serif text-[12px] leading-snug tracking-[0.03em] text-wood-400/80">
                  a light is a piece claimed by its keeper · threads join pieces
                  that share a code
                </p>
                {/* ── TEMPORARY PLACEHOLDER caption ── see data/atlasPlaceholder.ts.
                    Shown only while the placeholder dots stand in for an
                    unseeded mirror; auto-hides once real pieces arrive. Delete
                    this block at launch. */}
                {isPlaceholder && (
                  <p className="mt-1.5 font-serif text-[12px] leading-snug tracking-[0.03em] text-bronze-400/80">
                    Placeholder pieces, shown until the first works find their
                    ground.
                  </p>
                )}
                {!USE_GL_GLOBE && !mandala && !streamActive && (
                  <p className="mt-1 font-serif text-[12px] leading-snug tracking-[0.03em] text-wood-400/60">
                    touch a code on the ring to visit it
                  </p>
                )}
                {streamActive && dreamRoute.length > 0 && (
                  <p className="mt-1 font-serif text-[12px] leading-snug tracking-[0.03em] text-wood-400/80">
                    dream {Math.max(1, dreamRoute.indexOf(selectedKey ?? '') + 1)} of{' '}
                    {dreamRoute.length} ·{' '}
                    {typeof window !== 'undefined' && 'ontouchstart' in window
                      ? 'swipe onward'
                      : 'scroll onward'}
                  </p>
                )}
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
              {dreamRoute.length > 0 && (
                <button
                  type="button"
                  aria-pressed={streamActive}
                  onClick={() => (streamActive ? exitStream() : enterStream())}
                  title="Drift through the dreams, one gesture to the next"
                  className={`font-label text-[10px] uppercase tracking-[0.2em] transition-colors ${
                    streamActive ? 'text-bronze-400' : 'text-wood-400 hover:text-bronze-400/80'
                  }`}
                >
                  drift
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
                onClick={() => {
                  const next = !mandala;
                  setMandala(next);
                  if (next) setStreamActive(false); // mandala view exits the stream
                }}
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
                  threadsShown={kinshipIndex?.pairs.length}
                  threadsTotal={kinshipIndex?.totalPairs}
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

          {/* ── The held piece answers with the instrument card, its dream
                 leading inside the vessel; never text floating on the world. ── */}
          {selectedKey && (
            <div
              /* data-atlas-hud marks the vessel so stream wheel/swipe scrolls
                 the card instead of advancing. While drifting, keying by the
                 selection replays the hud-in entrance on every hop, including
                 same-point hops with no flight, so each dream reads as a
                 deliberate page-turn, not a blink. */
              data-atlas-hud
              key={streamActive ? selectedKey : 'hud'}
              className={`absolute z-30 animate-[hud-in_400ms_ease-out]
                     inset-x-0 bottom-0 top-auto max-h-[76svh]
                     sm:inset-x-auto sm:right-8 sm:bottom-auto sm:left-auto sm:w-[380px]
                     sm:top-[var(--hud-top)]`}
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
                  code={selectedCode}
                  alsoHere={alsoHere}
                />
              ) : null}
            </div>
          )}
        </section>
      )}

      {/* ── Fallback globe (no WebGL): the simpler cobe globe, the SVG kinship
             overlay, filters, and the side panel, in light chrome. ──────────── */}
      {state.kind === 'ready' && !use3D && (
        <section
          aria-label="Atlas globe"
          className="px-6 pt-10 max-w-7xl mx-auto"
        >
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-2 font-label text-[10px] uppercase tracking-[0.2em] text-wood-600 mb-3"
          >
            <Link to="/" className="hover:text-bronze-700 transition-colors">
              Home
            </Link>
            <span aria-hidden>/</span>
            <span className="text-wood-900">Atlas</span>
          </nav>
          <h1
            className="text-3xl sm:text-5xl text-wood-900 font-medium leading-none"
            style={{ fontFamily: 'Cinzel, serif', letterSpacing: '0.05em' }}
          >
            Atlas
          </h1>

          <div className="flex flex-col lg:flex-row gap-10 mt-8">
            <div className="flex-1 min-w-0">
              <div ref={globeBoxRef} className="relative w-full aspect-square">
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
            </div>

            <div className="w-full lg:w-[360px] shrink-0">
              <AtlasFilters
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
                threadsShown={kinshipIndex?.pairs.length}
                threadsTotal={kinshipIndex?.totalPairs}
              />
              <div className="mt-8">
                <PieceSidePanel
                  piece={selectedPiece}
                  kin={kinForSelected}
                  onSelectKin={(key) => setSelectedKey(key)}
                  holderChart={holderChart}
                />
              </div>
            </div>
          </div>
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

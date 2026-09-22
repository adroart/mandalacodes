import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Globe, { type GlobeNode } from './atlas/Globe';
import AtlasFilters, { type AtlasStatusFilter } from './atlas/AtlasFilters';
import PieceSidePanel, {
  ordinalLabel,
  type KinEntry,
  type SelectedPiece,
} from './atlas/PieceSidePanel';
import { type CodeIndexEntry } from './atlas/CodesIndex';
import TheLedger, { type LedgerKindSection } from './atlas/TheLedger';
import TheWall, { type WallCard } from './atlas/TheWall';
import { atlasPieceToRow, type LedgerRow } from './atlas/ledgerRow';
import {
  buildCodeEntries,
  buildKindSections,
  cardNumberFor,
  enrichPieces,
  categoryFor,
  cityLabelFor,
  coverImageFor,
  makeKey,
  signatureFor,
  sigilNumberFor,
  type EnrichedPiece,
} from '../lib/atlas/record';
import type { PublicCatalogEntry } from '../utils/catalog';
import KinshipLayer from './atlas/KinshipLayer';
import { useIdleFade } from './atlas/useIdleFade';
import { seriesColor } from './atlas/seriesColor';
import PieceHUD from './atlas/PieceHUD';
import CityListHUD, { type CityMember } from './atlas/CityListHUD';
import PhoneHudSheet from './atlas/PhoneHudSheet';
import { GLOSS_TEXT, useGloss, type GlossTerm } from './atlas/gloss';
import AtlasOverture from './atlas/AtlasOverture';
import FeaturedDream, { type FeaturedDreamData } from './atlas/FeaturedDream';
import SelectionInscription from './atlas/SelectionInscription';
import { pieceCode } from '../utils/pieceCode';
import { img } from '../utils/media';
import { FULL_ARCHIVE } from '../data/mockData';
import { CITIES_BY_ID } from '../data/cities';
import { loadAtlasState } from '../lib/atlas/state';
import { useProfile } from '../lib/profile/context';
import { useCollections } from '../lib/collections/context';
import { buildKinshipIndex, MAX_KINSHIP_ARCS } from '../utils/kinship';
import { buildDreamRoute } from '../utils/dreamStream';
import { SIZE_BANDS, sizeBandFor, type SizeBand } from '../utils/sizeBands';
import type { PublicAtlasState } from '../types';
import { ATLAS_GOLD, ATLAS_KEPT } from './atlas/stageColors';

/* The Three.js globe loads as its own chunk so the page paints immediately;
   browsers without WebGL keep the cobe globe + SVG kinship overlay. */
const Globe3D = lazy(() => import('./atlas/three/Globe3D'));
const GlobeGL = lazy(() => import('./atlas/GlobeGL'));
// The hand-built globe (hexagram ring, kinship arcs, ignition opening,
// mandala view) is the default; ?libglobe falls back to the library-backed
// one for comparison.
const USE_GL_GLOBE =
  typeof window !== 'undefined' && window.location.search.includes('libglobe');

/* The recentering (Adrian, 2026-07-18): cohesion before interconnection. The
   dream-hop drift, the threads toggle, the mandala view and its hexagram ring
   leave the default surface until the core experience — earth, dreams, one
   clear way in — is cohesive. They are parked, not deleted: `?lenses=1` brings
   the whole lens layer back so the machinery stays reachable and compiling.
   The quiet kinship arcs are NOT a lens; they remain always-on as the
   connective tissue. GlobeScene reads the same flag to mount the ring. */
const LENSES_ENABLED =
  typeof window !== 'undefined' && /[?&]lenses=1(?:&|$)/.test(window.location.search);

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

/* Stable empty node list handed to the globe while the overture holds the
   lights in the dark (a fresh [] each render would re-run marker effects). */
const EMPTY_NODES: GlobeNode[] = [];

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

/* The record's assembly — helpers, the code index, the kind sections — lives in
   lib/atlas/record.ts so the registry page reads the same one record from the
   same two public sources. */

/* ─── Component ────────────────────────────────────────────────────────────── */
const AtlasPage: React.FC = () => {
  const [state, setState] = useState<FetchState>({ kind: 'loading' });
  // ?piece=<pieceId[:edition]> deep-links to a selection — card pages use it
  // for their "See it on the Atlas" bridge, and selections stay shareable.
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedKey, setSelectedKeyState] = useState<string | null>(null);
  /* A multi-piece city opened into its list (Phase 2A). Holds a cityId; the
     HUD slot shows the city-list panel while it is set. A single-piece city
     resolves straight to selectedKey and never sets this. */
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
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
  const [selectedKind, setSelectedKindState] = useState<string>(
    () => searchParams.get('kind') ?? 'all',
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
  /* The selected light's live screen position.
     THIS MUST NOT BE REACT STATE. Globe3D projects the light and reports it on
     every animation frame; held in state that re-rendered this whole page at
     60fps, and a page re-rendering every frame starves React Router's
     navigation transitions so they never commit. The symptoms looked like three
     unrelated bugs and were all this one: "open the book" pushed the URL but
     never rendered the piece page (the card just sat there on top of it), Back
     did nothing, and tapping a piece in a city's list changed `?piece=` without
     ever opening it, because the `?piece=` sync effect never got to run either.
     The leader line is drawn by writing SVG attributes straight to these refs,
     so the hairline still tracks the turning globe and React renders nothing. */
  const markerPosRef = useRef<{ x: number; y: number } | null>(null);
  const leaderLineRef = useRef<SVGLineElement | null>(null);
  const leaderDotRef = useRef<SVGCircleElement | null>(null);
  /* The one thing about that position React does need: which hemisphere the
     light is on, so the inscription can be written on the far side. It flips
     rarely, and only a flip is allowed to re-render. */
  const [markerRightHalf, setMarkerRightHalf] = useState(false);
  const navigate = useNavigate();

  /* ─── Selection history (Selection section of the plan) ──────────────────
     The `?piece=` param is the single source of truth for a piece selection.
     Selecting from the resting sky pushes exactly one history entry; selecting
     another light while one is open replaces it; Back (button or gesture) pops
     that one entry and closes the selection. return and Esc do the same. A
     deep-linked selection was never pushed, so closing it steps in place and
     the browser Back then leaves to the referring page, never a broken loop. */
  const selectionOpenRef = useRef(false);
  selectionOpenRef.current = !!selectedKey || !!selectedCity;
  // True while the open selection was pushed by us (so closing it can pop the
  // entry); false for a deep-linked selection that arrived in the URL.
  const selectionPushedRef = useRef(false);

  const setPieceParam = React.useCallback(
    (key: string | null, push: boolean) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (key) next.set('piece', key.replace(/:0$/, ''));
          else next.delete('piece');
          return next;
        },
        { replace: !push },
      );
    },
    [setSearchParams],
  );

  /* Select a piece: push a history entry only when opening from the resting
     sky, otherwise replace the open one. */
  const selectPiece = React.useCallback(
    (key: string) => {
      const push = !selectionOpenRef.current;
      if (push) selectionPushedRef.current = true;
      setPieceParam(key, push);
    },
    [setPieceParam],
  );

  /* Silent clear (a filter dropped the selection): no history navigation. */
  const clearPieceSilently = React.useCallback(() => {
    selectionPushedRef.current = false;
    setPieceParam(null, false);
  }, [setPieceParam]);

  /* Return the visitor to the resting sky: pop our pushed entry when we made
     one, else step in place so a deep link's Back reaches the referrer. */
  const closeSelection = React.useCallback(() => {
    // Close the selection HERE, not only by clearing the URL and waiting for
    // the `?piece=` sync effect to notice. That round trip did not always come
    // back: the param cleared, the card stayed on screen, and on a phone (where
    // this was the ONLY way out) the reader was stuck inside the piece with no
    // exit. The URL is still the source of truth for deep links and for Back;
    // this just makes the close itself immediate and unconditional.
    setSelectedKeyState(null);
    setSelectedCity(null);
    if (selectionPushedRef.current) {
      selectionPushedRef.current = false;
      navigate(-1);
    } else {
      setPieceParam(null, false);
    }
  }, [navigate, setPieceParam]);

  /* Drop the open card without touching the URL or history. Used when a link
     inside the card is navigating away on its own: the route change is already
     in flight, so all that is left to do is stop drawing over it. */
  const dismissForNavigation = React.useCallback(() => {
    setSelectedKeyState(null);
    setSelectedCity(null);
  }, []);

  /* Back to the city list from a piece reached through one: clear the piece
     but keep the open city, no history step. */
  const backToCity = React.useCallback(() => {
    setPieceParam(null, false);
  }, [setPieceParam]);

  // Phone selection sheet: matchMedia so the half-sheet vs. side-panel choice
  // tracks orientation changes without a reload.
  const [isPhone, setIsPhone] = useState<boolean>(
    () => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 767px)').matches,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 767px)');
    const on = () => setIsPhone(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  // Reduced motion: the overture never animates, the featured dream swaps
  // plainly. Tracked live so toggling the OS setting takes effect.
  const [reduced, setReduced] = useState<boolean>(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  /* The overture (build-order item 3): a cold visitor with lights sees the
     vision speak once, then the earth emerges and the founding lights ignite.
     Returning visitors (localStorage flag) and empty skies skip straight to the
     resting sky. `overtureRevealed` gates the marker layer so the lights hold
     in the dark until the words dissolve; `playIntro` runs the staggered
     ignition only on a natural cold-visit reveal (a skip lands at rest). */
  const [overture, setOverture] = useState<'pending' | 'running' | 'done'>('pending');
  const [overtureMode, setOvertureMode] = useState<'full' | 'breath'>('full');
  const [overtureRevealed, setOvertureRevealed] = useState(false);
  const [playIntro, setPlayIntro] = useState(false);

  /* Desktop selection writes as an inscription first; `open the book` reveals
     the full PieceHUD card. Reset to the inscription whenever the piece
     changes. Phone keeps its Phase 2 half-sheet, unaffected. */
  const [bookOpen, setBookOpen] = useState(false);

  /* Featured dream (one voice at a time): the resting sky shows a single dream,
     cross-fading through the deterministic dream route roughly every 20s. */
  const [featuredIdx, setFeaturedIdx] = useState(0);
  /* The featured dream's tether is retired (see FeaturedDream), so its screen
     position is no longer tracked at all. It used to be state written on every
     animation frame, which re-rendered this page 60 times a second while the
     atlas simply sat at rest — see markerPosRef above for what that costs. */
  const featuredScreenPos = null;

  // Once-per-visitor glosses for the dreams and threads controls (law 5).
  const { active: controlGloss, fire: fireGloss } = useGloss();

  // Corner chrome fades when the visitor stops interacting, leaving only the
  // turning world. A selected piece or open filters keep the chrome awake.
  const idle = useIdleFade(4000) && !selectedKey && !selectedCity && !filtersOpen;

  /* Dream Stream: the feed-like drift across the dream-bearing lights. When
     active, one gesture flies to the next light and opens its vessel. */
  const [streamActive, setStreamActive] = useState<boolean>(false);

  // Esc returns to the resting sky (same as the Back gesture and return), and
  // exits the stream.
  useEffect(() => {
    if (!selectedKey && !selectedCity && !streamActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setStreamActive(false);
        if (selectedKey || selectedCity) closeSelection();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedKey, selectedCity, streamActive, closeSelection]);
  const [use3D] = useState<boolean>(webglAvailable);

  /* Per-frame from Globe3D. Everything here is either a ref write or a DOM
     write; the only setState is guarded to fire on a hemisphere flip. */
  const handleMarkerScreenPos = React.useCallback((pos: { x: number; y: number }) => {
    markerPosRef.current = pos;
    const box = globeBoxRef.current;
    if (box) {
      const right = pos.x > box.clientWidth / 2;
      setMarkerRightHalf((prev) => (prev === right ? prev : right));
    }
    const line = leaderLineRef.current;
    if (line) {
      line.setAttribute('x1', String(pos.x));
      line.setAttribute('y1', String(pos.y));
      // y2 tracks the light vertically, clamped so the line stays in the frame.
      const clampTo = line.dataset.clamp;
      if (clampTo) {
        const h = Number(clampTo);
        line.setAttribute('y2', String(Math.min(Math.max(pos.y, 120), h - 160)));
      }
    }
    const dot = leaderDotRef.current;
    if (dot) {
      dot.setAttribute('cx', String(pos.x));
      dot.setAttribute('cy', String(pos.y));
    }
  }, []);

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
  const setSelectedKind = (v: string) => {
    setSelectedKindState(v);
    setFilterParam('kind', v);
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

  /* Saved-card personalization remains local to the account collection.
     Ownership highlighting is disabled until Adrian-Website exposes a
     canonical holder reader. */
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


  /* Globe container size — KinshipLayer needs CSS pixels to render the SVG
     overlay at the same dimensions cobe is drawing into. */
  const globeBoxRef = useRef<HTMLDivElement | null>(null);
  const [globeSize, setGlobeSize] = useState({ width: 0, height: 0 });
  /* The full stage box (not the square globe overlay): the featured dream reads
     it to place itself off the globe's projected limb. */
  const [stageDims, setStageDims] = useState({ width: 0, height: 0 });

  /* Fetch the canonical public Atlas. Failure is an explicit unavailable
     state because Mandala has no canonical snapshot to display. */
  const [retrying, setRetrying] = useState(false);
  useEffect(() => {
    let active = true;
    loadAtlasState()
      .then((data) => {
        if (active) setState({ kind: 'ready', data });
      })
      .catch(() => {
        if (active) setState({ kind: 'error' });
      });
    return () => {
      active = false;
    };
  }, []);

  // The retired catalogue is not a public inventory source. Actual lights
  // come from the canonical Atlas projection above.
  const catalog: PublicCatalogEntry[] = [];

  const retryAtlasFetch = () => {
    if (retrying) return;
    setRetrying(true);
    setState({ kind: 'loading' });
    loadAtlasState(true)
      .then((data) => {
        setState({ kind: 'ready', data });
      })
      .catch(() => setState({ kind: 'error' }))
      .finally(() => setRetrying(false));
  };

  /* Enrich pieces with titles, build the series list for the filter. */
  const enriched: EnrichedPiece[] = useMemo(() => {
    if (state.kind !== 'ready') return [];
    // Every row here comes from the canonical record. Nothing is stood in
    // for an absent piece, so a row on this page is always a real piece.
    return enrichPieces(state.data);
  }, [state]);

  const availableSeries: string[] = useMemo(() => {
    const set = new Set<string>();
    for (const p of enriched) {
      if (p.series) set.add(p.series);
    }
    return Array.from(set).sort();
  }, [enriched]);

  /* Keep the piece selection in lockstep with the `?piece=` param, the single
     source of truth. This drives deep links on load, browsing between pieces,
     and the Back gesture: when history pops the pushed selection entry the
     param clears here and the selection closes. Accepts both "UL-122" and
     "UL-122:2" (keys without an edition end in ":0"), plus the birth-place key
     when the visitor has a saved profile. */
  useEffect(() => {
    const param = searchParams.get('piece');
    if (!param) {
      // Back reached the resting sky: no pushed selection remains open.
      selectionPushedRef.current = false;
      setSelectedKeyState(null);
      return;
    }
    if (param === BIRTH_KEY) {
      setSelectedKeyState(birthPlace ? BIRTH_KEY : null);
      return;
    }
    if (enriched.length === 0) return; // resolve once the atlas has loaded
    const match = enriched.find((p) => p.key === param || p.key === `${param}:0`);
    setSelectedKeyState(match ? match.key : null);
  }, [searchParams, enriched, birthPlace]);

  /* Category and size-band lookups come from the archive, keyed by pieceId. */
  const categoriesAvailable: string[] = useMemo(() => {
    const set = new Set<string>();
    for (const p of enriched) {
      const c = p.category ?? categoryFor(p.pieceId);
      if (c) set.add(c);
    }
    return Array.from(set).sort();
  }, [enriched]);

  /* Kind facets present in the data (server-derived on each public piece).
     The KIND filter row hides unless more than one kind exists. */
  const kindsAvailable: string[] = useMemo(() => {
    const set = new Set<string>();
    for (const p of enriched) {
      if (p.kind) set.add(p.kind);
    }
    return Array.from(set);
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
      if (selectedKind !== 'all' && p.kind !== selectedKind) return false;
      if (selectedCategory !== 'all') {
        const c = p.category ?? categoryFor(p.pieceId);
        if (c !== selectedCategory) return false;
      }
      if (selectedSize !== 'all' && sizeBandByPiece.get(p.pieceId) !== selectedSize) return false;
      return true;
    });
  }, [enriched, selectedSeries, selectedKind, selectedCategory, selectedSize, sizeBandByPiece]);

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
  /* A record that resolved and holds nothing: no piece has been claimed yet.
     The pulse says exactly that rather than reading out a row of zeroes, and
     nothing is ever stood in for the absent lights. */
  const emptySky = state.kind === 'ready' && totalCount === 0;
  const lightsLit = useMemo(
    () => enriched.filter((p) => typeof p.claimOrdinal === 'number').length,
    [enriched],
  );

  /* Decide the overture once the atlas is ready (Adrian, 2026-07-18: the vision
     speaks every arrival, scaled by familiarity). The WebGL earth is the only
     stage it plays on; the library-backed globe and the no-WebGL fallback land
     straight on the resting sky. A cold visit (no localStorage flag) plays the
     full word-led overture regardless of how many lights exist, even over an
     empty sky; a returning visit plays the two-second breath. Reduced motion
     shows the words statically over the settled sky, then fades them. */
  useEffect(() => {
    if (state.kind !== 'ready' || overture !== 'pending') return;
    if (typeof window === 'undefined') return;
    const supported = use3D && !USE_GL_GLOBE;
    if (!supported) {
      setOverture('done');
      setOvertureRevealed(true);
      setPlayIntro(false);
      return;
    }
    let seen = false;
    try {
      seen = window.localStorage.getItem('atlas-overture-v1') === '1';
    } catch {
      /* private mode: treat as seen so the overture never traps a visitor */
      seen = true;
    }
    if (seen) {
      // Returning visit: the thesis line settles over the emerging globe, held
      // ~2s, then the resting sky. The lights are already present.
      setOvertureMode('breath');
      setOvertureRevealed(true);
      setPlayIntro(false);
      setOverture('running');
      return;
    }
    try {
      window.localStorage.setItem('atlas-overture-v1', '1');
    } catch {
      /* ignore */
    }
    setOvertureMode('full');
    setOverture('running');
    if (reduced) {
      // Static block above the settled sky: the lights are already present.
      setOvertureRevealed(true);
      setPlayIntro(false);
    } else {
      // The lights hold in the dark until the words dissolve, then ignite.
      setOvertureRevealed(false);
      setPlayIntro(true);
    }
  }, [state.kind, overture, use3D, reduced]);

  /* The vision, on demand: a quiet standing `the vision` link (below) replays
     the full word-led overture. It clears nothing in storage; it just plays. */
  const replayVision = React.useCallback(() => {
    if (!use3D || USE_GL_GLOBE) return;
    setBookOpen(false);
    setOvertureMode('full');
    if (reduced) {
      setOvertureRevealed(true);
      setPlayIntro(false);
    } else {
      setOvertureRevealed(false);
      setPlayIntro(true);
    }
    setOverture('running');
  }, [use3D, reduced]);

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
        cityId: p.cityId,
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
        // "Your codes" lights pieces whose gate sits in your profile or whose
        // card the visitor saved to a collection.
        yours: num != null && (yourGates.has(num) || savedCards.has(num)),
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
  }, [seriesFiltered, status, birthPlace, yourGates, savedCards, sizeBandByPiece]);

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
    selectPiece(route[nextIdx]);
  };

  const enterStream = () => {
    if (dreamRoute.length === 0) return;
    fireGloss('dreams'); // once-per-visitor gloss for the renamed drift control
    setMandala(false); // leaving mandala view if it was engaged
    setStreamActive(true);
    if (!selectedKey || !dreamRoute.includes(selectedKey)) {
      selectPiece(dreamRoute[0]);
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

  /* City clusters (Phase 2A): the rendered marker layer. Group the per-piece
     globe nodes by city into one marker apiece — the globe draws these, while
     `globeNodes` stays the per-piece truth for selection, kinship, the HUD and
     the yours-lens. A single-piece city keeps the piece's own key as its id so
     it behaves pixel-identically to before; a multi-piece city gets a
     synthetic `city:<id>` id and count > 1 (which lights the numeral and opens
     the list). The birth-place origin is its own point and never clusters. */
  const cityClusters: GlobeNode[] = useMemo(() => {
    const byCity = new Map<string, GlobeNode[]>();
    const out: GlobeNode[] = [];
    for (const n of globeNodes) {
      // The visitor's birth place is not a piece; it never merges into a city.
      if (n.status === 'origin' || !n.cityId) {
        out.push({ ...n, count: 1, memberKeys: [n.id] });
        continue;
      }
      const arr = byCity.get(n.cityId);
      if (arr) arr.push(n);
      else byCity.set(n.cityId, [n]);
    }
    for (const [cityId, members] of byCity) {
      if (members.length === 1) {
        // Pixel-identical to today: the piece's own node, its own key.
        const m = members[0];
        out.push({ ...m, count: 1, memberKeys: [m.id] });
        continue;
      }
      const first = members[0];
      // A mixed placed/unawakened city reads as a lit bronze light if ANY
      // member is placed (Adrian's answer 4).
      const anyPlaced = members.some((m) => m.status === 'placed');
      const seriesList = Array.from(
        new Set(members.map((m) => m.series).filter((s): s is string => !!s)),
      );
      const ordinals = members
        .map((m) => m.ordinal)
        .filter((o): o is number => typeof o === 'number');
      out.push({
        id: `city:${cityId}`,
        lat: first.lat,
        lng: first.lng,
        cityId,
        status: anyPlaced ? 'placed' : 'unawakened',
        label: cityLabelFor(cityId),
        pieceType: first.pieceType,
        series: first.series,
        seriesList,
        // Ignition order: the city ignites with its earliest-claimed member.
        ordinal: ordinals.length > 0 ? Math.min(...ordinals) : undefined,
        // The lens answers at the cluster level when any member is yours.
        yours: members.some((m) => m.yours === true),
        count: members.length,
        memberKeys: members.map((m) => m.id),
      });
    }
    return out;
  }, [globeNodes]);

  /* Which cluster each piece key belongs to (piece key → cluster id). A single
     piece maps to itself; a member of a multi-piece city maps to `city:<id>`. */
  const clusterByMember = useMemo(() => {
    const map = new Map<string, string>();
    for (const cl of cityClusters) {
      for (const k of cl.memberKeys ?? []) map.set(k, cl.id);
    }
    return map;
  }, [cityClusters]);

  /* The cluster the globe should tween to and highlight: the selected piece's
     city, or the opened city list. The piece key still drives kinship. */
  const activeClusterId = useMemo(() => {
    if (selectedKey) return clusterByMember.get(selectedKey) ?? selectedKey;
    if (selectedCity) return `city:${selectedCity}`;
    return null;
  }, [selectedKey, selectedCity, clusterByMember]);

  /* ─── Featured dream (one voice at a time) ───────────────────────────────
     A per-key lookup of the composed dream for the resting featured slot: the
     complete public dream, and a Karla sub-line naming the piece by its code,
     its city, and its founding-light ordinal. Built off the dream route so the
     order matches the deterministic route the `dreams` reel travels. */
  const featuredByKey = useMemo(() => {
    const map = new Map<string, FeaturedDreamData>();
    for (const p of seriesFiltered) {
      const text = (p as EnrichedPiece & { intention?: string }).intention;
      if (p.status !== 'placed' || !text || !text.trim()) continue;
      const code = pieceCode({
        pieceId: p.pieceId,
        series: p.series,
        category: p.category ?? categoryFor(p.pieceId),
        cardNumber: cardNumberFor(p.pieceId),
        isSignaturePiece: signatureFor(p.pieceId),
        sigilNumber: sigilNumberFor(p.pieceId),
      });
      const cityName = p.cityId ? CITIES_BY_ID.get(p.cityId)?.city : undefined;
      // The place leads, the catalogue follows. `UL № 1` opening the line put an
      // unexplained initialism in the position of maximum attention, directly
      // under the most intimate sentence on the page, and buried the one human
      // fact ("alive in Denpasar") between two inventory numbers. Ordering it
      // place, ordinal, code lets the sub-line read as a sentence that trails
      // off into a reference, which is what it is.
      const parts: string[] = [];
      if (cityName) parts.push(`alive in ${cityName}`);
      if (typeof p.claimOrdinal === 'number') {
        parts.push(`the ${ordinalLabel(p.claimOrdinal)} light`);
      }
      parts.push(code);
      map.set(p.key, { key: p.key, text: text.trim(), standing: parts.join(' · ') });
    }
    return map;
  }, [seriesFiltered]);

  /* The featured dream pauses while a selection is open, the filters are open,
     or the dream reel is running (interacting), and resumes at rest. It never
     shows during the overture. */
  const featuredPaused =
    !!selectedKey ||
    !!selectedCity ||
    filtersOpen ||
    streamActive ||
    mandala ||
    overture !== 'done';

  const featuredKey =
    dreamRoute.length > 0 ? dreamRoute[featuredIdx % dreamRoute.length] : null;
  const featuredDream = featuredKey ? featuredByKey.get(featuredKey) ?? null : null;
  const featuredClusterId = featuredKey ? clusterByMember.get(featuredKey) ?? featuredKey : null;

  /* Cross-fade to the next dream roughly every 20s while at rest. */
  useEffect(() => {
    if (featuredPaused || dreamRoute.length <= 1) return;
    const id = window.setInterval(() => setFeaturedIdx((i) => i + 1), 20_000);
    return () => window.clearInterval(id);
  }, [featuredPaused, dreamRoute.length]);

  /* A new selection re-opens as the inscription, never the last card. */
  useEffect(() => {
    setBookOpen(false);
  }, [selectedKey, selectedCity]);

  /* Whether the currently selected piece was reached through a multi-piece
     city (so its HUD offers a back-to-the-list control). */
  const selectedFromCity =
    selectedCity != null &&
    selectedKey != null &&
    clusterByMember.get(selectedKey) === `city:${selectedCity}`;

  /* A cluster was tapped: count 1 resolves straight to the piece (today's
     behavior); count > 1 opens the city list in the HUD slot. */
  const handleClusterSelect = (id: string) => {
    if (id === BIRTH_KEY) {
      setSelectedCity(null);
      selectPiece(BIRTH_KEY);
      return;
    }
    const cl = cityClusters.find((c) => c.id === id);
    if (!cl) {
      selectPiece(id);
      return;
    }
    if ((cl.count ?? 1) <= 1) {
      setSelectedCity(null);
      selectPiece(cl.memberKeys?.[0] ?? id);
    } else {
      setPieceParam(null, false); // clears ?piece; the city list opens instead
      setSelectedCity(cl.cityId ?? null);
    }
  };

  /* The open city's label and member rows for the city-list HUD. */
  const selectedCityData = useMemo(() => {
    if (!selectedCity) return null;
    const members: CityMember[] = seriesFiltered
      .filter(
        (p) =>
          p.cityId === selectedCity &&
          (p.status === 'placed' || p.status === 'unawakened'),
      )
      .sort(
        (a, b) =>
          (a.claimOrdinal ?? Number.POSITIVE_INFINITY) -
            (b.claimOrdinal ?? Number.POSITIVE_INFINITY) ||
          a.title.localeCompare(b.title),
      )
      .map((p) => ({
        key: p.key,
        title: p.title,
        series: p.series,
        status: p.status,
        claimOrdinal: p.claimOrdinal,
      }));
    if (members.length === 0) return null;
    return { cityLabel: cityLabelFor(selectedCity) ?? selectedCity, members };
  }, [selectedCity, seriesFiltered]);

  /* If the open city empties out (filters changed), close the list. */
  useEffect(() => {
    if (selectedCity && !selectedCityData) setSelectedCity(null);
  }, [selectedCity, selectedCityData]);

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
    if (match) selectPiece(match.key);
    else navigate(`/universal-language/${n}`);
  };

  /* The flat all-64 index reads the FULL atlas state, never the page's active
     filters: it is a fixed catalogue of the whole language, so its counts stay
     honest regardless of what the globe above is currently showing. Only UL
     pieces (those carrying a code number) belong here. */
  const codeEntries: CodeIndexEntry[] = useMemo(
    () => buildCodeEntries(enriched),
    [enriched],
  );

  /* OTHER KINDS sections (Part II.6, ruling 2): mandalas, signature pieces,
     jewelry, and any data-driven extras, merged from the public atlas state and
     the public catalog. The registry page assembles the same two sections from
     the same builders (lib/atlas/record.ts). */
  const kindSections: LedgerKindSection[] = useMemo(
    () => buildKindSections(enriched, catalog),
    [enriched, catalog],
  );

  /* The wall's cards: the same one record (the sixty-four + the kind
     sections), each row joined to its catalog plate — cover image, year,
     dimensions, material — so the art face is honest with what the record
     truly carries. Placeholder ghost rows never hang on the wall. */
  const wallCards: WallCard[] = useMemo(() => {
    const byId = new Map(FULL_ARCHIVE.map((a) => [a.id, a]));
    const dress = (row: LedgerRow, kind: string, cardNumber?: number): WallCard => {
      const art = byId.get(row.pieceId);
      return {
        ...row,
        kind,
        cardNumber,
        // coverImage on record is a media object ID; the wall needs
        // delivery URLs (tile-sized, and larger for the opened record).
        coverImage: art?.coverImage ? img(art.coverImage, { w: 640 }) : undefined,
        coverImageLarge: art?.coverImage
          ? img(art.coverImage, { w: 1400 })
          : undefined,
        year: art?.year,
        dimensions: art?.dimensions,
        material: art?.material,
      };
    };
    const out: WallCard[] = [];
    const seen = new Set<string>();
    for (const e of codeEntries) {
      const row = atlasPieceToRow(e);
      if (seen.has(row.key)) continue;
      seen.add(row.key);
      out.push(dress(row, 'sixty-four', e.cardNumber));
    }
    for (const s of kindSections) {
      for (const row of s.rows) {
        if (seen.has(row.key)) continue;
        seen.add(row.key);
        out.push(dress(row, s.kind));
      }
    }
    return out;
  }, [codeEntries, kindSections]);

  /* Which reading of the record is open below the globe: the wall (the
     exploratory card field, default) or the ledger (the full written record).
     A shared ?code=N deep link belongs to the ledger's index, so it wins. */
  const ledgerView = searchParams.get('view') === 'ledger' || !!searchParams.get('code');
  const setLedgerView = (toLedger: boolean) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (toLedger) {
          next.set('view', 'ledger');
          // Opening the ledger starts from the whole record: kind and state
          // reset to all, so the full written list is what greets you.
          next.delete('lk');
          next.delete('ls');
        } else {
          next.delete('view');
          next.delete('code');
        }
        return next;
      },
      { replace: true },
    );
  };

  /* Selecting a piece from the index re-selects it on the globe above and
     brings the globe back into view (the index lives below the fold). */
  const selectPieceOnGlobe = (pieceId: string, editionNumber?: number) => {
    selectPiece(makeKey(pieceId, editionNumber));
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

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

  /* The keeper's optional signature ("sign your dream"), present in public
     state only alongside a live public dream — so it rides the inscription and
     the card exactly where the dream does, and nowhere else. */
  const selectedSignedBy = useMemo(() => {
    if (!selectedKey) return null;
    const match = seriesFiltered.find((p) => p.key === selectedKey);
    return match?.signedBy ?? null;
  }, [selectedKey, seriesFiltered]);

  /* MOVE 3 · the code the selection is known by, and the quiet label line
     carved beneath its dream. City name only (no country), so the line reads
     "alive in Lisbon" rather than an address-level breadcrumb. */
  const selectedCode = useMemo(() => {
    if (!selectedPiece) return null;
    return pieceCode({
      pieceId: selectedPiece.pieceId,
      series: selectedPiece.series,
      category: selectedPiece.category,
      cardNumber: selectedPiece.cardNumber,
      isSignaturePiece: signatureFor(selectedPiece.pieceId),
      sigilNumber: sigilNumberFor(selectedPiece.pieceId),
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
          isSignaturePiece: signatureFor(p.pieceId),
          sigilNumber: sigilNumberFor(p.pieceId),
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
    if (!stillVisible) clearPieceSilently();
  }, [selectedKey, seriesFiltered, clearPieceSilently]);

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
        setStageDims({ width: cr.width, height: cr.height });
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

  // Chrome tiers with opacity floors (law 3). Orientation chrome (the thesis
  // caption and the primary controls) never rests below 0.6; secondary chrome
  // (the breadcrumb and the Atlas wordmark) never below 0.35. Any pointer,
  // touch, key, or focus wakes them to full via useIdleFade. Reduced motion
  // never idles (the hook holds idle=false), so both stay at 1.
  /* The idle fade: the chrome recedes while the world turns.
     The floors are 0.8 / 0.55, not 0.6 / 0.35. The old floors multiplied a
     whole block of already-alpha'd text, and the two together took the count
     line to 2.4:1 and the stale-sky line to 3.2:1 against the stage night, well
     under the 4.5:1 an AA reading needs: at rest, the page's own information
     was not legible. Everything in the band is now full-alpha and ranked by
     size, case and hue instead, which leaves this fade as the only opacity in
     play; at 0.8 every line still clears 4.8:1 and the recede is still read.
     Verified against --color-atlas-night; keep it that way if you retune. */
  const orientationOpacity = idle ? 0.8 : 1;
  const secondaryOpacity = idle ? 0.68 : 1;
  const chromeTierTransition = 'opacity 700ms ease';

  /* The globe's projected screen circle in stage coordinates, so the featured
     dream can seat itself off the limb (law 2). The camera looks at the origin,
     so the sphere centres on the stage; at the resting landscape distance it
     fills ~0.455 of the stage height (measured against the built earth). Phones
     run in portrait where the camera pulls back, so the featured dream falls
     back to its bottom-anchored, scrim-backed slot instead of this circle. */
  const globeCircle = React.useMemo(
    () =>
      !isPhone && stageDims.width > 0 && stageDims.height > 0
        ? {
            cx: stageDims.width / 2,
            cy: stageDims.height / 2,
            r: stageDims.height * 0.455,
          }
        : null,
    [isPhone, stageDims.width, stageDims.height],
  );

  // Keep the last-shown control gloss term so its line can fade out (rather
  // than blank instantly) when useGloss clears the active term after ~6s.
  const lastControlGlossRef = useRef<GlossTerm | null>(null);
  if (controlGloss) lastControlGlossRef.current = controlGloss;

  /* Desktop selection reads as an inscription first (build-order item 3), then
     the full card behind `open the book`. Phone keeps its half-sheet; the
     birth-place and city selections keep their existing panels. */
  const showInscription =
    !isPhone &&
    !bookOpen &&
    !!selectedKey &&
    selectedKey !== BIRTH_KEY &&
    !!selectedPiece;
  /* The phone selection half-sheet is up (a real piece or city, not the
     birth-place one-liner). While it is, the sheet header carries `return`, so
     the bottom control cluster hides its copy and rests quieter (law 6). */
  const phoneSheetOpen =
    isPhone && ((selectedKey != null && selectedKey !== BIRTH_KEY) || selectedCity != null);
  /* Write the inscription on the side away from the light: when the light sits
     on the right hemisphere, write on the left. */
  const inscriptionAwayLeft = markerRightHalf;
  /* The featured dream shows only at rest on the WebGL earth. */
  const showFeatured =
    use3D && !USE_GL_GLOBE && !featuredPaused && featuredDream != null;

  return (
    /* The globe remains an intentional dusk room in both themes. The written
       record below it belongs to the site's paper system, so Daybook receives
       a warm ledger while Nightfall receives the same dark paper as the rest
       of the site. */
    <div data-atlas-page className="min-h-screen bg-paper-50 text-wood-900">
      {/* ── Immersive globe stage ─────────────────────────────────────────── */}
      {state.kind === 'ready' && use3D && (
        <section
          data-atlas-stage
          ref={globeBoxRef}
          aria-label="Atlas globe"
          className="dark relative w-full overflow-hidden bg-atlas-night text-wood-900 block"
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
                      'radial-gradient(circle at 50% 50%, rgb(28, 25, 21) 0%, var(--color-atlas-night) 62%)',
                  }}
                />
              }
            >
              {USE_GL_GLOBE ? (
                <GlobeGL
                  nodes={globeNodes}
                  selectedId={selectedKey}
                  onSelect={(id) => selectPiece(id)}
                  kinship={kinshipIndex}
                  kinshipVisible={kinshipVisible}
                  placedByCard={placedByCard}
                  mandala={mandala}
                  mandalaCaption={`The mandala so far · ${placedByCard.size} of 64 placed`}
                  onMarkerScreenPos={handleMarkerScreenPos}
                  onBackgroundClick={closeSelection}
                  className="w-full h-full"
                />
              ) : (
                <Globe3D
                  // The overture holds the lights in the dark until the words
                  // dissolve: the earth renders, the markers arrive at reveal.
                  nodes={overtureRevealed ? cityClusters : EMPTY_NODES}
                  selectedId={activeClusterId}
                  kinSelectedId={selectedKey}
                  onSelect={handleClusterSelect}
                  kinship={kinshipIndex}
                  kinshipVisible={kinshipVisible}
                  placedByCard={placedByCard}
                  mandala={mandala}
                  // One voice in the caption slot (law): with the mandala view
                  // parked, the idle camera pull-back must not speak its own
                  // caption over the resting thesis, and the unmounted ring must
                  // carry no phantom tap targets. Both return with ?lenses=1.
                  mandalaCaption={
                    LENSES_ENABLED
                      ? `The mandala so far · ${placedByCard.size} of 64 placed · touch a code to visit it`
                      : ''
                  }
                  onMarkerScreenPos={handleMarkerScreenPos}
                  featuredId={showFeatured ? featuredClusterId : null}
                  /* The featured tether is retired (see FeaturedDream), so
                     nothing consumes this. Not passing it also stops a second
                     per-frame projection loop from running at rest, which was
                     re-rendering this page 60 times a second for a line that is
                     never drawn. */
                  onFeaturedScreenPos={undefined}
                  playIntro={playIntro}
                  onBackgroundClick={closeSelection}
                  // Inscription keeps the world centred (no side card yet); the
                  // full card slides it aside as Phase 2 built.
                  clearForHud={!showInscription}
                  focusSeries={focusSeries}
                  yoursMode={yoursMode}
                  onRingTap={LENSES_ENABLED ? handleRingTap : undefined}
                  className="w-full h-full"
                />
              )}
            </Suspense>
          </div>

          {/* ── The featured dream: one voice at a time, at rest ──────────────
                 Desktop only here: it seats itself in the dark margin beside
                 the globe. On phones there is no margin to seat it in, so it
                 joins the lower band below and is rendered inside that stack
                 instead of floating over the earth. ─────────────────────────── */}
          {showFeatured && !isPhone && (
            <FeaturedDream
              dream={featuredDream}
              screenPos={featuredScreenPos}
              globe={globeCircle}
              isPhone={isPhone}
              reduced={reduced}
              opacity={orientationOpacity}
              onSelect={(key) => selectPiece(key)}
            />
          )}

          {/* ── The overture: the vision speaks and holds; the earth emerges
                 behind it; one tap releases the words (the living ledger,
                 ruling 1). onReveal fires at mount, so the world stands ready
                 the moment the words fade. ───────────────────────────────── */}
          {overture === 'running' && (
            <AtlasOverture
              reduced={reduced}
              mode={overtureMode}
              onReveal={() => setOvertureRevealed(true)}
              onDone={() => setOverture('done')}
            />
          )}

          {/* ── Corner chrome: two tiers, each with an opacity floor (law 3).
                 While the overture holds (the living ledger, ruling 1) the
                 whole cluster rests hidden, so the reader-paced entry shows one
                 thing at a time; it settles in once the words are released. ─── */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              opacity: overture === 'done' ? 1 : 0,
              transition: 'opacity 800ms ease',
            }}
          >
            {/* Top-left: breadcrumb + wordmark — secondary chrome (floor 0.55).
                On phones the nav bar carries identity; the breadcrumb and
                wordmark do not render over the globe (Adrian, 2026-07-18), so
                the small screen keeps the whole earth.
                The breadcrumb carries no alpha of its own: at /60 under the
                old 0.35 floor these links composited to 2.1:1, a navigation
                control you could not read. The tier fade alone is the quiet. */}
            {!isPhone && (
            <div
              className="pointer-events-auto absolute left-5 sm:left-8 top-[calc(var(--nav-height)+1rem)]"
              style={{ opacity: secondaryOpacity, transition: chromeTierTransition }}
            >
              <nav
                aria-label="Breadcrumb"
                className="flex items-center gap-2 font-label text-[10px] uppercase tracking-[0.2em] text-bronze-400 mb-3"
              >
                <Link to="/" className="hover:text-bronze-400 transition-colors">
                  Home
                </Link>
                <span aria-hidden>/</span>
                <span className="text-wood-800">Atlas</span>
              </nav>
              <h1
                className="text-2xl sm:text-5xl text-bronze-300 font-medium leading-none"
                style={{ fontFamily: 'var(--font-brand)', letterSpacing: '0.05em' }}
              >
                Atlas
              </h1>
            </div>
            )}

            {/* ── The lower band ────────────────────────────────────────────────
                One rail, two zones, one gradient floor.

                What this replaced: six typographic voices stacked at the same
                size, weight and colour, on two different left rails (the dream
                indented by its own padding, the caption not), as two separately
                bottom-anchored blocks that drifted toward each other as the
                dream's length changed. Nothing was ranked, so the eye had no
                entry point and no second focal point after the globe.

                What it is now. Zone one is intimate: the dream, then its
                attribution. A hairline divides. Zone two orients: the pulse
                (lights lit, the only living number, and the loudest line here),
                the thesis that glosses it, the door, and last the system voice.
                Rank is carried by size, case and hue, never by opacity, because
                opacity is already spent on the idle fade and stacking the two
                is what pushed this text under the legibility floor.

                Watch the wood scale here. The whole /atlas route sits inside a
                local `dark` wrapper (see the route root above), and dark
                INVERTS the ramp: wood-200/300 are near-black, wood-500 upward
                are the light ones. Reaching for wood-300 to mean "quiet" gives
                you 1.8:1 on this stage, and wood-200 gives 1.4:1. Quiet on the
                night is wood-500; wood-700+ is emphasis. Measured against
                --color-atlas-night; `node tests/_atlas-contrast.mjs` re-measures
                the whole band in a real browser and fails if any of it slips.

                One voice in the caption slot (Adrian, 2026-07-18): while the
                mandala speaks, or a birth place is selected, the whole band
                rests.

                The band also stands for an EMPTY record (2026-09-01). A dark
                globe with no word at all reads as broken rather than waiting,
                so the pulse carries the awaiting line instead of a row of
                zeroes. Every other child here gates itself off with no dream
                and no piece, so what remains is that one line, the thesis, and
                the vision. */}
            {!mandala && (totalCount > 0 || emptySky) && selectedKey !== BIRTH_KEY && (
              <div
                className="pointer-events-auto absolute inset-x-0 bottom-0 sm:inset-x-auto sm:left-8 sm:bottom-6 sm:max-w-xl"
                style={{ opacity: orientationOpacity, transition: chromeTierTransition }}
              >
                {/* The floor: on phones the band lies over the lower dark, so
                    it carries its own deepening of the night that reaches the
                    bottom edge and falls to nothing well above the first line.
                    This is what lets the dream sit in flow without a local
                    scrim, and what keeps the earth's lower limb from running
                    through the text the way it used to. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 bottom-0 sm:hidden"
                  style={{
                    top: '-8rem',
                    background:
                      'linear-gradient(to bottom, rgba(9,7,5,0) 0%, rgba(9,7,5,0.5) 26%, rgba(9,7,5,0.86) 52%, rgba(9,7,5,0.97) 78%, rgba(9,7,5,0.99) 100%)',
                  }}
                />

                <div className="relative px-5 pb-16 sm:px-0 sm:pb-0">
                  {/* Zone one, phones only: the dream joins the rail instead of
                      floating over the earth on its own inset. */}
                  {showFeatured && isPhone && (
                    <div className="mb-5">
                      <FeaturedDream
                        dream={featuredDream}
                        screenPos={featuredScreenPos}
                        globe={globeCircle}
                        isPhone={isPhone}
                        reduced={reduced}
                        opacity={1}
                        inFlow
                        onSelect={(key) => selectPiece(key)}
                      />
                    </div>
                  )}

                  {/* The divider: the whole hierarchy of the band hangs off this
                      one hairline. Above it the work speaks; below it the atlas
                      speaks about itself. Short and left-hung so it reads as a
                      breath, not a rule across a card. */}
                  {showFeatured && isPhone && (
                    <div
                      aria-hidden
                      className="mb-4 h-px w-10"
                      style={{ background: 'rgba(196,170,124,0.3)' }}
                    />
                  )}

                  {/* The pulse: the one loud line in the band. Lights lit is the
                      only number here that changes when a life is attached, so
                      it leads and the inventory total trails it as a quiet tail
                      rather than sharing its weight. */}
                  <p className="font-label text-[13px] sm:text-[14px] uppercase tracking-[0.16em] text-atlas-gold">
                    {/* The empty record speaks for itself: no count to read
                        out, and nothing invented to fill the silence. Same
                        awaiting line the wall, ledger and registry carry. */}
                    {emptySky ? (
                      <>
                        no lights yet
                        <span className="ml-2 normal-case tracking-[0.02em] text-[12px] text-wood-500">
                          the sky is waiting for its first light
                        </span>
                      </>
                    ) : (
                      <>
                        {lightsLit} {lightsLit === 1 ? 'light lit' : 'lights lit'}
                        <span className="ml-2 normal-case tracking-[0.02em] text-[12px] text-wood-500">
                          of {totalCount} {totalCount === 1 ? 'piece' : 'pieces'}
                          {!isPhone && ' · touch a light to read its dream'}
                        </span>
                      </>
                    )}
                  </p>

                  {/* The gloss on the pulse. The recentering (Adrian,
                      2026-07-18): the story is the community, not the artist.
                      `the vision` trails it as a small standing link that
                      replays the overture, and rests while a light is open so
                      the line stays calm. */}
                  <p className="mt-1.5 font-display text-[13px] sm:text-[14px] leading-snug text-wood-500">
                    Illuminators of the dream, surrounded by resonant dreamers.
                  </p>
                  {/* `the vision` gets its own row rather than trailing the
                      sentence: inline, it wrapped to a second line on phones and
                      landed there wearing the sentence's left margin, reading as
                      a stranded fragment rather than a control. */}
                  {!selectedKey && !selectedCity && (
                    <button
                      type="button"
                      onClick={replayVision}
                      className="mt-2 font-label text-[10px] uppercase tracking-[0.18em] text-atlas-gold hover:text-bronze-300 transition-colors border-b border-[rgba(196,170,124,0.28)] hover:border-[rgba(196,170,124,0.8)] pb-0.5"
                    >
                      the vision
                    </button>
                  )}

                  {streamActive && dreamRoute.length > 0 && (
                    <p className="mt-1 font-display text-[12px] leading-snug tracking-[0.03em] text-wood-500">
                      dream {Math.max(1, dreamRoute.indexOf(selectedKey ?? '') + 1)} of{' '}
                      {dreamRoute.length} ·{' '}
                      {typeof window !== 'undefined' && 'ontouchstart' in window
                        ? 'swipe onward'
                        : 'scroll onward'}
                    </p>
                  )}

                </div>
              </div>
            )}

            {/* Bottom-right: the control cluster — orientation chrome (floor
                0.8). mandala, the series legend and your codes live inside the
                filter sheet as lenses, so with the lens layer parked this is
                usually a single word. That is the problem it has: one 11px
                letterspaced word alone in a large field of black disappears
                even though its contrast passes. It is answered below by giving
                the control a standing underline (an affordance, not just a
                colour) and by closing the gap to the caption band, so the two
                read as one baseline rather than one word adrift. */}
            <div
              className="pointer-events-auto absolute right-5 sm:right-8 bottom-6 flex flex-col items-end gap-2"
              style={{
                opacity: phoneSheetOpen ? 0.55 : orientationOpacity,
                transition: chromeTierTransition,
              }}
            >
              {/* Once-per-visitor gloss for the control just exercised (law 5). */}
              <p
                aria-hidden={controlGloss === null}
                className="font-display text-[13px] leading-snug text-atlas-gold/85 max-w-[62vw] text-right"
                style={{
                  opacity: controlGloss === null ? 0 : 1,
                  transition: 'opacity 500ms ease',
                }}
              >
                {lastControlGlossRef.current ? GLOSS_TEXT[lastControlGlossRef.current] : ''}
              </p>
              <div className="flex items-center gap-4 sm:gap-6">
                {/* Parked lenses (Adrian, 2026-07-18): the dream-hop drift and
                    the threads toggle return only behind ?lenses=1. Without the
                    flag the cluster is `filter` plus contextual. The kinship
                    arcs themselves stay always-on regardless — they are the
                    connective tissue, not a control. */}
                {LENSES_ENABLED && dreamRoute.length > 0 && (
                  <button
                    type="button"
                    aria-pressed={streamActive}
                    onClick={() => (streamActive ? exitStream() : enterStream())}
                    title="Travel from dream to dream, one gesture at a time"
                    className={`font-label text-[11px] uppercase tracking-[0.2em] transition-colors ${
                      streamActive ? 'text-bronze-400' : 'text-wood-300 hover:text-bronze-400/80'
                    }`}
                  >
                    dreams
                  </button>
                )}
                {LENSES_ENABLED && (
                  <button
                    type="button"
                    aria-pressed={kinshipVisible}
                    onClick={() => {
                      fireGloss('threads');
                      setKinshipVisible((v) => !v);
                    }}
                    title="Threads join pieces that share a code"
                    className={`font-label text-[11px] uppercase tracking-[0.2em] transition-colors ${
                      kinshipVisible
                        ? 'text-bronze-300'
                        : 'text-wood-300 hover:text-bronze-400/80'
                    }`}
                  >
                    threads
                  </button>
                )}
                <button
                  type="button"
                  aria-expanded={filtersOpen}
                  onClick={() => setFiltersOpen((o) => !o)}
                  className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-700 hover:text-atlas-gold transition-colors border-b border-[rgba(221,212,194,0.32)] hover:border-atlas-gold pb-1"
                >
                  filter
                  {(selectedSeries !== 'all' ||
                    selectedKind !== 'all' ||
                    status !== 'all' ||
                    selectedCategory !== 'all' ||
                    selectedSize !== 'all' ||
                    mandala ||
                    focusSeries !== null ||
                    yoursMode) && <span className="text-bronze-400"> · ·</span>}
                </button>
                {(selectedKey || selectedCity) && !phoneSheetOpen && (
                  <button
                    type="button"
                    onClick={closeSelection}
                    className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-300 hover:text-bronze-200 transition-colors"
                  >
                    return
                  </button>
                )}
              </div>
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
                <AtlasFilters
                  variant="stage"
                  series={availableSeries}
                  selectedSeries={selectedSeries}
                  onSeriesChange={setSelectedSeries}
                  kinds={kindsAvailable}
                  selectedKind={selectedKind}
                  onKindChange={setSelectedKind}
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

                {/* Lenses and views live here, not in the daily control gutter:
                    the mandala view, the series legend, and the your-codes
                    lens. Each recedes the rest of the field, never removes it. */}
                <div className="mt-6 pt-5 border-t border-bronze-400/12 flex flex-col gap-4">
                  {/* Mandala: a parked view (Adrian, 2026-07-18), back only
                      behind ?lenses=1 while the core experience settles. */}
                  {LENSES_ENABLED && (
                    <div className="flex items-baseline gap-4">
                      <span className="font-label text-[10px] uppercase tracking-[0.2em] text-wood-500 w-16 shrink-0">
                        View
                      </span>
                      <button
                        type="button"
                        aria-pressed={mandala}
                        onClick={() => {
                          const next = !mandala;
                          setMandala(next);
                          if (next) setStreamActive(false);
                        }}
                        className={`font-display text-[15px] leading-none pb-1 border-b transition-colors duration-200 ${
                          mandala
                            ? 'text-bronze-300 border-bronze-400/70'
                            : 'text-wood-400 border-transparent hover:text-bronze-300/80'
                        }`}
                      >
                        mandala
                      </button>
                    </div>
                  )}

                  {/* Your codes: light the pieces carrying one of your own. */}
                  {yourGates.size > 0 && (
                    <div className="flex items-baseline gap-4">
                      <span className="font-label text-[10px] uppercase tracking-[0.2em] text-wood-500 w-16 shrink-0">
                        Lens
                      </span>
                      <button
                        type="button"
                        aria-pressed={yoursMode}
                        onClick={() => setYoursMode((v) => !v)}
                        className={`font-display text-[15px] leading-none pb-1 border-b transition-colors duration-200 ${
                          yoursMode
                            ? 'text-atlas-kept border-atlas-kept/70'
                            : 'text-wood-400 border-transparent hover:text-bronze-300/80'
                        }`}
                      >
                        your codes
                      </button>
                    </div>
                  )}

                  {/* Series legend: each series is a lens onto its constellation. */}
                  {legendSeries.length > 0 && (
                    <div className="flex items-baseline gap-4">
                      <span className="font-label text-[10px] uppercase tracking-[0.2em] text-wood-500 w-16 shrink-0">
                        Legend
                      </span>
                      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
                        {legendSeries.map((s) => (
                          <button
                            key={s}
                            type="button"
                            aria-pressed={focusSeries === s}
                            onClick={() => setFocusSeries((cur) => (cur === s ? null : s))}
                            className={`font-display text-[15px] leading-none pb-1 border-b transition-colors duration-200 ${
                              focusSeries === s
                                ? 'text-bronze-300 border-bronze-400/70'
                                : 'text-wood-400 border-transparent hover:text-bronze-300/80'
                            }`}
                          >
                            {s}
                            <span aria-hidden style={{ color: seriesColor(s) }}>
                              {' '}·
                            </span>
                          </button>
                        ))}
                        {hasBirthOrigin && (
                          <span className="font-display text-[15px] leading-none pb-1 text-wood-400">
                            your origin
                            <span aria-hidden className="text-atlas-kept">
                              {' '}·
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Birth place is not a piece (Adrian, 2026-07-18): selecting it
                 shows one quiet line, no card, no kin, no book action, no plate,
                 desktop and phone alike. ─────────────────────────────────────── */}
          {selectedKey === BIRTH_KEY && birthPlace && (
            <div
              data-atlas-hud
              className="absolute left-1/2 z-30 -translate-x-1/2 bottom-24 sm:bottom-16 flex max-w-[95vw] items-center gap-3 sm:gap-4 animate-[hud-in_400ms_ease-out]"
            >
              <span className="whitespace-nowrap font-label text-[12px] sm:text-[13px] tracking-[0.02em] text-atlas-kept">
                Your birth place
                <span aria-hidden className="mx-2 text-wood-500">·</span>
                {birthPlace.label}
              </span>
              <button
                type="button"
                onClick={closeSelection}
                className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-400 hover:text-atlas-kept transition-colors"
              >
                dismiss
              </button>
            </div>
          )}

          {/* ── Leader-line: a hairline from the marker to the card, or to the
                 inscription on the side away from the light. The birth-place pin
                 draws no leader — its one line stands on its own. ────────────── */}
          {(selectedKey || selectedCity) && selectedKey !== BIRTH_KEY && globeBoxRef.current && (
            <svg
              className="pointer-events-none absolute inset-0 z-20 hidden sm:block"
              width="100%"
              height="100%"
            >
              {/* x1/y1/cx/cy and, when the card is showing, y2 are written every
                  frame by handleMarkerScreenPos through these refs. They start
                  at the last known position, or off-screen, so the very first
                  paint never flashes a hairline across the corner. */}
              <line
                ref={leaderLineRef}
                data-clamp={showInscription ? undefined : globeBoxRef.current.clientHeight}
                x1={markerPosRef.current?.x ?? -100}
                y1={markerPosRef.current?.y ?? -100}
                x2={
                  showInscription
                    ? inscriptionAwayLeft
                      ? 388
                      : globeBoxRef.current.clientWidth - 388
                    : globeBoxRef.current.clientWidth - 412
                }
                y2={
                  showInscription
                    ? globeBoxRef.current.clientHeight / 2
                    : Math.min(
                        Math.max(markerPosRef.current?.y ?? -100, 120),
                        globeBoxRef.current.clientHeight - 160,
                      )
                }
                stroke={selectedKey === BIRTH_KEY ? 'rgba(156,170,135,0.5)' : 'rgba(196,170,124,0.45)'}
                strokeWidth={1}
              />
              <circle
                ref={leaderDotRef}
                cx={markerPosRef.current?.x ?? -100}
                cy={markerPosRef.current?.y ?? -100}
                r={2.5}
                fill={selectedKey === BIRTH_KEY ? ATLAS_KEPT : ATLAS_GOLD}
              />
            </svg>
          )}

          {/* ── Selection as inscription (desktop): the dream writes itself
                 large across the dark on the side away from the light, with one
                 action, open the book, that reveals the full card below. ────── */}
          {showInscription && selectedPiece && (
            <SelectionInscription
              dream={selectedIntention}
              signedBy={selectedSignedBy}
              // Place, then ordinal, then code — the same order as the featured
              // dream's sub-line and the piece card, so the one human fact
              // leads wherever this line appears.
              standing={[
                selectedCityName ? `alive in ${selectedCityName}` : null,
                typeof selectedPiece.claimOrdinal === 'number'
                  ? `the ${ordinalLabel(selectedPiece.claimOrdinal)} light`
                  : null,
                selectedCode,
              ]
                .filter(Boolean)
                .join(' · ')}
              awayLeft={inscriptionAwayLeft}
              onOpenBook={() => setBookOpen(true)}
            />
          )}

          {/* ── The held piece answers with the instrument card, its dream
                 leading inside the vessel; never text floating on the world.
                 A multi-piece city instead answers with its list. On phones the
                 card rides a bottom half-sheet so the globe stays visible above
                 (law 4); on wider screens it seats beside the world. ────────── */}
          {((selectedKey && selectedKey !== BIRTH_KEY) || selectedCity) &&
            !showInscription &&
            (() => {
              const hudContent =
                selectedKey && selectedPiece ? (
                  <PieceHUD
                    piece={selectedPiece}
                    inSheet={isPhone}
                    kin={kinForSelected}
                    onSelectKin={(key) => selectPiece(key)}
                    onRelease={closeSelection}
                    onBack={selectedFromCity ? backToCity : undefined}
                    carriesYourCode={
                      selectedPiece.cardNumber != null &&
                      yourGates.has(selectedPiece.cardNumber)
                    }
                    intention={selectedIntention}
                    signedBy={selectedSignedBy}
                    code={selectedCode}
                    alsoHere={alsoHere}
                  />
                ) : selectedCityData ? (
                  <CityListHUD
                    cityLabel={selectedCityData.cityLabel}
                    members={selectedCityData.members}
                    inSheet={isPhone}
                    onSelectMember={(key) => selectPiece(key)}
                    onRelease={closeSelection}
                  />
                ) : null;

              if (!hudContent) return null;

              // Phone: a full-screen reading surface fixed to the viewport,
              // with a close button (Adrian, 2026-07-26). See PhoneHudSheet for
              // why it is no longer a half-sheet riding inside this section.
              if (isPhone) {
                return (
                  <PhoneHudSheet
                    key={streamActive ? selectedKey : 'hud'}
                    onDismiss={closeSelection}
                    onNavigateAway={dismissForNavigation}
                  >
                    {hudContent}
                  </PhoneHudSheet>
                );
              }

              // Wider screens: the card seats to the right of the world.
              return (
                <div
                  data-atlas-hud
                  key={streamActive ? selectedKey : 'hud'}
                  className="absolute z-30 animate-[hud-in_400ms_ease-out] inset-x-auto right-8 bottom-auto left-auto w-[380px] top-[var(--hud-top)]"
                >
                  {hudContent}
                </div>
              );
            })()}
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
            style={{ fontFamily: 'var(--font-brand)', letterSpacing: '0.05em' }}
          >
            Atlas
          </h1>

          <div className="flex flex-col lg:flex-row gap-10 mt-8">
            <div className="flex-1 min-w-0">
              <div ref={globeBoxRef} className="relative w-full aspect-square">
                <Globe
                  nodes={globeNodes}
                  selectedId={selectedKey}
                  onSelect={(id) => selectPiece(id)}
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
                kinds={kindsAvailable}
                selectedKind={selectedKind}
                onKindChange={setSelectedKind}
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
                  onSelectKin={(key) => selectPiece(key)}
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
            className="font-display text-lg text-wood-700 py-24 text-center"
            aria-live="polite"
          >
            loading the atlas
          </p>
        )}

        {state.kind === 'error' && (
          <div
            className="font-display text-lg text-wood-700 py-24 text-center"
            aria-live="polite"
          >
            <p>the atlas is briefly out of reach.</p>
            <button
              type="button"
              onClick={retryAtlasFetch}
              disabled={retrying}
              className="mt-3 font-label not-italic text-[11px] uppercase tracking-[0.18em] underline underline-offset-4"
            >
              {retrying ? 'retrying' : 'retry'}
            </button>
          </div>
        )}

        {state.kind === 'ready' && (
          <>
            {/* One record, two readings below the globe: the wall (the
                exploratory card field, default) and the ledger (the full
                written record). Filters (lk / ls / lq) persist across both. */}
            {/* One record, two readings. This used to read as a heading
                followed by two links: a 10px letterspaced label against 18px
                serif options, with the active state carried by the only
                underline on the row, so nothing said the two words were a pair
                or that either was pressable. Now both options always carry the
                rail (faint when resting, lit when chosen), a divider binds them
                into one switch, and the size gap between label and options is
                closed enough that they read as parts of the same control. */}
            <div className="mb-8 flex flex-wrap items-baseline gap-x-4 gap-y-2 border-t border-wood-200 pt-10">
              <span className="shrink-0 font-label text-[10px] uppercase tracking-[0.22em] text-wood-500">
                read it as
              </span>
              <div className="flex items-baseline gap-4">
                <button
                  type="button"
                  aria-pressed={!ledgerView}
                  onClick={() => setLedgerView(false)}
                  className={`font-display text-[17px] leading-none pb-1 border-b transition-colors ${
                    !ledgerView
                      ? 'text-wood-900 border-bronze-600'
                      : 'text-wood-500 border-[rgba(196,170,124,0.3)] hover:text-wood-800 hover:border-atlas-gold'
                  }`}
                >
                  the wall
                </button>
                <span aria-hidden className="text-wood-400 text-[13px] leading-none">
                  /
                </span>
                <button
                  type="button"
                  aria-pressed={ledgerView}
                  onClick={() => setLedgerView(true)}
                  className={`font-display text-[17px] leading-none pb-1 border-b transition-colors ${
                    ledgerView
                      ? 'text-wood-900 border-bronze-600'
                      : 'text-wood-500 border-wood-200 hover:text-bronze-700 hover:border-bronze-700'
                  }`}
                >
                  the ledger
                </button>
              </div>
              {/* The third reading is a page of its own (the whole record as
                  one table, no globe), so it is a quiet door held away from
                  the switch rather than a third option inside it. */}
              <Link
                to="/atlas/registry"
                className="ml-auto font-label text-[12px] lowercase tracking-[0.06em] text-bronze-700 hover:text-bronze-600 transition-colors"
              >
                the registry →
              </Link>
            </div>

            {ledgerView ? (
              <TheLedger
                codeEntries={codeEntries}
                kindSections={kindSections}
                onSelectOnGlobe={selectPieceOnGlobe}
              />
            ) : (
              <TheWall cards={wallCards} onSelectOnGlobe={selectPieceOnGlobe} />
            )}

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

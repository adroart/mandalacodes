/**
 * Constellation-style 3D globe for the /atlas page.
 *
 * Self-contained. No data dependencies. Receives nodes from the parent, paints
 * them as soft bronze stars on a dark sphere via cobe, breathes them gently,
 * and reports selection back up.
 *
 * Visual brief: docs/atlas-style-notes.md. Tokens derived from src/index.css
 * (paper / wood / stone / bronze) but resolved here locally so the file stays
 * self-contained and never touches global CSS.
 *
 * Click-on-marker: cobe has no hit-testing. We mirror cobe's vertex transform
 * in JS (rotate by current phi/theta, scale to radius, project orthographic),
 * cull markers on the back hemisphere, then pick the screen-nearest marker
 * within an 18px threshold. This stays in sync because the auto-rotation drift
 * is tracked in a ref the click handler can read.
 */

import createGlobe from 'cobe';
import type { COBEOptions } from 'cobe';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// cobe's exposed type definitions omit `onRender` (a runtime-only callback),
// so we widen the options shape locally rather than touching node_modules.
type CobeOptionsWithRender = COBEOptions & {
  onRender?: (state: Record<string, number>) => void;
};

export interface GlobeNode {
  id: string;                       // unique key (e.g. `pieceId:editionNumber`)
  lat: number;
  lng: number;
  // placed     = a lit light (claimed + placed), full bronze.
  // unawakened = sold-but-unclaimed: anchored to a city but not yet claimed.
  //              Renders as a faint ember — honest about the early map and
  //              doubling as Adrian's outreach dashboard.
  // seeking    = not yet anchored, render dimmer.
  // origin     = the visitor's own birth place (Hologenetic Profile),
  //              rendered in the profile's activation sage rather than bronze.
  status: 'placed' | 'unawakened' | 'seeking' | 'origin';
  label?: string;                   // unused by Globe itself, passed through
  // Marker color family: 'other' (non-mandala pieces) gets a distinct hue from
  // the bronze Universal Language pieces. Undefined ⇒ mandala/bronze.
  pieceType?: 'mandala' | 'other';
  // Art series this piece belongs to (e.g. 'Universal Language'). Drives the
  // marker hue so each series reads as its own constellation on the map.
  series?: string;
  // Founding Lights claim order (1 = Adrian's first light). Drives the
  // ignition opening: lights ignite in claim order when the atlas loads.
  ordinal?: number;
  // True when this piece carries one of the visitor's own codes (computed
  // locally from their profile; never sent anywhere).
  yours?: boolean;
  // True when the signed-in visitor stewards this piece (from the idempotent
  // bind call). Owned lights render with a brighter warm treatment.
  owned?: boolean;
  // Physical potency band (from the piece's dimensions). Drives the marker's
  // brightness on the Three.js globe: a greater fire for a larger work. Read
  // as a continuous warm scale, never a discrete tier or a size label.
  sizeBand?: 'small' | 'medium' | 'large';
  // Archive category (medium / theme). Passed through for future lensing; the
  // renderer does not read it yet.
  category?: string;
  // Sale price, when it exists. Folds a gentle continuous modifier into the
  // potency brightness so price reads as depth of fire, never a number.
  // Undefined until pricing data lands.
  price?: number;
  // The public dream this lit light carries, when its keeper shares one. Feeds
  // the "dreams write the sky" overlay (opening flares + the resting sky). Only
  // set on lit ('placed') pieces; sealed/absent dreams are never present here.
  intention?: string;
  // ─── City-cluster fields (Phase 2A) ──────────────────────────────────────
  // A node may be a single piece (the default, every field above) OR a city
  // cluster carrying several pieces at one lat/lng. Single-piece cities keep
  // the piece's own key as `id` so they behave pixel-identically to before;
  // multi-piece cities use a synthetic `city:<cityId>` id and set `count > 1`.
  /** The city this node sits in (absent for the birth-place origin node). */
  cityId?: string;
  /** How many pieces this node represents. Absent or 1 = a single piece. */
  count?: number;
  /** The per-piece selection keys gathered into this cluster. */
  memberKeys?: string[];
  /** Every distinct series among the cluster's members (drives the lens: a
      cluster stays lit under a series focus if ANY member is in that series). */
  seriesList?: string[];
}

export interface GlobeProps {
  nodes: GlobeNode[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
}

// ─── Color tokens (derived, not imported, so this file stays self-contained)
// All in normalized RGB 0..1 for cobe shaders.
const BACKGROUND_RGB = '15, 13, 11';                  // near-black stone tone
const BASE_COLOR: [number, number, number] = [0.42, 0.40, 0.36];   // faint silver continents
const MARKER_COLOR: [number, number, number] = [0.77, 0.67, 0.49]; // bronze-400
const GLOW_COLOR: [number, number, number] = [0.27, 0.22, 0.14];   // bronze-900 halo

// Marker sizes in cobe units.
const PLACED_SIZE = 0.04;
const UNAWAKENED_SIZE = 0.022;
const SEEKING_SIZE = 0.025;
const ORIGIN_SIZE = 0.035;

// The visitor's birth place — profile activation sage (#9bab86), so the
// personal marker reads as a different order of thing than the bronze pieces.
const ORIGIN_COLOR: [number, number, number] = [0.61, 0.67, 0.53];
const SEEKING_COLOR: [number, number, number] = [0.55, 0.48, 0.36];

// Non-mandala ('other') pieces get a muted verdigris-bronze — a cooler,
// patinated metal that sits beside the warm bronze of the Universal Language
// pieces without clashing. Same metallic family, different oxidation.
const OTHER_COLOR: [number, number, number] = [0.49, 0.58, 0.52];

// Sold-but-unclaimed pieces — a dim ember, present but not yet lit. Dimmer
// and smaller than a placed light, distinct from the cooler seeking dots.
const UNAWAKENED_COLOR: [number, number, number] = [0.34, 0.29, 0.21];

// The signed-in visitor's own stewarded pieces: a brighter, warmer gold
// bronze, slightly larger, so your own light reads as yours at a glance.
const OWNED_COLOR: [number, number, number] = [0.93, 0.79, 0.51];
const OWNED_SIZE = 0.052;

// Auto-rotation in radians per frame; ~0.005 reads as a slow, quiet drift.
const ROTATION_SPEED = 0.005;

// Selection animation duration, ms.
const SELECT_ANIM_MS = 800;

// Click-pick threshold in CSS pixels.
const PICK_THRESHOLD_PX = 18;

// ─── No-WebGL fallback: a flat SVG constellation ───────────────────────────
// cobe (the globe drawn above) requires a WebGL context and, when it can't
// get one, silently no-ops — no error, no draw call, just a blank canvas
// forever. A visitor whose browser truly has no WebGL (not "no 3D", no
// WebGL at all) was seeing an empty box here, the title and side panel
// intact around it. When that happens we skip cobe entirely and paint the
// same lights as flat SVG circles, reusing `projectMarker` below so the
// rotation and selection tweens stay pixel-identical to the WebGL path.

let cachedHasWebGL: boolean | null = null;

/** Whether this browser can hand a canvas a WebGL context at all. Cached
 *  for the session — it cannot change while the page is open. */
function supportsWebGLContext(): boolean {
  if (cachedHasWebGL !== null) return cachedHasWebGL;
  try {
    const c = document.createElement('canvas');
    cachedHasWebGL = !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    cachedHasWebGL = false;
  }
  return cachedHasWebGL;
}

// Marker sizes in CSS pixels for the SVG path (the WebGL sizes above are in
// cobe's own unit-sphere scale and don't translate directly to pixels).
const PLACED_SIZE_PX = 4.5;
const UNAWAKENED_SIZE_PX = 3;
const SEEKING_SIZE_PX = 3.5;
const ORIGIN_SIZE_PX = 5;
const OWNED_SIZE_PX = 6;

function rgbCss([r, g, b]: [number, number, number], alpha = 1): string {
  const R = Math.round(r * 255);
  const G = Math.round(g * 255);
  const B = Math.round(b * 255);
  return alpha === 1 ? `rgb(${R}, ${G}, ${B})` : `rgba(${R}, ${G}, ${B}, ${alpha})`;
}

/** Same priority order as the cobe `markers` list below, resolved to CSS. */
function nodeMarkerColorCss(n: GlobeNode): string {
  if (n.status === 'origin') return rgbCss(ORIGIN_COLOR);
  if (n.owned) return rgbCss(OWNED_COLOR);
  if (n.status === 'seeking') return rgbCss(SEEKING_COLOR);
  if (n.status === 'unawakened') return rgbCss(UNAWAKENED_COLOR);
  if (n.pieceType === 'other') return rgbCss(OTHER_COLOR);
  return rgbCss(MARKER_COLOR);
}

function nodeMarkerRadiusPx(n: GlobeNode): number {
  if (n.owned && n.status !== 'origin') return OWNED_SIZE_PX;
  if (n.status === 'placed') return PLACED_SIZE_PX;
  if (n.status === 'unawakened') return UNAWAKENED_SIZE_PX;
  if (n.status === 'origin') return ORIGIN_SIZE_PX;
  return SEEKING_SIZE_PX;
}

/**
 * Project a (lat, lng) onto canvas-CSS-pixel coordinates given cobe's current
 * phi (longitude offset, radians) and theta (latitude tilt, radians).
 *
 * cobe orients the sphere with the prime meridian at phi=0; rotating phi spins
 * the globe west-to-east. Theta tilts the north pole toward the viewer.
 * Coordinate convention matches cobe's marker.location: [lat, lng] in degrees.
 *
 * Returns null if the point is on the back hemisphere (occluded).
 */
function projectMarker(
  lat: number,
  lng: number,
  phi: number,
  theta: number,
  width: number,
  height: number,
): { x: number; y: number } | null {
  const latR = (lat * Math.PI) / 180;
  const lngR = (lng * Math.PI) / 180;

  // Unit sphere coords with lng=0 facing +Z. Apply phi as longitude rotation.
  const effectiveLng = lngR - phi;
  const cosLat = Math.cos(latR);
  let x = cosLat * Math.sin(effectiveLng);
  let y = Math.sin(latR);
  let z = cosLat * Math.cos(effectiveLng);

  // Tilt by theta around the X axis (rotates north pole toward viewer).
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const y2 = y * cosT - z * sinT;
  const z2 = y * sinT + z * cosT;
  y = y2;
  z = z2;

  if (z < 0) return null; // back hemisphere

  // Cobe draws the globe filling the canvas; radius is min(w,h)/2 in CSS px.
  const r = Math.min(width, height) / 2;
  return {
    x: width / 2 + x * r,
    y: height / 2 - y * r,
  };
}

/**
 * Great-circle distance on a unit sphere between two (lat, lng) pairs in deg.
 * Used for the phi/theta tween target.
 */
function shortestLngDelta(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

export default function Globe({
  nodes,
  selectedId,
  onSelect,
  className,
}: GlobeProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Computed once: whether cobe has any WebGL context to draw into. When it
  // doesn't, we never call createGlobe and paint the SVG constellation
  // below instead (see "No-WebGL fallback" above `Globe`).
  const [hasWebGL] = useState<boolean>(supportsWebGLContext);
  // SVG-path marker elements, keyed by node id, mutated directly by the
  // rotation clock below (never through React state — same pattern
  // KinshipLayer uses for its 60fps arc redraw, so neither loop causes a
  // reconciliation pass).
  const markerElsRef = useRef<Map<string, SVGCircleElement>>(new Map());

  // Live size in CSS pixels.
  const [size, setSize] = useState({ width: 600, height: 600 });

  // Cobe state. We mutate refs from inside onRender (which runs every frame)
  // and from the click handler so the picker stays in sync with the render.
  const phiRef = useRef(0);
  const thetaRef = useRef(0.2); // gentle northern tilt
  const pausedRef = useRef(false);
  const tweenRef = useRef<{
    fromPhi: number;
    toPhi: number;
    fromTheta: number;
    toTheta: number;
    startedAt: number;
    duration: number;
  } | null>(null);

  // Track hover so we can pause rotation. (No tooltip — the side panel owns labels.)
  const [isHover, setIsHover] = useState(false);

  // ─── Resize observer
  useEffect(() => {
    const wrap = wrapperRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        // Keep the globe square-ish: use the smaller dimension for both axes
        // so the sphere never stretches. Parent decides container shape.
        const d = Math.max(120, Math.min(cr.width, cr.height));
        setSize({ width: d, height: d });
      }
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // ─── Build cobe markers from props
  const markers = useMemo(
    () =>
      nodes.map(n => ({
        location: [n.lat, n.lng] as [number, number],
        size:
          n.owned && n.status !== 'origin' ? OWNED_SIZE
          : n.status === 'placed' ? PLACED_SIZE
          : n.status === 'unawakened' ? UNAWAKENED_SIZE
          : n.status === 'origin' ? ORIGIN_SIZE
          : SEEKING_SIZE,
        // Per-marker color overrides the global markerColor (the warm bronze
        // used for lit Universal Language lights). Order matters: origin wins,
        // then the visitor's own stewarded pieces take the bright gold bronze,
        // then status (seeking/unawakened), then a placed non-mandala piece
        // takes the cooler verdigris; a placed mandala falls through to the
        // default bronze.
        color:
          n.status === 'origin' ? ORIGIN_COLOR
          : n.owned ? OWNED_COLOR
          : n.status === 'seeking' ? SEEKING_COLOR
          : n.status === 'unawakened' ? UNAWAKENED_COLOR
          : n.pieceType === 'other' ? OTHER_COLOR
          : undefined,
        id: n.id,
      })),
    [nodes],
  );

  // ─── Trigger a tween toward the selected node
  useEffect(() => {
    if (!selectedId) return;
    const target = nodes.find(n => n.id === selectedId);
    if (!target) return;

    const targetPhi = (target.lng * Math.PI) / 180;
    // cobe theta increases as the north pole tilts toward the viewer; to bring
    // a latitude into the equatorial sight line we set theta to its negative.
    const targetTheta = -(target.lat * Math.PI) / 180;

    const fromPhi = phiRef.current;
    // Walk phi the short way around the sphere.
    const dPhi = shortestLngDelta(fromPhi, targetPhi);
    tweenRef.current = {
      fromPhi,
      toPhi: fromPhi + dPhi,
      fromTheta: thetaRef.current,
      toTheta: targetTheta,
      startedAt: performance.now(),
      duration: SELECT_ANIM_MS,
    };
    pausedRef.current = true; // hold position once tween completes
  }, [selectedId, nodes]);

  // ─── Pause when user is hovering
  useEffect(() => {
    if (isHover) {
      pausedRef.current = true;
    } else if (!selectedId) {
      pausedRef.current = false;
    }
  }, [isHover, selectedId]);

  // ─── Create / recreate the globe whenever size or markers change
  useEffect(() => {
    if (!hasWebGL) return; // painted by the SVG fallback clock instead
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (size.width === 0 || size.height === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const startedAt = performance.now();

    const opts: CobeOptionsWithRender = {
      devicePixelRatio: dpr,
      width: size.width * dpr,
      height: size.height * dpr,
      phi: phiRef.current,
      theta: thetaRef.current,
      dark: 1,
      diffuse: 1.1,
      mapSamples: 16000,
      mapBrightness: 3.2,
      baseColor: BASE_COLOR,
      markerColor: MARKER_COLOR,
      glowColor: GLOW_COLOR,
      markers,
      onRender: state => {
        const now = performance.now();

        // Tween toward selected target if active.
        const tween = tweenRef.current;
        if (tween) {
          const t = Math.min(1, (now - tween.startedAt) / tween.duration);
          // easeInOutCubic
          const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
          phiRef.current = tween.fromPhi + (tween.toPhi - tween.fromPhi) * e;
          thetaRef.current =
            tween.fromTheta + (tween.toTheta - tween.fromTheta) * e;
          if (t >= 1) tweenRef.current = null;
        } else if (!pausedRef.current) {
          phiRef.current += ROTATION_SPEED;
        }

        state.phi = phiRef.current;
        state.theta = thetaRef.current;
        state.width = size.width * dpr;
        state.height = size.height * dpr;

        // Breathing pulse: ~3.5s sinusoidal modulation of mapBrightness so the
        // continents themselves seem to inhale. Subtle (±0.4 around 3.2).
        const breath =
          3.2 + Math.sin(((now - startedAt) / 1000) * (Math.PI * 2) / 3.5) * 0.4;
        state.mapBrightness = breath;
      },
    };
    const globe = createGlobe(canvas, opts as COBEOptions);

    return () => globe.destroy();
  }, [hasWebGL, size.width, size.height, markers]);

  // ─── SVG fallback rotation clock (no WebGL) ────────────────────────────
  // Mirrors cobe's onRender above exactly — same rotation speed, same tween
  // easing — so KinshipLayer's independently re-derived clock (see that
  // file's header) stays in sync whichever renderer is actually painting.
  // Runs every animation frame (never throttled) for the same reason: a
  // throttled clock would drift out of lockstep with KinshipLayer's 60fps
  // loop. Marker positions are written straight to the DOM via refs, not
  // React state, so this never triggers a reconciliation pass.
  useEffect(() => {
    if (hasWebGL) return;
    if (size.width === 0 || size.height === 0) return;

    let raf = 0;
    const tick = () => {
      const now = performance.now();

      const tween = tweenRef.current;
      if (tween) {
        const t = Math.min(1, (now - tween.startedAt) / tween.duration);
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        phiRef.current = tween.fromPhi + (tween.toPhi - tween.fromPhi) * e;
        thetaRef.current = tween.fromTheta + (tween.toTheta - tween.fromTheta) * e;
        if (t >= 1) tweenRef.current = null;
      } else if (!pausedRef.current) {
        phiRef.current += ROTATION_SPEED;
      }

      for (const n of nodes) {
        const el = markerElsRef.current.get(n.id);
        if (!el) continue;
        const p = projectMarker(
          n.lat,
          n.lng,
          phiRef.current,
          thetaRef.current,
          size.width,
          size.height,
        );
        if (!p) {
          el.style.display = 'none';
          continue;
        }
        el.style.display = '';
        el.setAttribute('cx', String(p.x));
        el.setAttribute('cy', String(p.y));
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hasWebGL, nodes, size.width, size.height]);

  // ─── Click-on-marker (manual pick)
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!onSelect || nodes.length === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      let best: { id: string; dist: number } | null = null;
      for (const n of nodes) {
        const p = projectMarker(
          n.lat,
          n.lng,
          phiRef.current,
          thetaRef.current,
          size.width,
          size.height,
        );
        if (!p) continue;
        const d = Math.hypot(p.x - cx, p.y - cy);
        if (d < PICK_THRESHOLD_PX && (best === null || d < best.dist)) {
          best = { id: n.id, dist: d };
        }
      }
      if (best) onSelect(best.id);
    },
    [nodes, onSelect, size.width, size.height],
  );

  return (
    <div
      ref={wrapperRef}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 320,
        background: `rgb(${BACKGROUND_RGB})`,
        // Soft inner vignette so the sphere's edge melts into the panel.
        boxShadow: `inset 0 0 80px 20px rgb(${BACKGROUND_RGB})`,
        overflow: 'hidden',
        fontFamily: 'var(--font-reading)',
      }}
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
    >
      {hasWebGL ? (
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          style={{
            width: size.width,
            height: size.height,
            maxWidth: '100%',
            maxHeight: '100%',
            display: 'block',
            margin: '0 auto',
            cursor: onSelect ? 'pointer' : 'default',
            contain: 'layout paint size',
          }}
          aria-label="Interactive globe showing where Adrian Rasmussen's artworks are placed in the world."
          role="img"
        />
      ) : (
        // No WebGL anywhere in this browser: cobe would draw nothing (see
        // "No-WebGL fallback" above). A flat constellation instead — the
        // same lights, the same rotation, no continent texture or glow.
        <svg
          viewBox={`0 0 ${size.width} ${size.height}`}
          width={size.width}
          height={size.height}
          style={{
            width: size.width,
            height: size.height,
            maxWidth: '100%',
            maxHeight: '100%',
            display: 'block',
            margin: '0 auto',
          }}
          aria-label="A constellation of Adrian Rasmussen's artworks resting across the world."
          role="img"
        >
          <circle
            cx={size.width / 2}
            cy={size.height / 2}
            r={Math.max(0, Math.min(size.width, size.height) / 2 - 1)}
            fill="none"
            stroke={rgbCss(BASE_COLOR, 0.25)}
            strokeWidth={1}
          />
          {nodes.map(n => {
            const initial = projectMarker(
              n.lat,
              n.lng,
              phiRef.current,
              thetaRef.current,
              size.width,
              size.height,
            );
            return (
              <circle
                key={n.id}
                ref={el => {
                  if (el) markerElsRef.current.set(n.id, el);
                  else markerElsRef.current.delete(n.id);
                }}
                cx={initial ? initial.x : size.width / 2}
                cy={initial ? initial.y : size.height / 2}
                r={nodeMarkerRadiusPx(n)}
                fill={nodeMarkerColorCss(n)}
                style={{
                  display: initial ? undefined : 'none',
                  cursor: onSelect ? 'pointer' : 'default',
                }}
                onClick={() => onSelect?.(n.id)}
              />
            );
          })}
        </svg>
      )}
    </div>
  );
}

/*
 * ── Mini usage example (do not import — this is just a sketch) ──────────────
 *
 * const demoNodes: GlobeNode[] = [
 *   { id: 'ul-01:1', lat: 38.7223, lng:  -9.1393, status: 'placed',  label: "Earth's Breath" },
 *   { id: 'ul-02:1', lat: -8.4095, lng: 115.1889, status: 'placed',  label: 'Universal Language 02' },
 *   { id: 'ul-03:1', lat: 35.6762, lng: 139.6503, status: 'placed',  label: 'Universal Language 03' },
 *   { id: 'ul-04:1', lat: 40.7128, lng: -74.0060, status: 'placed',  label: 'Universal Language 04' },
 *   { id: 'ul-05:1', lat: 48.8566, lng:   2.3522, status: 'placed',  label: 'Universal Language 05' },
 *   { id: 'ul-06:1', lat: 51.5074, lng:  -0.1278, status: 'placed',  label: 'Universal Language 06' },
 *   { id: 'ul-07:1', lat:-33.8688, lng: 151.2093, status: 'placed',  label: 'Universal Language 07' },
 *   { id: 'ul-08:1', lat: 19.4326, lng: -99.1332, status: 'placed',  label: 'Universal Language 08' },
 *   { id: 'ul-09:1', lat: 41.0082, lng:  28.9784, status: 'seeking', label: 'Universal Language 09' },
 *   { id: 'ul-10:1', lat: 55.7558, lng:  37.6173, status: 'seeking', label: 'Universal Language 10' },
 * ];
 *
 * function AtlasDemo() {
 *   const [sel, setSel] = React.useState<string | null>(null);
 *   return (
 *     <div style={{ width: 600, height: 600 }}>
 *       <Globe nodes={demoNodes} selectedId={sel} onSelect={setSel} />
 *     </div>
 *   );
 * }
 */

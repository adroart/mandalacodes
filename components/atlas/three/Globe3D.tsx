/**
 * The Three.js Atlas globe: public wrapper.
 *
 * Drop-in successor to the cobe Globe: same node/selection contract, plus
 * the kinship index (arcs render in-scene now, not as an SVG overlay), the
 * hexagram ring, and the Mandala View.
 *
 * Interaction model:
 *   · auto-rotates; pauses on hover, drag, or selection (as before)
 *   · drag to rotate; a press that moves <6px is a click → marker pick
 *   · pick = project every node with the current rotation + camera, take the
 *     screen-nearest within 18px (front hemisphere only)
 *   · ~25s of stillness with nothing selected engages the Mandala View: the
 *     camera pulls back and the kinship arcs weave themselves in. Any touch
 *     brings it home. The page can also engage it via the `mandala` prop.
 *
 * Render loop runs only while the globe is on screen (IntersectionObserver
 * gates the frameloop). DPR capped at 2. Low-tier devices skip bloom and
 * ripples and thin the dot field. WebGL support is the caller's check :
 * see `supportsWebGL()`: so the page can fall back to the cobe globe.
 */

import { Canvas } from '@react-three/fiber';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import type { KinshipIndex } from '../../../utils/kinship';
import type { GlobeNode } from '../Globe';
import GlobeScene from './GlobeScene';
import {
  CAMERA_NEAR_DIST,
  createRig,
  latLngToVec3,
  Rig,
  RigContext,
  SELECT_ANIM_MS,
  shortestAngleDelta,
} from './rig';

const BACKGROUND_RGB = '15, 13, 11';
const PICK_THRESHOLD_PX = 18;
const CLICK_SLOP_PX = 6;
const IDLE_MANDALA_MS = 25_000;
const RING_TAP_PX = 22;
const RING_HOVER_PX = 34;

export function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function detectLowTier(): boolean {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 8;
  const coarse =
    typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  return (cores != null && cores <= 4) || (coarse && (cores == null || cores <= 6));
}

export interface Globe3DProps {
  /** The rendered marker layer: one node per city cluster (plus the birth
      origin). Single-piece cities keep the piece's own key as their id. */
  nodes: GlobeNode[];
  /** The selected marker (a cluster id): drives the tween, leader line and
      marker highlight. */
  selectedId?: string | null;
  /** The selected piece key: drives the kinship-arc highlight and the thread-
      travel flight, which both key off per-piece node keys. */
  kinSelectedId?: string | null;
  onSelect?: (id: string) => void;
  kinship?: KinshipIndex | null;
  kinshipVisible?: boolean;
  /** First placed location per hexagram number, for the ring threads. */
  placedByCard?: ReadonlyMap<number, { lat: number; lng: number }>;
  /** Manual Mandala View toggle (idle engages it on its own). */
  mandala?: boolean;
  /** Caption shown while the Mandala View is engaged. */
  mandalaCaption?: string;
  /** Reports the selected marker's screen position each frame (leader line). */
  onMarkerScreenPos?: (pos: { x: number; y: number }) => void;
  /** A click that lands on no marker while something is selected. */
  onBackgroundClick?: () => void;
  /** Slide the world aside when a piece is held, clearing room for the HUD.
      The claim ceremony turns this off: it has no side card. */
  clearForHud?: boolean;
  /** Lens focus: lights outside this series recede. */
  focusSeries?: string | null;
  /** Your-codes lens: lights without the visitor's codes recede. */
  yoursMode?: boolean;
  /** Mandala view only: a tap on one of the 64 ring glyphs. */
  onRingTap?: (cardNumber: number) => void;
  className?: string;
}

const EMPTY_PLACED: ReadonlyMap<number, { lat: number; lng: number }> = new Map();

export default function Globe3D({
  nodes,
  selectedId,
  kinSelectedId,
  onSelect,
  kinship,
  kinshipVisible = true,
  placedByCard = EMPTY_PLACED,
  mandala = false,
  mandalaCaption,
  onMarkerScreenPos,
  onBackgroundClick,
  clearForHud = true,
  focusSeries,
  yoursMode,
  onRingTap,
  className,
}: Globe3DProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  // The canvas lives in its own box so it can slide aside for the HUD while
  // the wrapper (and its pointer handlers) stay put. Pick math and the leader
  // line project through this box's live rect, so the slide never desyncs them.
  const canvasBoxRef = useRef<HTMLDivElement | null>(null);
  const rig = useMemo<Rig>(() => createRig(detectLowTier()), []);

  const [inView, setInView] = useState(true);
  const [mandalaOn, setMandalaOn] = useState(false);

  // City-cluster count numerals: one absolutely-positioned DOM element per
  // multi-piece city, projected each frame through the live rig (the same
  // projection the leader line uses), so the number rides on its marker and
  // hides on the back hemisphere. DOM, not shader text: cheap and crisp.
  const numeralRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Dev-only window handle for inspecting the live rig from the console.
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as { __atlasRig?: Rig }).__atlasRig = rig;
  }, [rig]);

  /* Reduced motion: one shared, live-updating check the whole scene reads off
     the rig. Toggling the OS setting takes effect without a reload. */
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      rig.reducedMotion = mq.matches;
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [rig]);
  // Thread travel: caption naming the thread while the camera flies it.
  const [travelCaption, setTravelCaption] = useState<string | null>(null);
  const travelTimer = useRef<number>(0);
  const prevSelected = useRef<string | null>(null);
  // Thread travel keys off the piece keys, not the cluster ids, so kindred
  // single-piece cities still fly their shared thread on selection.
  const prevKinSelected = useRef<string | null>(null);

  // Mutable interaction state (never React state: read inside handlers).
  const drag = useRef<{ x: number; y: number; moved: boolean; active: boolean }>({
    x: 0,
    y: 0,
    moved: false,
    active: false,
  });
  const lastInteraction = useRef(performance.now());
  const hoverRef = useRef(false);
  const selectedRef = useRef<string | null>(selectedId ?? null);

  const engageMandala = useCallback(
    (on: boolean) => {
      if (on && rig.mandalaTarget !== 1) {
        rig.mandalaTarget = 1;
        rig.mandalaStartedAt = performance.now();
        rig.paused = true;
        setMandalaOn(true);
      } else if (!on && rig.mandalaTarget !== 0) {
        rig.mandalaTarget = 0;
        if (!hoverRef.current && !selectedRef.current) rig.paused = false;
        setMandalaOn(false);
      }
    },
    [rig],
  );

  /* Manual toggle from the page wins over the idle timer. */
  useEffect(() => {
    engageMandala(mandala);
  }, [mandala, engageMandala]);

  const noteInteraction = useCallback(() => {
    lastInteraction.current = performance.now();
    if (!mandala) engageMandala(false);
  }, [mandala, engageMandala]);

  /* Idle watcher: engages the Mandala View after stillness. */
  useEffect(() => {
    const id = window.setInterval(() => {
      if (mandala) return; // already engaged manually
      if (selectedRef.current) return;
      if (document.hidden || !inView) return;
      if (performance.now() - lastInteraction.current > IDLE_MANDALA_MS) {
        engageMandala(true);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [mandala, inView, engageMandala]);

  /* Selection: tween the globe to face the piece. Moving between two kindred
     pieces becomes a thread travel: a longer flight, the camera lifting off
     the surface mid-arc, and a caption naming the thread being flown. */
  useEffect(() => {
    const prevKin = prevKinSelected.current;
    prevKinSelected.current = kinSelectedId ?? null;
    prevSelected.current = selectedId ?? null;
    selectedRef.current = selectedId ?? null;
    if (!selectedId) {
      if (!hoverRef.current && rig.mandalaTarget === 0) rig.paused = false;
      return;
    }
    const target = nodes.find((n) => n.id === selectedId);
    if (!target) return;
    engageMandala(false);

    const trigram =
      prevKin && kinSelectedId && prevKin !== kinSelectedId
        ? sharedTrigram(kinship, prevKin, kinSelectedId)
        : null;
    const traveling = trigram != null;
    if (traveling) {
      setTravelCaption(`traveling the ${trigram} thread`);
      window.clearTimeout(travelTimer.current);
      travelTimer.current = window.setTimeout(() => setTravelCaption(null), 2600);
    }

    const toPhi = (target.lng * Math.PI) / 180;
    const toTheta = (target.lat * Math.PI) / 180;
    rig.tween = {
      fromPhi: rig.phi,
      toPhi: rig.phi + shortestAngleDelta(rig.phi % (Math.PI * 2), toPhi),
      fromTheta: rig.theta,
      toTheta,
      startedAt: performance.now(),
      duration: traveling ? 1700 : SELECT_ANIM_MS,
      dollyAmp: traveling ? 1.15 : undefined,
    };
    rig.paused = true;
  }, [selectedId, kinSelectedId, nodes, rig, engageMandala, kinship]);

  useEffect(() => () => window.clearTimeout(travelTimer.current), []);

  /* Leader line: project the selected marker through the live rig each frame
     so the page can pin its hairline to the moving light. */
  useEffect(() => {
    if (!selectedId || !onMarkerScreenPos) return;
    let raf = 0;
    const v = new THREE.Vector3();
    const update = () => {
      const inner = canvasBoxRef.current;
      const wrapper = wrapperRef.current;
      const camera = rig.camera;
      const n = nodes.find((node) => node.id === selectedId);
      if (inner && wrapper && camera && n) {
        latLngToVec3(n.lat, n.lng, 1.012, v);
        v.applyAxisAngle(Y_AXIS, -rig.phi);
        v.applyAxisAngle(X_AXIS, rig.theta);
        if (v.z > 0.05) {
          const r = inner.getBoundingClientRect();
          const w = wrapper.getBoundingClientRect();
          v.project(camera);
          onMarkerScreenPos({
            x: (v.x * 0.5 + 0.5) * r.width + (r.left - w.left),
            y: (1 - (v.y * 0.5 + 0.5)) * r.height + (r.top - w.top),
          });
        }
      }
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [selectedId, nodes, onMarkerScreenPos, rig]);

  /* City-cluster numerals: project every multi-piece city each frame and pin
     its number to the marker. Writes DOM transforms directly (no React state)
     so the label tracks the turning globe without re-rendering. Hidden on the
     back hemisphere and while the mandala view is engaged (the markers shrink
     there and fixed-size labels would crowd the weave). */
  const hasNumerals = useMemo(() => nodes.some((n) => (n.count ?? 1) > 1), [nodes]);
  useEffect(() => {
    if (!hasNumerals) return;
    let raf = 0;
    const v = new THREE.Vector3();
    const update = () => {
      const inner = canvasBoxRef.current;
      const wrapper = wrapperRef.current;
      const camera = rig.camera;
      if (inner && wrapper && camera) {
        const r = inner.getBoundingClientRect();
        const w = wrapper.getBoundingClientRect();
        const hidden = rig.mandala > 0.05;
        for (const n of nodes) {
          if ((n.count ?? 1) <= 1) continue;
          const el = numeralRefs.current.get(n.id);
          if (!el) continue;
          latLngToVec3(n.lat, n.lng, 1.012, v);
          v.applyAxisAngle(Y_AXIS, -rig.phi);
          v.applyAxisAngle(X_AXIS, rig.theta);
          if (!hidden && v.z > 0.05) {
            v.project(camera);
            const x = (v.x * 0.5 + 0.5) * r.width + (r.left - w.left);
            const y = (1 - (v.y * 0.5 + 0.5)) * r.height + (r.top - w.top);
            el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
            el.style.opacity = '1';
          } else {
            el.style.opacity = '0';
          }
        }
      }
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [hasNumerals, nodes, rig]);

  /* Frameloop gating: stop rendering entirely when scrolled away. */
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => setInView(entries[0]?.isIntersecting ?? true),
      { threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* ─── Pointer handling: drag-to-rotate + click-to-pick ─────────────────── */
  const pick = useCallback(
    (clientX: number, clientY: number): boolean => {
      if (!onSelect || nodes.length === 0) return false;
      const el = canvasBoxRef.current ?? wrapperRef.current;
      const camera = rig.camera;
      if (!el || !camera) return false;
      const rect = el.getBoundingClientRect();
      const cx = clientX - rect.left;
      const cy = clientY - rect.top;

      const v = new THREE.Vector3();
      let best: { id: string; dist: number } | null = null;
      for (const n of nodes) {
        latLngToVec3(n.lat, n.lng, 1, v);
        v.applyAxisAngle(Y_AXIS, -rig.phi);
        v.applyAxisAngle(X_AXIS, rig.theta);
        if (v.z < 0.05) continue; // back hemisphere (with a little margin)
        v.project(camera);
        const px = (v.x * 0.5 + 0.5) * rect.width;
        const py = (1 - (v.y * 0.5 + 0.5)) * rect.height;
        const d = Math.hypot(px - cx, py - cy);
        if (d < PICK_THRESHOLD_PX && (best === null || d < best.dist)) {
          best = { id: n.id, dist: d };
        }
      }
      if (best) onSelect(best.id);
      return best !== null;
    },
    [nodes, onSelect, rig],
  );

  /* Ring tap: the 64 glyphs are touchable in the resting view and the
     mandala view alike. Anchors sit on the equatorial ring inside the
     spin/tilt groups, so they project with the same two rotations the
     markers use, through the live camera at whatever distance it currently
     sits (near at rest, pulled back in the mandala view): the projection
     needs no gate to be correct at either distance. */
  const nearestRingGlyph = useCallback(
    (clientX: number, clientY: number): { n: number; dist: number } | null => {
      const el = canvasBoxRef.current ?? wrapperRef.current;
      const camera = rig.camera;
      if (!el || !camera) return null;
      const rect = el.getBoundingClientRect();
      const cx = clientX - rect.left;
      const cy = clientY - rect.top;

      const v = new THREE.Vector3();
      let best: { n: number; dist: number } | null = null;
      for (let n = 1; n <= 64; n++) {
        const theta = ((n - 1) / 64) * Math.PI * 2;
        v.set(Math.sin(theta) * 1.52, 0, Math.cos(theta) * 1.52);
        v.applyAxisAngle(Y_AXIS, -rig.phi);
        v.applyAxisAngle(X_AXIS, rig.theta);
        v.project(camera);
        if (v.z > 1) continue; // behind the camera
        const px = (v.x * 0.5 + 0.5) * rect.width;
        const py = (1 - (v.y * 0.5 + 0.5)) * rect.height;
        const d = Math.hypot(px - cx, py - cy);
        if (best === null || d < best.dist) best = { n, dist: d };
      }
      return best;
    },
    [rig],
  );

  /* The ring is a Mandala View instrument only (Adrian, 2026-07-11: the
     resting globe is just the globe). Taps and hover are inert until the
     view is engaged, so the resting view carries no invisible hit targets.
     The machinery stays; only this gate decides. */
  const pickRing = useCallback(
    (clientX: number, clientY: number): boolean => {
      if (!onRingTap || rig.mandala < 0.6) return false;
      const hit = nearestRingGlyph(clientX, clientY);
      if (!hit || hit.dist >= RING_TAP_PX) return false;
      onRingTap(hit.n);
      return true;
    },
    [onRingTap, nearestRingGlyph, rig],
  );

  /* Ring hover: a cheap discoverability affordance while the Mandala View
     is engaged. A pointer resting near the band brightens the whole ring
     slightly via one uniform (HexagramRing reads rig.ringHover). Mouse-only
     (no hover on touch), but harmless either way. */
  const updateRingHover = useCallback(
    (clientX: number, clientY: number) => {
      if (!onRingTap || rig.mandala < 0.6) {
        rig.ringHoverTarget = false;
        return;
      }
      const hit = nearestRingGlyph(clientX, clientY);
      rig.ringHoverTarget = !!hit && hit.dist < RING_HOVER_PX;
    },
    [onRingTap, nearestRingGlyph, rig],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      noteInteraction();
      drag.current = { x: e.clientX, y: e.clientY, moved: false, active: true };
      rig.paused = true;
      rig.tween = null;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [rig, noteInteraction],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      noteInteraction();
      updateRingHover(e.clientX, e.clientY);
      const d = drag.current;
      if (!d.active) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) < CLICK_SLOP_PX) return;
      d.moved = true;
      d.x = e.clientX;
      d.y = e.clientY;
      rig.phi -= dx * 0.005;
      rig.theta = Math.max(-1.1, Math.min(1.1, rig.theta + dy * 0.004));
    },
    [rig, noteInteraction, updateRingHover],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const d = drag.current;
      d.active = false;
      if (!d.moved) {
        const hit = pick(e.clientX, e.clientY) || pickRing(e.clientX, e.clientY);
        // A click into open space releases the held piece.
        if (!hit && selectedRef.current && onBackgroundClick) onBackgroundClick();
      }
      if (!hoverRef.current && !selectedRef.current && rig.mandalaTarget === 0) {
        rig.paused = false;
      }
    },
    [pick, pickRing, rig, onBackgroundClick],
  );

  const onPointerEnter = useCallback(() => {
    hoverRef.current = true;
    rig.paused = true;
  }, [rig]);

  const onPointerLeave = useCallback(() => {
    hoverRef.current = false;
    drag.current.active = false;
    rig.ringHoverTarget = false;
    if (!selectedRef.current && rig.mandalaTarget === 0) rig.paused = false;
  }, [rig]);

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
        boxShadow: `inset 0 0 80px 20px rgb(${BACKGROUND_RGB})`,
        overflow: 'hidden',
        cursor: onSelect ? 'pointer' : 'default',
        touchAction: 'pan-y', // vertical page scroll still works over the globe
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      aria-label="Interactive globe showing where Adrian Rasmussen's artworks are placed in the world."
      role="img"
    >
      <div
        ref={canvasBoxRef}
        style={{
          position: 'absolute',
          // The canvas overhangs the wrapper on every side so the slide-aside
          // never exposes a seam: there is always world behind the edge.
          inset: '-14%',
          // A held piece slides the world aside to clear space for the HUD
          // (left on wide screens, up on phones). Pick + leader-line math read
          // this box's live rect, so they follow the slide exactly.
          // 10.94% of the 128%-wide box = 14% of the viewport.
          transform:
            selectedId && clearForHud
              ? typeof window !== 'undefined' && window.innerWidth < 768
                ? 'translateY(-10.94%)'
                : 'translateX(-10.94%)'
              : 'translate(0,0)',
          transition: 'transform 900ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
      <RigContext.Provider value={rig}>
        <Canvas
          frameloop={inView ? 'always' : 'never'}
          dpr={[1, 2]}
          // fov compensates the 128% canvas overhang: the viewport-visible
          // slice spans the same 26° the composition was tuned for.
          camera={{ fov: 32.9, near: 0.1, far: 60, position: [0, 0, CAMERA_NEAR_DIST] }}
          gl={{ antialias: true, alpha: false }}
          // Tone mapping clamps the scene's stacked bright values (sphere base +
          // additive rim + additive atmosphere + bright markers) into range.
          // The bloom EffectComposer used to own output and kept this in check;
          // with it gone the globe blew out to near-white and the small per-
          // frame brightness swings crossed the clip point: read as flicker.
          // ACES Filmic brings back the warm dark stone and pulls the whole
          // image away from clipping, so it sits steady instead of shimmering.
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 0.85;
          }}
          style={{ position: 'absolute', inset: 0 }}
        >
          <GlobeScene
            nodes={nodes}
            selectedId={selectedId}
            kinSelectedId={kinSelectedId}
            kinship={kinship}
            kinshipVisible={kinshipVisible}
            placedByCard={placedByCard}
            focusSeries={focusSeries}
            yoursMode={yoursMode}
          />
        </Canvas>
      </RigContext.Provider>
      </div>

      {/* City-cluster count numerals: the number of pieces resting in a city,
          in the map's UI label font, riding on its marker. Each is
          positioned every frame by the projection effect above. */}
      {hasNumerals && (
        <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
          {nodes
            .filter((n) => (n.count ?? 1) > 1)
            .map((n) => {
              const count = n.count ?? 1;
              const fontSize = Math.round(11 + Math.min(6, Math.log2(count) * 2));
              return (
                <div
                  key={n.id}
                  ref={(el) => {
                    if (el) numeralRefs.current.set(n.id, el);
                    else numeralRefs.current.delete(n.id);
                  }}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    opacity: 0,
                    willChange: 'transform, opacity',
                    fontFamily: 'var(--font-ui)',
                    fontWeight: 700,
                    fontSize,
                    lineHeight: 1,
                    letterSpacing: '0.04em',
                    color: '#fbf3e3',
                    textShadow:
                      '0 0 4px rgba(28,18,8,0.95), 0 1px 2px rgba(0,0,0,0.9)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {count}
                </div>
              );
            })}
        </div>
      )}

      {/* Corner vignette: pulls the eye to the lit world, hides nothing. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(ellipse 82% 78% at 50% 46%, rgba(0,0,0,0) 58%, rgba(4,3,2,0.5) 100%)',
        }}
      />

      {/* Thread travel caption: names the thread while the camera flies it. */}
      <div
        aria-hidden={!travelCaption}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 52,
          textAlign: 'center',
          pointerEvents: 'none',
          opacity: travelCaption ? 1 : 0,
          transition: 'opacity 700ms ease',
          fontFamily: 'var(--font-reading)',
          fontSize: 15,
          letterSpacing: '0.06em',
          color: 'rgba(212, 190, 150, 0.95)',
        }}
      >
        {travelCaption ?? ''}
      </div>

      {/* Mandala View caption: fades with the mode. */}
      <div
        aria-hidden={!mandalaOn}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 18,
          textAlign: 'center',
          pointerEvents: 'none',
          opacity: mandalaOn ? 1 : 0,
          transition: 'opacity 1.4s ease',
          fontFamily: 'var(--font-reading)',
          fontSize: 17,
          letterSpacing: '0.04em',
          color: 'rgb(212, 190, 150)',
        }}
      >
        {mandalaCaption ?? 'The mandala so far'}
      </div>
    </div>
  );
}

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);

/** The trigram two kindred pieces share, or null when they are not kin. */
function sharedTrigram(
  kinship: KinshipIndex | null | undefined,
  aKey: string,
  bKey: string,
): string | null {
  const a = kinship?.nodes.get(aKey);
  const b = kinship?.nodes.get(bKey);
  if (!a || !b || a.pieceId === b.pieceId) return null;
  const bT = new Set([b.upperTrigram, b.lowerTrigram]);
  if (bT.has(a.upperTrigram)) return a.upperTrigram;
  if (bT.has(a.lowerTrigram)) return a.lowerTrigram;
  return null;
}

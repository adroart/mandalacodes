/**
 * Shared state and coordinate conventions for the Three.js Atlas globe.
 *
 * Coordinate convention (matches the cobe-era projection in utils/kinship.ts):
 *   lat/lng in degrees → unit vector with lng=0 facing +Z, +Y at the north
 *   pole. The scene applies two nested rotations:
 *     tiltGroup.rotation.x = theta   (north pole toward viewer when positive)
 *     spinGroup.rotation.y = -phi    (increasing phi drifts the surface west)
 *   so a point is centred in view when phi = lngRad and theta = latRad.
 *
 * The rig object is a mutable bag of refs shared by every scene component via
 * React context. It is mutated inside useFrame and event handlers: never via
 * React state: so the render loop stays allocation-free.
 */

import { createContext, useContext } from 'react';
import * as THREE from 'three';

export const GLOBE_RADIUS = 1;

/** Camera distance at rest and pulled back for the Mandala View. At fov 26°
    the resting sphere fills ~88% of the viewport height (commanding, never
    cropped); the mandala distance is a floor: GlobeScene pushes further back
    on narrow viewports until the full hexagram ring fits. */
export const CAMERA_NEAR_DIST = 5.15;
export const CAMERA_FAR_DIST = 7.6;

/** Auto-rotation, radians per second (cobe used 0.005/frame ≈ 0.3/s). */
export const ROTATION_SPEED = 0.3;

/** Selection tween duration, ms: matches the cobe globe. */
export const SELECT_ANIM_MS = 800;

/** How long the mandala arcs take to weave themselves in, seconds. */
export const MANDALA_DRAW_SECONDS = 5;

// ─── Palette (normalized RGB, derived from the atlas style notes) ──────────
// This is the single JS source of stage colors for the hand-rolled Three.js
// globe (Globe3D and its scene components): every material/shader uniform
// that needs a stage color reads it from here, never from a literal.
//
// These THREE.Color instances are tuned specifically for this renderer, so
// they are not required to be byte-identical to the plain hex constants in
// ../stageColors.ts (GlobeGL's react-globe.gl renderer is tuned separately).
// Where a value IS meant to be the same color, keep it in lockstep by hand
// with both ../stageColors.ts and the matching --color-atlas-* token in
// src/theme.css: COLOR_BG ~ atlas-night, COLOR_BRONZE ~ atlas-gold,
// COLOR_SAGE ~ atlas-kept, COLOR_EMBER ~ atlas-ember.
export const COLOR_BG = new THREE.Color(15 / 255, 13 / 255, 11 / 255);
export const COLOR_LAND = new THREE.Color(0.56, 0.53, 0.47);
export const COLOR_BRONZE = new THREE.Color(0.77, 0.67, 0.49);
export const COLOR_BRONZE_DIM = new THREE.Color(0.55, 0.48, 0.36);
export const COLOR_SAGE = new THREE.Color(0.61, 0.67, 0.53);
export const COLOR_RIM = new THREE.Color(0.32, 0.27, 0.19);
// Sold-but-unclaimed pieces: a deep warm ember, present but asleep. Carried
// over from the cobe globe's UNAWAKENED_COLOR intent (Globe.tsx) so the two
// renderers agree on the resting-ember hue. Warm brown-bronze, never cold.
export const COLOR_EMBER = new THREE.Color(0.34, 0.29, 0.21);

export function latLngToVec3(
  lat: number,
  lng: number,
  radius = GLOBE_RADIUS,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  const latR = (lat * Math.PI) / 180;
  const lngR = (lng * Math.PI) / 180;
  const cosLat = Math.cos(latR);
  return out.set(
    cosLat * Math.sin(lngR) * radius,
    Math.sin(latR) * radius,
    cosLat * Math.cos(lngR) * radius,
  );
}

export function shortestAngleDelta(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

export interface RigTween {
  fromPhi: number;
  toPhi: number;
  fromTheta: number;
  toTheta: number;
  startedAt: number; // performance.now()
  duration: number;
  /** Thread travel: how far the camera pulls back mid-flight (world units).
      0/undefined = an ordinary selection tween. */
  dollyAmp?: number;
}

/**
 * Mutable per-globe state. Created once in Globe3D, mutated from DOM event
 * handlers and useFrame. Components read it inside their own useFrame.
 */
export interface Rig {
  phi: number;
  theta: number;
  paused: boolean;
  tween: RigTween | null;
  /** 0 = normal view, 1 = fully in Mandala View. Eased every frame. */
  mandala: number;
  mandalaTarget: 0 | 1;
  /** performance.now() when the mandala view last engaged (for arc draw-in). */
  mandalaStartedAt: number;
  /** Low-tier devices skip bloom + ripples and thin the dot field. */
  lowTier: boolean;
  /** Honor prefers-reduced-motion: autorotation halts, breathe/pulse fall to
      near-zero, and the ignition opening becomes a quiet crossfade. Set once
      at creation and kept live by a matchMedia listener in Globe3D. */
  reducedMotion: boolean;
  /** Live scene camera, set by GlobeScene: the wrapper picks markers through it. */
  camera: THREE.Camera | null;
  /** Extra camera distance this frame from a thread-travel flight (eased in stepRig). */
  travelDolly: number;
  /** performance.now() when the ignition opening began; 0 = not yet started. */
  introAt: number;
  /** Seconds after introAt when the kinship arcs begin weaving in. */
  introArcDelay: number;
  /** Ring hover: raw pointer state, set every pointermove by the wrapper
      (true when the cursor sits near the hexagram ring band). */
  ringHoverTarget: boolean;
  /** Ring hover: eased 0 to 1 value HexagramRing reads to brighten the band
      on pointer-over, the resting view's discoverability affordance. */
  ringHover: number;
  /** Ignition schedule published by Markers during the opening: node id →
      performance.now() ms when that light ignites. The dream overlay reads it
      so an opening flare fires beside a light on the same beat as its marker.
      Empty until the opening is scheduled; empty in reduced motion. */
  ignition: Map<string, number>;
}

/** Read the visitor's reduced-motion preference. Safe when matchMedia is
    absent (SSR / older engines): defaults to full motion. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

export function createRig(lowTier: boolean): Rig {
  return {
    phi: 0,
    theta: 0.2, // gentle northern tilt, as before
    paused: false,
    tween: null,
    mandala: 0,
    mandalaTarget: 0,
    mandalaStartedAt: 0,
    lowTier,
    reducedMotion: prefersReducedMotion(),
    camera: null,
    travelDolly: 0,
    introAt: 0,
    introArcDelay: 2.4,
    ringHoverTarget: false,
    ringHover: 0,
    ignition: new Map(),
  };
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Advance phi/theta one frame: run the tween, else auto-rotate. */
export function stepRig(rig: Rig, deltaSeconds: number): void {
  const tween = rig.tween;
  if (tween) {
    const t = Math.min(1, (performance.now() - tween.startedAt) / tween.duration);
    const e = easeInOutCubic(t);
    rig.phi = tween.fromPhi + (tween.toPhi - tween.fromPhi) * e;
    rig.theta = tween.fromTheta + (tween.toTheta - tween.fromTheta) * e;
    // Thread travel: the camera lifts off the surface mid-flight and settles
    // back down as it arrives: sin(π·t) is 0 at both ends, peaks midway.
    if (tween.dollyAmp) rig.travelDolly = tween.dollyAmp * Math.sin(Math.PI * t);
    if (t >= 1) rig.tween = null;
  } else if (!rig.paused && !rig.reducedMotion) {
    // Reduced motion holds the world still: no idle drift.
    rig.phi += ROTATION_SPEED * deltaSeconds;
  }
  // Outside a travel tween the dolly eases home.
  if (!tween || !tween.dollyAmp) {
    rig.travelDolly += (0 - rig.travelDolly) * Math.min(1, deltaSeconds * 4);
    if (Math.abs(rig.travelDolly) < 0.001) rig.travelDolly = 0;
  }

  // Ease the mandala blend toward its target with a bounded exponential, so a
  // frame hitch can never overshoot the target (the old k*3.2 factor sprang
  // past 1 on a dropped frame and oscillated).
  const want = rig.mandalaTarget;
  const k = 1 - Math.exp(-Math.max(0, deltaSeconds) * 2);
  rig.mandala += (want - rig.mandala) * k;
  if (Math.abs(rig.mandala - want) < 0.002) rig.mandala = want;

  // Ring hover: the same bounded-exponential ease, snappier so the
  // brighten-on-pointer-over affordance feels responsive.
  const hoverWant = rig.ringHoverTarget ? 1 : 0;
  const hk = 1 - Math.exp(-Math.max(0, deltaSeconds) * 10);
  rig.ringHover += (hoverWant - rig.ringHover) * hk;
  if (Math.abs(rig.ringHover - hoverWant) < 0.002) rig.ringHover = hoverWant;
}

export const RigContext = createContext<Rig | null>(null);

export function useRig(): Rig {
  const rig = useContext(RigContext);
  if (!rig) throw new Error('useRig must be used inside Globe3D');
  return rig;
}

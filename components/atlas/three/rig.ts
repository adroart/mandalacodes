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
 * React context. It is mutated inside useFrame and event handlers — never via
 * React state — so the render loop stays allocation-free.
 */

import { createContext, useContext } from 'react';
import * as THREE from 'three';

export const GLOBE_RADIUS = 1;

/** Camera distance at rest and pulled back for the Mandala View. */
export const CAMERA_NEAR_DIST = 3.4;
export const CAMERA_FAR_DIST = 5.1;

/** Auto-rotation, radians per second (cobe used 0.005/frame ≈ 0.3/s). */
export const ROTATION_SPEED = 0.3;

/** Selection tween duration, ms — matches the cobe globe. */
export const SELECT_ANIM_MS = 800;

/** How long the mandala arcs take to weave themselves in, seconds. */
export const MANDALA_DRAW_SECONDS = 5;

// ─── Palette (normalized RGB, derived from the atlas style notes) ──────────
export const COLOR_BG = new THREE.Color(15 / 255, 13 / 255, 11 / 255);
export const COLOR_LAND = new THREE.Color(0.42, 0.4, 0.36);
export const COLOR_BRONZE = new THREE.Color(0.77, 0.67, 0.49);
export const COLOR_BRONZE_DIM = new THREE.Color(0.55, 0.48, 0.36);
export const COLOR_SAGE = new THREE.Color(0.61, 0.67, 0.53);
export const COLOR_RIM = new THREE.Color(0.32, 0.27, 0.19);

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
  /** Live scene camera, set by GlobeScene — the wrapper picks markers through it. */
  camera: THREE.Camera | null;
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
    camera: null,
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
    if (t >= 1) rig.tween = null;
  } else if (!rig.paused) {
    rig.phi += ROTATION_SPEED * deltaSeconds;
  }

  // Ease the mandala blend toward its target (~1.6s either way).
  const want = rig.mandalaTarget;
  const k = Math.min(1, deltaSeconds / 1.6);
  rig.mandala += (want - rig.mandala) * (k * 3.2);
  if (Math.abs(rig.mandala - want) < 0.002) rig.mandala = want;
}

export const RigContext = createContext<Rig | null>(null);

export function useRig(): Rig {
  const rig = useContext(RigContext);
  if (!rig) throw new Error('useRig must be used inside Globe3D');
  return rig;
}

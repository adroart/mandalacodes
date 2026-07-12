/**
 * Piece markers: one draw call of point sprites with a bright core and a
 * soft halo. Bronze = placed, dim bronze = seeking ground, sage = the
 * visitor's birth place.
 *
 * Markers cross-fade when the filtered set changes: a persistent display
 * list keeps exiting markers around while their alpha eases to zero and
 * fades new ones in, so filter changes read as the globe responding rather
 * than blinking. The list lives in a ref and the geometry attributes are
 * mutated in useFrame: React state never touches the render loop.
 */

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { GlobeNode } from '../Globe';
import {
  COLOR_BRONZE,
  COLOR_BRONZE_DIM,
  COLOR_EMBER,
  COLOR_SAGE,
  GLOBE_RADIUS,
  latLngToVec3,
  useRig,
} from './rig';

const CAPACITY = 1024;
const MARKER_LIFT = 1.012;
const FADE_PER_SECOND = 2.2; // full fade in ~450ms

/* Ignition opening: on first load the lights ignite one by one in claim
   order (Founding Lights), each with a brief flash that settles into the
   marker's resting glow. Later node changes (filters) fade as before. */
const IGNITION_LEAD_S = 0.9;        // stillness before the first light
const IGNITION_MIN_STEP_S = 0.22;   // spacing floor between ignitions
const IGNITION_MAX_STEP_S = 0.55;   // spacing ceiling (few lights = slower, grander)
const IGNITION_SPAN_S = 5.0;        // target length of the whole sequence

const VERT = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aAlpha;
  attribute float aPhase;
  attribute float aSelected;
  attribute float aFlash;
  attribute float aYours;
  attribute float aOwned;
  attribute float aBright;
  attribute float aType;
  attribute float aEmber;
  uniform float uPixelRatio;
  uniform float uTime;
  uniform float uReduceMotion;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSelected;
  varying float vFlash;
  varying float vYours;
  varying float vOwned;
  varying float vBright;
  varying float vType;
  varying float vEmber;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vSelected = aSelected;
    vFlash = aFlash;
    vYours = aYours;
    vOwned = aOwned;
    vBright = aBright;
    vType = aType;
    vEmber = aEmber;
    // The sleeping ember breathes slower and shallower than a lit piece: alive
    // but asleep. Reduced motion flattens either breath to near-stillness.
    float breatheRate = mix(1.8, 0.9, aEmber);
    float breatheAmp = mix(0.10, 0.05, aEmber) * (1.0 - uReduceMotion);
    float pulse = 1.0 + breatheAmp * sin(uTime * breatheRate + aPhase * 6.2831);
    float sel = 1.0 + aSelected * 0.55;
    // Ignition flash: a newborn light blooms half again as large, then settles.
    float flash = 1.0 + aFlash * 1.5;
    // Your own stewarded piece sits a touch larger than its neighbors.
    float own = 1.0 + aOwned * 0.25;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // aBright is the potency scale (a greater fire): folds the size band and,
    // later, price into a continuous warm brightness read partly as size.
    gl_PointSize = aSize * pulse * sel * flash * own * aBright * uPixelRatio * (4.9 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSelected;
  varying float vFlash;
  varying float vYours;
  varying float vOwned;
  varying float vBright;
  varying float vType;
  varying float vEmber;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    if (d > 1.0) discard;
    // Bright core + wide soft halo. The halo carries the glow directly now
    // (no post-process bloom): a brighter core and a fuller, wider falloff so
    // placed pieces still read as luminous on their own.
    float core = smoothstep(0.42, 0.0, d);
    float halo = exp(-d * 1.9) * 0.8;
    // A faint four-point flare: the signature of a mandala light, not clipart.
    // Suppressed on 'other' art types (vType) and on the sleeping ember
    // (vEmber): those read as a clean round core with a soft halo, no flare.
    float ax = abs(c.x) * 2.0;
    float ay = abs(c.y) * 2.0;
    float flare = (smoothstep(0.85, 0.0, ax) * smoothstep(0.14, 0.0, ay)
                 + smoothstep(0.85, 0.0, ay) * smoothstep(0.14, 0.0, ax)) * 0.3;
    flare *= (1.0 - vType) * (1.0 - vEmber);
    // Selected markers carry a thin ring just outside the core; it breathes.
    float ringR = 0.62 + 0.05 * sin(uTime * 1.6);
    float ring = vSelected * smoothstep(0.09, 0.0, abs(d - ringR)) * 0.9;
    // Ignition shockwave: a ring that expands outward as the flash decays.
    float wave = smoothstep(0.10, 0.0, abs(d - (1.0 - vFlash) * 0.9)) * vFlash * 1.2;
    // Your-codes resonance: a slow-breathing sage ring around lights that
    // carry one of the visitor's own codes.
    float yr = 0.78 + 0.05 * sin(uTime * 1.1);
    float yring = vYours * smoothstep(0.07, 0.0, abs(d - yr)) * 0.75;
    // Owned resonance: a steady inner ring and a brighter warm-gold pulse on
    // the pieces the signed-in visitor stewards. Warm earth family only.
    float orr = 0.66 + 0.04 * sin(uTime * 1.4);
    float oring = vOwned * smoothstep(0.08, 0.0, abs(d - orr)) * 0.85;
    float energy = (core * 1.7 + halo + flare + ring + wave + yring + oring) * (1.0 + vFlash * 1.3 + vOwned * 0.25);
    // Potency (a greater fire): the same continuous scale lifts the fragment
    // energy. Applied at 75% of the size swing so dense clusters keep their
    // shape under additive blending instead of stacking to white.
    energy *= mix(1.0, vBright, 0.75);
    vec3 col = mix(vColor, vec3(0.61, 0.67, 0.53), clamp(yring * 1.4, 0.0, 0.8));
    col = mix(col, vec3(0.93, 0.79, 0.51), clamp(vOwned * 0.45, 0.0, 0.45));
    // Toward high potency the fire warms from deep ember to a gold-white
    // heart. Warm family only, never a cold highlight.
    col = mix(col, vec3(1.0, 0.94, 0.80), clamp((vBright - 1.0) * 0.6, 0.0, 0.3));
    gl_FragColor = vec4(col * energy, vAlpha * min(energy, 1.0));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

interface DisplayEntry {
  node: GlobeNode;
  alpha: number;
  target: number; // 1 = visible, 0 = exiting
  /** performance.now() ms when this light is allowed to ignite. Entries born
      during the opening sequence wait their turn; later entrants are 0. */
  bornAt: number;
}

function colorFor(status: GlobeNode['status']): THREE.Color {
  return status === 'origin' ? COLOR_SAGE
    : status === 'seeking' ? COLOR_BRONZE_DIM
    : status === 'unawakened' ? COLOR_EMBER
    : COLOR_BRONZE;
}

function sizeFor(status: GlobeNode['status']): number {
  return status === 'origin' ? 18
    : status === 'seeking' ? 13.5
    : status === 'unawakened' ? 12   // the ember sits smaller than a lit piece
    : 21;
}

/* The sleeping ember reads at low alpha: present but not yet lit. Placed and
   origin lights keep their full presence. */
const EMBER_ALPHA = 0.5;
function alphaScaleFor(status: GlobeNode['status']): number {
  return status === 'unawakened' ? EMBER_ALPHA : 1.0;
}

/* Potency (a greater fire): the size band sets a base brightness and, when a
   sale price lands, a gentle logarithmic modifier folds in so two pieces of
   the same band at different prices read as different depths of fire. Kept
   tight and continuous so it is a warm scale, never a discrete tier or a
   readable number. */
const POTENCY_BY_BAND: Record<NonNullable<GlobeNode['sizeBand']>, number> = {
  small: 0.9,
  medium: 1.05,
  large: 1.25,
};
// Soft midpoint price the fold-in references; the span bounds how far price
// can nudge brightness above or below the band.
const PRICE_SOFT_REF = 5000;
const PRICE_POTENCY_SPAN = 0.12;
// Overall clamp so no single light blows past the tuned bloom headroom.
const BRIGHT_MIN = 0.8;
const BRIGHT_MAX = 1.3;

function brightFor(node: GlobeNode): number {
  let b = node.sizeBand ? POTENCY_BY_BAND[node.sizeBand] : 1.0;
  if (typeof node.price === 'number' && node.price > 0) {
    const nudge = Math.max(-1, Math.min(1, Math.log10(node.price / PRICE_SOFT_REF)));
    b += nudge * PRICE_POTENCY_SPAN;
  }
  return Math.max(BRIGHT_MIN, Math.min(BRIGHT_MAX, b));
}

export interface MarkersProps {
  nodes: GlobeNode[];
  selectedId?: string | null;
  /** Lens focus: when set, lights outside it recede (never vanish). */
  focusSeries?: string | null;
  /** Your-codes lens: recede lights that do not carry the visitor's codes. */
  yoursMode?: boolean;
}

/* Recede, never remove: how far a light dims when a lens excludes it. */
const RECEDE_ALPHA = 0.2;

export default function Markers({ nodes, selectedId, focusSeries, yoursMode }: MarkersProps) {
  const rig = useRig();
  const listRef = useRef<DisplayEntry[]>([]);
  const selectedRef = useRef<string | null>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CAPACITY * 3), 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(CAPACITY * 3), 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(CAPACITY), 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(CAPACITY), 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(new Float32Array(CAPACITY), 1));
    geo.setAttribute('aSelected', new THREE.BufferAttribute(new Float32Array(CAPACITY), 1));
    geo.setAttribute('aFlash', new THREE.BufferAttribute(new Float32Array(CAPACITY), 1));
    geo.setAttribute('aYours', new THREE.BufferAttribute(new Float32Array(CAPACITY), 1));
    geo.setAttribute('aOwned', new THREE.BufferAttribute(new Float32Array(CAPACITY), 1));
    geo.setAttribute('aBright', new THREE.BufferAttribute(new Float32Array(CAPACITY), 1));
    geo.setAttribute('aType', new THREE.BufferAttribute(new Float32Array(CAPACITY), 1));
    geo.setAttribute('aEmber', new THREE.BufferAttribute(new Float32Array(CAPACITY), 1));
    geo.setDrawRange(0, 0);
    // Points have no real bounds; the cloud hugs the unit sphere.
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), GLOBE_RADIUS * 1.1);
    return geo;
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: 1 },
          uReduceMotion: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  // Merge the incoming node set into the display list: keep survivors at
  // their current alpha, fade entrants from 0, mark the rest as exiting.
  // The very first non-empty set schedules the ignition opening instead:
  // claimed lights ignite in Founding Lights order, then the quieter markers.
  useEffect(() => {
    const incoming = new Map(nodes.map((n) => [n.id, n]));
    const next: DisplayEntry[] = [];
    const seen = new Set<string>();
    for (const entry of listRef.current) {
      const live = incoming.get(entry.node.id);
      if (live) {
        // Live ignition seam: a marker already on the globe whose status turns
        // to 'placed' (a piece claimed while the atlas is open) comes to light
        // with the full flash + shockwave rather than a silent swap: its
        // bornAt is reset to now so the ignition path runs. Reduced motion
        // keeps the quiet crossfade (no flash): bornAt is left untouched.
        const becamePlaced =
          entry.node.status !== 'placed' && live.status === 'placed';
        const ignite = becamePlaced && !rig.reducedMotion && rig.introAt !== 0;
        next.push({
          node: live,
          alpha: entry.alpha,
          target: 1,
          bornAt: ignite ? performance.now() : entry.bornAt,
        });
        seen.add(live.id);
      } else if (entry.alpha > 0.01) {
        next.push({ ...entry, target: 0 });
      }
    }

    const isOpening = rig.introAt === 0 && nodes.length > 0;
    if (isOpening) rig.ignition.clear();
    if (isOpening && rig.reducedMotion) {
      // Reduced motion: the opening is a quiet crossfade, not a staggered
      // ignition. Every entrant fades up together (bornAt 0 means no flash and
      // no shockwave), and the kinship arcs weave in just after.
      rig.introAt = performance.now();
      for (const n of nodes) {
        if (!seen.has(n.id)) next.push({ node: n, alpha: 0, target: 1, bornAt: 0 });
      }
      rig.introArcDelay = 1.0;
    } else if (isOpening) {
      rig.introAt = performance.now();
      // Ignition order: claimed lights by ordinal, then placed-without-ordinal,
      // then the faint embers (unawakened), then the visitor's own origin.
      const rank = (n: GlobeNode): number => {
        if (n.status === 'origin') return 3;
        if (n.status === 'unawakened') return 2;
        return typeof n.ordinal === 'number' ? 0 : 1;
      };
      const ordered = nodes
        .filter((n) => !seen.has(n.id))
        .sort((a, b) => rank(a) - rank(b) || (a.ordinal ?? 999) - (b.ordinal ?? 999));
      const step = Math.max(
        IGNITION_MIN_STEP_S,
        Math.min(IGNITION_MAX_STEP_S, IGNITION_SPAN_S / Math.max(1, ordered.length)),
      );
      ordered.forEach((n, i) => {
        const bornAt = rig.introAt + (IGNITION_LEAD_S + i * step) * 1000;
        next.push({ node: n, alpha: 0, target: 1, bornAt });
        // Publish the beat so the dream overlay can flare on the same moment
        // this light ignites.
        rig.ignition.set(n.id, bornAt);
      });
      // The kinship arcs wait for the last light, then weave in.
      rig.introArcDelay = IGNITION_LEAD_S + ordered.length * step + 0.6;
    } else {
      // Past the opening. A brand-new light that arrives already 'placed' (a
      // fresh claim landing on the open globe) ignites with the full flash;
      // everything else fades in quietly. Reduced motion keeps the crossfade.
      const nowMs = performance.now();
      for (const n of nodes) {
        if (seen.has(n.id)) continue;
        const ignite = n.status === 'placed' && !rig.reducedMotion;
        next.push({ node: n, alpha: 0, target: 1, bornAt: ignite ? nowMs : 0 });
      }
    }
    // Recede, never silently truncate: name how many lights fall past capacity
    // so the ceiling is visible in the console rather than a quiet clip.
    if (next.length > CAPACITY) {
      console.warn(
        `[Atlas] Marker capacity ${CAPACITY} exceeded: dropping ${next.length - CAPACITY} of ${next.length} markers.`,
      );
    }
    listRef.current = next.slice(0, CAPACITY);
  }, [nodes, rig]);

  useEffect(() => {
    selectedRef.current = selectedId ?? null;
  }, [selectedId]);

  const scratch = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ gl, clock }, delta) => {
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uPixelRatio.value = gl.getPixelRatio();
    material.uniforms.uReduceMotion.value = rig.reducedMotion ? 1 : 0;

    const list = listRef.current;
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
    const col = geometry.getAttribute('aColor') as THREE.BufferAttribute;
    const size = geometry.getAttribute('aSize') as THREE.BufferAttribute;
    const alpha = geometry.getAttribute('aAlpha') as THREE.BufferAttribute;
    const phase = geometry.getAttribute('aPhase') as THREE.BufferAttribute;
    const sel = geometry.getAttribute('aSelected') as THREE.BufferAttribute;
    const flash = geometry.getAttribute('aFlash') as THREE.BufferAttribute;
    const yours = geometry.getAttribute('aYours') as THREE.BufferAttribute;
    const owned = geometry.getAttribute('aOwned') as THREE.BufferAttribute;
    const bright = geometry.getAttribute('aBright') as THREE.BufferAttribute;
    const typ = geometry.getAttribute('aType') as THREE.BufferAttribute;
    const ember = geometry.getAttribute('aEmber') as THREE.BufferAttribute;

    const now = performance.now();
    const lensActive = !!focusSeries || !!yoursMode;
    let write = 0;
    for (const entry of list) {
      // An unborn light waits in the dark for its turn in the ignition order.
      const ageS = (now - entry.bornAt) / 1000;
      let target = entry.target === 1 && ageS < 0 ? 0 : entry.target;
      // Lens focus: excluded lights recede, they never vanish. The visitor's
      // own origin marker is never receded.
      if (lensActive && target === 1 && entry.node.status !== 'origin') {
        const inSeries = !focusSeries || entry.node.series === focusSeries;
        const inYours = !yoursMode || entry.node.yours === true;
        if (!(inSeries && inYours)) target = RECEDE_ALPHA;
      }
      const step = FADE_PER_SECOND * delta;
      entry.alpha += target > entry.alpha ? Math.min(step, target - entry.alpha)
        : -Math.min(step, entry.alpha - target);
      if (entry.target === 0 && entry.alpha <= 0.01) continue;

      const n = entry.node;
      const isEmber = n.status === 'unawakened';
      latLngToVec3(n.lat, n.lng, GLOBE_RADIUS * MARKER_LIFT, scratch);
      pos.setXYZ(write, scratch.x, scratch.y, scratch.z);
      const c = colorFor(n.status);
      col.setXYZ(write, c.r, c.g, c.b);
      size.setX(write, sizeFor(n.status));
      alpha.setX(write, entry.alpha * alphaScaleFor(n.status));
      phase.setX(write, Math.abs(Math.sin(n.lat * 12.9898 + n.lng * 78.233)) % 1);
      sel.setX(write, n.id === selectedRef.current ? 1 : 0);
      // Ignition flash: bright at birth, gone in about two seconds. The
      // sleeping ember never flashes: it glows into being quietly, no bloom
      // and no shockwave.
      flash.setX(write, !isEmber && entry.bornAt > 0 && ageS >= 0 ? Math.exp(-ageS * 2.2) : 0);
      yours.setX(write, yoursMode && n.yours ? 1 : 0);
      owned.setX(write, n.owned ? 1 : 0);
      bright.setX(write, brightFor(n));
      typ.setX(write, n.pieceType === 'other' ? 1 : 0);
      ember.setX(write, isEmber ? 1 : 0);
      write++;
    }
    // Prune fully exited entries occasionally.
    if (list.some((e) => e.target === 0 && e.alpha <= 0.01)) {
      listRef.current = list.filter((e) => !(e.target === 0 && e.alpha <= 0.01));
    }

    geometry.setDrawRange(0, write);
    pos.needsUpdate = true;
    col.needsUpdate = true;
    size.needsUpdate = true;
    alpha.needsUpdate = true;
    phase.needsUpdate = true;
    sel.needsUpdate = true;
    flash.needsUpdate = true;
    yours.needsUpdate = true;
    owned.needsUpdate = true;
    bright.needsUpdate = true;
    typ.needsUpdate = true;
    ember.needsUpdate = true;
  });

  return <points geometry={geometry} material={material} renderOrder={3} />;
}

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
  COLOR_SAGE,
  GLOBE_RADIUS,
  latLngToVec3,
  useRig,
} from './rig';

const CAPACITY = 256;
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
  uniform float uPixelRatio;
  uniform float uTime;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSelected;
  varying float vFlash;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vSelected = aSelected;
    vFlash = aFlash;
    float pulse = 1.0 + 0.10 * sin(uTime * 1.8 + aPhase * 6.2831);
    float sel = 1.0 + aSelected * 0.55;
    // Ignition flash: a newborn light blooms half again as large, then settles.
    float flash = 1.0 + aFlash * 1.5;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * pulse * sel * flash * uPixelRatio * (4.9 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vSelected;
  varying float vFlash;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    if (d > 1.0) discard;
    // Bright core + wide soft halo. The halo carries the glow directly now
    // (no post-process bloom): a brighter core and a fuller, wider falloff so
    // placed pieces still read as luminous on their own.
    float core = smoothstep(0.42, 0.0, d);
    float halo = exp(-d * 1.9) * 0.8;
    // A faint four-point flare: the signature of a light, not clipart.
    float ax = abs(c.x) * 2.0;
    float ay = abs(c.y) * 2.0;
    float flare = (smoothstep(0.85, 0.0, ax) * smoothstep(0.14, 0.0, ay)
                 + smoothstep(0.85, 0.0, ay) * smoothstep(0.14, 0.0, ax)) * 0.3;
    // Selected markers carry a thin ring just outside the core; it breathes.
    float ringR = 0.62 + 0.05 * sin(uTime * 1.6);
    float ring = vSelected * smoothstep(0.09, 0.0, abs(d - ringR)) * 0.9;
    // Ignition shockwave: a ring that expands outward as the flash decays.
    float wave = smoothstep(0.10, 0.0, abs(d - (1.0 - vFlash) * 0.9)) * vFlash * 1.2;
    float energy = (core * 1.7 + halo + flare + ring + wave) * (1.0 + vFlash * 1.3);
    gl_FragColor = vec4(vColor * energy, vAlpha * min(energy, 1.0));
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
  return status === 'origin' ? COLOR_SAGE : status === 'seeking' ? COLOR_BRONZE_DIM : COLOR_BRONZE;
}

function sizeFor(status: GlobeNode['status']): number {
  return status === 'origin' ? 18 : status === 'seeking' ? 13.5 : 21;
}

export interface MarkersProps {
  nodes: GlobeNode[];
  selectedId?: string | null;
}

export default function Markers({ nodes, selectedId }: MarkersProps) {
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
        uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
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
        next.push({ node: live, alpha: entry.alpha, target: 1, bornAt: entry.bornAt });
        seen.add(live.id);
      } else if (entry.alpha > 0.01) {
        next.push({ ...entry, target: 0 });
      }
    }

    const isOpening = rig.introAt === 0 && nodes.length > 0;
    if (isOpening) {
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
        next.push({
          node: n,
          alpha: 0,
          target: 1,
          bornAt: rig.introAt + (IGNITION_LEAD_S + i * step) * 1000,
        });
      });
      // The kinship arcs wait for the last light, then weave in.
      rig.introArcDelay = IGNITION_LEAD_S + ordered.length * step + 0.6;
    } else {
      for (const n of nodes) {
        if (!seen.has(n.id)) next.push({ node: n, alpha: 0, target: 1, bornAt: 0 });
      }
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

    const list = listRef.current;
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
    const col = geometry.getAttribute('aColor') as THREE.BufferAttribute;
    const size = geometry.getAttribute('aSize') as THREE.BufferAttribute;
    const alpha = geometry.getAttribute('aAlpha') as THREE.BufferAttribute;
    const phase = geometry.getAttribute('aPhase') as THREE.BufferAttribute;
    const sel = geometry.getAttribute('aSelected') as THREE.BufferAttribute;
    const flash = geometry.getAttribute('aFlash') as THREE.BufferAttribute;

    const now = performance.now();
    let write = 0;
    for (const entry of list) {
      // An unborn light waits in the dark for its turn in the ignition order.
      const ageS = (now - entry.bornAt) / 1000;
      const target = entry.target === 1 && ageS < 0 ? 0 : entry.target;
      const step = FADE_PER_SECOND * delta;
      entry.alpha += target > entry.alpha ? Math.min(step, target - entry.alpha)
        : -Math.min(step, entry.alpha - target);
      if (entry.target === 0 && entry.alpha <= 0.01) continue;

      const n = entry.node;
      latLngToVec3(n.lat, n.lng, GLOBE_RADIUS * MARKER_LIFT, scratch);
      pos.setXYZ(write, scratch.x, scratch.y, scratch.z);
      const c = colorFor(n.status);
      col.setXYZ(write, c.r, c.g, c.b);
      size.setX(write, sizeFor(n.status));
      alpha.setX(write, entry.alpha);
      phase.setX(write, Math.abs(Math.sin(n.lat * 12.9898 + n.lng * 78.233)) % 1);
      sel.setX(write, n.id === selectedRef.current ? 1 : 0);
      // Ignition flash: bright at birth, gone in about two seconds.
      flash.setX(write, entry.bornAt > 0 && ageS >= 0 ? Math.exp(-ageS * 2.2) : 0);
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
  });

  return <points geometry={geometry} material={material} renderOrder={3} />;
}

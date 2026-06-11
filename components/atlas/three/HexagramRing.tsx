/**
 * The Hexagram Ring — a faint armillary band around the globe carrying the
 * 64 hexagrams in the King Wen circle, each drawn as its six lines (yang
 * solid, yin broken). Placed hexagrams sit brighter and send a hair-thin
 * thread from their glyph down to the city where the piece rests; unplaced
 * hexagrams wait dim on the ring.
 *
 * Lives inside the spin group, so glyphs and threads rotate with the globe
 * and the geometry is fully static — one merged LineSegments draw call,
 * rebuilt only when a placement changes.
 */

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { CARD_BY_NUMBER } from '../../../data/oracleData';
import { COLOR_BRONZE, GLOBE_RADIUS, latLngToVec3, useRig } from './rig';

const RING_RADIUS = GLOBE_RADIUS * 1.52;
const BAR_HALF = 0.024; // half-width of a hexagram line
const LINE_GAP = 0.0135; // vertical spacing between the six lines
const YIN_GAP = 0.0065; // half-width of the break in a yin line

// Trigram symbol → lines bottom-to-top, 1 = yang (solid), 0 = yin (broken).
const TRIGRAM_LINES: Record<string, [number, number, number]> = {
  '☰': [1, 1, 1], // Heaven
  '☱': [1, 1, 0], // Lake
  '☲': [1, 0, 1], // Fire
  '☳': [1, 0, 0], // Thunder
  '☴': [0, 1, 1], // Wind
  '☵': [0, 1, 0], // Water
  '☶': [0, 0, 1], // Mountain
  '☷': [0, 0, 0], // Earth
};

/** Six lines bottom-to-top for a hexagram, from its trigram symbols. */
function hexagramLines(num: number): number[] | null {
  const card = CARD_BY_NUMBER.get(num);
  if (!card) return null;
  const lower = TRIGRAM_LINES[card.iching.lower_trigram.symbol];
  const upper = TRIGRAM_LINES[card.iching.upper_trigram.symbol];
  if (!lower || !upper) return null;
  return [...lower, ...upper];
}

const VERT = /* glsl */ `
  attribute float aAlpha;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uMandala;
  varying float vAlpha;
  void main() {
    float alpha = vAlpha * (0.75 + uMandala * 0.9);
    if (alpha <= 0.004) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

export interface HexagramRingProps {
  /** First placed location per hexagram number (1–64). */
  placedByCard: ReadonlyMap<number, { lat: number; lng: number }>;
}

export default function HexagramRing({ placedByCard }: HexagramRingProps) {
  const rig = useRig();

  const geometry = useMemo(() => {
    const positions: number[] = [];
    const alphas: number[] = [];
    const push = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, alpha: number) => {
      positions.push(ax, ay, az, bx, by, bz);
      alphas.push(alpha, alpha);
    };

    // The band itself: a dim circle in the equatorial plane.
    const RING_STEPS = 192;
    for (let i = 0; i < RING_STEPS; i++) {
      const a0 = (i / RING_STEPS) * Math.PI * 2;
      const a1 = ((i + 1) / RING_STEPS) * Math.PI * 2;
      push(
        Math.sin(a0) * RING_RADIUS, 0, Math.cos(a0) * RING_RADIUS,
        Math.sin(a1) * RING_RADIUS, 0, Math.cos(a1) * RING_RADIUS,
        0.05,
      );
    }

    const city = new THREE.Vector3();
    for (let n = 1; n <= 64; n++) {
      const lines = hexagramLines(n);
      if (!lines) continue;
      const theta = ((n - 1) / 64) * Math.PI * 2;
      const sx = Math.sin(theta);
      const cz = Math.cos(theta);
      const px = sx * RING_RADIUS;
      const pz = cz * RING_RADIUS;
      // Tangent direction (ŷ × r̂) — the glyph's horizontal axis.
      const tx = cz;
      const tz = -sx;
      const placed = placedByCard.get(n);
      const glyphAlpha = placed ? 0.5 : 0.14;

      for (let li = 0; li < 6; li++) {
        const y = (li - 2.5) * LINE_GAP;
        if (lines[li] === 1) {
          push(
            px - tx * BAR_HALF, y, pz - tz * BAR_HALF,
            px + tx * BAR_HALF, y, pz + tz * BAR_HALF,
            glyphAlpha,
          );
        } else {
          push(
            px - tx * BAR_HALF, y, pz - tz * BAR_HALF,
            px - tx * YIN_GAP, y, pz - tz * YIN_GAP,
            glyphAlpha,
          );
          push(
            px + tx * YIN_GAP, y, pz + tz * YIN_GAP,
            px + tx * BAR_HALF, y, pz + tz * BAR_HALF,
            glyphAlpha,
          );
        }
      }

      // Thread from the glyph down to the city where the piece rests.
      if (placed) {
        latLngToVec3(placed.lat, placed.lng, GLOBE_RADIUS * 1.002, city);
        push(city.x, city.y, city.z, px, (-2.5 - 1) * LINE_GAP, pz, 0.09);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(alphas), 1));
    return geo;
  }, [placedByCard]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uColor: { value: COLOR_BRONZE.clone() },
          uMandala: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame(() => {
    material.uniforms.uMandala.value = rig.mandala;
  });

  return <lineSegments geometry={geometry} material={material} renderOrder={4} />;
}

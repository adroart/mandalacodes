/**
 * Kinship arcs in true 3D: replaces the SVG overlay's per-frame projection
 * mirroring. Each pair becomes a quadratic Bézier lifted off the surface;
 * because the arcs live inside the spin group they rotate with the globe and
 * are occluded by the sphere for free.
 *
 * One merged LineSegments draw call. Per-vertex attributes carry the arc
 * parameter (aT), a per-arc stagger (aStagger) for the mandala draw-in and
 * the traveling pulse, and a highlight flag (aHighlight) rewritten only when
 * the selection changes.
 */

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { KinshipIndex } from '../../../utils/kinship';
import { COLOR_BRONZE, GLOBE_RADIUS, latLngToVec3, MANDALA_DRAW_SECONDS, useRig } from './rig';

const SAMPLES = 36; // points per arc → SAMPLES-1 segments

const VERT = /* glsl */ `
  attribute float aT;
  attribute float aStagger;
  attribute float aHighlight;
  varying float vT;
  varying float vStagger;
  varying float vHighlight;
  void main() {
    vT = aT;
    vStagger = aStagger;
    vHighlight = aHighlight;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uOpacity;    // global visibility (kinship toggle), eased
  uniform float uDraw;       // draw-in progress; >1.4 means fully drawn
  uniform float uSelMode;    // 1 when a piece is selected
  uniform float uMandala;    // mandala view blend 0..1
  varying float vT;
  varying float vStagger;
  varying float vHighlight;

  void main() {
    // Mandala draw-in: each arc begins once the sweep passes its stagger and
    // then draws tip-to-tail.
    float reveal = smoothstep(0.0, 0.35, uDraw - vStagger * 0.85 - vT * 0.5);
    if (reveal <= 0.001) discard;

    // Base presence: quiet by default, fuller in the mandala view.
    float base = mix(0.14, 0.34, uMandala);

    // Traveling pulse of light along the arc.
    float head = fract(uTime * 0.06 + vStagger);
    float pulse = smoothstep(0.10, 0.0, abs(vT - head)) * 0.5;

    // Selection: kin arcs brighten, the rest recede.
    float selBoost = vHighlight * (0.55 + 0.25 * sin(uTime * 2.2));
    float selFade = uSelMode * (1.0 - vHighlight) * 0.75;

    float alpha = (base + pulse + selBoost) * (1.0 - selFade) * reveal * uOpacity;
    if (alpha <= 0.004) discard;
    vec3 col = uColor * (1.0 + vHighlight * 0.5 + pulse * 0.8);
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export interface KinshipArcsProps {
  index: KinshipIndex;
  selectedId?: string | null;
  visible: boolean;
}

export default function KinshipArcs({ index, selectedId, visible }: KinshipArcsProps) {
  const rig = useRig();

  const { geometry, pairKeys } = useMemo(() => {
    const pairs = index.pairs;
    const segVerts = (SAMPLES - 1) * 2;
    const positions = new Float32Array(pairs.length * segVerts * 3);
    const ts = new Float32Array(pairs.length * segVerts);
    const staggers = new Float32Array(pairs.length * segVerts);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const ctrl = new THREE.Vector3();
    const p0 = new THREE.Vector3();
    const p1 = new THREE.Vector3();
    const keys: Array<[string, string]> = [];

    let v = 0;
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      const na = index.nodes.get(pair.aKey);
      const nb = index.nodes.get(pair.bKey);
      if (!na || !nb) continue;
      keys.push([pair.aKey, pair.bKey]);
      latLngToVec3(na.lat, na.lng, GLOBE_RADIUS, a);
      latLngToVec3(nb.lat, nb.lng, GLOBE_RADIUS, b);
      // Control point above the midpoint; long arcs bow higher.
      const lift = 1 + Math.min(0.42, 0.08 + pair.distance * 0.22);
      ctrl.addVectors(a, b).normalize().multiplyScalar(GLOBE_RADIUS * lift);
      // Deterministic per-arc stagger from the pair's geometry.
      const stagger = Math.abs(Math.sin(na.lat * 3.7 + nb.lng * 1.9 + i)) % 1;

      const sample = (t: number, out: THREE.Vector3) => {
        const s = 1 - t;
        out.set(
          s * s * a.x + 2 * s * t * ctrl.x + t * t * b.x,
          s * s * a.y + 2 * s * t * ctrl.y + t * t * b.y,
          s * s * a.z + 2 * s * t * ctrl.z + t * t * b.z,
        );
      };

      for (let sIdx = 0; sIdx < SAMPLES - 1; sIdx++) {
        const t0 = sIdx / (SAMPLES - 1);
        const t1 = (sIdx + 1) / (SAMPLES - 1);
        sample(t0, p0);
        sample(t1, p1);
        positions.set([p0.x, p0.y, p0.z], v * 3);
        ts[v] = t0;
        staggers[v] = stagger;
        v++;
        positions.set([p1.x, p1.y, p1.z], v * 3);
        ts[v] = t1;
        staggers[v] = stagger;
        v++;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aT', new THREE.BufferAttribute(ts, 1));
    geo.setAttribute('aStagger', new THREE.BufferAttribute(staggers, 1));
    geo.setAttribute('aHighlight', new THREE.BufferAttribute(new Float32Array(ts.length), 1));
    geo.setDrawRange(0, v);
    return { geometry: geo, pairKeys: keys };
  }, [index]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uColor: { value: COLOR_BRONZE.clone() },
          uTime: { value: 0 },
          uOpacity: { value: 0 },
          uDraw: { value: 2 },
          uSelMode: { value: 0 },
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

  // Rewrite the highlight attribute only when the selection changes.
  useEffect(() => {
    const attr = geometry.getAttribute('aHighlight') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const segVerts = (SAMPLES - 1) * 2;
    for (let i = 0; i < pairKeys.length; i++) {
      const [aKey, bKey] = pairKeys[i];
      const hit = selectedId != null && (aKey === selectedId || bKey === selectedId) ? 1 : 0;
      arr.fill(hit, i * segVerts, (i + 1) * segVerts);
    }
    attr.needsUpdate = true;
    material.uniforms.uSelMode.value = selectedId != null && pairKeys.length > 0 ? 1 : 0;
  }, [geometry, material, pairKeys, selectedId]);

  useFrame(({ clock }, delta) => {
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uMandala.value = rig.mandala;

    // Ease global opacity toward the toggle state.
    const target = visible || rig.mandala > 0.02 ? 1 : 0;
    const cur = material.uniforms.uOpacity.value as number;
    material.uniforms.uOpacity.value = cur + (target - cur) * Math.min(1, delta * 4);

    // Mandala draw-in: sweep from 0 once the view engages. Otherwise the arcs
    // hold back through the ignition opening, then weave themselves in once
    // the last light has come up.
    if (rig.mandalaTarget === 1) {
      const since = (performance.now() - rig.mandalaStartedAt) / 1000;
      material.uniforms.uDraw.value = Math.min(2, (since / MANDALA_DRAW_SECONDS) * 1.9);
    } else if (rig.introAt > 0) {
      const since = (performance.now() - rig.introAt) / 1000 - rig.introArcDelay;
      material.uniforms.uDraw.value = Math.max(0, Math.min(2, (since / 3.2) * 2));
    } else {
      material.uniforms.uDraw.value = 0;
    }
  });

  return <lineSegments geometry={geometry} material={material} renderOrder={4} />;
}

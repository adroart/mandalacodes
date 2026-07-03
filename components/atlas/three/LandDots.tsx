/**
 * The continents, as a field of ~10–13k points sampled on land (precomputed
 * by scripts/generate-land-dots.ts). One draw call. The sphere mesh handles
 * occlusion: dots sit just above the surface with depth testing on, so the
 * back hemisphere hides itself.
 *
 * Brightness carries the same ~3.5s breathing cycle the cobe globe had, plus
 * a tiny per-dot shimmer so the field reads as alive rather than printed.
 */

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { loadLandDots } from '../../../lib/atlas/landDots';
import { COLOR_LAND, GLOBE_RADIUS, latLngToVec3, useRig } from './rig';

const SURFACE_LIFT = 1.004;

const VERT = /* glsl */ `
  attribute float aPhase;
  uniform float uPixelRatio;
  uniform float uSize;
  varying float vPhase;
  void main() {
    vPhase = aPhase;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * uPixelRatio * (4.9 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uBreath;   // 0..1 breathing envelope
  uniform float uDim;      // mandala-view dimming, 0..1
  varying float vPhase;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    if (d > 1.0) discard;
    float core = smoothstep(1.0, 0.35, d);
    float shimmer = 0.88 + 0.12 * sin(uTime * 0.8 + vPhase * 6.2831);
    float brightness = (0.72 + 0.28 * uBreath) * shimmer * (1.0 - uDim * 0.45);
    gl_FragColor = vec4(uColor * brightness, core * 0.85);
  }
`;

export default function LandDots() {
  const rig = useRig();
  const [dots, setDots] = useState<Float32Array | null>(null);

  useEffect(() => {
    let active = true;
    loadLandDots()
      .then((d) => active && setDots(d))
      .catch(() => {
        /* Dotless globe still renders sphere + markers; fallback handled upstream. */
      });
    return () => {
      active = false;
    };
  }, []);

  const geometry = useMemo(() => {
    if (!dots) return null;
    // Low-tier devices take every other dot — half the fill cost, same shape.
    const stride = rig.lowTier ? 2 : 1;
    const count = Math.floor(dots.length / 2 / stride);
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const j = i * stride * 2;
      latLngToVec3(dots[j], dots[j + 1], GLOBE_RADIUS * SURFACE_LIFT, v);
      positions[i * 3] = v.x;
      positions[i * 3 + 1] = v.y;
      positions[i * 3 + 2] = v.z;
      // Stable pseudo-random phase from the coordinates.
      phases[i] = Math.abs(Math.sin(dots[j] * 12.9898 + dots[j + 1] * 78.233)) % 1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    return geo;
  }, [dots, rig.lowTier]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uColor: { value: COLOR_LAND.clone() },
          uTime: { value: 0 },
          uBreath: { value: 0.5 },
          uDim: { value: 0 },
          uPixelRatio: { value: 1 },
          uSize: { value: 2.5 },
        },
        transparent: true,
        depthWrite: false,
        depthTest: true,
      }),
    [],
  );

  useEffect(() => () => {
    geometry?.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame(({ gl, clock }) => {
    const t = clock.elapsedTime;
    material.uniforms.uTime.value = t;
    material.uniforms.uBreath.value = 0.5 + 0.5 * Math.sin((t * Math.PI * 2) / 3.5);
    material.uniforms.uDim.value = rig.mandala;
    material.uniforms.uPixelRatio.value = gl.getPixelRatio();
  });

  if (!geometry) return null;
  return <points geometry={geometry} material={material} renderOrder={2} />;
}

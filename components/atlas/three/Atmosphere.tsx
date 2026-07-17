/**
 * The fine-instrument rim (build-order item 3): the atmosphere adjusted to the
 * ratified mockup. A soft warm-gold halo at the limb, a crisp bronze rim right
 * at the sphere's edge, and a second hairline ring just outside it — the
 * fine-instrument double border of an engraved chart.
 *
 * Rendered on the back faces of a slightly larger sphere with additive
 * blending, so it never occludes the surface. Two fresnel terms in one shader:
 * a wide soft halo (low power) and a tight crisp ring (high power); a second
 * mesh a hair larger carries the outer hairline ring.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { COAST_GOLD, COLOR_RIM, GLOBE_RADIUS } from './rig';

const VERT = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

// The halo shell: a wide soft glow plus a crisp bright rim right at the limb.
const HALO_FRAG = /* glsl */ `
  uniform vec3 uHalo;
  uniform vec3 uRim;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  void main() {
    float facing = dot(normalize(-vWorldNormal), normalize(vViewDir));
    facing = clamp(facing, 0.0, 1.0);
    // Wide soft halo.
    float halo = pow(facing, 6.0);
    // Crisp rim: a tight bright band hugging the sphere's edge.
    float rim = pow(facing, 46.0);
    vec3 col = uHalo * halo * 0.6 + uRim * rim * 1.05;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// The outer hairline ring: a single thin fresnel band a touch further out.
const RING_FRAG = /* glsl */ `
  uniform vec3 uRim;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  void main() {
    float facing = clamp(dot(normalize(-vWorldNormal), normalize(vViewDir)), 0.0, 1.0);
    // A band that peaks in a thin ring rather than filling the disc.
    float ring = smoothstep(0.0, 0.05, facing) * (1.0 - smoothstep(0.05, 0.18, facing));
    gl_FragColor = vec4(uRim * ring * 0.7, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export default function Atmosphere() {
  const haloMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: HALO_FRAG,
        uniforms: {
          uHalo: { value: COLOR_RIM.clone().multiplyScalar(1.5) },
          uRim: { value: COAST_GOLD.clone().multiplyScalar(0.55) },
        },
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );
  const ringMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: RING_FRAG,
        uniforms: { uRim: { value: COAST_GOLD.clone().multiplyScalar(0.42) } },
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );
  useEffect(
    () => () => {
      haloMat.dispose();
      ringMat.dispose();
    },
    [haloMat, ringMat],
  );

  return (
    <>
      <mesh material={haloMat} renderOrder={1} scale={1.1}>
        <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
      </mesh>
      {/* The second hairline, the fine-instrument border, sits just outside the
          rim (about R+16px in screen space at the resting camera distance). */}
      <mesh material={ringMat} renderOrder={1} scale={1.05}>
        <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
      </mesh>
    </>
  );
}

/**
 * A very quiet field of distant points behind the globe — depth, not
 * spectacle. Sits outside the rotation groups; drifts almost imperceptibly.
 */

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useRig } from './rig';

const STAR_COUNT = 950;
const SHELL_RADIUS = 28;

export default function Starfield() {
  const rig = useRig();
  const pointsRef = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const positions = new Float32Array(STAR_COUNT * 3);
    const sizes = new Float32Array(STAR_COUNT);
    const phases = new Float32Array(STAR_COUNT);
    const warmths = new Float32Array(STAR_COUNT);
    // Deterministic scatter so the sky doesn't reshuffle between mounts.
    let seed = 7;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < STAR_COUNT; i++) {
      const u = rand() * 2 - 1; // cos(polar)
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      positions[i * 3] = r * Math.cos(a) * SHELL_RADIUS;
      positions[i * 3 + 1] = u * SHELL_RADIUS;
      positions[i * 3 + 2] = r * Math.sin(a) * SHELL_RADIUS;
      sizes[i] = 0.5 + rand();
      phases[i] = rand();
      // A scatter of warmer stars: the sky carries the bronze of the work.
      warmths[i] = rand() < 0.22 ? 1 : 0;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aWarmth', new THREE.BufferAttribute(warmths, 1));
    return geo;
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          attribute float aSize;
          attribute float aPhase;
          attribute float aWarmth;
          uniform float uPixelRatio;
          uniform float uTime;
          varying float vTwinkle;
          varying float vWarmth;
          void main() {
            // Slow, uneven twinkle: each star breathes on its own clock.
            vTwinkle = 0.65 + 0.35 * sin(uTime * (0.4 + aPhase * 0.7) + aPhase * 6.2831);
            vWarmth = aWarmth;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aSize * 2.2 * uPixelRatio;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          varying float vTwinkle;
          varying float vWarmth;
          void main() {
            vec2 c = gl_PointCoord - 0.5;
            float d = length(c) * 2.0;
            float a = smoothstep(1.0, 0.2, d);
            vec3 silver = vec3(0.42, 0.40, 0.36) * 0.62;
            vec3 bronze = vec3(0.77, 0.67, 0.49) * 0.55;
            vec3 col = mix(silver, bronze, vWarmth);
            gl_FragColor = vec4(col, a * 0.5 * vTwinkle);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `,
        uniforms: { uPixelRatio: { value: 1 }, uTime: { value: 0 } },
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

  useFrame(({ gl, clock }, delta) => {
    material.uniforms.uPixelRatio.value = gl.getPixelRatio();
    // Reduced motion holds the twinkle at its steady midpoint (uTime frozen)
    // and stops the shell drift: a quiet, still sky.
    if (rig.reducedMotion) return;
    material.uniforms.uTime.value = clock.elapsedTime;
    if (pointsRef.current) pointsRef.current.rotation.y += delta * 0.004;
  });

  return <points ref={pointsRef} geometry={geometry} material={material} renderOrder={-1} />;
}

/**
 * A very quiet field of distant points behind the globe — depth, not
 * spectacle. Sits outside the rotation groups; drifts almost imperceptibly.
 */

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

const STAR_COUNT = 700;
const SHELL_RADIUS = 28;

export default function Starfield() {
  const pointsRef = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const positions = new Float32Array(STAR_COUNT * 3);
    const sizes = new Float32Array(STAR_COUNT);
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
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    return geo;
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          attribute float aSize;
          uniform float uPixelRatio;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aSize * 1.6 * uPixelRatio;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          void main() {
            vec2 c = gl_PointCoord - 0.5;
            float d = length(c) * 2.0;
            float a = smoothstep(1.0, 0.2, d);
            gl_FragColor = vec4(vec3(0.42, 0.40, 0.36) * 0.55, a * 0.35);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }
        `,
        uniforms: { uPixelRatio: { value: 1 } },
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

  useFrame(({ gl }, delta) => {
    material.uniforms.uPixelRatio.value = gl.getPixelRatio();
    if (pointsRef.current) pointsRef.current.rotation.y += delta * 0.004;
  });

  return <points ref={pointsRef} geometry={geometry} material={material} renderOrder={-1} />;
}

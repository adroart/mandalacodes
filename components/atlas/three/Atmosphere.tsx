/**
 * Fresnel glow shell — the soft halo at the limb that gives the sphere its
 * physical presence. Rendered on the back faces of a slightly larger sphere
 * with additive blending, so it never occludes the surface.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { COLOR_RIM, GLOBE_RADIUS } from './rig';

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

const FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying vec3 vWorldNormal;
  varying vec3 vViewDir;
  void main() {
    // Back faces: the normal points away from the camera, so flip it. The glow
    // peaks just off the limb and falls away outward.
    float facing = dot(normalize(-vWorldNormal), normalize(vViewDir));
    float glow = pow(clamp(facing, 0.0, 1.0), 3.2);
    gl_FragColor = vec4(uColor * glow * 1.6, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export default function Atmosphere() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: { uColor: { value: COLOR_RIM.clone().multiplyScalar(1.5) } },
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh material={material} renderOrder={1} scale={1.22}>
      <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
    </mesh>
  );
}

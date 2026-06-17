/**
 * Scene assembly: nested tilt/spin groups (see rig.ts for the convention),
 * the per-frame rig step, the mandala camera dolly, and post-processing.
 */

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { KinshipIndex } from '../../../utils/kinship';
import type { GlobeNode } from '../Globe';
import Atmosphere from './Atmosphere';
import GlobeSphere from './GlobeSphere';
import HexagramRing from './HexagramRing';
import KinshipArcs from './KinshipArcs';
import LandDots from './LandDots';
import Markers from './Markers';
import Starfield from './Starfield';
import { CAMERA_FAR_DIST, CAMERA_NEAR_DIST, easeInOutCubic, stepRig, useRig } from './rig';

export interface GlobeSceneProps {
  nodes: GlobeNode[];
  selectedId?: string | null;
  kinship?: KinshipIndex | null;
  kinshipVisible: boolean;
  placedByCard: ReadonlyMap<number, { lat: number; lng: number }>;
}

export default function GlobeScene({
  nodes,
  selectedId,
  kinship,
  kinshipVisible,
  placedByCard,
}: GlobeSceneProps) {
  const rig = useRig();
  const tiltRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);

  // The wrapper's click handler projects markers through the live camera;
  // the rig is the shared mutable channel between scene and wrapper.
  useEffect(() => {
    rig.camera = camera;
  }, [camera, rig]);

  const rippleSources = nodes
    .filter((n) => n.status === 'placed')
    .map((n) => [n.lat, n.lng] as const);

  // Priority -1: commit the rig step (rotation, camera dolly) before any child
  // shader subscriber reads it, so uniforms and transforms never lag a frame.
  useFrame((_, delta) => {
    stepRig(rig, Math.min(delta, 0.1));
    if (spinRef.current) spinRef.current.rotation.y = -rig.phi;
    if (tiltRef.current) tiltRef.current.rotation.x = rig.theta;
    // Mandala view pulls the camera back to show the whole weave.
    const e = easeInOutCubic(rig.mandala);
    camera.position.z = CAMERA_NEAR_DIST + (CAMERA_FAR_DIST - CAMERA_NEAR_DIST) * e;
  }, -1);

  return (
    <>
      <color attach="background" args={[15 / 255, 13 / 255, 11 / 255]} />
      <Starfield />
      <group ref={tiltRef}>
        <group ref={spinRef}>
          <GlobeSphere rippleSources={rippleSources} />
          <LandDots />
          <Markers nodes={nodes} selectedId={selectedId} />
          {kinship && kinship.pairs.length > 0 && (
            <KinshipArcs index={kinship} selectedId={selectedId} visible={kinshipVisible} />
          )}
          <HexagramRing placedByCard={placedByCard} />
        </group>
      </group>
      <Atmosphere />
    </>
  );
}

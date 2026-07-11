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
  /** The selected marker (a city cluster id): drives the marker highlight. */
  selectedId?: string | null;
  /** The selected piece key: drives the kinship-arc highlight, which keys off
      per-piece node keys, not cluster ids. Usually equals selectedId, but for
      a multi-piece city the cluster id and the chosen piece key differ. */
  kinSelectedId?: string | null;
  kinship?: KinshipIndex | null;
  kinshipVisible: boolean;
  placedByCard: ReadonlyMap<number, { lat: number; lng: number }>;
  /** Lens focus: lights outside this series recede. */
  focusSeries?: string | null;
  /** Your-codes lens: lights without the visitor's codes recede. */
  yoursMode?: boolean;
}

export default function GlobeScene({
  nodes,
  selectedId,
  kinSelectedId,
  kinship,
  kinshipVisible,
  placedByCard,
  focusSeries,
  yoursMode,
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
    // Mandala view pulls the camera back until the whole weave and the full
    // hexagram ring fit the frame: narrow viewports push further back. A
    // thread-travel flight adds its own mid-flight lift on top.
    const persp = camera as THREE.PerspectiveCamera;
    const halfV = (persp.fov * Math.PI) / 360;
    const halfMin = Math.min(halfV, Math.atan(Math.tan(halfV) * (persp.aspect || 1)));
    const ringFit = 1.58 / Math.tan(halfMin) + 0.4;
    const farDist = Math.max(CAMERA_FAR_DIST, ringFit);
    // Resting distance: on wide screens the tuned CAMERA_NEAR_DIST stands
    // (sphere fills ~88% of the height). On narrow portrait phones that
    // distance crops the sphere into a wall of dots, so pull back until the
    // whole sphere fits the visible viewport with breathing room. The canvas
    // overhangs the wrapper by 28% (inset -14%), so the on-screen slice sees
    // only tan(half)/1.28 of the camera's half-angle; a sphere of radius r at
    // distance d subtends asin(r/d), hence d = r / sin(visible half-angle).
    const visibleHalf = Math.atan(Math.tan(halfMin) / 1.28);
    const sphereFit = 1.12 / Math.sin(visibleHalf); // r 1.12: sphere + glow margin
    const nearDist = Math.max(CAMERA_NEAR_DIST, sphereFit);
    const e = easeInOutCubic(rig.mandala);
    camera.position.z =
      nearDist + (Math.max(farDist, nearDist) - nearDist) * e + rig.travelDolly;
  }, -1);

  return (
    <>
      <color attach="background" args={[15 / 255, 13 / 255, 11 / 255]} />
      <Starfield />
      <group ref={tiltRef}>
        <group ref={spinRef}>
          <GlobeSphere rippleSources={rippleSources} />
          <LandDots />
          <Markers
            nodes={nodes}
            selectedId={selectedId}
            focusSeries={focusSeries}
            yoursMode={yoursMode}
          />
          {kinship && kinship.pairs.length > 0 && (
            <KinshipArcs
              index={kinship}
              selectedId={kinSelectedId ?? selectedId}
              visible={kinshipVisible}
            />
          )}
          <HexagramRing placedByCard={placedByCard} />
        </group>
      </group>
      <Atmosphere />
    </>
  );
}

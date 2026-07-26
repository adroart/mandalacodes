/**
 * Scene assembly: nested tilt/spin groups (see rig.ts for the convention),
 * the per-frame rig step, the mandala camera dolly, and post-processing.
 *
 * The hexagram ring is parked (Adrian, 2026-07-18, the recentering): it leaves
 * the default scene and mounts only behind `?lenses=1`, together with the
 * mandala view. The component is kept and reachable; only this mount is gated.
 * The quiet kinship arcs stay always-on — they are the connective tissue.
 */

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { KinshipIndex } from '../../../utils/kinship';
import type { GlobeNode } from '../Globe';
import { ATLAS_NIGHT } from '../stageColors';
import Atmosphere from './Atmosphere';
import GlobeSphere from './GlobeSphere';
import HexagramRing from './HexagramRing';
import KinshipArcs from './KinshipArcs';
import Markers from './Markers';
import Starfield from './Starfield';
import {
  CAMERA_FAR_DIST,
  CAMERA_NEAR_DIST,
  easeInOutCubic,
  LightPool,
  stepRig,
  useRig,
} from './rig';

/* The lens layer (the hexagram ring, and with it the mandala view) is parked
   off the default surface; `?lenses=1` brings it back. Read at module load,
   the same dev-flag pattern the page uses. */
const LENSES_ENABLED =
  typeof window !== 'undefined' && /[?&]lenses=1(?:&|$)/.test(window.location.search);

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
  /** Skip the staggered founding-light ignition on this first load (returning
      visitor or a skipped overture): fade the lights in quietly instead. */
  suppressIntro?: boolean;
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
  suppressIntro,
}: GlobeSceneProps) {
  const rig = useRig();
  const tiltRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  // Canvas size in CSS px: the resting frame math reads it to tell a phone
  // frame from a desktop one without prop-drilling the page's media query.
  const size = useThree((s) => s.size);

  // The wrapper's click handler projects markers through the live camera;
  // the rig is the shared mutable channel between scene and wrapper.
  useEffect(() => {
    rig.camera = camera;
  }, [camera, rig]);

  // Standing light pools: every placed light casts one, its weight scaling with
  // the pieces sharing the city point (Lisbon = 3 -> a visibly larger pool);
  // every ember casts a small dim pool. The sphere shader accumulates them and
  // brightens the coast (the catch-light) inside the lit ones.
  const pools: LightPool[] = nodes
    .filter((n) => n.status === 'placed' || n.status === 'unawakened')
    .map((n) => ({
      lat: n.lat,
      lng: n.lng,
      weight: n.count ?? 1,
      ember: n.status === 'unawakened',
    }));

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
    // r 1.28, not 1.12: at phone widths the old margin left the sphere kissing
    // both stage edges, its atmosphere clipped flat against them, so the earth
    // read as a wall rather than a body hanging in the dark. The extra margin
    // is what makes it a sphere in a room.
    const sphereFit = 1.28 / Math.sin(visibleHalf);

    // Phone frame, measured the way the page's own `isPhone` measures it (the
    // canvas overhangs the stage by 28%, so stage width = canvas / 1.28).
    const phoneFrame = size.width / 1.28 < 768;
    // On a phone frame the stage is SHARED: the earth takes the upper band and
    // the words take the lower one (see the lower band in AtlasPage). So fit
    // and centre the sphere inside that upper band, not inside the whole stage.
    // Fitting it to the stage and then nudging it upward is not enough — on a
    // near-square frame like 767x839 the sphere fills 70% of the height on its
    // own, and no amount of lift makes room for a 40%-tall band. It has to be
    // sized for the room it actually gets.
    // The words' band is roughly a fixed height in pixels (a five-line dream,
    // its attribution, the pulse, the door), so its SHARE of the stage grows as
    // the stage gets shorter. A constant split therefore fails at both ends: it
    // starves the globe on a tall frame and lets it graze the first line on a
    // short one. Derive the globe's share from the real stage height instead.
    const stageH = size.height / 1.28;
    const BAND_PX = 380;
    const globeBand = Math.max(0.38, Math.min(0.6, 1 - BAND_PX / Math.max(1, stageH)));
    // Dark kept around the sphere inside its band, as a share of stage height.
    // The atmosphere glow reads wider than the geometry, so it wants to be more
    // generous than it looks.
    const MARGIN_FRAC = 0.12;
    const bandFit = 1.28 / ((globeBand - MARGIN_FRAC) * Math.tan(halfV));
    const nearDist = phoneFrame
      ? Math.max(CAMERA_NEAR_DIST, sphereFit, bandFit)
      : Math.max(CAMERA_NEAR_DIST, sphereFit);

    const e = easeInOutCubic(rig.mandala);
    const dist = nearDist + (Math.max(farDist, nearDist) - nearDist) * e + rig.travelDolly;
    camera.position.z = dist;

    // Lift the earth clear of the words. The stage's lower band carries the
    // featured dream and the caption rail; on a phone frame a centred sphere
    // puts its brightest lit face directly under that text, and the dream ends
    // up reading across coastlines. A parallel camera pan (position only, never
    // lookAt, so there is no perspective skew and marker projection follows for
    // free) raises the sphere into the upper frame instead. Dropping the camera
    // below the axis is what lifts the subject on screen, hence the negation.
    //
    // The offset is expressed as a fraction of the visible half-height rather
    // than in world units, so it holds its screen position at every distance:
    // the sphere stays put as the mandala dolly pulls back.
    const visibleHalfWorld = (dist * Math.tan(halfV)) / 1.28;
    // Centre the sphere in that upper band. The offset is a fraction of the
    // visible half-height rather than a world distance, so it holds its screen
    // position at every distance and the sphere stays put as the mandala dolly
    // pulls back; (1 - e) hands the whole stage back for the mandala view.
    const liftFrac = phoneFrame ? (1 - globeBand) * (1 - e) : 0;
    const targetLift = -liftFrac * visibleHalfWorld;
    // Ease toward it so a rotation into landscape, or the mandala pull-back,
    // glides instead of snapping.
    camera.position.y += (targetLift - camera.position.y) * Math.min(1, delta * 4);
  }, -1);

  return (
    <>
      {/* String form, not numeric components: THREE treats numeric args as
          linear and re-encodes them to sRGB on output, which rendered the
          intended near-black night as a washed grey. The hex string goes
          through the correct sRGB-to-linear conversion. */}
      <color attach="background" args={[ATLAS_NIGHT]} />
      <Starfield />
      <group ref={tiltRef}>
        <group ref={spinRef}>
          <GlobeSphere pools={pools} />
          <Markers
            nodes={nodes}
            selectedId={selectedId}
            focusSeries={focusSeries}
            yoursMode={yoursMode}
            suppressIntro={suppressIntro}
          />
          {kinship && kinship.pairs.length > 0 && (
            <KinshipArcs
              index={kinship}
              selectedId={kinSelectedId ?? selectedId}
              visible={kinshipVisible}
            />
          )}
          {LENSES_ENABLED && <HexagramRing placedByCard={placedByCard} />}
        </group>
      </group>
      <Atmosphere />
    </>
  );
}

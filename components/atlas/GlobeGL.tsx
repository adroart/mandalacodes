/**
 * Atlas globe, built on react-globe.gl (three-globe under the hood).
 *
 * Drop-in replacement for the hand-rolled Three.js globe (Globe3D). Same prop
 * contract — nodes / selectedId / onSelect / kinship / placedByCard — so the
 * page swaps one import and nothing else.
 *
 * Why this exists: the custom globe rendered the continents as ~12k point
 * sprites depth-tested against the sphere, which flickered on real GPUs as the
 * dots fought the surface depth every frame. three-globe draws the dotted map
 * as a hex-polygon layer that is solved properly, so it stays smooth.
 *
 * The look — warm bronze pieces and arcs on a deep stone world of faint dots —
 * is tuned to match the original art direction (docs/atlas-style-notes.md).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import * as THREE from 'three';
import type { KinshipIndex } from '../../utils/kinship';
import type { GlobeNode } from './Globe';

const COUNTRIES_URL = '/atlas/countries-110m.geojson';

// Palette — warm stone world, bronze pieces, sage for the visitor's origin.
const BACKGROUND = 'rgb(15, 13, 11)';
const HEX_COLOR = 'rgba(176, 158, 124, 0.5)'; // warm bronze-stone land dots
const SPHERE_COLOR = 'rgb(34, 29, 23)';        // deep warm stone body
const ATMOSPHERE = '#c4aa7c';
const SAGE = '#9caa87';

// Series → marker hue. Each art series reads as its own constellation. Named
// series get a hand-picked on-brand color; any unlisted series is assigned a
// stable distinct bronze-family hue automatically, so new series light up with
// zero code changes as they're added to the archive.
const SERIES_COLORS: Record<string, string> = {
  'Universal Language': '#c4aa7c', // bronze — the founding series
  Mandala: '#b98a6e',              // warm terracotta
  'Light Codes': '#d6c38a',        // pale gold
};

// Deterministic fallback hue for any series not named above. Keeps everything
// in a warm band (gold→amber→rose) so the map stays cohesive, never garish.
function autoSeriesColor(series: string): string {
  let h = 0;
  for (let i = 0; i < series.length; i++) h = (h * 31 + series.charCodeAt(i)) % 360;
  const hue = 28 + (h % 40); // 28..68° — amber/gold/bronze band only
  return `hsl(${hue}, 46%, 62%)`;
}

export function seriesColor(series?: string): string {
  if (!series) return SERIES_COLORS['Universal Language'];
  return SERIES_COLORS[series] ?? autoSeriesColor(series);
}

function markerColor(n: GlobeNode): string {
  if (n.status === 'origin') return SAGE;
  const base = seriesColor(n.series);
  // Unclaimed pieces read as faint embers of their series color.
  if (n.status === 'unawakened' || n.status === 'seeking') return dim(base, 0.55);
  return base;
}

interface PointDatum {
  id: string;
  lat: number;
  lng: number;
  color: string;
  selected: boolean;
  size: number;
}

// A glowing marker: a bright core sprite plus a soft wide halo, both additive
// so placed pieces read as little lights resting on the world. Cached radial
// gradient texture shared across all markers (one allocation, not per-piece).
let HALO_TEXTURE: THREE.Texture | null = null;
function haloTexture(): THREE.Texture {
  if (HALO_TEXTURE) return HALO_TEXTURE;
  const s = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  HALO_TEXTURE = new THREE.CanvasTexture(cv);
  return HALO_TEXTURE;
}

function makeMarker(d: PointDatum): THREE.Object3D {
  const color = new THREE.Color(d.color);
  const group = new THREE.Group();

  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: haloTexture(),
      color,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const haloScale = (d.selected ? 7 : 4.5) * (0.7 + d.size);
  halo.scale.set(haloScale, haloScale, 1);

  const core = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: haloTexture(),
      color: color.clone().lerp(new THREE.Color('#fff7e8'), 0.5),
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const coreScale = (d.selected ? 2.4 : 1.6) * (0.7 + d.size);
  core.scale.set(coreScale, coreScale, 1);

  group.add(halo);
  group.add(core);

  // Reticle on the selected marker — a thin ring + N/E/S/W ticks, billboarded
  // to face the camera. The instrument "acquiring" the target.
  if (d.selected) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(3.0, 3.25, 48),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.userData.billboard = true;
    group.add(ring);

    const tickMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    for (let i = 0; i < 4; i++) {
      const tick = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.9), tickMat);
      const a = (i * Math.PI) / 2;
      tick.position.set(Math.cos(a) * 3.6, Math.sin(a) * 3.6, 0);
      tick.rotation.z = a;
      group.add(tick);
    }
    // Make the whole reticle face the camera each frame.
    group.userData.billboard = true;
  }
  return group;
}

// Dim a hex or hsl color toward the stone background by mixing in darkness.
function dim(color: string, factor: number): string {
  // For hsl, just drop the lightness; for hex, blend toward black.
  const hsl = color.match(/^hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)$/);
  if (hsl) {
    const l = Math.round(Number(hsl[3]) * factor);
    return `hsl(${hsl[1]}, ${hsl[2]}%, ${l}%)`;
  }
  const hex = color.replace('#', '');
  if (hex.length === 6) {
    const r = Math.round(parseInt(hex.slice(0, 2), 16) * factor);
    const g = Math.round(parseInt(hex.slice(2, 4), 16) * factor);
    const b = Math.round(parseInt(hex.slice(4, 6), 16) * factor);
    return `rgb(${r}, ${g}, ${b})`;
  }
  return color;
}

export interface GlobeGLProps {
  nodes: GlobeNode[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  kinship?: KinshipIndex | null;
  kinshipVisible?: boolean;
  placedByCard?: ReadonlyMap<number, { lat: number; lng: number }>;
  mandala?: boolean;
  mandalaCaption?: string;
  className?: string;
  /** Reports the selected marker's screen position for the HUD leader-line. */
  onMarkerScreenPos?: (pos: { x: number; y: number }) => void;
  /** Called when the bare globe (not a marker) is clicked — releases selection. */
  onBackgroundClick?: () => void;
}

interface CountryFeature {
  type: string;
  geometry: unknown;
  properties: Record<string, unknown>;
}

export default function GlobeGL({
  nodes,
  selectedId,
  onSelect,
  kinship,
  kinshipVisible = true,
  mandala = false,
  mandalaCaption,
  className,
  onMarkerScreenPos,
  onBackgroundClick,
}: GlobeGLProps) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [countries, setCountries] = useState<CountryFeature[]>([]);

  // Load the country polygons for the hex-dotted land layer.
  useEffect(() => {
    let active = true;
    fetch(COUNTRIES_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((geo) => {
        if (active) setCountries((geo.features ?? []) as CountryFeature[]);
      })
      .catch(() => {
        /* No land layer — pieces + arcs still render on the bare sphere. */
      });
    return () => {
      active = false;
    };
  }, []);

  // Track the wrapper size so the canvas fills it responsively.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setSize({ width: r.width, height: r.height });
    });
    ro.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Resting altitude — higher = the globe sits further back with space all
  // around it (the viewport stays full-bleed; only the sphere recedes). 2.5
  // gives breathing room above, below, and to the sides of the whole globe.
  const REST_ALTITUDE = 2.5;

  // Auto-rotate; pause and LOCK when a piece is selected (the frame is held so
  // the HUD's leader-line stays anchored) or the mandala view engages.
  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    const controls = g.controls();
    const locked = !!selectedId;
    controls.autoRotate = !locked && !mandala;
    controls.autoRotateSpeed = 0.35;
    controls.enableZoom = false;
    controls.enableRotate = !locked; // hold the frame while a piece is selected
    g.pointOfView({ altitude: REST_ALTITUDE });
  }, [selectedId, mandala, size.width]);

  // Frame the selected piece (fly in + hold), or pull back on release / mandala.
  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    if (selectedId) {
      const n = nodes.find((node) => node.id === selectedId);
      // 1.35 = zoom in and hold the location prominently.
      if (n) g.pointOfView({ lat: n.lat, lng: n.lng, altitude: 1.35 }, 1000);
    } else {
      g.pointOfView({ altitude: mandala ? 3.4 : REST_ALTITUDE }, 1200);
    }
  }, [selectedId, mandala, nodes]);

  // Expose the selected marker's screen position so the parent can draw the
  // leader-line from the point to the HUD card. Recomputed each frame while
  // selected (cheap) via the globe's projection.
  useEffect(() => {
    if (!selectedId || !onMarkerScreenPos) return;
    let raf = 0;
    const update = () => {
      const g = globeRef.current;
      const n = nodes.find((node) => node.id === selectedId);
      if (g && n && typeof g.getScreenCoords === 'function') {
        const p = g.getScreenCoords(n.lat, n.lng, 0.02);
        if (p) onMarkerScreenPos({ x: p.x, y: p.y });
      }
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [selectedId, nodes, onMarkerScreenPos]);

  const globeMaterial = useMemo(
    () =>
      new THREE.MeshPhongMaterial({
        color: new THREE.Color(SPHERE_COLOR),
        emissive: new THREE.Color('rgb(20, 16, 12)'),
        emissiveIntensity: 0.6,
        shininess: 6,
      }),
    [],
  );

  const pointsData = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        lat: n.lat,
        lng: n.lng,
        color: markerColor(n),
        selected: n.id === selectedId,
        size: n.status === 'placed' ? 0.32 : n.status === 'origin' ? 0.3 : 0.22,
      })),
    [nodes, selectedId],
  );

  // Kinship pairs → great-circle arcs. Brighten the selected piece's arcs.
  const arcsData = useMemo(() => {
    if (!kinship || !kinshipVisible) return [];
    return kinship.pairs.map((p) => {
      const a = kinship.nodes.get(p.aKey);
      const b = kinship.nodes.get(p.bKey);
      if (!a || !b) return null;
      const hot = selectedId === p.aKey || selectedId === p.bKey;
      return {
        startLat: a.lat,
        startLng: a.lng,
        endLat: b.lat,
        endLng: b.lng,
        color: hot
          ? ['rgba(196,170,124,0.9)', 'rgba(196,170,124,0.25)']
          : ['rgba(196,170,124,0.35)', 'rgba(196,170,124,0.08)'],
      };
    }).filter(Boolean);
  }, [kinship, kinshipVisible, selectedId]);

  return (
    <div
      ref={wrapperRef}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 320,
        background: BACKGROUND,
        overflow: 'hidden',
      }}
      aria-label="Interactive globe showing where Adrian Rasmussen's artworks are placed in the world."
      role="img"
    >
      {size.width > 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            // When a piece is locked, slide the whole world aside to clear room
            // for the HUD (left on wide screens, up on phones). The marker stays
            // framed; only the sphere shifts into the cleared space.
            transform: selectedId
              ? size.width < 768
                ? 'translateY(-14%)'
                : 'translateX(-14%)'
              : 'translate(0,0)',
            transition: 'transform 900ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
        <Globe
          ref={globeRef}
          width={size.width}
          height={size.height}
          backgroundColor="rgba(0,0,0,0)"
          onGlobeClick={() => onBackgroundClick?.()}
          showAtmosphere
          atmosphereColor={ATMOSPHERE}
          atmosphereAltitude={0.28}
          globeMaterial={globeMaterial}
          // Dotted land: hex polygons over the country shapes.
          hexPolygonsData={countries}
          hexPolygonResolution={3}
          hexPolygonMargin={0.42}
          hexPolygonUseDots
          hexPolygonColor={() => HEX_COLOR}
          // Invisible, generous click targets — the native points layer
          // raycasts reliably, so it owns selection while the glowing sprites
          // (custom layer below) own the visuals.
          pointsData={pointsData}
          pointLat="lat"
          pointLng="lng"
          pointColor={() => 'rgba(0,0,0,0)'}
          pointAltitude={0.012}
          // Generous invisible click target so the small glowing markers are
          // easy to hit — the visible sprite stays small, the hit area is wide.
          pointRadius={1.4}
          pointResolution={6}
          pointsMerge={false}
          onPointClick={(d: PointDatum) => onSelect?.(d.id)}
          // Pieces as glowing sprites (soft bronze halo + bright core).
          customLayerData={pointsData}
          customThreeObject={(d: PointDatum) => makeMarker(d)}
          customThreeObjectUpdate={(obj: THREE.Object3D, d: PointDatum) => {
            const g = globeRef.current;
            if (!g) return;
            const { x, y, z } = g.getCoords(d.lat, d.lng, 0.01);
            obj.position.set(x, y, z);
            // Billboard the reticle group so the ring + ticks face the camera.
            if (obj.userData.billboard) {
              const cam = g.camera();
              if (cam) obj.quaternion.copy(cam.quaternion);
            }
          }}
          // Kinship arcs with a traveling pulse of light.
          arcsData={arcsData as object[]}
          arcStartLat="startLat"
          arcStartLng="startLng"
          arcEndLat="endLat"
          arcEndLng="endLng"
          arcColor="color"
          arcAltitudeAutoScale={0.4}
          arcStroke={0.5}
          arcDashLength={0.5}
          arcDashGap={1.2}
          arcDashInitialGap={(d: { startLat: number }) => Math.abs(d.startLat) / 90}
          arcDashAnimateTime={4000}
          arcsTransitionDuration={1500}
        />
        </div>
      )}

      <div
        aria-hidden={!mandala}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 18,
          textAlign: 'center',
          pointerEvents: 'none',
          opacity: mandala ? 1 : 0,
          transition: 'opacity 1.4s ease',
          fontFamily: '"Cormorant Garamond", serif',
          fontStyle: 'italic',
          fontSize: 17,
          letterSpacing: '0.04em',
          color: 'rgb(196, 170, 124)',
        }}
      >
        {mandalaCaption ?? 'The mandala so far'}
      </div>
    </div>
  );
}

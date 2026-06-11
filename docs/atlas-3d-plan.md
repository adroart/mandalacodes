# Atlas 3D Upgrade Plan

The `/atlas` route is migrating its rendering layer from `cobe` to Three.js via
react-three-fiber. The aesthetic, the data model, and the privacy rules are
unchanged; only the renderer is replaced.

---

## Why

`cobe` is fast and simple, but its output is visually bounded: a flat dot-sphere
with no depth, no atmosphere, no geometric layers. The goal of this upgrade is a
"higher-tech Google Earth" feel — a convincing planetary object the work rests on
— while preserving everything that makes the existing globe feel right: near-black
stone background, faint silver continents, bronze markers that breathe, and the
sage marker for the visitor's birth place.

The existing data and privacy model is untouched. All positions are city-level
only. The ledger is append-only. Nothing below city level is ever exposed.

---

## Phase 1 — Globe core

### Renderer swap

A react-three-fiber scene replaces the `cobe` canvas and is lazy-loaded behind
the route. The original `Globe.tsx` remains in place as an automatic fallback
for browsers without WebGL2 support; no user action is required to trigger it.

### Land dots

Continent geometry comes from a precomputed dot dataset generated at build time:

- Script: `scripts/generate-land-dots.ts`
- Output: `public/atlas/land-dots.bin` (binary, ~100KB)
- Source: world-atlas 50m land polygons, sampled onto a Fibonacci sphere
- Dot count: approximately 10,000 to 13,000 points

This avoids texture downloads entirely and keeps the continent rendering
consistent with the existing sketched, low-opacity stone aesthetic.

### Sphere shader

A custom shader drives the globe surface:

- Deep stone base colour matching the site's `paper` / stone palette
- Warm fresnel rim light at the limb
- Slow breathing brightness (replaces cobe's `mapBrightness` animation)

### Atmosphere

A separate fresnel glow shell sits just outside the sphere radius, visible at
the limb. It adds depth without competing with the markers.

### Markers

All markers render in a single instanced draw call:

- Bronze: piece placed in a city
- Dim bronze: piece seeking ground
- Sage: visitor's birth place

Markers pulse gently. When the active filter set changes, existing markers fade
out and the new set fades in.

### Kinship arcs

Arc geometry moves from the SVG `KinshipLayer` (which required a fragile
screen-space sync) into true 3D:

- Merged line geometry, one draw call per arc batch
- A traveling light pulse runs along each arc
- Selection state drives per-arc highlight attributes rather than a separate
  overlay element
- Occlusion by the sphere is handled for free by depth testing

### Post-processing

Selective bloom is applied to markers and arcs. It is disabled automatically on
low-tier and mobile devices to stay within the performance budget.

### Interaction parity

All existing interactions are preserved:

- Drag to rotate; pause on hover
- Click a marker to select the piece and open the side panel (panel behaviour
  is unchanged; the globe never covers it)
- Selected piece tweens to centre over 800ms with an ease curve
- Hover affordance remains a subtle ring expansion, no tooltip

---

## Phase 2 — Mandala layers

### Mandala View

After approximately 25 seconds of idle time, or when the visitor triggers it
manually, the camera pulls back and every kinship arc draws itself in sequence.
The arcs accumulate until the sphere is wrapped in the woven pattern — the
mandala as it stands. A caption reads:

> The mandala so far — N of 64 placed

The animation can be interrupted at any point; the camera returns on interaction.

### Ripple blooms

Each placed piece emits slow concentric rings of light through the sphere
shader. Where ripples from different pieces overlap, they interfere — the
surface pattern is a direct consequence of where the work has come to rest. The
effect is computed in the shader; no additional geometry is required.

### Hexagram Ring

A faint armillary ring surrounds the globe carrying all 64 hexagram glyphs
arranged in the King Wen sequence. Each placed piece sends a thread from its
city's position to its hexagram position on the ring. Unplaced hexagrams remain
dim on the ring, present but waiting.

---

## Phase 3 — Filters

Two new filter axes are added alongside the existing Series and Status filters:

- **Category** — the work's category
- **Size** — derived from each piece's physical dimensions via `utils/sizeBands.ts`,
  grouped into size bands

Filter state is serialised to the URL so that any filtered view can be shared
or bookmarked directly. Globe markers animate out and back in when the filter
set changes.

---

## Performance budget

| Concern | Approach |
|---|---|
| Initial load | 3D chunk lazy-loaded behind the route; land dots ~100KB binary |
| Textures | None downloaded; continent dots are geometry |
| Draw calls | Instanced markers and merged arc geometry keep the call count around 10 |
| Pixel ratio | DPR capped at 2 |
| Low-tier devices | Bloom and ripples disabled; cobe fallback for non-WebGL2 |

---

## Later / deferred

These items are scoped but not scheduled:

- **Mandala Projection** — the globe morphs into a flat azimuthal mandala,
  producing a shareable poster image of the full pattern. Highest effort of any
  feature in this plan.
- **Trigram constellations** — per-family arc behaviours keyed to the eight
  trigram groups.
- **Sculpted-relief continent texture** — a commissioned freelance asset
  replacing the dot layer with a photorealistic relief. Optional; the dot layer
  stands on its own.

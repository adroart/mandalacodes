/**
 * Plain CSS-string forms of the Atlas dark-stage palette.
 *
 * The canonical values live as --color-atlas-* tokens in src/theme.css. This
 * file is the JS-side mirror for code that needs a literal color string
 * rather than a Tailwind class: react-globe.gl props, SVG fill attributes,
 * and CSS-in-JS style objects. Deliberately has zero dependencies so light
 * consumers (e.g. the series legend) never pull in three.js just to read a
 * color; components/atlas/three/rig.ts holds the separate THREE.Color
 * instances the hand-rolled Three.js globe needs for its shader uniforms.
 *
 * Keep every value below byte-identical to its matching token in
 * src/theme.css. Those two places, plus rig.ts's THREE.Color instances, are
 * the only places a stage color is ever written as a literal.
 */

export const ATLAS_NIGHT = '#0f0d0b';   // --color-atlas-night
export const ATLAS_SPHERE = '#221d17';  // --color-atlas-sphere
export const ATLAS_LAND = '#b09e7c';    // --color-atlas-land
export const ATLAS_GOLD = '#c4aa7c';    // --color-atlas-gold
export const ATLAS_EMBER = '#574a36';   // --color-atlas-ember
export const ATLAS_KEPT = '#9caa87';    // --color-atlas-kept

/** Apply an alpha channel to one of the constants above, for the rare
    translucent use (e.g. the land-dot layer), instead of hand-writing a
    second rgba literal that can quietly drift from the base color. */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

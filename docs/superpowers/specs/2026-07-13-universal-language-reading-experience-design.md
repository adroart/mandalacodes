# Universal Language Reading Experience Design

**Dependency:** Approved typography foundation.

## Teajia-aligned reveal and boxes

Port the active accessible reveal approach from Teajia's immersive sections, not the disabled `.reader-enter-*` system. Direct reading sections begin slightly below their final position with zero opacity, enter once as they approach the viewport, and settle with restrained easing. Use the gentler Teajia values—approximately 26px translation and 900ms duration—unless visual testing shows that the richer blur variant remains quiet enough. Reduced-motion users receive immediate visible content with no translation or blur. A safety fallback prevents content from remaining hidden if observation fails.

Boxes use Teajia's restrained recipe: translucent gold 1px borders, 3–4px radii, espresso surfaces, responsive padding, and no heavy card-on-card construction. Ordinary prose remains unboxed.

## Centered mobile navigation

Replace the current edge-weighted flex layout with the approved center constellation:

- Previous hexagram glyph, `current number / ALL 64`, and next hexagram glyph form one centered three-part unit.
- Remove directional arrows.
- Neighboring code titles remain secondary on the left and right and may truncate safely.
- The center constellation never leaves the safe viewport at 320px or wider.
- The bar respects `env(safe-area-inset-bottom)` and retains minimum 44px touch targets.
- Normal taps still navigate to previous, all 64, and next destinations.
- The current center becomes the administrator long-press target in Build 2 without altering public tap behavior.

## Verification

Test direct page load, previous/next navigation, browser back/forward, reduced motion, long readings, CJK content, iPhone safe areas, and the real Hexagram 22 page shown in the supplied screenshot. No text or glyph may be clipped horizontally.

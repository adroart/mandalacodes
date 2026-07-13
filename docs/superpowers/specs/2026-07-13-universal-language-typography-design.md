# Universal Language Typography Foundation Design

**Status:** Approved as an isolated first pass.

## Goal

Make Mandala Codes typography feel native to Teajia Read while preserving Mandala Codes content, routing, motion, boxes, and layout for this pass. The result must be judged as a type system rather than bundled into a broader redesign.

## Source system

Teajia is the visual authority. Reuse the self-hosted assets and role logic from:

- `teajia/public/fonts/fonts.css`
- `teajia/src/designTokens.ts`
- `teajia/src/pages/read/immersive.tsx`
- `teajia/src/components/immersive/sections.tsx`

The relevant families are:

- **Cormorant Garamond** — display headings, card numbers, invocations, and elevated editorial phrases.
- **Lora** — long-form reading body where a sturdier text face improves sustained reading.
- **Plus Jakarta Sans** — navigation, controls, metadata, and interface labels.
- **IBM Plex Mono** — technical states only, such as recording time or Markdown filename; do not use it as the general UI face.
- **Noto Serif SC** — Chinese text and glyph fallback.
- **Ma Shan Zheng** — calligraphic accents only where Teajia already establishes the role; never as body text.

## Mandala role mapping

Create semantic tokens rather than scattering family names:

- `--font-display`: Cormorant Garamond stack.
- `--font-reading`: Lora stack.
- `--font-ui`: Plus Jakarta Sans stack.
- `--font-technical`: IBM Plex Mono stack.
- `--font-cjk`: Noto Serif SC stack.
- `--font-calligraphic`: Ma Shan Zheng stack.

Existing Cormorant usage is retained where it already serves an editorial display role. Existing Karla usage is replaced only after a page-by-page comparison confirms the corresponding role is interface text, not prose.

## Scale and measure

- Phone reading body: 18px target, 1.72–1.78 line height.
- Desktop reading body: 20px target, 1.72–1.78 line height.
- Reading measure: maximum 680px, centered, with 24px phone side padding.
- Labels: uppercase Plus Jakarta Sans with deliberate tracking; never simulate hierarchy by excessive letter spacing alone.
- Display headings scale fluidly with `clamp()` and must not wrap into single orphan words on common iPhone widths.
- Card number and navigation type must remain optically centered even when adjacent titles truncate.

## Font delivery and licensing

- Self-host WOFF2 files in Mandala Codes; no runtime dependency on Teajia or Google Fonts.
- Copy or re-source the authoritative Google Fonts packages together with their SIL Open Font License files and notices. The current Teajia repository does not contain those notices, so copying only the binaries is insufficient.
- Preload only the above-the-fold weights actually used by the initial reading view.
- Use `font-display: swap` and metrics-compatible fallbacks to minimize layout shift.
- Do not load every weight or style merely because it exists in Teajia.

## Isolation boundary

This pass may change font assets, font declarations, semantic typography tokens, and typography-specific rules. It must not change:

- Entrance animations or IntersectionObserver behavior.
- Box backgrounds, borders, radii, or spacing.
- Bottom navigation structure.
- Reading content or hierarchy.
- Recorder or invocation functionality.

## Verification

Compare the real Universal Language reading on iPhone-sized viewports and desktop against Teajia Read. Verify:

- No flash leaves text invisible.
- No new horizontal overflow.
- Headings, body, labels, numbers, and CJK each resolve to the intended family.
- 320px, 375px, 390px, and 430px widths remain readable.
- Font loading does not create disruptive cumulative layout shift.
- Safari iOS and Chromium render acceptable weight and line breaks.
- Reduced-data or failed-font conditions fall back legibly.

The pass is complete only after visual review of the actual Universal Language page, not an isolated type specimen.

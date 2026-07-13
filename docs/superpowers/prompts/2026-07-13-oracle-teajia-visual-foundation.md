# Oracle × Teajia Visual Foundation Work Prompt

Work in:

`/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/mandalacodes`

Your first task is to audit and then visually align the entire Oracle / Universal Language reading experience with Teajia's Read section.

## Read first

Read these approved specifications before doing anything:

1. `docs/superpowers/specs/2026-07-13-universal-language-reflection-roadmap-design.md`
2. `docs/superpowers/specs/2026-07-13-universal-language-typography-design.md`
3. `docs/superpowers/specs/2026-07-13-universal-language-reading-experience-design.md`
4. `docs/superpowers/specs/2026-07-13-universal-language-reflection-recorder-design.md`
5. `docs/superpowers/specs/2026-07-13-universal-language-invocation-composer-design.md`

For this run, implement only the public Oracle visual foundation:

- Build 0: typography
- Build 1: reading styling, containers, visual effects, and mobile navigation

Do not implement recording, transcription, journals, authentication changes, invocation editing, storage, migrations, or publishing yet. Those later documents are context only.

## Visual authority

Teajia is the visual authority. You have permission to inspect and reuse its Read system from:

`/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/teajia`

Inspect these sources closely:

- `public/fonts/fonts.css`
- `src/designTokens.ts`
- `src/pages/read/immersive.tsx`
- `src/components/immersive/sections.tsx`
- `src/styles/reader-animations.css`
- `src/pages/read/CraftPotThatRemembers.tsx`
- `src/pages/read/AtlasMapOfMountains.tsx`

Also inspect the complete Teajia Read experience in the real browser at multiple viewport sizes. Do not rely only on source code. Record the actual typography, spacing, reading measure, borders, surfaces, reveal timing, easing, stagger, and responsive behavior.

Important source distinctions:

- Port Teajia's active immersive reveal system.
- Do not copy the disabled `.reader-enter-*` animation system.
- Prefer the restrained Read effect: approximately 26px vertical movement, roughly 900ms duration, and Teajia's existing easing.
- Preserve the accessible reduced-motion behavior and visibility fallback.
- Reproduce Teajia's visual behavior almost verbatim unless it conflicts with Mandala Codes content or accessibility.
- Do not introduce new visual styles, generic redesign patterns, heavy cards, gradients not present in Teajia, or decorative animation.

## Audit before implementation

Begin with a comprehensive audit of the Oracle portion of Mandala Codes, including:

- Every Oracle and Universal Language route
- Shared reading components
- Generated and source-controlled templates
- Typography declarations and font assets
- Entrance and scroll reveal behavior
- Reading widths and responsive padding
- Boxes, panels, borders, colors, and radii
- Header and category navigation
- Bottom sticky navigation
- Hexagram glyph rendering
- Mobile overflow and safe-area behavior
- Reduced-motion handling
- Existing tests
- Generated files that must not be edited directly

The principal reference page is:

`/universal-language/22`

Important Mandala Codes implementation areas already identified:

- `components/UniversalLanguageCard.tsx`
- `components/oracle/eb/generated/EBReading.host.tsx`
- `components/oracle/eb/generated/EBReading.generated.tsx`
- `components/oracle/eb/eb-template.css`
- `components/oracle/HexagramGlyph.tsx`
- `src/theme.css`
- `src/index.css`
- `data/oracleData.ts`
- `data/expandedOracleData.ts`
- `data/synthesisData.ts`
- `data/cardMarkdown.ts`
- `oracle/cards/`

Treat comments identifying generated or extracted files as authoritative. Do not directly edit generated output when a source template, host component, or regeneration path exists.

## Execution sequence

1. Inspect the current repository state, existing changes, recent commits, and relevant project instructions.
2. Preserve all unrelated working-tree changes. Never clean, restore, reset, or overwrite Adrian's work.
3. Audit the complete Oracle visual system and compare it directly with Teajia Read.
4. Produce a short evidence-based gap report before implementation: what currently differs; what was lost or replaced; which Teajia source is authoritative for each correction; which exact Mandala files should change; and which generated files must remain untouched.
5. Implement the isolated typography foundation first.
6. Test typography on the actual Oracle screens before adding motion or layout changes.
7. Then implement the reading surfaces, restrained boxes, reveal effects, and navigation.
8. Verify every relevant Oracle route in the real browser.
9. Run focused automated tests while building, followed by one complete relevant verification.
10. Commit and push the finished work without including unrelated changes.

## Typography requirements

- Self-host the required font assets inside Mandala Codes.
- Bring the relevant OFL license files and notices with the fonts.
- Use semantic font tokens:
  - Cormorant Garamond for display typography
  - Lora for sustained reading prose
  - Plus Jakarta Sans for UI and labels
  - IBM Plex Mono only for technical states
  - Noto Serif SC for Chinese text
  - Ma Shan Zheng only for established calligraphic accents
- Do not blindly replace every font declaration.
- Audit each text role and map it intentionally.
- Use approximately 18px reading text on phones and 20px on desktop, with a 1.72–1.78 line height.
- Keep reading content centered at a maximum width of approximately 680px with 24px phone padding.
- Minimize layout shift and preload only essential above-the-fold weights.
- Verify fallback rendering when fonts fail.

## Reading and visual-effect requirements

- Match Teajia's espresso background, warm ink, restrained gold borders, editorial spacing, and reading rhythm.
- Use boxes selectively, following Teajia's thin translucent-gold borders, small radii, dark surfaces, and responsive padding.
- Ordinary prose should not become a series of cards.
- Reveal sections once as they approach the viewport.
- Include the same restrained movement, timing, easing, and stagger used by Teajia.
- Ensure content becomes visible if IntersectionObserver fails.
- Disable transforms, blur, and delayed visibility when reduced motion is enabled.
- Avoid animation that interferes with reading or scrolling.

## Bottom navigation requirements

Use the approved center-constellation layout:

- Previous hexagram glyph, current number with `ALL 64`, and next hexagram glyph form one centered unit.
- Remove all directional arrows.
- Keep neighboring code names secondary on the left and right.
- Allow neighboring names to truncate safely.
- Keep the center constellation fully visible at 320px and wider.
- Respect iPhone safe-area insets.
- Preserve minimum 44px touch targets.
- Preserve existing navigation behavior.
- Do not implement administrator long-press recording in this run, but leave the centered current-number element structurally suitable for that later enhancement.

## Browser validation

Test at minimum:

- 320px
- 375px
- 390px
- 430px
- Small laptop
- Desktop

Validate:

- `/universal-language/22`
- Direct page entry
- Previous and next navigation
- All 64 navigation
- Browser back and forward
- Long reading content
- CJK content
- Reduced motion
- Font-loading failure or fallback
- iPhone safe-area behavior
- Horizontal overflow
- Text and glyph clipping
- Reveal effects during real scrolling

Use the supplied screenshot as evidence of the current mobile problem:

`/Users/adrianrasmussen/Downloads/IMG_0784.PNG`

## Success criteria

- The Oracle reading experience feels unmistakably related to Teajia Read.
- Font roles, reading measure, spacing, boxes, colors, and reveals match Teajia almost verbatim.
- The work still feels native to Mandala Codes rather than pasted in.
- Text entrances are visible, restrained, accessible, and consistent throughout the Oracle.
- The bottom navigation is visually centered and no hexagram is clipped on iPhone.
- No unrelated interface or backend behavior changes.
- The actual screens have been visually inspected after implementation.
- Focused tests and the relevant full verification pass.
- Changes are committed and pushed.

## Completion report

Report:

- What visibly changed
- What Teajia sources were adopted
- Which Oracle screens were tested
- Exact verification results
- Any deliberately deferred inconsistencies
- Commit and pushed branch

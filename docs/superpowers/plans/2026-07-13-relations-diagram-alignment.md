# Relations Diagram Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align every Relations medallion with its connector and selection halo while correcting the pair, codon-ring, Tarot, and Hebrew symbols.

**Architecture:** Keep authored relation data in `UniversalLanguageCard.tsx`, move reusable relation-symbol normalization to a pure utility, and change the generated markup's node box so its caption is removed from centering calculations. Use existing shared hexagram rendering and small inline SVG marks for vector-only symbols.

**Tech Stack:** React 18, TypeScript, Vitest, Playwright, CSS-in-JS generated markup

---

### Task 1: Relation symbol data

**Files:**
- Create: `utils/relationsDiagram.ts`
- Create: `tests/unit/relationsDiagram.test.ts`
- Modify: `components/UniversalLanguageCard.tsx`

- [ ] Write failing tests asserting that `V, The Hierophant` yields `V`, `XIV · Temperance` yields `XIV`, and Vav/Vau yields the Hebrew letter `ו`.
- [ ] Run `npx vitest run tests/unit/relationsDiagram.test.ts` and confirm the missing-module failure.
- [ ] Implement `tarotNumeral` and `hebrewLetterGlyph` as pure functions.
- [ ] Replace the hardcoded Tarot numeral and raw Hebrew name in `buildKin` with these functions.
- [ ] Run `npx vitest run tests/unit/relationsDiagram.test.ts` and confirm all assertions pass.

### Task 2: Vector glyphs and node geometry

**Files:**
- Modify: `components/oracle/eb/generated/EBReading.host.tsx`
- Modify: `components/oracle/eb/generated/EBReading.generated.tsx`
- Modify: `components/UniversalLanguageCard.tsx`

- [ ] Broaden the kin-node glyph type from `string` to `React.ReactNode`.
- [ ] Render the pair with `HexagramSVG`, the codon relation with an inline ring icon, and Vav with an inline Hebrew SVG path.
- [ ] Make each outer button's box exactly the medallion dimension and absolutely place its caption below it.
- [ ] Apply the same square-anchor rule to the central button so its name cannot shift the center glyph.
- [ ] Run `npx tsc --noEmit` and correct any type errors in the touched files.

### Task 3: Mobile visual verification

**Files:**
- Modify if required: `components/oracle/eb/generated/EBReading.generated.tsx`
- Modify if required: `components/oracle/eb/eb-template.css`

- [ ] Build the app with `npm run build`.
- [ ] Open `/universal-language/22`, select Relations, and capture a mobile screenshot near 945 CSS pixels wide and the standard 390 CSS pixel phone width.
- [ ] Compare connector endpoints, medallion centers, halos, labels, and all four corrected symbols against the supplied screenshot.
- [ ] Make only geometry adjustments supported by the rendered evidence.
- [ ] Re-run the focused unit test, TypeScript check, and production build.

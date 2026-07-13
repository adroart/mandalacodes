# Oracle Continuous Reading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the Universal Language card from horizontal system pagination into a Teajia-aligned continuous editorial reading without a drop cap.

**Architecture:** Keep the generated chapter markup and all interactive adapters, but change the host controller to treat chapters as viewport-rooted vertical sections. Apply the continuous-reading structure in source-owned CSS, add a focused sticky progress component, and convert the existing neighboring-card navigation into an in-flow editorial footer.

**Tech Stack:** React, TypeScript, CSS, IntersectionObserver, Playwright.

---

### Task 1: Lock the structural contract with browser tests

**Files:**
- Modify: `tests/oracle-visual-foundation.spec.ts`

- [ ] Add tests asserting that the reading stage has vertical block flow, no horizontal overflow or scroll snapping, espresso background, visible reading progress, no drop cap, and an in-flow neighboring-card footer.
- [ ] Run `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4174 npx playwright test tests/oracle-visual-foundation.spec.ts` and confirm the new assertions fail for the current horizontal/fixed implementation.

### Task 2: Convert the host controller to document scrolling

**Files:**
- Modify: `components/oracle/eb/generated/EBReading.host.tsx`

- [ ] Observe chapters against the viewport rather than the horizontal stage and update the active section from their visible geometry.
- [ ] Change `go(key)` to scroll the selected chapter into document position below the sticky header.
- [ ] Arm meaningful nested editorial blocks for the existing 26px/900ms reveal while preserving reduced-motion and observer fallback behavior.
- [ ] Add and remove the document scroll listener used by reading progress.

### Task 3: Apply the Teajia editorial foundation

**Files:**
- Modify: `components/oracle/eb/oracle-foundation.css`
- Modify: `components/oracle/eb/eb-template.css`

- [ ] Pin both palette modes to espresso tokens and remove theme-dependent parchment output.
- [ ] Override `.ul-stage` into normal block flow and make chapter sections auto-sized vertical movements.
- [ ] Restyle body measure, movement labels, headings, quotes, diagrams, controls, rules, grain, lighting, and whitespace to the approved Teajia values.
- [ ] Hide the generated drop cap and repeated boxed chapter-next controls.
- [ ] Replace the sticky system rail with a quiet in-flow contents rail and ensure 320px layouts do not overflow.

### Task 4: Add one sticky reading-progress header

**Files:**
- Create: `components/oracle/OracleReadingProgress.tsx`
- Create: `components/oracle/oracle-reading-progress.css`
- Modify: `components/UniversalLanguageCard.tsx`

- [ ] Render card identity and section identity in one sticky reading header.
- [ ] Compute document progress with a passive scroll listener and expose it as a 2px bronze line.
- [ ] Keep the 64-code index, acquire, and share actions quiet and accessible through the existing interaction bridges.

### Task 5: Convert neighboring navigation into the editorial ending

**Files:**
- Modify: `components/oracle/OracleBottomNavigation.tsx`
- Modify: `components/oracle/oracle-bottom-navigation.css`

- [ ] Remove fixed positioning, blur, and toolbar framing.
- [ ] Keep visible code number and card name on both sides, justified inward.
- [ ] Preserve All 64 access in the center and maintain safe truncation on 320px screens.

### Task 6: Verify and ship

**Files:**
- Verify: `tests/oracle-visual-foundation.spec.ts`

- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Run the full Oracle visual-foundation Playwright suite in Desktop Chrome and Mobile Chrome.
- [ ] Inspect `/universal-language/22` at 320px, 390px, and desktop widths, including the final neighboring-card footer.
- [ ] Commit only Oracle reading, test, spec, and plan files; preserve unrelated worktree changes.

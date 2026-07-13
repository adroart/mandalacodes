# Birth Profile Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved responsive birth-profile workspace with one vertical scroll surface and dynamic access to the full birthplace result set.

**Architecture:** `BirthTimeModal` owns the viewport-sized dialog and its single scroll container. `ProfileForm` keeps the existing form and search behavior, but lets results participate in normal document flow and uses the dialog scroll container for keyboard reveal.

**Tech Stack:** React 18, TypeScript, inline component CSS, Playwright.

---

### Task 1: Lock the interaction contract with a browser test

**Files:**
- Create: `tests/birth-profile-entry.spec.ts`

- [ ] Open `/universal-language`, invoke “Enter your birth time,” and assert accessible dialog semantics.
- [ ] Assert the dialog exposes one designated scroll container and the birthplace results do not independently scroll.
- [ ] Assert no results appear before typing, results populate after typing, and selection closes the results.
- [ ] Run the test on Desktop Chrome and Mobile Chrome and confirm it fails because the new dialog and scroll contract is absent.

### Task 2: Implement the responsive single-scroll workspace

**Files:**
- Modify: `components/oracle/BirthTimeModal.tsx`
- Modify: `components/oracle/ProfileForm.tsx`

- [ ] Add dialog semantics, an explicit close control, focus entry/return, and Escape behavior.
- [ ] Make mobile use the visual viewport and desktop use a larger centered workspace.
- [ ] Designate the panel as the sole scroll container.
- [ ] Keep up to 24 dynamic matches, remove independent list overflow, and reveal keyboard-highlighted rows through the panel.
- [ ] Switch functional typography to Karla and tighten visual rhythm and helper copy.
- [ ] Run the focused Playwright test until both projects pass.

### Task 3: Verify and ship

**Files:**
- Verify: `components/oracle/BirthTimeModal.tsx`
- Verify: `components/oracle/ProfileForm.tsx`
- Verify: `tests/birth-profile-entry.spec.ts`

- [ ] Run typecheck, focused desktop/mobile Playwright tests, and the production build.
- [ ] Inspect desktop and mobile screenshots for viewport sizing and scroll behavior.
- [ ] Commit only the approved birth-profile files and push the current branch.

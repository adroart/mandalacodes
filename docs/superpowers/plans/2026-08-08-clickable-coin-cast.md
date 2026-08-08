# Clickable Coin Cast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the three rendered coins cast on pointer or keyboard activation and replace the 900 ms tumble with a guarded 380 ms flip.

**Architecture:** Keep cast probability and result generation in `EBReadingHost`. Add a `casting` state guard shared by both triggers, expose it through render values, and make the coin group a semantic button in the generated markup. Exercise the public behavior through the existing Playwright Oracle test.

**Tech Stack:** React 18 class component, TypeScript, inline styles, CSS keyframes, Playwright.

---

### Task 1: Specify the public interaction

**Files:**
- Modify: `tests/oracle-card-coin-cast.spec.ts`

- [ ] **Step 1: Write the failing test**

Add a test which loads card 22 with normal motion, dismisses the entrance, asserts two controls named “Cast the coins,” clicks the first (the coin group), verifies both controls disable immediately, waits for `YOUR CAST`, and checks the elapsed result is below 650 ms. Add a reduced-motion keyboard test that focuses the coin control, presses Enter, and expects `YOUR CAST` immediately.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/oracle-card-coin-cast.spec.ts --project='Desktop Chrome' --reporter=list`

Expected: FAIL because only the text button has the accessible name and the coins are not interactive.

### Task 2: Implement the guarded crisp flip

**Files:**
- Modify: `components/oracle/eb/generated/EBReading.host.tsx`
- Modify: `components/oracle/eb/generated/EBReading.generated.tsx`
- Modify: `components/oracle/eb/generated/EBReading.style.css`
- Modify: `components/oracle/eb/eb-template.css`
- Modify: `components/oracle/eb/generated/EBReading.controller.txt`

- [ ] **Step 1: Add casting state and timing**

Add `casting: false` to host state. At the start of `doCast`, return if `casting` or `cast` is truthy, then set `casting: true`. Animate each coin for `300ms` with `35ms` sibling stagger and resolve the cast at `380ms`. Reduced motion resolves immediately. Expose `casting` in render values.

- [ ] **Step 2: Make the coin group the primary control**

Render the coin group as `<button type="button" aria-label="Cast the coins">`, call `vals.doCast`, disable it while casting, and preserve the existing coin SVGs. Disable the secondary text button from the same value. Add visible focus and immediate pressed feedback without changing layout.

- [ ] **Step 3: Replace the tumble keyframe**

In both CSS copies, replace the airborne two-turn tumble with one edge-on flip: start settled, reach `rotateY(90deg) scale(.96)` at midpoint, and finish at `rotateY(180deg) scale(1)`. Animate only transform and opacity with an exponential ease-out.

- [ ] **Step 4: Keep the controller source synchronized**

Mirror the host timing and guard changes in `EBReading.controller.txt`, the maintained controller source for the generated host.

- [ ] **Step 5: Run the focused test**

Run: `npx playwright test tests/oracle-card-coin-cast.spec.ts --project='Desktop Chrome' --reporter=list`

Expected: PASS.

### Task 3: Verify and ship

**Files:**
- Verify all modified files above.

- [ ] **Step 1: Run static verification**

Run: `npm run typecheck && npm run test:unit`

Expected: typecheck succeeds and all unit tests pass.

- [ ] **Step 2: Run the design detector**

Run: `node /Users/adrianrasmussen/.agents/skills/impeccable/scripts/detect.mjs --json components/oracle/eb/generated/EBReading.generated.tsx components/oracle/eb/generated/EBReading.style.css components/oracle/eb/eb-template.css`

Expected: no blocking findings introduced by this change.

- [ ] **Step 3: Inspect desktop and mobile together**

Open the real Oracle screen at desktop and 393 px mobile widths. Verify coin hover/focus/press, no layout shift, clickable target size, keyboard activation, and reduced motion.

- [ ] **Step 4: Commit and ship**

Commit only the spec, plan, test, and five Oracle implementation files. Push `codex/clickable-coin-cast`, open a PR to main, wait for checks, merge, then verify the production bundle and click the coins on the live card.

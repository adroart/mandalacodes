# Oracle Reading Width Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let tablet and desktop Oracle prose fill the existing ruled chapter column without changing the panel width or mobile measure.

**Architecture:** Keep the existing 680px chapter container and responsive mobile override. Replace the nested `40ch` paragraph cap with the available parent width, and lock the behavior with a desktop Playwright geometry assertion.

**Tech Stack:** CSS, Playwright, TypeScript

---

### Task 1: Fill the existing desktop reading column

**Files:**
- Modify: `tests/oracle-visual-foundation.spec.ts:285`
- Modify: `components/oracle/eb/oracle-foundation.css:84-91`

- [x] **Step 1: Write the failing desktop-width assertion**

Extend the existing desktop layout test with the first Universal Language prose paragraph and assert that it uses at least 90% of its parent content width:

```ts
const prose = page.locator('[data-oracle-reading-prose] > p').first();
const proseMeasure = await prose.evaluate((element) => ({
  width: element.getBoundingClientRect().width,
  parentWidth: element.parentElement!.getBoundingClientRect().width,
}));
expect(proseMeasure.width / proseMeasure.parentWidth).toBeGreaterThanOrEqual(0.9);
```

- [x] **Step 2: Run the test and verify RED**

Run:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:61562 npx playwright test tests/oracle-visual-foundation.spec.ts --project='Desktop Chrome' --grep='desktop title'
```

Expected: FAIL because the current `40ch` paragraph width occupies substantially less than 90% of the existing prose container.

- [x] **Step 3: Remove the inner desktop/tablet cap**

Change the shared long-form paragraph rule to:

```css
width:100%; max-width:none; margin-inline:auto;
```

Keep the existing mobile rule and the 680px chapter container unchanged.

- [x] **Step 4: Run focused verification and verify GREEN**

Run:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:61562 npx playwright test tests/oracle-visual-foundation.spec.ts --project='Desktop Chrome' --project='Mobile Chrome' --grep='desktop title|controlled mobile prose'
npm run typecheck
```

Expected: all four browser checks pass and typecheck exits 0.

- [x] **Step 5: Visually verify and commit**

Open `/universal-language/22`, inspect the Siddhi paragraph block at desktop width, and confirm the prose now fills the existing rules without changing the outer panel. Then commit only the spec, plan, CSS, and test changes.

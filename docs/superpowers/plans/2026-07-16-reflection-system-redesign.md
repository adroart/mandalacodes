# Reflection System Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the recorder, Journal, and Invocation Composer a cohesive, theme-aware reflection experience with reliable Finish, Back, Close, and Done behavior.

**Architecture:** Keep the existing recorder hook, persistence APIs, transcription polling, and invocation data model. Add one explicit immediate-exit lifecycle to the recorder, let the recorder rail own the Journal/Invocation layer stack, and restyle both full-screen surfaces with the existing Oracle theme tokens and navigation geometry.

**Tech Stack:** React 18, TypeScript, React portals, CSS custom properties, Vitest, Playwright, Vite.

---

## File Map

- Modify `hooks/useReflectionRecorder.ts`: return persistence success from pause and add an immediate `exit()` lifecycle.
- Modify `components/oracle/ReflectionRecorderBar.tsx`: implement Finish-to-Journal, Invocation-to-Journal, and Done-to-reading orchestration.
- Modify `components/oracle/ReflectionJournal.tsx`: establish the editorial header, segment structure, and contextual action rail.
- Modify `components/oracle/reflection-recorder.css`: remove hardcoded dark surfaces and implement the selected Editorial Rail design.
- Modify `components/oracle/invocation/InvocationComposer.tsx`: add Back and Done semantics while preserving draft protection.
- Modify `components/oracle/invocation/invocation-composer.css`: align Invocation with the Journal and active Oracle palette.
- Modify `tests/unit/reflectionRecorderMachine.test.ts`: cover pause result and immediate exit state.
- Modify `tests/oracle-reflection-recorder.spec.ts`: cover the complete recorder/Journal/Invocation lifecycle and theme behavior.
- Modify `tests/oracle-invocation-composer.spec.ts`: cover the composer’s editorial layout without disturbing public invocation behavior.

### Task 1: Make recorder persistence and exit outcomes explicit

**Files:**
- Modify: `hooks/useReflectionRecorder.ts`
- Test: `tests/unit/reflectionRecorderMachine.test.ts`

- [ ] **Step 1: Write failing lifecycle tests**

Add tests that establish the two guarantees needed by the UI:

```ts
it('reports whether pausing produced a locally persisted segment', async () => {
  const result = await finishAfterLocalPersistence(
    () => true,
    () => Promise.resolve(),
    vi.fn(),
  );
  expect(result).toBe(true);
});

it('resets a finished reflection immediately when exit is requested', () => {
  const finished = reflectionRecorderReducer({
    ...initialReflectionRecorderState,
    status: 'finished',
    sessionId: 'session-22',
    savedSegmentCount: 1,
  }, { type: 'finished' });
  expect(finished).toEqual(initialReflectionRecorderState);
});
```

Export `initialReflectionRecorderState` only if the test cannot already construct the equivalent state through existing reducer actions.

- [ ] **Step 2: Run the focused tests and confirm failure**

Run:

```bash
npx vitest run tests/unit/reflectionRecorderMachine.test.ts
```

Expected: the new pause/exit contract is not yet exposed by `UseReflectionRecorderResult`.

- [ ] **Step 3: Add the minimal hook contract**

Change the public result to:

```ts
export interface UseReflectionRecorderResult {
  isAdmin: boolean;
  capabilityReady: boolean;
  state: ReflectionRecorderState;
  micLevel: number;
  startRecording(): Promise<void>;
  pause(): Promise<boolean>;
  resume(): void;
  finish(): Promise<void>;
  exit(): Promise<void>;
  cancel(): Promise<void>;
  retryPending(): Promise<void>;
}
```

Return the `commitCurrentSegment()` boolean from `pause`. Refactor finalization so `finish()` may retain its short saved confirmation, while `exit()` performs the same safe finalization and immediately dispatches `{ type: 'finished' }` after tracks and persistence are settled:

```ts
const pause = useCallback(
  () => commitCurrentSegment(),
  [commitCurrentSegment],
);

const exit = useCallback(async () => {
  await finishOnceRef.current!();
  dispatch({ type: 'finished' });
}, []);

const cancel = exit;
```

Use `exit()` rather than the confirmation-bearing `finish()` in page-hide, visibility-hide, and unmount cleanup paths. Keep all existing single-flight guards.

- [ ] **Step 4: Run the focused tests**

Run:

```bash
npx vitest run tests/unit/reflectionRecorderMachine.test.ts tests/unit/reflectionRecorderJournal.test.ts
```

Expected: both files pass with no unhandled promise rejection.

- [ ] **Step 5: Commit**

```bash
git add hooks/useReflectionRecorder.ts tests/unit/reflectionRecorderMachine.test.ts
git commit -m "fix(oracle): add explicit reflection exit lifecycle"
```

### Task 2: Implement the reflection layer stack and reliable exit paths

**Files:**
- Modify: `components/oracle/ReflectionRecorderBar.tsx`
- Modify: `components/oracle/ReflectionJournal.tsx`
- Test: `tests/oracle-reflection-recorder.spec.ts`

- [ ] **Step 1: Replace the obsolete lifecycle expectations with failing flow tests**

Add or update Playwright cases to assert:

```ts
test('Finish saves the segment and opens Journal', async ({ page }) => {
  // Start with the existing mockAdminRecorder helper and long-press sequence.
  const recorder = page.getByRole('navigation', { name: 'Private reflection recorder' });
  await recorder.getByRole('button', { name: 'Finish private reflection' }).click();
  await expect(page.getByRole('dialog', { name: 'Journal · 22' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Reading actions' })).toBeHidden();
});

test('Done exits Journal and restores the ordinary reading rail', async ({ page }) => {
  const journal = page.getByRole('dialog', { name: 'Journal · 22' });
  await journal.getByRole('button', { name: 'Done with reflection' }).click();
  await expect(journal).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Reading actions' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Card entrance. Tap to begin.' })).toHaveCount(0);
});

test('Invocation Back returns to Journal and Done exits everything', async ({ page }) => {
  const composer = page.getByRole('dialog', { name: 'Invocation composer' });
  await composer.getByRole('button', { name: 'Back to journal' }).click();
  await expect(page.getByRole('dialog', { name: 'Journal · 22' })).toBeVisible();
});
```

Retain the pending-transcription, failed-transcription, audio-player, and focus-trap coverage already present.

- [ ] **Step 2: Run the recorder browser spec and confirm failure**

Run:

```bash
npx playwright test tests/oracle-reflection-recorder.spec.ts --project="Desktop Chrome" --reporter=list
```

Expected: Finish currently exits instead of opening Journal, and Journal has no Done action.

- [ ] **Step 3: Make the recorder rail own the overlay stack**

In `ReflectionRecorderBar.tsx`, add stable handlers:

```ts
const openJournalAfterFinish = async () => {
  const saved = await recorder.pause();
  if (saved) setJournalOpen(true);
};

const exitReflection = async () => {
  setComposer(null);
  setJournalOpen(false);
  await recorder.exit();
};
```

Wire the rail’s Finish button to `openJournalAfterFinish`. Keep Journal mounted when opening Invocation, so Invocation’s close path only runs `setComposer(null)` and reveals the same Journal with its scroll and segment state intact:

```tsx
onCompose={(sessionId, segments) => {
  setComposer({ sessionId, segments: mapSegments(segments) });
}}
```

Pass `onClose={() => void exitReflection()}` and `onDone={() => void exitReflection()}` to Journal. Pass `onClose={() => setComposer(null)}` and `onDone={() => void exitReflection()}` to Invocation.

- [ ] **Step 4: Clarify Journal actions and semantics**

Extend Journal props with `onDone`. Use a single sticky action rail:

```tsx
<footer className="reflection-journal__actions" aria-label="Journal actions">
  <button type="button" onClick={onRecordMore}>Record more</button>
  {selectedSessionId && segments.length > 0 && onCompose && (
    <button type="button" onClick={() => onCompose(selectedSessionId, segments)}>
      Shift to invocation
    </button>
  )}
  <button type="button" className="is-primary" onClick={onDone} aria-label="Done with reflection">
    Done
  </button>
</footer>
```

The sticky header’s leading control remains a visible text button labeled `Close`; it uses the same complete-exit handler as Done. Remove the duplicate standalone compose footer and `Edit latest` action from the persistent rail; editing remains available on each segment.

- [ ] **Step 5: Run the flow tests**

Run:

```bash
npx playwright test tests/oracle-reflection-recorder.spec.ts --project="Desktop Chrome" --grep "Finish|Done|Journal|Invocation" --reporter=list
```

Expected: Finish-to-Journal, Close/Done exit, Record More, and Invocation Back pass.

- [ ] **Step 6: Commit**

```bash
git add components/oracle/ReflectionRecorderBar.tsx components/oracle/ReflectionJournal.tsx tests/oracle-reflection-recorder.spec.ts
git commit -m "fix(oracle): complete reflection overlay exit flow"
```

### Task 3: Apply the site-native recorder and Journal visual system

**Files:**
- Modify: `components/oracle/ReflectionJournal.tsx`
- Modify: `components/oracle/reflection-recorder.css`
- Test: `tests/oracle-reflection-recorder.spec.ts`

- [ ] **Step 1: Add failing theme and typography assertions**

Add browser assertions using computed style rather than screenshots alone:

```ts
const journal = page.getByRole('dialog', { name: 'Journal · 22' });
const transcript = journal.locator('.reflection-segment__transcript').first();
expect(await transcript.evaluate(el => getComputedStyle(el).fontFamily)).toContain('Cormorant');
expect(Number.parseFloat(await transcript.evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(20);
await expect(journal.locator('.reflection-journal__actions')).toHaveCSS('border-top-width', '1px');
```

Run the same recorder-shell color assertion in daybook and nightfall modes and assert the recorder background resolves from the reading’s `--l-bg`, not fixed `rgb(20, 16, 11)`.

- [ ] **Step 2: Run the visual contract tests and confirm failure**

Run:

```bash
npx playwright test tests/oracle-reflection-recorder.spec.ts --project="Desktop Chrome" --grep "theme|typography|compact rail" --reporter=list
```

Expected: the hardcoded recorder and Journal colors and undersized transcript fail.

- [ ] **Step 3: Rebuild the recorder rail with inherited tokens**

Replace hardcoded surfaces in `reflection-recorder.css`:

```css
.oracle-bottom-nav.reflection-recorder-bar {
  z-index: 42;
  color: var(--l-1);
  background: color-mix(in oklab, var(--l-bg) 96%, transparent);
  border-top: 1px solid var(--l-rule);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.reflection-recorder-bar__badge {
  color: var(--l-bg);
  background: var(--accent);
  border-color: var(--l-bg);
}
```

Keep the existing 480px five-slot grid, 44px targets, safe area, optical icon corrections, reduced-motion behavior, and live-state accessibility.

- [ ] **Step 4: Recompose the Journal as an editorial canvas**

Add a dedicated transcript class in JSX:

```tsx
{segment.transcript ? (
  <p className="reflection-segment__transcript">{segment.transcript}</p>
) : (
  <p className="reflection-segment__status">{transcriptionLabel(segment)}</p>
)}
```

Use inherited theme tokens and open sections:

```css
.reflection-journal {
  position: fixed;
  z-index: 120;
  inset: 0;
  overflow: hidden;
  color: var(--l-1);
  background: var(--l-bg);
}

.reflection-journal__sheet {
  width: min(100%, 820px);
  margin-inline: auto;
  background: var(--l-bg);
  border-inline: 1px solid var(--l-rule);
  box-shadow: none;
}

.reflection-segment__transcript {
  max-width: 62ch;
  margin: 12px 0 18px;
  color: var(--l-1);
  font: 400 clamp(20px, 2.4vw, 24px)/1.58 var(--font-display);
  white-space: pre-wrap;
}
```

Style the header and action rail as flat extensions of the page: opaque theme background, fine rules, Lato labels, Cormorant title, no radius, gradient, floating card, or drop shadow. Keep audio controls compact and visually subordinate to the transcript.

- [ ] **Step 5: Verify responsive geometry**

Run:

```bash
npx playwright test tests/oracle-reflection-recorder.spec.ts --project="Desktop Chrome" --project="Mobile Chrome" --reporter=list
```

Expected: all recorder tests pass at desktop and mobile sizes; Close and Done remain in viewport; no horizontal overflow is reported.

- [ ] **Step 6: Commit**

```bash
git add components/oracle/ReflectionJournal.tsx components/oracle/reflection-recorder.css tests/oracle-reflection-recorder.spec.ts
git commit -m "style(oracle): unify recorder and journal with reading chrome"
```

### Task 4: Align Invocation with Journal and add Back/Done behavior

**Files:**
- Modify: `components/oracle/invocation/InvocationComposer.tsx`
- Modify: `components/oracle/invocation/invocation-composer.css`
- Test: `tests/oracle-reflection-recorder.spec.ts`
- Test: `tests/oracle-invocation-composer.spec.ts`

- [ ] **Step 1: Write failing composer behavior tests**

Add a recorder flow test for `Back to journal`, Escape, and `Done with reflection`. Add a focused layout test:

```ts
const composer = page.getByRole('dialog', { name: 'Invocation composer' });
await expect(composer.getByRole('button', { name: 'Back to journal' })).toBeVisible();
await expect(composer.locator('.invocation-toolbar')).toHaveCSS('border-bottom-width', '1px');
expect(await composer.locator('.invocation-block textarea').first().evaluate(el => getComputedStyle(el).fontFamily)).toContain('Cormorant');
```

- [ ] **Step 2: Run the focused specs and confirm failure**

Run:

```bash
npx playwright test tests/oracle-reflection-recorder.spec.ts tests/oracle-invocation-composer.spec.ts --project="Desktop Chrome" --grep "Invocation|composer" --reporter=list
```

Expected: the composer only exposes an icon close button and lacks Done.

- [ ] **Step 3: Add explicit composer actions**

Extend the component props:

```ts
export function InvocationComposer({
  hexagramNumber,
  sessionId,
  segments = [],
  onClose,
  onDone,
  onPublished,
}: {
  hexagramNumber: number;
  sessionId: string;
  segments?: RecorderSegment[];
  onClose: () => void;
  onDone: () => void;
  onPublished?: () => void;
})
```

Render a visible `Back to journal` control in the header. Preserve `requestClose()` so dirty drafts still require confirmation. Add `Done` to the save rail; when dirty, publish first and only call `onDone` after `publish()` reports success. Make `publish()` return `true` on `saved_and_live` and `false` on error/conflict so the exit decision is not inferred from stale React state.

- [ ] **Step 4: Apply the shared editorial shell**

Replace generic fallback tokens and circular/icon-only close styling:

```css
.invocation-shell {
  position: fixed;
  z-index: 400;
  inset: 0;
  overflow: auto;
  color: var(--l-1);
  background: var(--l-bg);
  font-family: var(--font-ui);
}

.invocation-primary-surface {
  width: min(100%, 820px);
  min-height: 100%;
  margin-inline: auto;
  border-inline: 1px solid var(--l-rule);
}

.invocation-block textarea,
.invocation-title-field input {
  color: var(--l-1);
  background: transparent;
  font-family: var(--font-display);
  border: 0;
  border-bottom: 1px solid var(--l-rule);
  border-radius: 0;
}
```

Use the same header height, safe-area padding, rules, title scale, transcript measure, and bottom action rail geometry as Journal. Keep conflict and version history behavior intact while removing avoidable shadows and card treatments.

- [ ] **Step 5: Run invocation and recorder browser tests**

Run:

```bash
npx playwright test tests/oracle-invocation-composer.spec.ts tests/oracle-reflection-recorder.spec.ts --project="Desktop Chrome" --project="Mobile Chrome" --reporter=list
```

Expected: Back returns to Journal, Done exits after a successful save, failed saves keep the composer open, and existing public invocation tests pass.

- [ ] **Step 6: Commit**

```bash
git add components/oracle/invocation/InvocationComposer.tsx components/oracle/invocation/invocation-composer.css components/oracle/invocation/useInvocationComposer.ts tests/oracle-reflection-recorder.spec.ts tests/oracle-invocation-composer.spec.ts
git commit -m "style(oracle): refine invocation reflection workspace"
```

### Task 5: Harden browser navigation, focus, and animation continuity

**Files:**
- Modify: `components/oracle/ReflectionRecorderBar.tsx`
- Modify: `components/oracle/ReflectionJournal.tsx`
- Modify: `components/oracle/invocation/InvocationComposer.tsx`
- Test: `tests/oracle-reflection-recorder.spec.ts`

- [ ] **Step 1: Add failing layer-navigation tests**

Cover the exact stack:

```ts
await page.goBack();
await expect(page.getByRole('dialog', { name: 'Invocation composer' })).toHaveCount(0);
await expect(page.getByRole('dialog', { name: 'Journal · 22' })).toBeVisible();

await page.keyboard.press('Escape');
await expect(page.getByRole('dialog', { name: 'Journal · 22' })).toHaveCount(0);
await expect(page.getByRole('navigation', { name: 'Reading actions' })).toBeVisible();
await expect(page.getByRole('dialog', { name: 'Card entrance. Tap to begin.' })).toHaveCount(0);
```

Also verify focus returns to the Journal invocation button after closing Composer and to the reading’s center button after exiting Journal.

- [ ] **Step 2: Run the focused navigation test and confirm failure**

Run:

```bash
npx playwright test tests/oracle-reflection-recorder.spec.ts --project="Desktop Chrome" --grep "Back|Escape|focus|entrance" --reporter=list
```

Expected: browser Back is not yet consumed by the reflection layer stack.

- [ ] **Step 3: Add one history marker per full-screen layer**

When Journal opens, push a same-URL history entry containing a namespaced marker such as:

```ts
const REFLECTION_HISTORY_KEY = '__mandalaReflectionLayer';
window.history.pushState({
  ...window.history.state,
  [REFLECTION_HISTORY_KEY]: 'journal',
}, '', window.location.href);
```

Invocation pushes `invocation`. A `popstate` listener closes only the current top layer. Programmatic Close/Done removes its marker without navigating away from the reading. Guard every push and pop with refs so rerenders cannot duplicate entries, and remove listeners on unmount.

- [ ] **Step 4: Verify focus and cleanup**

Keep Journal mounted beneath Invocation, mark it inert/`aria-hidden` while Composer is present, and restore focus to the initiating control on close. Confirm body overflow is restored only after the last full-screen layer closes. The existing card entrance logic must remain untouched; test that no entrance dialog appears during or after reflection navigation.

- [ ] **Step 5: Run the complete recorder browser spec**

Run:

```bash
npx playwright test tests/oracle-reflection-recorder.spec.ts --project="Desktop Chrome" --project="Mobile Chrome" --reporter=list
```

Expected: all layer, focus, lifecycle, long-press, transcription, and animation-continuity tests pass.

- [ ] **Step 6: Commit**

```bash
git add components/oracle/ReflectionRecorderBar.tsx components/oracle/ReflectionJournal.tsx components/oracle/invocation/InvocationComposer.tsx tests/oracle-reflection-recorder.spec.ts
git commit -m "fix(oracle): harden reflection layer navigation"
```

### Task 6: Final visual QA and release verification

**Files:**
- Modify only files required by defects found during verification.

- [ ] **Step 1: Run static and unit verification**

```bash
npm run typecheck
npm run test:unit
```

Expected: 0 TypeScript errors and all unit tests pass.

- [ ] **Step 2: Run the complete relevant browser suite**

```bash
npx playwright test tests/oracle-reflection-recorder.spec.ts tests/oracle-invocation-composer.spec.ts --project="Desktop Chrome" --project="Mobile Chrome" --reporter=list
```

Expected: all selected Playwright tests pass.

- [ ] **Step 3: Run the production build**

```bash
npm run build
```

Expected: Vite and content-site production builds complete successfully and CSP headers are generated.

- [ ] **Step 4: Inspect the actual screen**

Run the local site and inspect Code 22 at narrow mobile, mobile landscape, and desktop widths in both color modes. Complete one mocked and one real-browser lifecycle where credentials permit:

1. Long press the center.
2. Record and Finish.
3. Confirm transcript typography and audio controls.
4. Record More, then Finish again.
5. Shift to Invocation and return to Journal.
6. Save/Done and verify the normal rail returns.
7. Confirm the entrance animation never reappears.

Expected: no overlap, clipped actions, hardcoded dark surface, trapped microphone, body scroll leak, or unexpected entrance animation.

- [ ] **Step 5: Commit verification fixes, if any**

```bash
git status --short
git add components/oracle/ReflectionRecorderBar.tsx components/oracle/ReflectionJournal.tsx components/oracle/reflection-recorder.css components/oracle/invocation/InvocationComposer.tsx components/oracle/invocation/invocation-composer.css hooks/useReflectionRecorder.ts tests/oracle-reflection-recorder.spec.ts tests/oracle-invocation-composer.spec.ts tests/unit/reflectionRecorderMachine.test.ts
git commit -m "fix(oracle): polish reflection experience"
```

Stage only paths shown as modified by the preceding `git status`; omit unchanged paths. Skip this commit when verification requires no changes.

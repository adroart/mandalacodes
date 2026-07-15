# Reflection Recorder Bar Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add all ten approved trust, activity, status, badge, icon, haptic, and accessibility improvements to the existing five-slot private reflection recorder bar.

**Architecture:** Keep `useReflectionRecorder` authoritative for persistence and recorder lifecycle, add a small browser-capability helper for microphone metering and haptics, and keep `ReflectionRecorderBar` presentation-only. Extend the reducer with saved-segment count and transient confirmation state so visual feedback is derived from confirmed local persistence instead of timing guesses.

**Tech Stack:** React 18, TypeScript, MediaRecorder, Web Audio API, IndexedDB reflection outbox, Vitest, Playwright, CSS.

---

## File Map

- Create `lib/oracle/reflectionRecorderFeedback.ts`: pure badge formatting, microphone-level normalization, capability-detected vibration, and Web Audio meter lifecycle.
- Modify `hooks/useReflectionRecorder.ts`: track saved segment count, precise persistence status, transient confirmation, microphone level, and cleanup.
- Modify `components/oracle/ReflectionRecorderBar.tsx`: render meter, badge, precise labels, accented Resume, haptics, and optically classified icons.
- Modify `components/oracle/reflection-recorder.css`: meter, badge, icon corrections, paused primary action, press feedback, and reduced-motion rules.
- Modify `tests/unit/reflectionRecorderMachine.test.ts`: reducer, badge, normalization, haptic, and meter-cleanup coverage.
- Modify `tests/oracle-reflection-recorder.spec.ts`: compact geometry, state sequence, badge accessibility, meter visibility, reduced motion, and regression coverage.

### Task 1: Persistence-derived recorder feedback state

**Files:**
- Modify: `hooks/useReflectionRecorder.ts:20-113, 280-360`
- Test: `tests/unit/reflectionRecorderMachine.test.ts`

- [ ] **Step 1: Write failing reducer tests**

Add assertions that `local_persisted` increments `savedSegmentCount`, changes the committing label to `Uploading`, and that successful/deferred commits set `confirmation: 'saved'`. Verify `clear_confirmation` removes only the transient confirmation and failed persistence never increments the count.

```ts
const local = reflectionRecorderReducer(committing, { type: 'local_persisted' });
expect(local).toMatchObject({ status: 'committing', savedSegmentCount: 1, message: 'Uploading' });
const saved = reflectionRecorderReducer(local, { type: 'commit_succeeded' });
expect(saved).toMatchObject({ status: 'paused', confirmation: 'saved' });
expect(reflectionRecorderReducer(saved, { type: 'clear_confirmation' }).confirmation).toBeNull();
```

- [ ] **Step 2: Run the reducer tests and confirm failure**

Run: `npx vitest run tests/unit/reflectionRecorderMachine.test.ts`

Expected: FAIL because the new fields and actions do not exist.

- [ ] **Step 3: Extend recorder state and persistence transitions**

Add:

```ts
confirmation: 'saved' | null;
savedSegmentCount: number;
```

Add actions `local_persisted` and `clear_confirmation`. Dispatch `local_persisted` only after the finalized blob passes duration, size, and non-empty checks. On upload success or deferral, enter paused state with saved confirmation. Schedule `clear_confirmation` after 900ms, cancel that timer on resume, finish, error, and unmount, and retain the existing rule that failed persistence never shows Saved.

- [ ] **Step 4: Run reducer tests**

Run: `npx vitest run tests/unit/reflectionRecorderMachine.test.ts`

Expected: PASS.

### Task 2: Browser feedback helper

**Files:**
- Create: `lib/oracle/reflectionRecorderFeedback.ts`
- Test: `tests/unit/reflectionRecorderMachine.test.ts`

- [ ] **Step 1: Write failing helper tests**

Cover badge formatting, amplitude normalization, vibration capability detection, and cleanup returned by the meter.

```ts
expect(formatRecorderSegmentCount(0)).toBeNull();
expect(formatRecorderSegmentCount(9)).toBe('9');
expect(formatRecorderSegmentCount(10)).toBe('9+');
expect(normalizeRecorderAmplitude(new Uint8Array([128, 128]))).toBe(0);
expect(normalizeRecorderAmplitude(new Uint8Array([0, 255]))).toBeGreaterThan(.9);
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `npx vitest run tests/unit/reflectionRecorderMachine.test.ts`

Expected: FAIL because `reflectionRecorderFeedback.ts` does not exist.

- [ ] **Step 3: Implement pure helpers and meter lifecycle**

Export:

```ts
export type RecorderHaptic = 'press' | 'saved' | 'error';
export function formatRecorderSegmentCount(count: number): string | null;
export function normalizeRecorderAmplitude(samples: Uint8Array): number;
export function triggerRecorderHaptic(kind: RecorderHaptic, vibrate?: (pattern: number | number[]) => boolean): void;
export function startMicrophoneMeter(stream: MediaStream, onLevel: (level: number) => void): () => void;
```

Use patterns `8`, `[8, 40, 8]`, and `20`. `startMicrophoneMeter` must return a cleanup function that cancels its animation frame, disconnects the analyser and source, closes the audio context, and resets the rendered level to zero. If Web Audio is unavailable, return a no-op cleanup without throwing.

- [ ] **Step 4: Run helper tests**

Run: `npx vitest run tests/unit/reflectionRecorderMachine.test.ts`

Expected: PASS.

### Task 3: Connect microphone level and haptics to recorder lifecycle

**Files:**
- Modify: `hooks/useReflectionRecorder.ts:127-180, 209-370`
- Modify: `tests/unit/reflectionRecorderMachine.test.ts`

- [ ] **Step 1: Add failing lifecycle assertions**

Add tests around exported lifecycle helpers or injected fakes proving that meter cleanup runs when pausing and finishing, save haptics occur only after local persistence, and error haptics occur after failure.

- [ ] **Step 2: Run the focused unit test and confirm failure**

Run: `npx vitest run tests/unit/reflectionRecorderMachine.test.ts`

Expected: FAIL on the new lifecycle expectations.

- [ ] **Step 3: Integrate feedback lifecycle**

Add `micLevel` to `UseReflectionRecorderResult`, keep meter cleanup in a ref, start the meter after microphone access and on Resume, and stop it before saving, on Finish, on error, on page hide, and on unmount. Trigger saved haptics after `local_persisted`; trigger error haptics in failure paths. No haptic or meter failure may interrupt recording.

- [ ] **Step 4: Run unit tests**

Run: `npx vitest run tests/unit/reflectionRecorderMachine.test.ts`

Expected: PASS.

### Task 4: Render the enhanced five-slot bar

**Files:**
- Modify: `components/oracle/ReflectionRecorderBar.tsx:14-90`
- Modify: `components/oracle/reflection-recorder.css:1-20`
- Test: `tests/oracle-reflection-recorder.spec.ts`

- [ ] **Step 1: Write failing browser assertions**

Assert:

```ts
await expect(recorder.locator('.reflection-recorder-bar__meter')).toBeVisible();
await expect(recorder.getByRole('button', { name: /Journal, 1 saved segment/ })).toBeVisible();
await expect(recorder.getByRole('button', { name: 'Resume recording a new segment' })).toHaveClass(/is-primary/);
await expect(recorder.getByText('Saved privately', { exact: true })).toBeVisible();
```

Also verify the rail remains five slots, no taller than 54px, and that reduced-motion disables the pulse animation.

- [ ] **Step 2: Run Playwright and confirm failure**

Run: `npx playwright test tests/oracle-reflection-recorder.spec.ts --project='Mobile Chrome'`

Expected: FAIL because the meter, badge, primary Resume class, and new confirmation are absent.

- [ ] **Step 3: Implement rendering and styling**

Render three decorative meter bars from `recorder.micLevel`, keep the live dot static when reduced motion is active, show the Journal badge only for positive counts, and include the count in the Journal accessible name. Classify icons by name for optical corrections. Add `is-primary` only to Resume, use exact labels from the design spec, and trigger the press haptic from pointer activation.

CSS must preserve `grid-template-columns: repeat(5,minmax(0,1fr))`, `max-width:480px`, and the existing bar height. Use transforms and opacity only for continuous visual motion.

- [ ] **Step 4: Run mobile and desktop browser tests**

Run: `npx playwright test tests/oracle-reflection-recorder.spec.ts`

Expected: all recorder tests PASS in Mobile Chrome and Desktop Chrome.

### Task 5: Visual QA and release verification

**Files:**
- Modify only files required by defects discovered during verification.

- [ ] **Step 1: Capture actual narrow-mobile, mobile, and desktop recorder states**

Capture Recording, Saved privately, Paused/Resume, and Saved-on-device states using the real Oracle card surface. Confirm icon weight, label fit, divider alignment, badge placement, meter restraint, safe-area behavior, and 44px height.

- [ ] **Step 2: Fix visual defects and rerun focused tests**

Use `apply_patch` for changes, then run:

```bash
npx vitest run tests/unit/reflectionRecorderMachine.test.ts
npx playwright test tests/oracle-reflection-recorder.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Run full relevant verification**

```bash
npm run typecheck
npm run build
git diff --check
```

Expected: TypeScript exits 0, production build completes, and `git diff --check` prints nothing.

- [ ] **Step 4: Review, commit, and push**

Review the complete diff for scope and privacy regressions, then commit implementation and tests:

```bash
git add lib/oracle/reflectionRecorderFeedback.ts hooks/useReflectionRecorder.ts components/oracle/ReflectionRecorderBar.tsx components/oracle/reflection-recorder.css tests/unit/reflectionRecorderMachine.test.ts tests/oracle-reflection-recorder.spec.ts INDEX.md
git commit -m "feat: enhance reflection recorder feedback"
git push origin codex/groq-reflection-recorder
```

Update PR #106 and report the verified behavior, commit, and check state.

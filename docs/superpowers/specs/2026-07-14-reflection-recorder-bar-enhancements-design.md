# Reflection Recorder Bar Enhancements

Date: 2026-07-14
Status: Approved concept; awaiting written-spec review

## Objective

Make the private reflection recorder feel trustworthy, responsive, and unmistakably active while preserving the existing Oracle bottom-navigation shell. The bar remains a solid, opaque, five-column, 44px control rail on mobile and desktop. These enhancements must not turn it into a taller toolbar, glass surface, or animated dashboard.

## Approved Interaction Model

The five slots remain:

1. Pause or Resume
2. Elapsed time
3. Hexagram number and recorder state
4. Finish
5. Journal

The bar gains ten coordinated improvements:

- A restrained live indicator in the center while recording.
- A clearer, stable timer using tabular numerals.
- Explicit `Saving` and `Saved` transitions.
- A segment-count badge on Journal.
- Optically normalized icons.
- Press feedback and supported-device haptics.
- A gold-accented Resume state distinct from Pause.
- A subtle microphone activity meter.
- Precise upload and retry language.
- A compact, temporary center confirmation after a segment is saved.

## Visual Design

### Shell and geometry

The current opaque `#14100b` shell, hairline slot dividers, 480px maximum inner width, safe-area handling, and five equal columns remain unchanged. No shadows, blur, gradients, floating pills, or increased bar height are introduced.

Icons share a 16px view box but receive optical corrections per glyph so Pause, Resume, Finish, and Journal appear to have equal visual weight. All controls retain at least a 44px touch target.

### Center state

The center slot remains the visual anchor. During recording it shows:

- the hexagram number;
- a three-bar microphone meter driven by live input amplitude;
- the word `Recording`;
- a restrained gold pulse.

The pulse and meter stop when paused. With reduced motion enabled, the pulse becomes a static gold dot and the meter updates without animated transitions.

After a segment is locally persisted, the center temporarily becomes `Saved privately ✓` for approximately 900ms, then returns to `Paused`. Finishing the reflection uses the existing whole-bar saved confirmation before restoring ordinary navigation.

### Timer

Elapsed time uses tabular numerals, consistent width, and slightly stronger contrast than supporting labels. It continues to show total elapsed reflection time across multiple segments rather than resetting visually after every pause.

### Journal badge

Journal displays a small segment-count badge only when at least one locally persisted segment exists. Counts above 9 render as `9+`. The badge represents saved segments, not pending network requests, and remains accurate when an upload is deferred.

## State and Feedback

The bar uses specific, short status language:

- `Recording` — microphone is active.
- `Saving` — current audio is being finalized locally.
- `Saved privately` — local persistence succeeded.
- `Paused` — ready to resume.
- `Uploading` — a saved segment is being sent to the private server endpoint.
- `Saved on device` — local persistence succeeded but upload is deferred.
- `Needs retry` — a recoverable local or upload problem requires action.
- `Requesting mic` — browser permission is pending.

The UI never displays `Saved` after a failed or zero-byte persistence operation.

Resume receives the gold accent because it is the primary next action while paused. Pause remains visually neutral while recording to avoid making a destructive-looking control dominant.

## Microphone Meter

The recorder creates one `AudioContext` and `AnalyserNode` for the active microphone stream. A small animation-frame loop samples time-domain amplitude and maps it into three discrete bar heights. It performs no audio transformation and sends no additional data anywhere.

The analyser and animation frame are stopped when recording pauses, finishes, errors, the page hides, or the component unmounts. If Web Audio is unavailable or blocked, the bar falls back to the static live dot without affecting recording.

## Tactile Feedback

Supported mobile browsers receive short, restrained vibration patterns:

- ordinary control press: 8ms;
- successful local save: two 8ms taps separated by 40ms;
- recoverable error: one 20ms tap.

The feature is capability-detected through `navigator.vibrate`. Failure or lack of support is silent. Visual feedback remains complete without haptics.

Every pressed slot also receives a brief color inversion using the existing accent and background tokens. Keyboard activation receives the same state transition without requiring vibration.

## Component Boundaries

- `useReflectionRecorder` remains the authority for recorder lifecycle, persistence outcome, elapsed time, saved segment count, and precise status.
- A small microphone-level helper owns `AudioContext`, analyser sampling, normalization, and cleanup.
- `ReflectionRecorderBar` renders the five slots, activity meter, badge, transient confirmation, and state-specific labels.
- Recorder CSS owns optical icon corrections, meter geometry, badges, press feedback, reduced motion, and narrow-screen label compression.

No journal, transcription-provider, navigation, or database architecture changes are required.

## Accessibility

- All controls keep their existing accessible names and 44px targets.
- The meter and decorative pulse are hidden from assistive technology.
- State changes are announced through the existing polite live region without announcing every amplitude update.
- Color is never the only indicator of recording, paused, saving, offline, or error state.
- Badge text is included in the Journal accessible name, for example `Journal, 3 saved segments`.
- Reduced-motion behavior removes continuous pulse animation.

## Testing and Verification

Unit coverage will verify:

- saved-segment count increments after local persistence, including deferred uploads;
- failed or empty recordings do not increment the count or show saved confirmation;
- count formatting caps visually at `9+`;
- precise labels for recording, saving, local-only, retry, and paused states;
- microphone-level normalization and cleanup;
- haptics are capability-detected and never required for success.

Browser coverage on mobile and desktop will verify:

- the bar remains five equal slots and no taller than the existing navigation;
- Resume receives the accent only while paused;
- the live meter appears only while recording;
- Saving and Saved confirmations occur in order;
- Journal badge and accessible name match saved segment count;
- native long-press suppression and ordinary short-tap navigation remain intact;
- reduced-motion mode has no continuous recorder animation.

Visual QA will cover narrow mobile, standard mobile, and desktop widths using the actual Oracle card screen. Production build, TypeScript, focused unit tests, and the full recorder Playwright suite must pass before pushing.

## Non-goals

- Changing the five-slot navigation structure.
- Increasing the bar height.
- Adding waveform recording, audio editing, or live transcription to the bar.
- Displaying network diagnostics or provider names in the compact rail.
- Changing journal layout or transcription-provider behavior.

# Reflection System Redesign

Date: 2026-07-16
Status: Approved concept; awaiting written-spec review

## Objective

Make recording, reviewing, and transforming a private reflection feel like one native part of the Mandala Codes reading experience. The recorder rail, journal, and invocation composer must use the site's quiet editorial language, respect the active color mode, and always provide a clear route back to the reading.

This is an interface and lifecycle refinement. Existing recording, transcription, persistence, retry, and invocation-generation systems remain authoritative.

## Approved Experience

The primary flow is:

`Record -> Finish -> Journal -> Invocation (optional) -> Done -> reading`

- A long press on the reading center starts the recorder and suppresses native browser long-press behavior.
- `Finish` stops the active segment, persists it, and opens the full-screen Journal after finalization.
- `Done` from the Journal stops any remaining recorder activity, closes the entire reflection experience, and restores the normal site navigation.
- `Close` from the Journal also exits to the reading without deleting saved work.
- `Shift to Invocation` opens the Invocation Composer above the Journal.
- `Close` or browser Back from Invocation returns to the Journal so the user does not lose their place.
- `Done` from Invocation saves the current invocation, closes both full-screen layers, and returns to the reading.
- Escape follows the same hierarchy on keyboard-capable devices: Invocation to Journal, then Journal to reading.

There must be no trapped recorder or full-screen state. Closing a surface never discards a persisted recording or transcript.

## Design Direction: Editorial Rail

The redesign uses the selected Editorial Rail direction: flat, restrained, typographic, and structurally related to the existing bottom navigation. It must not introduce glass, floating pills, gradients, heavy shadows, luminous effects, or generic application cards.

### Shared visual language

- Surfaces inherit the site's active light or dark theme tokens instead of hardcoded black backgrounds.
- Cormorant Garamond is used for reflection prose, transcript content, invocation content, and editorial titles.
- Lato/Helvetica is reserved for controls, status, timestamps, compact metadata, and uppercase labels.
- Hierarchy comes from type scale, whitespace, and fine rules.
- Bronze is an accent for state and primary action, not a fill applied to every control.
- Icons use the same thin, optically balanced line language as the normal site navigation.
- All persistent controls meet a 44px minimum touch target and include safe-area padding.

## Recorder Rail

The recorder rail is a true variant of the normal bottom navigation rather than a separate floating panel. It shares the navigation's width, background, border, theme behavior, icon scale, typography, and vertical rhythm.

The five stable slots are:

1. Pause or Resume
2. Elapsed time
3. Reading number and recorder state
4. Finish
5. Journal

Slot widths remain stable as state labels change. Fine vertical dividers and the top rule align with the site's normal navigation geometry. The center status uses quiet state language and never expands the bar.

`Finish` is a completion action, not a permanent recorder mode. While finalizing, it becomes disabled and communicates `Saving`. Once persistence is complete, the rail transitions into the Journal. If finalization fails, the rail remains available with an explicit retry state and a separate exit path; it never falsely reports success.

## Full-Screen Journal

The Journal is a theme-aware editorial canvas covering the reading and temporary recorder rail. It locks background scrolling and replaces the bottom recorder rail with its own contextual action rail.

### Header

The sticky header contains:

- a clearly labeled `Close` control at the leading edge;
- centered context: `Private reflection` and `Journal · {reading number}`;
- an optional history or entry-count affordance at the trailing edge.

The close control remains visible at all scroll positions and must not overlap the reading context panel.

### Entry structure

Each segment is an open editorial section separated by a fine rule, not a card. It contains:

- segment number and timestamp in the UI font;
- compact audio playback and duration controls;
- transcription status only when work is genuinely pending or failed;
- the transcript as the primary content in Cormorant Garamond at a comfortable reading size and line length;
- subtle actions for retrying, editing, or reordering when applicable.

Successful transcriptions replace pending language immediately. Empty transcripts are not treated as success. Provider or network diagnostics stay out of the primary reading surface.

### Journal action rail

A site-native bottom rail remains available above the safe area with three conceptual actions:

- `Record More`
- `Shift to Invocation`
- `Done`

On narrow screens these may use icons plus compact labels, but the meaning and order remain stable. `Done` is the unmistakable way to finish and exit the reflection experience.

## Invocation Composer

Invocation uses the same full-screen shell, active color mode, header geometry, typography, rules, and safe-area treatment as the Journal. It should feel like a quieter editorial transformation of the transcript, not a second application layered over the site.

### Structure

- The header identifies the current reading and provides `Back to Journal` or `Close` at the leading edge.
- Arrangement and generated invocation content use open sections with whitespace and rules rather than bordered cards.
- The selected reflection excerpts remain visually subordinate to the composed invocation.
- Invocation prose uses Cormorant Garamond with the site's established reading measure.
- Lato labels distinguish selection, generation, saving, and error states.
- The bottom action rail provides the smallest necessary set of actions: regenerate or revise when supported, save, and `Done`.

Opening Invocation preserves Journal scroll position and selection state. Returning to Journal must not re-trigger the Mandala entry animation.

## State and Navigation Contract

The reflection overlay stack is explicit:

- Reading: normal bottom navigation is visible.
- Recorder: recorder rail replaces normal bottom navigation.
- Journal: full-screen Journal and Journal action rail replace the recorder rail.
- Invocation: full-screen Invocation and Invocation action rail sit above Journal.

Only the topmost surface receives interaction. Browser Back closes one reflection layer at a time before leaving the reading. Exiting the complete experience restores the reading in place and does not replay its entrance animation.

Recorder cleanup runs on successful `Done`, explicit `Close`, route change, and component unmount. It releases media tracks, timers, analyser resources, pending animation frames, and body scroll locks. Persisted work and queued transcription requests remain intact.

## Accessibility and Responsive Behavior

- Modal surfaces use correct dialog semantics, a descriptive accessible name, focus entry, focus containment, and focus restoration.
- State changes use a polite live region without repeatedly announcing elapsed time or audio levels.
- Every icon-only presentation retains a visible or accessible text label.
- Color is never the only indicator of recording, saving, success, or failure.
- Reduced-motion mode removes nonessential recorder pulses and surface transitions.
- Mobile layouts account for notches, browser chrome, landscape height, and the on-screen keyboard.
- Transcript lines retain a readable measure on desktop and do not become undersized on mobile.
- The close and done actions remain visible or immediately reachable at 320px width and short landscape heights.

## Implementation Boundaries

- Reuse the existing recorder hook and state machine; extend lifecycle events only where a reliable exit transition is missing.
- Reuse existing journal storage, transcription polling/retry, and invocation APIs.
- Consolidate the recorder, Journal, and Invocation around shared theme tokens and a small shared full-screen reflection shell where that removes divergence.
- Do not change the transcription provider, database schema, audio format, or public API as part of this redesign.
- Do not change the site's normal bottom-navigation behavior outside the reflection state.

## Verification

Focused unit tests must cover:

- Finish finalizes a segment and opens Journal only after a valid persistence outcome.
- Done and Close both restore idle recorder state and normal navigation.
- Invocation Close returns to Journal; Invocation Done exits the full experience.
- browser Back and Escape close one layer at a time.
- cleanup releases microphone and scroll-lock resources.
- successful, pending, empty, and failed transcription states render accurately.
- exiting Journal or Invocation does not replay the reading entrance animation.

Browser and visual QA must cover:

- iPhone Safari and Chrome long press, native-callout suppression, recording, Finish, transcription, and Done exit;
- Android Chrome long press and the same lifecycle;
- narrow mobile, mobile landscape, tablet, and desktop layouts;
- both light and dark modes;
- keyboard focus order, Escape, browser Back, and focus restoration;
- real transcript typography and multi-segment overflow;
- Invocation entered from Journal and returned without visual or state loss;
- restoration of the existing normal bottom navigation after exit.

TypeScript, focused unit tests, the full relevant test suite, production build, and direct browser inspection of the actual reading screen must pass before pushing.

## Non-goals

- Replacing or re-architecting the working transcription service.
- Adding new recording formats, waveform editing, or transcript translation.
- Redesigning the entire Oracle reading screen or global navigation.
- Replaying the Mandala entrance animation during internal reflection navigation.
- Introducing a new visual language distinct from Mandala Codes.

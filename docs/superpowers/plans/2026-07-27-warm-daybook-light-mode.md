# Warm Daybook Light Mode Implementation Plan

**Goal:** make light mode a complete warm Daybook rendering of the existing site while preserving fonts, layout, dark mode, artwork, and the Atlas globe stage.

## 1. Lock the theme contract with tests

- Update `tests/oracle-visual-foundation.spec.ts` so the reader is expected to use Daybook in light mode and Nightfall in dark mode.
- Add a focused route-level Playwright contract for representative shells and the Atlas mixed-surface exception.
- Run the focused tests against `http://127.0.0.1:2222` and retain the expected failures before implementation.

## 2. Repair Oracle reading palettes

- Replace the hard-pinned espresso variables and chapter backgrounds in `components/oracle/eb/oracle-foundation.css` with the existing Daybook/Nightfall palette variables.
- Replace full-bleed shell/footer literals in `components/oracle/reading/card-reading-fullbleed.css` with palette-relative values.
- Preserve all typography, spacing, choreography, and generated reading files.

## 3. Make Atlas a mixed-surface page

- Remove the forced `.dark` scope from the entire `components/AtlasPage.tsx` page.
- Keep the actual globe stage and stage-only overlays under an explicit dark scope.
- Let `components/atlas/TheLedger.tsx` and ordinary page chrome consume the active shared theme tokens.
- Keep artwork plates, HUD surfaces, and marker/globe colors dark and unchanged.

## 4. Align remaining shells

- Apply the shared paper/ink/recess/bronze tokens to any audited light-mode holdouts in public Oracle, profile/account, navigation, dialogs, and `/learn` surfaces.
- Do not recolor controlled artwork, export, print, or Lightweaver studio surfaces unless they are ordinary site chrome.

## 5. Verify and ship

- Run focused Playwright checks in light and dark modes at desktop and mobile sizes.
- Inspect representative screenshots in the real browser.
- Run unit tests, type checking, and production builds; distinguish any pre-existing unrelated failures.
- Review the diff for font/layout/copy drift, commit, push `codex/light-mode-system`, and report the verified behavior.

## Self-review

The plan targets the two systemic causes first: Oracle palette overrides and the Atlas page-wide dark scope. The remaining audit is constrained to token adoption, which minimizes regression risk. Test coverage asserts user-visible computed colors and deliberate dark exceptions rather than implementation details.

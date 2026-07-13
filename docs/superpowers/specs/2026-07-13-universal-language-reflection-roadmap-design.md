# Universal Language Reading and Reflection Roadmap

**Status:** Approved design, decomposed into four independently shippable builds.

## Purpose

Restore the intended Teajia-aligned reading character across Mandala Codes, make the mobile hexagram navigation safe and centered, and give the administrator a private spoken-reflection workflow that can organically become a published invocation.

## Delivery order

1. **Typography foundation** — isolated font and type-system pass. See `2026-07-13-universal-language-typography-design.md`.
2. **Reading experience** — boxes, reveal motion, and centered mobile navigation. See `2026-07-13-universal-language-reading-experience-design.md`.
3. **Reflection recorder** — administrator-only segmented recording and journal. See `2026-07-13-universal-language-reflection-recorder-design.md`.
4. **Invocation composer** — linked Markdown composition, versioning, and live placement after each reading. See `2026-07-13-universal-language-invocation-composer-design.md`.

Typography is deliberately isolated so font loading, hierarchy, rhythm, and responsive readability can be judged without motion or layout changes obscuring the result. Each later build depends on the preceding public-facing foundation but can be implemented and verified separately.

## Shared product rules

- Public reading remains the primary experience.
- The recording workflow is available only after server-side administrator verification.
- A long-press on the centered current hexagram starts recording immediately and replaces only the bottom sticky bar.
- Private reflections are never assimilated or published without an explicit administrator action.
- Each Universal Language page begins with its reading and then reveals its latest saved invocation.
- If a hexagram has no saved invocation, its page ends cleanly after the reading.
- Historical recordings and invocation versions remain recoverable.
- Public interfaces preserve reduced-motion, keyboard, touch-target, and safe-area behavior.

## Out of scope

- Recording or journal access for non-administrators.
- Automatic AI rewriting or automatic assimilation.
- Combining all historical reflections into one initial journal view.
- A global invocation directory on the Universal Language index.

## Success sequence

An administrator reads Hexagram 22, holds the centered `22 / ALL 64` constellation, speaks while continuing to scroll, pauses to commit a segment, resumes to add another, opens the newest-first journal, drags segments into order, shifts into a full-screen Markdown invocation, edits linked paragraphs, saves, and immediately sees the newest invocation after the public Hexagram 22 reading.

# Whole-card voice workflow implementation plan

**Goal:** Capture an entire card in one speaking session, assimilate speech into complete named sections, review equal original/human columns, and integrate exact sections into private drafts.

**Architecture:** A stable section map sits above the six lens ranges. Durable section sessions reference existing saved audio and retain raw transcripts separately from AI assimilation results. AI proposes named destinations and evidence-linked cleanup; checked section patches reuse version-checked working-card writes, never canonical publication.

**Stack:** React/TypeScript, existing IndexedDB audio and working stores, AR Create bounded writing runner, Vitest and Playwright.

- [x] Map all 64 manuscripts into named sections, including lens intros and moving lines; separate displayed card intro.
- [x] Add durable versioned section draft sessions, checked integration, idempotent evidence and guarded undo.
- [x] Add actual bounded AI assimilation with exact spoken evidence, uncertainty, restarts and unknown-section validation.
- [x] Build a compact studio: choose starting section, Record/Pause/Next section/Finish & review, then section queue and two equal text columns.
- [x] Keep microphone open while advancing sections; section markers never split paragraphs or mutate the reading.
- [x] Save original audio, raw transcript and AI cleanup separately; allow resume, reprocessing and corrected text.
- [x] Integrate individual or all checked sections, preserving neighbors and source revision safeguards.
- [x] Render private intro and named subsection headings in the reader.
- [x] Retain earlier recordings and paragraph re-recording as secondary paths.
- [x] Verify actual AI provider on synthetic speech, focused boundaries/staleness tests, and desktop/phone screens.

Publication is outside this build request. The existing recorder and importer support 20-minute/10MiB takes; a session can collect multiple takes. Inference operates on saved speech and returns review candidates; it never silently publishes a draft.

Verified with the actual bounded AI runner on a synthetic two-section recording transcript, full 64-card range coverage, exact neighbor-preserving patches and recovery tests, plus desktop Chromium and phone WebKit browser flows. No canonical manuscript or production release was changed.

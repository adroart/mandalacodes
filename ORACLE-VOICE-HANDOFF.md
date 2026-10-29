# Oracle voice workflow: Adrian's guidance and Claude handoff

Distilled from this project's Oracle voice conversation through 30 October 2026. Read this before changing the workflow. This is a product brief, not an endorsement of the current design. Adrian still finds the interface too complicated and wants a substantially better implementation.

## Start here, Claude

Improve and build the existing Oracle card recording, transcription, comparison and replacement workflow. Inspect the real code and run the actual app before proposing a design. Prioritize a simple, coherent mobile experience and a comfortable desktop experience. Preserve working recording, evidence, human authorship, save/recovery and undo behavior. Do not solve confusion by adding another layer of tabs, boxes, explanations or controls.

The intended experience is: open a card, speak through its sections, continue without waiting for processing, review the original beside the spoken words, resolve the occasional real uncertainty, and use the human words in the correct place. The user should always understand which section is being recorded and what will be replaced.

Use this file as the primary user brief. Read `AGENTS.md`, `oracle/INDEX.md`, `PRODUCT.md`, `DESIGN.md`, `docs/plans/oracle-voice-twenty.md` and `docs/oracle-private-authoring-hosted.md` for repository rules, implementation details and release limitations. The local project rules prohibit accordions and protect canonical card prose. Do not overwrite unrelated work in other checkouts.

Repository: https://github.com/adroart/mandalacodes

Example card: `/universal-language/2`. Current local Oracle preview uses port 4242. Production website: https://mandalacodes.com/universal-language/2 . A production page is not evidence that the latest native app or hosted processing configuration is ready.

## The central purpose

Adrian is replacing AI-written card prose with his own spoken thoughts. His words take precedence. This is an authoring tool he intends to use repeatedly, not a one-time recorder or transcript demo.

He may read from the on-screen card, read from a printed book, rehash existing wording, improvise, speak one passage, speak a whole section, or speak through the entire card. A chain can span multiple sections and multiple cards. Recording cannot assume one paragraph or one destination.

Preserve his phrasing and meaning. AI helps recognize structure, align passages, catch transcription problems and remove clearly documented speech glitches. It must not turn human speech back into AI-written prose.

## The three phases must flow together

### 1. Choose and speak

- Recording is an explicitly activated mode inside the card. It must not cover or replace the normal reading before activation.
- Start from the section or selected passage the user is actually looking at. Make the target obvious beside the passage and while recording.
- Selection and ingestion should be automatic when the evidence supports it. Understand the complete card structure, headings, spoken references and recognizable passage content.
- Let the user scroll through the full ordered manuscript and read ahead to know what comes next. Do not force opening dropdowns or accordions for every section.
- Reading ahead must not silently move the microphone destination. Distinguish the section being viewed from the section being recorded.
- Provide an obvious next-section action. At the end of a section, send it for processing and move on immediately. Processing must not block recording the next section.
- Let the user stop and review/integrate at any point. Offer continuous recording as an option, not an unexplained automatic default.
- Spoken section names, next-section instructions, named hexagrams/gates and explicit card chains should help route speech. Ambiguity should remain recoverable for review.
- Live recognition is capability-dependent. Do not pretend unsupported devices have reliable voice navigation; visible controls must always work.
- Long sessions need bounded durable takes. Retain audio before processing. A pause, reconnect, reload or provider failure must not silently lose recorded work.
- A short test recording must be easy to find, discard and restore without changing the card.

### 2. Assimilate and compare

- Compare the spoken passage against the actual reading being changed, using AI and a clear visual comparison together. An isolated transcript is insufficient.
- Understand a complete section and combinations of passages, not just the last paragraph or loose keyword match.
- Show the exact destination section above the comparison. Show the original and editable human words with consistent, readable typography.
- Desktop: side by side. Phone: original above, human words below, with linked scrolling where useful. Keep significantly more screen space for the text than for headers, footers and controls.
- Match related passage pairs when supported by evidence. Fall back honestly to a whole-section comparison rather than inventing precise alignment.
- Compare against the latest human-edited reading for later revisions. Keep the earlier undo snapshot distinct from the current comparison baseline.
- Replay should follow and highlight spoken words, like Apple's playback experience. Use actual timing; allow a passage/phrase to be replayed and words clicked to seek when timing exists.
- Remove stutters, abandoned starts and obvious repeated attempts only through accountable assistance. Keep the raw transcript and recording. Let the user restore removed wording.
- Flag likely mishearing, a glitch or wording that clearly does not fit. Human oversight should be needed infrequently, not on every ordinary passage.
- Adrian's expectation was that most transcription could be checked automatically, roughly 90–95%, with questions only for potential mishaps. This is a desired experience, not a measured accuracy claim.
- Give uncertain words a precise quote and relevant audio. Do not repeat the same warning in several places or require broad, unexplained approval rituals.
- Do not automatically force ambiguous or test speech into a section. Keep it saved and make correction straightforward, with an explicit destination and review before integration.
- Make human edits easy, including selecting a phrase to re-record without replacing neighboring words.

### 3. Integrate and continue

- Default intent is generally replacement of the existing AI prose with human speech. After human replacement, later speech may add to or revise it.
- Distinguish replacement, addition and targeted revision clearly. Preserve neighboring passages and already completed work.
- The user should understand what pressing the main button will do, without learning internal terms such as assimilation, routing or attachment receipts.
- Once transcription is sufficiently checked, apply smoothly. Do not require repetitive manual approval of every normal fragment or make the user revisit everything later.
- Preserve an immediate undo path and a way to see the updated words in the card. Then make the next recording easy.
- Show an honest human-authorship indicator, including when the relevant writing is fully human. Never mark retained AI prose as human merely because a human addition follows it.
- Keep card/section title editing separate from passage content. Put the title directly above the passage and let it be edited by hand.

## The section model is essential

The workflow must understand the complete manuscript, including:

- Intro and the main Universal Language reading.
- I Ching: combination, upper nature/trigram, lower nature/trigram, reading, image, judgement, moving lines and their resulting hexagrams.
- Gene Keys: introduction, Shadow, repressive and reactive natures, Gift, Siddhi/Unity and the card's actual named subsections.
- Human Design: gate, its drive, centre, channel/completing gate and remaining named subsections.
- Body and Relations, with their named subsections and links.

Use the parsed manuscript as authority. This list expresses the user's scope; it must not become a second hard-coded or incomplete card template. Example: a recording of Gate 2, Direction of the Self, can cover its whole Human Design material and then continue onward.

## Selecting a passage and using a teleprompter

The user may select an existing passage and press Re-record. Isolate that text as a readable prompt, let him speak over it, compare/check the result, then replace only that selected span. Do not duplicate an entire editor workflow or lose the source location. He may instead use a printed book, so speech/context matching remains necessary without an on-screen selection.

## Design direction and repeated corrections

- Keep it simple, intuitive, sleek, minimal and well organized. Subtle but definite boundaries, useful dividers, readable text, and quality buttons.
- Black/dark surfaces were explicitly requested. Avoid drifting into brown, oversized serif controls, bulky panels or inconsistent font families.
- Use a consistent readable sans family for the working interface. Keep interface type and passage sizes restrained and coherent.
- Do not confuse simplicity with shrinking everything. Preserve legibility and useful touch targets.
- No accordions, expandable cards or details/summary disclosures. Use normal navigation to focused editing/history screens instead.
- Minimize vertical scrolling caused by interface chrome. Avoid horizontal scrolling. Compact controls should sit beside their content when readable.
- The normal review should feel like two texts and a clear action, not a control dashboard. Avoid repeated destination headers, match explanations, multiple playback buttons, filter rows and attachment forms competing with the comparison.
- A button must name its action and consequence. Do not make the user guess what Select, Attach or an unlabelled icon means.
- Keep recording clearly discoverable and attached to its passage. Merely changing button text or adding another button did not resolve the overall UX problem.
- Earlier three visual prototypes were shown. Adrian chose version 2 for section movement and version 3 for comparing his words with the original. Preserve the intent, not every pixel of the prototypes.
- Phone layout deserves real design work. He repeatedly asked to reduce top and bottom chrome so much more text is visible. Desktop also needs a deliberate layout, not a stretched phone screen.
- The design remains unsatisfactory to Adrian. Test actual comprehension, not just whether a button is visible or a screenshot fits.

## Twenty accepted improvement areas

All were approved for implementation, with 1–8 first. Detailed implementation notes and proof are in `docs/plans/oracle-voice-twenty.md`.

1. Latest human baseline, distinct undo snapshot.
2. Compact mobile header and separate secondary tasks.
3. One editable title, separate from prose.
4. Content-driven comparison space, less empty editor area.
5. Pinned recording target, separate from reading ahead.
6. Exact passage selection in the same workflow.
7. Real supported speech commands and timed boundaries.
8. Exception-first review without hiding normal passages permanently.
9. Precise uncertainty quotes and audio evidence.
10. Bounded passage/phrase replay and optional looping.
11. Phrase re-recording preserving surrounding words and evidence.
12. Optional continuous Send & next.
13. Durable bounded rolling takes with complete aggregation.
14. Recoverable, documented speech cleanup.
15. Replace/add/revise intent with truthful human/AI provenance.
16. Explicit cross-card chains and correctly sourced linked drafts.
17. Contextual transcription vocabulary.
18. Authenticated hosted processing and reconnect recovery.
19. Private account continuity for audio, drafts, linked cards and resume position, with conflict checks.
20. Updated-reader destination, undo and next recording.

Do not interpret this feature list as a requirement to display twenty controls. Most of the intelligence should stay behind the simple flow.

## Existing implementation to inspect

- `components/oracle/authoring/SectionVoiceStudio.tsx` and `.css`: main recording/review workspace. Currently large and deserves careful simplification; preserve async and stale-edit protections.
- `SectionPassageReview.tsx`, `EditableText.tsx`, `WordReplay.tsx`: comparison, editing and timed playback.
- `WorkingCardReading.tsx`, `namedReadingRanges.ts`: private human reading, subsection labels and retained source context.
- `src/mobile/authoring/sectionTakes.ts`, `sectionWorkflow.ts`, `sectionAssimilation.ts`: durable takes, related cards, processing and evidence alignment.
- `voiceCapturePass.ts`, `voiceCaptureRouting.ts`, `voiceTargets.ts`, `voicePhraseRevision.ts`: continuous capture, boundaries, precise targets and phrase revision jobs.
- `speechCleanupReview.ts`, `focusSections.ts`, `backgroundRecovery.ts`: cleanup recovery, exact source spans and interrupted work.
- `lib/oracle/authoring/sectionDrafts.ts`, `recorder.ts`, `audioEvidence.ts`: draft/CAS state, microphone/audio and receipt evidence.
- `processing.ts`, `privateSync.ts`, `voiceWorkspaceSync.ts`, `VoiceSyncTools.tsx`: local/hosted transport and account-private continuity.
- `functions/api/oracle/authoring/`: authenticated hosted processing and private-storage endpoints.
- `tools/oracle-section-assimilation.mjs`: faithful human-speech analysis and structured evidence validation.
- `tests/oracle-section-workflow.spec.ts`, `tests/oracle-passage-authoring.spec.ts`, `tests/unit/oracle-authoring/`: meaningful regression coverage.
- `docs/mockups/voice-review-options.html`: earlier visual alternatives, not production UX authority.

The latest simplification removes filter rows, repeated match/destination bars and bulk/cleanup controls from the default comparison. Those secondary controls live in Tools. Unmatched speech has a separate focused destination/review screen with no dropdown. It is still appropriate to redesign this substantially around Adrian's actual task.

## Truth, data and delivery boundaries

Canonical card prose lives in `oracle/cards/NN.md`. Private recorded revisions are a separate layer. Do not overwrite canonical manuscripts while improving UI or leak private recordings into the public repository.

Preserve raw audio/transcripts, timing, exact source snapshots/hashes, human provenance, optimistic concurrency and undo receipts. Never silently replace newer checked/applied/manual work with an older background result. Restored recordings must retain correct per-take audio references; linked-card recovery must not process completed takes twice.

At the time of this handoff, the new web workflow is built and locally verified. Hosted phone-independent processing/private sync require the new routes, server-side provider configuration and authenticated native session readiness. The native account flag defaults off in this candidate. Read the hosted document before promising standalone phone behavior. A local preview is not proof of a deployment or phone installation.

Build 13 was the last phone installation verified in this conversation. The later design/flow changes must not be described as installed without fresh signed-build/device proof. The user wants to run the app directly; Tailscale or a paired Mac should not become a mysterious mandatory requirement for ordinary use. Where dependencies remain, explain them honestly and build the proper hosted path.

Release through the repository's existing checks and exact-revision background delivery procedure. Keep product editing independent of release supervision. Do not use a model to poll CI. Report Publishing in background until independent production proof exists.

## Acceptance: demonstrate the actual work

Walk through these scenarios on an actual phone-sized screen and desktop:

1. From ordinary reading, find recording immediately and know the selected section.
2. Speak Intro, send it, continue into Reading while Intro processes.
3. Read ahead without silently recording over a different section.
4. Speak a complete multi-subsection section and an explicit cross-card chain.
5. Compare the correct existing passage and editable human words with minimal chrome.
6. Hear an uncertain word in context, correct it, and use the human words in the named destination.
7. Resolve unmatched speech without a wall of forms, a dropdown per fragment or guessing where it attaches.
8. Re-record a selected phrase/passage while preserving neighboring content and headings.
9. Replay with real word highlighting, then return to editing at the same place.
10. Integrate, see the updated reading, undo, and continue. Confirm truthful human authorship.
11. Discard a short test, recover interrupted audio and resume without duplicated processing.
12. Verify real hosted and native prerequisites separately from mocked provider/UI checks.

A stronger design should make these steps self-evident. Do not declare success solely from test counts, fitting the viewport or renaming the same confusing controls.

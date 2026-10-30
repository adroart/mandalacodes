# Oracle voice workflow: twenty approved improvements

Approved 2026-10-29. Start with 1–8; retain the complete scope. Product goal: human speech replaces AI-authored prose with clear, evidence-linked review and minimal mobile controls. No accordions. Recording stays opt-in. Publishing is separate from this implementation.

1. Latest human comparison baseline, separate undo receipt.
2. One compact mobile workspace header; secondary tools get their own screen.
3. One editable section title.
4. Reading space follows content rather than empty fixed editors.
5. Pinned recording target distinct from reading ahead.
6. Exact selected passages enter the same workspace.
7. Actual supported speech commands create explicit timed boundaries.
8. Exception-first review with normal passages still available.
9. Precise quoted uncertainty and audio evidence.
10. Passage/phrase replay bounds and optional looping from real timestamps.
11. Selected phrase re-recording preserves surrounding words and evidence.
12. Opt-in continuous Send & next.
13. Bounded rolling takes preserve delivered audio and microphone stream.
14. Auditable abandoned starts and retained wording, original transcript kept.
15. Replace/add/revise intent with honest provenance.
16. Explicit multi-card chains create correctly sourced linked drafts.
17. Contextual transcription glossary.
18. Authenticated hosted processing, offline recording and reconnect recovery.
19. Account-private revision-checked audio/draft/resume continuity.
20. Updated-reader destination, immediate undo and next recording action.

Validation: focused model/persistence tests; real desktop and phone-sized workflow checks; local hosted-route authorization/CAS/provider tests. Hosted processing/private sync cannot be claimed live until the new routes and server-only provider configuration are released. Existing local AR Create processing remains available.

## Built candidate and release boundary

All twenty items have executable implementation paths. The first eight are in the default compact workspace: single-row mobile toolbar, separate title editing, current-human baselines, pinned capture versus reading-ahead focus, exact source selections, supported final-recognition navigation, and an exception-first queue. Selected-span replacement preserves canonical headings and returns to the reader.

Later items include bounded phrase replay/looping, durable phrase re-record jobs, opt-in continuous passes with a retained microphone, serialized accumulating safety-roll takes, recoverable documented cleanup, provenance-preserving additions, explicit cross-card review drafts, contextual transcription vocabulary, reconnect recovery, and account-private conditional-revision workspaces containing linked cards and audio.

Local verification covers the interactive workspace and persistence/provider contracts. Items 18–19 remain release-dependent: the new authenticated hosted routes, provider secrets/model configuration, trusted native account origin and native-account build flag must be published and verified before standalone phone processing/private continuity can be called live. No production deployment or new iPhone installation is part of this build pass. Browser-provided live voice navigation is capability-dependent; explicit Next remains available. Delivered audio is preserved, but OS interruption and recorder restart cannot promise lossless capture.

## Candidate verification, 2026-10-29

- TypeScript and Oracle production bundle pass.
- All 246 authoring unit tests pass; 32 writing/bridge/assimilation node checks pass.
- Complete desktop/iPhone WebKit authoring suite: 68 passed, 8 capability-dependent skips. After final audio/peer recovery repairs, seven targeted desktop/mobile checks pass (one mocked-microphone WebKit skip), covering selected-span replacement, phrase re-recording, connected-card navigation and compact paired review.
- Actual mobile Speak/Review screenshots inspected; automated workspace allocation exceeds 75% (approximately 78%) of viewport height. No accordions or horizontal overflow in tested screens.
- Restarted current local preview and verified real local AR Create assimilation returns the correct subsection, preserved human wording and a matched comparison, with no unassigned words or warnings for the bounded sample. This is not hosted or native-release proof.

## Review simplification, 2026-10-29

The default comparison now contains the original, editable human wording, one replay action per pair, necessary transcription checks and one primary Use my words action. Repeated match explanations, destination bars, filter controls, bulk integration, cleanup and scroll settings moved out of the default comparison to Tools. Unmatched speech remains saved on a separate ordinary screen; an explicit named destination opens the flat section picker, then Review in [section] returns to comparison before any integration. No dropdown or automatic ambiguous attachment. Review retains the selected passage when returning from secondary tools.

Verified desktop and iPhone WebKit screenshots, routing, word checks, playback, additions, phrase recording, canonical heading retention and integration. The 44-case section suite had four capability skips; after updating old UI-label expectations and fixing the return-navigation defect, all 40 runnable cases passed across the main run and focused repairs. TypeScript and production bundle pass. Local preview updated; no phone installation or production publication.

## Workspace redesign, 2026-10-30

The Speak / Review / Tools tabs are gone. Their split was the main source of confusion: the section you recorded and the words it produced lived on different tabs, each with its own navigation, and every option sat in one Tools panel.

- **One manuscript to record over.** The whole card scrolls as plain text, each section with its own state (Recording, Processing, Ready to review, Check words, Your words, Your addition). Tapping a section heading makes it the destination; scrolling never moves it, and nothing can move it while the microphone is live.
- **One dock that always names the destination.** Idle: Record into [section] · Review N · Record. Live: timer, level, Pause, Done, Next [following section]. Next sends the take and moves on without waiting for processing.
- **Review is a focused screen per section.** Editable title above the passage, any uncertain words quoted in context with Hear it / It's right (an edit that removes the word settles it), then the original and the human words: side by side on desktop, original pinned above and scroll-linked on phones. One primary action names its consequence (Replace with my words, Add my words, or Check N words first). After applying, the same screen shows the words now in the reading with Undo, See in card and the next step.
- **Everything else is a plain screen:** Recording settings (keep microphone on at Next, spoken section names, what to do when a section already has human words, apply all checked, private sync), Recordings and transcript, Sessions, Unplaced words, Speech cleanup, Sections. No accordions, dropdowns or checkboxes for approval.
- **Authorship marks read the latest application across sessions**, so a section stays marked Your words after its session completes, and See what changed reopens the session that holds its undo. Undo still refuses to overwrite newer words in the same reading.
- Linked-card review now travels in the address (?voiceSession=) instead of an event fired on a timer after navigation.

Verification on this branch: 246 authoring unit tests; the ported section workflow suite (22 cases) and a new recording journey with screenshots (tests/oracle-voice-journey.spec.ts) on iPhone WebKit and desktop Chromium, using fixture speech processing. Not verified here: hosted processing, a signed phone build, or production.

### Replacement, passage by passage (2026-10-30)

Before this change Replace swapped the whole section for exactly what was said, so unspoken paragraphs disappeared. Now:

- **Aim:** tap a section heading for the whole section, or one paragraph for only that paragraph. The dock reads "Record over · Reading · paragraph 2" (or "all 3 paragraphs"). The take stores the exact paragraph (`SectionTake.focus`); review gives every spoken word to it (`focusedComparison`) whatever the alignment says.
- **Review:** a matched comparison is shown as passage rows marked Stays, Your words, New here or Removed, each with one action (Remove / Keep it, Keep original / Use my words, Leave out / Add it back). Unspoken passages stay by default. Choices live on the result (`rowChoices`). The button counts the change: "Replace 1 passage · remove 1".
- **Apply:** `sectionReplacementPlan` turns rows into exact span edits and `applyPassageEdits` writes them in one revision: new spans are human blocks with evidence, kept spans keep their original provenance, undo restores the earlier reading. Unmatched recordings still replace the whole section, and the screen and button say how many paragraphs that is.

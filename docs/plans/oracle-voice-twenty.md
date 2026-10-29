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

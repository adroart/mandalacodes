# Oracle voice: what is built, what is wrong, and the plan to finish it

Audit date 2026-11-11, against main at `f1002a0`. This is the working plan for the card
voice workflow in the Oracle app (record over a card section, get the words back, compare,
apply). It replaces nothing in `ORACLE-VOICE-HANDOFF.md`, which stays the owner brief. It
adds what that brief could not know: what the code does today, measured.

How this was produced: four read-only code audits (capture, processing and server,
interface, tests and docs), plus a local run of the real workspace at 390 x 844 and
1440 x 900 with the voice journey spec (8 of 8 scenarios pass with scripted speech) and two
failure probes (no speech service, microphone denied). Every claim below is marked:

- **[measured]** seen in the running app or measured in the browser
- **[source]** read directly in the code by the lead session
- **[audit]** found by an auditor with a file and line, not re-checked by the lead
- **[device]** cannot be known without Adrian's phone

Nothing in this audit ran on a phone, against the live site, or against a real speech provider.

## 0. Progress, 2026-11-12

Waves 1 to 5 are built and pushed on `claude/relaxed-cannon-k3l0jh` (41 commits, not merged to main, not deployed, not installed). Two independent reviews ran between waves and their findings were fixed. The combined branch passes the type check, 1,652 unit tests and the voice lane (102 passed, 2 skipped) with scripted speech.

What is left is no longer agent work:

1. Adrian: merge, deploy, build and install, then run `docs/oracle/VOICE-PHONE-CHECK.md` on card 2.
2. Fix whatever the phone shows (the Swift has never been compiled).
3. The open items listed in `docs/oracle/VOICE-STATUS.md`: structured sections in the apply script, the build gate versus his spoken words, the AR Create side of the Mac pickup and a screen for its result, removing the older studios, a post-deploy check with a real recording.

The current state, file by file, is in `docs/oracle/VOICE-STATUS.md`. The sections below are the audit as written on 2026-11-11 and the plan as it was; read them for the reasoning, not for the present state.

## 1. The short version

The workspace is real and mostly coherent: one scrolling manuscript, a dock that names the
destination, a review screen per section, undo, honest progress. Recording is saved every
second and survives reloads. The server path for the phone exists.

It does not yet work well for five reasons, in order of how much they cost Adrian:

1. **Finished words go nowhere.** Applied text lives in the phone's browser storage (plus an
   opt-in private copy). Nothing carries it into `oracle/cards/NN.md` or the site. The
   default workspace has no export at all. Card 2 alone has 33 sections, so the deck is
   roughly two thousand sections of work with no way out of the phone.
2. **The phone path is proven only by fixtures.** Every voice browser test replaces the
   speech service with a script, uses Chromium's fake microphone, and skips on WebKit. None
   of the seven Oracle app voice specs runs in CI. The eight most recent fixes were all at
   the seams the fixtures replace.
3. **Word checks cannot fire on the phone.** The whole review design rests on flagging the
   rare uncertain word. The hosted transcription returns no word confidence, so the flag
   never triggers there. The tests show it working only because the fixture invents a 0.38.
4. **Recording on iOS is unprotected.** Nothing keeps the screen awake, nothing handles a
   call or Siri, a muted microphone keeps the timer running over silence, and a take killed
   mid-recording leaves the workspace asking for a recovery it has no button for.
5. **The interface still carries three generations.** Two Record buttons with different
   scope, a header that can say "Check" for a system the workspace never shows, an older
   studio reachable from Settings with tabs and accordions, and one word meaning three
   things ("Done", "Next").

## 2. What has been built

| Layer | State | Where |
| --- | --- | --- |
| Capture | One recorder, 1 s chunks to IndexedDB, takes roll at 19 min or 9 MiB, microphone kept open across takes, pause, level meter | `lib/oracle/authoring/recorder.ts`, `src/mobile/authoring/voiceCapturePass.ts` |
| Workspace | One manuscript, pinned destination, dock, per-section review, applied screen with next recording, undo, settings, unplaced words | `components/oracle/authoring/SectionVoiceStudio.tsx` (65 KB, one component) |
| Review | Human words first, passage rows (Stays, Your words, Removed), editable text, word replay with highlight, phrase re-record | `SectionPassageReview.tsx`, `CheckedEditableText.tsx`, `WordReplay.tsx` |
| Hosted processing | Signed-in POST to `/api/oracle/authoring/process`: Groq Whisper turbo with word timestamps, then section matching on Groq `openai/gpt-oss-120b`. Mac bridge only as a fallback for 404, 405, 503 | `functions/api/oracle/authoring/process.ts`, `src/mobile/authoring/processing.ts` |
| Private copy | Opt-in account sync of workspace and audio to private R2 with revision checks | `functions/api/oracle/authoring/private.ts`, `VoiceSyncTools.tsx` |
| Shared words | Transcription prompt primed from the shared word library, known fixes computed | `shared/words.ts`, `shared/oracleWords.ts` |
| Mac better transcript | Works for website reflections and memos only. It does not reach card recordings made in the app | `functions/api/oracle/pickup/` |
| Native app | Capacitor shell, build number 19, microphone permission text present, sign-in behind a build flag | `mobile/` |

Three older generations are still in the tree: `HumanCardAuthoring` (reachable from
Settings, Sessions), the `OracleVoiceFlow` and `OracleAuthoring` family (only by typing
`?authoring=review`), and `PassageRecorder` (no importer, dead). About 235 KB.

## 3. Problems

### 3.1 Interface and experience

| # | Problem | Evidence |
| --- | --- | --- |
| U1 | On the phone the card's voice sheet has blank brown bands, 52 px top and 61 px bottom, 13 percent of the screen. The page-mode rule from PR 377 also applies inside the sheet. The workspace gets 731 of 844 px | [measured] `src/mobile/authoring/authoring-app.css:7` |
| U2 | Adrian's 31 October correction (same text size for original and his words, word-check buttons on a row below, never mid-sentence) was reversed eleven hours later by `40c3dbf`. Today "Hear it" and "It's right" sit inside the sentence and originals are 15 px beside 17 px | [measured] [source] `CheckedEditableText.tsx:60-69`, `passage-review.css:10-27` |
| U3 | Recording dock says "Pause, Done, Next". The approved copy was "Pause, Stop & review, Send & next". "Done" means three things and "Next" means three things across the workspace | [measured] [audit] `SectionVoiceStudio.tsx:218,318,319,333,336` |
| U4 | His proposed words are green with a green edge before applying. The spec keeps green for applied text only (gold edge, off-white text before) | [measured] `passage-review.css:16-21` |
| U5 | Two Record entrances with different scope (header Record, and the book icon's bar that records only the paragraph in view). The header label flips to "Check" from the legacy job store, which the workspace never shows | [audit] `src/mobile/OracleNavigation.tsx:19,39,40`, `PassageReadingControls.tsx:49-62` |
| U6 | Every heading and paragraph in the manuscript is a tap target that re-aims the recording, with no cue of viewed versus aimed and no undo | [audit] `SectionVoiceStudio.tsx:239` |
| U7 | Placing unplaced words by hand drops the passage match, so the action becomes "Replace all N paragraphs" | [audit] `SectionVoiceStudio.tsx:348` |
| U8 | No keyboard handling. The sheet is `100dvh` with no `visualViewport` logic, so the apply dock likely sits under the iOS keyboard while editing | [audit] [device] `authoring-sheet.css:21` |
| U9 | Errors leak internals: "Hosted processing returned HTTP 503 (HTML response)", "AR Create is still working". One error shows in both banner and toast and Dismiss cannot clear it. Storage failure says "export your work" where no export exists | [audit] `processing.ts:22,30`, `SectionVoiceStudio.tsx:309`, `storage.ts:48` |
| U10 | With the account flag off, the banner says sign in but offers only Retry | [audit] `SectionVoiceStudio.tsx:223-224` |
| U11 | Section names show the manuscript's structural em dash ("Upper trigram, Earth (Kun)" is displayed with the dash) | [measured] section rail and picker |
| U12 | Small things: targets under 44 px (section heading 40, "Review your words" link about 30), a tag at 11.5 px, 14 px inputs that trigger iOS zoom, bottom safe area applied twice, scroll position lost on every screen change, focus not moved on screen change | [audit] `SectionVoiceStudio.css:37,65,83,234,315` |
| U13 | Jargon in reachable copy: integrate, take, session, private continuity, application receipts, bridge, Tailscale, MiB, "your browser's speech service" inside a phone app | [audit] `VoiceSyncTools.tsx:26,76-84`, `MacBridgeConnection.tsx:9-10` |

What holds up well [measured]: the failure screen when no speech service answers ("1 recording
saved on this device", Listen, Retry), the microphone-denied message, the applied screen
leading straight to the next section, and the unplaced-words flow.

### 3.2 Recording on the phone

| # | Problem | Evidence |
| --- | --- | --- |
| C1 | A take killed mid-recording blocks the next Record with "Recover your saved recording before starting another take", and the workspace has no recover control. Only way out is starting a new session, which abandons the audio | [source] `SectionVoiceStudio.tsx:105`, no `recoverCapture` call in the file |
| C2 | Each one-second chunk write reads every chunk of the whole session, bytes included. Writes slow as a card session grows, so more is lost on a kill and stops stall | [source] `lib/oracle/authoring/storage.ts:99` |
| C3 | Nothing keeps the screen awake and nothing handles interruptions: no wake lock, no idle-timer control, no background audio mode, no audio session code | [source] nothing in `mobile/ios/App/App` or the web code |
| C4 | A muted microphone (call, Siri, backgrounding) is invisible. The timer keeps running over silence | [audit] `SectionVoiceStudio.tsx:85` |
| C5 | Audio is dropped at every take boundary: the next recorder starts only after the old one stops, drains and saves twice. Boundaries at 9 MiB and 19 min cut mid-sentence | [audit] `recorder.ts:96-106`, `voiceCapturePass.ts:57-65` |
| C6 | Duration is wall clock and never clamped. After a long suspension a take can exceed 20 minutes and the server rejects it as "Invalid recording" | [audit] `recorder.ts:43,83`, `process.ts:71` |
| C7 | Spoken section names default on, never restart after the recogniser ends, and say nothing when they stop. Whether the iOS webview supports them at all is unknown | [audit] [device] `voiceCaptureRouting.ts:44` |
| C8 | Storage only grows: no audio deletion, a full session clone saved to history on every draft save, no persistence request, no usage display | [audit] `storage.ts:23`, `sectionDrafts.ts:79` |
| C9 | The phone's audio is the only copy unless private sync is switched on, and free-signing reinstalls every seven days put that storage at risk | [audit] [device] |

### 3.3 Processing and server

| # | Problem | Evidence |
| --- | --- | --- |
| P1 | The processing and private storage endpoints accept any signed-in account, and sign-up is open without email verification. Anyone can spend the Groq allowance and fill private storage. Reflections and memos are admin-only | [source] `functions/api/oracle/authoring/_shared.ts:6-10`, `lib/account/auth.server.js:88` |
| P2 | Hosted transcription returns word text and timing but no confidence. The uncertain-word check needs `probability < 0.6`, so it never fires on the phone. Only the Mac bridge supplies it | [source] `process.ts:80`, `sectionTakes.ts:149` |
| P3 | The shared-word fixes are computed on the server and stored, then ignored: the take flow matches and shows the raw text | [audit] `process.ts:81`, `sectionTakes.ts:52,102` |
| P4 | A passing provider failure is final. Groq 429 and 5xx become a generic 502, timeouts 504, network errors 400. Auto-retry matches on message text and none of these match. The hosted path has no fallback provider although `quickTranscription.ts` has one | [audit] `process.ts:59,75-77,99`, `sectionTakes.ts:164` |
| P5 | The device build does not check the account flag. A bundle built without `VITE_ORACLE_NATIVE_ACCOUNTS=true` has no sign-in, so every take fails 401 with no way to sign in. Build number 19 names more than one bundle | [audit] `mobile/package.json:10`, `src/mobile/OracleApp.tsx:63` |
| P6 | Private sync re-uploads all session audio on every save, on a 1.8 s debounce, as one base64 string capped at 80 MiB | [audit] `privateSync.ts:22-23`, `VoiceSyncTools.tsx:42` |
| P7 | The Mac pickup list takes the oldest 200 rows and then filters. After 200 handled recordings nothing new is listed | [source] `functions/api/oracle/pickup/segments.ts:16-19` |
| P8 | A long section review is one 24,000-token request. A cut-off answer is a 502, with no per-section chunking | [audit] `process.ts:65` |
| P9 | The app never asks the server whether transcription is configured before recording starts | [audit] |

### 3.4 Gaps: not built

- **G1 Last mile.** No path from applied words to `oracle/cards/NN.md`, the lint, the card
  gate, or the site. `docs/oracle/voice-authoring.md:168` says so in plain words.
- **G2 Mac better transcript for card recordings.** Pickup covers reflections and memos only.
- **G3 A second listening pass.** The doubt finder (`functions/api/_lib/transcriptDoubts.ts`)
  is used for memos only.
- **G4 Any real-device or real-provider test**, and any record of what was tried on which build.
- **G5 One true document.** No single file describes today's code. `mobile/README.md` and
  `docs/oracle/voice-authoring.md` still say the phone needs the paired Mac; the hosted doc
  names the wrong provider; `CLAUDE.md` implies pickup covers app recordings; `TODO.md`
  tracks no voice work.

### 3.5 Verification truth

- CI runs the unit tests (including 44 authoring files) and the old website recorder specs.
  It runs none of the seven Oracle app voice specs. They were removed from the website lane
  in `e8e5d64` and never given a lane of their own [audit] `playwright.config.ts:28`.
- A cold checkout cannot start the Oracle app: `src/mobile/sharing.ts` imports from
  `mobile/node_modules`, so `npm --prefix mobile ci` is required first [measured].
- Last phone install any document describes: build 13. Builds 14 to 19 have commit messages
  only. The native Google sign-in return was recorded as rejected on the phone at build 17
  and no later commit touches it [audit] `src/mobile/account/README.md:65-71`.

## 4. Decisions needed from Adrian before building

**Decided 2026-11-11: Adrian accepted all five recommendations below** ("go with all your
recommendations"). They are settled; do not re-ask. Wave 1 started the same day.

1. **Word-check buttons and text sizes.** Your 31 October correction (buttons on a row
   below, one text size) or the later version now in the app (buttons inside the sentence,
   smaller originals)? Recommended: your correction.
2. **Where finished words go.** Recommended: one pull request per card into
   `oracle/cards/NN.md`, which you approve. All 64 cards are `final`, and the standing rule
   is that a final card's words do not change without your say.
3. **Do your spoken words have to pass the writing lint?** Recommended: the lint reports and
   does not block, because the words are yours.
4. **Should the Mac improve card recordings too?** Recommended: yes, but after the phone
   works alone.
5. **May the older studios be deleted?** Recommended: yes, after checking the phone holds no
   unapplied drafts in them.

## 5. The plan

Rules for every wave:

- `SectionVoiceStudio.tsx` and `.css` have exactly one owner per wave. Every other package
  lists its files; no two packages share a file.
- Each builder works in its own worktree and branch, runs `npm run typecheck`,
  `npm run test:unit` and the voice lane before handing back.
- A fresh reviewer reads the wave's diff without the builder's summary.
- A wave ends on the phone, on one card, before the next begins. Cloud sessions cannot
  build or install the iOS app; that step is Adrian's Mac, using the fresh-signing flow in
  `mobile/README.md`.
- Model use follows the standing rule in `HANDOFF.md`: design, copy and review at the top
  tier; judgment implementation on Opus; mechanical work on Sonnet.

### Wave 1: stop the losses (small, parallel, about a day of agent time)

| Pkg | Work | Fixes | Files owned | Agent |
| --- | --- | --- | --- | --- |
| 1A | Restrict authoring endpoints to the owner (same guard as reflections), add a per-user rate limit, retryable statuses with a logged cause, correct the size message, fix the pickup query to filter in SQL. Tests for 401, 403, limits, 504, 422 | P1, P4 (server half), P7 | `functions/api/oracle/authoring/*`, `functions/api/oracle/pickup/segments.ts`, their unit tests | general-purpose, Opus |
| 1B | Read chunks by capture key range with a running byte count; clamp duration; set an explicit audio bitrate | C2, C6 | `lib/oracle/authoring/storage.ts`, `recorder.ts`, their unit tests | general-purpose, Opus |
| 1C | Scope the page padding rule so the sheet is edge to edge; single safe-area inset; recover an interrupted recording automatically when the workspace opens; retry on status, not message text; plain-sentence errors; fix the undismissable toast and the sign-in loop; format section names without the dash | U1, U9, U10, U11, C1, P4 (client half) | `SectionVoiceStudio.tsx/.css`, `authoring-app.css`, `authoring-sheet.css`, `src/mobile/authoring/processing.ts`, `sectionTakes.ts`, `sectionWorkflow.ts` | general-purpose, Opus (sole studio owner) |
| 1D | Device build fails without the account flag; build number and commit shown in Settings; npm scripts for the voice lane, node tests and mobile tests; add the voice lane to CI's mobile job; install mobile deps before it | P5, section 3.5 | `mobile/package.json`, `mobile/scripts/*`, `package.json`, `.github/workflows/test.yml`, `scripts/build-oracle-app.ts` | general-purpose, Sonnet |
| 1E | One status document for voice with a device ledger (build, commit, date, what was tried, result); mark the older voice docs historical at the top; correct `CLAUDE.md`, `mobile/README.md` and the hosted doc | G5 | `docs/oracle/VOICE-STATUS.md` (new), doc headers, `CLAUDE.md`, `TODO.md` | general-purpose, Sonnet |

Gate: reviewer pass; merge; Pages deploy; Adrian builds and installs; then the first honest
run of the twelve acceptance scenarios in `ORACLE-VOICE-HANDOFF.md`, written into the
ledger. That run decides how much of Wave 2 is needed.

### Wave 2: recording you can trust on the phone

| Pkg | Work | Fixes | Files owned | Agent |
| --- | --- | --- | --- | --- |
| 2A | Native handler that keeps the screen awake while recording; then background audio mode and audio session interruption and route observers, bridged to the web layer | C3 | `mobile/ios/App/App/*` | general-purpose, Opus. Written in the cloud, compiled and tested on the Mac |
| 2B | Start the next recorder on the kept stream before stopping the old one; move post-take work off the boundary; mute and unmute listeners; resume the meter when the app returns | C4, C5 | `voiceCapturePass.ts`, `recorder.ts`, `shared/voice/microphone.ts` | general-purpose, Opus |
| 2C | Visible "microphone interrupted" and "meter unavailable" states; spoken section names off by default on the phone, with a status line when on | C4, C7 | `SectionVoiceStudio.tsx/.css`, `voiceCaptureRouting.ts` | general-purpose, Opus (after 2B) |
| 2D | Prune draft history; request persistent storage; show space used; sync audio by hash so nothing uploads twice; turn the private copy on by default once signed in | C8, C9, P6 | `sectionDrafts.ts`, `privateSync.ts`, `voiceWorkspaceSync.ts`, `VoiceSyncTools.tsx`, `functions/api/oracle/authoring/private.ts` | general-purpose, Opus |

Gate, on the phone: lock for 30 seconds, 5 minutes and 30 minutes mid-take; take a call;
trigger Siri; connect and remove AirPods; count aloud through Next and through an automatic
rollover; kill the app mid-take and reopen. A native recorder plugin is the fallback only
if the webview cannot hold the microphone after 2A.

### Wave 3: transcripts good enough to trust

| Pkg | Work | Fixes | Files owned | Agent |
| --- | --- | --- | --- | --- |
| 3A | Route hosted transcription through the shared quick-transcription service (it has a fallback provider); add a second listening pass and feed the doubt finder into the review, so uncertain words are flagged without the Mac | P2, P4, G3 | `process.ts`, `functions/api/_lib/quickTranscription.ts`, `transcriptDoubts.ts`, tests | general-purpose, Opus |
| 3B | Use the shared-word fixes in the take flow and show them as recoverable changes; ask the server for readiness when the workspace opens | P3, P9 | `sectionTakes.ts`, `sectionWorkflow.ts`, `sectionAssimilation.ts`, one studio hook | general-purpose, Opus |
| 3C | Review long takes section by section instead of one large request | P8 | `tools/oracle-section-assimilation.mjs`, the review half of `process.ts` (after 3A merges) | general-purpose, Opus |
| 3D | If decision 4 is yes: extend pickup to card recordings (list, audio fetch, result with confidences, compare on the phone) | G2 | `functions/api/oracle/pickup/*`, `utils/oracleBetterTranscript.ts`, a new client merge module | general-purpose, Opus |
| 3E | A post-deploy check script, run by hand: signed-in readiness, transcribe one committed real iPhone recording, review it, private save and a forced conflict | G4 | `tests/live-oracle-voice.spec.ts` (new), one sample recording Adrian supplies | general-purpose, Sonnet |

Gate: Adrian records one real section on the phone, away from the Mac, and a deliberately
misheard word is flagged.

### Wave 4: the interface, simplified

Design before code, on one screen first.

- **4.0 Design pass** (lead session, top tier, with the `design:ux-copy` and
  `design:design-critique` skills): one page settling decision 1, one word per action
  (a vocabulary table: record, send, review, use my words, undo), one Record entrance,
  and an explicit "only this paragraph" control in place of tap-anywhere. Shown to Adrian
  as real screenshots from the running app, review screen first. Nothing else in this wave
  starts until he approves that screen.
- **4.1 Split the studio** (one agent, Opus, alone): `SectionVoiceStudio.tsx` into
  manuscript, dock, review, applied and settings modules with no behaviour change, held by
  the voice lane now in CI. This is what lets the rest run in parallel.
- **4.2 In parallel after 4.1**, one agent each (Opus for the first three, Sonnet for the last):
  - review row and sizes (U2, U4): `CheckedEditableText.tsx`, `SectionPassageReview.tsx`, `passage-review.css`
  - dock and copy (U3, U7, U13): the new dock and settings modules, `VoiceSyncTools.tsx`
  - entrance and aiming (U5, U6): `OracleNavigation.tsx`, `PassageReadingControls.tsx`, the manuscript module
  - keyboard, targets, focus (U8, U12): a `visualViewport` hook and the workspace CSS
- **4.3 Deletions** (Sonnet, after decision 5): `PassageRecorder` and dead CSS first; then
  the `OracleVoiceFlow` family and `?authoring=review`; then `HumanCardAuthoring` and its
  job store once old drafts are migrated or confirmed empty. The four specs that pin legacy
  screens go with them.

Gate: the twelve acceptance scenarios on the phone, judged by whether Adrian can do each
without being told how, not by test counts.

### Wave 5: the last mile

- **5A** (Opus): a single action in the workspace, "Send finished sections to the card",
  which writes the applied sections, their source hashes and evidence references to the
  private store. Files: a new export module and the applied module.
- **5B** (Opus): a script run on the Mac or in CI that reads that bundle, checks each
  section's source hash against the current `oracle/cards/NN.md`, writes the sections,
  runs the prose lint (report only, per decision 3), the card gate, and both corpus builds,
  and opens one pull request per card. Files: `scripts/voice-apply.mjs` (new), tests.
- **One card first.** Card 2, end to end, read by Adrian on the preview before any second
  card. This is the standing rule from `THINKING.md` (2026-09-24).

### Not in this plan

- Public listening audio. The player exists and deliberately has nothing to play.
- Merging the website reflection recorder with the app recorder. Worth doing, not blocking.
- Editing-audio deletion after a card is applied. Wait until the last mile has run on
  several cards.

## 6. Agent roster

| Role | Type and model | Used for |
| --- | --- | --- |
| Lead | Main session, top tier | Holds this plan, briefs each package, reads every screenshot, integrates, talks to Adrian. Does the design pass itself |
| Builder | `general-purpose`, Opus, own worktree | Any package with judgment in it: recorder, server, studio, native |
| Mechanic | `general-purpose`, Sonnet, own worktree | Build scripts, CI, docs, deletions, CSS target sizes |
| Reviewer | Fresh `general-purpose`, top tier, `/code-review` on the wave's diff | One per wave, given the diff and this plan's problem ids, never the builder's summary |
| Scout | `Explore` | Locate-only questions while briefing a package |
| Adrian with the Mac | Person | The five decisions, signed builds and installs, every device gate, the sample recording, approving card pull requests |

Per wave: at most five builders at once, one studio owner, one reviewer. The lead writes each
brief from the package row above: goal, problem ids with their file and line, files owned,
files forbidden, and the done-when check.

## 7. How to rerun this audit's local check

```sh
npm ci
npm --prefix mobile ci
npx playwright test --config playwright.oracle-voice-five.config.ts tests/oracle-voice-journey.spec.ts --trace off
```

Screenshots of every step land in `test-results/`. They show the interface with scripted
speech. They prove nothing about the phone or the hosted service.

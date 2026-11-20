# Oracle card voice: status

Written 2026-11-12, updated 2026-11-21. The work was merged to main as 4cb740f (pull request 401) on 2026-11-12 and Cloudflare deployed it. Checked against the live site on 2026-11-13: the new pickup route for app recordings answers 401 without a key, and the process endpoint answers a signed-out request with the new `code` and `retryable` fields. CI passed on the merged commit, including the voice lane's first run on the CI runner (scripted speech).

The plan and its progress are in `todo/plans/oracle-voice-completion.md`. The owner's brief is `ORACLE-VOICE-HANDOFF.md`. The phone checks are in `docs/oracle/VOICE-PHONE-CHECK.md`. Older voice documents are kept for history and each says so at its top.

## Current acceptance

PR #426 merged as `c06f61b29c6826514108fce4f7c4d9d704b2940a` on 2026-11-17. Its Pages receipt matched the live source revision and the immutable deployment's manifest and card-page entry asset bytes. [PR #426](https://github.com/adroart/mandalacodes/pull/426)

| Check | Evidence and remaining work |
| --- | --- |
| Installed app and widget signing | Build 19 from `66abeefd65f373d2b5eff798fad794285e38fecc` was installed on 2026-11-19 at 20:33 Bali time. The app and widget profiles each had about 6 days, 23 hours and 40 minutes remaining when the install receipt was written. They expire 2026-11-26 at 20:14:02 and 20:14:04 Bali time (12:14:02 and 12:14:04 UTC), respectively. |
| Preservation across update and widget placement | Pre-install and post-placement snapshots matched all 796 authoring records and 357 section draft records. The working-card store had zero records in both snapshots. All baseline rows retained identical values. |
| History, selected words and preservation | On 2026-11-17 the phone restored History into a separate draft, selected spans by native long-press and prepared a replacement. Review showed “Selected words,” both spans and “Not applied yet.” All 752 prior audio chunks and 12 audio sessions retained identical value hashes. The source pending result and working reading texts were preserved, with routine metadata updates. One verification draft remains pending. |
| Physical microphone and reopen | On 2026-11-19 at 19:36 Bali time, a Card 2 test played synthetic speech through a speaker into the phone microphone. The saved 14.454-second capture decoded, the live service correctly transcribed the phrase with 14 word timings, and the capture survived reopen. Existing audio and working card text were preserved. The temporary test runner was removed. The two synthetic Card 2 takes from this check were later discarded through the app and remain recoverable. The cleanup receipt verified preservation of owner drafts, original audio and transcripts, working cards and prior owner history. The microphone receipt does not identify the installed revision. |
| Empty-capture retry | PR #426 merged the native repair in `38eb7d0e`. The installed `66abeefd` build contains it. The physical retry check was deferred after XCTest timed out before the test began. The earlier microphone check exercised nonempty audio. On 2026-11-20 Adrian chose to leave the two blank verification sessions in place and asked to leave the phone disconnected. The temporary runner was removed and owner records were preserved. |
| Widget rendering | Verified on 2026-11-19 after installing `66abeefd`. The widget on the second Home Screen page displayed today’s Code 14, **Ancestors Bloom**, and **Gift: Competence**. The temporary test runner was removed after capturing the widget preview. |
| Apply and Undo | Browser fixtures cover both operations. Physical Apply/Undo remains pending and requires an owner-approved disposable reading. Keep the owner's pending draft and reading intact. |

The frozen `App.app` for `66abeefd` passed deep, strict signature verification and exact web payload verification (311 web files). Its tree SHA-256 was `790bf864204450d5124a5c5fc7fad5c617cf6f52cc4f626755ee2d3737f6573d`.

The original Oracle recording chat owns the remaining device checks with Adrian. The [phone checklist](VOICE-PHONE-CHECK.md) records the remaining scenarios. The wider Card 2 workflow is still open, including the full passage sequence, uncertain-word review, interruptions, offline recovery and export. The installation, signing, preservation, widget placement and preview, microphone, test-take cleanup and publication evidence is retained privately.

## What it is for

The owner speaks his own words over a card's sections, and those words replace prose that AI wrote. His words take precedence over any AI text. The Oracle app records, sends the audio for transcription, matches the speech to sections, lets him compare and apply it on the device, and hands the finished sections over as a file that is written into the card on the Mac.

## The path a recording takes on the phone

1. Record. `lib/oracle/authoring/recorder.ts` and `src/mobile/authoring/voiceCapturePass.ts`. Audio is saved in one-second chunks. One microphone stream is kept across sections; the next recording starts in the same tick the previous one stops. The screen is held awake while recording (`src/mobile/authoring/nativeRecordingGuard.ts`, native handler in `mobile/ios/App/App/SceneDelegate.swift`).
2. Queue and retry. `src/mobile/authoring/sectionTakes.ts`. A recording cut off by a reload or a kill is closed and queued when the workspace opens. Failures retry by status, one at a time, and wait as long as the server asks.
3. Send. `src/mobile/authoring/processing.ts` posts to `POST /api/oracle/authoring/process`. On the native app, and only when the site answers 404, 405 or 503, it falls back to a paired Mac if one is saved.
4. Transcribe, check and match. `functions/api/oracle/authoring/process.ts`.
   - Transcript of record: Groq `whisper-large-v3-turbo` with word timestamps (`GROQ_API_KEY`). If Groq fails, Workers AI (`AI` binding) is used.
   - Second listening: Groq `whisper-large-v3`. Where the two disagree in substance, the word is returned as a doubt with what else was heard. If the second listening fails, the transcript still returns and says it was not double-checked.
   - Section matching: `ORACLE_WRITING_PROVIDER` `groq`, `ORACLE_WRITING_MODEL` `openai/gpt-oss-120b`. Long recordings are reviewed in parts.
   - Owner only: signed in, verified email, listed in `ADMIN_EMAILS`. 300 requests an hour.
5. Review and apply on the device. `components/oracle/authoring/SectionVoiceStudio.tsx` with one file per screen in `components/oracle/authoring/studio/`. Applied words are kept in the phone's browser storage.
6. Private copy. `functions/api/oracle/authoring/private.ts`. On by default when signed in; each recording uploads once; up to 600 recordings per session copy.
7. Send finished sections to the card. Recording settings, `studio/useSendToCard.ts`. One file through the share sheet. On the Mac: `npm run voice:apply -- --file <file> --dry-run`, then without `--dry-run` (`docs/oracle/voice-apply.md`). The script writes only sections whose card text still matches what the app saw, and never commits.

## What must be true for the phone to work alone

- The bundle was built with `VITE_ORACLE_NATIVE_ACCOUNTS=true` from a clean, committed tree. `npm --prefix mobile run build:device` now refuses otherwise.
- The phone is signed in with the account listed in `ADMIN_EMAILS`, with a verified email. The native Google sign-in return was recorded as rejected on the phone at build 17 and nothing since has changed it; email-code sign-in is the fallback to try.
- Pages has `GROQ_API_KEY`, `ADMIN_EMAILS`, the two writing variables, the `ORACLE_PRIVATE` bucket, the `AI` binding and the account database, and was deployed after this branch merged.

## Open items

- **Two recorders on one microphone:** unknown whether Safari allows it. If it refuses, a boundary falls back to a short gap.
- **Structured sections:** the apply script writes plain-prose sections only (23 of 33 on card 2). Moving lines, Judgement, Image, Tarot, Deeper correlation and two label lines are reported for a hand edit.
- **Build gate versus his words:** `npm run build` runs the prose lint as a gate. An em dash or italics inside applied spoken words would stop a build. The apply script reports them; nothing exempts them yet.
- **Mac better transcript for app recordings:** this repository's side is built (`docs/oracle/pickup-takes.md`). Nothing calls it until AR Create is updated, and the app has no screen for the result yet.
- **Older studios:** `HumanCardAuthoring` (Settings, Sessions) and the `OracleVoiceFlow` family (`?authoring=review`) are still in the tree. Remove them after confirming the phone holds no unapplied drafts in them.
- **Rapid audio retry regression:** on 2026-11-16, the stop/delete/Hear-it scenario in `tests/oracle-voice-checks.spec.ts` passed five repetitions each in Desktop and Phone Chromium projects after removing the 800 ms workaround. The historical failure did not reproduce; its cause is not established. Keep the no-delay test in CI. This is browser fixture evidence, not iPhone acceptance.
- **Post-deploy check script** (real recording through the live service) is not written.

## Local checks

```sh
npm ci
npm --prefix mobile ci
npm run typecheck
npm run test:unit
npm run test:oracle-voice
```

The voice lane uses scripted speech, Chromium's fake microphone and a replaced speech service, on port 4279. It is in CI's mobile job. `tests/oracle-section-workflow.spec.ts` and `tests/oracle-passage-authoring.spec.ts` are not in that lane; run them through `npm run test:oracle-authoring-app` (needs a built app and WebKit).

2026-11-16 local verification: typecheck passed; all 168 unit files / 1,656 tests
passed. Focused playback repetition passed as recorded above. A separate combined
browser run failed during Record-dialog setup before reaching playback; the
desktop rerun passed. The full browser suite was not rerun in this audit.

## Device ledger

Every phone install gets a row, written the same day. Rows below are only what the repository itself records. Builds 14, 15, 16 and 18 have no record of any phone use.

| Date | Build | Commit | What was tried on the phone | Result | Recorded by |
| --- | --- | --- | --- | --- | --- |
| 2026-10-28 | 12 | 504c25a (integration commit; the installed commit is not stated) | Reminder gap and time picker | Confirmed on the phone. Google sign-in, reopening with the same session and sign-out were not tested by the owner. Source: `src/mobile/account/README.md`, `mobile/README.md` | Repository text, author not named |
| 2026-10-29 | 13 | f28e42c (integration commit; the installed commit is not stated) | Not recorded | Installation verified, and called the last verified install. Nothing else recorded. Source: `ORACLE-VOICE-HANDOFF.md` (date from the commit) | Handoff text, author not named |
| 2026-10-31 | 17 | Not recorded | Native Google sign-in return on the iPhone. The website Google login, hosted transcription with word timing and hosted review were checked with generated speech; the record does not say they ran on the phone | The phone rejected the native Google return before token exchange. No later commit touches it. Source: `src/mobile/account/README.md` | Repository text, author not named |
| 2026-11-03 | 19 | 767ba60 | Not recorded | Commit says it is installed on the iPhone: the five voice screen changes, the artwork loader and the shared word list. Nothing about what worked. Source: `git show -s 767ba60` | Commit message, Claude Opus 5.5 co-author |
| 2026-11-12 | none (site only) | 4cb740f | Nothing on the phone. Site deploy checked from outside: new pickup route 401 without a key, process endpoint returns the new signed-out answer, card 2 loads | Deployed. No phone install of this work yet | Claude session, 2026-11-13 |
| 2026-11-17 | 19 | 9fd1b270 | History restore and selected-word preview | Passed. Fresh app and widget profiles had at least 6 days and 23 hours remaining and expire on 2026-11-24 at 12:35:30 and 12:35:28 Bali time, respectively. The signed app matched all 309 bundled web files and had tree SHA-256 `7ed4833416a8b06e1dd4d93921e091ca6924fa16406ac91a90293f7da3f3f765`. | Oracle History release verification |
| 2026-11-19 | Not captured | Not captured | Card 2 microphone, save, live transcription and reopen | Passed. See current acceptance for scope and cleanup. | Oracle recording chat |
| 2026-11-19 | 19 | 66abeefd | In-place install and second Home Screen widget placement | Installed. Code 14 rendered and baseline data matched. Native empty-capture retry remains pending. | Oracle recording chat |

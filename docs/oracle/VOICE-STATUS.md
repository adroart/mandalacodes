# Oracle card voice: status

Written 2026-11-12 against commit 7fcb9d0 on branch `claude/relaxed-cannon-k3l0jh` (not yet merged to main, not deployed, not installed). The combined branch passes the type check, 1,652 unit tests and the voice lane (102 passed, 2 desktop-only skips), all with scripted speech. Nothing here has run on a phone, on the deployed site or against a real speech provider, and none of the Swift has been compiled.

The plan and its progress are in `todo/plans/oracle-voice-completion.md`. The owner's brief is `ORACLE-VOICE-HANDOFF.md`. The phone checks are in `docs/oracle/VOICE-PHONE-CHECK.md`. Older voice documents are kept for history and each says so at its top.

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

- **Not proven on a phone:** everything. See the phone check.
- **Swift not compiled:** the recording handler and the share-sheet handler in `SceneDelegate.swift`.
- **Two recorders on one microphone:** unknown whether Safari allows it. If it refuses, a boundary falls back to a short gap.
- **Structured sections:** the apply script writes plain-prose sections only (23 of 33 on card 2). Moving lines, Judgement, Image, Tarot, Deeper correlation and two label lines are reported for a hand edit.
- **Build gate versus his words:** `npm run build` runs the prose lint as a gate. An em dash or italics inside applied spoken words would stop a build. The apply script reports them; nothing exempts them yet.
- **Mac better transcript for app recordings:** this repository's side is built (`docs/oracle/pickup-takes.md`). Nothing calls it until AR Create is updated, and the app has no screen for the result yet.
- **Older studios:** `HumanCardAuthoring` (Settings, Sessions) and the `OracleVoiceFlow` family (`?authoring=review`) are still in the tree. Remove them after confirming the phone holds no unapplied drafts in them.
- **One automated press is not settled:** pressing Hear it within a fraction of a second of stopping a clip, when that recording has been removed from the device, fails in automation and passes with a short pause (`tests/oracle-voice-checks.spec.ts`). Cause not found.
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

## Device ledger

Every phone install gets a row, written the same day. Rows below are only what the repository itself records. Builds 14, 15, 16 and 18 have no record of any phone use.

| Date | Build | Commit | What was tried on the phone | Result | Recorded by |
| --- | --- | --- | --- | --- | --- |
| 2026-10-28 | 12 | 504c25a (integration commit; the installed commit is not stated) | Reminder gap and time picker | Confirmed on the phone. Google sign-in, reopening with the same session and sign-out were not tested by the owner. Source: `src/mobile/account/README.md`, `mobile/README.md` | Repository text, author not named |
| 2026-10-29 | 13 | f28e42c (integration commit; the installed commit is not stated) | Not recorded | Installation verified, and called the last verified install. Nothing else recorded. Source: `ORACLE-VOICE-HANDOFF.md` (date from the commit) | Handoff text, author not named |
| 2026-10-31 | 17 | Not recorded | Native Google sign-in return on the iPhone. The website Google login, hosted transcription with word timing and hosted review were checked with generated speech; the record does not say they ran on the phone | The phone rejected the native Google return before token exchange. No later commit touches it. Source: `src/mobile/account/README.md` | Repository text, author not named |
| 2026-11-03 | 19 | 767ba60 | Not recorded | Commit says it is installed on the iPhone: the five voice screen changes, the artwork loader and the shared word list. Nothing about what worked. Source: `git show -s 767ba60` | Commit message, Claude Opus 5.5 co-author |
| Next entry | | | | | |

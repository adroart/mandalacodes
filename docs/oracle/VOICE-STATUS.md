# Oracle card voice: status

Written 2026-11-11 against the code at commit dee3e5b. Each statement below was checked against the files named beside it. Nothing here was run on a phone.

The plan to finish the work is `todo/plans/oracle-voice-completion.md`. The owner's brief is `ORACLE-VOICE-HANDOFF.md`. Older voice documents are kept for history and each says so at its top.

## What it is for

The owner speaks his own words over a card's sections, and those words replace prose that AI wrote. His words take precedence over any AI text. The Oracle app records, sends the audio for transcription, matches the speech to sections, and lets him compare and apply it on the device.

## The path a recording takes on the phone

1. Record. `lib/oracle/authoring/recorder.ts` and `src/mobile/authoring/voiceCapturePass.ts`. Audio is saved in one-second chunks on the device.
2. Queue. `src/mobile/authoring/sectionTakes.ts` holds each take until it is sent.
3. Send. `src/mobile/authoring/processing.ts` posts to `POST /api/oracle/authoring/process`. Only on the native app, and only when the site answers 404, 405 or 503, it falls back to a paired Mac bridge if one is saved.
4. Transcribe and match sections. `functions/api/oracle/authoring/process.ts`. Provider and models, from `wrangler.toml` and the code:
   - Transcription: Groq, model `whisper-large-v3-turbo`, with word timestamps. It needs the `GROQ_API_KEY` Pages secret.
   - Section matching: `ORACLE_WRITING_PROVIDER` is `groq` and `ORACLE_WRITING_MODEL` is `openai/gpt-oss-120b`. If the provider variable is unset the code defaults to OpenAI and then needs `OPENAI_API_KEY`, so the variable matters.
   - The phone cannot choose a provider, a model or a URL.
5. Review and apply on the device. `components/oracle/authoring/SectionVoiceStudio.tsx` and `lib/oracle/authoring/humanDrafts.ts`. Applied words are kept in the phone's browser storage (IndexedDB).
6. Optional private copy. `functions/api/oracle/authoring/private.ts` stores the workspace and audio in the private R2 bucket (`ORACLE_PRIVATE`) with revision checks. It is opt-in.

## What must be true for the phone to work alone

- The app bundle was built with `VITE_ORACLE_NATIVE_ACCOUNTS=true`. Without it the app has no sign-in (`src/mobile/OracleApp.tsx`) and every send fails as signed out. Whether a build fails when the flag is missing is Wave 1 work; do not assume it.
- The owner is signed in on the phone.
- The Pages project has the `GROQ_API_KEY` secret, the two variables above, the `ORACLE_PRIVATE` bucket and the account database.
- Pages was deployed after any server change. The phone calls the deployed site, not the repository.
- From Wave 1 onward (in progress on 2026-11-11) the process and private endpoints accept only the owner's admin account. Before that they accepted any signed-in account (`functions/api/oracle/authoring/_shared.ts` calls the general user check). Check the merged state before relying on either description.

## What is not built or not proven

- No path carries applied words into `oracle/cards/NN.md` or the site. Nothing in the authoring code writes to the cards; it only reads them.
- The Mac better-transcript pickup (`functions/api/oracle/pickup/`) lists website reflection segments and memos. It does not list card recordings made in the app.
- Uncertain-word flags do not fire on the hosted path. The flag needs a word confidence below 0.6 (`src/mobile/authoring/sectionTakes.ts`), and the hosted transcription keeps only each word's text and timing (`functions/api/oracle/authoring/process.ts`). The tests show flags only because their scripted speech supplies a confidence.
- There is no automated test against a real phone or a real speech provider. The seven Oracle app voice specs are not in the CI workflow (section 3.5 of the plan; not re-checked here).

## Which screens are current

- Current: the one-manuscript workspace in `components/oracle/authoring/SectionVoiceStudio.tsx`, with its review components `SectionPassageReview.tsx`, `CheckedEditableText.tsx` and `WordReplay.tsx`. The workspace uses the sans controls font (`SectionVoiceStudio.css`).
- Older generations still in the tree: `HumanCardAuthoring` (reachable from Settings, Sessions); the `OracleVoiceFlow` and `OracleAuthoring` family (reachable only by adding `?authoring=review` to the address); `PassageRecorder.tsx`, which nothing imports.

## Local checks

```sh
npm ci
npm --prefix mobile ci
npx playwright test --config playwright.oracle-voice-five.config.ts tests/oracle-voice-journey.spec.ts --trace off
```

These use scripted speech, Chromium's fake microphone and a replaced speech service. They prove nothing about the phone, the deployed site or a real provider. The config starts the app on port 4279. Another builder is adding a named script for this lane; check `package.json`.

## Device ledger

Every phone install gets a row, written the same day. Rows below are only what the repository itself records. Builds 14, 15, 16 and 18 have no record of any phone use.

| Date | Build | Commit | What was tried on the phone | Result | Recorded by |
| --- | --- | --- | --- | --- | --- |
| 2026-10-28 | 12 | 504c25a (integration commit; the installed commit is not stated) | Reminder gap and time picker | Confirmed on the phone. Google sign-in, reopening with the same session and sign-out were not tested by the owner. Source: `src/mobile/account/README.md`, `mobile/README.md` | Repository text, author not named |
| 2026-10-29 | 13 | f28e42c (integration commit; the installed commit is not stated) | Not recorded | Installation verified, and called the last verified install. Nothing else recorded. Source: `ORACLE-VOICE-HANDOFF.md` (date from the commit) | Handoff text, author not named |
| 2026-10-31 | 17 | Not recorded | Native Google sign-in return on the iPhone. The website Google login, hosted transcription with word timing and hosted review were checked with generated speech; the record does not say they ran on the phone | The phone rejected the native Google return before token exchange. No later commit touches it. Source: `src/mobile/account/README.md` | Repository text, author not named |
| 2026-11-03 | 19 | 767ba60 | Not recorded | Commit says it is installed on the iPhone: the five voice screen changes, the artwork loader and the shared word list. Nothing about what worked. Source: `git show -s 767ba60` | Commit message, Claude Opus 5.5 co-author |
| Next entry | | | | | |

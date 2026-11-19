# Oracle card voice: the phone check

The original Oracle recording chat owns the remaining physical checks with Adrian. Review the [current acceptance record](VOICE-STATUS.md#current-acceptance) before running this checklist. It records the successful History and selected-word preview, live microphone capture and reopen, plus the exact installed build and the verified Home Screen widget. The microphone run covers the save and transcription portion of recording only. Steps 1–13 still need evidence for their exact scenarios where the ledger has no matching result.

Verify native empty-capture retry using the installed build `66abeefd`, which includes `38eb7d0e`. Use a disposable reading approved by Adrian for physical Apply/Undo. Record the exact build and each outcome in the [device ledger](VOICE-STATUS.md#device-ledger).

## Before you start

Use the existing installed app for checks it supports. If a new build is needed, follow these steps.

1. On the Mac, fetch current `origin/main` and use a clean, isolated worktree at that revision.
2. In the Cloudflare Pages settings, confirm `ADMIN_EMAILS` holds the email you sign in with on the phone, and that `GROQ_API_KEY` is set.
3. On the Mac, from a clean committed tree:

```bash
VITE_ORACLE_NATIVE_ACCOUNTS=true npm run build:oracle
```

```bash
npm --prefix mobile run build:device
```

Stop if the build fails. The project todo records a successful device build on
2026-11-16, but that does not establish that today's artifact is safe to install.
Follow [the fresh-signing flow](../../mobile/README.md): the current audit must
verify newly issued profiles for the app and every extension, each with at least
6 days, 23 hours remaining. Record their actual expiration dates before installation.
Never install an older output after a failed build.

4. Install, open the app, sign in. The account screen's last line shows the build and commit. If Google sign-in is refused on the phone, use the email code.

## The check

| # | Do this | It should |
| --- | --- | --- |
| 1 | Open card 2 and its voice workspace; tap one Intro paragraph | Open a focused editor naming Card 2, Intro and the exact paragraph. Record stays disabled until you choose an operation |
| 2 | Choose Add after, then Record addition; say one short paragraph; Stop & review | Keep the selected paragraph and destination visible. Show the original, proposed words, “Not applied yet,” and Apply addition. The recorded words should appear without a section rewrite |
| 3 | Edit a proposed word with the keyboard up | Keep the destination and Apply addition visible above the keyboard |
| 4 | Apply addition, then Undo | Add the new paragraph immediately after the selected paragraph in your private reading; Undo restores the prior reading |
| 5 | Tap the Reading’s second paragraph, choose Replace, record, and Stop & review | Name Card 2, Reading, paragraph 2 of 3, show the exact original and proposed replacement, and offer Apply replacement. Only that paragraph changes if applied |
| 6 | Say one word unclearly on purpose | If the second listening returns a doubt, show the word, also heard, Hear it, It’s right, Use. If the check times out, say it was not double-checked and keep the transcript editable |
| 7 | Before applying a pending Reading edit, try another Reading paragraph | Keep the pending words available for review and prevent a second recording for the same section |

Keep the following legacy whole-section, interruption and export checks separate from the new passage test. To start one, tap a section heading and choose **Record whole section** explicitly.

| # | Do this | It should |
| --- | --- | --- |
| 8 | Record a whole section, then lock the phone for 30 seconds, unlock | Say what happened. The screen should not lock by itself while recording |
| 9 | Record a whole section, then take a call or trigger Siri | Show “Microphone interrupted. What you said so far is saved.” and recover afterwards |
| 10 | Record a whole section, then swipe the app away mid-sentence and reopen the card | Tell you an interrupted recording was saved and is being prepared |
| 11 | Turn on airplane mode, record a whole section, then turn it off | Say there is no connection, keep the recording, and prepare it once you are back online |
| 12 | Recording settings, Send finished sections to the card, Send, then cancel the sheet | Say nothing was sent |
| 13 | Same again, AirDrop the file to the Mac | Say it was sent |

For this phone check, retain the file from step 13. Do not apply it to the canonical card manuscript. The private reading changes in steps 4–5 are separate from that export. A later, separately authorized editorial pass can use the documented dry-run command:

```bash
npm run voice:apply -- --file ~/Downloads/oracle-voice-card-02-YYYY-MM-DD.json --dry-run
```

Read the dry-run report only; this check does not write to the card manuscript.

## Also tell me

- Whether you have unapplied drafts in the older studio (Recording settings, Sessions, Earlier recordings and writing). If not, it can be removed.
- Anything you had to be told how to do. That is the real test.

# Oracle card voice: the phone check

For Adrian, with the Mac and the phone. Nothing in the voice work has run on a phone yet. Do this once after the branch is merged and Pages has deployed, on one card (card 2), and write the result as a row in the device ledger in `docs/oracle/VOICE-STATUS.md` the same day.

## Before you start

1. Merge the branch and let Pages deploy.
2. In the Cloudflare Pages settings, confirm `ADMIN_EMAILS` holds the email you sign in with on the phone, and that `GROQ_API_KEY` is set.
3. On the Mac, from a clean committed tree:

```bash
VITE_ORACLE_NATIVE_ACCOUNTS=true npm run build:oracle
```

```bash
npm --prefix mobile run build:device
```

If the Swift does not compile, stop and send the error. Two handlers in `SceneDelegate.swift` were written without Xcode.

4. Install, open the app, sign in. The account screen's last line shows the build and commit. If Google sign-in is refused on the phone, use the email code.

## The check

| # | Do this | It should |
| --- | --- | --- |
| 1 | Open card 2, press Record, then Record in the workspace | Start within a second or two, with no blank bands top or bottom |
| 2 | Speak the Intro, press Send & next, keep speaking the Reading | Keep recording with no pause. Count aloud across the press: no number missing, none repeated |
| 3 | Press Stop & review | Show your words above the original at one text size |
| 4 | Say one word unclearly on purpose | Mark it, with a row underneath: the word, also heard, Hear it, It's right, Use |
| 5 | Edit a word with the keyboard up | Keep the apply button visible above the keyboard |
| 6 | Apply, then Undo, then apply again | Put your words in the reading, take them out, put them back |
| 7 | Record, then lock the phone for 30 seconds, unlock | Say what happened. The screen should not lock by itself while recording |
| 8 | Record, then take a call or trigger Siri | Show "Microphone interrupted. What you said so far is saved." and recover afterwards |
| 9 | Record, then swipe the app away mid-sentence, reopen the card, press Record | Tell you an interrupted recording was saved and is being prepared, and let you record again |
| 10 | Turn on airplane mode, record a section, turn it off | Say there is no connection, keep the recording, and prepare it once you are back online |
| 11 | Recording settings, Send finished sections to the card, Send, then cancel the sheet | Say nothing was sent |
| 12 | Same again, AirDrop the file to the Mac | Say it was sent |

Then on the Mac, with the file from step 12:

```bash
npm run voice:apply -- --file ~/Downloads/oracle-voice-card-02-YYYY-MM-DD.json --dry-run
```

Read the report. If it lists what you expect and no conflicts:

```bash
npm run voice:apply -- --file ~/Downloads/oracle-voice-card-02-YYYY-MM-DD.json
```

Then follow the commands it prints, and read card 2 on the preview before any second card.

## Also tell me

- Whether you have unapplied drafts in the older studio (Recording settings, Sessions, Earlier recordings and writing). If not, it can be removed.
- Anything you had to be told how to do. That is the real test.

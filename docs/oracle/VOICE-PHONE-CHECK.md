# Oracle card voice: the phone check

For Adrian, with the Mac and the phone. Nothing in the voice work has run on a phone yet. The work is merged and deployed (2026-11-12). Do this once, on one card (card 2), and write the result as a row in the device ledger in `docs/oracle/VOICE-STATUS.md` the same day.

## Before you start

1. On the Mac, fetch current `origin/main` and use a clean, isolated worktree at that revision. Do not switch or clean a shared checkout with loose work.
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
| 1 | Open card 2, press Record, open Recording settings, turn on Keep recording after Send & next, return to the workspace, then press Record | Start within a second or two, with no blank bands top or bottom |
| 2 | Speak the Intro, deliberately say one word unclearly, press Send & next, and keep speaking the Reading | Keep recording with no pause. Count aloud across the press: no number missing, none repeated |
| 3 | Press Stop & review | Show your words above the original at one text size |
| 4 | Check the deliberately unclear word from step 2 | If flagged, show a row underneath with the word, Hear it and It’s right; also heard and Use “…” appear when the second listening has a distinct alternative. Report if no word is flagged. |
| 5 | Edit a word with the keyboard up | Keep the review action visible above the keyboard |
| 6 | Use the review action (its label varies, for example Replace with my words), then Undo, then use it again | Put your words in the reading, take them out, put them back |
| 7 | Record, then lock the phone for 30 seconds, unlock | Say what happened. The screen should not lock by itself while recording |
| 8 | Record, then take a call or trigger Siri | Show "Microphone interrupted. What you said so far is saved." and recover afterwards |
| 9 | Record, then swipe the app away mid-sentence, reopen the card, press Record | Tell you an interrupted recording was saved and is being prepared, and let you record again |
| 10 | Turn on airplane mode, record a section, turn it off | Say there is no connection, keep the recording, and prepare it once you are back online |
| 11 | Recording settings, Send finished sections to the card, Send N sections, then cancel the share sheet | Say nothing was sent |
| 12 | Same again, AirDrop the file to the Mac | Say it was sent |

Then on the Mac, with the file from step 12:

```bash
npm run voice:apply -- --file ~/Downloads/oracle-voice-card-02-YYYY-MM-DD.json --dry-run
```

Read the dry-run report and record any conflicts or skipped sections. Applying the file to `oracle/cards/02.md` is a separate owner-led editorial step; review card 2 on the preview before any second card.

## Also tell me

- Whether you have unapplied drafts in the older studio (Recording settings, Sessions, Earlier recordings and writing). If not, it can be removed.
- Anything you had to be told how to do. That is the real test.

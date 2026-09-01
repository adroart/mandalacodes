# Merge and deploy the overnight audit branch

Branch: `claude/site-audit-improvement-a7ba4c`
Written 2026-09-02 by the session that produced the branch.

## State, measured, not assumed

Seven commits, 147 files, ahead of `origin/main` by seven and behind by zero.
`origin/main` is an ancestor of the branch head, so this is a clean fast-forward
and no rebase is needed. Re-check that before merging anyway, because main moves.

Verified on the branch head:
- `npm run typecheck` clean.
- `npx vitest run tests/unit` reads 725 passing, 1 failing. **That one failure is
  not real.** `atlasGenesisReadOnly` spawns a subprocess through `tsx`, which
  cannot bind its socket inside the agent sandbox and fails with EPERM. Run the
  same file outside the sandbox and it passes, so the true figure is 726 of 726.
  Do not "fix" it and do not report it as a defect.
- Every formula the writing pass targeted reads zero across all 64 cards, in both
  the card files and the built data.

Do NOT run the mobile browser suite as a merge gate. Its configuration never
starts the app, so against a cold checkout every spec fails on a refused
connection before the site exists. That is a known open item with its own to-do,
not a signal about this branch.

## What is on the branch

The writing: one sentence had been opening the same field on up to 64 of 64
cards. Eight such formulas are now at zero. Reference entries that are supposed
to repeat, the trigram definitions and the Immortals' name sentences, were
deliberately left alone.

The site, five things that were untrue or broken for a visitor:
- The globe showed five fabricated pieces with an invented dream signed "a sample
  steward". It now shows an honest empty sky.
- Every card's image described itself as card 1 to screen readers and search
  engines. Each card now names itself.
- The reading claimed "One of one". The art is made to order and editioned, so it
  now says made by hand and one of the 64 designs.
- Every collector action ended in a retry button that could never succeed. Ten
  screens now show one calm sentence and one working door.
- A scanned plaque went blank offline, silently. It now warms the card in hand
  and says what it needs when it cannot.

Plus: collections can hold cards for the first time, the reading surface is no
longer set in italic, 843 lines of dead code are gone, and the writing front door
now routes agents to the current spec instead of the retired one.

## What this branch does NOT fix

**The collector journey is still live on neither site, and merging this does not
change that.** This repo retired its collector write path on purpose when the
record moved. The replacement is fully built on the artist site and switched off
behind a launch flag there. Until someone flips that, no collector can claim a
piece. That work belongs to a session scoped to the other project.

So: after this merge the map is honestly empty rather than dishonestly populated.
That is the intended state, not a regression. Do not try to make lights appear.

## The merge

Adrian's standing instruction is that "merge" and "deploy" for this project are
one motion: merging to main promotes to the live domain automatically, in about
two minutes. The `/ship` skill carries the full chain and is the preferred route.

1. Re-fetch and confirm `origin/main` is still an ancestor. If it moved, rebase
   and re-run typecheck and the unit tests before going further.
2. Merge to main and push.
3. Watch the deployment actually land. A dashboard that looks connected is not
   proof; a commit on main is not proof either.

## Prove it live before reporting done

Against `https://mandalacodes.com`, not against a local server:

1. `/atlas` shows the empty sky line and NOT five pieces, and no dream signed by
   a sample steward.
2. `/universal-language/40` names Eternal Wellspring in its main image
   description. If it says Earth's Breath, the deploy did not land.
3. That same page contains no "One of one" and no italic body text.
4. Open two cards in a row and read the I Ching section of each. They must not
   open with the same sentence. That is the whole point of the writing pass and
   it is the one thing only a human eye confirms.
5. A collector screen shows one calm sentence and a working link, not a retry
   button and not a raw machine code.

If any of those five fail, say which one and stop. Do not patch forward on a live
site at speed.

## Rails

- Never the em dash character in anything a reader meets.
- No italics in copy.
- Warm earth tones only on the globe and map visuals, never blue or cold grey.
- Report what was measured, and label anything that was not.

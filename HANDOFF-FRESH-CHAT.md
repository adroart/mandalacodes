# Handoff to fresh chat — merge the overnight audit branch and take it live

Open a new chat in the mandalacodes project and paste the block below. The copy button on the fence grabs it cleanly.

```
Merge the branch claude/site-audit-improvement-a7ba4c to main and take it live on mandalacodes.com. Use the /ship skill, which carries the full chain for this project.

Read these first, in this order, before touching anything:
1. todo/plans/merge-and-deploy.md, which is the spec for this exact task.
2. todo/OVERNIGHT-STATE.md, for how the branch came to be and what was deliberately left undone.
3. todo/plans/launch-readiness.md, for the wider plan the branch executes the first tier of.

You do not need to re-survey or re-audit anything. A session on 2026-09-01 into 2026-09-02 audited the whole site across eight lanes, executed the first tier of the plan, and verified the result. Seven commits, 147 files. Typecheck is clean and the unit tests are 726 of 726.

Two things that will look like problems and are not. The unit run reports one failure in atlasGenesisReadOnly; it spawns a subprocess through tsx which cannot bind a socket inside an agent sandbox, and the same file passes outside one. Do not fix it and do not report it. Separately, the mobile browser suite never starts the app before it runs, so it fails wholesale on a cold checkout; that is a known open to-do and not a signal about this branch. Do not use it as a merge gate.

Before merging, re-fetch and confirm origin/main is still an ancestor of the branch head. It was a clean fast-forward at the time of writing, but main moves. If it moved, rebase and re-run typecheck and the unit tests before going further.

After the deploy lands, prove it on the live domain and not on a local server. Five checks, all listed in the spec:
- the atlas shows an empty sky and not five pieces
- card 40 names Eternal Wellspring in its main image description, not Earth's Breath
- that page has no "One of one" and no italic body text
- two cards in a row do not open their I Ching section with the same sentence
- a collector screen shows one calm sentence and a working link, not a retry button

If any of the five fails, name which one and stop. Do not patch forward on a live site.

One thing this branch does not fix, so do not chase it. The collector journey is live on neither site. This repo retired its collector write path on purpose when the record moved, and the replacement on the artist site is built but switched off behind a launch flag there. The map being empty after this deploy is the intended honest state, not a regression. Making lights appear is a separate job in the other project.

Hard rails:
- Never the em dash character in anything a reader meets.
- No italics in copy.
- Warm earth tones only on globe and map visuals, never blue or cold grey.
- No file paths or identifiers in the sentences Adrian reads; those belong in commands.
- Send a clickable live URL when there is something to look at.
- Report only what you measured, and label anything you did not.

When the deploy is verified, stop and report. Do not start follow-up work.
```

---

## Context for after (Adrian's reference, not for the fresh chat)

Three decisions are waiting and none of them block this merge. The collector journey needs a switch flipped in the artist project. The planned rewrite of the 64 opening readings needs re-scoping, since two of its three diagnoses no longer match the shipped writing. And "the lineage calls this" sits on 43 cards, which is a voice call only you can make.

The Design section carries the same repeated-opening fault on 51 of 64 cards. It was outside the three sections named for the overnight pass, and the method that worked is written down.

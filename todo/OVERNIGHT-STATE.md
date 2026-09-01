# Overnight run state — 2026-09-01

Adrian asleep, autonomous execution authorized for the full launch-readiness plan.
This file exists because the session already restarted once and lost three agents'
reports. If a session picks this up cold, read this first, then re-measure before
assuming anything.

## Ground truth commands

Writing pass status:  `node $TMPDIR/oracle-tools/status.mjs`  (rebuild from lib.mjs if TMPDIR rotated)
Health:               `npm run typecheck` then `npm run test:unit` (baseline 696/696 pass)
Never trust a report over a measurement.

## DONE and measured

- Eight-lane audit of the whole site. Reports in the session scratchpad, `audit/01..09`.
- Fable wrote the definitive plan: `todo/plans/launch-readiness.md`.
- Cross-repo finding: the collector journey is live on NEITHER site. The 410 wall on
  this repo is deliberate and correct. The replacement is built on Adrian-Website and
  switched off at `launchFlags.ts:108`, `livingLegacy: false`. Not fixable from here.
- Diversify pass part one. Four fields went from formulaic to zero across all 64 cards:
  I-Ching Reading 64 to 0, Amino acid 57 to 0, Programming partner 45 to 0,
  Physiology 30 to 0. Brief at `oracle/sections/_DIVERSIFY_BRIEF.md`.

## IN FLIGHT

- Tarot repair, 6 Opus agents, 50 cards, 67 sentences. Both ends of the Tarot lead
  paragraph. Brief at `oracle/sections/relations/_TAROT_REPAIR_BRIEF.md`.
  Each wave has a different primary move, because the first pass failed by having
  every agent reach for the same replacement.
- Site item: remove the five fabricated pieces from the public record.
- Site item: wire the save-to-collection button so Collections stops being a dead end.
- Site item: fix the silently blank offline reading on the QR landing path.
- Site item: delete the dead orphaned components and three unused dependencies.

## QUEUED, in order, sequenced because they share files

1. The honest boundary. Roughly 20 screens still call the retired collector endpoints
   and show a raw error string with a retry button that re-fires the same failure.
   Replace with one calm boundary sentence and a working door. The 410 response body
   already carries a `destination` field the UI throws away.
2. The italics and em-dash sweep. Must run AFTER the boundary work, they share
   `AdminAtlas.tsx` and `StewardEdit.tsx`.
3. Corpus rebuild plus full verification, then commit.

## RULES FOR TONIGHT

- Commit to this branch only. Do NOT merge to main, do NOT deploy. Adrian reviews first.
- Every number reported must be measured by the reporter. Label anything unmeasured.
- Salvage before relaunch. When an agent stops without reporting, measure its files
  before redoing its work. Three stopped agents tonight had already finished.

---

## CORRECTION, recorded because it cost two passes

The coordinator reported the writing pass complete when it was not. Cause: the
ban and the measurement were both written as EXACT PHRASES rather than STEMS.

"The body seats this code in the chest" was banned. Agents wrote "The body seats
this code at the chest", which is the same sentence, and it passed every check
including the coordinator's own. Twenty three cards sat in that state while the
dashboard read zero.

**The rule that replaces it:** ban the first four or five words regardless of what
follows, and measure the same way. A phrase ban is not a sentence ban.

**The test now given to every writing agent:** take your new first five words and
ask whether that sentence would work unchanged on any of the other sixty three
cards. If yes, it is a formula, whatever its grammar.

Verifier that encodes this: `$TMPDIR/oracle-tools/verify2.mjs`. It reports any
5-word stem shared by five or more cards, per field, at both ends. Rebuild it from
`lib.mjs` if TMPDIR has rotated. Do not declare this work done on any other check.

## Also fixed tonight, found by an agent, not by the audit

`oracle/cards/42.md` and `55.md` ended with literal `</content>` and `</invoke>`
lines, left by a malformed agent write and committed to HEAD long before tonight.
The build is fail-closed on MISSING prose but not on stray text, so both shipped
into the live corpus. Removed. Backups at `$TMPDIR/42.bak` and `55.bak`.
Worth a repo-wide scan for this class of artifact outside `oracle/cards/`.

---

## Where the night ended

Two commits on `claude/site-audit-improvement-a7ba4c`, pushed to origin.
Branch NOT merged and NOT deployed, by choice. Adrian reviews first.

- `17bca2b` the writing pass, all 64 cards plus the rebuilt corpus and the
  repaired parser tests.
- `d6477ae` the site fixes: honest empty globe, the moved-record boundary
  across ten screens, collections wired, the offline QR path, dead code out.

Measured at the end, by me, not reported by an agent:
- `npm run typecheck` clean.
- `npx vitest run tests/unit` 725 pass, 1 fail in the sandbox. That one fails
  only because `tsx` cannot bind an IPC socket here; run outside the sandbox it
  passes, so the true number is **726 of 726**.
- Every targeted prose formula measures zero across all 64 cards.

## Checked and found NOT to be a problem

An agent flagged "client-side navigation into a card route renders blank".
Not reproducible. The deck tile is a flip card by design: the first click flips
it, the second opens the reading. Driven properly on the live server it lands on
`/universal-language/1` with the full reading. Do not go hunting for this bug.

## Still open when the night ended

The italics and em dash sweep was running against the live page. Before numbers
on `/universal-language/1` were 29 italic text nodes and 3 em dashes in visible
copy. If that agent did not finish, re-measure before redoing anything.

One trap recorded for whoever picks it up: most of the ~1,583 em dashes in
`oracle/cards/*.md` are STRUCTURAL DELIMITERS the parser splits on, as in
`### The drive — Gate 24`. Removing those breaks the deck. "1 — Self-Expression"
reaching a reader is a RENDERER fault, not a source fault. Only fix an em dash
in the markdown after proving it sits inside prose.

## Left deliberately untidy

A stash tagged `dead-code-removal-wip` holds deletions that are now committed in
HEAD, so it is redundant. It was left rather than dropped because its agent had
not reported and might still have been holding it. Safe to drop after confirming
nothing is running: find it by tag, never by index, since the stash stack is
shared with other worktrees.

---

## Final state, 2026-09-02

Five commits on `claude/site-audit-improvement-a7ba4c`, all pushed. Remote HEAD
matches local. Nothing merged, nothing deployed.

Verified by the coordinator at the end, not taken from any agent's report:
- typecheck clean
- 725 of 726 unit tests pass in the sandbox; the one failure is `tsx` unable to
  bind an IPC socket and PASSES when run outside the sandbox, so 726 of 726
- every targeted prose formula reads 0 across all 64 cards
- "One of one" reads 0
- the underscore lead-ins read 0

Everything in the launch-readiness plan's first tier is done, both halves.

## Deliberately not done, and why

- **The Design section**, "where this drive lives" on 51 of 64. Adrian named
  I-Ching, Body and Relations. Design was outside that scope. Filed in TODO.md
  with the method that worked.
- **The skeleton-and-trim pass** on the opening third paragraphs. It is gated on
  Adrian's decision about re-scoping the reading rewrite, which is his call.
- **`EBReading.controller.txt`** still carries card 1's old prose as the design
  tool's baked-in sample. It is not live prose and editing it risks the
  dc-import round trip for no reader benefit.
- **Restoring the editorial ledger** and rescuing the orphaned invocation. Both
  are restoration tasks where what was lost is not knowable from here.

## Corrections made to earlier claims in this file

The unit baseline quoted at the top of this file as "696/696" was wrong. It came
from the engineering audit lane and did not hold in this worktree; the real
baseline was 688 passing with 8 failing, and an agent caught it. The 8 were the
generated corpus being stale against rewritten source, which the rebuild fixed.

---

## Near miss worth writing down

The dead-code agent set out to park only its own four files. A typo in the path
list meant the command matched nothing it named, so it stashed the ENTIRE
working tree, which at that moment held the unfinished work of several other
agents. It then dropped that stash before noticing.

It recovered the dropped object with `git fsck` and nothing was lost. Verified
independently afterwards: tree clean, local and remote at the same commit, all
64 cards present, every targeted formula reading zero in both the markdown and
the built corpus, tests unchanged.

**The rule this adds.** The workspace already says never use bare `git stash`.
This is the sharper version: *a scoped stash whose paths do not match is an
unscoped stash, silently.* The scoping lives in an argument nobody checks, and
the failure looks identical to success until you read what came back. Before
dropping any stash, diff it against the working tree, and never drop one while
other sessions are writing to the same tree.

**The deeper point.** Ten agents were writing into one shared working tree at
once. That is what turned one agent's typo into everyone's risk. Splitting by
file kept the EDITS safe; it did nothing about a whole-tree git command, because
git operates on the tree and not on the split. Parallel writing agents need
either separate worktrees or a standing rule that none of them runs a
tree-scoped git command at all.

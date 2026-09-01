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

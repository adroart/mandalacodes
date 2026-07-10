# The repair runbook: what "go" means

_Written 2026-07-10. This is the master orchestration contract for the five execution
briefs in this directory. When Adrian says "go" (or "go wave 1", "go phase 2", etc.) in a
Claude session opened in this repo, the session becomes the orchestrator and executes this
file top to bottom. Every brief is self-contained; the orchestrator spawns one agent per
work unit and never implements by hand. All file pointers in the briefs were verified
against the code on 2026-07-10._

## The briefs

| File | Covers | Vehicle |
|---|---|---|
| `phase-0-collector-journey.md` | Sale/claim notification emails, the claim dead-end fix | One careful agent, own branch |
| `phase-1-wiring-queue.md` | 15 small wiring fixes, ordered 01 to 15 | One agent works the queue in order, one commit per item |
| `phase-2-field-features.md` | 9 independent mini-briefs (globe features + 2 refactors) | One agent per feature, parallel |
| `phase-3-latent-assets.md` | Dead-code cleanup, ritual remount, lookbook, profile hub, procession questions | One agent per task |
| `phase-4-content-and-prework.md` | Article scaffolds, glossary, about, artists hub, writing prework | One agent per task, all drafts gated |

## Standing decisions (defaults Adrian can override any time before that work starts)

1. **Old reading code:** delete the 2,660 superseded lines across 17 files; keep and
   reconnect only the coin-toss divination ritual. (Inventory with per-file verdicts is in
   the phase 3 brief.)
2. **The deep rewrite of the 122 card files:** deferred until Adrian's 5-card reading
   pilot passes. No agent scaffolds it before then.
3. **Outreach status labels:** the admin edit control ships with the existing stored
   statuses plus placeholder manual labels (contacted, declined, paused). Adrian renames
   at sign-off; renaming later is cheap.
4. **The erase endpoint stays curl-only** (confirmed intentional). No admin button.
5. **The stranded gateway page gets a quiet link** rather than deletion (queue item in
   phase 1).

## Execution order

### Wave 1 (starts immediately on "go"; two agents in parallel)

- **1a. Collector journey** on branch `repair/collector-journey`, per the phase 0 brief.
  HOLD the merge until Adrian approves the draft email and UI copy (marked DRAFT in the
  brief; a 5-minute read). After merge, live-verify everything except the sale-confirm
  email, which stays dark until the ops gate (below) runs.
- **1b. Wiring sweep** on branch `repair/wiring-sweep`, per the phase 1 brief, items 01
  to 15 in order, one commit per item, `npm run typecheck` after every item. Items 14
  and 15 (piece-page parity, owner lights on the globe) are flagged bigger; if either
  balloons, defer it to wave 2 rather than stall the queue. At the end: post a live
  dev-server link for Adrian's visual pass, then merge.

### Wave 2 (after wave 1 merges; parallel workspaces, one agent each)

- Dead-code deletion + coin-toss ritual remount (phase 3 brief, task 1). Runs first in
  this wave because it touches the same oracle-entry area as wave 1; sequencing avoids
  conflicts.
- All phase 2 features EXCEPT city clustering: the ring un-gating, the flat 64-codes
  index, the yearly words ask, collected-cards-on-map, the steward nudges, the admin
  outreach control, and the two refactors. All independent; run 2 or 3 at a time.
- City clustering starts only after Adrian answers the four design questions listed in
  the phase 2 brief.

### Wave 3 (any time after wave 1; can overlap wave 2; lowest urgency)

- Phase 4 content scaffolds: the three missing articles (shipped `draft: true`), the
  symbolism glossary, the about page, the artists hub from the existing spec, the three
  stale path corrections, the line-text consistency backfill, and the 63 artwork-reading
  scaffolds (step 0 of that task hides scaffold-status readings from public view first).

### Wave 4 (after the standing decisions above are ratified and wave 2 lands)

- The chart-to-art gallery in-site, plus the profile as hub with profile in the main nav
  (phase 3 brief, tasks 2 and 3). Step 0 is the live access-token check flagged in the
  brief. Placement/layout questions go to Adrian as a short design session before build.
- The procession: deliver the one-page design-questions doc (phase 3 brief, task 4) for
  a brainstorm with Adrian. No build until that conversation happens.

## Merge and deploy policy

Merging to main deploys the live site in about 2 minutes. Rules:

- Safe, unflagged work (the wiring queue, deletions, refactors): the orchestrator opens
  the PR, verifies typecheck plus the item's acceptance check, merges, then proves the
  live page serves the change before reporting done.
- Anything flagged "needs Adrian" in its brief (phase 0 copy, clustering design, all
  phase 4 content, outreach labels, gallery placement): PR opens and HOLDS with a one-line
  ask to Adrian. His reply merges it.
- Adrian can say "hold everything" to switch all merges to manual.

## Verification rules (every agent, every item)

- `npm run typecheck` must pass before any push; CI enforces it.
- Restart the dev server after structural edits; HMR serves stale code. Kill duplicate
  servers on ports 2222/2223/2224.
- UI work ships with a clickable live dev-server link for Adrian, not a screenshot.
- Never use the em-dash character, in copy or code.
- Globe/world visuals use warm earth tones only (browns, bronze), never blue or cold gray.
- Never edit generated files (see the phase 1 brief's pointer corrections).

## Adrian's parallel track (blocks nothing, gated by nothing)

- **The ops gate** (`todo/handoff/GO-LIVE-RUNBOOK.md`): create the two database tables,
  set the two secrets, turn on the public mirror, baseline backup. Until this runs, the
  sale-confirm email built in wave 1a stays dark. One sitting.
- **The sale-notification sender on adrianrasmussen.com** (the other repo). Without it, a
  sale there never opens a claim here.
- **Writing**, in his own rhythm: the 5-card reading pilot (must include card 3) in
  WordForge, then the 64 readings, invocations, piece stories, and voice passes over
  agent drafts as they queue up.
- **Sign-offs as they surface:** phase 0 copy (wave 1), clustering design questions
  (wave 2), content voice passes (wave 3), gallery placement + procession brainstorm
  (wave 4).

## Progress ledger

The orchestrator updates this section as waves complete.

- [ ] Wave 1a built · [ ] copy approved · [ ] merged · [ ] live-verified (post-ops-gate item noted)
- [ ] Wave 1b items 01-15 · [ ] visual pass · [ ] merged · [ ] live-verified
- [ ] Ops gate run by Adrian
- [ ] Art-site sender built (other repo)
- [ ] Wave 2 dead-code + ritual · [ ] features · [ ] clustering (after design answers)
- [ ] Wave 3 content scaffolds (all held as drafts for voice passes)
- [ ] Wave 4 gallery + profile hub · [ ] procession brainstorm held

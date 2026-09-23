# The mobile browser lane in CI is red on main, and nobody sees it

Recorded 2026-09-16 while shipping cards 3, 14, 47, 52 and 64 (PR #206).

## Release integration, 23 September 2026

The accepted audit at `29d1108` restores the current reading-frame controls and corrects the browser fixtures. The release integrates those repairs with main `7e5ecfd`, including Daybook styling and the counted CI summary. The intended resulting workflow blocks on mobile failures, runs the production PWA lane, and keeps the always-run JSON summary and artifact upload. Earlier observations and unresolved-call wording below describe the baseline before the accepted repairs, not the integrated release. Fresh integration verification and publication remain pending.

## Historical measurements before the accepted repairs

- The `test-mobile` job (Playwright, Mobile Chrome, `npm run test:mobile`) fails on every recent run of main: 2b27e2f, 9eafe90, c7bc950, 52d9860, and back to fe67966 on 2026-09-15. No green mobile run was found in the last 40 runs.
- The overall workflow still reports success because the lane is not a required check, so a red mobile lane never blocks a merge and never shows on the PR bar. The typecheck and unit lane (`test`) is green throughout.
- The job runs into its 20-minute limit and the runner kills it: on run 35070372247, 43 specs failed and 76 passed before the cut, so the full count is unknown.
- Failing specs span unrelated surfaces, which says the cause is shared rather than in any one feature: account pieces empty state, atlas light and dark mode, offline QR card arrival, coin cast controls, card entrance (QR arrival, deck Back), entry codes rail, and nearly the whole reflection recorder and journal suite. Many fail at the 30-second per-test timeout.

## Why nobody saw it, named 2026-09-22

Two separate mechanisms, both now measured against the API rather than inferred.

1. **`continue-on-error: true` on the `test-mobile` job keeps the RUN's
   conclusion at `success` while the JOB's conclusion is `failure`.** Run
   35174697859 and run 35190547827 (both 2026-09-17) each carry
   `test-mobile` → `failure` inside a run → `success`. So the lane was never
   hiding; it was one click down, under a green badge, and the badge is what
   anyone reads. That is the whole of "the run still says success". It is not a
   swallowed exit code and not a mis-wired job: the flag is doing exactly what
   it was added to do, and the gap was that nothing else stated the result.
2. **Nothing survived the paths that lost the evidence.** The artifact upload
   was `if: failure()`, which does not match `cancelled`. Run 35070372247 ran
   20m15s against a 20-minute cap, so the runner cancelled the job, the upload
   was skipped, and that run produced no counts, no report and no record of
   which specs failed. Runs 35072415647 and 35105950236 lost their evidence the
   same way after being superseded by `cancel-in-progress`.

**Measured on main (b9da484) 2026-09-22, `Mobile Chrome`, one full local run:
41 failed, 80 passed, 10 skipped, 131 total, 11.6 minutes.** Where the red is:

| spec file | red |
| --- | --- |
| `tests/oracle-reflection-recorder.spec.ts` | 22 |
| `tests/oracle-visual-foundation.spec.ts` | 5 |
| `tests/oracle-entry-codes.spec.ts` | 3 |
| `tests/oracle-card-coin-cast.spec.ts` | 3 |
| `tests/oracle-card-entrance.spec.ts` | 2 |
| `tests/offline-qr-reading.spec.ts` | 2 |
| `tests/light-mode-materials.spec.ts` | 2 |
| `tests/typography-contract.spec.ts` | 1 |
| `tests/account-pieces.spec.ts` | 1 |

31 of the 41 sit behind the two undecided product questions in `TODO.md`'s
"Found in the 2026-09-08 mobile suite audit" section: the force-hidden
`.oracle-bottom-nav` (recorder 22, visual foundation 5, the entrance Safari
handoff, the typography title) and the "Your codes" tile (entry codes 3). Both
are Adrian's calls. The two in `light-mode-materials` are the already-filed
`/api/atlas` mock item, fixed on the branch behind PR #231.

So the shape of the answer is not "make the lane count by making it block" —
the lane is red for a reason no agent may decide, and requiring it would turn
every merge red over an unanswered question. What was actually missing was a
surface that states the number. `scripts/mobile-lane-summary.mjs` now writes it
to the run summary on every path, including a suite cut short by its own
budget, and the artifact upload is `if: always()`.

**Still open, and it is a judgement call rather than a measurement:** whether
this lane should ever block. It can only honestly block once the product
questions above are answered and the remaining ten are triaged. Until then the
run badge stays green by design and the run summary is where the lane is read.

Two things found while measuring that are not this lane's, both now in
`TODO.md`. CI has not run at all since 2026-09-18: every run since fails at
`gate` in three seconds with no steps, over GitHub billing, so `test` and
`test-mobile` are both skipped and no workflow change here takes effect until
that is cleared. And "the typecheck and unit lane is green throughout" above
stopped being true on 2026-09-22 — `npm run typecheck` fails on a clean main
over `workers/media.ts`, which landed inside the billing outage with nothing
watching. That is the same disease as this plan's, arriving through a different
door: a lane whose result nobody could see.

## What to do

1. Reproduce locally with the sandbox off (Chromium cannot launch inside it): `npm run test:mobile` from the project root against a fresh dev server on 2222. If it is green locally, the fault is in the CI environment (dev server start, headless Chrome, a secret the preview needs) and the log's first failing spec is the lead.
2. If it is red locally, take one short spec (account pieces empty state, 6 seconds) and read what it waits for. A 30-second timeout across unrelated pages points at something every page loads: the service worker, the offline cache, a redirect, or the login stub.
3. Once the cause is named, decide the lane's shape: make `test-mobile` a required check so main cannot go red silently again, or split the recorder suite (the slowest block) so the job fits its limit.
4. Done when a run of main shows `test-mobile` green and the lane is required, or the decision not to require it is written here with the reason.

Steps 1 and 2 are answered above: it is red locally too, and the shared cause
is named. Step 3 is not an agent's call while 31 of the 41 wait on a product
question, so what shipped instead was the report. Step 4 is unchanged and still
open.

## Not this

- Do not raise the job or test timeouts to make it pass; a lane that passes by waiting longer proves nothing (working pattern, 2026-09-07).
- Do not delete or skip the failing specs. They guard shipped behaviour.

## Local resolution, 22 September 2026

The reliability-repair branch now passes the complete Mobile Chrome lane:
**135 passed, 10 existing conditional skips, zero failures (3.4 minutes)**. The
production-only offline QR and Learn cases execute separately against the generated
service worker: **3 passed**. No failing spec was skipped or given longer timeouts.

The fixes restore reachable recorder/Safari controls, current-frame accessibility,
truthful account and retired-route behavior, and correct synthetic response
contracts. Stale visual selectors now target the visible frame. The channel helper
waits for the actual animated chapter jump before scrolling to its assertion.

The CI job builds once, runs both browser lanes, and no longer permits failure via
`continue-on-error`. A failing lane therefore fails the workflow. Publication is
held by the coordinator, so this is local proof rather than a green run on main.
Required-check configuration is also separate: the branch-protection API returned
403 because of the repository's plan/visibility constraint. That setting was not
changed or claimed complete. See [the repair report](audit-2026-09-22.md) for exact
evidence, commands, and remaining deployment boundaries.

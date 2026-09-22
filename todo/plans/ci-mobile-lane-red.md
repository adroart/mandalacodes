# The mobile browser lane in CI is red on main, and nobody sees it

Recorded 2026-09-16 while shipping cards 3, 14, 47, 52 and 64 (PR #206).

## What is true, measured

- The `test-mobile` job (Playwright, Mobile Chrome, `npm run test:mobile`) fails on every recent run of main: 2b27e2f, 9eafe90, c7bc950, 52d9860, and back to fe67966 on 2026-09-15. No green mobile run was found in the last 40 runs.
- The overall workflow still reports success because the lane is not a required check, so a red mobile lane never blocks a merge and never shows on the PR bar. The typecheck and unit lane (`test`) is green throughout.
- The job runs into its 20-minute limit and the runner kills it: on run 35070372247, 43 specs failed and 76 passed before the cut, so the full count is unknown.
- Failing specs span unrelated surfaces, which says the cause is shared rather than in any one feature: account pieces empty state, atlas light and dark mode, offline QR card arrival, coin cast controls, card entrance (QR arrival, deck Back), entry codes rail, and nearly the whole reflection recorder and journal suite. Many fail at the 30-second per-test timeout.

## What to do

1. Reproduce locally with the sandbox off (Chromium cannot launch inside it): `npm run test:mobile` from the project root against a fresh dev server on 2222. If it is green locally, the fault is in the CI environment (dev server start, headless Chrome, a secret the preview needs) and the log's first failing spec is the lead.
2. If it is red locally, take one short spec (account pieces empty state, 6 seconds) and read what it waits for. A 30-second timeout across unrelated pages points at something every page loads: the service worker, the offline cache, a redirect, or the login stub.
3. Once the cause is named, decide the lane's shape: make `test-mobile` a required check so main cannot go red silently again, or split the recorder suite (the slowest block) so the job fits its limit.
4. Done when a run of main shows `test-mobile` green and the lane is required, or the decision not to require it is written here with the reason.

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

# Review: art registration + living legacy system (2026-07-02)

Full-system review of the registration/ledger/steward stack, the living-art-legacy
build, and the links to adrianrasmussen.com. Method: three parallel audits (core
ledger code vs plan invariants; the claim-window/claim-bridge commits from PR #57;
cross-repo linkage, QR flows, and docs) plus a full test run. Baseline: main at
`ea78310`, 177/177 unit tests passing.

**Bottom line:** the M0 to M5 build is sound. The plan's load-bearing invariants
are genuinely implemented and tested. The serious problems were (1) the two
newest features changing the ratified ownership policy without a plan amendment,
(2) doc/status drift, and (3) one cross-repo D1 migration hazard. Dispositions
below record what was fixed on branch `claude/art-registration-architecture-tz9tby`.

## 1. Claim window + claim bridge policy drift (PR #57) — HIGH

The plan's ratified rule: a claim request never binds anything; rebinding happens
only via an audited `transferred` event a human approves; heirs are hints, never
credentials.

| Finding | Where | Disposition |
|---|---|---|
| 30-day auto-free to the requester with no human in the loop; a squatter could win by keeper silence. Labeled "ratified" but the plan never ratified it. | `utils/claimWindow.ts` | Ratified as hardened per the 2026-07-02 plan amendment; grace period added; stays dormant until a notification channel exists |
| Heir email match returned instant `overridden` (auto-bind), contradicting decision #1 and `HeirRegistration`'s own contract | `utils/claimWindow.ts` | Fixed: heir match is informational only (`heirEmailMatch`), never overrides |
| Zero grace between the day-30 final warning and the day-30 free | `utils/claimWindow.ts` | Fixed: `FINAL_WARNING_GRACE_DAYS` (7) after the delivered final warning |
| No storage for `warningsSent` / `holderResponded`; no delivery channel exists (letters are in-product only), so a non-visiting keeper never sees a warning | `types.ts`, product-wide | Fixed: warnings persisted on `ClaimRequest`; activation gated in the plan on an out-of-band channel |
| Bridge accepts `requesterEmail` as an unverified assertion; the holder is trained to trust that field, enabling deception with a leaked `CLAIM_BRIDGE_SECRET`; chained with the heir override this was full automated transfer | `functions/api/atlas/claim-bridge.ts` | Fixed: `source: 'bridge'`, `requesterEmailVerified: false`, surfaced in holder views; heir override removed |
| Window is dead code; bridge doc-comment advertises escalation machinery that does not run | both files | Fixed: comments now state dormancy and activation preconditions |
| `CLAIM_BRIDGE_SECRET` absent from secrets tooling and docs; bridge had zero tests | `scripts/sync-secrets-to-cloudflare.sh`, `docs/secrets-sync.md` | Fixed: secret added to tooling/docs; bridge unit tests added |
| Per-requester cap keyed only by asserted `requesterRef`, trivially bypassed by the bridge caller | `utils/claimRequests.ts` | Fixed: cap also keyed by lowercased requester email |
| TOCTOU: stewards read for routing outside the claim-requests mutator | `claim-bridge.ts`, `steward/request-claim.ts` | Fixed: steward lookup moved inside the mutation closure |

## 2. Core ledger defects — MEDIUM/LOW

| Finding | Where | Disposition |
|---|---|---|
| `LedgerEvent.note` is free text inside the hashed, unerasable payload; invariant enforced by policy only. Never mirrored/public, so exposure is private-only | `functions/api/atlas/event.ts` | Mitigated: length cap + policy comment; field retained (existing chains depend on it) |
| Admin event endpoint allowed a second `claimed` event on a chain (inert for the ordinal, pollutes the chain) | `event.ts` | Fixed: 409 guard mirroring the `created` genesis guard |
| Phase B claim retry duplicates `consentHistory` entries (consent stamped before the ledger append) | `steward/claim.ts` | Fixed: idempotent consent stamping |
| No rate limits on steward/admin write endpoints; unauthenticated `holder-chart` unlimited | `steward/inscribe.ts`, `steward/update.ts`, `event.ts`, `holder-chart.ts` | Fixed: D1 fail-open limiter applied |
| `public.json` written non-conditionally (deferred L5 race; self-heals) | `_helpers.ts` | Addressed per implementation notes on the branch |
| Founding Lights ordinal gap reveals that a hidden claimed piece exists (existence only, never identity) | `ledgerProjection.ts` | Accepted design tension; documented here |

## 3. Docs, ops, and cross-repo linkage

| Finding | Where | Disposition |
|---|---|---|
| TODO.md marked M0 to M5 "pending merge"; the work is merged to main (squash via PR #42, later PRs build on it) | `TODO.md` | Fixed: status lines corrected to merged, ops pending |
| HANDOFF.md said PR #54 unmerged; it merged (`2d935b8`) | `HANDOFF.md` | Fixed |
| Test counts frozen at 157/159; reality 177 across 10 files | `MORNING-AFTER.md`, plan | Fixed |
| No record of which MORNING-AFTER ops steps are done (migration, secrets, mirror, backup, light #1) | `MORNING-AFTER.md` | Fixed: status-ledger checklist added |
| Build-record commit hashes in the plan no longer resolve (history squashed) | `living-art-legacy.md` | Noted in the 2026-07-02 amendment |
| Both repos hold a `001_init.sql` with different content for the same shared D1 database; D1 journals by filename, so a fresh-database apply from one repo silently blocks the other's schema | `migrations/`, Adrian-Website | Documented in `docs/d1-migrations.md` with safe operating rules; long-term consolidation recommended. Do not rename applied migrations |
| `migrations/003_rate_limit.sql` instructed applying from this checkout, against the wrangler.toml ownership policy | `migrations/003_rate_limit.sql` | Fixed: reworded, points at `docs/d1-migrations.md` |
| Backup docs claim missing keys are "skipped"; `ledger.json`/`stewards.json` are required and error | `MORNING-AFTER.md`, `ledger-successor.md` | Fixed |
| Supersede banners still cite Clerk (retired 2026-06-15 for Better Auth) | `ledger-architecture.md`, `ledger-api.md` | Fixed |
| Stale route comment | `functions/universal-language/[number].js` | Fixed |

## 4. Product gaps (not fixed here; tracked for planning)

- **Piece pages are editorially empty.** The zero-signup QR landing works exactly
  as planned, but all 64 archive entries carry placeholder descriptions and empty
  `images[]`. The M1 promise is structurally built, content-empty. Blocking
  question in `todo/plans/piece-page-buildout.md` (where editable content lives)
  is still open. Highest-leverage gap before collector outreach.
- **No notification transport.** M5's "the piece writes back" letters and the
  claim window's warnings both need out-of-band delivery; in-product letters only
  reach holders who already return. One channel decision unblocks both.
- **Globe clustering** for multi-piece cities remains unbuilt
  (`piece-page-buildout.md`).

## Verified clean (for future reviewers)

Chain content invariant enforced at every event-construction site; salted
commitments with body+salt co-deletion on erasure; mirror ships `public.json`
only; etag-guarded concurrency on all four mutable R2 objects; M0 fixes
(multi-piece binding, edition keys, backdated guard, notes leak) all real;
two-phase claim, Founding Lights ordinal, and holder-routed anti-takeover
correct; Ring 2/3 gating fail-closed including kinship and holder-chart; sealed
inscriptions never leak to non-authors; account deletion unbinds without
erasing; sale webhook matches its handoff spec exactly (HMAC vector reproduced
independently), timing-safe, idempotent, `created` vs `transferred` correct;
`003_atlas_legacy.sql` matches every query; `ledger-successor.md` properly
rewritten.

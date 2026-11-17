# Unmerged work reconciliation, 2026-11-16

Historical snapshot: fetched `origin` and compared local and remote-tracking heads with `origin/main` at `bc8f08b2d81288ece586fce354b6ce40b0575d33`. The counts below describe that pinned audit, not a fresh inventory or current unmerged state. PR #396 has since merged and deployed; see the release record below.

At that historical snapshot, Git ancestry reported 57 refs across 34 distinct tips as unmerged. Of these, 23 tips had no non-merge patches missing by Git patch-equivalence; 11 required semantic reconciliation, completed below. An unmatched patch is not proof that its behavior is absent: squash merges and later edits can change the patch identity. Merge-only changes also need separate review before any branch deletion.

## Reconciliation result

Audit completed against the pinned main above on 2026-11-16. The audit initially classified one tip as missing useful work, seven as incorporated, two as superseded, and one as owner-held. Following the verified PR #396 release, the **current disposition of the reviewed 11 is eight incorporated (including #396), two superseded, and one owner-held**. No selected missing candidate remains from that review. No missing voice/memo runtime fix was identified.

Audit evidence uses commit diffs, file-tree equality at corresponding squash commits, follow-up diffs, and stable patch IDs. It does not equate a differing old file with a missing feature. The PR states recorded at audit time are historical and do not describe current GitHub state.

## Oracle voice phone UI candidate, 2026-11-17

This is a new branch candidate after the historical reconciliation above, not one of its 11 audited tips. `codex/oracle-history-range-20261116` at installed runtime revision `9fd1b270` builds on the merged passage editor (#415). Its seven feature commits since that merge cover the compact pending-review dock and operation switch, simplified passage review, History restore as a separate draft, selected original/recorded word replacement, and the Review header's “Selected words” destination. The proposed PR targets main with this coherent voice UI change and no manuscript, generated corpus, server, or migration files. Current main `0aa1e8d2` was merged into the candidate; its newer session-matching test assertion and unrelated TODO/plan entries were retained. CI must check the integrated PR revision before any merge.

**Verified on the physical iPhone:** build 19 installed from the exact committed source `9fd1b270`, with fresh app and widget signing profiles expiring 2026-11-24 at 12:35:30 and 12:35:28 Asia/Makassar. History opened and restored one separate pending draft. Native long-press selected the original and recorded spans, then Prepare showed the pending replacement, “Selected words” header, original/recorded words and “Not applied yet” state. Apply was not tapped. The installed source and signed app were recorded in a private release manifest; the physical UI test passed. This verifies those specific phone interactions, not the entire card 2 acceptance flow or production behavior.

**Preservation:** the 752 pre-existing audio chunks and 12 audio sessions retained identical keys and value hashes through install and UI checks. The source pending result and working reading content were unchanged. One verification draft remains pending and unapplied; routine resume/version/timestamp metadata changed during viewing. Existing retained history has a per-draft limit, so History is not an unlimited archive. Restoring a deletion-only historical draft can be reviewed, but Apply stays disabled with an explanation. The temporary test runner and generated test build files were removed; the verification draft, backups and private receipts were retained outside this repository.

**Browser and code checks:** the 110-case voice suite at `9eea5686` finished with 108 passed, 2 skipped, zero unexpected failures; the section-draft unit group passed 30/30 and typecheck passed. The `9fd1b270` header correction passed the affected Phone and Desktop browser cases (2/2) and typecheck. Apply/Undo behavior has fixture coverage; physical Apply/Undo was deliberately not exercised on the owner's reading. Browser fixtures do not establish live speech-provider behavior.

**Integration still required:** review the branch diff and run required CI on the merged-main PR revision, then merge and release only with the owner's authorization. Verify the released revision separately; the phone install alone does not make the site or main current. Complete the real-recording card 2 check in `docs/oracle/VOICE-PHONE-CHECK.md` before claiming overall phone voice acceptance. No owner recording, transcript, private identifier or signing receipt is published with this plan.

## PR #396 release record

PR #396, based on reviewed head `b2bd58e1cd125898798e77012117618538bcadf9`, merged on 2026-11-16 at 03:24:20 UTC (11:24 Bali) as `9de8389e338b8a3ca136775be0a2ba161d290a13`. Its Pages deployment succeeded at 03:25:54 UTC (11:25 Bali), deployment `07c30b99-7baa-43de-8453-fcacb6db613e`; release status is `live_verified`. The canonical URL is [https://mandalacodes.com/learn/](https://mandalacodes.com/learn/).

Required CI passed. Local verification passed build/typecheck, 1,656 unit tests, article-index test, 8 allowance checks, 6 PWA checks, desktop and 375px visual checks in both palettes, and disposable local draft save/reopen, cover upload, caption/credit preview, and local preview. Search, reset, no-result, category/article navigation, and horizontal overflow were visually checked. Draft route/index/RSS/llms/sitemap exclusions and metadata checks passed. Production release proof matched the merge revision, marker, assets and article index. The HTML body comparison excluded only the observed Cloudflare analytics injection; the original HTML bytes were preserved and source bytes matched. Before merge, test-only fixes addressed the library heading and voice missing-audio refresh timing; the affected voice checks passed 10 repetitions.

The historical base, review classification and inventory remain an audit snapshot. The free hosted editor pilot was integrated through PR #407 and is live; its disposable synthetic content remains isolated from main. Physical-phone acceptance remains open. The owner-held phrase-list work and collector launch hold remain unchanged.

## Selective integration order and acceptance

1. **Completed: carry forward the local article library/writer as one coherent candidate.** PR #396 merged and is live; release evidence is above. The check-only patch applicability described in the audit was preliminary evidence, superseded by the completed checks and live proof.
   - The audit's then-missing behavior was the circular library presentation with accent-insensitive multiword search, clear/empty states and category navigation; local Keystatic writer, draft preview, image upload/preview paths, attribution fields, captions, reading time and canonical/JSON-LD metadata. Those changes are included in the released candidate.
   - At audit time, dependencies already on main included the card-to-article connection and `/learn/articles.json` from `56eb0f40` (#386), plus palette/legibility repairs `1a020045`. The older branch comparison is retained as historical rationale; #396 left those host files intact.
   - The older `3df54749` candidate had the same library implementation in shared content files except `Base.astro`; #396 corrected canonical URL handling there and fixed home/category JSON-LD URLs. The merged candidate changed the root package only for the writer command and introduced no dependency-version or lockfile changes. Existing main scripts and dependency/security updates were retained.
   - The build's date-only sitemap change was excluded from the source commit; regenerated CSP matched the candidate, and no manuscript or widget change was included.
2. **Completed: verify the integrated candidate.** Required CI, build/typecheck, tests, visual, local editor, metadata and draft-exclusion checks passed; canonical deployment proof is recorded above. These checks are evidence for the released revision.
   - Completed visual inspection of `/learn/`, categories and article routes on desktop and 375px, in both palettes: real images, readable text/hit targets, no horizontal overflow, working search/reset/no-result/category/article navigation. Metadata resolves to public `/learn/` URLs and JSON-LD editorial-text safety passed. The PWA check separately verified card-to-Learn routing.
   - Completed local writer check at `http://127.0.0.1:4322/keystatic`: a disposable draft saved and reopened; cover upload, caption/credit, and preview passed. The disposable fixture was removed. Drafts were confirmed excluded from production article routes, article index, RSS, sitemap and llms output; preview remains local. No real article publication was part of the check.
   - The November 6 PR description checks were superseded by verification of the reviewed release candidate and deployed bytes recorded above.
3. **Completed: hosted Learn editor, PR #407.** The isolated runtime/configuration changes were reviewed and merged; the Netlify editor and static `/learn/` production deploy are live and verified. Exact post-merge CI, deploy and browser evidence is in [PR #407 hosted editor release](#pr-407-hosted-editor-release). The synthetic branch/content were excluded. Branch-aware hosted draft preview remains unimplemented; Netlify Deploy Previews are private.
4. **Do not replay voice, memo, QR, manuscript or generated-history commits.** Their evidence and exact disposition are below. Retain the real-phone acceptance task and author-led content decisions. If a new failure is reproduced, repair current main at the failing boundary rather than importing an old branch wholesale.
5. **Hold the phrase-list WIP for a separate authoring-tool review.** Preserve `d8919b4d`. If phrase measurements are revisited, regenerate from the accepted current manuscripts using `todo/plans/writing-guideline/deck-phrases.mjs` and review the resulting sentence-check changes. Do not cherry-pick an old measured list or promote manuscript status. The generator currently uses a threshold of 16 although its comment/log say 8; establish the intended measurement rule during that review, not in this library integration.

The merge and publication steps are complete for PR #396 as documented above. Collector ledger launch remains held.

## Hosted editor pilot

The free pilot at [https://mandalacodes-editor-pilot.netlify.app/keystatic](https://mandalacodes-editor-pilot.netlify.app/keystatic) was the proof stage for the hosted editor. Its successful Netlify result superseded the earlier Render recommendation in the separate assessment. The reviewed runtime/configuration changes were subsequently integrated through PR #407; the disposable pilot branch and synthetic article were not. The public `/learn/` remains a static production shell. Netlify Deploy Previews are private; branch-aware hosted draft preview is not implemented.

- Netlify site `c23f82b6-864e-4cb6-b164-ea15a91fc89c`, deploy `6afab25db39969828bd6ac38`, from reviewed source `977d8fbd9c648e74e525652df3f270dce1367c24` on `codex/hosted-editor-pilot-20261116`.
- The free plan is hard $0: no card on file and no paid features enabled. Keystatic Cloud project `mandalacodes-editor/editor-pilot` grants repository access only to `adroart/mandalacodes`. The pilot URL is configured as Primary.
- Live checks passed: sign-in; synthetic draft create/save/reopen/edit/save/reopen; cover and body uploads (115 and 114 bytes) with byte-identical retrieval; anonymous UI access is login-only; unauthenticated image upload returns 401.
- The initial pilot synthetic content was confined to disposable `learn/editor-pilot-synthetic-20261116`, commits `3ea85d94086f62f849cbcaf64b01827e3d9c85f9` and `f0e830eb9d45e7139487714195d41e22e9568be5`, with `draft: true`. It was not included in PR #407 or merged to main.
- Netlify deployment requires a direct upload from `content-site` with `--functions .netlify/v1/functions`, `--prod --no-build --dir dist` and the site ID. The first static-only deploy omitted functions; the corrected upload served the pilot successfully and was superseded by the PR #407 release below.
- Render was rejected because the free service required a payment card; Cloudflare's Workers runtime was incompatible with the needed editor server APIs. Netlify is the verified free pilot host.

### PR #407 hosted editor release

PR #407 completed the runtime integration. It merged through the normal protected-main flow on 2026-11-16 at 17:19:27 Bali time (UTC+8). Post-merge run [#43838703014](https://github.com/adroart/mandalacodes/actions/runs/43838703014) success was confirmed by the observer at 17:39:47 Bali time (UTC+8) against the exact merged source `b8b9f0b0563267d511fd0f899911ef4eb770bbaf`; all required `gate`, `test`, and `test-mobile` jobs passed.

- Cloudflare Pages `/learn/` is `LIVE_VERIFIED`: deployment `fd6b8d71-90ef-4a1c-a54f-bf25dc1de1f2` at [mandalacodes.com/learn](https://mandalacodes.com/learn/), with exact commit metadata and immutable/canonical byte proof.
- Netlify hosted editor is `LIVE_VERIFIED`: deployment `6afacaeba9752401629c405b` at [mandalacodes-editor-pilot.netlify.app/keystatic](https://mandalacodes-editor-pilot.netlify.app/keystatic), with the expected SSR function and matching local/immutable/production JavaScript hashes. The free plan remains $0 with no card and no paid feature change.
- Fresh browser smoke passed sign-in, disposable-branch draft save/reopen/edit, commit `af615294d59f4541ce08fea13178b63aa38af4ab`, both image previews, anonymous login gate, and unauthenticated image upload returning 401. The smoke branch remains separate, and no synthetic files appear in main.
- Netlify Deploy Previews remain private. Branch-aware hosted draft preview is still not implemented. Select and verify the intended writing branch in the editor; publication proceeds through a reviewed PR and the normal main/Pages flow.
- Source and review history are recorded in [PR #407](https://github.com/adroart/mandalacodes/pull/407).

### Next useful work

The hosted editor integration and deployment are complete; do not repeat the PR #407 integration/deploy steps. When the owner is ready, select and verify the intended writing branch in the hosted editor, then review the resulting article PR before publication. The separate owner/device card-2 phone acceptance remains open in TODO; no collector ledger writes or author-held phrase-list changes are implied by this release.

## Evidence for all 11 unmatched tips

| Ref and exact tip | Classification | Evidence and next action |
| --- | --- | --- |
| `codex/article-library-ship` · `8ed7966c49cc75800a6ce6f28cd9f146491d286e` | **Incorporated (PR #396 shipped)** | The reviewed PR candidate merged as `9de8389e338b8a3ca136775be0a2ba161d290a13` and is live at `/learn/`; release and verification evidence above. |
| `codex/article-library-reconcile` · `3df547491db32ce688049f01fd3347d45c21935c` | **Superseded** | Shared content implementation is retained by #396, which adds canonical/JSON-LD corrections and generated CSP. Card link host integration is already on main through #386; older CSS would lose later legibility changes. No additional unique useful hunk identified. |
| `claude/quick-transcription` · `e588f3ec54daa6b79db18d74825da799d45f38e6` | **Incorporated** | All 18 paths touched by its unmatched commits are byte-identical at main's squash `e3a052ef` (#383). Includes shared transcription, memo/photo intake, pickup, handoff and tests. Subsequent main changes incorporate the next two memo branches. No replay. |
| `claude/memo-transcriber-light` · `d81c0e6f6f90381173a3cddb9630ba1b1943c3b9` | **Incorporated** | All seven touched paths byte-identical at `51fd8fea` (#384), including `memoTranscript.ts` and wrapped `{schema, plan, sources}` handoff. The two latter files remain identical on current main; the other five evolved with #385. No replay. |
| `claude/memo-10x` · `120bc5aa9027c9668f7c1684123cc134ca6fd8dd` | **Incorporated** | All 14 touched paths byte-identical at `d313a4ed` (#385). Eleven remain identical now, including upload-key share-sheet intake, phone posting kit, file/photos endpoints and memo transcriber. Current main adds chunked/native base64 encoding and delayed fallback buffers in `quickTranscription.ts`, bounded-window transcript alignment/work limits and shared-word equivalence in `transcriptDoubts.ts`, plus its test. Keep those later safeguards. |
| `codex/oracle-draw-chooser` · `ce15ece28f304ed91b51a1c113e8faa731a56280` | **Incorporated; generated history superseded** | All nine unmatched commits accounted for in the breakdown below. Voice, native sign-in, reminder layout and artwork loader have main equivalents. No missing useful runtime hunk identified; this checkout also has separately preserved loose work. |
| `claude/fresh-chat-handoff-a8e5cd` · `35ccf78920d6c49d571d402c5cff19c94c6687ab` | **Incorporated** | All touched paths, including 64 manuscripts, generated corpus/search, TODO and lockfile, are byte-identical at squash `4d540150` (#161). That includes `0f2769b6`, `b2a5be20`, `35ccf789`: source-attribution removal, differentiated Design drives and follow-up TODO. Later manuscript differences are not permission to restore old prose. |
| `fix/body-opening-stem-18-44-56` · `108d36f38b5c69a70f11864dfa3dc7febc8c7e2b` | **Incorporated** | All five touched paths byte-identical at `0ce0f21f` (#178): `354e02d0` edits Physiology openings on 18/44/56 and the Design drive on 44; `108d36f3` regenerates corpus/search. Current manuscripts were subsequently rewritten. Do not cherry-pick either old prose or generated JSON. |
| `claude/recursing-bardeen-d8ee00` · `d3c9bb2e28bf2d9d5a89b1b24fe1485a48139972` | **Incorporated** | Main `c911773e` (#209) includes the same archive entry and removal of the reference-writing TODO. The sole difference at that squash is an unrelated new CI TODO. Current `todo/archive.md` retains the 21 amino-acid/32 organ entry record and the unchecked Deadman/Maciocia caveat; the reference-check TODO remains. No new vault verification claimed. |
| `claude/card-56-model` · `d8919b4de8991431770b6584dfbd389e63c759ba` | **Owner-held** | Its only unmatched commit changes generated `todo/plans/writing-guideline/deck-phrases.json`, not card 56 prose: date Sep 18 → Sep 24, reordered phrases, removes “whoever is nearest”, adds “where it goes”. This feeds the sentence checker and is not merely harmless timestamp churn. Preserve the WIP; remeasure/review on current manuscripts before accepting any rule change. |
| `origin/laptop-sync-2026-10-02` · `bf956e15ca4e0696043127eb142b953ea1c66191` | **Superseded** | Only generated `INDEX.md` and `docs/CAPABILITIES.md` snapshots from Sep 30. No runtime or manuscript code. Regenerate from current source when needed, never restore the old snapshots. |

### Oracle draw aggregate: all nine unmatched commits

- `e899e7b5` recording/transcription/reconciliation is represented by `182a802f` on main. Of 38 non-generated touched paths, 36 are byte-identical there; the two differences are the test's switch to shared fixtures and the native `OracleDrawDialog` alias. Neither is a missing branch feature. Current main subsequently splits the studio and adds recording-race, persistence, authorization, transcript-preservation, prompt-limit and server-memory repairs (`a5508ee0`, `c804361b`, `c9a2830d`, `0ddda028`, `4819b428`, `508f5a67` and later follow-ups).
- `d82b1ae7`, `c1cc3084`, `10b307f5`, `bc796fad` native sign-in/account/reminder work is represented by `3e2388f1` and `504c25af` (#358/#360). At `504c25af`, the native sign-in commit's 13 non-generated implementation paths are identical; the other three paths are tests/config containing the subsequent branch tests and stricter server isolation. The real-session exchange test, `Info.plist` app name, reminder CSS and overlap tests are identical at that integration. Current main retains additional account/session tests. Do not restore old Xcode build/signing metadata or treat mocked bridge tests as phone proof.
- `f2d7fc45` animated artwork loader is represented by `8099df58`, followed by `7b969d7b`/`9bd980bd` (#364). Main preserves responsive `srcSet`/`sizes`, updates tests to intercept all image widths and later fixes decode hangs in `a3777822` (#372). The old branch would lose these changes.
- `24d2dd4d`, `e392cbd0`, `ce15ece2` regenerate indexes/capabilities; those dated snapshots supply no missing runtime behavior. Preserve generated widget/signing follow-ups on main, especially #398/#403/#404.

### Open QR duplicates: confirmed, no external action

- [#389](https://github.com/adroart/mandalacodes/pull/389), `c32be52ab67d0942f540be986b9d160239678105`, and main `dff3491c` (#392) share stable patch ID `3a11b249917a158aeac6a45cdf6cfc70ca675855`.
- [#393](https://github.com/adroart/mandalacodes/pull/393), `571b4efd636a97c50b16bf7d91c8ed3e5e1cf96e`, and main `9a2f78dc` (#394) share stable patch ID `427a8cf122f2fb838901e67593ae7fd02965457b`.
- Both are open drafts and are **incorporated duplicates**, not pending fixes. No merge is needed. PR closure would be a separate authorized external action; neither was closed here.

## Preserved work and proof limits

- Registered main checkout (`codex/oracle-draw-chooser`, displayed under the older `4 Coding` path) retains modified `INDEX.md`, `docs/CAPABILITIES.md`, `public/sitemap.xml`, plus `.shot-c.mjs`, `.task-c.mjs`, `.tour-c.mjs` and `docs/oracle-voice-five-design.md`.
- Parent `f856` audit checkout had unrelated pre-existing edits. The original audit documented its state at that time; this follow-up updates `TODO.md` and this plan while preserving those unrelated edits.
- `priceless-meninsky-dd7af0` retains untracked `--004.pgm`/`--005.pgm`. `trusting-burnell-80a0fe` retains nine tracked deletions, including app/config files and `.env.production`; no deleted file contents were read or restored. Missing/prunable worktree registrations were not pruned. Other existing registered worktrees were clean at the status read.
- Stash `frosty-ship-widget-20261103` was inspected without application. It changes only widget generation/window timestamps and first/last transitions; cards are unchanged. Its `validUntil` is `1856822400`, older than current main's `1857686400`. Main's #403/#404 generator guards already handle needless rewrites and retain a bundle with more than a year of coverage. No missing widget source fix is contained in this stash. Preserve it; do not apply/pop/drop it.
- Release verification: see the PR #396 release record above. Physical iPhone acceptance remains outstanding. This documentation update did not rerun the recorded suites.
- Real phone acceptance remains outstanding. A subsequent phone update must follow `mobile/README.md` fresh signing and verify app plus extension profiles have at least six days, 23 hours remaining before installation. No signing, installation, editorial approval, collector ledger write or deployment occurred here.

## Complete ancestry-unmerged inventory

Counts below exclude merge commits and patch-equivalent changes already reachable from main. Local and remote refs sharing a tip are grouped.

| Refs | Tip | Unmatched patches | Disposition |
| --- | --- | ---: | --- |
| `claude/artwork-cache-fix`, `origin/claude/artwork-cache-fix` | `96c17dbe2d7d` | 0 | Patch-equivalent history; no automatic merge needed |
| `claude/card-56-model`, `origin/claude/card-56-model` | `d8919b4de899` | 1 | Owner-held generated phrase-list WIP |
| `claude/card-art-sizes` | `57b2d8a9e55b` | 0 | Patch-equivalent history; no automatic merge needed |
| `claude/card-avif` | `313e887e96b3` | 0 | Patch-equivalent history; no automatic merge needed |
| `claude/card-image-issue-f162bd` | `6daadd62d911` | 0 | Patch-equivalent history; no automatic merge needed |
| `claude/card-thumb-size` | `5d1ce511871b` | 0 | Patch-equivalent history; no automatic merge needed |
| `claude/deck-lazy-art` | `c9adcd68ec6d` | 0 | Patch-equivalent history; no automatic merge needed |
| `claude/fresh-chat-handoff-a8e5cd`, `origin/claude/fresh-chat-handoff-a8e5cd` | `35ccf78920d6` | 3 | Incorporated via squash; preserve later manuscripts |
| `claude/memo-10x`, `origin/claude/memo-10x` | `120bc5aa9027` | 3 | Incorporated; retain newer main safeguards |
| `claude/memo-transcriber-light`, `origin/claude/memo-transcriber-light` | `d81c0e6f6f90` | 3 | Incorporated; retain newer main safeguards |
| `claude/modest-gauss-dbdc00`, `claude/oracle-writing-guidelines-cc52ee`, `origin/claude/modest-gauss-dbdc00`, `origin/claude/oracle-writing-guidelines-cc52ee` | `c92a35a726ce` | 0 | Patch-equivalent history; no automatic merge needed |
| `claude/oracle-fable-pass`, `origin/claude/oracle-fable-pass` | `9798eaa91eaa` | 0 | Patch-equivalent history; no automatic merge needed |
| `claude/qr-safari-button-styling-a24911` | `2ce3327e2e8e` | 0 | Patch-equivalent history; no automatic merge needed |
| `claude/quick-transcription`, `origin/claude/quick-transcription` | `e588f3ec54da` | 3 | Incorporated; retain newer main safeguards |
| `claude/recursing-bardeen-d8ee00`, `origin/claude/recursing-bardeen-d8ee00` | `d3c9bb2e28bf` | 1 | Incorporated documentation; no replay |
| `claude/repressive-reactive-design-b5bd35`, `origin/claude/repressive-reactive-design-b5bd35` | `29a3d7824b91` | 0 | Patch-equivalent history; no automatic merge needed |
| `claude/revert-artwork-cache-fix`, `origin/claude/revert-artwork-cache-fix` | `3f2cbda46d93` | 0 | Patch-equivalent history; no automatic merge needed |
| `claude/shared-media-stub` | `b172c16ec01e` | 0 | Patch-equivalent history; no automatic merge needed |
| `claude/shared-voice-basics`, `origin/claude/shared-voice-basics` | `d8e94c9ffc4b` | 0 | Patch-equivalent history; no automatic merge needed |
| `claude/todo-point-references`, `origin/claude/todo-point-references` | `5a42be7fb19c` | 0 | Patch-equivalent history; no automatic merge needed |
| `claude/voice-drafts-record-bar` | `6f4f9a5229a8` | 0 | Patch-equivalent history; no automatic merge needed |
| `codex/article-library-reconcile`, `origin/codex/article-library-reconcile` | `3df547491db3` | 1 | Superseded by #396; no separate integration |
| `codex/article-library-ship`, `origin/codex/article-library-ship` | `8ed7966c49cc` | 1 | Incorporated by merged and deployed PR #396 |
| `codex/oracle-draw-chooser` | `ce15ece28f30` | 9 | Incorporated; retain newer main safeguards |
| `docs/instruction-audit` | `77bed7db27a5` | 0 | Patch-equivalent history; no automatic merge needed |
| `docs/pickup-key-redeploy` | `2ea9538f018d` | 0 | Patch-equivalent history; no automatic merge needed |
| `fix/body-opening-stem-01-05-06-21`, `origin/fix/body-opening-stem-01-05-06-21` | `7891b3f4eb69` | 0 | Patch-equivalent history; no automatic merge needed |
| `fix/body-opening-stem-18-44-56`, `origin/fix/body-opening-stem-18-44-56` | `108d36f38b5c` | 2 | Incorporated via squash; preserve later manuscripts |
| `fix/card-57-shadow-names`, `origin/fix/card-57-shadow-names` | `b5b1dee83a8e` | 0 | Patch-equivalent history; no automatic merge needed |
| `fix/design-opening-sweep`, `origin/fix/design-opening-sweep` | `6e03eb1aca07` | 0 | Patch-equivalent history; no automatic merge needed |
| `fix/media-cpu-offload`, `origin/fix/media-cpu-offload` | `ab3231a8728b` | 0 | Patch-equivalent history; no automatic merge needed |
| `fix/strict-numeric-qr`, `origin/fix/strict-numeric-qr` | `c32be52ab67d` | 0 | Patch-equivalent history; no automatic merge needed |
| `origin/fix/strict-numeric-reader` | `571b4efd636a` | 0 | Patch-equivalent history; no automatic merge needed |
| `origin/laptop-sync-2026-10-02` | `bf956e15ca4e` | 1 | Superseded generated indexes |

## Audit scope and handoff

The reconciliation and selected #396 integration, verification, merge and deployment are complete. No further missing branch candidate remains among the reviewed 11; the historical 57-ref/34-tip inventory has not been refreshed. PR #407 completed the hosted-editor runtime integration and is live; see its release record above. Next owner-led work can begin with a real article on a writing branch when ready. Owner/device card-2 phone acceptance remains outstanding. Owner-held phrase-list work and collector launch hold remain outstanding. No change to the collector launch hold follows from this classification.

This audit covers fetched repository refs, registered worktrees and the local stash. Unfetched forks, other machines and unreachable/dangling commits are outside the checked scope. Zero unmatched non-merge patches is not authorization to delete a branch: merge-only changes and ownership must be checked separately before any cleanup.

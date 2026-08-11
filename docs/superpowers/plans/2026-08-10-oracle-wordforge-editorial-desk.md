# Oracle WordForge Editorial Desk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one resumable WordForge desk for preparing and reviewing one Oracle lens or card while preserving Obsidian as research truth, WordForge as the production/review desk, Mandala Markdown as publication truth, and every existing publication protection.

**Architecture:** Add a deep `oracle-editorial` module behind a two-method interface, with an append-only artifact ledger, durable Markdown sidecars, server-derived standard/deep/fast routing, bounded model and humanizer adapters, independent critique, and deterministic whole-card/deck sameness checks. Keep all current Oracle routes and publication inputs working; the new desk adapts to the existing assimilation, exact-review-binding, finality, sync, and isolated local-proposal seams instead of replacing them.

**Tech Stack:** TypeScript, Hono, SQLite through `better-sqlite3`, Vitest, React, Playwright, existing WordForge LLM routing, existing Study discovery, existing embeddings, `gray-matter`, `js-yaml`, Git worktrees.

---

## Scope and invariants

Implementation repository: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os`

Approved design: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/mandalacodes/docs/superpowers/specs/2026-08-10-oracle-editorial-lifecycle-design.md`

The implementation must preserve these invariants:

- Existing WordForge Oracle assimilation, production, series, review, sync, prepare-publication, push, and pull-request interfaces continue to work unchanged.
- Obsidian source paths and digest-bound source bodies remain research inputs. Web discovery creates research intake only; it cannot make a source ready or flow directly into candidate prose.
- WordForge stores workflow state and a cache/index, while physical Markdown sidecars preserve durable editorial judgments.
- Mandala files are written only inside the existing isolated proposal worktree after a separate proposal authorization.
- No action pushes, opens a pull request, merges, deploys, or mutates Mandala's shared checkout.
- A proposal still requires an exact current passing review binding, exact finality approval, the selected manuscript change, the 64-card validation, corpus tests/build, and the existing changed-file allowlist.
- The writer and critic must resolve to different provider/model families at runtime, including fallbacks. Failure to prove independence is `unverified`, never `pass`.
- A humanizer returns patches against a bound candidate hash. It cannot add facts, alter protected spans, promote status, write canonical files, or rerun automatically after a human edit.
- No automated rewrite loop exists. Automated checks report findings; one revision suggestion runs only when the editor explicitly requests it.
- All state-changing actions are tenant-scoped, audited, revision-bound, and idempotent.

## File structure

Create these focused module files:

- `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-editorial/types.ts` — public domain types and exact status enums.
- `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-editorial/status.ts` — lane derivation, dependency fingerprints, invalidation, and next-action selection.
- `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-editorial/store.ts` — tenant-scoped work item, artifact, and action-reservation persistence.
- `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-editorial/evidence.ts` — adapter over the current source manifest/reader and evidence bundle validation.
- `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-editorial/models.ts` — role routing, actual model identity capture, and independence enforcement.
- `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-editorial/center.ts` — center synthesis and the adapter to immutable assimilation revisions.
- `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-editorial/humanizer.ts` — plugin contract, patch validation, application, and bypass receipt.
- `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-editorial/checks.ts` — deterministic/factual/provenance checks and independent critic orchestration.
- `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-editorial/sameness.ts` — whole-card/deck checks and cache keys.
- `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-editorial/sidecar.ts` — strict Markdown codec and crash-safe pending sidecar store.
- `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-editorial/desk.ts` — orchestration hidden behind `open` and `act`.
- `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-editorial/index.ts` — the only module exports.
- `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/routes/wordforge-oracle-editorial.ts` — additive HTTP adapter.
- `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/web/components/wordforge/OracleEditorialDeskPanel.tsx` — common-caller UI.

Modify only at their seams:

- `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/index.ts`
- `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/index.ts`
- `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/llm/backends.ts`
- `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/llm/default-config.ts`
- `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/llm/operation-map.ts`
- `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/review.ts`
- `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-publish-service.ts`
- `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-publish.ts`
- `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/web/lib/wordforge-client.ts`
- `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/web/components/wordforge/TemplateStudio.tsx`

## Public contract

The public module interface is deliberately shallower than its implementation:

```ts
export type OracleEditorialLens =
  | 'CODE'
  | 'ICHING'
  | 'KEYS'
  | 'DESIGN'
  | 'BODY'
  | 'RELATIONS'
  | 'ALL';

export interface OracleEditorialTarget {
  card_number: number;
  lens: OracleEditorialLens;
}

export interface OracleDeskAction {
  token: string;
  kind:
    | 'prepare'
    | 'launch_discovery'
    | 'approve_center'
    | 'generate_candidate'
    | 'apply_humanizer'
    | 'bypass_humanizer'
    | 'save_human_edit'
    | 'check_candidate'
    | 'request_revision_suggestion'
    | 'approve_final'
    | 'prepare_proposal';
  label: string;
  requires_reason: boolean;
}

export interface OracleEditorialDesk {
  open(input: {
    tenantId: string;
    actor: string;
    target: OracleEditorialTarget;
  }): Promise<OracleDeskView>;

  act(input: {
    tenantId: string;
    actor: string;
    workId: string;
    expectedVersion: number;
    actionToken: string;
    payload?: {
      text?: string;
      reason?: string;
      selectedPatchIds?: string[];
    };
  }): Promise<OracleDeskView>;
}
```

`OracleDeskView` contains work ID/version, target, server-derived lane, every orthogonal status, phase, one primary action, secondary actions, evidence summary, center, candidate, exact findings, and proposal receipt. It never exposes filesystem paths, SQL transitions, model-routing controls, worktree arguments, or arbitrary status setters.

### Task 1: Reserve the migration number and add the editorial ledger

**Files:**

- Create after the reservation check: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/migrations/202_wordforge_oracle_editorial_desk.sql`
- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-editorial/types.ts`
- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-editorial/status.ts`
- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-editorial/store.ts`
- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/__vitest__/migration-202-wordforge-oracle-editorial-desk.test.ts`
- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/__vitest__/wordforge-oracle-editorial-store.test.ts`
- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/__vitest__/wordforge-oracle-editorial-status.test.ts`

- [ ] **Step 1: Determine and reserve the next migration number before creating SQL**

Run from the i64os root:

```bash
cd '/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os'
WF_LAST_MIGRATION=$(find apps/core/migrations -maxdepth 1 -type f -name '[0-9][0-9][0-9]_*.sql' -print | sed 's#.*/##' | sort | tail -1)
WF_LAST_NUMBER=${WF_LAST_MIGRATION%%_*}
WF_NEXT_NUMBER=$(printf '%03d' "$((10#$WF_LAST_NUMBER + 1))")
test ! -e "apps/core/migrations/${WF_NEXT_NUMBER}_wordforge_oracle_editorial_desk.sql"
printf 'head=%s next=%s\n' "$WF_LAST_MIGRATION" "$WF_NEXT_NUMBER"
```

Expected in the observed repository state: `head=201_dispatch_idempotency_reservations.sql next=202`. If the head is no longer 201, use the printed next number, rename the migration test to the same number, and update the exact path references in this task before creating either file. The `test ! -e` command must exit zero; a nonzero result means stop and choose the newly computed free number.

- [ ] **Step 2: Write the failing migration and store tests**

The migration test must assert all three tables exist, status checks reject invalid values, artifacts cannot be updated/deleted, and `(tenant_id, series_item_id, lens)` is unique. The store test must prove tenant isolation and optimistic version failure. Use these assertions:

```ts
expect(tableNames).toEqual(expect.arrayContaining([
  'wf_oracle_editorial_work_items',
  'wf_oracle_editorial_artifacts',
  'wf_oracle_editorial_actions',
]));
expect(() => db.prepare("UPDATE wf_oracle_editorial_artifacts SET body_text = 'changed' WHERE id = ?").run(artifactId))
  .toThrow(/append-only/i);
expect(() => store.getWorkItem({ tenantId: 'tenant-b', workId }))
  .toThrow(/not found/i);
expect(() => store.advance({ tenantId: 'tenant-a', workId, expectedVersion: 1, patch: validPatch }))
  .toThrow(/stale editorial work item/i);
```

- [ ] **Step 3: Run the tests and confirm the contract is absent**

Run:

```bash
npx vitest run apps/core/__vitest__/migration-202-wordforge-oracle-editorial-desk.test.ts apps/core/__vitest__/wordforge-oracle-editorial-store.test.ts apps/core/__vitest__/wordforge-oracle-editorial-status.test.ts
```

Expected: FAIL because the migration and editorial module do not exist.

- [ ] **Step 4: Add exact status and ledger types**

Implement these unions in `types.ts` and use them in both storage and desk views:

```ts
export type SourcesStatus = 'unknown' | 'discovering' | 'incomplete' | 'ready' | 'conflicted' | 'stale' | 'unavailable' | 'invalid';
export type JudgmentStatus = 'absent' | 'synthesizing' | 'awaiting-human' | 'approved' | 'stale';
export type DraftStatus = 'absent' | 'writing' | 'generated' | 'humanized' | 'human-edited';
export type HumanizerStatus = 'unrun' | 'running' | 'passed' | 'failed' | 'unavailable' | 'bypassed' | 'stale';
export type CritiqueStatus = 'unrun' | 'running' | 'pass' | 'fail' | 'unverified' | 'stale';
export type SamenessStatus = 'unrun' | 'pass' | 'warn' | 'block' | 'stale';
export type EditorialStatus = 'scaffold' | 'in-progress' | 'final';
export type SyncStatus = 'clean' | 'wordforge-newer' | 'file-newer' | 'conflict' | 'invalid';
export type ProposalStatus = 'unavailable' | 'ready' | 'preparing' | 'prepared' | 'stale';
export type EditorialLane = 'standard' | 'deep' | 'fast';

export interface DependencyFingerprints {
  source_bundle_sha256: string;
  evidence_sha256: string;
  constitution_sha256: string;
  center_sha256: string;
  writer_input_sha256: string;
  current_candidate_sha256: string;
  deck_corpus_sha256: string;
}
```

- [ ] **Step 5: Create the append-only SQL ledger**

Use `TEXT` UUIDs and the repository's current migration timestamp convention. The SQL must include these constraints and triggers:

```sql
CREATE TABLE wf_oracle_editorial_work_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  series_item_id TEXT NOT NULL REFERENCES wf_series_items(id),
  lens TEXT NOT NULL CHECK (lens IN ('CODE','ICHING','KEYS','DESIGN','BODY','RELATIONS','ALL')),
  edition_kind TEXT NOT NULL CHECK (edition_kind IN ('foundational','maintenance')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  lane TEXT NOT NULL CHECK (lane IN ('standard','deep','fast')),
  sources_status TEXT NOT NULL DEFAULT 'unknown' CHECK (sources_status IN ('unknown','discovering','incomplete','ready','conflicted','stale','unavailable','invalid')),
  judgment_status TEXT NOT NULL DEFAULT 'absent' CHECK (judgment_status IN ('absent','synthesizing','awaiting-human','approved','stale')),
  draft_status TEXT NOT NULL DEFAULT 'absent' CHECK (draft_status IN ('absent','writing','generated','humanized','human-edited')),
  humanizer_status TEXT NOT NULL DEFAULT 'unrun' CHECK (humanizer_status IN ('unrun','running','passed','failed','unavailable','bypassed','stale')),
  critique_status TEXT NOT NULL DEFAULT 'unrun' CHECK (critique_status IN ('unrun','running','pass','fail','unverified','stale')),
  card_sameness_status TEXT NOT NULL DEFAULT 'unrun' CHECK (card_sameness_status IN ('unrun','pass','warn','block','stale')),
  deck_sameness_status TEXT NOT NULL DEFAULT 'unrun' CHECK (deck_sameness_status IN ('unrun','pass','warn','block','stale')),
  editorial_status TEXT NOT NULL DEFAULT 'scaffold' CHECK (editorial_status IN ('scaffold','in-progress','final')),
  sync_status TEXT NOT NULL DEFAULT 'clean' CHECK (sync_status IN ('clean','wordforge-newer','file-newer','conflict','invalid')),
  proposal_status TEXT NOT NULL DEFAULT 'unavailable' CHECK (proposal_status IN ('unavailable','ready','preparing','prepared','stale')),
  source_bundle_sha256 TEXT NOT NULL DEFAULT '',
  evidence_sha256 TEXT NOT NULL DEFAULT '',
  constitution_sha256 TEXT NOT NULL DEFAULT '',
  center_sha256 TEXT NOT NULL DEFAULT '',
  writer_input_sha256 TEXT NOT NULL DEFAULT '',
  current_candidate_sha256 TEXT NOT NULL DEFAULT '',
  deck_corpus_sha256 TEXT NOT NULL DEFAULT '',
  current_candidate TEXT NOT NULL DEFAULT '',
  current_candidate_origin TEXT NOT NULL DEFAULT 'absent' CHECK (current_candidate_origin IN ('absent','writer','humanizer','human')),
  humanizer_base_sha256 TEXT NOT NULL DEFAULT '',
  sidecar_state TEXT NOT NULL DEFAULT 'absent' CHECK (sidecar_state IN ('absent','pending','current','error')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, series_item_id, lens)
);

CREATE TABLE wf_oracle_editorial_artifacts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  work_item_id TEXT NOT NULL REFERENCES wf_oracle_editorial_work_items(id),
  kind TEXT NOT NULL CHECK (kind IN ('evidence_bundle','center_proposal','center_approval','writer_candidate','humanizer_result','humanizer_bypass','human_edit','verification','critique','card_sameness','deck_sameness','finality_approval','proposal_receipt','discovery_link')),
  ordinal INTEGER NOT NULL CHECK (ordinal >= 1),
  parent_artifact_id TEXT REFERENCES wf_oracle_editorial_artifacts(id),
  input_sha256 TEXT NOT NULL,
  output_sha256 TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  body_text TEXT NOT NULL DEFAULT '',
  producer_kind TEXT NOT NULL CHECK (producer_kind IN ('deterministic','model','plugin','human')),
  producer_id TEXT NOT NULL,
  producer_version TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (tenant_id, work_item_id, kind, output_sha256)
);

CREATE TRIGGER wf_oracle_editorial_artifacts_no_update
BEFORE UPDATE ON wf_oracle_editorial_artifacts
BEGIN SELECT RAISE(ABORT, 'editorial artifacts are append-only'); END;

CREATE TRIGGER wf_oracle_editorial_artifacts_no_delete
BEFORE DELETE ON wf_oracle_editorial_artifacts
BEGIN SELECT RAISE(ABORT, 'editorial artifacts are append-only'); END;

CREATE TABLE wf_oracle_editorial_actions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  work_item_id TEXT NOT NULL REFERENCES wf_oracle_editorial_work_items(id),
  action_token TEXT NOT NULL,
  expected_version INTEGER NOT NULL,
  action_kind TEXT NOT NULL,
  request_sha256 TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('running','completed','failed','outcome_unknown')),
  reservation_id TEXT NOT NULL,
  reservation_expires_at TEXT NOT NULL,
  effect_started_at TEXT,
  response_version INTEGER,
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, work_item_id, action_token)
);

CREATE INDEX wf_oracle_editorial_work_items_target_idx ON wf_oracle_editorial_work_items(tenant_id, series_item_id, lens);
CREATE INDEX wf_oracle_editorial_artifacts_work_idx ON wf_oracle_editorial_artifacts(tenant_id, work_item_id, ordinal);
CREATE INDEX wf_oracle_editorial_actions_state_idx ON wf_oracle_editorial_actions(tenant_id, work_item_id, state);
```

- [ ] **Step 6: Implement lane derivation and invalidation as pure functions**

```ts
export function deriveLane(input: LaneInput): EditorialLane {
  if (
    input.sources_status !== 'ready' ||
    input.has_rights_gap ||
    input.has_provenance_gap ||
    input.has_unresolved_conflict ||
    input.has_blocking_similarity
  ) return 'deep';

  if (
    input.edition_kind === 'maintenance' &&
    input.named_human_center_approval &&
    input.source_bundle_unchanged &&
    input.evidence_unchanged &&
    input.constitution_unchanged &&
    input.center_unchanged
  ) return 'fast';

  return 'standard';
}

export const INVALIDATION: Record<DependencyKind, readonly StatusDimension[]> = {
  sources: ['sources','judgment','draft','humanizer','critique','card_sameness','deck_sameness','editorial','proposal'],
  evidence: ['judgment','draft','humanizer','critique','card_sameness','deck_sameness','editorial','proposal'],
  constitution: ['judgment','draft','humanizer','critique','card_sameness','deck_sameness','editorial','proposal'],
  center: ['draft','humanizer','critique','card_sameness','deck_sameness','editorial','proposal'],
  humanizer: ['humanizer','critique','card_sameness','deck_sameness','editorial','proposal'],
  human_edit: ['critique','card_sameness','deck_sameness','editorial','proposal'],
  deck_corpus: ['deck_sameness','proposal'],
};
```

- [ ] **Step 7: Implement the store with tenant and version predicates**

Every work-item update must use:

```sql
UPDATE wf_oracle_editorial_work_items
SET version = version + 1, updated_at = :updated_at
WHERE id = :id AND tenant_id = :tenant_id AND version = :expected_version
```

Require `changes === 1`; otherwise throw `StaleEditorialWorkItemError`. Use the reservation/effect fence from migration 201 so a double click returns the stored completed result and a crashed effect becomes `outcome_unknown`.

- [ ] **Step 8: Run focused tests**

Run:

```bash
npx vitest run apps/core/__vitest__/migration-202-wordforge-oracle-editorial-desk.test.ts apps/core/__vitest__/wordforge-oracle-editorial-store.test.ts apps/core/__vitest__/wordforge-oracle-editorial-status.test.ts
```

Expected: PASS; invalid enum inserts fail, artifact mutation fails, cross-tenant reads fail, stale versions fail, foundational work never enters fast, and maintenance fast requires unchanged hashes plus named-human approval.

- [ ] **Step 9: Commit the ledger**

```bash
git add apps/core/migrations/202_wordforge_oracle_editorial_desk.sql apps/core/lib/wordforge/oracle-editorial/types.ts apps/core/lib/wordforge/oracle-editorial/status.ts apps/core/lib/wordforge/oracle-editorial/store.ts apps/core/__vitest__/migration-202-wordforge-oracle-editorial-desk.test.ts apps/core/__vitest__/wordforge-oracle-editorial-store.test.ts apps/core/__vitest__/wordforge-oracle-editorial-status.test.ts
git commit -m "feat(wordforge): add Oracle editorial work-item ledger"
```

### Task 2: Persist strict Markdown editorial sidecars

**Files:**

- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-editorial/sidecar.ts`
- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/__vitest__/wordforge-oracle-editorial-sidecar.test.ts`

- [ ] **Step 1: Write failing codec and recovery tests**

Test stable byte-for-byte round trips, rejected unknown/duplicate keys, card/lens/path mismatch, malformed SHA-256 values, missing body sections, manuscript prose in a receipt, temporary-write recovery, and proposal blocking while `sidecar_state !== 'current'`.

```ts
expect(serializeEditorialSidecar(parseEditorialSidecar(serialized, expectedIdentity))).toBe(serialized);
expect(() => parseEditorialSidecar(unknownKeyDocument, expectedIdentity)).toThrow(/unknown frontmatter key/i);
expect(() => parseEditorialSidecar(wrongLensDocument, expectedIdentity)).toThrow(/lens does not match path/i);
expect(await pendingStore.reconcile(expectedReceipt)).toEqual({ state: 'current', sha256: expectedSha });
```

- [ ] **Step 2: Run the sidecar test and confirm it fails**

Run: `npx vitest run apps/core/__vitest__/wordforge-oracle-editorial-sidecar.test.ts`

Expected: FAIL because the sidecar codec does not exist.

- [ ] **Step 3: Implement the exact sidecar schema**

```ts
export interface OracleEditorialSidecar {
  schema: 'oracle-editorial/v1';
  kind: 'lens' | 'card';
  card: number;
  lens: OracleEditorialLens;
  work_id: string;
  revision: number;
  lane: EditorialLane;
  status: 'in-progress' | 'final';
  manuscript_sha256: string;
  source_bundle_sha256: string;
  evidence_sha256: string;
  constitution_sha256: string;
  center_sha256: string;
  candidate_sha256: string;
  deck_corpus_sha256: string;
  models: Record<'evidence' | 'center' | 'writer' | 'critic' | 'sameness', ModelRunReceipt | null>;
  humanizer: HumanizerReceipt | null;
  approved_by: string | null;
  approved_at: string | null;
  finality: FinalityReceipt | null;
  proposal: ProposalReceipt | null;
  sections: {
    human_center: string;
    evidence_map: readonly EvidenceReceiptRow[];
    tensions_and_gaps: readonly FindingReceipt[];
    critique: readonly FindingReceipt[];
    whole_card_sameness: readonly FindingReceipt[];
    deck_sameness: readonly FindingReceipt[];
    decision_history: readonly DecisionReceipt[];
  };
}
```

Serialize body headings in this exact order: `Human center`, `Evidence map`, `Tensions and gaps`, `Critique`, `Whole-card sameness`, `Deck sameness`, `Decision history`. Evidence rows contain source ID/path, immutable digest, locator, roles, and claim ID; never full source bodies or candidate prose.

This interface is the shared Mandala/WordForge `oracle-editorial/v1` contract. The Mandala sidecar codec must use these exact field names; do not introduce parallel `*_digest` aliases.

- [ ] **Step 4: Implement physical paths and crash-safe writes**

Use server-derived paths only:

```ts
export function pendingSidecarPath(storeDir: string, tenantHash: string, card: number, lens: OracleEditorialLens): string {
  const cardDirectory = String(card).padStart(2, '0');
  const fileName = lens === 'ALL' ? 'CARD.md' : `${lens}.md`;
  return path.join(storeDir, 'wordforge', 'oracle-editorial', tenantHash, cardDirectory, fileName);
}

export function mandalaSidecarPath(card: number, lens: OracleEditorialLens): string {
  const cardDirectory = String(card).padStart(2, '0');
  return path.posix.join('oracle', 'editorial', cardDirectory, lens === 'ALL' ? 'CARD.md' : `${lens}.md`);
}
```

Write deterministic bytes to a sibling temporary file, record the expected SHA and pending state in one DB transaction, atomically rename, then mark current. On `open`, reconcile a matching temp/final SHA; mark `error` on mismatch and block finality/proposal.

- [ ] **Step 5: Run focused tests**

Run: `npx vitest run apps/core/__vitest__/wordforge-oracle-editorial-sidecar.test.ts apps/core/__vitest__/wordforge-oracle-publish.test.ts`

Expected: PASS, including all existing publisher tests unchanged.

- [ ] **Step 6: Commit sidecars**

```bash
git add apps/core/lib/wordforge/oracle-editorial/sidecar.ts apps/core/__vitest__/wordforge-oracle-editorial-sidecar.test.ts
git commit -m "feat(wordforge): persist Oracle editorial Markdown receipts"
```

### Task 3: Build evidence bundles and adaptive research lanes

**Files:**

- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-editorial/evidence.ts`
- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/__vitest__/wordforge-oracle-editorial-evidence.test.ts`
- Modify: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-source-manifest.ts`
- Modify: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-source-reader.ts`
- Modify: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/study/discovery.ts`

- [ ] **Step 1: Write failing evidence and lane tests**

Cover current digest-bound sources, stale digests, missing locators, rights/provenance gaps, conflicting evidence, and discovery intake that remains non-authoritative.

```ts
expect(bundle.status).toBe('ready');
expect(bundle.atoms.every((atom) => atom.source_version_sha256.length === 64)).toBe(true);
expect(staleBundle.status).toBe('stale');
expect(rightsGap.lane).toBe('deep');
expect(discoveryResult.authority).toBe('research_only');
expect(discoveryResult.promoted_to_source).toBe(false);
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run apps/core/__vitest__/wordforge-oracle-editorial-evidence.test.ts apps/core/__vitest__/wordforge-oracle-source-manifest.test.ts`

Expected: the new test FAILS while the current source-manifest tests PASS.

- [ ] **Step 3: Add the evidence and discovery seams**

```ts
export interface OracleEvidenceAtom {
  id: string;
  claim: string;
  kind: 'fact' | 'source_interpretation' | 'tension' | 'open_question';
  source_id: string;
  source_path: string;
  source_version_sha256: string;
  locator: string;
  roles: readonly string[];
  rights_status: 'cleared' | 'restricted' | 'unknown';
}

export interface OracleResearchEvidenceAtomV1 {
  evidence_id: string;
  card: number;
  lenses: readonly Exclude<OracleEditorialLens, 'ALL'>[];
  claim_class: 'fact' | 'source_interpretation' | 'new_synthesis';
  claim: string;
  source_version_id: string;
  locator: string;
  conflicts_with: readonly string[];
  publishable: false;
}

export function adaptResearchEvidenceAtom(
  atom: OracleResearchEvidenceAtomV1,
  source: { source_id: string; canonical_path: string; content_sha256: string; rights_status: 'cleared' | 'restricted' | 'unknown' },
): OracleEvidenceAtom {
  return {
    id: atom.evidence_id,
    claim: atom.claim,
    kind: atom.claim_class === 'fact' ? 'fact' : atom.claim_class === 'source_interpretation' ? 'source_interpretation' : 'open_question',
    source_id: source.source_id,
    source_path: source.canonical_path,
    source_version_sha256: source.content_sha256,
    locator: atom.locator,
    roles: atom.lenses,
    rights_status: source.rights_status,
  };
}

export interface OracleDiscoveryPort {
  launchNamedGap(input: {
    tenantId: string;
    actor: string;
    card: number;
    lens: Exclude<OracleEditorialLens, 'ALL'>;
    gapId: string;
    query: string;
  }): Promise<{ scanId: string; authority: 'research_only'; promoted_to_source: false }>;
}
```

Build bundles only after the existing reader validates root containment, size, UTF-8, and the exact manifest SHA-256. A discovered result can create a Study scan/discovery-link artifact, but only a human disposition followed by an Obsidian manifest/source digest update can change source readiness.

The adapter above is the only translation from `oracle.evidence-bundle.v1` into WordForge's internal evidence shape. It preserves the stable evidence ID, claim class, claim, source-version identity, locator, and rights state; it never treats a mutable path as identity.

- [ ] **Step 4: Enforce interpretation-layer CODE dependencies**

For CODE, require current named-human-approved centers for ICHING, KEYS, DESIGN, BODY, and relevant RELATIONS. Return an explicit deep-lane gap for every absent/stale center. Do not pass raw source bodies from those lenses to CODE center synthesis.

```ts
const CODE_CENTER_DEPENDENCIES = ['ICHING', 'KEYS', 'DESIGN', 'BODY', 'RELATIONS'] as const;

export function missingCodeCenters(centers: readonly ApprovedCenter[]): readonly string[] {
  const current = new Set(centers.filter((center) => center.status === 'approved' && center.current).map((center) => center.lens));
  return CODE_CENTER_DEPENDENCIES.filter((lens) => !current.has(lens));
}
```

- [ ] **Step 5: Run focused tests**

Run: `npx vitest run apps/core/__vitest__/wordforge-oracle-editorial-evidence.test.ts apps/core/__vitest__/wordforge-oracle-editorial-status.test.ts apps/core/__vitest__/wordforge-oracle-source-manifest.test.ts`

Expected: PASS; web results remain research-only, source digest drift produces stale state, unresolved gaps produce deep, and CODE cannot synthesize from raw cross-lens sources.

- [ ] **Step 6: Commit evidence routing**

```bash
git add apps/core/lib/wordforge/oracle-editorial/evidence.ts apps/core/lib/wordforge/oracle-source-manifest.ts apps/core/lib/wordforge/oracle-source-reader.ts apps/core/lib/study/discovery.ts apps/core/__vitest__/wordforge-oracle-editorial-evidence.test.ts
git commit -m "feat(wordforge): derive Oracle editorial research lanes"
```

### Task 4: Add the resumable desk seam and additive routes

**Files:**

- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-editorial/desk.ts`
- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-editorial/index.ts`
- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/routes/wordforge-oracle-editorial.ts`
- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/__vitest__/wordforge-oracle-editorial-desk.test.ts`
- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/__vitest__/wordforge-oracle-editorial-route.test.ts`
- Modify: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/index.ts`
- Modify: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/index.ts`

- [ ] **Step 1: Write failing desk tests**

Test open-or-resume, one primary action, stale version rejection, repeated action-token replay, cross-tenant denial, deep-lane generation block, sync-conflict block, and an interrupted sidecar reconciliation.

```ts
expect(view.primary_action?.kind).toBe('prepare');
expect(resumed.work_id).toBe(view.work_id);
expect(replayed.version).toBe(firstResponse.version);
await expect(desk.act({ ...input, expectedVersion: input.expectedVersion - 1 })).rejects.toThrow(/stale/i);
expect(deepView.secondary_actions.some((action) => action.kind === 'generate_candidate')).toBe(false);
```

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run apps/core/__vitest__/wordforge-oracle-editorial-desk.test.ts apps/core/__vitest__/wordforge-oracle-editorial-route.test.ts`

Expected: FAIL because the desk and routes are absent.

- [ ] **Step 3: Implement the deep-module interface**

Export only `createOracleEditorialDesk`, `OracleEditorialDesk`, request/view types, and typed domain errors from `index.ts`. Keep stores, model ports, paths, transition functions, and persistence rows internal.

```ts
export function createOracleEditorialDesk(deps: OracleEditorialDeskDependencies): OracleEditorialDesk {
  return {
    open: (input) => openWorkItem(deps, input),
    act: (input) => actOnWorkItem(deps, input),
  };
}
```

`act` must validate tenant, auth, action token, expected version, current dependency hashes, and allowed transition before starting an effect. Return `409` for stale version/hash/action, `422` for a blocked gate, `503` for unavailable model/plugin, and `500` with retained last-good state for internal failure.

- [ ] **Step 4: Add additive Hono routes**

```ts
router.post('/api/v1/wf/oracle-editorial/work-items/open', requireWordForgeActor, openEditorialWorkItem);
router.get('/api/v1/wf/oracle-editorial/work-items/:id', requireWordForgeActor, getEditorialWorkItem);
router.post('/api/v1/wf/oracle-editorial/work-items/:id/actions', requireWordForgeActor, actOnEditorialWorkItem);
```

Do not remove or rename any route in `apps/core/routes/wordforge.ts`. The route adapter supplies actor/tenant from the current auth context, not request fields.

- [ ] **Step 5: Run focused and regression tests**

Run:

```bash
npx vitest run apps/core/__vitest__/wordforge-oracle-editorial-desk.test.ts apps/core/__vitest__/wordforge-oracle-editorial-route.test.ts apps/core/__vitest__/wordforge-oracle-series-route.test.ts
```

Expected: PASS, including all pre-existing series-route cases.

- [ ] **Step 6: Commit the desk seam**

```bash
git add apps/core/lib/wordforge/oracle-editorial/desk.ts apps/core/lib/wordforge/oracle-editorial/index.ts apps/core/routes/wordforge-oracle-editorial.ts apps/core/index.ts apps/core/lib/wordforge/index.ts apps/core/__vitest__/wordforge-oracle-editorial-desk.test.ts apps/core/__vitest__/wordforge-oracle-editorial-route.test.ts
git commit -m "feat(wordforge): add resumable Oracle editorial desk seam"
```

### Task 5: Separate model roles and add bounded center, writer, and humanizer passes

**Files:**

- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-editorial/models.ts`
- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-editorial/center.ts`
- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-editorial/humanizer.ts`
- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/__vitest__/wordforge-oracle-editorial-models.test.ts`
- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/__vitest__/wordforge-oracle-humanizer.test.ts`
- Modify: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/llm/backends.ts`
- Modify: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/llm/default-config.ts`
- Modify: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/llm/operation-map.ts`

- [ ] **Step 1: Write failing model identity and humanizer tests**

Test actual fallback identity capture, Claude-via-OpenRouter equaling Claude CLI, GPT-via-OpenRouter equaling Codex/OpenAI family, same-family critic rejection, stale humanizer base, overlapping patch rejection, protected heading/quote/number/proper-noun edits, new claim rejection, explicit bypass receipt, and preservation of the writer candidate on failure.

```ts
expect(modelIndependenceKey({ provider: 'openrouter', model: 'anthropic/claude-opus-4' })).toBe('anthropic:claude');
expect(modelIndependenceKey({ provider: 'claude-cli', model: 'opus' })).toBe('anthropic:claude');
expect(assertIndependentModels(writer, critic)).toEqual({ independent: false, status: 'unverified' });
expect(() => applyValidatedHumanizerPatches(candidate, staleResult, locks)).toThrow(/base hash/i);
expect(afterFailure.current_candidate).toBe(writerCandidate);
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run apps/core/__vitest__/wordforge-oracle-editorial-models.test.ts apps/core/__vitest__/wordforge-oracle-humanizer.test.ts`

Expected: FAIL because the role and plugin adapters are absent.

- [ ] **Step 3: Add explicit LLM operations without rewriting operator choices**

Extend `LLMOperation` and default routing with:

```ts
| 'wordforge-oracle-evidence'
| 'wordforge-oracle-center'
| 'wordforge-oracle-writer'
| 'wordforge-oracle-humanizer'
| 'wordforge-oracle-critic'
| 'wordforge-oracle-sameness'
```

Use a Codex/OpenAI family default for writer and an Anthropic/Claude family default for critic. Upgrade existing stored configs by adding missing operations only; never overwrite an operator's explicit mapping. Persist the actual `{ provider, model, run_id }` returned after fallback.

- [ ] **Step 4: Implement the center seam over immutable assimilation**

```ts
export interface CenterProposal {
  thesis: string;
  required_claim_ids: readonly string[];
  tensions: readonly { claim_ids: readonly string[]; explanation: string }[];
  exclusions: readonly string[];
  source_bundle_sha256: string;
  evidence_sha256: string;
  constitution_sha256: string;
}
```

Center approval must create an immutable terminal assimilation revision through the current assimilation store, bind the approving human and exact hashes, and stop before prose generation. Revisions create new artifacts; they never mutate a prior approval.

- [ ] **Step 5: Implement the humanizer patch contract**

```ts
export interface OracleHumanizerAdapter {
  describe(): { id: string; version: string };
  humanize(input: {
    candidate: string;
    candidate_sha256: string;
    lens: Exclude<OracleEditorialLens, 'ALL'>;
    constitution_sha256: string;
    approved_claim_ids: readonly string[];
    protected_spans: readonly ProtectedSpan[];
    protected_terms: readonly string[];
  }): Promise<{
    base_sha256: string;
    patches: readonly TextPatch[];
    warnings: readonly HumanizerWarning[];
    plugin: { id: string; version: string };
    output_sha256: string;
  }>;
}
```

The default routed adapter requests structured patches only. Validate base SHA, sorted non-overlapping ranges, bounds, headings, frontmatter, quotes, numbers, proper nouns, protected terms, and approved claim IDs before applying. Re-run constitution hard bans and fact/claim locks on the resulting candidate. A bypass requires nonblank reason text and records `humanizer_bypass`; it does not change editorial finality.

- [ ] **Step 6: Run focused tests**

Run:

```bash
npx vitest run apps/core/__vitest__/wordforge-oracle-editorial-models.test.ts apps/core/__vitest__/wordforge-oracle-humanizer.test.ts apps/core/__vitest__/wordforge-oracle-assimilation-store.test.ts
```

Expected: PASS; actual model identities are recorded, same-family identities fail closed, invalid patches never alter the candidate, and approved centers remain immutable.

- [ ] **Step 7: Commit bounded production passes**

```bash
git add apps/core/lib/wordforge/oracle-editorial/models.ts apps/core/lib/wordforge/oracle-editorial/center.ts apps/core/lib/wordforge/oracle-editorial/humanizer.ts apps/core/lib/llm/backends.ts apps/core/lib/llm/default-config.ts apps/core/lib/llm/operation-map.ts apps/core/__vitest__/wordforge-oracle-editorial-models.test.ts apps/core/__vitest__/wordforge-oracle-humanizer.test.ts
git commit -m "feat(wordforge): add bounded Oracle production passes"
```

### Task 6: Add independent critique and whole-card/deck sameness checks

**Files:**

- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-editorial/checks.ts`
- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-editorial/sameness.ts`
- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/__vitest__/wordforge-oracle-sameness.test.ts`
- Modify: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/review.ts`
- Modify: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/__vitest__/wordforge-compliance-pass.test.ts`
- Modify: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/__vitest__/wordforge-oracle-production.test.ts`

- [ ] **Step 1: Write failing critique and sameness tests**

Test that same-family critic output is not persisted, hard duplicate spans block, thematic similarity warns, lens leakage is reported, cache keys change with candidate/corpus/model, and unavailable embeddings/model interpretation return unverified rather than pass.

```ts
expect(verdictStore.listForPassage(passageId)).toHaveLength(0);
expect(exactDuplicate.status).toBe('block');
expect(exactDuplicate.matches[0]).toMatchObject({ card: 24, lens: 'CODE', start: 0 });
expect(thematicKinship.status).toBe('warn');
expect(unavailableSemantic.status).toBe('unverified');
expect(samenessCacheKey(a)).not.toBe(samenessCacheKey({ ...a, corpus_sha256: otherCorpusSha }));
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run apps/core/__vitest__/wordforge-oracle-sameness.test.ts apps/core/__vitest__/wordforge-compliance-pass.test.ts apps/core/__vitest__/wordforge-oracle-production.test.ts`

Expected: the new sameness cases FAIL; current review/production regression cases PASS.

- [ ] **Step 3: Validate independence before verdict persistence**

Refactor review assembly so the desk obtains the composed result and actual model identity, calls `assertIndependentModels`, and only then calls `persistSectionVerdict`. Keep `runComplianceReview(input)` working for existing callers. The new desk path must never persist a passing same-family result and must still create the exact legacy `review_binding` required by publication.

```ts
const independence = assertIndependentModels(writerReceipt, criticReceipt);
if (!independence.independent) {
  return { status: 'unverified', findings: [{ code: 'critic_not_independent', severity: 'block' }] };
}
return persistSectionVerdict({ ...binding, checkedBy: criticReceipt });
```

- [ ] **Step 4: Implement deterministic-first sameness**

Normalize openings, compute 5–8 word shingles, detect repeated fixed frames and imagery/metaphor phrases, and compare all six current lens candidates for teaching overlap/lens leakage. Load the current 64-card corpus through the existing Oracle card reader. Use existing `embedOptional` and `cosineSimilarity`; add no dependency. Send only flagged pairs to `wordforge-oracle-sameness` for interpretation.

```ts
export interface SamenessMatch {
  kind: 'opening' | 'fixed_frame' | 'shingle' | 'imagery' | 'teaching_overlap' | 'lens_leakage' | 'semantic';
  severity: 'warn' | 'block';
  card: number;
  lens: Exclude<OracleEditorialLens, 'ALL'>;
  start: number;
  end: number;
  excerpt: string;
  score: number | null;
}

export function samenessCacheKey(input: {
  candidate_sha256: string;
  corpus_sha256: string;
  embedding_model: string;
}): string {
  return sha256(stableJson(input));
}
```

Exact duplicates and banned fixed frames block. Semantic thematic proximity warns. Malformed or unavailable model interpretation is unverified.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npx vitest run apps/core/__vitest__/wordforge-oracle-sameness.test.ts apps/core/__vitest__/wordforge-compliance-pass.test.ts apps/core/__vitest__/wordforge-oracle-production.test.ts
```

Expected: PASS; same-family critics cannot create passing persisted verdicts, findings include exact spans and nearest card/lens, and existing publication review bindings still work.

- [ ] **Step 6: Commit quality checks**

```bash
git add apps/core/lib/wordforge/oracle-editorial/checks.ts apps/core/lib/wordforge/oracle-editorial/sameness.ts apps/core/lib/wordforge/review.ts apps/core/__vitest__/wordforge-oracle-sameness.test.ts apps/core/__vitest__/wordforge-compliance-pass.test.ts apps/core/__vitest__/wordforge-oracle-production.test.ts
git commit -m "feat(wordforge): add independent Oracle quality checks"
```

### Task 7: Add the common-caller editorial desk UI

**Files:**

- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/web/components/wordforge/OracleEditorialDeskPanel.tsx`
- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/web/__vitest__/wordforge-oracle-editorial-desk.test.tsx`
- Modify: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/web/lib/wordforge-client.ts`
- Modify: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/web/components/wordforge/TemplateStudio.tsx`

- [ ] **Step 1: Write failing UI tests**

Test opening one lens, rendering exactly one primary action, expanding gaps/findings, center approval, edit preservation, stale-action recovery, reason-required bypass/finality, and separate proposal authorization. Verify the current Oracle panels remain reachable during the pilot.

```tsx
expect(screen.getByRole('button', { name: 'Prepare this lens' })).toBeVisible();
expect(screen.queryByRole('button', { name: 'Generate the candidate' })).not.toBeInTheDocument();
await user.click(screen.getByRole('button', { name: 'Approve final' }));
expect(screen.getByLabelText('Approval reason')).toBeRequired();
expect(screen.getByRole('button', { name: 'Propose to Mandala' })).toBeDisabled();
```

- [ ] **Step 2: Run UI tests and verify failure**

Run: `npx vitest run apps/web/__vitest__/wordforge-oracle-editorial-desk.test.tsx apps/web/__vitest__/wordforge-oracle-series.test.tsx`

Expected: the new test FAILS; the existing series UI test PASSES.

- [ ] **Step 3: Add typed client methods**

```ts
export const oracleEditorialClient = {
  open: (target: OracleEditorialTarget) => post<OracleDeskView>('/api/v1/wf/oracle-editorial/work-items/open', { target }),
  get: (workId: string) => get<OracleDeskView>(`/api/v1/wf/oracle-editorial/work-items/${encodeURIComponent(workId)}`),
  act: (workId: string, request: OracleDeskActionRequest) =>
    post<OracleDeskView>(`/api/v1/wf/oracle-editorial/work-items/${encodeURIComponent(workId)}/actions`, request),
};
```

- [ ] **Step 4: Implement one-action UI behavior**

Render target, lane explanation, compact orthogonal statuses, primary action, evidence/center/candidate/findings, and decision history. Use server-provided labels and action tokens. On `409`, reload the view and preserve unsaved editor text locally. Never render controls for model selection, hashes, paths, worktrees, SQL status, push, PR, merge, or deploy.

Mount `OracleEditorialDeskPanel` inside the existing Oracle series tab. Keep `OracleAssimilationPanel` and `OracleProductionPanel` available under an `Advanced workflow` disclosure until both pilots pass.

- [ ] **Step 5: Run UI regressions**

Run: `npx vitest run apps/web/__vitest__/wordforge-oracle-editorial-desk.test.tsx apps/web/__vitest__/wordforge-oracle-series.test.tsx`

Expected: PASS; a normal editor sees one primary action and current Oracle workflows remain accessible.

- [ ] **Step 6: Commit the desk UI**

```bash
git add apps/web/components/wordforge/OracleEditorialDeskPanel.tsx apps/web/lib/wordforge-client.ts apps/web/components/wordforge/TemplateStudio.tsx apps/web/__vitest__/wordforge-oracle-editorial-desk.test.tsx
git commit -m "feat(wordforge): add one-action Oracle editorial desk"
```

### Task 8: Attach sidecars to protected local Mandala proposals

**Files:**

- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-manuscript-bundle.ts`
- Modify: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-publish-service.ts`
- Modify: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-publish.ts`
- Modify: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-series.ts`
- Modify: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/__vitest__/wordforge-oracle-publish.test.ts`
- Modify: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/__vitest__/wordforge-oracle-series-route.test.ts`

- [ ] **Step 1: Write failing additive publisher tests**

Test old calls with no sidecars, exact server-derived sidecar paths, rejected card/lens/candidate/finality hash mismatch, unchanged shared checkout, rejected sidecar-only proposal, expanded allowlist limited to exact receipts, v2 lens-only manuscript patching, mixed-layout rejection, and no remote effects.

```ts
expect(legacyResult.changedFiles).toEqual(existingExpectedChangedFiles);
expect(sidecarResult.changedFiles).toContain('oracle/editorial/23/CODE.md');
expect(sidecarResult.changedFiles).not.toContain('oracle/editorial/24/CODE.md');
expect(v2Result.changedFiles).toContain('oracle/manuscripts/23/code.md');
expect(v2Result.changedFiles).not.toContain('oracle/manuscripts/24/code.md');
expect(v2Result.changedFiles).not.toContain('oracle/cards/23.md');
expect(sharedCheckoutStatus).toBe(sharedCheckoutStatusBefore);
expect(sidecarResult.remote).toBe(false);
await expect(prepare(sidecarOnlyInput)).rejects.toThrow(/selected card manuscript must change/i);
```

- [ ] **Step 2: Run publisher tests and verify failure**

Run: `npx vitest run apps/core/__vitest__/wordforge-oracle-publish.test.ts apps/core/__vitest__/wordforge-oracle-series-route.test.ts`

Expected: new sidecar cases FAIL; all legacy cases PASS.

- [ ] **Step 3: Extend only the internal preparation input**

```ts
export interface OracleEditorialSidecarInput {
  lens: Exclude<OracleEditorialLens, 'ALL'>;
  normalized_markdown: string;
  sha256: string;
}

export interface OraclePublishPreparationInput {
  canonicalLayout: 'legacy-card' | 'lens-bundle';
  editorialSidecars?: {
    lenses: readonly OracleEditorialSidecarInput[];
    card: { normalized_markdown: string; sha256: string } | null;
  };
}
```

Merge these additions into the existing internal input rather than replacing its current fields. `canonicalLayout` is required and server-derived; `editorialSidecars` remains optional for legacy callers. Do not add caller-supplied paths and do not alter the legacy route body.

`canonicalLayout` is server-derived from the stored series binding. During import/reconciliation, `oracle-series.ts` records `legacy-card` for `oracle/cards/NN.md` and `lens-bundle` only after Mandala's resolver proves the complete active `oracle/manuscripts/NN/` bundle. A caller cannot select the layout.

Create `oracle-manuscript-bundle.ts` with the closed path mapping:

```ts
const V2_LENS_FILES = {
  CODE: 'code.md',
  ICHING: 'iching.md',
  KEYS: 'keys.md',
  DESIGN: 'design.md',
  BODY: 'body.md',
  RELATIONS: 'relations.md',
} as const;

export function derivedOracleManuscriptPath(
  card: number,
  lens: keyof typeof V2_LENS_FILES,
  layout: 'legacy-card' | 'lens-bundle',
): string {
  const nn = String(card).padStart(2, '0');
  return layout === 'legacy-card'
    ? `oracle/cards/${nn}.md`
    : `oracle/manuscripts/${nn}/${V2_LENS_FILES[lens]}`;
}
```

Reject an active legacy file plus v2 directory, an incomplete v2 bundle, a path/card mismatch, traversal, symlink escape, or a layout differing from the stored binding. For v2, patch only the selected lens body and its lens-local status frontmatter; `_card.md` remains unchanged unless a later separately designed structural-edit workflow is approved.

- [ ] **Step 4: Validate and write receipts only inside the isolated worktree**

Derive the selected manuscript path with `derivedOracleManuscriptPath`, and derive `oracle/editorial/<NN>/<LENS>.md` and `CARD.md` with `mandalaSidecarPath`. Parse every receipt and verify card, lens, work ID, candidate hash, exact finality manuscript hash, and normalized SHA before writing. Add only the selected derived manuscript path, exact sidecars, and deterministic artifacts to the current allowlist.

Keep all current guards: exact passing review binding, finality approval, selected manuscript change, all-64 validation, corpus tests/build, hook isolation, local branch/commit, and `remote: false`. Never call existing push or PR functions from the desk.

- [ ] **Step 5: Run publisher regressions**

Run: `npx vitest run apps/core/__vitest__/wordforge-oracle-publish.test.ts apps/core/__vitest__/wordforge-oracle-series-route.test.ts`

Expected: PASS; legacy changed-file results are byte-for-byte unchanged when sidecars are omitted, a v2 proposal changes only the selected lens file plus exact receipts/artifacts, and proposal protection remains fail-closed.

- [ ] **Step 6: Commit proposal receipts**

```bash
git add apps/core/lib/wordforge/oracle-manuscript-bundle.ts apps/core/lib/wordforge/oracle-publish-service.ts apps/core/lib/wordforge/oracle-publish.ts apps/core/lib/wordforge/oracle-series.ts apps/core/__vitest__/wordforge-oracle-publish.test.ts apps/core/__vitest__/wordforge-oracle-series-route.test.ts
git commit -m "feat(wordforge): attach editorial receipts to Oracle proposals"
```

### Task 9: Prove Card 23 and Card 52 pilots and complete verification

**Files:**

- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/__vitest__/wordforge-oracle-editorial-pilots.test.ts`
- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/tests/wordforge-oracle-editorial-desk.spec.ts`

- [ ] **Step 1: Add the Card 23 CODE standard-lane fixture and test**

Seed current approved interpretation artifacts for ICHING, KEYS, DESIGN, BODY, and RELATIONS. Test prepare → center approval → writer → one humanizer → checks → distinct-family critic → card/deck sameness → human edit → recheck → exact finality → separate local proposal.

```ts
expect(card23.lane).toBe('standard');
expect(card23.judgment_status).toBe('approved');
expect(card23.draft_status).toBe('human-edited');
expect(card23.critique_status).toBe('pass');
expect(card23.card_sameness_status).not.toBe('block');
expect(card23.deck_sameness_status).not.toBe('block');
expect(card23.editorial_status).toBe('final');
expect(card23.proposal_status).toBe('prepared');
expect(card23.proposal_receipt?.remote).toBe(false);
```

Also assert that a human edit leaves the humanizer receipt in lineage, does not rerun it, and marks critique/sameness stale until the editor chooses `check_candidate`.

- [ ] **Step 2: Add Card 52 BODY and CODE deep-lane fixtures and tests**

Seed one missing provenance locator, one rights-unknown source, and one interpretation conflict. Prove BODY enters deep, named-gap discovery remains research-only, human dispositions plus changed Obsidian manifest digests restore readiness, body-led center approval succeeds, CODE consumes approved centers rather than raw sources, and a simulated crash resumes without repeating effects.

```ts
expect(card52Body.lane).toBe('deep');
expect(card52Body.primary_action?.kind).toBe('launch_discovery');
expect(discovered.authority).toBe('research_only');
expect(afterDisposition.sources_status).toBe('ready');
expect(card52Code.center_input_kinds).toEqual(['approved_center']);
expect(resumed.action_receipts.filter((receipt) => receipt.action_token === actionToken)).toHaveLength(1);
```

- [ ] **Step 3: Add the browser pilot**

In Playwright, open Card 23 CODE, assert one primary action, approve a fixture center, edit candidate text, resolve a simulated stale response without losing editor text, approve final with reason, authorize proposal separately, and assert the UI reports a local proposal with no push/PR action.

- [ ] **Step 4: Run pilot tests**

Run:

```bash
npx vitest run apps/core/__vitest__/wordforge-oracle-editorial-pilots.test.ts apps/core/__vitest__/wordforge-oracle-editorial-desk.test.ts
npx playwright test tests/wordforge-oracle-editorial-desk.spec.ts tests/wordforge-oracle-series.spec.ts
```

Expected: PASS; Card 23 proves the standard end-to-end path and Card 52 proves deep research, provenance/rights/conflict handling, interpretation-layer synthesis, and recovery.

- [ ] **Step 5: Run all relevant Oracle tests and type checking**

Run:

```bash
npx vitest run apps/core/__vitest__/wordforge-oracle-*.test.ts apps/core/__vitest__/wordforge-compliance-pass.test.ts apps/web/__vitest__/wordforge-oracle-*.test.tsx
npm run typecheck
```

Expected: all tests PASS and TypeScript exits zero with no errors.

- [ ] **Step 6: Verify the configured Oracle source corpus when present**

Run:

```bash
if npm run verify:oracle-source-corpus; then
  printf 'Oracle source corpus verified\n'
else
  printf 'Oracle source corpus verification failed or the configured corpus is unavailable\n' >&2
  exit 1
fi
```

Expected in the configured development environment: PASS with 64 cards and 384 lens sources ready. Do not convert a missing local corpus into a passing result; record it as an execution blocker.

- [ ] **Step 7: Inspect the final diff for authority and proposal violations**

Run:

```bash
git diff --check
git diff --name-only HEAD~8..HEAD
rg -n "push|pull request|merge|deploy|shared checkout" apps/core/lib/wordforge/oracle-editorial apps/core/routes/wordforge-oracle-editorial.ts apps/web/components/wordforge/OracleEditorialDeskPanel.tsx
```

Expected: `git diff --check` exits zero; changed files are limited to the paths named in this plan; the search finds no desk action that pushes, creates a pull request, merges, deploys, or writes the shared Mandala checkout.

- [ ] **Step 8: Commit the pilots**

```bash
git add apps/core/__vitest__/wordforge-oracle-editorial-pilots.test.ts tests/wordforge-oracle-editorial-desk.spec.ts
git commit -m "test(wordforge): prove Oracle editorial desk pilots"
```

## Final acceptance checklist

- [ ] Existing public Oracle routes and existing client payloads remain compatible.
- [ ] The desk exposes one primary action and resumes one card/lens work item by version.
- [ ] Foundational work cannot use fast; deep expands research/center work, not rewriting.
- [ ] Source discovery remains intake until human disposition and an Obsidian digest update.
- [ ] CODE combines approved interpretation centers, never raw cross-tradition source bodies.
- [ ] Center approval, exact finality approval, and Mandala proposal authorization are three distinct human gates.
- [ ] Actual writer/critic identities are different normalized families before any passing verdict is persisted.
- [ ] Humanizer output is one validated patch set; failure preserves the writer candidate; bypass has a reason receipt.
- [ ] Human edits never trigger an automatic rewrite or humanizer rerun.
- [ ] Whole-card and deck findings include exact spans and nearest card/lens; hard duplicates block and thematic kinship warns.
- [ ] Dependency changes preserve artifacts while marking only dependent dimensions stale.
- [ ] Sidecars are strict, deterministic, physically durable, and reconciled after interrupted writes.
- [ ] Legacy proposals without sidecars behave exactly as before.
- [ ] Authorized proposals write only the selected manuscript, generated Oracle artifacts, and exact server-derived editorial sidecars inside the isolated worktree.
- [ ] No desk action pushes, opens a pull request, merges, deploys, or edits Mandala's shared checkout.
- [ ] Card 23 CODE and Card 52 BODY/CODE pilots pass; Card 3 remains a read-only quality baseline and Card 24 remains deferred.

# Universal Language Invocation Composer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn ordered reflection segments into a linked full-screen Markdown invocation, save every revision as a recoverable version and portable object, and atomically publish the newest save after its Universal Language reading.

**Architecture:** D1 is the authoritative index for drafts, paragraph-to-segment links, versions, and the single live-version pointer; the recorder build owns `oracle_reflection_sessions` and `oracle_reflection_segments`, which this build references without redefining. An administrator-only Pages Functions API validates and sanitizes a constrained Markdown document, writes an immutable Markdown artifact to the recorder build's private Oracle R2 binding, then commits version metadata and the single live pointer in one D1 batch. The public page fetches the current live projection with explicit revalidation, renders typed safe nodes rather than HTML, and renders nothing when there is no live invocation.

**Tech Stack:** React 18, TypeScript, React Router, Cloudflare Pages Functions, D1 SQLite, R2, Vitest, Playwright, native HTML drag-and-drop and pointer/keyboard controls.

---

## Scope and dependency contract

This plan begins after the reflection-recorder plan has shipped. It assumes these existing recorder entities:

```sql
oracle_reflection_sessions(id TEXT PRIMARY KEY, hexagram_number INTEGER NOT NULL, owner_user_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)
oracle_reflection_segments(id TEXT PRIMARY KEY, session_id TEXT NOT NULL, transcript TEXT NOT NULL, sequence INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)
```

The shared D1 database is also used by Adrian Website. Before applying migration `005_mandalacodes_oracle_invocations.sql`, follow `docs/d1-migrations.md`, compare remote migration state, and ensure the filename does not collide with the canonical superset migrations.

## File map

- Create `migrations/005_mandalacodes_oracle_invocations.sql`: invocation drafts, linked blocks, immutable versions, and live pointer.
- Reuse the recorder build's private `ORACLE_PRIVATE` R2 binding for versioned invocation artifacts under a separate `invocations/` prefix.
- Create `lib/oracle/invocationTypes.ts`: shared wire types and constrained block model.
- Create `lib/oracle/invocationMarkdown.ts`: parse, validate, serialize, front matter, and safe render nodes.
- Create `lib/oracle/invocationSync.ts`: pure segment/block reconciliation and reorder operations.
- Create `functions/api/oracle/invocations/_shared.ts`: auth, D1 row mapping, transaction helpers, artifact writing, and responses.
- Create `functions/api/oracle/invocations/[number]/draft.ts`: load/save the working composition.
- Create `functions/api/oracle/invocations/[number]/publish.ts`: atomic version creation and live promotion.
- Create `functions/api/oracle/invocations/[number]/versions.ts`: list and rollback immutable versions.
- Create `functions/api/oracle/invocations/[number]/download.ts`: download a chosen Markdown artifact.
- Create `functions/api/oracle/invocations/[number]/live.ts`: public live projection with ETag revalidation.
- Create `components/oracle/invocation/useInvocationComposer.ts`: client state, draft persistence, linked edits, save, rollback.
- Create `components/oracle/invocation/InvocationSegmentList.tsx`: compact newest-first source list with drag/keyboard ordering.
- Create `components/oracle/invocation/InvocationComposer.tsx`: full-screen Markdown composition workspace.
- Create `components/oracle/invocation/InvocationHistory.tsx`: version list, preview, download, rollback.
- Create `components/oracle/invocation/invocation-composer.css`: full-screen responsive treatment.
- Create `components/oracle/invocation/PublicInvocation.tsx`: safe public rendering after the reading.
- Modify `components/UniversalLanguageCard.tsx`: administrator entry point, live fetch, composer overlay.
- Modify `components/oracle/eb/generated/EBReading.host.tsx`: accept a public invocation React slot in the hand-authored host.
- Do not edit `components/oracle/eb/generated/EBReading.generated.tsx` directly; remove/replace its legacy plain-string invocation at the generator/controller source identified by the visual-foundation build, regenerate, and verify the generated diff.
- Modify `components/oracle/eb/EBReading.controller.txt` or the actual checked-in controller path established by the visual build: place the invocation slot immediately after Universal Language reading prose.
- Create `tests/unit/invocationMarkdown.test.ts`, `tests/unit/invocationSync.test.ts`, `tests/unit/invocationApi.test.ts`: pure and API contract tests.
- Create `tests/oracle-invocation-composer.spec.ts`: administrator composition and public rendering journeys.

### Task 1: Add the invocation data model and shared types

**Files:**
- Create: `migrations/005_mandalacodes_oracle_invocations.sql`
- Create: `lib/oracle/invocationTypes.ts`
- Test: `tests/unit/invocationSync.test.ts`

- [ ] **Step 1: Write a failing type-and-order test**

```ts
import { describe, expect, it } from 'vitest';
import { blocksFromSegments } from '../../lib/oracle/invocationSync';

describe('blocksFromSegments', () => {
  it('imports the arranged recorder order and preserves segment identity', () => {
    const blocks = blocksFromSegments([
      { id: 'seg-b', transcript: 'Newest thought', sortOrder: 0, createdAt: '2026-07-13T02:00:00Z' },
      { id: 'seg-a', transcript: 'Earlier thought', sortOrder: 1, createdAt: '2026-07-13T01:00:00Z' },
    ]);
    expect(blocks).toEqual([
      { id: 'segment:seg-b', kind: 'segment', segmentId: 'seg-b', markdown: 'Newest thought', sortOrder: 0 },
      { id: 'segment:seg-a', kind: 'segment', segmentId: 'seg-a', markdown: 'Earlier thought', sortOrder: 1 },
    ]);
  });
});
```

- [ ] **Step 2: Run the test and verify the missing module failure**

Run: `npx vitest run tests/unit/invocationSync.test.ts`

Expected: FAIL with `Cannot find module '../../lib/oracle/invocationSync'`.

- [ ] **Step 3: Create the migration**

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE oracle_invocation_drafts (
  id TEXT PRIMARY KEY,
  hexagram_number INTEGER NOT NULL CHECK (hexagram_number BETWEEN 1 AND 64),
  session_id TEXT NOT NULL REFERENCES oracle_reflection_sessions(id) ON DELETE CASCADE,
  admin_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  markdown_body TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(hexagram_number, admin_user_id)
);

CREATE TABLE oracle_invocation_blocks (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES oracle_invocation_drafts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('segment', 'prose')),
  segment_id TEXT REFERENCES oracle_reflection_segments(id) ON DELETE SET NULL,
  markdown TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK ((kind = 'segment' AND segment_id IS NOT NULL) OR (kind = 'prose' AND segment_id IS NULL)),
  UNIQUE(draft_id, segment_id),
  UNIQUE(draft_id, sort_order)
);

CREATE TABLE oracle_invocation_versions (
  id TEXT PRIMARY KEY,
  hexagram_number INTEGER NOT NULL CHECK (hexagram_number BETWEEN 1 AND 64),
  draft_id TEXT NOT NULL REFERENCES oracle_invocation_drafts(id),
  version_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  markdown_body TEXT NOT NULL,
  rendered_json TEXT NOT NULL,
  artifact_key TEXT NOT NULL,
  author_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(hexagram_number, version_number),
  UNIQUE(artifact_key)
);

CREATE TABLE oracle_invocation_live (
  hexagram_number INTEGER PRIMARY KEY CHECK (hexagram_number BETWEEN 1 AND 64),
  version_id TEXT NOT NULL UNIQUE REFERENCES oracle_invocation_versions(id),
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_oracle_invocation_blocks_draft_order ON oracle_invocation_blocks(draft_id, sort_order);
CREATE INDEX idx_oracle_invocation_versions_hexagram_version ON oracle_invocation_versions(hexagram_number, version_number DESC);
```

- [ ] **Step 4: Define the shared types**

```ts
export type RecorderSegment = { id: string; transcript: string; sortOrder: number; createdAt: string };
export type InvocationBlock = {
  id: string;
  kind: 'segment' | 'prose';
  segmentId: string | null;
  markdown: string;
  sortOrder: number;
};
export type InvocationDraft = {
  id: string;
  hexagramNumber: number;
  sessionId: string;
  title: string;
  blocks: InvocationBlock[];
  updatedAt: string;
};
export type SafeInline =
  | { type: 'text'; value: string }
  | { type: 'emphasis'; children: SafeInline[] }
  | { type: 'strong'; children: SafeInline[] }
  | { type: 'link'; href: string; children: SafeInline[] };
export type SafeBlock =
  | { type: 'heading'; level: 2 | 3; children: SafeInline[] }
  | { type: 'paragraph'; children: SafeInline[] }
  | { type: 'break' };
export type InvocationVersion = {
  id: string; hexagramNumber: number; versionNumber: number; title: string;
  markdownBody: string; artifactKey: string; authorUserId: string; createdAt: string;
};
export type LiveInvocation = Pick<InvocationVersion, 'id' | 'hexagramNumber' | 'versionNumber' | 'title' | 'createdAt'> & { blocks: SafeBlock[] };
```

- [ ] **Step 5: Add `blocksFromSegments` with stable linked IDs**

```ts
import type { InvocationBlock, RecorderSegment } from './invocationTypes';

export function blocksFromSegments(segments: RecorderSegment[]): InvocationBlock[] {
  return [...segments].sort((a, b) => a.sortOrder - b.sortOrder).map((segment, sortOrder) => ({
    id: `segment:${segment.id}`,
    kind: 'segment',
    segmentId: segment.id,
    markdown: segment.transcript.trim(),
    sortOrder,
  }));
}
```

- [ ] **Step 6: Run the focused test**

Run: `npx vitest run tests/unit/invocationSync.test.ts`

Expected: PASS, 1 test.

- [ ] **Step 7: Inspect and apply the migration safely**

Run: `npx wrangler d1 migrations list DB --remote`

Expected: remote applied/pending list is displayed; stop if `005_mandalacodes_oracle_invocations.sql` conflicts with a migration owned by Adrian Website.

Run after confirming: `npx wrangler d1 migrations apply DB --local`

Expected: `005_mandalacodes_oracle_invocations.sql` applied successfully to the local D1 database.

- [ ] **Step 8: Commit**

```bash
git add migrations/005_mandalacodes_oracle_invocations.sql lib/oracle/invocationTypes.ts lib/oracle/invocationSync.ts tests/unit/invocationSync.test.ts
git commit -m "feat(oracle): add invocation composition model"
```

### Task 2: Implement constrained Markdown and portable artifacts

**Files:**
- Create: `lib/oracle/invocationMarkdown.ts`
- Test: `tests/unit/invocationMarkdown.test.ts`

- [ ] **Step 1: Write failing sanitizer, serialization, and front-matter tests**

```ts
import { describe, expect, it } from 'vitest';
import { buildInvocationArtifact, parseInvocationMarkdown } from '../../lib/oracle/invocationMarkdown';

describe('invocation Markdown', () => {
  it('accepts headings, prose, emphasis, line breaks, and https links', () => {
    expect(parseInvocationMarkdown('## Arrival\n\nBe *still*.\nBreathe.\n\n[Read](https://example.com)').blocks).toHaveLength(3);
  });
  it.each(['<script>alert(1)</script>', '![x](https://example.com/x.png)', '[x](javascript:alert(1))', '# H1', '- list'])('rejects unsafe or unsupported input: %s', input => {
    expect(() => parseInvocationMarkdown(input)).toThrow();
  });
  it('writes stable front matter without segment identifiers', () => {
    const artifact = buildInvocationArtifact({ hexagramNumber: 22, title: 'Grace', versionNumber: 3, author: 'admin-1', createdAt: '2026-07-13T01:00:00.000Z', updatedAt: '2026-07-13T01:00:00.000Z', body: 'Be still.' });
    expect(artifact.key).toBe('invocations/22/invocation-22-grace/v000003.md');
    expect(artifact.contents).toContain('status: live');
    expect(artifact.contents).not.toContain('segment:');
  });
});
```

- [ ] **Step 2: Run and verify failure**

Run: `npx vitest run tests/unit/invocationMarkdown.test.ts`

Expected: FAIL because `invocationMarkdown.ts` does not exist.

- [ ] **Step 3: Implement a line-oriented allowlist parser**

Implement exported `parseInvocationMarkdown(markdown: string): { normalized: string; blocks: SafeBlock[] }`, `serializeBlocks(blocks: InvocationBlock[]): string`, and `buildInvocationArtifact(input): { key: string; contents: string }`. Enforce: UTF-8 body up to 100,000 characters; only `##`/`###` headings; paragraphs; single line breaks; `*emphasis*`, `**strong**`; links with `https:`, `http:`, or `mailto:`; no raw HTML, images, lists, blockquotes, code, H1, control characters, or YAML delimiters in the body. Parse links with `new URL`, escape YAML scalar values, normalize CRLF, and throw a typed `InvocationValidationError` containing a user-safe message and line number.

Use this exact artifact shape:

```md
---
hexagram: 22
title: "Grace"
version: 3
status: live
author: "admin-1"
created: "2026-07-13T01:00:00.000Z"
updated: "2026-07-13T01:00:00.000Z"
---

Be still.
```

The key must be `invocations/${pad2(number)}/invocation-${pad2(number)}-${slug(title)}/v${String(version).padStart(6, '0')}.md`; versions are records, while the human-readable basename remains stable.

- [ ] **Step 4: Run the Markdown tests**

Run: `npx vitest run tests/unit/invocationMarkdown.test.ts`

Expected: PASS for accepted syntax, all rejected syntax, normalized output, front matter, and key naming.

- [ ] **Step 5: Commit**

```bash
git add lib/oracle/invocationMarkdown.ts tests/unit/invocationMarkdown.test.ts
git commit -m "feat(oracle): constrain invocation markdown"
```

### Task 3: Build linked paragraph and segment synchronization

**Files:**
- Modify: `lib/oracle/invocationSync.ts`
- Modify: `tests/unit/invocationSync.test.ts`

- [ ] **Step 1: Add failing tests for bidirectional edits, prose, and ordering**

```ts
import { addProseBlock, applyBlockEdit, applySegmentEdit, moveBlock } from '../../lib/oracle/invocationSync';

it('editing a linked paragraph returns the segment transcript mutation', () => {
  const result = applyBlockEdit([linked], linked.id, 'Changed');
  expect(result.segmentUpdate).toEqual({ segmentId: 'seg-a', transcript: 'Changed' });
});
it('editing a source segment updates only its linked paragraph', () => {
  expect(applySegmentEdit([linked, prose], 'seg-a', 'From recorder')[0].markdown).toBe('From recorder');
});
it('adds invocation-only prose without a segment identity', () => {
  expect(addProseBlock([linked], 'prose-1', 'A bridge.', 1)[1]).toMatchObject({ kind: 'prose', segmentId: null });
});
it('reorders blocks and returns contiguous sort orders', () => {
  expect(moveBlock([linked, prose], 'prose-1', 0).map(block => [block.id, block.sortOrder])).toEqual([['prose-1', 0], [linked.id, 1]]);
});
```

- [ ] **Step 2: Run and verify missing exports**

Run: `npx vitest run tests/unit/invocationSync.test.ts`

Expected: FAIL naming the four missing exports.

- [ ] **Step 3: Implement immutable synchronization functions**

Implement these exact signatures:

```ts
export function applyBlockEdit(blocks: InvocationBlock[], blockId: string, markdown: string): { blocks: InvocationBlock[]; segmentUpdate: { segmentId: string; transcript: string } | null };
export function applySegmentEdit(blocks: InvocationBlock[], segmentId: string, transcript: string): InvocationBlock[];
export function addProseBlock(blocks: InvocationBlock[], id: string, markdown: string, at: number): InvocationBlock[];
export function moveBlock(blocks: InvocationBlock[], blockId: string, toIndex: number): InvocationBlock[];
export function removeProseBlock(blocks: InvocationBlock[], blockId: string): InvocationBlock[];
```

Reject deletion of linked blocks in `removeProseBlock`; trimming an invocation-only block to empty removes it. Reordering changes composition `sortOrder` only and never changes recorder timestamps.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/invocationSync.test.ts`

Expected: PASS for import, both edit directions, prose-only blocks, protected links, and contiguous ordering.

- [ ] **Step 5: Commit**

```bash
git add lib/oracle/invocationSync.ts tests/unit/invocationSync.test.ts
git commit -m "feat(oracle): synchronize invocation segments"
```

### Task 4: Add administrator draft and publish APIs

**Files:**
- Create: `functions/api/oracle/invocations/_shared.ts`
- Create: `functions/api/oracle/invocations/[number]/draft.ts`
- Create: `functions/api/oracle/invocations/[number]/publish.ts`
- Test: `tests/unit/invocationApi.test.ts`

- [ ] **Step 1: Write API contract tests with fake D1/R2 bindings**

Test exact cases: 401 without a session; 403 for signed-in non-admin; 400 outside hexagrams 1–64; draft load imports recorder segments only once; draft save updates linked segment transcripts and composition blocks in one `DB.batch`; publish validation failure performs no writes; artifact failure does not advance `oracle_invocation_live`; successful publish creates version N+1, stores artifact, then commits version/live rows; duplicate retry with the same `Idempotency-Key` returns the same version.

Use direct handler calls with `Request`, a fake `DB.prepare().bind()` recorder, and a fake `ORACLE_PRIVATE.put()` implementation. Do not use a real account or remote database in unit tests.

- [ ] **Step 2: Run and verify missing handlers**

Run: `npx vitest run tests/unit/invocationApi.test.ts`

Expected: FAIL because the invocation handlers do not exist.

- [ ] **Step 3: Reuse and verify the recorder's private R2 binding**

Confirm `wrangler.toml` already binds `ORACLE_PRIVATE` to the non-public `mandalacodes-oracle-private` bucket created by the recorder build. Do not create a second bucket or duplicate binding. Store invocation files beneath `invocations/{hexagramNumber}/` so they cannot collide with `reflections/` objects.

- [ ] **Step 4: Implement shared API contracts**

Define `InvocationEnv { DB: D1Database; ORACLE_PRIVATE: R2Bucket; ADMIN_EMAILS?: string; BETTER_AUTH_SECRET?: string; BETTER_AUTH_URL?: string }`. Reuse `requireAdmin` and `isAuthResponse` from `functions/api/_lib/auth.ts`; return JSON with `Cache-Control: no-store` for every administrative route. Validate `number`, JSON content type, body size, ownership, referenced session, segment membership, unique IDs, contiguous order, and constrained Markdown.

- [ ] **Step 5: Implement draft GET and PUT**

`GET /api/oracle/invocations/:number/draft?sessionId=...` loads the administrator's draft. If none exists, it creates one and imports that session's segments ordered by recorder `sequence`; newer reflections therefore appear at the top when the recorder stores them at sequence zero. `PUT` accepts `{ id, sessionId, title, blocks, updatedAt }`, performs optimistic concurrency (`updated_at = supplied updatedAt`), updates linked `oracle_reflection_segments.transcript`, replaces blocks, and updates the draft within one `DB.batch`. Return `409 { error: 'draft_changed', draft }` on conflict so the editor never silently loses work.

- [ ] **Step 6: Implement publish with failure-safe live semantics**

`POST /api/oracle/invocations/:number/publish` accepts the full draft plus `Idempotency-Key`. Validate and normalize first; query the next version; construct and upload the immutable R2 artifact first; then execute a single D1 `batch` containing draft/block persistence, immutable version insert, and `INSERT ... ON CONFLICT(hexagram_number) DO UPDATE SET version_id=excluded.version_id, updated_at=excluded.updated_at`. If R2 fails, D1 remains untouched. If D1 fails after R2 succeeds, delete the unreferenced artifact best-effort and return 503; the previous live row remains. Return `{ status: 'saved_and_live', version, liveUpdatedAt }` only after D1 succeeds.

- [ ] **Step 7: Run API tests**

Run: `npx vitest run tests/unit/invocationApi.test.ts`

Expected: PASS for authorization, validation, concurrency, idempotency, artifact failure, atomic live promotion, and retry preservation.

- [ ] **Step 8: Commit**

```bash
git add wrangler.toml functions/api/oracle/invocations tests/unit/invocationApi.test.ts
git commit -m "feat(oracle): save and publish invocations"
```

### Task 5: Add version history, rollback, download, and public live APIs

**Files:**
- Create: `functions/api/oracle/invocations/[number]/versions.ts`
- Create: `functions/api/oracle/invocations/[number]/download.ts`
- Create: `functions/api/oracle/invocations/[number]/live.ts`
- Modify: `tests/unit/invocationApi.test.ts`

- [ ] **Step 1: Add failing route tests**

Cover: version list is newest-first and admin-only; download returns `text/markdown; charset=utf-8` with `Content-Disposition: attachment; filename="invocation-22-grace.md"`; rollback creates a new version from the selected historical body rather than mutating history; rollback becomes live atomically; public live returns only title/version/safe blocks and never author, Markdown, metadata, or segment IDs; absent live returns 204; matching `If-None-Match` returns 304.

- [ ] **Step 2: Run and verify missing routes**

Run: `npx vitest run tests/unit/invocationApi.test.ts`

Expected: FAIL naming versions, download, and live handlers.

- [ ] **Step 3: Implement history and rollback**

`GET versions` selects immutable versions descending. `POST versions` accepts `{ action: 'rollback', versionId }`, loads the selected body, validates it again, writes a new artifact/version N+1, and atomically promotes that new version; never repoint live directly to the old row because rollback itself must remain auditable.

- [ ] **Step 4: Implement artifact download**

Require admin, verify the requested version belongs to the hexagram, read its exact `artifact_key` from R2, and stream it with attachment headers. Return 404 rather than exposing arbitrary R2 keys.

- [ ] **Step 5: Implement public live projection and cache refresh**

Select the current joined live/version row, return 204 with `Cache-Control: public, max-age=0, must-revalidate` when absent, and otherwise parse `rendered_json` into `SafeBlock[]`. Use ETag `"invocation-${hexagram}-${version}"` and `Cache-Control: public, max-age=0, must-revalidate`; the client fetches with `cache: 'no-store'` immediately after administrator publish and normal conditional revalidation on public entry. This avoids stale deployment/static caches without exposing a cache purge credential.

- [ ] **Step 6: Run API tests**

Run: `npx vitest run tests/unit/invocationApi.test.ts`

Expected: PASS for history, new-version rollback, safe projection, download, 204, and ETag/304.

- [ ] **Step 7: Commit**

```bash
git add functions/api/oracle/invocations tests/unit/invocationApi.test.ts
git commit -m "feat(oracle): add invocation history and live API"
```

### Task 6: Build the compact arrangement and full-screen composer UI

**Files:**
- Create: `components/oracle/invocation/useInvocationComposer.ts`
- Create: `components/oracle/invocation/InvocationSegmentList.tsx`
- Create: `components/oracle/invocation/InvocationComposer.tsx`
- Create: `components/oracle/invocation/InvocationHistory.tsx`
- Create: `components/oracle/invocation/invocation-composer.css`
- Modify: `components/UniversalLanguageCard.tsx`
- Test: `tests/oracle-invocation-composer.spec.ts`

- [ ] **Step 1: Write the failing administrator journey**

Mock `/api/auth/get-session`, recorder session, draft, publish, versions, and download routes. Assert: long-press/Journal entry appears only for admin; newest segment is first; Edit is anchored at the far right of the segment header rather than occupying another row; drag and keyboard move reorder blocks; `Shift to Invocation` opens a full-screen editor; editing a linked paragraph issues a segment-linked draft mutation; prose can be added without a segment ID; Save reports `Saved and live`; a failed save retains editor content and reports retry; history is newest-first; download and rollback are accessible.

- [ ] **Step 2: Run and verify failure**

Run: `npx playwright test tests/oracle-invocation-composer.spec.ts --project='Desktop Chrome'`

Expected: FAIL because composer UI is absent.

- [ ] **Step 3: Implement the state hook**

The hook exposes `{ draft, phase: 'arrange' | 'compose', status: 'idle' | 'saving' | 'saved_and_live' | 'error', editBlock, editSegment, moveBlock, addProse, saveDraft, publish, retry, versions, rollback, download }`. Keep an in-memory dirty draft until the server acknowledges it; serialize autosaves so an older request cannot overwrite a newer edit; use optimistic concurrency; preserve failed content; announce `Saved and live` through an `aria-live="polite"` region.

- [ ] **Step 4: Implement compact segment arrangement**

Render one compact row per segment: drag handle; `Segment N`; timestamp; and Edit anchored right on the same header row, followed by transcript. Use native drag events plus Move up/Move down buttons available to keyboard and screen readers. Display the current session first; history remains behind its explicit control. Do not add original-audio rows.

- [ ] **Step 5: Implement full-screen invocation editing**

`Shift to Invocation` replaces the arrangement view with a full-viewport dialog (`role="dialog"`, `aria-modal="true"`) that traps focus, closes on Escape only after confirming dirty work, and restores focus. Render block editors in composition order, visibly but quietly distinguish linked blocks from invocation-only prose, show constrained syntax guidance, provide Add prose, Arrange, Review history, Download, and Save Invocation. Editing a linked block must call the hook's linked mutation; do not use a single disconnected textarea that loses segment identity.

- [ ] **Step 6: Implement responsive visual treatment**

Use existing Oracle tokens (`--l-bg`, `--l-1`, `--l-2`, `--l-rule`, `--accent`, `--serif`, `--sans`). Keep controls at least 44px, editor measure at 680px, safe-area padding on phones, no nested decorative cards, reduced-motion transitions, and no obscured bottom content at 320/375/390/430px.

- [ ] **Step 7: Run the focused journey**

Run: `npx playwright test tests/oracle-invocation-composer.spec.ts --project='Desktop Chrome'`

Expected: PASS for arrangement, linked editing, prose, saving, errors, history, rollback, and download.

- [ ] **Step 8: Commit**

```bash
git add components/oracle/invocation components/UniversalLanguageCard.tsx tests/oracle-invocation-composer.spec.ts
git commit -m "feat(oracle): add invocation composer"
```

### Task 7: Render the live invocation after the reading

**Files:**
- Create: `components/oracle/invocation/PublicInvocation.tsx`
- Modify: `components/UniversalLanguageCard.tsx`
- Modify: `components/oracle/eb/generated/EBReading.host.tsx`
- Modify: the authoritative EB controller source established by the visual-foundation build
- Regenerate: `components/oracle/eb/generated/EBReading.generated.tsx`
- Modify: `tests/oracle-invocation-composer.spec.ts`

- [ ] **Step 1: Add failing public rendering tests**

Assert: reading prose precedes invocation; a 204 live response creates no heading, gap, or empty state; safe headings/emphasis/links render; script/image/javascript-link payloads never render; public DOM contains no admin metadata or segment IDs; after Save, a no-store refetch replaces the displayed invocation immediately; the invocation uses the existing Teajia-aligned once-only reveal and respects reduced motion.

- [ ] **Step 2: Run and verify failure**

Run: `npx playwright test tests/oracle-invocation-composer.spec.ts --grep "public invocation"`

Expected: FAIL because the live projection is not rendered.

- [ ] **Step 3: Implement a typed safe renderer**

`PublicInvocation` accepts `LiveInvocation | null` and maps only the `SafeBlock`/`SafeInline` discriminated unions to React elements. For links, enforce `http:`, `https:`, or `mailto:` again, add `rel="noreferrer noopener"` to external targets, and never use `dangerouslySetInnerHTML`. Return `null` for no live invocation.

- [ ] **Step 4: Replace the legacy static invocation source**

Remove `getInvocation` usage from `UniversalLanguageCard.tsx`; fetch `/api/oracle/invocations/${cardNum}/live`, treating 204 as null. Pass `<PublicInvocation invocation={liveInvocation} />` through a new `invocationSlot?: React.ReactNode` on the hand-authored host. Update the authoritative EB controller/template so this slot sits immediately after the Universal Language reading. Regenerate the generated component using the repository's established converter command; do not hand-edit generated JSX.

- [ ] **Step 5: Apply the existing reveal language**

Wrap the slot with the same reveal class/observer used by the Universal Language reading sections. Do not create a second animation system. Reduced motion must show the invocation immediately without transform, blur, or delay.

- [ ] **Step 6: Run public rendering tests at mobile and desktop**

Run: `npx playwright test tests/oracle-invocation-composer.spec.ts --grep "public invocation" --project='Desktop Chrome' --project='Mobile Chrome'`

Expected: PASS in both projects, including empty, sanitized, immediate refresh, and reading-before-invocation order.

- [ ] **Step 7: Commit**

```bash
git add components/UniversalLanguageCard.tsx components/oracle/eb components/oracle/invocation/PublicInvocation.tsx tests/oracle-invocation-composer.spec.ts
git commit -m "feat(oracle): publish invocation after reading"
```

### Task 8: Verify migrations, failure recovery, accessibility, and production build

**Files:**
- Modify only if verification exposes a defect in files already listed above.

- [ ] **Step 1: Run all invocation unit tests**

Run: `npx vitest run tests/unit/invocationMarkdown.test.ts tests/unit/invocationSync.test.ts tests/unit/invocationApi.test.ts`

Expected: all invocation unit tests PASS.

- [ ] **Step 2: Run type checking**

Run: `npm run typecheck`

Expected: exit 0 with no TypeScript errors.

- [ ] **Step 3: Run the focused browser suite**

Run: `npx playwright test tests/oracle-invocation-composer.spec.ts --project='Desktop Chrome' --project='Mobile Chrome'`

Expected: all composer/public tests PASS.

- [ ] **Step 4: Inspect the actual screen**

Run: `npm run dev:full`

Verify `/universal-language/22` at 320, 375, 390, 430, small-laptop, and desktop widths. Confirm reading then invocation continuity; no empty state; compact segment rows; drag plus keyboard reorder; full-screen composition; linked edits; safe-area clearance; reduced motion; history newest-first; rollback; Markdown download; failure/retry preserving content; immediate public replacement after save.

- [ ] **Step 5: Test failure recovery against local bindings**

Temporarily make the local invocation bucket binding unavailable, attempt Save, and verify: previous public version remains visible; current editor content remains; Retry succeeds after restoring the binding. Then force a stale `updatedAt` and verify the 409 recovery UI preserves both server and local content for explicit reconciliation.

- [ ] **Step 6: Run the complete relevant verification**

Run: `npm run test:unit && npm test && npm run build`

Expected: unit suite PASS, Playwright suite PASS, and Vite production build completes successfully.

- [ ] **Step 7: Apply the production migration only after checking shared-DB ownership**

Run: `npx wrangler d1 migrations list DB --remote`

Expected: `005_mandalacodes_oracle_invocations.sql` is pending and no canonical Adrian Website migration shares its number/name.

Run: `npx wrangler d1 migrations apply DB --remote`

Expected: the invocation migration applies once. If shared-DB rules require applying from Adrian Website, copy the exact reviewed migration there and apply from that canonical repository instead; do not run both.

- [ ] **Step 8: Commit any verification fixes**

```bash
git add migrations/005_mandalacodes_oracle_invocations.sql lib/oracle components/oracle functions/api/oracle/invocations tests
git commit -m "fix(oracle): harden invocation publishing"
```

- [ ] **Step 9: Push the completed branch**

Run: `git push -u origin HEAD`

Expected: the current branch is pushed successfully with no unrelated working-tree files staged.

## Acceptance checklist

- [ ] Existing recorder session and segment entities are reused rather than duplicated.
- [ ] Segment paragraphs and source transcripts synchronize in both directions.
- [ ] Composition reordering preserves source timestamps and uses contiguous independent order.
- [ ] Invocation-only prose never creates an artificial recording segment.
- [ ] The editor is full-screen after Shift to Invocation and the arrangement list remains compact.
- [ ] Markdown is constrained, validated, rendered without raw HTML, and sanitized twice at the API/public boundaries.
- [ ] Every save creates an immutable D1 version and portable R2 Markdown artifact.
- [ ] Save promotes the new version live atomically and reports `Saved and live`.
- [ ] Any validation, network, R2, or D1 failure leaves the previous live version untouched and preserves the draft.
- [ ] History is newest-first; rollback creates a new auditable version; downloads use the stable human-readable filename.
- [ ] The public invocation appears only after the reading and no empty state renders when absent.
- [ ] Public responses contain no administrator metadata or segment identities.
- [ ] Save triggers immediate live refetch and conditional caching cannot retain stale content.
- [ ] Mobile, desktop, keyboard, focus, safe-area, and reduced-motion verification passes.

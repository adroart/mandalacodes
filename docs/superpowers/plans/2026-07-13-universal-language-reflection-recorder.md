# Universal Language Reflection Recorder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an administrator-only, compact voice-reflection recorder for each Universal Language reading, with Safari-safe segmented capture, private R2 storage, Cloudflare Workers AI transcription, resilient offline retry, and a reorderable newest-first journal.

**Architecture:** The centered `ALL 64` control remains ordinary navigation for everyone until a server-verified admin-capability request succeeds; administrators can long-press it to replace the sticky footer with a recorder state machine while leaving the reading interactive. Each pause produces one client-generated, idempotent segment ID, stores the Blob in IndexedDB before upload, commits private audio to R2 through a Pages Function, then transcribes that committed object through the server-side `AI` binding using `@cf/openai/whisper-large-v3-turbo`. D1 stores sessions, segment metadata, transcript state, and explicit ordering; all recorder endpoints independently call `requireAdmin`, and no private audio URL or provider-specific response reaches the browser.

**Tech Stack:** React 18, TypeScript, React Router, MediaRecorder/Web Audio browser APIs, IndexedDB, Cloudflare Pages Functions, D1, R2, Workers AI (`@cf/openai/whisper-large-v3-turbo`), Vitest, Playwright.

---

## Scope boundaries and repository cautions

- This plan implements recording, upload/transcription, journal viewing, transcript editing, and segment ordering. It does **not** implement the full-screen invocation composer, Markdown publishing, or public invocation display.
- Preserve the current visual-foundation working tree. At plan-writing time it contains unrelated modified and untracked Oracle/font/design files. Never use `git restore`, `git reset`, or bulk staging; stage only paths named in the current task.
- `components/oracle/eb/generated/EBReading.generated.tsx` is generated output and must not be edited. The integration point is `components/oracle/eb/generated/EBReading.host.tsx`, plus the hand-authored navigation component.
- The configured `DB` is the shared `adrian-website` D1 database. Adrian-Website owns its canonical schema, and D1 journals migrations by filename. Before creating or applying the migration, inspect `docs/d1-migrations.md`, inspect both repositories' remote migration lists, and use a collision-resistant `mandalacodes_` filename. Do not apply a remote migration until the corresponding Adrian-Website owner change is reconciled.
- Audio is private. Never write it to D1, a public bucket, application logs, analytics, or a response body. Never expose `R2ObjectBody` URLs. Workers AI is the only transcription provider in this build; quota/unavailability remains recoverable `transcription_pending`.

## File map

**Create**

- `types/oracleReflection.ts` — shared domain and API contracts, status values, and limits.
- `utils/oracleReflection.ts` — pure validation, MIME selection, ordering, and response normalization.
- `lib/oracle/reflectionApi.ts` — credentialed browser API client.
- `lib/oracle/reflectionOutbox.ts` — IndexedDB persistence for uncommitted audio.
- `hooks/useReflectionRecorder.ts` — MediaRecorder lifecycle and recorder/upload state machine.
- `components/oracle/ReflectionRecorderBar.tsx` — compact pause/resume/journal footer.
- `components/oracle/ReflectionJournal.tsx` — current-session-first journal, history, edit, and drag ordering.
- `components/oracle/reflection-recorder.css` — recorder and journal presentation.
- `functions/api/oracle/reflections/_shared.ts` — Pages Function environment, auth wrapper, validation, row mapping, and JSON helpers.
- `functions/api/oracle/reflections/capability.ts` — server-proven admin capability.
- `functions/api/oracle/reflections/sessions.ts` — create/list sessions.
- `functions/api/oracle/reflections/segments.ts` — idempotent multipart upload and segment listing.
- `functions/api/oracle/reflections/segments/[id].ts` — transcript edit.
- `functions/api/oracle/reflections/segments/order.ts` — transactional explicit reordering.
- `functions/api/oracle/reflections/segments/[id]/transcribe.ts` — committed-object Workers AI transcription and retry.
- `functions/api/oracle/reflections/segments/[id]/audio.ts` — authenticated audit/recovery audio stream.
- `migrations/004_mandalacodes_oracle_reflections.sql` — proposed schema; apply only after the shared-DB ownership gate.
- `tests/unit/oracleReflection.test.ts` — pure contract/validation tests.
- `tests/unit/reflectionApiHandlers.test.ts` — mocked D1/R2/AI endpoint behavior.
- `tests/oracle-reflection-recorder.spec.ts` — browser behavior and accessibility.

**Modify**

- `wrangler.toml` — private reflection R2 binding and Workers AI binding.
- `components/oracle/OracleBottomNavigation.tsx` — long-press-capable center slot and recorder replacement.
- `components/oracle/eb/generated/EBReading.host.tsx` — pass current card identity and teardown signal into the hand-authored recorder integration without touching generated markup.

## API and data contracts

Use these fixed values throughout the implementation:

```ts
export const REFLECTION_LIMITS = {
  maxSegmentBytes: 25 * 1024 * 1024,
  maxSegmentDurationMs: 20 * 60 * 1000,
  longPressMs: 650,
} as const;

export type TranscriptionStatus =
  | 'uploading'
  | 'transcription_pending'
  | 'transcribing'
  | 'transcribed'
  | 'failed';

export interface ReflectionSession {
  id: string;
  hexagramNumber: number;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

export interface ReflectionSegment {
  id: string;
  sessionId: string;
  sequence: number;
  recordedAt: string;
  durationMs: number;
  mimeType: string;
  byteSize: number;
  transcript: string;
  transcriptionStatus: TranscriptionStatus;
  transcriptionError: string | null;
  updatedAt: string;
}
```

Endpoint contract:

| Method | Path | Request | Success |
|---|---|---|---|
| GET | `/api/oracle/reflections/capability` | cookie | `{ok:true, admin:true}`; unauthorized/forbidden remains 401/403 |
| POST | `/api/oracle/reflections/sessions` | `{id,hexagramNumber}` | 201 or idempotent 200 with `{session}` |
| GET | `/api/oracle/reflections/sessions?hexagram=22` | cookie | current active session plus newest-first history |
| POST | `/api/oracle/reflections/segments` | multipart `metadata` JSON + `audio` | 201 or idempotent 200 with `{segment}` |
| GET | `/api/oracle/reflections/segments?sessionId=…` | cookie | explicit sequence order |
| PATCH | `/api/oracle/reflections/segments/:id` | `{transcript}` | `{segment}` |
| PUT | `/api/oracle/reflections/segments/order` | `{sessionId,segmentIds}` | `{segments}` |
| POST | `/api/oracle/reflections/segments/:id/transcribe` | cookie | 200 transcribed, or 202 pending with retained audio |
| GET | `/api/oracle/reflections/segments/:id/audio` | cookie + optional Range | authenticated private audio bytes |

### Task 1: Lock domain contracts and pure behavior

**Files:**
- Create: `types/oracleReflection.ts`
- Create: `utils/oracleReflection.ts`
- Test: `tests/unit/oracleReflection.test.ts`

- [ ] **Step 1: Write failing contract tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  chooseRecorderMimeType,
  normalizeTranscript,
  validateHexagramNumber,
  validateSegmentMetadata,
  reorderSegments,
} from '../../utils/oracleReflection';

describe('oracle reflection contracts', () => {
  it('selects the first Safari-compatible supported MIME type', () => {
    const supported = new Set(['audio/mp4;codecs=mp4a.40.2']);
    expect(chooseRecorderMimeType((type) => supported.has(type))).toBe('audio/mp4;codecs=mp4a.40.2');
    expect(chooseRecorderMimeType(() => false)).toBeNull();
  });

  it('accepts only King Wen numbers', () => {
    expect(validateHexagramNumber(1)).toBe(1);
    expect(validateHexagramNumber(64)).toBe(64);
    expect(() => validateHexagramNumber(0)).toThrow('hexagramNumber must be an integer from 1 to 64');
  });

  it('rejects oversize and overlong segment metadata', () => {
    expect(() => validateSegmentMetadata({ durationMs: 1_200_001, byteSize: 10, mimeType: 'audio/mp4' })).toThrow('segment duration exceeds 20 minutes');
    expect(() => validateSegmentMetadata({ durationMs: 1000, byteSize: 26_214_401, mimeType: 'audio/mp4' })).toThrow('segment exceeds 25 MiB');
  });

  it('normalizes Workers AI transcript shapes without leaking provider fields', () => {
    expect(normalizeTranscript({ text: '  First breath.  ' })).toEqual({ text: 'First breath.' });
    expect(normalizeTranscript({ transcription: 'Second breath.' })).toEqual({ text: 'Second breath.' });
  });

  it('reorders by complete identity list without changing timestamps', () => {
    const rows = [
      { id: 'a', sequence: 0, recordedAt: '2026-07-13T01:00:00Z' },
      { id: 'b', sequence: 1, recordedAt: '2026-07-13T02:00:00Z' },
    ];
    expect(reorderSegments(rows, ['b', 'a'])).toEqual([
      { id: 'b', sequence: 0, recordedAt: '2026-07-13T02:00:00Z' },
      { id: 'a', sequence: 1, recordedAt: '2026-07-13T01:00:00Z' },
    ]);
    expect(() => reorderSegments(rows, ['a'])).toThrow('segmentIds must contain every segment exactly once');
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run tests/unit/oracleReflection.test.ts`

Expected: FAIL because `utils/oracleReflection.ts` does not exist.

- [ ] **Step 3: Create the exact shared contracts**

Create `types/oracleReflection.ts` with the constants and interfaces in “API and data contracts,” then add:

```ts
export interface SegmentMetadataInput {
  id: string;
  sessionId: string;
  hexagramNumber: number;
  recordedAt: string;
  durationMs: number;
  mimeType: string;
  byteSize: number;
}

export interface ReflectionSessionsResponse {
  current: ReflectionSession | null;
  history: ReflectionSession[];
}
```

- [ ] **Step 4: Implement the pure utilities**

```ts
import { REFLECTION_LIMITS } from '../types/oracleReflection';

const MIME_CANDIDATES = [
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
  'audio/webm;codecs=opus',
  'audio/webm',
] as const;

export function chooseRecorderMimeType(isSupported: (type: string) => boolean): string | null {
  return MIME_CANDIDATES.find(isSupported) ?? null;
}

export function validateHexagramNumber(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 64) {
    throw new Error('hexagramNumber must be an integer from 1 to 64');
  }
  return Number(value);
}

export function validateSegmentMetadata(value: {durationMs:number;byteSize:number;mimeType:string}) {
  if (!Number.isFinite(value.durationMs) || value.durationMs <= 0) throw new Error('segment duration must be positive');
  if (value.durationMs > REFLECTION_LIMITS.maxSegmentDurationMs) throw new Error('segment duration exceeds 20 minutes');
  if (!Number.isInteger(value.byteSize) || value.byteSize <= 0) throw new Error('segment byte size must be positive');
  if (value.byteSize > REFLECTION_LIMITS.maxSegmentBytes) throw new Error('segment exceeds 25 MiB');
  if (!/^audio\/(mp4|webm)(;|$)/.test(value.mimeType)) throw new Error('unsupported audio MIME type');
  return value;
}

export function normalizeTranscript(value: unknown): {text:string} {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const text = typeof row.text === 'string' ? row.text : typeof row.transcription === 'string' ? row.transcription : '';
  if (!text.trim()) throw new Error('transcription response did not contain text');
  return { text: text.trim() };
}

export function reorderSegments<T extends {id:string;sequence:number}>(rows:T[], ids:string[]):T[] {
  if (ids.length !== rows.length || new Set(ids).size !== rows.length || ids.some((id) => !rows.some((row) => row.id === id))) {
    throw new Error('segmentIds must contain every segment exactly once');
  }
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id, sequence) => ({ ...byId.get(id)!, sequence }));
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npx vitest run tests/unit/oracleReflection.test.ts && npm run typecheck`

Expected: PASS with 5 tests and no TypeScript errors.

- [ ] **Step 6: Commit only Task 1 paths**

```bash
git add types/oracleReflection.ts utils/oracleReflection.ts tests/unit/oracleReflection.test.ts
git commit -m "feat(oracle): define reflection recorder contracts"
```

### Task 2: Add the shared-D1 schema through the ownership gate

**Files:**
- Create: `migrations/004_mandalacodes_oracle_reflections.sql`

- [ ] **Step 1: Verify migration ownership and filename availability before writing SQL**

Run from this repository:

```bash
sed -n '1,240p' docs/d1-migrations.md
npx wrangler d1 migrations list adrian-website --remote
```

Run from `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/Adrian-Website` (locate its actual case-sensitive path with `find .. -maxdepth 2 -type d -iname 'adrian-website'` if needed):

```bash
npx wrangler d1 migrations list adrian-website --remote
rg --files migrations | sort
```

Expected: both journals are understood and no migration uses `004_mandalacodes_oracle_reflections.sql`. If the Adrian-Website checkout or remote journal is unavailable, stop this task and report the schema-ownership blocker; do not apply SQL from Mandala Codes.

- [ ] **Step 2: Create the collision-resistant migration**

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE oracle_reflection_sessions (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  hexagram_number INTEGER NOT NULL CHECK (hexagram_number BETWEEN 1 AND 64),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE INDEX idx_oracle_reflection_sessions_owner_hexagram
  ON oracle_reflection_sessions(owner_user_id, hexagram_number, created_at DESC);

CREATE TABLE oracle_reflection_segments (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES oracle_reflection_sessions(id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL CHECK (sequence >= 0),
  recorded_at TEXT NOT NULL,
  duration_ms INTEGER NOT NULL CHECK (duration_ms > 0 AND duration_ms <= 1200000),
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0 AND byte_size <= 26214400),
  object_key TEXT NOT NULL UNIQUE,
  transcript TEXT NOT NULL DEFAULT '',
  transcription_status TEXT NOT NULL CHECK (transcription_status IN ('uploading','transcription_pending','transcribing','transcribed','failed')),
  transcription_error TEXT,
  provider_metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(session_id, sequence)
);

CREATE INDEX idx_oracle_reflection_segments_session_sequence
  ON oracle_reflection_segments(session_id, sequence);
CREATE INDEX idx_oracle_reflection_segments_retry
  ON oracle_reflection_segments(owner_user_id, transcription_status, updated_at);
```

- [ ] **Step 3: Validate SQL locally without mutating remote D1**

Run: `npx wrangler d1 migrations apply adrian-website --local --persist-to .wrangler/state`

Expected: the new migration applies locally; querying `.schema oracle_reflection_segments` shows both tables and indexes. Do not run `--remote` in this task.

- [ ] **Step 4: Reconcile the schema with the Adrian-Website owner**

Copy or supersede this exact migration through the Adrian-Website repository’s schema process, then re-run both `migrations list --remote` commands. Only the designated database owner may run the eventual remote apply. Record the applied filename in the execution report; never create another file with equivalent SQL in this repository.

- [ ] **Step 5: Commit the proposed migration**

```bash
git add migrations/004_mandalacodes_oracle_reflections.sql
git commit -m "feat(oracle): define private reflection schema"
```

### Task 3: Configure private R2 and Workers AI bindings

**Files:**
- Modify: `wrangler.toml`

- [ ] **Step 1: Provision the private Oracle bucket**

Run: `npx wrangler r2 bucket create mandalacodes-oracle-private`

Expected: Cloudflare reports the bucket exists or was created. Do not configure an `r2.dev` public hostname or custom domain.

- [ ] **Step 2: Add bindings without altering the existing Atlas binding**

Append:

```toml
# Private Oracle recordings and invocation artifacts. No public development URL/domain.
[[r2_buckets]]
binding = "ORACLE_PRIVATE"
bucket_name = "mandalacodes-oracle-private"

# Server-side transcription only. Model: @cf/openai/whisper-large-v3-turbo.
[ai]
binding = "AI"
```

- [ ] **Step 3: Verify Wrangler parses the configuration**

Run: `npx wrangler pages functions build --outdir .wrangler/reflection-functions-check`

Expected: build succeeds and reports no duplicate or invalid bindings.

- [ ] **Step 4: Commit only Wrangler configuration**

```bash
git add wrangler.toml
git commit -m "chore(cloudflare): bind private reflection audio and AI"
```

### Task 4: Build authenticated endpoint primitives and capability check

**Files:**
- Create: `functions/api/oracle/reflections/_shared.ts`
- Create: `functions/api/oracle/reflections/capability.ts`
- Create: `tests/unit/reflectionApiHandlers.test.ts`

- [ ] **Step 1: Write failing admin and fail-closed tests**

In `tests/unit/reflectionApiHandlers.test.ts`, mock `createAuth` before importing the handler and assert: valid allowlisted admin returns 200; missing session returns 401; valid non-admin returns 403; absent `ADMIN_EMAILS` returns 403; absent `DB`, `ORACLE_PRIVATE`, or `AI` produces a named 503 from endpoints that need each binding. Use `vi.mock('../../lib/account/auth.server.js', ...)` and construct `{request, env, params:{}, waitUntil:vi.fn()}`.

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();
vi.mock('../../lib/account/auth.server.js', () => ({
  createAuth: () => ({ api: { getSession } }),
}));

describe('reflection capability', () => {
  beforeEach(() => getSession.mockReset());
  it('returns admin capability only after server session and allowlist validation', async () => {
    getSession.mockResolvedValue({ user: { id: 'admin-1', email: 'a@example.com' }, session: { id: 's' } });
    const { onRequestGet } = await import('../../functions/api/oracle/reflections/capability');
    const response = await onRequestGet({ request: new Request('https://mandalacodes.com/api/oracle/reflections/capability'), env: { DB: {}, ADMIN_EMAILS: 'A@example.com' } } as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, admin: true });
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run tests/unit/reflectionApiHandlers.test.ts`

Expected: FAIL because the capability module does not exist.

- [ ] **Step 3: Add shared environment and response helpers**

```ts
import { requireAdmin, isAuthResponse, type AuthContext } from '../../_lib/auth';
import type { Ai, D1Database, R2Bucket } from '@cloudflare/workers-types';

export interface ReflectionEnv {
  DB?: D1Database;
  ORACLE_PRIVATE?: R2Bucket;
  AI?: Ai;
  ADMIN_EMAILS?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
}

export interface ReflectionContext { request:Request; env:ReflectionEnv; params:Record<string,string>; waitUntil(promise:Promise<unknown>):void }

export const json = (body:unknown, status=200) => new Response(JSON.stringify(body), {
  status,
  headers: {'Content-Type':'application/json','Cache-Control':'no-store'},
});

export async function admin(request:Request, env:ReflectionEnv):Promise<AuthContext|Response> {
  return requireAdmin(request, env);
}

export { isAuthResponse };

export function requireBinding<T>(value:T|undefined, name:string):T|Response {
  return value ?? json({ok:false,error:`${name} binding unavailable`},503);
}
```

- [ ] **Step 4: Implement the capability endpoint**

```ts
import { admin, isAuthResponse, json, type ReflectionContext } from './_shared';

export async function onRequestGet({request,env}:ReflectionContext):Promise<Response> {
  const auth = await admin(request, env);
  if (isAuthResponse(auth)) return auth;
  return json({ok:true,admin:true});
}
```

- [ ] **Step 5: Complete and run endpoint primitive tests**

Run: `npx vitest run tests/unit/reflectionApiHandlers.test.ts && npm run typecheck`

Expected: PASS. Note that app `typecheck` excludes `functions`; the Vitest import is the compilation check for Functions.

- [ ] **Step 6: Commit**

```bash
git add functions/api/oracle/reflections/_shared.ts functions/api/oracle/reflections/capability.ts tests/unit/reflectionApiHandlers.test.ts
git commit -m "feat(oracle): add admin reflection API boundary"
```

### Task 5: Implement idempotent sessions and private segment upload

**Files:**
- Create: `functions/api/oracle/reflections/sessions.ts`
- Create: `functions/api/oracle/reflections/segments.ts`
- Modify: `tests/unit/reflectionApiHandlers.test.ts`

- [ ] **Step 1: Add failing handler tests for ownership and idempotency**

Add tests with in-memory D1/R2 fakes that assert:

```ts
it('creates a client-id session idempotently for the authenticated owner');
it('returns only the owner current session and newest-first history');
it('rejects a session id that belongs to another owner with 404');
it('puts audio at reflections/{owner}/{session}/{segment} and never returns the key');
it('replaying the same segment id returns the existing row without a second R2 put');
it('rejects mismatched Blob size, unsupported MIME, oversize, and overlong metadata');
it('deletes the R2 object if the D1 insert fails after put');
```

The segment request must use `FormData` with a `metadata` JSON string and `audio` Blob. Assert that response JSON contains no `objectKey`, bucket URL, or provider metadata.

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run tests/unit/reflectionApiHandlers.test.ts`

Expected: FAIL because sessions and segments handlers do not exist.

- [ ] **Step 3: Implement session creation/listing with client UUID idempotency**

`POST` validates UUID `id` and hexagram 1–64, then uses:

```sql
INSERT INTO oracle_reflection_sessions
  (id, owner_user_id, hexagram_number, created_at, updated_at, finished_at)
VALUES (?1, ?2, ?3, ?4, ?4, NULL)
ON CONFLICT(id) DO NOTHING
```

Immediately select by `id AND owner_user_id`; return 404 instead of revealing a colliding ID owned by someone else. `GET` selects by `owner_user_id AND hexagram_number`, orders `created_at DESC`, returns the newest unfinished row as `current`, and all other rows as `history`.

- [ ] **Step 4: Implement segment upload with write compensation**

Use this exact order:

1. `requireAdmin`.
2. Validate bindings, multipart fields, UUIDs, number, MIME, size, duration, and session ownership.
3. Select existing segment by `id`; if same owner/session/size, return it without `R2.put`; any mismatch returns 409.
4. Allocate `sequence` as `COALESCE(MAX(sequence), -1) + 1` for that session.
5. Put to `reflections/${auth.userId}/${sessionId}/${segmentId}` with `httpMetadata.contentType` and custom metadata containing only session/segment IDs.
6. Insert D1 row with `transcription_pending`.
7. If insert fails, `await ORACLE_PRIVATE.delete(objectKey)` and return a 500 JSON error.
8. Return the public segment shape without `object_key`.

Do not call Workers AI inside the upload request; the browser calls `/transcribe` after the durable 201/200 response, allowing independent retry.

- [ ] **Step 5: Run the focused suite**

Run: `npx vitest run tests/unit/reflectionApiHandlers.test.ts`

Expected: all auth, session, upload, compensation, and idempotency tests pass.

- [ ] **Step 6: Commit**

```bash
git add functions/api/oracle/reflections/sessions.ts functions/api/oracle/reflections/segments.ts tests/unit/reflectionApiHandlers.test.ts
git commit -m "feat(oracle): commit reflection audio idempotently"
```

### Task 6: Add Cloudflare Workers AI transcription and private audio recovery

**Files:**
- Create: `functions/api/oracle/reflections/segments/[id]/transcribe.ts`
- Create: `functions/api/oracle/reflections/segments/[id]/audio.ts`
- Modify: `functions/api/oracle/reflections/_shared.ts`
- Modify: `tests/unit/reflectionApiHandlers.test.ts`

- [ ] **Step 1: Add failing transcription privacy/retry tests**

```ts
it('reads the committed owner segment from private R2 before invoking AI');
it('runs only @cf/openai/whisper-large-v3-turbo and stores normalized text');
it('returns an already-transcribed segment without another AI call');
it('returns 202 transcription_pending and retains audio on quota or model failure');
it('uses a compare-and-set transition so concurrent retry invokes AI once');
it('streams audio only to the owning allowlisted administrator');
it('supports a valid single byte Range and returns 416 for invalid ranges');
```

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run tests/unit/reflectionApiHandlers.test.ts`

Expected: FAIL because transcription/audio handlers do not exist.

- [ ] **Step 3: Add the provider-neutral adapter**

Add to `_shared.ts`:

```ts
import { normalizeTranscript } from '../../../../utils/oracleReflection';

export async function transcribeCommittedAudio(ai:Ai, bytes:ArrayBuffer):Promise<{text:string;metadataJson:string}> {
  const raw = await ai.run('@cf/openai/whisper-large-v3-turbo', { audio: [...new Uint8Array(bytes)] });
  const normalized = normalizeTranscript(raw);
  const row = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const safeMetadata = { wordCount: normalized.text.split(/\s+/).filter(Boolean).length, duration: typeof row.duration === 'number' ? row.duration : null };
  return {text:normalized.text,metadataJson:JSON.stringify(safeMetadata)};
}
```

This is the only place the model name and provider response shape may appear.

- [ ] **Step 4: Implement compare-and-set transcription**

Select the segment by `id AND owner_user_id`. Return immediately for `transcribed`. Claim work with:

```sql
UPDATE oracle_reflection_segments
SET transcription_status = 'transcribing', transcription_error = NULL, updated_at = ?3
WHERE id = ?1 AND owner_user_id = ?2
  AND transcription_status IN ('transcription_pending','failed')
```

If `meta.changes !== 1`, return 202 with the current row. Otherwise get the exact private `object_key`, read its `arrayBuffer()`, run the adapter, and update transcript/status/metadata. On every AI error, set `transcription_status='transcription_pending'`, store a bounded administrator-facing message (`Workers AI unavailable; retry transcription` or `Workers AI daily allocation exhausted; retry later`), keep the R2 object, and return 202. Never include the caught provider body or stack in the response/database.

- [ ] **Step 5: Implement authenticated private audio streaming**

Require admin and owner match before `R2.get`. For no Range, return 200 with `Content-Type`, `Content-Length`, `Accept-Ranges: bytes`, `Cache-Control: private, no-store`. For `bytes=start-end`, pass `{range:{offset:start,length:end-start+1}}` to R2 and return 206 with `Content-Range`. Reject multiple/invalid/out-of-bounds ranges with 416. Do not create signed/public URLs.

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/unit/reflectionApiHandlers.test.ts`

Expected: all tests pass, including exactly one AI invocation under concurrent retry and retained R2 audio after AI failure.

- [ ] **Step 7: Commit**

```bash
git add functions/api/oracle/reflections/_shared.ts functions/api/oracle/reflections/segments/\[id\]/transcribe.ts functions/api/oracle/reflections/segments/\[id\]/audio.ts tests/unit/reflectionApiHandlers.test.ts
git commit -m "feat(oracle): transcribe private reflections with Workers AI"
```

### Task 7: Add transcript editing and transactional drag order

**Files:**
- Create: `functions/api/oracle/reflections/segments/[id].ts`
- Create: `functions/api/oracle/reflections/segments/order.ts`
- Modify: `tests/unit/reflectionApiHandlers.test.ts`

- [ ] **Step 1: Add failing mutation tests**

```ts
it('edits a transcript by segment identity without changing recorded_at');
it('rejects transcripts over 100000 UTF-8 bytes');
it('rejects a reorder missing, duplicating, or importing another-session id');
it('updates every sequence atomically without violating the unique index');
it('preserves recorded_at while returning explicit sequence order');
```

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run tests/unit/reflectionApiHandlers.test.ts`

Expected: FAIL because edit/order handlers do not exist.

- [ ] **Step 3: Implement transcript edit**

Require admin; accept only `{transcript:string}`; enforce 100,000 UTF-8 bytes; update by `id AND owner_user_id`; retain audio, timestamp, sequence, and status; set `updated_at`; return 404 on no row.

- [ ] **Step 4: Implement complete-list reorder in one D1 batch**

Select all session rows by `session_id AND owner_user_id`, validate exact identity equality with `reorderSegments`, then avoid transient `UNIQUE(session_id,sequence)` collisions by first assigning negative temporary positions and then final positions in a single `DB.batch`:

```ts
const temporary = ordered.map((row, index) => db.prepare(
  'UPDATE oracle_reflection_segments SET sequence = ?3 WHERE id = ?1 AND session_id = ?2 AND owner_user_id = ?4'
).bind(row.id, sessionId, -(index + 1), auth.userId));
const final = ordered.map((row, index) => db.prepare(
  'UPDATE oracle_reflection_segments SET sequence = ?3, updated_at = ?5 WHERE id = ?1 AND session_id = ?2 AND owner_user_id = ?4'
).bind(row.id, sessionId, index, auth.userId, now));
await db.batch([...temporary, ...final]);
```

Return rows ordered by `sequence ASC`. Do not change `recorded_at`.

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/unit/reflectionApiHandlers.test.ts`

Expected: mutation tests pass and timestamps remain byte-for-byte unchanged.

- [ ] **Step 6: Commit**

```bash
git add functions/api/oracle/reflections/segments/\[id\].ts functions/api/oracle/reflections/segments/order.ts tests/unit/reflectionApiHandlers.test.ts
git commit -m "feat(oracle): edit and reorder reflection segments"
```

### Task 8: Build the resilient browser API and IndexedDB outbox

**Files:**
- Create: `lib/oracle/reflectionApi.ts`
- Create: `lib/oracle/reflectionOutbox.ts`
- Test: `tests/unit/reflectionOutbox.test.ts`
- Modify: `vitest.config.ts`

- [ ] **Step 1: Configure only this test for a DOM-like IndexedDB fake**

Install the dev-only test dependency:

Run: `npm install -D fake-indexeddb`

Add `tests/unit/reflectionOutbox.test.ts` to the existing Vitest Node suite and import `fake-indexeddb/auto` at its top; do not change the suite environment globally.

- [ ] **Step 2: Write failing outbox tests**

```ts
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearReflectionOutbox, enqueueReflection, listPendingReflections, removeReflection } from '../../lib/oracle/reflectionOutbox';

describe('reflection outbox', () => {
  beforeEach(() => clearReflectionOutbox());
  it('persists a Blob and stable segment id across reload-like reads', async () => {
    const blob = new Blob(['voice'], {type:'audio/mp4'});
    await enqueueReflection({id:'00000000-0000-4000-8000-000000000001',sessionId:'00000000-0000-4000-8000-000000000002',hexagramNumber:22,recordedAt:'2026-07-13T00:00:00Z',durationMs:1000,mimeType:blob.type,byteSize:blob.size,blob});
    expect((await listPendingReflections())[0].blob.size).toBe(5);
  });
  it('removes an item only after durable server commit', async () => {
    const blob = new Blob(['voice'], {type:'audio/mp4'});
    const id = '00000000-0000-4000-8000-000000000001';
    await enqueueReflection({id,sessionId:'00000000-0000-4000-8000-000000000002',hexagramNumber:22,recordedAt:'2026-07-13T00:00:00Z',durationMs:1000,mimeType:blob.type,byteSize:blob.size,blob});
    await removeReflection(id);
    expect(await listPendingReflections()).toEqual([]);
  });
});
```

- [ ] **Step 3: Run and verify RED**

Run: `npx vitest run tests/unit/reflectionOutbox.test.ts`

Expected: FAIL because the outbox module does not exist.

- [ ] **Step 4: Implement the IndexedDB outbox**

Use database `mandalacodes-oracle-reflections`, version 1, object store `segments` with `keyPath:'id'` and index `recordedAt`. Export `enqueueReflection`, `listPendingReflections`, `removeReflection`, and `clearReflectionOutbox`. Every transaction must reject on `request.onerror`, `transaction.onerror`, or `transaction.onabort`; reads sort by `recordedAt` ascending so retry preserves capture order.

- [ ] **Step 5: Implement the credentialed API client**

Every call uses same-origin `fetch` with `credentials:'include'`, `Cache-Control:no-store`, and a shared parser that throws `{status,message}` for non-2xx. `uploadSegment` builds `FormData` with exact `metadata` JSON and `audio`; never stringify the Blob. `transcribeSegment` accepts both 200 and 202. Export capability, session create/list, upload, transcribe, segment list, transcript patch, and order PUT functions matching the fixed endpoint table.

- [ ] **Step 6: Run focused tests and typecheck**

Run: `npx vitest run tests/unit/reflectionOutbox.test.ts && npm run typecheck`

Expected: PASS with stable Blob/id persistence and no type errors.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json lib/oracle/reflectionApi.ts lib/oracle/reflectionOutbox.ts tests/unit/reflectionOutbox.test.ts vitest.config.ts
git commit -m "feat(oracle): persist unsynced reflection audio"
```

### Task 9: Implement Safari-safe recording lifecycle and offline retry

**Files:**
- Create: `hooks/useReflectionRecorder.ts`
- Create: `tests/unit/reflectionRecorderMachine.test.ts`
- Modify: `vitest.config.ts`

- [ ] **Step 1: Extract and test the reducer before browser side effects**

The hook file exports `reflectionRecorderReducer` with states `idle | requesting_permission | recording | committing | paused | error`, active session/segment IDs, elapsed milliseconds, pending count, and recoverable message. Tests assert legal transitions: start→recording, pause→committing→paused, resume→recording with a new UUID, offline commit→paused with pending count, retry success clears pending, and finish→idle.

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run tests/unit/reflectionRecorderMachine.test.ts`

Expected: FAIL because the hook/reducer does not exist.

- [ ] **Step 3: Implement capability and long-lived session initialization**

The hook checks capability once on mount. It creates a client UUID session only after the 650ms hold completes and `getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}})` succeeds. Permission denial maps to `Microphone access is off. Enable it in Safari Settings and hold again.` Unsupported MediaRecorder/MIME maps to `Voice recording is not supported in this browser.`

- [ ] **Step 4: Implement Safari-compatible segment capture**

Use `chooseRecorderMimeType(MediaRecorder.isTypeSupported.bind(MediaRecorder))`. Construct `new MediaRecorder(stream,{mimeType})`, collect non-empty `dataavailable` chunks, and call `recorder.stop()` on pause. Resolve the Blob only from `onstop`, calculate duration from `performance.now()`, enforce the 20-minute/25-MiB limits, persist to IndexedDB first, then upload with the same stable segment UUID.

- [ ] **Step 5: Implement upload/transcription and offline recovery**

After server upload succeeds, remove the outbox row, then call transcription. A 202 remains a recoverable journal state. Network failure leaves the Blob in IndexedDB and increments pending count. Register `window.online` to drain pending rows sequentially; also drain on mount after capability success. Because server upload is idempotent, interruption after server commit but before local delete safely replays the same UUID. Never auto-delete failed/pending audio.

- [ ] **Step 6: Guarantee media teardown**

Centralize `stopTracks()` and call it on finish, cancel, hook cleanup, `pagehide`, route/card number change, and when capability becomes unauthorized (including logout detected by a 401). Clear timers and event listeners in the same cleanup. Pausing stops MediaRecorder but keeps the acquired stream available for fast resume; finishing/canceling stops every `MediaStreamTrack`.

- [ ] **Step 7: Run reducer tests and typecheck**

Run: `npx vitest run tests/unit/reflectionRecorderMachine.test.ts && npm run typecheck`

Expected: PASS and no leaked browser global typings.

- [ ] **Step 8: Commit**

```bash
git add hooks/useReflectionRecorder.ts tests/unit/reflectionRecorderMachine.test.ts vitest.config.ts
git commit -m "feat(oracle): add resilient segmented recorder lifecycle"
```

### Task 10: Replace the sticky footer with the compact recorder bar

**Files:**
- Create: `components/oracle/ReflectionRecorderBar.tsx`
- Create: `components/oracle/reflection-recorder.css`
- Modify: `components/oracle/OracleBottomNavigation.tsx`
- Modify: `components/oracle/eb/generated/EBReading.host.tsx`
- Create: `tests/oracle-reflection-recorder.spec.ts`

- [ ] **Step 1: Write failing Playwright entry/bar tests**

Intercept capability/session/upload/transcription endpoints. Mock `navigator.mediaDevices.getUserMedia`, `MediaRecorder`, and deterministic `dataavailable/onstop`. Assert:

```ts
test('non-admin sees ordinary All 64 navigation and no recorder affordance');
test('admin tap still opens All 64 while a 650ms hold starts recording');
test('recording replaces only the sticky footer and reading remains scrollable');
test('pause commits one segment and resume starts the next');
test('permission denial and unsupported MIME remain compact and recoverable');
test('route change stops every media track');
```

Use pointer events (`pointerdown`, wait 700ms, `pointerup`) rather than a click-only shortcut. Assert no recorder endpoint is called for a short tap.

- [ ] **Step 2: Run and verify RED**

Run: `npx playwright test tests/oracle-reflection-recorder.spec.ts --project='Mobile Chrome' --reporter=list`

Expected: FAIL because recorder UI is absent.

- [ ] **Step 3: Make the center control distinguish tap from hold**

Keep the `<Link aria-label="All 64 hexagrams">` behavior for non-admin and short tap. For admin, pointer-down starts a 650ms progress timer; pointer-up/cancel before completion clears it and performs ordinary navigation; completion calls `preventDefault`, triggers `startRecording`, and suppresses the subsequent click exactly once. Add keyboard parity: Enter/Space remains All 64; do not overload keyboard navigation with recording.

- [ ] **Step 4: Build the compact replacement bar**

Render only while recorder state is not idle. Left is a 44px Pause/Resume button; center displays `22`, elapsed `mm:ss`, a restrained CSS-only status pulse/waveform with `aria-live="polite"`; right is a 44px Journal button. `committing` disables Pause/Resume and says `Saving segment…`; offline says `Saved on this device · retrying`; pending transcription says `Audio saved · transcription pending`. The reading stage must remain scrollable and receive no modal backdrop.

- [ ] **Step 5: Integrate at the hand-authored host boundary**

Pass `data.code`/`data.cardName` to the navigation/recorder integration and ensure `componentWillUnmount` or the hook owner teardown stops tracks. Do not modify `EBReading.generated.tsx` or controller source. Preserve existing centered constellation, previous/next destinations, iPhone safe area, and 320px overflow behavior.

- [ ] **Step 6: Style within the existing footer geometry**

Use existing Oracle tokens, `padding-bottom: env(safe-area-inset-bottom)`, no new backdrop, and a maximum one-line status. Under `prefers-reduced-motion: reduce`, remove pulse/wave transforms. Ensure all buttons are at least 44×44px and visible at 320px.

- [ ] **Step 7: Run focused browser tests**

Run: `npx playwright test tests/oracle-reflection-recorder.spec.ts tests/oracle-visual-foundation.spec.ts --project='Mobile Chrome' --reporter=list`

Expected: recorder scenarios pass and the existing visual/navigation foundation does not regress.

- [ ] **Step 8: Commit**

```bash
git add components/oracle/ReflectionRecorderBar.tsx components/oracle/reflection-recorder.css components/oracle/OracleBottomNavigation.tsx components/oracle/eb/generated/EBReading.host.tsx tests/oracle-reflection-recorder.spec.ts
git commit -m "feat(oracle): add compact admin reflection recorder"
```

### Task 11: Build current-session-first journal with edit, history, and drag ordering

**Files:**
- Create: `components/oracle/ReflectionJournal.tsx`
- Modify: `components/oracle/ReflectionRecorderBar.tsx`
- Modify: `components/oracle/reflection-recorder.css`
- Modify: `tests/oracle-reflection-recorder.spec.ts`

- [ ] **Step 1: Write failing journal interaction tests**

```ts
test('Journal opens the current session and keeps older sessions behind History');
test('newly recorded segments initially appear newest first');
test('segment label, time, and Edit share one compact header row');
test('journal never renders a separate original-audio row');
test('drag reorder persists identities and preserves timestamps');
test('editing transcript persists by identity and updates in place');
test('closing journal returns to recording or paused state without losing elapsed/session state');
test('failed transcription exposes Retry and retains the segment');
```

For drag testing, dispatch `dragstart`, `dragover`, and `drop` with a shared `DataTransfer`; assert the PUT body contains every current-session ID exactly once.

- [ ] **Step 2: Run and verify RED**

Run: `npx playwright test tests/oracle-reflection-recorder.spec.ts --project='Mobile Chrome' --reporter=list`

Expected: FAIL because Journal does not exist.

- [ ] **Step 3: Implement current session and History presentation**

Journal opens as a focused sheet over the reading, while the recorder stays alive underneath. The first view shows current-session segments sorted `recordedAt DESC` only on initial server load. A collapsed History control lists older sessions newest-first; selecting one loads its segments. Closing restores the exact prior recorder state.

- [ ] **Step 4: Implement compact segment rows and edit**

Each row has one header: drag handle, `SEGMENT {sequence+1} · {localized time}`, and Edit aligned at the far right. Body is transcript/status only. Do not render audio controls or an “original audio” row. Edit swaps the body to a textarea with Save/Cancel; Save PATCHes by immutable segment ID and replaces the row from the response.

- [ ] **Step 5: Implement accessible drag ordering**

Use HTML drag/drop plus Move up/Move down controls available to keyboard/screen-reader users. During initial presentation newest is top; after the first explicit reorder, render server `sequence ASC` so authored order persists. Optimistically reorder, PUT the complete ID list, roll back and announce failure on non-2xx. Never rewrite timestamps or derive identity from array position.

- [ ] **Step 6: Implement transcription recovery**

For `transcription_pending`/`failed`, show a compact Retry button that calls the exact segment transcription endpoint. Poll only while visible and a segment is `transcribing`, at 2 seconds with a 30-second ceiling; do not continuously poll the reading page. Quota state reads `Audio saved privately · retry transcription later`.

- [ ] **Step 7: Run journal and regression tests**

Run: `npx playwright test tests/oracle-reflection-recorder.spec.ts tests/oracle-visual-foundation.spec.ts --project='Mobile Chrome' --reporter=list`

Expected: all journal, recorder, centered navigation, and reduced-motion tests pass.

- [ ] **Step 8: Commit**

```bash
git add components/oracle/ReflectionJournal.tsx components/oracle/ReflectionRecorderBar.tsx components/oracle/reflection-recorder.css tests/oracle-reflection-recorder.spec.ts
git commit -m "feat(oracle): add reorderable reflection journal"
```

### Task 12: Full verification, privacy audit, and deployment readiness

**Files:**
- Modify only if verification exposes a defect in files already named by this plan.

- [ ] **Step 1: Run all unit tests**

Run: `npm run test:unit`

Expected: all Vitest tests pass, including contracts, handlers, outbox, and recorder reducer.

- [ ] **Step 2: Run typecheck and production build**

Run: `npm run typecheck && npm run build`

Expected: both commands exit 0; production CSP/header generation succeeds.

- [ ] **Step 3: Run focused browser coverage in both configured projects**

Run: `npx playwright test tests/oracle-reflection-recorder.spec.ts tests/oracle-visual-foundation.spec.ts --reporter=list`

Expected: Mobile Chrome and Desktop Chrome pass.

- [ ] **Step 4: Run the complete relevant browser suite once**

Run: `npm test`

Expected: the full Playwright suite passes with no Oracle, auth, profile, or Atlas regressions.

- [ ] **Step 5: Verify on real Safari/iPhone behavior**

Run `npm run dev:full`, open `/universal-language/22` in Safari and an iPhone at 320/375/390/430px effective widths, then verify: short tap opens All 64; hold starts after permission; pause commits; resume creates a new segment; the page scrolls throughout; backgrounding/route change stops the mic; airplane-mode pause persists locally; reconnect uploads once; journal editing and ordering survive reload; safe area and centered constellation do not clip. Inspect Safari Web Inspector Network/Storage to confirm audio exists only in IndexedDB before sync and no public R2 URL appears.

- [ ] **Step 6: Perform the privacy and authorization audit**

With signed-out, signed-in non-admin, and admin sessions, directly request every endpoint in the API table. Expected: 401, 403, and success respectively. Search response/log output and built assets:

```bash
rg -n "object_key|ORACLE_PRIVATE|whisper-large-v3-turbo|provider_metadata" dist functions components lib hooks
```

Expected: model/provider references exist only server-side; no object key/provider metadata is serialized to UI code; no audio bytes are stored in D1; every reflection handler imports/calls `requireAdmin` through `_shared`.

- [ ] **Step 7: Verify Cloudflare bindings and remote migration state before deployment**

Run: `npx wrangler d1 migrations list adrian-website --remote`

Expected: the owner-approved reflection migration is applied exactly once. Confirm the private R2 bucket has no public hostname and the Pages project has `ADMIN_EMAILS`, `DB`, `ORACLE_PRIVATE`, and `AI` bindings. Never print secret values.

- [ ] **Step 8: Review staged scope and commit any verification-only fixes**

```bash
git status --short
git diff --check
git diff --stat
```

Stage only plan-owned source/test paths. Do not stage unrelated visual-foundation or `public/design` work. If verification required fixes:

```bash
git commit -m "fix(oracle): harden reflection recorder verification"
```

- [ ] **Step 9: Push the current feature branch**

Run: `git push -u origin HEAD`

Expected: the branch pushes successfully. Report tested behavior, exact commands/results, migration ownership outcome, binding readiness, and deliberately deferred invocation composer work.

## Acceptance checklist

- [ ] Non-admin and signed-out visitors retain the normal centered navigation with no recorder disclosure.
- [ ] Every server endpoint independently validates Better Auth session plus `ADMIN_EMAILS` and fails closed.
- [ ] A 650ms hold starts immediately after permission; short tap remains All 64.
- [ ] Recorder replaces only the sticky footer; reading remains interactive and scrollable.
- [ ] Pause durably commits one segment; Resume creates a distinct segment in the same session.
- [ ] Safari MIME selection, permission denial, unsupported recording, size/duration limits, teardown, and iPhone safe areas are verified.
- [ ] IndexedDB retains each unsynced Blob with a stable UUID until idempotent server commit.
- [ ] Audio is private in R2; D1 contains metadata only; authenticated audio recovery never creates a public URL.
- [ ] Workers AI uses only `@cf/openai/whisper-large-v3-turbo`; quota/unavailability retains audio as retryable pending transcription.
- [ ] Journal opens current session first; History holds older sessions; newest appears first initially.
- [ ] Rows are compact, show no separate original-audio line, edit by segment identity, and reorder without changing timestamps.
- [ ] Shared-D1 ownership/collision checks occurred in both repositories before any remote migration.
- [ ] Focused tests, typecheck, build, full relevant Playwright suite, and real Safari/iPhone verification pass.

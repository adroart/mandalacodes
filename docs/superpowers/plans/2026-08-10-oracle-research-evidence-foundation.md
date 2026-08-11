# Oracle Research Evidence Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fail-closed Oracle research foundation that audits the existing Obsidian vault, records normalized source versions and evidence, proves the model with Card 23 CODE and Card 52 BODY/CODE, and confines automated web discovery to quarantine without changing publishable prose.

**Architecture:** Obsidian remains research truth, WordForge reads ratified evidence through a versioned `v2` adapter, and Mandala remains the only publication truth. Current cards live under `oracle/cards`; the separate compiler plan migrates them to `oracle/manuscripts` without changing this research boundary. Implement the read-only auditor first, then schemas and filesystem capabilities, copy-first aliases, pilot packets, and the flagged WordForge consumer; web intake is last and receives only a narrowly scoped intake-directory capability. Existing legacy paths remain readable until source maps and aliases have been verified, so rollback is a flag change plus registry reversal rather than deletion.

**Tech Stack:** TypeScript, Node.js filesystem and Web Fetch APIs, `gray-matter`, SHA-256 from `node:crypto`, Vitest, JSON Schema 2020-12, Markdown/YAML frontmatter, Obsidian, WordForge/i64os, Mandala corpus builders.

---

## Scope and repository boundaries

- Mandala repository: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/mandalacodes`
- WordForge/i64os repository: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os`
- Operational research vault: `/Users/adrianrasmussen/Documents/Obsidian Vault/oracle`
- Approved design: `docs/superpowers/specs/2026-08-10-oracle-editorial-lifecycle-design.md`
- Provenance policy: `docs/research/2026-08-10-oracle-web-ingestion-provenance.md`
- Current canonical cards: `oracle/cards/*.md`; target canonical cards: `oracle/manuscripts/NN/*.md`. This plan writes to neither layout.

The current verifier reports all 64 cards ready because it validates linked path existence and content hashes. The preflight audit instead starts from the observed vault baseline: 2,718 Markdown files, 261 files without meaningful bodies, 405 files without `source`, 77 duplicate-body groups covering 1,015 files, stale `_INDEX.md` guidance, and required Card 52 inputs that are empty.

## File map

### WordForge/i64os files

- Create `apps/core/lib/wordforge/oracle-research-schema.ts`: shared record types, validators, and readiness vocabulary.
- Create `apps/core/lib/wordforge/oracle-vault-audit.ts`: read-only filesystem audit and deterministic report.
- Create `apps/core/scripts/audit-oracle-vault.ts`: audit CLI with explicit report-write capability.
- Create `apps/core/__vitest__/wordforge-oracle-research-schema.test.ts`: schema contract tests.
- Create `apps/core/__vitest__/wordforge-oracle-vault-audit.test.ts`: false-readiness, provenance, and duplicate tests.
- Create `apps/core/lib/wordforge/oracle-path-aliases.ts`: contained, one-hop legacy alias resolution.
- Create `apps/core/lib/wordforge/oracle-source-migration.ts`: dry-run/copy-first source-version migration.
- Create `apps/core/scripts/migrate-oracle-source.ts`: one-record-at-a-time migration CLI.
- Create `apps/core/__vitest__/wordforge-oracle-path-aliases.test.ts`: traversal, cycle, and archive/intake exclusion tests.
- Create `apps/core/__vitest__/wordforge-oracle-source-migration.test.ts`: copy/hash/no-delete tests.
- Modify `apps/core/lib/wordforge/oracle-source-manifest.ts`: add a `v2` manifest reader without weakening legacy behavior.
- Modify `apps/core/lib/wordforge/oracle-source-reader.ts`: resolve ratified source-version IDs and aliases.
- Modify `apps/core/lib/wordforge/oracle-assimilation.ts`: persist evidence/source-version references instead of mutable paths in `v2`.
- Modify `apps/core/scripts/verify-oracle-source-corpus.ts`: add scoped pilot verification.
- Modify `apps/core/__vitest__/wordforge-oracle-source-manifest.test.ts`: `v2` readiness tests.
- Modify `apps/core/__vitest__/wordforge-oracle-assimilation-store.test.ts`: evidence-reference persistence tests.
- Create `apps/core/lib/wordforge/oracle-web-policy.ts`: independent robots/access and rights/persistence decisions.
- Create `apps/core/lib/wordforge/oracle-web-fetch.ts`: bounded public-HTTP fetcher with redirect checks.
- Create `apps/core/lib/wordforge/oracle-web-fixity.ts`: snapshot hashes and retrieval metadata.
- Create `apps/core/lib/wordforge/oracle-web-intake.ts`: intake-only writer and candidate state machine.
- Create `apps/core/scripts/oracle-web-intake.ts`: explicit candidate CLI.
- Create `apps/core/__vitest__/wordforge-oracle-web-intake.test.ts`: injected-network and filesystem-capability tests.
- Modify `package.json`: add `audit:oracle-vault`, `migrate:oracle-source`, `verify:oracle-source-pilot`, and `oracle:web-intake` scripts.

### Operational vault files

- Create `00-system/README.md`, `source-schema.md`, `evidence-schema.md`, and `workflow.md`.
- Create `00-system/schemas/source-record.schema.json`, `evidence-bundle.schema.json`, `intake-candidate.schema.json`, `path-alias.schema.json`, and `readiness-report.schema.json`.
- Create `00-system/readiness-report.md`, only through the explicit audit report command.
- Create `00-system/path-aliases.json` and `path-aliases.md`.
- Create `00-system/migrations/pilot-23.json` and `pilot-52.json`.
- Create `30-cards/23/dossier.md`, `gaps.md`, and `source-map.md`.
- Create `40-work/23/CODE/evidence.md`, `assimilation.md`, and `decisions.md`.
- Create `30-cards/52/dossier.md`, `gaps.md`, and `source-map.md`.
- Create `40-work/52/BODY/evidence.md`, `assimilation.md`, and `decisions.md`.
- Create `40-work/52/CODE/evidence.md`, `assimilation.md`, and `decisions.md`.
- Generate immutable records beneath `20-sources/<family>/<source-id>/source.md` and `20-sources/<family>/<source-id>/versions/2026-08-10-legacy-import.md` from the two pilot manifests.
- Permit automated discovery to create only `10-intake/web-candidates/<candidate-id>/candidate.md` and permitted snapshot files in the same candidate directory.

## Task 1: Define strict research record contracts

**Files:**
- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-research-schema.ts`
- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/__vitest__/wordforge-oracle-research-schema.test.ts`

- [ ] **Step 1: Write schema tests that reject false evidence and mutable-path identity**

```ts
import { describe, expect, it } from 'vitest';
import {
  assertEvidenceBundle,
  assertSourceVersionRecord,
  READINESS_STATES,
} from '../lib/wordforge/oracle-research-schema';

describe('Oracle research schema', () => {
  it('uses the approved readiness states', () => {
    expect(READINESS_STATES).toEqual([
      'unknown', 'discovering', 'incomplete', 'ready',
      'conflicted', 'stale', 'unavailable', 'invalid',
    ]);
  });

  it('requires immutable source identity and non-publishability', () => {
    const sourceSha = 'a'.repeat(64);
    expect(() => assertSourceVersionRecord({
      schema_version: 'oracle.source-version.v1',
      source_id: 'human-design-gate-23',
      source_version_id: `human-design-gate-23@sha256:${sourceSha}`,
      family: 'human-design',
      title: 'Gate 23',
      source_type: 'web-page',
      retrieved_at: '2026-08-10T00:00:00.000Z',
      retrieval_agent: { name: 'legacy-import', version: '1' },
      content_sha256: sourceSha,
      normalized_body_sha256: 'b'.repeat(64),
      license_status: 'unknown',
      rights_basis: 'research-review-only',
      legacy_paths: ['human-design/gates/gate-23.md'],
      research_only: true,
      publishable: false,
    })).not.toThrow();
  });

  it('requires evidence to cite a source version and locator', () => {
    const sourceSha = 'a'.repeat(64);
    expect(() => assertEvidenceBundle({
      schema_version: 'oracle.evidence-bundle.v1',
      card: 23,
      lens: 'CODE',
      readiness: 'ready',
      evidence_atoms: [{
        evidence_id: '23-code-gate-function',
        card: 23,
        lenses: ['CODE'],
        claim_class: 'source_interpretation',
        claim: 'Gate 23 concerns the translation of inner knowing into communicable form.',
        source_version_id: `human-design-gate-23@sha256:${sourceSha}`,
        locator: 'section:Gate 23',
        extraction_actor: 'human:adrian',
        extracted_at: '2026-08-10T00:00:00.000Z',
        conflicts_with: [],
        publishable: false,
      }],
      research_only: true,
      publishable: false,
    })).not.toThrow();
  });

  it('rejects an evidence atom containing only a mutable source path', () => {
    expect(() => assertEvidenceBundle({
      schema_version: 'oracle.evidence-bundle.v1',
      card: 23,
      lens: 'CODE',
      readiness: 'ready',
      evidence_atoms: [{
        evidence_id: 'mutable-path-only',
        card: 23,
        lenses: ['CODE'],
        claim_class: 'fact',
        claim: 'This deliberately invalid atom has no immutable source version.',
        source_path: 'hexagrams/23/qw-gate-23-transmission.md',
        locator: 'section:Gate 23',
        extraction_actor: 'test',
        extracted_at: '2026-08-10T00:00:00.000Z',
        conflicts_with: [],
        publishable: false,
      }],
      research_only: true,
      publishable: false,
    })).toThrow('source_version_id');
  });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails before implementation**

Run:

```bash
cd "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os"
npx vitest run apps/core/__vitest__/wordforge-oracle-research-schema.test.ts
```

Expected: FAIL because `oracle-research-schema.ts` does not exist.

- [ ] **Step 3: Implement the shared types and assertions**

```ts
export const READINESS_STATES = [
  'unknown', 'discovering', 'incomplete', 'ready',
  'conflicted', 'stale', 'unavailable', 'invalid',
] as const;

export type ReadinessState = typeof READINESS_STATES[number];

export interface SourceVersionRecord {
  schema_version: 'oracle.source-version.v1';
  source_id: string;
  source_version_id: string;
  family: string;
  title: string;
  creator?: string[];
  publisher?: string;
  source_type: string;
  requested_url?: string;
  final_url?: string;
  canonical_url?: string;
  retrieved_at: string;
  retrieval_agent: { name: string; version: string };
  legacy_file_sha256?: string;
  content_sha256: string;
  normalized_body_sha256: string;
  license_status: 'explicit' | 'restricted' | 'unknown';
  license_uri?: string;
  rights_basis: string;
  rights_reviewed_by?: string;
  rights_reviewed_at?: string;
  legacy_paths: string[];
  supersedes?: string;
  research_only: true;
  publishable: false;
}

export interface EvidenceAtom {
  evidence_id: string;
  card: number;
  lenses: string[];
  claim_class: 'fact' | 'source_interpretation' | 'new_synthesis';
  claim: string;
  source_version_id: string;
  locator: string;
  excerpt?: string;
  observation?: string;
  extraction_actor: string;
  extracted_at: string;
  verified_by?: string;
  verified_at?: string;
  conflicts_with: string[];
  rights_constraints?: string;
  publishable: false;
}

export interface EvidenceBundle {
  schema_version: 'oracle.evidence-bundle.v1';
  card: number;
  lens: string;
  readiness: ReadinessState;
  evidence_atoms: EvidenceAtom[];
  research_only: true;
  publishable: false;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${label} must be a non-empty string`);
  return value;
}

function sha256(value: unknown, label: string): string {
  const digest = text(value, label);
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error(`${label} must be lowercase SHA-256`);
  return digest;
}

export function assertSourceVersionRecord(value: unknown): asserts value is SourceVersionRecord {
  const item = record(value, 'source version');
  if (item.schema_version !== 'oracle.source-version.v1') throw new Error('schema_version');
  for (const key of ['source_id', 'source_version_id', 'family', 'title', 'source_type', 'retrieved_at', 'rights_basis']) text(item[key], key);
  const contentSha = sha256(item.content_sha256, 'content_sha256');
  sha256(item.normalized_body_sha256, 'normalized_body_sha256');
  if (!String(item.source_version_id).endsWith(`@sha256:${contentSha}`)) throw new Error('source_version_id must bind content_sha256');
  if (!Array.isArray(item.legacy_paths)) throw new Error('legacy_paths');
  if (!['explicit', 'restricted', 'unknown'].includes(String(item.license_status))) throw new Error('license_status');
  if (item.research_only !== true || item.publishable !== false) throw new Error('research_only/publishable boundary');
  const agent = record(item.retrieval_agent, 'retrieval_agent');
  text(agent.name, 'retrieval_agent.name');
  text(agent.version, 'retrieval_agent.version');
}

export function assertEvidenceBundle(value: unknown): asserts value is EvidenceBundle {
  const bundle = record(value, 'evidence bundle');
  if (bundle.schema_version !== 'oracle.evidence-bundle.v1') throw new Error('schema_version');
  if (!Number.isInteger(bundle.card) || Number(bundle.card) < 1 || Number(bundle.card) > 64) throw new Error('card');
  text(bundle.lens, 'lens');
  if (!READINESS_STATES.includes(bundle.readiness as ReadinessState)) throw new Error('readiness');
  if (!Array.isArray(bundle.evidence_atoms)) throw new Error('evidence_atoms');
  if (bundle.research_only !== true || bundle.publishable !== false) throw new Error('research_only/publishable boundary');
  for (const raw of bundle.evidence_atoms) {
    const atom = record(raw, 'evidence atom');
    for (const key of ['evidence_id', 'claim', 'source_version_id', 'locator', 'extraction_actor', 'extracted_at']) text(atom[key], key);
    if (!/@sha256:[a-f0-9]{64}$/.test(String(atom.source_version_id))) throw new Error('source_version_id must be immutable');
    if (!['fact', 'source_interpretation', 'new_synthesis'].includes(String(atom.claim_class))) throw new Error('claim_class');
    if (atom.publishable !== false) throw new Error('publishable');
    if (!Array.isArray(atom.lenses) || !Array.isArray(atom.conflicts_with)) throw new Error('lenses/conflicts_with');
  }
}
```

- [ ] **Step 4: Run the focused test and typecheck**

Run:

```bash
cd "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os"
npx vitest run apps/core/__vitest__/wordforge-oracle-research-schema.test.ts
npm run typecheck
```

Expected: both commands PASS.

- [ ] **Step 5: Commit the contract**

```bash
cd "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os"
git add apps/core/lib/wordforge/oracle-research-schema.ts apps/core/__vitest__/wordforge-oracle-research-schema.test.ts
git commit -m "feat(wordforge): define Oracle research evidence contracts"
```

## Task 2: Build the read-only readiness auditor before moving files

**Files:**
- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-vault-audit.ts`
- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/scripts/audit-oracle-vault.ts`
- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/__vitest__/wordforge-oracle-vault-audit.test.ts`
- Modify: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/package.json`

- [ ] **Step 1: Write a test proving that bodyless linked inputs are not ready**

```ts
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { auditOracleVault } from '../lib/wordforge/oracle-vault-audit';

describe('auditOracleVault', () => {
  it('reports bodyless, unprovenanced, duplicate, and stale records without writing', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'oracle-audit-'));
    await mkdir(path.join(root, 'hexagrams/52'), { recursive: true });
    await writeFile(path.join(root, 'hexagrams/52/gene-key-52.md'), '---\ntitle: Gene Key 52\n---\n');
    await writeFile(path.join(root, 'hexagrams/52/a.md'), '---\nsource: https://example.test/a\n---\nSame useful body');
    await writeFile(path.join(root, 'hexagrams/52/b.md'), '---\nsource: https://example.test/b\n---\nSame useful body');
    await writeFile(path.join(root, '_INDEX.md'), 'Synthesis belongs in _hexagram-NN.md');

    const report = await auditOracleVault(root);

    expect(report.markdown_files).toBe(4);
    expect(report.no_meaningful_body).toContain('hexagrams/52/gene-key-52.md');
    expect(report.missing_source).toContain('hexagrams/52/gene-key-52.md');
    expect(report.duplicate_body_groups[0].paths).toEqual([
      'hexagrams/52/a.md', 'hexagrams/52/b.md',
    ]);
    expect(report.stale_guidance).toContain('_INDEX.md');
    expect(report.writes_performed).toBe(0);
  });
});
```

- [ ] **Step 2: Run the audit test and confirm the missing-module failure**

Run:

```bash
cd "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os"
npx vitest run apps/core/__vitest__/wordforge-oracle-vault-audit.test.ts
```

Expected: FAIL because `auditOracleVault` is absent.

- [ ] **Step 3: Implement deterministic recursive inspection with no writer dependency**

```ts
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';

export interface OracleAuditReport {
  schema_version: 'oracle.readiness-report.v1';
  markdown_files: number;
  zero_byte: string[];
  no_meaningful_body: string[];
  missing_source: string[];
  stale_guidance: string[];
  duplicate_body_groups: Array<{ normalized_body_sha256: string; paths: string[] }>;
  writes_performed: 0;
}

async function markdownPaths(root: string, current = root): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true });
  const nested = await Promise.all(entries.sort((a, b) => a.name.localeCompare(b.name)).map(async entry => {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) return markdownPaths(root, absolute);
    return entry.isFile() && entry.name.endsWith('.md') ? [path.relative(root, absolute)] : [];
  }));
  return nested.flat().sort();
}

function normalizedBody(body: string): string {
  return body.replace(/<!--[^]*?-->/g, '').replace(/\s+/g, ' ').trim();
}

export async function auditOracleVault(root: string): Promise<OracleAuditReport> {
  const paths = await markdownPaths(root);
  const zeroByte: string[] = [];
  const noBody: string[] = [];
  const missingSource: string[] = [];
  const staleGuidance: string[] = [];
  const bodies = new Map<string, string[]>();

  for (const relative of paths) {
    const raw = await readFile(path.join(root, relative), 'utf8');
    if (raw.length === 0) zeroByte.push(relative);
    const parsed = matter(raw);
    const body = normalizedBody(parsed.content);
    if (!body) noBody.push(relative);
    if (!parsed.data.source && !relative.startsWith('00-system/') && !relative.startsWith('30-cards/') && !relative.startsWith('40-work/')) missingSource.push(relative);
    if (relative === '_INDEX.md' && /_hexagram-NN\.md|Adrian-Website\/oracle|PROJECT_PLAN\.md/.test(raw)) staleGuidance.push(relative);
    if (body) {
      const digest = createHash('sha256').update(body).digest('hex');
      bodies.set(digest, [...(bodies.get(digest) ?? []), relative]);
    }
  }

  return {
    schema_version: 'oracle.readiness-report.v1',
    markdown_files: paths.length,
    zero_byte: zeroByte,
    no_meaningful_body: noBody,
    missing_source: missingSource,
    stale_guidance: staleGuidance,
    duplicate_body_groups: [...bodies].filter(([, grouped]) => grouped.length > 1).map(([digest, grouped]) => ({ normalized_body_sha256: digest, paths: grouped.sort() })),
    writes_performed: 0,
  };
}
```

- [ ] **Step 4: Add a CLI whose write capability is explicit and contained**

```ts
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { auditOracleVault } from '../lib/wordforge/oracle-vault-audit';

const root = process.env.ORACLE_VAULT_ROOT;
if (!root) throw new Error('ORACLE_VAULT_ROOT is required');
const report = await auditOracleVault(root);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (process.argv.includes('--write-report')) {
  const target = path.join(root, '00-system/readiness-report.md');
  const body = `---\nschema_version: oracle.readiness-report.v1\ngenerated_at: ${new Date().toISOString()}\n---\n\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\`\n`;
  await writeFile(target, body, { encoding: 'utf8', flag: 'w' });
}
```

Add these exact `package.json` script entries:

```json
{
  "audit:oracle-vault": "tsx apps/core/scripts/audit-oracle-vault.ts"
}
```

- [ ] **Step 5: Run focused and live read-only checks**

Run:

```bash
cd "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os"
npx vitest run apps/core/__vitest__/wordforge-oracle-vault-audit.test.ts
ORACLE_VAULT_ROOT="/Users/adrianrasmussen/Documents/Obsidian Vault/oracle" npm run audit:oracle-vault -- --check > /tmp/oracle-readiness-report.json
node -e 'const r=require("/tmp/oracle-readiness-report.json"); if(r.writes_performed!==0||!r.no_meaningful_body.includes("hexagrams/52/gene-key-52.md")) process.exit(1)'
npm run typecheck
```

Expected: tests PASS; the live assertion PASS; no vault file changes.

- [ ] **Step 6: Commit the read-only auditor**

```bash
cd "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os"
git add package.json apps/core/lib/wordforge/oracle-vault-audit.ts apps/core/scripts/audit-oracle-vault.ts apps/core/__vitest__/wordforge-oracle-vault-audit.test.ts
git commit -m "feat(wordforge): audit Oracle vault readiness"
```

## Task 3: Install vault schemas and capability documentation

**Files:**
- Create: `/Users/adrianrasmussen/Documents/Obsidian Vault/oracle/00-system/README.md`
- Create: `/Users/adrianrasmussen/Documents/Obsidian Vault/oracle/00-system/source-schema.md`
- Create: `/Users/adrianrasmussen/Documents/Obsidian Vault/oracle/00-system/evidence-schema.md`
- Create: `/Users/adrianrasmussen/Documents/Obsidian Vault/oracle/00-system/workflow.md`
- Create: `/Users/adrianrasmussen/Documents/Obsidian Vault/oracle/00-system/schemas/source-record.schema.json`
- Create: `/Users/adrianrasmussen/Documents/Obsidian Vault/oracle/00-system/schemas/evidence-bundle.schema.json`
- Create: `/Users/adrianrasmussen/Documents/Obsidian Vault/oracle/00-system/schemas/intake-candidate.schema.json`
- Create: `/Users/adrianrasmussen/Documents/Obsidian Vault/oracle/00-system/schemas/path-alias.schema.json`
- Create: `/Users/adrianrasmussen/Documents/Obsidian Vault/oracle/00-system/schemas/readiness-report.schema.json`

- [ ] **Step 1: Add a schema-validation test before creating vault schemas**

Extend `wordforge-oracle-research-schema.test.ts` with:

```ts
import { readFile } from 'node:fs/promises';

it('ships all five operational schemas as JSON Schema 2020-12', async () => {
  const root = '/Users/adrianrasmussen/Documents/Obsidian Vault/oracle/00-system/schemas';
  for (const name of ['source-record', 'evidence-bundle', 'intake-candidate', 'path-alias', 'readiness-report']) {
    const schema = JSON.parse(await readFile(`${root}/${name}.schema.json`, 'utf8'));
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.additionalProperties).toBe(false);
  }
});
```

- [ ] **Step 2: Run the focused test and confirm missing schemas fail**

Run:

```bash
cd "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os"
npx vitest run apps/core/__vitest__/wordforge-oracle-research-schema.test.ts
```

Expected: FAIL with `ENOENT` for `source-record.schema.json`.

- [ ] **Step 3: Create the source and evidence schemas**

Use this exact source schema shape, with the required fields preserved:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "oracle.source-version.v1",
  "type": "object",
  "additionalProperties": false,
  "required": ["schema_version", "source_id", "source_version_id", "family", "title", "source_type", "retrieved_at", "retrieval_agent", "content_sha256", "normalized_body_sha256", "license_status", "rights_basis", "legacy_paths", "research_only", "publishable"],
  "properties": {
    "schema_version": { "const": "oracle.source-version.v1" },
    "source_id": { "type": "string", "minLength": 1 },
    "source_version_id": { "type": "string", "minLength": 1 },
    "family": { "type": "string", "minLength": 1 },
    "title": { "type": "string", "minLength": 1 },
    "creator": { "type": "array", "items": { "type": "string" } },
    "publisher": { "type": "string" },
    "source_type": { "type": "string", "minLength": 1 },
    "requested_url": { "type": "string" },
    "final_url": { "type": "string" },
    "canonical_url": { "type": "string" },
    "retrieved_at": { "type": "string", "format": "date-time" },
    "retrieval_agent": { "type": "object", "additionalProperties": false, "required": ["name", "version"], "properties": { "name": { "type": "string" }, "version": { "type": "string" } } },
    "legacy_file_sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
    "content_sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
    "normalized_body_sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
    "license_status": { "enum": ["explicit", "restricted", "unknown"] },
    "license_uri": { "type": "string" },
    "rights_basis": { "type": "string", "minLength": 1 },
    "rights_reviewed_by": { "type": "string" },
    "rights_reviewed_at": { "type": "string", "format": "date-time" },
    "legacy_paths": { "type": "array", "items": { "type": "string" } },
    "supersedes": { "type": "string" },
    "research_only": { "const": true },
    "publishable": { "const": false }
  }
}
```

Use this evidence schema core:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "oracle.evidence-bundle.v1",
  "type": "object",
  "additionalProperties": false,
  "required": ["schema_version", "card", "lens", "readiness", "evidence_atoms", "research_only", "publishable"],
  "properties": {
    "schema_version": { "const": "oracle.evidence-bundle.v1" },
    "card": { "type": "integer", "minimum": 1, "maximum": 64 },
    "lens": { "type": "string", "minLength": 1 },
    "readiness": { "enum": ["unknown", "discovering", "incomplete", "ready", "conflicted", "stale", "unavailable", "invalid"] },
    "evidence_atoms": { "type": "array", "items": { "type": "object", "additionalProperties": false, "required": ["evidence_id", "card", "lenses", "claim_class", "claim", "source_version_id", "locator", "extraction_actor", "extracted_at", "conflicts_with", "publishable"], "properties": { "evidence_id": { "type": "string" }, "card": { "type": "integer" }, "lenses": { "type": "array", "items": { "type": "string" } }, "claim_class": { "enum": ["fact", "source_interpretation", "new_synthesis"] }, "claim": { "type": "string", "minLength": 1 }, "source_version_id": { "type": "string" }, "locator": { "type": "string" }, "excerpt": { "type": "string" }, "observation": { "type": "string" }, "extraction_actor": { "type": "string" }, "extracted_at": { "type": "string", "format": "date-time" }, "verified_by": { "type": "string" }, "verified_at": { "type": "string", "format": "date-time" }, "conflicts_with": { "type": "array", "items": { "type": "string" } }, "rights_constraints": { "type": "string" }, "publishable": { "const": false } } } },
    "research_only": { "const": true },
    "publishable": { "const": false }
  }
}
```

- [ ] **Step 4: Create intake, alias, and readiness schemas with fail-closed enums**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "oracle.intake-candidate.v1",
  "type": "object",
  "additionalProperties": false,
  "required": ["schema_version", "candidate_id", "discovered_url", "discovered_at", "discovery_actor", "state", "robots_decision", "rights_decision", "body_persisted", "research_only", "publishable"],
  "properties": {
    "schema_version": { "const": "oracle.intake-candidate.v1" },
    "candidate_id": { "type": "string" },
    "discovered_url": { "type": "string" },
    "requested_url": { "type": "string" },
    "final_url": { "type": "string" },
    "canonical_url": { "type": "string" },
    "discovered_at": { "type": "string", "format": "date-time" },
    "discovery_actor": { "type": "string" },
    "state": { "enum": ["candidate", "blocked", "quarantined", "promoted"] },
    "robots_decision": { "enum": ["allowed", "disallowed", "unavailable", "unknown"] },
    "rights_decision": { "enum": ["persist-full", "metadata-only", "blocked", "unknown"] },
    "body_persisted": { "type": "boolean" },
    "content_sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
    "research_only": { "const": true },
    "publishable": { "const": false }
  }
}
```

Create `path-alias.schema.json` with required `legacy_path`, `source_version_id`, `canonical_path`, `created_at`, and `status` (`active`, `retired`, `quarantined`), and create `readiness-report.schema.json` from the `OracleAuditReport` fields in Task 2. Both schemas set `additionalProperties` to `false`.

- [ ] **Step 5: Write the four system documents with the exact boundary table**

`workflow.md` must contain:

```markdown
| Actor | May read | May write |
|---|---|---|
| Auditor | Entire Oracle vault | `00-system/readiness-report.md` only with `--write-report` |
| Web discovery | Public URL metadata | `10-intake/**` only |
| Human promotion | `10-intake/**` | `20-sources/**` and source maps |
| WordForge | `20-sources/**`, `30-cards/**`, `40-work/**` | WordForge state only |
| Mandala publishing | Ratified WordForge output | Current `oracle/cards/**`, target `oracle/manuscripts/**`, only through editorial review |

No automatically discovered source or AI-produced summary is publishable prose or an evidentiary substitute. Fetch permission and persistence/use permission are independent decisions.
```

`README.md`, `source-schema.md`, and `evidence-schema.md` must point to the matching JSON Schema and state that generated prose is out of scope.

- [ ] **Step 6: Run schema tests and write the first explicit readiness report**

Run:

```bash
cd "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os"
npx vitest run apps/core/__vitest__/wordforge-oracle-research-schema.test.ts
ORACLE_VAULT_ROOT="/Users/adrianrasmussen/Documents/Obsidian Vault/oracle" npm run audit:oracle-vault -- --write-report
```

Expected: PASS; only `00-system/**` is new or changed in the vault.

- [ ] **Step 7: Commit the schema validation change in i64os and record the vault checkpoint**

```bash
cd "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os"
git add apps/core/__vitest__/wordforge-oracle-research-schema.test.ts
git commit -m "test(wordforge): validate Oracle vault schemas"
find "/Users/adrianrasmussen/Documents/Obsidian Vault/oracle/00-system" -type f -print0 | sort -z | xargs -0 shasum -a 256 > /tmp/oracle-00-system-2026-08-10.sha256
```

## Task 4: Add copy-first source migration and one-hop aliases

**Files:**
- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-path-aliases.ts`
- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-source-migration.ts`
- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/scripts/migrate-oracle-source.ts`
- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/__vitest__/wordforge-oracle-path-aliases.test.ts`
- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/__vitest__/wordforge-oracle-source-migration.test.ts`
- Modify: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/package.json`
- Create: `/Users/adrianrasmussen/Documents/Obsidian Vault/oracle/00-system/path-aliases.json`
- Create: `/Users/adrianrasmussen/Documents/Obsidian Vault/oracle/00-system/path-aliases.md`

- [ ] **Step 1: Test containment, one-hop resolution, no overwrite, and no legacy deletion**

```ts
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveOracleAlias } from '../lib/wordforge/oracle-path-aliases';
import { copySourceVersion } from '../lib/wordforge/oracle-source-migration';

describe('Oracle path aliases and copy migration', () => {
  it('resolves one contained source alias and rejects intake aliases', () => {
    const aliases = [{ legacy_path: 'hexagrams/23/qw-gate-23-transmission.md', canonical_path: '20-sources/shared-systems/qw-gate-23/versions/2026-08-10-legacy-import.md', source_version_id: 'qw-gate-23@sha256:abc', status: 'active' as const }];
    expect(resolveOracleAlias('hexagrams/23/qw-gate-23-transmission.md', aliases)).toContain('20-sources/shared-systems');
    expect(() => resolveOracleAlias('x.md', [{ ...aliases[0], legacy_path: 'x.md', canonical_path: '10-intake/x.md' }])).toThrow('non-ratified');
  });

  it('copies the exact source body into a version record and leaves the legacy file untouched', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'oracle-migrate-'));
    await mkdir(path.join(root, 'hexagrams/23'), { recursive: true });
    await writeFile(path.join(root, 'hexagrams/23/source.md'), 'source bytes');
    const result = await copySourceVersion(root, {
      legacy_path: 'hexagrams/23/source.md',
      canonical_path: '20-sources/iching/source/versions/2026-08-10-legacy-import.md',
      source_id: 'source', family: 'iching', title: 'Source', rights_basis: 'research-review-only',
    });
    expect(await readFile(path.join(root, 'hexagrams/23/source.md'), 'utf8')).toBe('source bytes');
    expect(result.content_sha256).toMatch(/^[a-f0-9]{64}$/);
  });
});
```

- [ ] **Step 2: Run tests and confirm missing modules fail**

```bash
cd "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os"
npx vitest run apps/core/__vitest__/wordforge-oracle-path-aliases.test.ts apps/core/__vitest__/wordforge-oracle-source-migration.test.ts
```

Expected: FAIL because both modules are absent.

- [ ] **Step 3: Implement contained alias resolution**

```ts
export interface OraclePathAlias {
  legacy_path: string;
  canonical_path: string;
  source_version_id: string;
  status: 'active' | 'retired' | 'quarantined';
}

function safeRelative(value: string): string {
  const normalized = value.replaceAll('\\', '/');
  if (normalized.startsWith('/') || normalized.split('/').includes('..')) throw new Error('unsafe Oracle path');
  return normalized;
}

export function resolveOracleAlias(pathValue: string, aliases: OraclePathAlias[]): string {
  const input = safeRelative(pathValue);
  const match = aliases.find(alias => alias.legacy_path === input && alias.status === 'active');
  if (!match) return input;
  const target = safeRelative(match.canonical_path);
  if (!target.startsWith('20-sources/')) throw new Error('alias target is non-ratified');
  if (aliases.some(alias => alias.legacy_path === target && alias.status === 'active')) throw new Error('alias chaining is forbidden');
  return target;
}
```

- [ ] **Step 4: Implement exclusive copy and hash verification**

```ts
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';

export interface CopySourceInput {
  legacy_path: string;
  canonical_path: string;
  source_id: string;
  family: string;
  title: string;
  rights_basis: string;
}

export async function copySourceVersion(root: string, input: CopySourceInput) {
  const source = path.resolve(root, input.legacy_path);
  const target = path.resolve(root, input.canonical_path);
  if (!source.startsWith(`${path.resolve(root)}${path.sep}`) || !target.startsWith(`${path.resolve(root, '20-sources')}${path.sep}`)) throw new Error('path escapes Oracle vault');
  const raw = await readFile(source, 'utf8');
  const parsed = matter(raw);
  if (!parsed.content.trim()) throw new Error(`source has no meaningful body: ${input.legacy_path}`);
  const legacyFileSha = createHash('sha256').update(raw).digest('hex');
  const contentSha = createHash('sha256').update(parsed.content).digest('hex');
  const normalizedSha = createHash('sha256').update(parsed.content.replace(/\s+/g, ' ').trim()).digest('hex');
  const sourceVersionId = `${input.source_id}@sha256:${contentSha}`;
  const versionRecord = matter.stringify(parsed.content, {
    schema_version: 'oracle.source-version.v1',
    source_id: input.source_id,
    source_version_id: sourceVersionId,
    family: input.family,
    title: input.title,
    source_type: 'legacy-vault-note',
    retrieved_at: '2026-08-10T00:00:00.000Z',
    retrieval_agent: { name: 'oracle-source-migration', version: '1' },
    content_sha256: contentSha,
    normalized_body_sha256: normalizedSha,
    legacy_file_sha256: legacyFileSha,
    license_status: 'unknown',
    rights_basis: input.rights_basis,
    legacy_paths: [input.legacy_path],
    research_only: true,
    publishable: false,
  });
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, versionRecord, { encoding: 'utf8', flag: 'wx' });
  const copied = await readFile(target, 'utf8');
  if (createHash('sha256').update(matter(copied).content).digest('hex') !== contentSha) throw new Error('copy hash mismatch');
  return { ...input, legacy_file_sha256: legacyFileSha, content_sha256: contentSha, normalized_body_sha256: normalizedSha, source_version_id: sourceVersionId };
}
```

- [ ] **Step 5: Add the one-record CLI and script**

The CLI accepts `--manifest`, `--entry`, and `--apply`. Without `--apply`, it prints the resolved source, target, and planned alias but writes nothing. With `--apply`, it calls `copySourceVersion`, then atomically rewrites `00-system/path-aliases.json` through a sibling temporary file and rename. Add:

```json
{
  "migrate:oracle-source": "tsx apps/core/scripts/migrate-oracle-source.ts"
}
```

The manifest entry parser must use this concrete shape:

```ts
interface MigrationManifestEntry {
  legacy_path: string;
  canonical_path: string;
  source_id: string;
  family: 'iching' | 'gene-keys' | 'human-design' | 'tarot' | 'biology' | 'relationships' | 'shared-systems';
  title: string;
  rights_basis: string;
}
```

- [ ] **Step 6: Run migration tests and typecheck**

```bash
cd "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os"
npx vitest run apps/core/__vitest__/wordforge-oracle-path-aliases.test.ts apps/core/__vitest__/wordforge-oracle-source-migration.test.ts
npm run typecheck
```

Expected: PASS; duplicate targets fail with `EEXIST`; legacy fixtures remain unchanged.

- [ ] **Step 7: Commit the migration boundary**

```bash
cd "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os"
git add package.json apps/core/lib/wordforge/oracle-path-aliases.ts apps/core/lib/wordforge/oracle-source-migration.ts apps/core/scripts/migrate-oracle-source.ts apps/core/__vitest__/wordforge-oracle-path-aliases.test.ts apps/core/__vitest__/wordforge-oracle-source-migration.test.ts
git commit -m "feat(wordforge): add copy-first Oracle source migration"
```

## Task 5: Build Card 23 and Card 52 evidence pilots without prose generation

**Files:**
- Create all pilot vault files listed in the operational-vault file map.

- [ ] **Step 1: Create exact migration manifests for the ratified pilot inputs**

`pilot-23.json` must include these legacy paths:

```json
[
  "hexagrams/23/gene-key-23.md",
  "hexagrams/23/qw-gate-23-transmission.md",
  "human-design/gates/gate-23.md",
  "human-design/channels/channel-23-43.md",
  "hexagrams/23/wilhelm-23-23-po-splitting-apart.md"
]
```

`pilot-52.json` must classify each input instead of silently skipping empty files:

```json
{
  "usable": [
    "hexagrams/52/oracle-52-the-bound.md",
    "hexagrams/52/gene-key-52-timeless-blossom.md",
    "hexagrams/52/gk-64ways-52-keeping-still-mountain.md",
    "hexagrams/52/qw-gate-52-perspective.md",
    "human-design/centers/center-root.md",
    "gene-keys/codon-rings/codon-ring-of-seeking.md",
    "hexagrams/52/tarot-09-the-hermit.md",
    "hexagrams/52/line-52-1.md",
    "hexagrams/52/line-52-2.md",
    "hexagrams/52/line-52-3.md",
    "hexagrams/52/line-52-4.md",
    "hexagrams/52/line-52-5.md",
    "hexagrams/52/line-52-6.md"
  ],
  "incomplete": [
    "hexagrams/52/gene-key-52.md",
    "human-design/gates/gate-52.md",
    "human-design/channels/channel-9-52.md",
    "hexagrams/52/wilhelm-52-52-k-n-keeping-still-mountain.md",
    "hexagrams/52/practical-52-listen-to-the-wind.md",
    "hexagrams/52/tarot-05-hierophant.md",
    "hexagrams/52/tarot-ten-of-pentacles.md"
  ]
}
```

Each usable entry also carries the `canonical_path`, `source_id`, `family`, `title`, and `rights_basis` fields required by Task 4. The incomplete paths are recorded as gap inputs and are never copied as valid source versions.

- [ ] **Step 2: Dry-run every pilot copy**

```bash
cd "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os"
ORACLE_VAULT_ROOT="/Users/adrianrasmussen/Documents/Obsidian Vault/oracle" npm run migrate:oracle-source -- --manifest 00-system/migrations/pilot-23.json --all
ORACLE_VAULT_ROOT="/Users/adrianrasmussen/Documents/Obsidian Vault/oracle" npm run migrate:oracle-source -- --manifest 00-system/migrations/pilot-52.json --all
```

Expected: both commands print plans and `writes_performed: 0`; Card 52 reports all seven incomplete paths.

- [ ] **Step 3: Snapshot the vault, then apply copy-only migration**

```bash
ORACLE_VAULT_ROOT="/Users/adrianrasmussen/Documents/Obsidian Vault/oracle"
ORACLE_SNAPSHOT_ROOT="/Users/adrianrasmussen/Documents/Obsidian Vault/oracle-pre-evidence-foundation-2026-08-10"
test ! -e "$ORACLE_SNAPSHOT_ROOT"
ditto "$ORACLE_VAULT_ROOT" "$ORACLE_SNAPSHOT_ROOT"
cd "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os"
ORACLE_VAULT_ROOT="$ORACLE_VAULT_ROOT" npm run migrate:oracle-source -- --manifest 00-system/migrations/pilot-23.json --all --apply
ORACLE_VAULT_ROOT="$ORACLE_VAULT_ROOT" npm run migrate:oracle-source -- --manifest 00-system/migrations/pilot-52.json --all --apply
```

Expected: new version records appear only in `20-sources/**` and alias registries; each version preserves the exact legacy body and both its legacy-file and body hashes; all legacy files remain byte-identical to the snapshot.

- [ ] **Step 4: Create packet frontmatter with explicit readiness and stable references**

Use this exact Card 23 evidence header:

```yaml
---
schema_version: oracle.evidence-bundle.v1
card: 23
lens: CODE
readiness: conflicted
evidence_atoms: []
research_only: true
publishable: false
---
```

Use these exact Card 52 headers:

```yaml
---
schema_version: oracle.evidence-bundle.v1
card: 52
lens: BODY
readiness: incomplete
evidence_atoms: []
research_only: true
publishable: false
---
```

```yaml
---
schema_version: oracle.evidence-bundle.v1
card: 52
lens: CODE
readiness: incomplete
evidence_atoms: []
research_only: true
publishable: false
---
```

Populate evidence atoms only from inspected locators in copied source versions. Record the existing Card 23 immortal/correlation disagreement in `40-work/23/CODE/decisions.md`; do not resolve it through generated interpretation. Record each Card 52 bodyless input as a stable gap in `30-cards/52/gaps.md`.

Card 23 deliberately begins `conflicted`. The standard-lane integration fixture may mark it `ready` only after a named test editor records an explicit disposition such as excluding the disputed correlation from the CODE claims. The real packet remains conflicted until Adrian makes that decision; infrastructure tests cannot silently resolve it.

- [ ] **Step 5: Verify pilot packet constraints**

Run:

```bash
cd "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os"
ORACLE_VAULT_ROOT="/Users/adrianrasmussen/Documents/Obsidian Vault/oracle" npm run audit:oracle-vault -- --check > /tmp/oracle-pilot-audit.json
node -e 'const r=require("/tmp/oracle-pilot-audit.json"); if(!r.no_meaningful_body.includes("hexagrams/52/gene-key-52.md")) process.exit(1)'
diff -qr "/Users/adrianrasmussen/Documents/Obsidian Vault/oracle-pre-evidence-foundation-2026-08-10/hexagrams" "/Users/adrianrasmussen/Documents/Obsidian Vault/oracle/hexagrams"
diff -qr "/Users/adrianrasmussen/Documents/Obsidian Vault/oracle-pre-evidence-foundation-2026-08-10/human-design" "/Users/adrianrasmussen/Documents/Obsidian Vault/oracle/human-design"
```

Expected: audit assertion PASS; both `diff` commands report no differences.

- [ ] **Step 6: Record the vault batch checksum boundary**

```bash
find "/Users/adrianrasmussen/Documents/Obsidian Vault/oracle/00-system" "/Users/adrianrasmussen/Documents/Obsidian Vault/oracle/20-sources" "/Users/adrianrasmussen/Documents/Obsidian Vault/oracle/30-cards/23" "/Users/adrianrasmussen/Documents/Obsidian Vault/oracle/30-cards/52" "/Users/adrianrasmussen/Documents/Obsidian Vault/oracle/40-work/23" "/Users/adrianrasmussen/Documents/Obsidian Vault/oracle/40-work/52" -type f -print0 | sort -z | xargs -0 shasum -a 256 > /tmp/oracle-pilot-foundation-2026-08-10.sha256
```

Expected: checksum manifest is created outside the vault; no legacy input is changed.

## Task 6: Add flagged WordForge v2 consumption

**Files:**
- Modify: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-source-manifest.ts`
- Modify: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-source-reader.ts`
- Modify: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-assimilation.ts`
- Modify: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/scripts/verify-oracle-source-corpus.ts`
- Modify: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/__vitest__/wordforge-oracle-source-manifest.test.ts`
- Modify: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/__vitest__/wordforge-oracle-assimilation-store.test.ts`
- Modify: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/package.json`

- [ ] **Step 1: Test that the v2 flag rejects false-ready Card 52 and legacy mode remains stable**

Add:

```ts
it('uses evidence readiness in v2 instead of linked-file existence', async () => {
  const result = await buildOracleSourceManifest({ vaultRoot, card: 52, lens: 'BODY', layout: 'v2' });
  expect(result.readiness).toBe('incomplete');
  expect(result.issues).toContain('hexagrams/52/gene-key-52.md has no meaningful body');
});

it('preserves the legacy manifest when v2 is disabled', async () => {
  const result = await buildOracleSourceManifest({ vaultRoot, card: 52, lens: 'BODY', layout: 'legacy' });
  expect(result.provenance).toBe('oracle-vault-index');
});
```

Add assimilation coverage:

```ts
it('stores v2 evidence and source-version references', async () => {
  const sourceSha = 'a'.repeat(64);
  const stored = await storeAssimilationStatement({
    statement_id: '23-code-gate-function',
    evidence_refs: [{ evidence_id: '23-code-gate-function', source_version_id: `human-design-gate-23@sha256:${sourceSha}`, content_sha256: sourceSha }],
  });
  expect(stored.evidence_refs[0].source_version_id).toContain('@sha256:');
  expect(JSON.stringify(stored)).not.toContain('source_paths');
});
```

- [ ] **Step 2: Run focused tests and confirm v2 assertions fail**

```bash
cd "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os"
npx vitest run apps/core/__vitest__/wordforge-oracle-source-manifest.test.ts apps/core/__vitest__/wordforge-oracle-assimilation-store.test.ts
```

Expected: FAIL because `layout: 'v2'` and `evidence_refs` are unsupported.

- [ ] **Step 3: Add explicit layout selection and v2 manifest shape**

```ts
export type OracleResearchLayout = 'legacy' | 'v2';

export interface OracleV2ManifestEntry {
  evidence_id: string;
  source_version_id: string;
  canonical_path: string;
  content_sha256: string;
}

export function configuredOracleResearchLayout(env = process.env): OracleResearchLayout {
  return env.ORACLE_RESEARCH_LAYOUT === 'v2' ? 'v2' : 'legacy';
}
```

The `v2` branch reads only `30-cards/<NN>/source-map.md`, `40-work/<NN>/<LENS>/evidence.md`, active aliases, and `20-sources/**`. It refuses `10-intake/**`, `90-archive/**`, bodyless versions, hash mismatches, and any evidence bundle whose readiness is not `ready`. The legacy branch retains its existing behavior unchanged.

- [ ] **Step 4: Store immutable evidence references in v2**

```ts
export interface OracleEvidenceRef {
  evidence_id: string;
  source_version_id: string;
  content_sha256: string;
}

export interface OracleAssimilationStatementV2 {
  statement_id: string;
  evidence_refs: OracleEvidenceRef[];
}
```

Do not remove the legacy `source_paths` representation in this task. Select the representation from `configuredOracleResearchLayout()` so rollback requires no database rewrite.

- [ ] **Step 5: Add scoped pilot verification**

Add:

```json
{
  "verify:oracle-source-pilot": "ORACLE_RESEARCH_LAYOUT=v2 tsx apps/core/scripts/verify-oracle-source-corpus.ts --cards=23,52 --allow-incomplete=52:BODY,52:CODE,23:CODE"
}
```

The verifier exits nonzero when an undeclared lens is incomplete, when Card 52 is incorrectly reported ready, or when any packet references intake/quarantine/archive content.

- [ ] **Step 6: Run v2 and legacy regression checks**

```bash
cd "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os"
npx vitest run apps/core/__vitest__/wordforge-oracle-source-manifest.test.ts apps/core/__vitest__/wordforge-oracle-assimilation-store.test.ts apps/core/__vitest__/wordforge-oracle-production.test.ts
ORACLE_VAULT_ROOT="/Users/adrianrasmussen/Documents/Obsidian Vault/oracle" npm run verify:oracle-source-pilot
ORACLE_VAULT_ROOT="/Users/adrianrasmussen/Documents/Obsidian Vault/oracle" npm run verify:oracle-source-corpus
npm run typecheck
```

Expected: all tests PASS; the pilot verifier reports declared incomplete states rather than false readiness; the legacy 64-card verifier retains its current successful behavior.

- [ ] **Step 7: Commit the flagged consumer**

```bash
cd "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os"
git add package.json apps/core/lib/wordforge/oracle-source-manifest.ts apps/core/lib/wordforge/oracle-source-reader.ts apps/core/lib/wordforge/oracle-assimilation.ts apps/core/scripts/verify-oracle-source-corpus.ts apps/core/__vitest__/wordforge-oracle-source-manifest.test.ts apps/core/__vitest__/wordforge-oracle-assimilation-store.test.ts
git commit -m "feat(wordforge): consume versioned Oracle evidence behind v2 flag"
```

## Task 7: Add automated web intake last

**Files:**
- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-web-policy.ts`
- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-web-fetch.ts`
- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-web-fixity.ts`
- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/lib/wordforge/oracle-web-intake.ts`
- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/scripts/oracle-web-intake.ts`
- Create: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/apps/core/__vitest__/wordforge-oracle-web-intake.test.ts`
- Modify: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os/package.json`

- [ ] **Step 1: Test the two-decision gate and intake-only capability**

```ts
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { decidePersistence } from '../lib/wordforge/oracle-web-policy';
import { writeIntakeCandidate } from '../lib/wordforge/oracle-web-intake';

describe('Oracle web intake', () => {
  it('stores no body when robots or rights are unknown', () => {
    expect(decidePersistence({ robots: 'unknown', rights: 'unknown' })).toEqual({ fetch_body: false, persist_body: false, state: 'quarantined' });
    expect(decidePersistence({ robots: 'allowed', rights: 'unknown' })).toEqual({ fetch_body: true, persist_body: false, state: 'candidate' });
  });

  it('writes a non-publishable record beneath the supplied intake root only', async () => {
    const intakeRoot = await mkdtemp(path.join(tmpdir(), 'oracle-intake-'));
    const target = await writeIntakeCandidate(intakeRoot, {
      schema_version: 'oracle.intake-candidate.v1', candidate_id: 'candidate-52-body-001',
      discovered_url: 'https://example.test/source', discovered_at: '2026-08-10T00:00:00.000Z',
      discovery_actor: 'oracle-web-intake/1', state: 'candidate', robots_decision: 'allowed',
      rights_decision: 'metadata-only', body_persisted: false, research_only: true, publishable: false,
    });
    expect(target).toContain('web-candidates/candidate-52-body-001/candidate.md');
    expect(await readFile(target, 'utf8')).toContain('publishable: false');
  });

  it('rejects traversal and publication paths', async () => {
    await expect(writeIntakeCandidate('/tmp/intake', { candidate_id: '../oracle/cards/52' } as never)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the intake test and confirm missing modules fail**

```bash
cd "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os"
npx vitest run apps/core/__vitest__/wordforge-oracle-web-intake.test.ts
```

Expected: FAIL because intake modules are absent.

- [ ] **Step 3: Implement independent robots and rights decisions**

```ts
export type RobotsDecision = 'allowed' | 'disallowed' | 'unavailable' | 'unknown';
export type RightsDecision = 'persist-full' | 'metadata-only' | 'blocked' | 'unknown';

export function decidePersistence(input: { robots: RobotsDecision; rights: RightsDecision }) {
  if (input.robots !== 'allowed') return { fetch_body: false, persist_body: false, state: 'quarantined' as const };
  if (input.rights === 'persist-full') return { fetch_body: true, persist_body: true, state: 'candidate' as const };
  if (input.rights === 'metadata-only' || input.rights === 'unknown') return { fetch_body: true, persist_body: false, state: 'candidate' as const };
  return { fetch_body: false, persist_body: false, state: 'blocked' as const };
}
```

- [ ] **Step 4: Implement public-network and redirect checks before body access**

```ts
import { isIP } from 'node:net';

export function assertPublicHttpUrl(raw: string): URL {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('only HTTP(S) is allowed');
  if (url.username || url.password) throw new Error('credentials are forbidden');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local')) throw new Error('private host is forbidden');
  if (isIP(host) && /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) throw new Error('private address is forbidden');
  return url;
}
```

Resolve DNS before each request and each redirect, apply the same private-address rejection to all returned addresses, use a fixed descriptive user agent, a response-size ceiling, and conditional `ETag`/`Last-Modified` headers. Tests inject the resolver and fetch function; unit tests never call the live web.

- [ ] **Step 5: Implement an exclusive intake writer**

```ts
import { mkdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';

export async function writeIntakeCandidate(intakeRoot: string, candidate: Record<string, unknown>): Promise<string> {
  const candidateId = String(candidate.candidate_id ?? '');
  if (!/^[a-z0-9][a-z0-9-]{2,79}$/.test(candidateId)) throw new Error('invalid candidate_id');
  if (candidate.research_only !== true || candidate.publishable !== false) throw new Error('research boundary required');
  const root = await realpath(intakeRoot);
  const directory = path.join(root, 'web-candidates', candidateId);
  const target = path.join(directory, 'candidate.md');
  if (!target.startsWith(`${root}${path.sep}`)) throw new Error('intake path escape');
  await mkdir(directory, { recursive: false });
  await writeFile(target, matter.stringify('', candidate), { encoding: 'utf8', flag: 'wx' });
  return target;
}
```

The CLI must require `ORACLE_INTAKE_ROOT=/Users/adrianrasmussen/Documents/Obsidian Vault/oracle/10-intake`; it must not accept `ORACLE_VAULT_ROOT` or a Mandala path as its write capability.

- [ ] **Step 6: Add script and run all intake checks**

Add:

```json
{
  "oracle:web-intake": "tsx apps/core/scripts/oracle-web-intake.ts"
}
```

Run:

```bash
cd "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os"
npx vitest run apps/core/__vitest__/wordforge-oracle-web-intake.test.ts
npm run typecheck
```

Expected: PASS; tests prove unavailable/disallowed robots, unknown rights, redirects to private addresses, path traversal, and repeated candidate IDs fail closed.

- [ ] **Step 7: Commit web intake as the final feature commit**

```bash
cd "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os"
git add package.json apps/core/lib/wordforge/oracle-web-policy.ts apps/core/lib/wordforge/oracle-web-fetch.ts apps/core/lib/wordforge/oracle-web-fixity.ts apps/core/lib/wordforge/oracle-web-intake.ts apps/core/scripts/oracle-web-intake.ts apps/core/__vitest__/wordforge-oracle-web-intake.test.ts
git commit -m "feat(wordforge): quarantine Oracle web discoveries"
```

## Task 8: Verify publication isolation and rollback

**Files:**
- Verify only: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/mandalacodes/oracle/cards`, `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/mandalacodes/oracle/manuscripts`, and `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/mandalacodes/oracle/editorial`
- Verify only: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/mandalacodes/data/oracle-corpus.json`
- Verify only: `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/mandalacodes/data/oracle-search-index.json`
- Verify only: `/Users/adrianrasmussen/Documents/Obsidian Vault/oracle-pre-evidence-foundation-2026-08-10`

- [ ] **Step 1: Run all focused WordForge tests and checks**

```bash
cd "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os"
npx vitest run apps/core/__vitest__/wordforge-oracle-research-schema.test.ts apps/core/__vitest__/wordforge-oracle-vault-audit.test.ts apps/core/__vitest__/wordforge-oracle-path-aliases.test.ts apps/core/__vitest__/wordforge-oracle-source-migration.test.ts apps/core/__vitest__/wordforge-oracle-source-manifest.test.ts apps/core/__vitest__/wordforge-oracle-assimilation-store.test.ts apps/core/__vitest__/wordforge-oracle-web-intake.test.ts apps/core/__vitest__/wordforge-oracle-production.test.ts
npm run typecheck
npm run check:migrations
ORACLE_VAULT_ROOT="/Users/adrianrasmussen/Documents/Obsidian Vault/oracle" npm run audit:oracle-vault -- --check
ORACLE_VAULT_ROOT="/Users/adrianrasmussen/Documents/Obsidian Vault/oracle" npm run verify:oracle-source-pilot
```

Expected: all tests and checks PASS; Card 52 BODY/CODE remain explicitly incomplete; no undeclared incomplete state is accepted.

- [ ] **Step 2: Verify Mandala artifacts are unchanged by research work**

```bash
cd "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/mandalacodes"
npm run test:unit -- tests/unit/cardMarkdown.test.ts tests/unit/oracleCorpus.test.ts tests/unit/oracleArtifacts.test.ts
npm run typecheck
npm run build:oracle-corpus
npm run build:search-index
git diff --exit-code -- oracle/cards oracle/manuscripts oracle/editorial data/oracle-corpus.json data/oracle-search-index.json
```

Expected: tests and typecheck PASS; the final diff is empty.

- [ ] **Step 3: Exercise flag-only WordForge rollback**

```bash
cd "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os"
ORACLE_RESEARCH_LAYOUT=legacy ORACLE_VAULT_ROOT="/Users/adrianrasmussen/Documents/Obsidian Vault/oracle" npm run verify:oracle-source-corpus
```

Expected: PASS with the current 64-card legacy result; no vault rewrite occurs.

- [ ] **Step 4: Document the data rollback procedure without executing it**

If a migrated batch fails hash, backlink, or consumer verification:

1. Set `ORACLE_RESEARCH_LAYOUT=legacy`.
2. Change affected entries in `00-system/path-aliases.json` from `active` to `quarantined`.
3. Move only the newly copied affected `20-sources/**` records into `90-archive/duplicates/<batch-id>/`; do not delete them.
4. Restore `00-system`, `30-cards`, and `40-work` affected files from `/Users/adrianrasmussen/Documents/Obsidian Vault/oracle-pre-evidence-foundation-2026-08-10`.
5. Re-run the legacy verifier and Mandala artifact-diff commands.

The untouched legacy source files are the primary rollback path. Aliases are one hop, generated source versions are immutable, and no discovery candidate is eligible to satisfy evidence readiness.

- [ ] **Step 5: Confirm the implementation repositories contain no unreviewed changes**

```bash
cd "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os"
git status --short
git diff --cached --check
cd "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/mandalacodes"
git status --short
```

Expected: no unreviewed implementation changes are present. If verification exposed a defect, return to the owning task, add a failing regression test, make the minimal repair, rerun that task's checks, and amend that task's commit before repeating Task 8.

## Completion criteria

- The auditor reports bodyless files and duplicates without mutating the vault.
- Card 52 cannot become ready because a path merely exists.
- Source identity is a version plus SHA-256, not a mutable path.
- Evidence atoms cite stable source versions and remain non-publishable.
- Migration copies before alias cutover and never deletes legacy material.
- Card 23 CODE and Card 52 BODY/CODE have explicit evidence/gap packets; no manuscript prose is generated.
- WordForge `v2` is opt-in and immediately reversible to legacy mode.
- Automated web discovery can write only into `10-intake/**` and cannot promote itself.
- Mandala cards and generated publication artifacts remain byte-for-byte unchanged.

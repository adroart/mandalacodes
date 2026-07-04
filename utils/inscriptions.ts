/**
 * Pure, I/O-free logic for Ring 1 legacy inscriptions + heirs (M3).
 *
 * Like utils/ledger.ts and utils/consent.ts, everything here is
 * deterministic and isomorphic — no fetch, no env, no R2, no D1 — so the
 * unit suite can pin the rules without mocking Cloudflare. The HTTP
 * handlers in functions/api/atlas/* compose these around the D1 binding
 * and the concurrency-safe R2 mutators.
 *
 * Invariants enforced here (the chain content invariant is law):
 *   - The `inscribed` chain event is built from a FIXED field set: id,
 *     pieceId, editionNumber?, type, date, actor, actorRef, inscriptionId,
 *     contentHash, inscriptionKind. The body NEVER enters a hashed payload.
 *   - contentHash is a salted commitment — SHA-256 over UTF-8 of
 *     (saltHex + body) — so deleting salt + body together (legal erasure)
 *     leaves a commitment that matches nothing recomputable.
 *   - Sealed entries (time capsules) hide their body from everyone but the
 *     author until the seal opens: a fixed ISO date, or the next
 *     `transferred` event on the chain ("a letter to whoever inherits").
 *   - Past authors are attributed by role + generation derived from the
 *     chain ("first steward", "second steward") — never by name or email.
 *   - Heir registrations are HINTS for the executor, mutable-storage only;
 *     emails never reach the chain or any public surface.
 */
import type {
  HeirRegistration,
  LedgerEvent,
  StewardRecord,
} from '../types';
import type { ParseResult } from './consent';

// ---------- Constants ----------

export const INSCRIPTION_KINDS = ['intention', 'story', 'dedication'] as const;
export type InscriptionKind = (typeof INSCRIPTION_KINDS)[number];

/** Longest inscription body we accept. Same ceiling as the claim ritual. */
export const INSCRIPTION_MAX_LENGTH = 2000;

/** Sentinel stored in sealed_until for "sealed until the piece is passed
 *  on" — opened by the next `transferred` event dated after the entry. */
export const SEAL_UNTIL_TRANSFER = 'transfer';

// ---------- Input validation (whitelist discipline) ----------

export interface InscriptionInput {
  kind: InscriptionKind;
  body: string;
  /** ISO date (time capsule) or SEAL_UNTIL_TRANSFER. Absent = open. */
  sealedUntil?: string;
}

function isIsoDate(value: string): boolean {
  // YYYY-MM-DD or full ISO timestamp; must parse to a real date.
  if (!/^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/.test(value)) {
    return false;
  }
  return !Number.isNaN(Date.parse(value));
}

/**
 * Strictly validate the inscription fields of a POST /inscribe body.
 * Exactly these client fields are accepted: kind, body, sealedUntil,
 * sealUntilTransfer. Anything else is rejected — the server, not the
 * client, decides what reaches D1 and the chain.
 * (pieceId / editionNumber are routing fields validated by the handler.)
 */
export function parseInscriptionInput(
  value: unknown,
): ParseResult<InscriptionInput> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'inscription must be an object' };
  }
  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (
      key !== 'kind' &&
      key !== 'body' &&
      key !== 'sealedUntil' &&
      key !== 'sealUntilTransfer'
    ) {
      return { ok: false, error: `inscription: unknown field "${key}"` };
    }
  }
  if (
    typeof obj.kind !== 'string' ||
    !(INSCRIPTION_KINDS as readonly string[]).includes(obj.kind)
  ) {
    return {
      ok: false,
      error: `kind must be one of: ${INSCRIPTION_KINDS.join(', ')}`,
    };
  }
  if (typeof obj.body !== 'string') {
    return { ok: false, error: 'body must be a string' };
  }
  const body = obj.body.trim();
  if (!body) return { ok: false, error: 'body must not be empty' };
  if (body.length > INSCRIPTION_MAX_LENGTH) {
    return {
      ok: false,
      error: `body must be at most ${INSCRIPTION_MAX_LENGTH} characters`,
    };
  }

  const sealFlag = obj.sealUntilTransfer;
  if (sealFlag !== undefined && typeof sealFlag !== 'boolean') {
    return { ok: false, error: 'sealUntilTransfer must be a boolean' };
  }
  let sealedUntil: string | undefined;
  if (sealFlag === true) {
    if (obj.sealedUntil !== undefined) {
      return {
        ok: false,
        error: 'choose sealedUntil OR sealUntilTransfer, not both',
      };
    }
    sealedUntil = SEAL_UNTIL_TRANSFER;
  } else if (obj.sealedUntil !== undefined) {
    if (typeof obj.sealedUntil !== 'string' || !isIsoDate(obj.sealedUntil)) {
      return { ok: false, error: 'sealedUntil must be an ISO date' };
    }
    sealedUntil = obj.sealedUntil;
  }

  return {
    ok: true,
    value: {
      kind: obj.kind as InscriptionKind,
      body,
      ...(sealedUntil !== undefined ? { sealedUntil } : {}),
    },
  };
}

// ---------- Salted content commitment ----------

/** Random 16-byte salt as lowercase hex. Stored beside the body in D1 and
 *  deleted with it on legal erasure. */
export function generateSaltHex(): string {
  const rnd = crypto.getRandomValues(new Uint8Array(16));
  let hex = '';
  for (let i = 0; i < rnd.length; i++) hex += rnd[i].toString(16).padStart(2, '0');
  return hex;
}

/**
 * The salted commitment that goes into the hashed chain payload:
 * SHA-256 over the UTF-8 bytes of (saltHex + body), lowercase hex.
 * Without the salt, the commitment cannot be matched against any
 * recomputable value — that is exactly the erasure property we need.
 */
export async function computeContentHash(
  saltHex: string,
  body: string,
): Promise<string> {
  const data = new TextEncoder().encode(saltHex + body);
  const buf = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(buf);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

export function genInscriptionId(): string {
  const rnd = crypto.getRandomValues(new Uint8Array(10));
  let hex = '';
  for (let i = 0; i < rnd.length; i++) hex += rnd[i].toString(16).padStart(2, '0');
  return `ins-${Date.now().toString(36)}-${hex}`;
}

/** Deterministic id for the migrated pendingFirstInscription — the
 *  idempotency anchor of the M2 → M3 conversion. Scoped per (chain key,
 *  author): a piece that changes hands can carry one ritual answer per
 *  steward, and without the author in the id a second steward's answer
 *  would collide with the first steward's converted row and be silently
 *  dropped. authorRef is the opaque auth userId — already on the chain
 *  as the event's actorRef, so the id leaks nothing new. */
export function pendingInscriptionId(
  pieceId: string,
  editionNumber: number | undefined,
  authorRef: string,
): string {
  return `ins-first-${pieceId}-${editionNumber ?? 0}-${authorRef}`;
}

// ---------- Chain event drafting (fixed field set) ----------

export interface InscribedDraftOptions {
  pieceId: string;
  editionNumber?: number;
  /** Opaque auth userId — never an email or name. */
  actorRef: string;
  /** ISO now — the event date is when the commitment lands on the chain,
   *  not necessarily when the entry was authored (migrated entries keep
   *  their authoring time in D1 created_at). */
  now: string;
  inscriptionId: string;
  contentHash: string;
  inscriptionKind: InscriptionKind;
  eventId?: string;
}

/**
 * Build the `inscribed` event draft. NOTHING else may ride along — the
 * field set is exactly: id, pieceId, editionNumber?, type, date, actor,
 * actorRef, inscriptionId, contentHash, inscriptionKind. The body, the
 * salt, and any names/emails stay out of the hashed payload forever.
 */
export function buildInscribedDraft(
  opts: InscribedDraftOptions,
): Omit<LedgerEvent, 'hash' | 'prevHash'> {
  return {
    id: opts.eventId ?? genEventIdLocal(),
    pieceId: opts.pieceId,
    ...(opts.editionNumber !== undefined
      ? { editionNumber: opts.editionNumber }
      : {}),
    type: 'inscribed',
    date: opts.now,
    actor: 'steward',
    actorRef: opts.actorRef,
    inscriptionId: opts.inscriptionId,
    contentHash: opts.contentHash,
    inscriptionKind: opts.inscriptionKind,
  };
}

function genEventIdLocal(): string {
  const rnd = crypto.getRandomValues(new Uint8Array(10));
  let hex = '';
  for (let i = 0; i < rnd.length; i++) hex += rnd[i].toString(16).padStart(2, '0');
  return `evt-${Date.now().toString(36)}-${hex}`;
}

// ---------- D1 row shape ----------

/** atlas_inscriptions row as D1 returns it (snake_case). */
export interface InscriptionRow {
  id: string;
  piece_id: string;
  edition_number: number;
  author_clerk_id: string | null;
  kind: string;
  body: string | null;
  body_hash: string;
  content_salt: string | null;
  sealed_until: string | null;
  created_at: string;
  erased_at: string | null;
  erase_reason?: string | null;
}

// ---------- Seal semantics ----------

/**
 * Is this entry's seal still closed at `nowIso`, given the piece's chain?
 *   - sealed_until = ISO date  → closed while now < that date.
 *   - sealed_until = 'transfer' → closed until a `transferred` event dated
 *     after the entry's created_at exists (a letter to the inheritor).
 * The AUTHOR always reads their own entry regardless (handled by the
 * caller via projectInscription).
 */
export function isSealClosed(
  row: Pick<InscriptionRow, 'sealed_until' | 'created_at'>,
  chain: readonly LedgerEvent[],
  nowIso: string,
): boolean {
  if (!row.sealed_until) return false;
  if (row.sealed_until === SEAL_UNTIL_TRANSFER) {
    return !chain.some(
      (e) => e.type === 'transferred' && e.date > row.created_at,
    );
  }
  return nowIso < row.sealed_until;
}

/** Human label for a closed seal — shown instead of the body. */
export function sealLabel(sealedUntil: string): string {
  if (sealedUntil === SEAL_UNTIL_TRANSFER) {
    return 'sealed until the piece is passed on';
  }
  return `sealed until ${sealedUntil.slice(0, 10)}`;
}

// ---------- Role + generation attribution ----------

/**
 * Derive the ordered list of steward refs (generations) from a chain:
 * the first `claimed` event's actorRef opens generation 1; every
 * `transferred` event's toRef begins the next. Opaque refs only — this is
 * what lets a future holder read "first steward wrote…" with no name or
 * email anywhere.
 */
export function deriveStewardGenerations(
  chain: readonly LedgerEvent[],
): string[] {
  const generations: string[] = [];
  for (const e of chain) {
    if (e.type === 'claimed' && e.actorRef && generations.length === 0) {
      generations.push(e.actorRef);
    } else if (e.type === 'transferred') {
      // A transfer recorded before any claim still names the outgoing
      // steward — anchor generation 1 on fromRef when we have nothing else.
      if (generations.length === 0 && e.fromRef) generations.push(e.fromRef);
      if (e.toRef && generations[generations.length - 1] !== e.toRef) {
        generations.push(e.toRef);
      }
    }
  }
  return generations;
}

const ORDINAL_WORDS = [
  'first', 'second', 'third', 'fourth', 'fifth',
  'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
];

/** 1 → 'first steward', 2 → 'second steward', 11 → 'steward 11'. */
export function stewardOrdinalLabel(generation: number): string {
  const word = ORDINAL_WORDS[generation - 1];
  return word ? `${word} steward` : `steward ${generation}`;
}

/**
 * Attribute an inscription's author for the current viewer. 'you' for the
 * viewer's own entries; role + generation for anyone else; a neutral
 * fallback when the chain can't place the ref. Never a name or email.
 */
export function attributionFor(
  authorRef: string | null,
  viewerRef: string,
  chain: readonly LedgerEvent[],
): string {
  if (authorRef && authorRef === viewerRef) return 'you';
  if (!authorRef) return 'a previous steward';
  const generations = deriveStewardGenerations(chain);
  const idx = generations.indexOf(authorRef);
  if (idx === -1) return 'a previous steward';
  return stewardOrdinalLabel(idx + 1);
}

// ---------- Read projection (visibility rules) ----------

/** Steward-facing view of one inscription. Tombstones and closed seals
 *  carry no body; the contentHash is included so an exported book can be
 *  checked against the chain's commitments. */
export interface InscriptionView {
  id: string;
  kind: InscriptionKind;
  createdAt: string;
  state: 'readable' | 'sealed' | 'erased';
  /** 'you' | 'first steward' | … — never a name or email. */
  attribution: string;
  authoredByYou: boolean;
  /** Present only when state is 'readable' (or sealed-but-author). */
  body?: string;
  sealedUntil?: string;
  /** "sealed until 2030-06-01" / "sealed until the piece is passed on". */
  sealedLabel?: string;
  contentHash: string;
  /** True when a LIVE shared-intention entry (M6, Lens 2 — the map of
   *  dreams; see utils/intentions.ts) currently mirrors this inscription.
   *  Lets the keeper's book render its share toggle as already-on after a
   *  reload, without a second round trip. Always present (never undefined)
   *  so callers can rely on the field rather than an optional check. */
  shared: boolean;
}

/**
 * Project a D1 row into what THIS viewer may see:
 *   - erased rows → tombstone ("[entry removed]" rendering; no body, no
 *     salt, no erase_reason — that audit note is admin-only),
 *   - closed seals → label without the body, unless the viewer authored it,
 *   - everything else → readable. The history lives with the piece: every
 *     current steward reads all open entries, whoever wrote them.
 *
 * @param liveSharedInscriptionIds  Optional set of inscription ids that
 *   currently have a LIVE shared-intention entry (M6, Lens 2). Absent set =
 *   every row projects shared: false — callers that don't pass it (or don't
 *   care) get the same behavior as before this field existed.
 */
export function projectInscription(
  row: InscriptionRow,
  viewerRef: string,
  chain: readonly LedgerEvent[],
  nowIso: string,
  liveSharedInscriptionIds?: ReadonlySet<string>,
): InscriptionView {
  const kind = (INSCRIPTION_KINDS as readonly string[]).includes(row.kind)
    ? (row.kind as InscriptionKind)
    : 'story';
  const authoredByYou = row.author_clerk_id === viewerRef;
  const base = {
    id: row.id,
    kind,
    createdAt: row.created_at,
    attribution: attributionFor(row.author_clerk_id, viewerRef, chain),
    authoredByYou,
    contentHash: row.body_hash,
    shared: liveSharedInscriptionIds?.has(row.id) ?? false,
  };

  if (row.erased_at || row.body === null) {
    return { ...base, state: 'erased' };
  }

  if (isSealClosed(row, chain, nowIso)) {
    return {
      ...base,
      state: 'sealed',
      sealedUntil: row.sealed_until ?? undefined,
      sealedLabel: sealLabel(row.sealed_until ?? ''),
      // The author may always reread their own letter.
      ...(authoredByYou ? { body: row.body } : {}),
    };
  }

  return {
    ...base,
    state: 'readable',
    body: row.body,
    ...(row.sealed_until ? { sealedUntil: row.sealed_until } : {}),
  };
}

// ---------- pendingFirstInscription conversion (M2 → M3) ----------

/**
 * Plan the conversion of a steward record's pendingFirstInscription into
 * the real model. Pure decision logic — the handler executes the steps.
 * Idempotent by construction:
 *   - the D1 row id is deterministic (pendingInscriptionId), so a re-run
 *     finds the existing row instead of inserting a duplicate,
 *   - the chain event is only planned when no `inscribed` event with that
 *     inscriptionId exists yet,
 *   - the record field is only cleared once both sides are in place.
 */
export interface PendingConversionPlan {
  inscriptionId: string;
  /** Insert the D1 row (kind 'intention', created_at = authoring time). */
  insertRow: boolean;
  /** Append the `inscribed` event (dated NOW, commitment from the row). */
  appendEvent: boolean;
  /** Remove pendingFirstInscription from the steward record. */
  clearField: boolean;
}

export function planPendingConversion(
  record: Pick<StewardRecord, 'pieceId' | 'editionNumber' | 'pendingFirstInscription' | 'clerkUserId'>,
  rowExists: boolean,
  chain: readonly LedgerEvent[],
): PendingConversionPlan | null {
  if (!record.pendingFirstInscription || !record.clerkUserId) return null;
  const inscriptionId = pendingInscriptionId(
    record.pieceId,
    record.editionNumber,
    record.clerkUserId,
  );
  const eventExists = chain.some(
    (e) => e.type === 'inscribed' && e.inscriptionId === inscriptionId,
  );
  // No chain yet (piece not seeded): leave the pending field in place so a
  // later visit converts it once the commitment can actually land.
  const chainReady = chain.length > 0;
  return {
    inscriptionId,
    insertRow: !rowExists,
    appendEvent: chainReady && !eventExists,
    clearField: chainReady,
  };
}

// ---------- Heir registrations ----------

const HEIR_NAME_MAX = 200;

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export interface HeirInput {
  email: string;
  name?: string;
}

/** Validate an add-heir payload: email (required, shape-checked) + optional
 *  name. Whitelist discipline — unknown fields rejected. */
export function parseHeirInput(value: unknown): ParseResult<HeirInput> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'heir must be an object' };
  }
  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (key !== 'email' && key !== 'name') {
      return { ok: false, error: `heir: unknown field "${key}"` };
    }
  }
  const email = typeof obj.email === 'string' ? obj.email.trim() : '';
  if (!email || !isValidEmail(email)) {
    return { ok: false, error: 'heir: missing or invalid email' };
  }
  if (obj.name !== undefined && typeof obj.name !== 'string') {
    return { ok: false, error: 'heir: name must be a string' };
  }
  const name = typeof obj.name === 'string' ? obj.name.trim() : '';
  if (name.length > HEIR_NAME_MAX) {
    return { ok: false, error: `heir: name must be at most ${HEIR_NAME_MAX} characters` };
  }
  return { ok: true, value: { email, ...(name ? { name } : {}) } };
}

/** Add a (pending) heir registration. Rejects a duplicate non-revoked
 *  registration for the same email. */
export function addHeir(
  record: StewardRecord,
  input: HeirInput,
  registeredBy: string,
  now: string,
): ParseResult<StewardRecord> {
  const heirs = record.heirs ?? [];
  const normalized = input.email.toLowerCase();
  const existing = heirs.find(
    (h) => h.email.toLowerCase() === normalized && h.status !== 'revoked',
  );
  if (existing) {
    return { ok: false, error: 'This heir is already registered' };
  }
  const heir: HeirRegistration = {
    email: input.email,
    ...(input.name ? { name: input.name } : {}),
    registeredAt: now,
    registeredBy,
    status: 'pending',
  };
  return { ok: true, value: { ...record, heirs: [...heirs, heir] } };
}

/** Revoke every non-revoked registration matching the email. */
export function revokeHeir(
  record: StewardRecord,
  email: string,
): ParseResult<StewardRecord> {
  const heirs = record.heirs ?? [];
  const normalized = email.trim().toLowerCase();
  let touched = false;
  const next = heirs.map((h) => {
    if (h.email.toLowerCase() !== normalized || h.status === 'revoked') return h;
    touched = true;
    return { ...h, status: 'revoked' as const };
  });
  if (!touched) {
    return { ok: false, error: 'No registered heir matches that email' };
  }
  return { ok: true, value: { ...record, heirs: next } };
}

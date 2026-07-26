/**
 * Make requests — "Begin your piece" (the commission door, 2026-07-26).
 *
 * A signed-in visitor asks the studio to make a piece: which code (or which
 * existing design they started from), what size, what palette, and anything
 * else. This binds nothing and promises nothing: it appends a pending note
 * to a mutable queue that Adrian reads and answers by email. It never
 * touches the ledger, the public projection, or the mirror.
 *
 * Pure module: shape/length validation and record planning only, so the
 * logic is testable without any data import. Storage lives in
 * functions/api/atlas/_make.ts; endpoints in functions/api/atlas/make/.
 */

export const MAKE_MAX_SIZE = 80;
export const MAKE_MAX_PALETTE = 300;
export const MAKE_MAX_NOTE = 1000;
/** A gentle ceiling: conversations, not carts. */
export const MAKE_MAX_OPEN_PER_REQUESTER = 3;

/** 'answered' means Adrian replied by email; the queue only tracks that the
 *  note was handled, the conversation itself lives in mail. */
export type MakeRequestStatus = 'pending' | 'answered' | 'dismissed';

export interface MakeRequest {
  id: string;
  /** Opaque auth userId of the person beginning a piece. */
  requesterRef: string;
  /** Their email from the verified session — where Adrian replies. */
  requesterEmail: string;
  /** The piece page they began from, when they came via one. */
  pieceId?: string;
  /** The Universal Language code (1..64) they chose, when they chose one. */
  code?: number;
  /** The size they want — one of the offered sizes or their own words. */
  size: string;
  /** Palette / woods / the room it will live in. Free text. */
  palette?: string;
  /** Anything else for the studio. */
  note?: string;
  /** Server-stamped ISO timestamp. */
  createdAt: string;
  status: MakeRequestStatus;
  /** Stamped on resolution. resolvedBy is an opaque admin auth userId. */
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface MakeInput {
  pieceId?: string;
  code?: number;
  size: string;
  palette?: string;
  note?: string;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** Validate and normalize the client body of a make request. */
export function parseMakeInput(body: unknown): Parsed<MakeInput> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Invalid submission' };
  }
  const obj = body as Record<string, unknown>;

  const size = typeof obj.size === 'string' ? obj.size.trim() : '';
  if (!size) {
    return { ok: false, error: 'Choose a size, or describe your own' };
  }
  if (size.length > MAKE_MAX_SIZE) {
    return { ok: false, error: 'That size is longer than this field can hold' };
  }

  let pieceId: string | undefined;
  if (obj.pieceId !== undefined) {
    if (typeof obj.pieceId !== 'string') {
      return { ok: false, error: 'Invalid piece' };
    }
    const trimmed = obj.pieceId.trim();
    if (trimmed.length > 64) return { ok: false, error: 'Invalid piece' };
    if (trimmed) pieceId = trimmed;
  }

  let code: number | undefined;
  if (obj.code !== undefined && obj.code !== null && obj.code !== '') {
    const n =
      typeof obj.code === 'number'
        ? obj.code
        : typeof obj.code === 'string'
          ? parseInt(obj.code, 10)
          : NaN;
    if (!Number.isInteger(n) || n < 1 || n > 64) {
      return { ok: false, error: 'The code is a number from 1 to 64' };
    }
    code = n;
  }

  let palette: string | undefined;
  if (obj.palette !== undefined) {
    if (typeof obj.palette !== 'string') {
      return { ok: false, error: 'Invalid palette' };
    }
    const trimmed = obj.palette.trim();
    if (trimmed.length > MAKE_MAX_PALETTE) {
      return { ok: false, error: 'That palette note is longer than this field can hold' };
    }
    if (trimmed) palette = trimmed;
  }

  let note: string | undefined;
  if (obj.note !== undefined) {
    if (typeof obj.note !== 'string') {
      return { ok: false, error: 'Invalid note' };
    }
    const trimmed = obj.note.trim();
    if (trimmed.length > MAKE_MAX_NOTE) {
      return { ok: false, error: 'That note is longer than this field can hold' };
    }
    if (trimmed) note = trimmed;
  }

  return {
    ok: true,
    value: {
      size,
      ...(pieceId ? { pieceId } : {}),
      ...(code !== undefined ? { code } : {}),
      ...(palette ? { palette } : {}),
      ...(note ? { note } : {}),
    },
  };
}

export interface PlanMakeArgs {
  input: MakeInput;
  requesterRef: string;
  requesterEmail: string;
  id: string;
  now: string;
}

/**
 * Build the pending request record, re-validating the per-requester
 * open-count ceiling against the freshest list (call this INSIDE the
 * concurrency-safe mutator so a retry re-applies the guard).
 */
export function planMakeRequest(
  existing: readonly MakeRequest[],
  args: PlanMakeArgs,
): Parsed<MakeRequest> {
  const openForRequester = existing.filter(
    (r) => r.requesterRef === args.requesterRef && r.status === 'pending',
  ).length;
  if (openForRequester >= MAKE_MAX_OPEN_PER_REQUESTER) {
    return {
      ok: false,
      error: `You can have at most ${MAKE_MAX_OPEN_PER_REQUESTER} notes with the studio at once`,
    };
  }

  const record: MakeRequest = {
    id: args.id,
    requesterRef: args.requesterRef,
    requesterEmail: args.requesterEmail,
    ...(args.input.pieceId ? { pieceId: args.input.pieceId } : {}),
    ...(args.input.code !== undefined ? { code: args.input.code } : {}),
    size: args.input.size,
    ...(args.input.palette ? { palette: args.input.palette } : {}),
    ...(args.input.note ? { note: args.input.note } : {}),
    createdAt: args.now,
    status: 'pending',
  };
  return { ok: true, value: record };
}

/**
 * Courtesy email copy for atlas letters — the ratified notification-channel
 * decision (todo/handoff/GO-LIVE-RUNBOOK.md, "Decision records (2026-07-02)":
 * "Notification channel: use Resend (already provisioned)"). Mirrors the
 * Resend fetch pattern lib/account/auth.server.js uses for Better Auth
 * sign-in codes, but deliberately does NOT import from it — that file is a
 * Better Auth config module built per-request from a different env shape;
 * this is a Pages Function helper and the two must stay decoupled.
 *
 * The in-product letter (atlas/letters.json, see utils/letters.ts) remains
 * the canonical record — this is a courtesy copy only. Fire-and-forget by
 * design (living-art-legacy.md amendment + decision 6): a send failure must
 * NEVER fail or delay the letter write or the API response that triggered
 * it, so every error here is swallowed, at most logged with console.warn.
 * No retries. If RESEND_API_KEY is unset, this is a silent no-op — the same
 * convention lib/account/auth.server.js uses for local dev without a key.
 *
 * No delivery state is persisted anywhere (no schema/type change — letters
 * stay exactly what's in types.ts today) and there is no unsubscribe
 * machinery: these are rare, transactional, piece-voice letters, sent only
 * to the steward's own bound email (the letter's recipient) — never to a
 * third party. Kin-claim letters reference other pieces by public city +
 * shared trigram only (see utils/letters.ts body discipline), so there is
 * no third-party PII to leak into an email either.
 */
import type { LetterKind } from '../../../types';

const DEFAULT_FROM = 'noreply@mandalacodes.com';
const STEWARD_PAGE_URL = 'https://mandalacodes.com/atlas/edit';
const CLAIM_PAGE_URL = 'https://mandalacodes.com/atlas/claim';

/** The env fields this helper needs, typed locally (AuthEnv-style) so this
 *  module never imports from lib/account/auth.server.js or
 *  functions/api/_lib/auth.ts. Matches the RESEND_* secrets documented at
 *  the top of auth.server.js — same key, same convention. */
export interface LetterEmailEnv {
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
}

export interface SendLetterEmailInput {
  /** The steward's own bound email — the letter's recipient, and only ever
   *  that. Never a third party. */
  to: string;
  subject: string;
  /** Plain-text letter body (already includes the steward-page line — see
   *  letterEmailBody). */
  body: string;
}

/**
 * Subject line per letter kind, in the site's voice: minimal, no em dashes,
 * a middle-dot separating the category clause from the piece's own framing.
 */
export function letterEmailSubject(kind: LetterKind): string {
  switch (kind) {
    case 'kin-claim':
      return 'A letter from your piece · a kin has come to light';
    case 'anniversary':
      return 'A letter from your piece · an anniversary';
    case 'transfer':
      return 'A letter from your piece · new hands';
    case 'words-anniversary':
      return 'A letter from your piece · shall it keep carrying your words';
    default:
      return 'A letter from your piece';
  }
}

/**
 * Plain-text body: the letter's own prose plus one line back to the
 * steward's page. No HTML, no unsubscribe link, no delivery tracking.
 */
export function letterEmailBody(letterBody: string): string {
  return (
    `${letterBody}\n\n` +
    `·\n\n` +
    `Read this letter, and everything else your piece has written, at\n` +
    `${STEWARD_PAGE_URL}`
  );
}

/**
 * The two hand-off moments that invite someone to /atlas/claim:
 *   'sale': Adrian confirmed a sale; the buyer's email now seeds the
 *           piece's steward record and Phase A will match it.
 *   'request-approved': a holder or admin approved a stewardship request;
 *           the record is bound to the requester already.
 */
export type ClaimInviteKind = 'sale' | 'request-approved';

/**
 * Subject line per invite kind. Same conventions as letterEmailSubject:
 * the site's voice, no em dashes, a middle-dot separator.
 */
export function claimInviteEmailSubject(kind: ClaimInviteKind): string {
  switch (kind) {
    case 'sale':
      return 'Your piece has a living book · come claim it';
    case 'request-approved':
      return 'Your stewardship request was approved · the book opens to you';
  }
}

/**
 * Plain-text invite body: what the book is, the one link that opens it, and
 * the privacy promise. No HTML, no unsubscribe link, no delivery tracking.
 * Copy is DRAFT pending Adrian's voice sign-off.
 */
export function claimInviteEmailBody(
  kind: ClaimInviteKind,
  pieceTitle?: string,
): string {
  if (kind === 'sale') {
    const title = pieceTitle ?? 'your piece';
    return (
      `The piece you now hold, ${title}, keeps a living book: its story,\n` +
      `its place on the map, the words it will carry forward.\n\n` +
      `That book is yours to open. Sign in with this email address, the one your piece was\n` +
      `registered to, and it will know you:\n\n` +
      `${CLAIM_PAGE_URL}\n\n` +
      `Only your city ever appears publicly, never an address, and you can keep the piece\n` +
      `entirely private. The book waits either way.\n\n` +
      `Adrian Rasmussen`
    );
  }
  const title = pieceTitle ?? 'this piece';
  return (
    `Your request to steward ${title} was approved. The book is open\n` +
    `to you now.\n\n` +
    `Sign in with this email address to complete the claim:\n\n` +
    `${CLAIM_PAGE_URL}\n\n` +
    `You will be asked one question about whether the piece appears on the public map.\n` +
    `Only your city ever shows, never an address, and private is always an answer.\n\n` +
    `Adrian Rasmussen`
  );
}

/**
 * Send a courtesy email copy of a letter via Resend, mirroring the fetch
 * call lib/account/auth.server.js makes for sign-in codes (same endpoint,
 * same auth header shape, same `from`/`to`/`subject`/`text` body). Every
 * failure mode — missing key, network error, non-2xx response — is
 * swallowed inside this function, so a caller can fire it without awaiting
 * or wrapping it in its own try/catch.
 */
export async function sendLetterEmail(
  env: LetterEmailEnv,
  input: SendLetterEmailInput,
): Promise<void> {
  if (!env.RESEND_API_KEY) return; // no key configured — silent no-op
  if (!input.to) return;
  try {
    const fromEmail = env.RESEND_FROM_EMAIL || DEFAULT_FROM;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Adrian Rasmussen Art <${fromEmail}>`,
        to: [input.to],
        subject: input.subject,
        text: input.body,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`[atlas letters] Resend send failed (${res.status}): ${errText}`);
    }
  } catch (err) {
    console.warn('[atlas letters] Resend send threw', err);
  }
}

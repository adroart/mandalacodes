/**
 * POST /api/atlas/steward/claim — the two-phase claim (M2).
 *
 * Signed-in via the self-owned Better Auth session cookie; identity always
 * comes from the verified session. The phase is selected by the body:
 *
 * Phase A — no `consent` in the body (or no body at all, the pre-M2 shape):
 *   Bind. We look up steward records matching the auth userId or — only when
 *   the session's email is verified — the email (unbound email matches merge
 *   with userId matches, so one collector can bind several pieces), bind the
 *   userId on first match, and return the piece(s) they steward. Each entry carries `needsConsent: true` when the
 *   record has no captured consent yet. outreachStatus is NOT flipped here
 *   — 'claimed' gates on consent capture, not on the bind.
 *
 * Phase B — body carries `consent` (and optionally `firstInscription`):
 *   Consent capture. The consent input is validated with whitelist
 *   discipline (only `ring2MapPresence`; unknown fields rejected), stamped
 *   server-side (version / capturedAt / capturedBy), written onto every
 *   matched record (+ pushed onto consentHistory), and outreachStatus flips
 *   to 'claimed'. Then, per piece: a `claimed` chain event is appended if
 *   the chain has none yet (first claim per chain only — the Founding
 *   Lights ordinal source), and the Ring 2 choice is applied through the
 *   existing withdrawn/revealed event semantics. Public state regenerates
 *   afterwards. The optional `firstInscription` is stored as
 *   `pendingFirstInscription` on the steward record — mutable, private,
 *   never in any hashed payload (M3 migrates it into the real inscription
 *   model).
 *
 * All mutations run inside the concurrency-safe mutators; lookups and
 * validation re-run inside the closures so retries re-validate.
 *
 * Responses are steward-facing: admin-only `notes` and admin-authored event
 * `note`s are stripped; `pendingFirstInscription` is only ever returned to
 * its author.
 */

import type { LedgerEvent, PieceRecord, StewardRecord } from '../../../../types';
import { projectAll } from '../../../../utils/ledgerProjection';
import { groupChains, BackdatedEventError } from '../../../../utils/ledger';
import {
  applyConsentToSteward,
  bindStewardOnClaim,
  nextConsentState,
  parseConsentInput,
  parseFirstInscription,
  planClaimChainEvents,
} from '../../../../utils/consent';
import { publishFirstDreamsOnClaim } from '../_firstDream';
import type { PagesContext } from '../_helpers';
import {
  findStewardsForUser,
  json,
  mutateLedger,
  mutateStewards,
  readLedger,
  regeneratePublicState,
  sanitizeEventsForSteward,
  toStewardView,
} from '../_helpers';
import { requireUser, isAuthResponse } from '../../_lib/auth';
import { generateKinClaimLetters } from '../_letters';
import { letterRecipientKey } from '../../../../utils/letters';
import { creatorMessageFor } from '../_creatorMessages';

interface ClaimedPiece {
  steward: Omit<StewardRecord, 'notes'>;
  piece: PieceRecord | null;
  /** True while the record awaits its consent capture (Phase B). */
  needsConsent: boolean;
}

const NO_RECORD_ERROR =
  'No steward record is bound to your account. Ask Adrian to add you (he needs the email you signed in with).';

const UNVERIFIED_EMAIL_ERROR =
  'Confirm your email before claiming a piece — sign in with the emailed code (or Continue with Google) so we can verify the address a piece may be issued to.';

function findRecord(
  events: LedgerEvent[],
  pieceId: string,
  editionNumber?: number,
): PieceRecord | undefined {
  const records = projectAll(events);
  const key = `${pieceId}:${editionNumber ?? 0}`;
  return records.get(key);
}

/** Steward-facing copy of a projected piece: admin event notes removed. */
function sanitizePiece(piece: PieceRecord | undefined): PieceRecord | null {
  if (!piece) return null;
  return { ...piece, history: sanitizeEventsForSteward(piece.history) };
}

function buildClaimedResponse(
  stewards: readonly StewardRecord[],
  events: LedgerEvent[],
  userId: string,
  /** Phase B only: fold in the creator's message for the primary claimed
   *  piece so the ceremony can reveal it in its final beat, after ignition.
   *  Never sent in Phase A: the message is a ceremony payload, not a
   *  binding fact, and must never surface before the light is lit. */
  includeCreatorMessage = false,
): Response {
  const claimed: ClaimedPiece[] = stewards
    .filter((s) => s.clerkUserId === userId)
    .map((s) => ({
      steward: toStewardView(s, userId),
      piece: sanitizePiece(findRecord(events, s.pieceId, s.editionNumber)),
      needsConsent: !s.consent,
    }));
  // The ceremony shows the first entry awaiting consent (else the first
  // claimed); key the message to that same piece so the two never diverge.
  const primary = claimed.find((c) => c.needsConsent) ?? claimed[0];
  const creatorMessage =
    includeCreatorMessage && primary
      ? creatorMessageFor(primary.steward.pieceId)
      : undefined;
  return json({
    ok: true,
    claimed,
    needsConsent: claimed.some((c) => c.needsConsent),
    ...(creatorMessage ? { creatorMessage } : {}),
  });
}

export async function onRequestPost(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  const auth = await requireUser(request, env);
  if (isAuthResponse(auth)) return auth;
  // Captured by the mutator closures — TS doesn't carry the narrowing of
  // `auth` into nested functions.
  const userId = auth.userId;
  const email = auth.email;
  const emailVerified = auth.emailVerified;

  // The pre-M2 client sent no body at all; an empty body is Phase A.
  let body: Record<string, unknown> = {};
  const raw = await request.text();
  if (raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return json({ ok: false, error: 'Body must be a JSON object' }, 400);
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return json({ ok: false, error: 'Invalid JSON' }, 400);
    }
  }

  const now = new Date().toISOString();

  // ---------- Phase A: bind only ----------
  if (!('consent' in body)) {
    const outcome = await mutateStewards(env, (stewards) => {
      const matches = findStewardsForUser(stewards, userId, email, emailVerified);
      if (matches.length === 0) {
        return json(
          { ok: false, error: emailVerified ? NO_RECORD_ERROR : UNVERIFIED_EMAIL_ERROR },
          emailVerified ? 404 : 403,
        );
      }
      const next = stewards.map((s) =>
        matches.includes(s) ? bindStewardOnClaim(s, userId, now) : s,
      );
      return { next, result: undefined };
    });
    if (outcome instanceof Response) return outcome;

    const events = await readLedger(env);
    return buildClaimedResponse(outcome.next, events, userId);
  }

  // ---------- Phase B: consent capture ----------

  // Whitelist the top-level body too — nothing but the two documented
  // fields may ride along with a consent capture.
  for (const key of Object.keys(body)) {
    if (key !== 'consent' && key !== 'firstInscription') {
      return json({ ok: false, error: `Unknown field "${key}"` }, 400);
    }
  }
  const consentInput = parseConsentInput(body.consent);
  if (!consentInput.ok) {
    return json({ ok: false, error: consentInput.error }, 400);
  }
  const inscription = parseFirstInscription(body.firstInscription);
  if (!inscription.ok) {
    return json({ ok: false, error: inscription.error }, 400);
  }
  const ring2MapPresence = consentInput.value.ring2MapPresence;

  // 1. Steward records: stamp consent (server-side version/capturedAt/
  //    capturedBy), push history, flip outreachStatus to 'claimed', store
  //    the ritual answer once. The lookup re-runs inside the mutator so a
  //    retry re-validates against fresh state.
  const stewardOutcome = await mutateStewards(env, (stewards) => {
    const matches = findStewardsForUser(stewards, userId, email, emailVerified);
    if (matches.length === 0) {
      return json(
        { ok: false, error: emailVerified ? NO_RECORD_ERROR : UNVERIFIED_EMAIL_ERROR },
        emailVerified ? 404 : 403,
      );
    }
    const next = stewards.map((s) => {
      if (!matches.includes(s)) return s;
      const consent = nextConsentState(consentInput.value, s.consent, userId, now);
      return applyConsentToSteward(s, consent, inscription.value);
    });
    const matchedKeys = matches.map((m) => ({
      pieceId: m.pieceId,
      editionNumber: m.editionNumber,
    }));
    return { next, result: matchedKeys };
  });
  if (stewardOutcome instanceof Response) return stewardOutcome;

  // 2. Chain events: first-claim `claimed` + the Ring 2 choice, per piece.
  //    Built server-side from a fixed field set — no client data ever
  //    enters the hashed payload. Chains are re-derived inside the mutator
  //    so retries re-plan against fresh events.
  const ledgerOutcome = await mutateLedger(env, async (events) => {
    const chains = groupChains(events);
    const appended: LedgerEvent[] = [];
    try {
      for (const key of stewardOutcome.result) {
        const chain = chains.get(`${key.pieceId}:${key.editionNumber ?? 0}`);
        // No chain yet (record issued before any seed event): nothing to
        // append — the claim event lands when the piece is seeded.
        if (!chain || chain.length === 0) continue;
        const planned = await planClaimChainEvents(chain, {
          pieceId: key.pieceId,
          editionNumber: key.editionNumber,
          actorRef: userId,
          now,
          ring2MapPresence,
        });
        appended.push(...planned);
      }
    } catch (err) {
      // Chain tip dated in the future (admin forward-dated event) —
      // appending "now" would backdate. Same 409 as steward/update.
      if (err instanceof BackdatedEventError) {
        return json({ ok: false, error: err.message }, 409);
      }
      throw err;
    }
    return { next: events.concat(appended), result: appended };
  });
  if (ledgerOutcome instanceof Response) return ledgerOutcome;

  if (ledgerOutcome.result.length > 0) {
    const publicState = await regeneratePublicState(env, ledgerOutcome.next);

    // The piece writes back (M5): for every FRESH `claimed` event, write
    // kin-claim letters to consenting, ring2-public kin pieces. Generation
    // reads only the regenerated public state — a piece whose steward
    // declined Ring 2 (private) or Ring 3 (not in the constellation) is
    // absent from it, so a private claim notifies no one and references no
    // one. Letter writes are best-effort and never block the claim response.
    const freshClaims = ledgerOutcome.result.filter((e) => e.type === 'claimed');
    for (const e of freshClaims) {
      const key = letterRecipientKey(e.pieceId, e.editionNumber);
      try {
        await generateKinClaimLetters(env, publicState, key, now);
      } catch {
        // A letter is a courtesy, not a fact — never fail the claim over it.
      }
    }
  }

  // One-request publication (design ruling, 2026-07-12): when the map choice
  // is public AND the ceremony carried a first dream, the single "Show on the
  // atlas" choice governs both the light and the dream. Publish the dream in
  // the same motion (convert it to a real intention and mark it shared) so the
  // regenerated public state carries it immediately. A private map choice
  // leaves it pending, exactly as before. Best-effort: the light is the
  // binding act, and a publish failure never fails the claim.
  if (ring2MapPresence && inscription.value) {
    try {
      await publishFirstDreamsOnClaim(
        env,
        stewardOutcome.next,
        stewardOutcome.result,
        userId,
        now,
      );
    } catch {
      // The dream can still be published later from the book. Never fail the
      // claim over it.
    }
  }

  return buildClaimedResponse(stewardOutcome.next, ledgerOutcome.next, userId, true);
}

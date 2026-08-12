/**
 * GET /api/atlas/holder-chart?pieceId=…&editionNumber=…
 *
 * "Held by a chart of…" — the holder-chart attach for the atlas side panel
 * (M5). PUBLIC-readable but yields data ONLY when the piece's steward has
 * opted into Ring 3 (ring3ChartPresence === true) AND has a hologenetic
 * profile in D1.
 *
 * What it returns is a single DERIVED FIELD, taken from the profile's
 * computed HologeneticProfile JSON (gate/line pairs — itself already
 * derived, holding no raw birth data): the element of the holder's Life's
 * Work gate (its I Ching trigram — "Water", "Fire", "Mountain"…).
 * NEVER the raw birth date / time / place, NEVER a name, NEVER the gate
 * number — or any 1:1 proxy for it like the gate's Gene Key gift word —
 * because the Life's Work gate pins the holder's birth date to a ~6-day
 * window and this endpoint is public. Only the 8-way elemental summary is
 * coarse enough to be genuinely non-identifying.
 *
 * Raw birth data (profiles.birth_date / birth_time / birth_place_label / lat
 * / lng / tz_id) is never selected here and is unreadable from any public
 * response. Degrades gracefully: missing D1, missing migration, no profile,
 * or Ring 3 not opted-in all return { ok: true, chart: null } so the panel
 * simply shows nothing.
 */

import type { HologeneticProfile } from '../../../lib/astrology/types';
import { CARD_BY_NUMBER } from '../../../data/oracleData';
import type { PagesContext } from './_helpers';
import {
  isMissingTableError,
  json,
  readStewards,
} from './_helpers';

interface ProfileRow {
  computed_json: string;
}

/** The derived, non-identifying summary the side panel may show. */
interface HolderChartSummary {
  /** I Ching trigram element of the Life's Work gate — "Water", "Fire"… */
  element: string;
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  const url = new URL(request.url);
  const pieceId = url.searchParams.get('pieceId') ?? '';
  if (!pieceId) return json({ ok: false, error: 'Missing pieceId' }, 400);
  const raw = url.searchParams.get('editionNumber');
  const editionNumber = raw !== null && raw !== '' ? Number(raw) : undefined;
  if (editionNumber !== undefined && !Number.isFinite(editionNumber)) {
    return json({ ok: false, error: 'Invalid editionNumber' }, 400);
  }

  // The consent gate: only a Ring-3-opted-in steward's chart attaches.
  const stewards = await readStewards(env);
  const record = stewards.find(
    (s) =>
      s.pieceId === pieceId &&
      (s.editionNumber ?? undefined) === (editionNumber ?? undefined),
  );
  if (
    !record ||
    !record.clerkUserId ||
    record.consent?.ring3ChartPresence !== true
  ) {
    return json({ ok: true, chart: null });
  }

  // No D1 / migration not applied → degrade silently (no chart, not an error).
  if (!env.DB) return json({ ok: true, chart: null });

  let row: ProfileRow | null = null;
  try {
    row = await env.DB.prepare(
      `SELECT p.computed_json AS computed_json
         FROM profiles p
         JOIN users u ON u.id = p.user_id
        WHERE u.auth_user_id = ?1`,
    )
      .bind(record.clerkUserId)
      .first<ProfileRow>();
  } catch (err) {
    if (isMissingTableError(err)) return json({ ok: true, chart: null });
    throw err;
  }
  if (!row) return json({ ok: true, chart: null });

  let profile: HologeneticProfile;
  try {
    profile = JSON.parse(row.computed_json) as HologeneticProfile;
  } catch {
    return json({ ok: true, chart: null });
  }

  const gate = profile?.lifesWork?.gate;
  if (typeof gate !== 'number') return json({ ok: true, chart: null });
  const card = CARD_BY_NUMBER.get(gate);
  if (!card) return json({ ok: true, chart: null });

  // Derived, non-identifying: the gate's trigram element — 8 values across
  // all holders. Anything gate-resolution (the number, its Gene Key words)
  // stays private; see the header comment.
  const summary: HolderChartSummary = {
    element: card.iching.upper_trigram.name,
  };
  return json({ ok: true, chart: summary });
}

/**
 * Letter generation — the I/O layer that turns ledger/consent events into
 * letters in atlas/letters.json (M5). No HTTP handlers (leading underscore
 * keeps Pages from routing this); the steward routes import these.
 *
 * The pure prose + selection planning lives in utils/letters.ts; this module
 * wires it to the public atlas state (the ONLY source of facts a body may
 * reference — a piece that isn't in public.json is ring2-private and never
 * named) and the concurrency-safe mutator.
 *
 * Body discipline is structural: kin-claim recipients and bodies are derived
 * from the public projection alone (shared trigram + the public city label of
 * the newly-lit piece + its public ordinal). A private piece is absent from
 * public.json, so it can neither receive nor be referenced by a kin letter.
 */
import type { CityCentroid, PublicAtlasState } from '../../../types';
import { CARD_BY_NUMBER } from '../../../data/oracleData';
import { ulCardNumber } from '../../../utils/universalLanguage';
import { FULL_ARCHIVE } from '../../../data/mockData';
import { formatPlaceLabel } from '../../../data/cities';
import { letterRecipientKey, planKinClaimLetters } from '../../../utils/letters';
import type { KinPieceFact } from '../../../utils/letters';
import type { AtlasEnv } from './_helpers';
import { mutateLetters } from './_helpers';

const archiveById = new Map(FULL_ARCHIVE.map((a) => [a.id, a]));

/**
 * Resolve UL pieces in a public state to their trigrams and public city
 * labels. Mirrors buildKinshipIndex's filters: UL series, status 'placed', a
 * known city, a resolvable hexagram.
 *
 * @param requireEligible  When true (the RECIPIENT view), also requires
 *   kinshipEligible !== false — only pieces in the constellation (ring3-
 *   consented). When false (the SOURCE view), any ring2-public placed UL
 *   piece qualifies — being in public.json already means its city is
 *   public, which is all a kin body references.
 *
 * A piece's mere presence in `state.pieces` means it is ring2-public; a
 * withdrawn/private piece was stripped server-side and never appears here.
 */
export function kinFacts(
  state: PublicAtlasState,
  requireEligible: boolean,
): Map<string, KinPieceFact> {
  const citiesById = new Map<string, CityCentroid>();
  for (const c of state.cities) citiesById.set(c.id, c);

  const out = new Map<string, KinPieceFact>();
  for (const p of state.pieces) {
    if (p.series !== 'Universal Language') continue;
    if (p.status !== 'placed') continue;
    if (requireEligible && p.kinshipEligible === false) continue;
    if (!p.cityId) continue;
    const city = citiesById.get(p.cityId);
    if (!city) continue;
    const art = archiveById.get(p.pieceId);
    if (!art) continue;
    const num = ulCardNumber(art.coverImage);
    if (num == null) continue;
    const card = CARD_BY_NUMBER.get(num);
    if (!card) continue;
    const key = letterRecipientKey(p.pieceId, p.editionNumber);
    out.set(key, {
      key,
      pieceId: p.pieceId,
      upperTrigram: card.iching.upper_trigram.name,
      lowerTrigram: card.iching.lower_trigram.name,
      cityLabel: formatPlaceLabel(city),
      ordinal: p.claimOrdinal,
    });
  }
  return out;
}

/**
 * After a `claimed` event lands for a kinship-eligible UL piece, write a
 * letter to each kin piece from THAT recipient's own voice. Recipients,
 * sibling-edition exclusion, and the consent gate (the newly-lit piece must
 * itself be public + eligible) are all handled by planKinClaimLetters. A
 * private claim — declined Ring 2 or Ring 3 — produces no letters.
 */
export async function generateKinClaimLetters(
  env: AtlasEnv,
  publicState: PublicAtlasState,
  newPieceKey: string,
  nowIso: string,
): Promise<void> {
  // Source: ring2-public is enough (its public city is all the body names).
  const source = kinFacts(publicState, false).get(newPieceKey) ?? null;
  // Recipients: must be in the constellation (ring3-consented + ring2-public).
  const recipients = kinFacts(publicState, true);
  const letters = planKinClaimLetters(source, recipients, nowIso);
  if (letters.length === 0) return;
  await mutateLetters(env, (current) => ({
    next: [...current, ...letters],
    result: undefined,
  }));
}

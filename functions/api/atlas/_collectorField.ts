import type { CityCentroid, PublicAtlasState } from '../../../types';
import { CITIES_BY_ID } from '../../../data/cities';

/* Adrian-Website's canonical /api/atlas speaks the collector-field shape
 * (schemaVersion 3): artworks as `lights`, each carrying per-edition
 * `identity` rows. Mandala's Atlas surfaces still speak PublicAtlasState
 * (pieces + cities). This adapter is the seam: it projects the collector
 * field into the shape every Mandala reader already understands, so the
 * canonical record stays canonical and Mandala's presentation stays intact.
 *
 * Only registered identities cross the seam. Unregistered catalog rows are
 * the dim-world build's material (todo/plans/atlas-dim-world.md), not part
 * of the public ledger this page presents today. */

interface CollectorFieldCity {
  id?: unknown;
  label?: unknown;
  country?: unknown;
  lat?: unknown;
  lng?: unknown;
}

interface CollectorFieldIdentity {
  publicCode?: unknown;
  editionLabel?: unknown;
  status?: unknown;
  ordinal?: unknown;
  city?: CollectorFieldCity | null;
}

interface CollectorFieldLight {
  artworkId?: unknown;
  title?: unknown;
  series?: unknown;
  year?: unknown;
  identity?: unknown;
}

export interface CollectorFieldState {
  generatedAt?: unknown;
  schemaVersion?: unknown;
  lights?: unknown;
  chainTips?: unknown;
}

export function isCollectorFieldState(state: unknown): state is CollectorFieldState {
  if (!state || typeof state !== 'object') return false;
  const candidate = state as CollectorFieldState;
  return Array.isArray(candidate.lights) && !('pieces' in candidate);
}

function editionNumberFromLabel(label: unknown): number | undefined {
  if (typeof label !== 'string') return undefined;
  const match = /^Edition (\d+)$/.exec(label.trim());
  if (!match) return undefined;
  const edition = Number(match[1]);
  return Number.isSafeInteger(edition) && edition > 0 ? edition : undefined;
}

function centroidFor(city: CollectorFieldCity): CityCentroid | null {
  if (typeof city.id !== 'string' || !city.id) return null;
  const known = CITIES_BY_ID.get(city.id);
  if (known) return known;
  /* A canonical city Mandala's manifest doesn't know yet: keep the piece on
   * the map with the feed's own coordinates rather than dropping it. */
  if (typeof city.lat !== 'number' || typeof city.lng !== 'number') return null;
  const label = typeof city.label === 'string' ? city.label : city.id;
  return {
    id: city.id,
    city: label.split(',')[0].trim() || city.id,
    country: typeof city.country === 'string' ? city.country : '',
    countryCode: '',
    lat: city.lat,
    lng: city.lng,
  };
}

/**
 * Project a collector-field state into PublicAtlasState. Returns null when
 * the input does not carry a readable lights array — never a partial guess.
 */
export function adaptCollectorFieldState(state: unknown): PublicAtlasState | null {
  if (!isCollectorFieldState(state)) return null;
  const lights = state.lights as CollectorFieldLight[];

  const pieces: PublicAtlasState['pieces'] = [];
  const cities = new Map<string, CityCentroid>();
  const sourceTips =
    state.chainTips && typeof state.chainTips === 'object'
      ? (state.chainTips as Record<string, string>)
      : {};
  const chainTips: Record<string, string> = {};

  for (const light of lights) {
    if (typeof light.artworkId !== 'string' || !light.artworkId) continue;
    const identities = Array.isArray(light.identity) ? light.identity : [];
    const series = typeof light.series === 'string' ? light.series : undefined;
    for (const raw of identities) {
      const identity = raw as CollectorFieldIdentity;
      /* 'registered' = public with a shared city; 'private' = registered,
       * city withheld. Everything else stays off the public ledger. */
      if (identity.status !== 'registered' && identity.status !== 'private') continue;
      const editionNumber = editionNumberFromLabel(identity.editionLabel);
      const centroid = identity.city ? centroidFor(identity.city) : null;
      if (centroid) cities.set(centroid.id, centroid);
      const ordinal =
        Number.isSafeInteger(Number(identity.ordinal)) && Number(identity.ordinal) > 0
          ? Number(identity.ordinal)
          : undefined;
      pieces.push({
        pieceId: light.artworkId,
        ...(typeof identity.publicCode === 'string' && /^AR-[A-Z0-9-]+$/.test(identity.publicCode) ? { publicCode: identity.publicCode } : {}),
        ...(editionNumber !== undefined ? { editionNumber } : {}),
        ...(series ? { series } : {}),
        cityId: centroid ? centroid.id : null,
        status: centroid ? 'placed' : 'seeking',
        pieceType: series === 'Universal Language' ? 'mandala' : 'other',
        ...(ordinal !== undefined ? { claimOrdinal: ordinal } : {}),
      });
      const tipKey = `${light.artworkId}:${editionNumber ?? 0}`;
      /* Two edition-less identities of one artwork both key to `:0`. First
       * wins — the same convention the pieces array's first-match lookup
       * follows — so a later identity never silently overwrites the tip. */
      if (!(tipKey in chainTips)) {
        const tip = sourceTips[tipKey] || sourceTips[`${tipKey}:native`];
        if (typeof tip === 'string' && tip) chainTips[tipKey] = tip;
      }
    }
  }

  return {
    generatedAt:
      typeof state.generatedAt === 'string' ? state.generatedAt : new Date().toISOString(),
    schemaVersion: 2,
    pieces,
    cities: [...cities.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    ...(Object.keys(chainTips).length ? { chainTips } : {}),
  };
}

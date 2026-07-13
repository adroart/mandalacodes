/**
 * R2 storage for homecoming requests (Phase 2.5). No HTTP handlers here (the
 * leading underscore keeps Cloudflare Pages from routing this file), the
 * homecoming/ endpoints import these.
 *
 * Deliberately a NEW file rather than an addition to _helpers.ts: that shared
 * module is edited by a parallel agent, so all homecoming storage lives here.
 * Reads use the R2 binding directly; writes reuse the exported, concurrency-
 * safe mutateJsonArray from _helpers.ts (the retrying conditional-put loop) so
 * two racing writes can never silently drop each other's data.
 */

import type { AtlasEnv, Mutation, MutateSuccess } from './_helpers';
import { mutateJsonArray } from './_helpers';
import type { HomecomingRequest } from '../../../lib/atlas/homecoming';

/** The mutable R2 key. Follows the atlas/<name>.json convention of the other
 *  mutable stores (claimRequests, letters, sharedIntentions). */
export const KEY_HOMECOMING = 'atlas/homecomingRequests.json';

export async function readHomecomingRequests(
  env: AtlasEnv,
): Promise<HomecomingRequest[]> {
  const obj = await env.ATLAS_BUCKET.get(KEY_HOMECOMING);
  if (!obj) return [];
  try {
    const parsed = JSON.parse(await obj.text());
    return Array.isArray(parsed) ? (parsed as HomecomingRequest[]) : [];
  } catch {
    return [];
  }
}

type Mutator<R> = (
  current: HomecomingRequest[],
) =>
  | Promise<Mutation<HomecomingRequest, R> | Response>
  | Mutation<HomecomingRequest, R>
  | Response;

/** Concurrency-safe mutation of atlas/homecomingRequests.json. */
export function mutateHomecomingRequests<R>(
  env: AtlasEnv,
  mutate: Mutator<R>,
): Promise<MutateSuccess<HomecomingRequest, R> | Response> {
  return mutateJsonArray<HomecomingRequest, R>(env, KEY_HOMECOMING, mutate);
}

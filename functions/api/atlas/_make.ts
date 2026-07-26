/**
 * R2 storage for make requests (the "Begin your piece" commission door).
 * No HTTP handlers here (the leading underscore keeps Cloudflare Pages from
 * routing this file); the make/ endpoints import these.
 *
 * Mirrors _homecoming.ts deliberately: reads use the R2 binding directly;
 * writes reuse the exported, concurrency-safe mutateJsonArray from
 * _helpers.ts (the retrying conditional-put loop) so two racing writes can
 * never silently drop each other's data.
 */

import type { AtlasEnv, Mutation, MutateSuccess } from './_helpers';
import { mutateJsonArray } from './_helpers';
import type { MakeRequest } from '../../../lib/atlas/make';

/** The mutable R2 key. Follows the atlas/<name>.json convention of the other
 *  mutable stores (claimRequests, homecomingRequests, letters). */
export const KEY_MAKE = 'atlas/makeRequests.json';

export async function readMakeRequests(env: AtlasEnv): Promise<MakeRequest[]> {
  const obj = await env.ATLAS_BUCKET.get(KEY_MAKE);
  if (!obj) return [];
  try {
    const parsed = JSON.parse(await obj.text());
    return Array.isArray(parsed) ? (parsed as MakeRequest[]) : [];
  } catch {
    return [];
  }
}

type Mutator<R> = (
  current: MakeRequest[],
) =>
  | Promise<Mutation<MakeRequest, R> | Response>
  | Mutation<MakeRequest, R>
  | Response;

/** Concurrency-safe mutation of atlas/makeRequests.json. */
export function mutateMakeRequests<R>(
  env: AtlasEnv,
  mutate: Mutator<R>,
): Promise<MutateSuccess<MakeRequest, R> | Response> {
  return mutateJsonArray<MakeRequest, R>(env, KEY_MAKE, mutate);
}

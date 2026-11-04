import { json, requireBinding, isResponse } from '../reflections/_shared';
import { requirePickup, type PickupContext } from './_shared';
import { allManifests, memoView, needsTranscript, PICKERS } from '../../memos/_shared';

/**
 * Memos sent from the phone, for the VPS feeder (and later the Mac). Read only.
 * ?waiting=transcript lists memos whose recording still needs a first transcript;
 * ?waiting=collect&by=vps lists memos with a transcript that this picker has not collected yet.
 */
export async function onRequestGet({ request, env }: PickupContext) {
  const refused = await requirePickup(request, env); if (refused) return refused;
  const bucket = requireBinding(env.ORACLE_PRIVATE, 'ORACLE_PRIVATE'); if (isResponse(bucket)) return bucket;
  const url = new URL(request.url);
  const waiting = url.searchParams.get('waiting') ?? 'collect';
  const by = url.searchParams.get('by') ?? 'vps';
  if (waiting !== 'transcript' && waiting !== 'collect') return json({ ok: false, error: 'waiting is transcript or collect' }, 400);
  if (!PICKERS.has(by)) return json({ ok: false, error: 'by is vps or mac' }, 400);
  const now = Date.now();
  const memos = (await allManifests(bucket))
    .filter(({ manifest }) => waiting === 'transcript' ? needsTranscript(manifest, now) : manifest.transcript.status === 'done' && !manifest.picked[by])
    .map(({ manifest }) => memoView(manifest));
  return json({ ok: true, memos });
}

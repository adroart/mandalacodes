/**
 * /api/atlas/catalog/admin — the Catalog Room's private CRUD (admin only).
 *
 *   GET    — the FULL catalog entries (keeperEmail + notes included; admin eyes
 *            only), plus the store's mint counter.
 *   POST   — create: whitelist-parse the form body, MINT the permanent id +
 *            sigilNumber inside the etag mutation so two racing creates never
 *            collide, persist. Returns the new entry and its sigil.
 *   PUT    — update by id. id, sigilNumber, and kind are IMMUTABLE (kind
 *            determines the prefix baked into the frozen id — to reclassify an
 *            unprinted piece, delete and recreate). createdAt / printedAt /
 *            claimIssuedAt are server-owned and never taken from the body.
 *   DELETE — by id. Refused once the piece is permanent: printedAt or
 *            claimIssuedAt set, or a steward record already exists for it.
 *
 * The mint counter (nextNumberByPrefix) only ever advances — a number is never
 * reused, even after this deletes an entry.
 */

import type { CatalogEntry } from '../../../../types';
import type { PagesContext } from '../_helpers';
import { json, mutateCatalog, readCatalog, readStewards } from '../_helpers';
import { requireAdmin, isAuthResponse } from '../../_lib/auth';
import {
  catalogSigil,
  mintCatalogId,
  parseCatalogInput,
} from '../../../../utils/catalog';

// ---------- GET: the full private roster ----------

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const auth = await requireAdmin(request, env);
  if (isAuthResponse(auth)) return auth;

  const catalog = await readCatalog(env);
  // Newest first, so the room shows the most recent entries at the top.
  const entries = catalog.entries
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
    .map((e) => ({ ...e, sigil: catalogSigil(e) }));

  return json({ ok: true, entries, nextNumberByPrefix: catalog.nextNumberByPrefix });
}

// ---------- POST: create + mint ----------

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const auth = await requireAdmin(request, env);
  if (isAuthResponse(auth)) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const parsed = parseCatalogInput(body);
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);
  const v = parsed.value;
  const now = new Date().toISOString();

  const outcome = await mutateCatalog<CatalogEntry>(env, (store) => {
    const mint = mintCatalogId(store, v.kind, v.series);
    const entry: CatalogEntry = {
      ...v,
      id: mint.id,
      sigilNumber: mint.sigilNumber,
      createdAt: now,
    };
    return {
      next: {
        nextNumberByPrefix: mint.nextNumberByPrefix,
        entries: [...store.entries, entry],
      },
      result: entry,
    };
  });
  if (outcome instanceof Response) return outcome;

  return json({
    ok: true,
    entry: outcome.result,
    sigil: catalogSigil(outcome.result),
  });
}

// ---------- PUT: update by id ----------

export async function onRequestPut(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const auth = await requireAdmin(request, env);
  if (isAuthResponse(auth)) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const id =
    body && typeof body === 'object' && typeof (body as { id?: unknown }).id === 'string'
      ? ((body as { id: string }).id)
      : '';
  if (!id) return json({ ok: false, error: 'Missing id' }, 400);

  // Lightweight stamp: mark the piece printed without re-sending every field.
  // Fired when its plaque or claim insert is printed; idempotent (the first
  // print time stands — printedAt makes the entry permanent from then on).
  if (body && typeof body === 'object' && (body as { markPrinted?: unknown }).markPrinted === true) {
    const stamp = await mutateCatalog<CatalogEntry>(env, (store) => {
      const idx = store.entries.findIndex((e) => e.id === id);
      if (idx === -1) return json({ ok: false, error: 'No such entry' }, 404);
      const existing = store.entries[idx];
      if (existing.printedAt) return { next: store, result: existing };
      const updated = { ...existing, printedAt: new Date().toISOString() };
      const entries = store.entries.slice();
      entries[idx] = updated;
      return {
        next: { nextNumberByPrefix: store.nextNumberByPrefix, entries },
        result: updated,
      };
    });
    if (stamp instanceof Response) return stamp;
    return json({ ok: true, entry: stamp.result, sigil: catalogSigil(stamp.result) });
  }

  const parsed = parseCatalogInput(body);
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);
  const v = parsed.value;

  const outcome = await mutateCatalog<CatalogEntry>(env, (store) => {
    const idx = store.entries.findIndex((e) => e.id === id);
    if (idx === -1) return json({ ok: false, error: 'No such entry' }, 404);
    const existing = store.entries[idx];
    // kind determines the prefix baked into the immutable id — freezing it
    // keeps the printed sigil aligned forever.
    if (v.kind !== existing.kind) {
      return json(
        {
          ok: false,
          error:
            'kind is immutable. It fixes the sigil prefix, so to reclassify an unprinted, unclaimed piece, delete it and create it anew.',
        },
        400,
      );
    }
    const updated: CatalogEntry = {
      ...v,
      id: existing.id,
      kind: existing.kind,
      sigilNumber: existing.sigilNumber,
      createdAt: existing.createdAt,
      ...(existing.printedAt ? { printedAt: existing.printedAt } : {}),
      ...(existing.claimIssuedAt ? { claimIssuedAt: existing.claimIssuedAt } : {}),
    };
    const entries = store.entries.slice();
    entries[idx] = updated;
    return {
      next: { nextNumberByPrefix: store.nextNumberByPrefix, entries },
      result: updated,
    };
  });
  if (outcome instanceof Response) return outcome;

  return json({
    ok: true,
    entry: outcome.result,
    sigil: catalogSigil(outcome.result),
  });
}

// ---------- DELETE: by id, while unprinted + unclaimed ----------

export async function onRequestDelete(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const auth = await requireAdmin(request, env);
  if (isAuthResponse(auth)) return auth;

  // id from the JSON body, or the query string as a fallback.
  let id = '';
  try {
    const body = (await request.json()) as { id?: unknown };
    if (typeof body?.id === 'string') id = body.id;
  } catch {
    /* no body — try the query string */
  }
  if (!id) id = new URL(request.url).searchParams.get('id') ?? '';
  if (!id) return json({ ok: false, error: 'Missing id' }, 400);

  // A steward record for this piece makes it permanent, even if the entry
  // itself was never stamped printed/claimed.
  const stewards = await readStewards(env);
  const hasSteward = stewards.some((s) => s.pieceId === id);

  const outcome = await mutateCatalog<{ id: string }>(env, (store) => {
    const entry = store.entries.find((e) => e.id === id);
    if (!entry) return json({ ok: false, error: 'No such entry' }, 404);
    if (entry.printedAt || entry.claimIssuedAt || hasSteward) {
      return json(
        {
          ok: false,
          error:
            'This piece is permanent. It has been printed, invited, or bound to a keeper, so it can no longer be deleted.',
        },
        409,
      );
    }
    return {
      next: {
        // The counter is NOT rewound — the number stays retired forever.
        nextNumberByPrefix: store.nextNumberByPrefix,
        entries: store.entries.filter((e) => e.id !== id),
      },
      result: { id },
    };
  });
  if (outcome instanceof Response) return outcome;

  return json({ ok: true, id });
}

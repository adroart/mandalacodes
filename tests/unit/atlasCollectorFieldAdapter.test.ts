import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  adaptCollectorFieldState,
  isCollectorFieldState,
} from '../../functions/api/atlas/_collectorField';
import { readCanonicalAtlasState } from '../../functions/api/atlas/_canonical';
import { onRequestGet } from '../../functions/api/atlas/index';

/* Shape captured live from Adrian-Website's canonical /api/atlas
 * (collector field, schemaVersion 3) during the 2026-08-19 rollout
 * rehearsal. The adapter must project it into PublicAtlasState. */
function collectorFieldFixture() {
  return {
    generatedAt: '2026-08-19T07:54:41.273Z',
    schemaVersion: 3,
    lights: [
      {
        artworkId: 'UL-162',
        title: 'Adornments of Time - 63',
        series: 'Universal Language',
        year: 2024,
        identity: [
          {
            publicCode: 'AR-STCBHMPP',
            editionLabel: 'Edition 1',
            status: 'registered',
            ordinal: 1,
            city: {
              id: 'denpasar-id',
              label: 'Denpasar, Indonesia',
              country: 'Indonesia',
              lat: -8.65,
              lng: 115.2167,
            },
            brightness: 1,
            markerSize: 1,
          },
          {
            publicCode: 'AR-XXTESTQQ',
            editionLabel: 'Edition 2',
            status: 'private',
            ordinal: 2,
            city: null,
            brightness: 1,
            markerSize: 1,
          },
          {
            publicCode: null,
            editionLabel: 'Edition 3',
            status: 'unregistered',
            ordinal: null,
            city: null,
            brightness: 0.24,
            markerSize: 1,
          },
        ],
      },
      {
        artworkId: 'UL-100',
        title: 'Art of Living - 32',
        series: 'Universal Language',
        year: 2024,
        identity: [
          {
            publicCode: null,
            editionLabel: null,
            status: 'unregistered',
            ordinal: null,
            city: null,
            brightness: 0.24,
            markerSize: 1,
          },
        ],
      },
    ],
    facets: {
      series: ['Universal Language'],
      years: [2024],
      places: [{ id: 'denpasar-id', label: 'Denpasar, Indonesia' }],
    },
    chainTips: {
      'UL-162:1': 'sourcetip-aaaa',
      'UL-162:1:native': 'nativetip-bbbb',
      'UL-162:2:native': 'nativetip-cccc',
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('collector-field → PublicAtlasState adapter', () => {
  it('recognizes the collector-field shape and not the legacy shape', () => {
    expect(isCollectorFieldState(collectorFieldFixture())).toBe(true);
    expect(isCollectorFieldState({ pieces: [], cities: [] })).toBe(false);
    expect(isCollectorFieldState(null)).toBe(false);
  });

  it('projects only registered identities into pieces', () => {
    const state = adaptCollectorFieldState(collectorFieldFixture());
    expect(state).not.toBeNull();
    expect(state?.pieces).toHaveLength(2);

    const placed = state?.pieces.find((p) => p.editionNumber === 1);
    expect(placed).toMatchObject({
      pieceId: 'UL-162',
      series: 'Universal Language',
      cityId: 'denpasar-id',
      status: 'placed',
      pieceType: 'mandala',
      claimOrdinal: 1,
    });

    const withheld = state?.pieces.find((p) => p.editionNumber === 2);
    expect(withheld).toMatchObject({
      pieceId: 'UL-162',
      cityId: null,
      status: 'seeking',
      claimOrdinal: 2,
    });
  });

  it('resolves cities from the Mandala manifest and keeps chain tips', () => {
    const state = adaptCollectorFieldState(collectorFieldFixture());
    expect(state?.cities).toHaveLength(1);
    expect(state?.cities[0]).toMatchObject({
      id: 'denpasar-id',
      city: 'Denpasar',
      countryCode: 'ID',
    });
    expect(state?.chainTips).toEqual({
      'UL-162:1': 'sourcetip-aaaa',
      'UL-162:2': 'nativetip-cccc',
    });
  });

  it('returns a valid empty ledger when nothing is registered yet', () => {
    const fixture = collectorFieldFixture();
    for (const light of fixture.lights) {
      for (const identity of light.identity) identity.status = 'unregistered';
    }
    const state = adaptCollectorFieldState(fixture);
    expect(state?.pieces).toEqual([]);
    expect(state?.cities).toEqual([]);
  });

  it('rejects payloads that are neither shape', () => {
    expect(adaptCollectorFieldState({ nonsense: true })).toBeNull();
  });
});

describe('/api/atlas proxy with a collector-field upstream', () => {
  it('serves adapted PublicAtlasState to the page', async () => {
    const fetch = vi.fn(async () =>
      Response.json({ ok: true, state: collectorFieldFixture() }),
    );
    vi.stubGlobal('fetch', fetch);

    const response = await onRequestGet({
      request: new Request('https://mandalacodes.com/api/atlas'),
      env: {},
    } as never);

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      ok: boolean;
      state: { pieces: unknown[]; cities: unknown[] };
    };
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.state.pieces)).toBe(true);
    expect(Array.isArray(body.state.cities)).toBe(true);
    expect(body.state.pieces).toHaveLength(2);
  });

  it('still passes the legacy shape through untouched', async () => {
    const canonical = {
      ok: true,
      state: { generatedAt: 'x', schemaVersion: 2, pieces: [], cities: [] },
    };
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(canonical)));

    const response = await onRequestGet({
      request: new Request('https://mandalacodes.com/api/atlas'),
      env: {},
    } as never);

    await expect(response.json()).resolves.toEqual(canonical);
  });

  it('passes upstream failures through unadapted', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ ok: false, error: 'atlas_unavailable' }, { status: 503 }),
      ),
    );

    const response = await onRequestGet({
      request: new Request('https://mandalacodes.com/api/atlas'),
      env: {},
    } as never);

    expect(response.status).toBe(503);
  });
});

describe('readCanonicalAtlasState with a collector-field upstream', () => {
  it('returns the adapted state for internal readers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ ok: true, state: collectorFieldFixture() })),
    );

    const state = await readCanonicalAtlasState(
      new Request('https://mandalacodes.com/api/atlas/card/23'),
      {},
    );

    expect(state).not.toBeNull();
    expect(state?.pieces).toHaveLength(2);
    expect(state?.cities[0]?.id).toBe('denpasar-id');
  });
});

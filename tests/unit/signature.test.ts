/**
 * "Sign your dream" — the optional keeper identity layer (Ring 4, 2026-07-19).
 *
 * Pins the two halves of the contract:
 *   1. Input validation (utils/consent): whitelist discipline, name/link
 *      limits, and the HARD https-only rule (javascript:/data:/http: rejected).
 *   2. Public projection: the signature rides ONLY alongside a public dream,
 *      never when the dream is private/absent, and never when the keeper's
 *      signature is off — and only the name + link ever reach public state.
 *
 * The signature name is the single piece of identity a keeper may consent
 * public; every other steward field stays private (see privacy.test.ts).
 */
import { describe, expect, it } from 'vitest';
import {
  nextRing4SignatureConsentState,
  parseSignatureInput,
  parseSignatureLink,
  parseSignatureName,
} from '../../utils/consent';
import { projectAll, toPublicState } from '../../utils/ledgerProjection';
import { buildSignedByKey } from '../../functions/api/atlas/_helpers';
import { CONSENT_VERSION } from '../../types';
import type {
  CityCentroid,
  ConsentState,
  LedgerEvent,
  PublicSignature,
  StewardRecord,
} from '../../types';

const NOW = '2026-07-19T12:00:00.000Z';
const USER = 'user_keeper_abc';

let counter = 0;
function evt(overrides: Partial<LedgerEvent> = {}): LedgerEvent {
  counter += 1;
  return {
    id: `evt-${counter}`,
    pieceId: 'UL-1',
    type: 'created',
    date: `2026-01-${String(counter).padStart(2, '0')}T00:00:00.000Z`,
    cityId: null,
    actor: 'admin',
    prevHash: null,
    hash: `hash-${counter}`,
    ...overrides,
  };
}

const lisbon: CityCentroid = {
  id: 'lisbon-pt',
  city: 'Lisbon',
  country: 'Portugal',
  countryCode: 'PT',
  lat: 38.7,
  lng: -9.1,
};

/** A placed + claimed UL-1 chain — the kind of piece that can carry a public
 *  dream. */
function placedChain(): LedgerEvent[] {
  return [
    evt({ type: 'created' }),
    evt({ type: 'placed', cityId: 'lisbon-pt' }),
    evt({ type: 'claimed', actorRef: USER }),
  ];
}

const meta = new Map([['UL-1', { series: 'Universal Language' }]]);

function steward(overrides: Partial<StewardRecord> = {}): StewardRecord {
  return {
    pieceId: 'UL-1',
    issuedAt: '2026-01-01T00:00:00.000Z',
    outreachStatus: 'claimed',
    ...overrides,
  };
}

// ---------- input validation ----------

describe('parseSignatureName', () => {
  it('trims and accepts a name within the limit', () => {
    expect(parseSignatureName('  Ada Lovelace  ')).toEqual({ ok: true, value: 'Ada Lovelace' });
  });
  it('treats absent / blank as no name', () => {
    expect(parseSignatureName(undefined)).toEqual({ ok: true, value: undefined });
    expect(parseSignatureName(null)).toEqual({ ok: true, value: undefined });
    expect(parseSignatureName('   ')).toEqual({ ok: true, value: undefined });
  });
  it('rejects non-strings and names over 60 characters', () => {
    expect(parseSignatureName(42).ok).toBe(false);
    expect(parseSignatureName('x'.repeat(61)).ok).toBe(false);
    expect(parseSignatureName('x'.repeat(60)).ok).toBe(true);
  });
});

describe('parseSignatureLink', () => {
  it('accepts an https URL within the limit', () => {
    expect(parseSignatureLink('https://example.com/me')).toEqual({
      ok: true,
      value: 'https://example.com/me',
    });
  });
  it('treats absent / blank as no link', () => {
    expect(parseSignatureLink(undefined)).toEqual({ ok: true, value: undefined });
    expect(parseSignatureLink('  ')).toEqual({ ok: true, value: undefined });
  });
  it('rejects every non-https scheme, including javascript: and data:', () => {
    for (const bad of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'http://example.com',
      'mailto:me@example.com',
      'ftp://example.com',
      '//example.com',
      'example.com',
      'not a url',
    ]) {
      expect(parseSignatureLink(bad).ok, bad).toBe(false);
    }
  });
  it('rejects a link over 200 characters', () => {
    const long = `https://example.com/${'a'.repeat(200)}`;
    expect(parseSignatureLink(long).ok).toBe(false);
  });
});

describe('parseSignatureInput', () => {
  it('accepts { shown } and optional trimmed name/link', () => {
    expect(parseSignatureInput({ shown: true, displayName: ' Ada ', link: 'https://a.co' })).toEqual({
      ok: true,
      value: { shown: true, displayName: 'Ada', link: 'https://a.co' },
    });
    expect(parseSignatureInput({ shown: false })).toEqual({
      ok: true,
      value: { shown: false },
    });
  });
  it('requires a boolean shown', () => {
    expect(parseSignatureInput({}).ok).toBe(false);
    expect(parseSignatureInput({ shown: 'yes' }).ok).toBe(false);
  });
  it('rejects unknown fields (whitelist discipline)', () => {
    expect(parseSignatureInput({ shown: true, capturedBy: 'x' }).ok).toBe(false);
    expect(parseSignatureInput({ shown: true, ring4: {} }).ok).toBe(false);
    expect(parseSignatureInput('nope').ok).toBe(false);
    expect(parseSignatureInput(['shown']).ok).toBe(false);
  });
  it('rejects a bad link even when shown is valid', () => {
    expect(parseSignatureInput({ shown: true, link: 'javascript:alert(1)' }).ok).toBe(false);
  });
});

// ---------- Ring 4 consent audit ----------

describe('nextRing4SignatureConsentState', () => {
  const prev: ConsentState = {
    version: CONSENT_VERSION,
    capturedAt: '2026-06-01T00:00:00.000Z',
    capturedBy: 'user_old',
    ring2MapPresence: true,
    ring3ChartPresence: true,
    ring4: 'deferred',
  };
  it('moves only ring4 + the stamp, carrying Rings 2 and 3 forward', () => {
    const next = nextRing4SignatureConsentState(
      { shown: true, displayName: 'Ada', link: 'https://a.co' },
      prev,
      USER,
      NOW,
    );
    expect(next.ring2MapPresence).toBe(true);
    expect(next.ring3ChartPresence).toBe(true);
    expect(next.ring4).toEqual({
      face: false,
      name: true, // a shown name
      intention: false,
      business: true, // a shown link
      mission: false,
    });
    expect(next.capturedAt).toBe(NOW);
    expect(next.capturedBy).toBe(USER);
  });
  it('records all Ring 4 flags off when the signature is turned off', () => {
    const next = nextRing4SignatureConsentState(
      { shown: false, displayName: 'Ada', link: 'https://a.co' },
      prev,
      USER,
      NOW,
    );
    expect(next.ring4).toEqual({
      face: false,
      name: false,
      intention: false,
      business: false,
      mission: false,
    });
  });
});

// ---------- buildSignedByKey (the shown gate) ----------

describe('buildSignedByKey', () => {
  it('includes only shown signatures that carry a name', () => {
    const map = buildSignedByKey([
      steward({ pieceId: 'UL-1', signature: { shown: true, displayName: 'Ada', link: 'https://a.co' } }),
      // shown but no name → nowhere to render → excluded
      steward({ pieceId: 'UL-2', signature: { shown: true, link: 'https://b.co' } }),
      // has a name but hidden → excluded
      steward({ pieceId: 'UL-3', signature: { shown: false, displayName: 'Grace' } }),
      // no signature at all → excluded
      steward({ pieceId: 'UL-4' }),
    ]);
    expect([...map.keys()]).toEqual(['UL-1:0']);
    expect(map.get('UL-1:0')).toEqual({ name: 'Ada', link: 'https://a.co' });
  });
  it('omits the link when the keeper gave none', () => {
    const map = buildSignedByKey([
      steward({ signature: { shown: true, displayName: 'Ada' } }),
    ]);
    expect(map.get('UL-1:0')).toEqual({ name: 'Ada' });
    expect('link' in (map.get('UL-1:0') as object)).toBe(false);
  });
});

// ---------- projection: rides only a public dream ----------

const signed = new Map<string, PublicSignature>([['UL-1:0', { name: 'Ada', link: 'https://a.co' }]]);

describe('toPublicState — signedBy attaches only alongside a public dream', () => {
  it('attaches signedBy when the dream is public AND the signature is present', () => {
    const state = toPublicState(
      projectAll(placedChain()),
      meta,
      [lisbon],
      undefined,
      new Map([['UL-1:0', 'I dream of open seas.']]),
      signed,
    );
    const ul1 = state.pieces.find((p) => p.pieceId === 'UL-1');
    expect(ul1?.intention).toBe('I dream of open seas.');
    expect(ul1?.signedBy).toEqual({ name: 'Ada', link: 'https://a.co' });
  });

  it('never attaches signedBy when the dream is absent (private), even with a signature', () => {
    // No intentions map at all → no public dream → no signature anywhere.
    const state = toPublicState(
      projectAll(placedChain()),
      meta,
      [lisbon],
      undefined,
      undefined,
      signed,
    );
    const ul1 = state.pieces.find((p) => p.pieceId === 'UL-1');
    expect(ul1?.intention).toBeUndefined();
    expect(ul1?.signedBy).toBeUndefined();
    // And the name never appears anywhere in the serialized state.
    expect(JSON.stringify(state)).not.toContain('Ada');
    expect(JSON.stringify(state)).not.toContain('a.co');
  });

  it('never attaches signedBy when the keeper signature is off (empty signedBy map)', () => {
    // shown:false was already filtered out by buildSignedByKey, so the map has
    // no entry for the piece — the projection attaches nothing.
    const state = toPublicState(
      projectAll(placedChain()),
      meta,
      [lisbon],
      undefined,
      new Map([['UL-1:0', 'I dream of open seas.']]),
      new Map(), // no shown signatures
    );
    const ul1 = state.pieces.find((p) => p.pieceId === 'UL-1');
    expect(ul1?.intention).toBe('I dream of open seas.');
    expect(ul1?.signedBy).toBeUndefined();
  });

  it('never rides a WITHDRAWN piece — the dream and signature both vanish', () => {
    const withdrawn = [
      evt({ type: 'created' }),
      evt({ type: 'placed', cityId: 'lisbon-pt' }),
      evt({ type: 'claimed', actorRef: USER }),
      evt({ type: 'withdrawn', cityId: 'lisbon-pt' }),
    ];
    const state = toPublicState(
      projectAll(withdrawn),
      meta,
      [lisbon],
      undefined,
      new Map([['UL-1:0', 'I dream of open seas.']]),
      signed,
    );
    // Withdrawn → omitted from public state entirely.
    expect(state.pieces.find((p) => p.pieceId === 'UL-1')).toBeUndefined();
    expect(JSON.stringify(state)).not.toContain('Ada');
  });
});

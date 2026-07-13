/**
 * The piece writes back — letters (M5).
 *
 * Pins the pure logic in utils/letters.ts:
 *   - kin-claim selection: a kin pair triggers a letter for each consenting,
 *     ring2-public, ring3-eligible holder ONLY; a private (absent-from-public)
 *     piece neither receives nor is referenced; sibling editions never self-
 *     notify; a private claim is silent,
 *   - PII discipline: no letter body contains an email, a auth userId, or any
 *     opaque ref — and a kin body never names a ring2-private piece's location,
 *   - anniversary derivation: idempotent, one letter per year, only on/after
 *     the anniversary,
 *   - template variation sanity: the prose is not a single canned string.
 *
 * The HTTP layer (functions/api/atlas/_letters.ts + steward/letters.ts) is a
 * thin composition over this pure layer + the R2 mutators tested elsewhere; we
 * test the pure layer here rather than mocking the binding.
 */
import { describe, expect, it } from 'vitest';
import type { AtlasLetter } from '../../types';
import {
  anniversaryYearDue,
  composeAnniversaryBody,
  composeKinClaimBody,
  composeTransferBody,
  composeWordsAnniversaryBody,
  planKinClaimLetters,
  sharedTrigram,
  wholeYearsSince,
  wordsAnniversaryYearDue,
  wordsExcerpt,
  type KinPieceFact,
} from '../../utils/letters';

const NOW = '2026-06-10T12:00:00.000Z';

/* Patterns that must NEVER appear in any letter body. */
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const USERID_RE = /\buser_[A-Za-z0-9]+/;
const SALE_REF_RE = /\bsale:/;
const OPAQUE_REF_RE = /\b(clerkUserId|actorRef|toRef|fromRef)\b/;

function assertNoPII(body: string): void {
  expect(body).not.toMatch(EMAIL_RE);
  expect(body).not.toMatch(USERID_RE);
  expect(body).not.toMatch(SALE_REF_RE);
  expect(body).not.toMatch(OPAQUE_REF_RE);
}

function fact(overrides: Partial<KinPieceFact>): KinPieceFact {
  return {
    key: 'UL-1:0',
    pieceId: 'UL-1',
    upperTrigram: 'Water',
    lowerTrigram: 'Heaven',
    cityLabel: 'Lisbon, Portugal',
    ...overrides,
  };
}

describe('sharedTrigram', () => {
  it('finds an upper/lower shared trigram, order independent', () => {
    const a = fact({ upperTrigram: 'Water', lowerTrigram: 'Heaven' });
    const b = fact({ pieceId: 'UL-2', upperTrigram: 'Earth', lowerTrigram: 'Water' });
    expect(sharedTrigram(a, b)).toBe('Water');
    expect(sharedTrigram(b, a)).toBe('Water');
  });
  it('returns null when nothing is shared', () => {
    const a = fact({ upperTrigram: 'Fire', lowerTrigram: 'Fire' });
    const b = fact({ pieceId: 'UL-2', upperTrigram: 'Earth', lowerTrigram: 'Earth' });
    expect(sharedTrigram(a, b)).toBeNull();
  });
});

describe('planKinClaimLetters', () => {
  const SOURCE = fact({ key: 'UL-new:0', pieceId: 'UL-new', cityLabel: 'Buenos Aires', upperTrigram: 'Water', lowerTrigram: 'Lake', ordinal: 7 });

  it('writes a letter to each consenting, public kin of the newly-lit piece', () => {
    // Buenos Aires piece (Water) comes to light; Lisbon (Water) is kin.
    const recipients = new Map<string, KinPieceFact>([
      ['UL-kin:0', fact({ key: 'UL-kin:0', pieceId: 'UL-kin', cityLabel: 'Lisbon, Portugal', upperTrigram: 'Water', lowerTrigram: 'Earth' })],
      ['UL-far:0', fact({ key: 'UL-far:0', pieceId: 'UL-far', cityLabel: 'Tokyo', upperTrigram: 'Fire', lowerTrigram: 'Fire' })],
    ]);
    const letters = planKinClaimLetters(SOURCE, recipients, NOW);
    // Only the Water-sharing kin gets a letter — not the unrelated Fire piece.
    expect(letters.map((l) => l.recipientKey)).toEqual(['UL-kin:0']);
    const letter = letters[0];
    expect(letter.kind).toBe('kin-claim');
    expect(letter.recipientKey).toBe('UL-kin:0');
    // Body references the public city of the NEWLY-LIT piece and the trigram.
    expect(letter.body).toContain('Buenos Aires');
    expect(letter.body).toContain('Water');
    assertNoPII(letter.body);
  });

  it('is silent when the newly-lit piece is private (source null)', () => {
    // The source piece declined Ring 2, so the caller passes null —
    // a private claim must notify no one.
    const recipients = new Map<string, KinPieceFact>([
      ['UL-kin:0', fact({ key: 'UL-kin:0', pieceId: 'UL-kin' })],
    ]);
    expect(planKinClaimLetters(null, recipients, NOW)).toEqual([]);
  });

  it('only writes to recipients in the constellation (caller pre-filters ring3)', () => {
    // The recipient map IS the eligible (ring3-consented) set — a piece that
    // declined Ring 3 is simply absent from it, so it gets no letter. We
    // model that by leaving the unconsented piece out entirely.
    const recipients = new Map<string, KinPieceFact>([
      ['UL-kin:0', fact({ key: 'UL-kin:0', pieceId: 'UL-kin', cityLabel: 'Lisbon, Portugal', upperTrigram: 'Water', lowerTrigram: 'Earth' })],
      // UL-unconsented (also Water kin) is NOT here — it declined Ring 3.
    ]);
    const letters = planKinClaimLetters(SOURCE, recipients, NOW);
    expect(letters.map((l) => l.recipientKey)).toEqual(['UL-kin:0']);
  });

  it('never references a ring2-private piece — a private kin is absent and unnamed', () => {
    // A private kin would be stripped from public state, so it is not in the
    // recipient map; no body mentions its city ("SecretTown").
    const recipients = new Map<string, KinPieceFact>([
      ['UL-kin:0', fact({ key: 'UL-kin:0', pieceId: 'UL-kin', cityLabel: 'Lisbon, Portugal', upperTrigram: 'Water', lowerTrigram: 'Earth' })],
    ]);
    const letters = planKinClaimLetters(SOURCE, recipients, NOW);
    expect(letters).toHaveLength(1);
    for (const l of letters) {
      expect(l.body).not.toContain('SecretTown');
      expect(l.recipientKey).not.toBe('UL-private:0');
    }
  });

  it('never self-notifies sibling editions of the same piece', () => {
    const source = fact({ key: 'UL-1:1', pieceId: 'UL-1', cityLabel: 'Lisbon' });
    const recipients = new Map<string, KinPieceFact>([
      ['UL-1:1', source],
      ['UL-1:2', fact({ key: 'UL-1:2', pieceId: 'UL-1', cityLabel: 'Denpasar' })],
    ]);
    expect(planKinClaimLetters(source, recipients, NOW)).toEqual([]);
  });

  it('produces only PII-free bodies across every template', () => {
    // Sweep recipients so the deterministic seed selects different templates.
    const source = fact({ key: 'UL-new:0', pieceId: 'UL-new', cityLabel: 'Buenos Aires', upperTrigram: 'Water', lowerTrigram: 'Lake', ordinal: 3 });
    for (let i = 0; i < 20; i++) {
      const recipients = new Map<string, KinPieceFact>([
        [`UL-k${i}:0`, fact({ key: `UL-k${i}:0`, pieceId: `UL-k${i}`, upperTrigram: 'Water', lowerTrigram: 'Earth' })],
      ]);
      const [letter] = planKinClaimLetters(source, recipients, NOW);
      assertNoPII(letter.body);
    }
  });
});

describe('composeKinClaimBody — template variation', () => {
  it('varies the prose by seed (not one canned string)', () => {
    const bodies = new Set<string>();
    for (let i = 0; i < 30; i++) {
      bodies.add(
        composeKinClaimBody({
          trigram: 'Water',
          cityLabel: 'Buenos Aires',
          newOrdinal: 7,
          seed: `seed-${i}`,
        }),
      );
    }
    expect(bodies.size).toBeGreaterThan(1);
  });

  it('omits the ordinal clause cleanly when no ordinal is known', () => {
    const body = composeKinClaimBody({ trigram: 'Fire', cityLabel: 'Oslo', seed: 's' });
    expect(body).toContain('Fire');
    expect(body).toContain('Oslo');
    // No dangling "the undefined light".
    expect(body).not.toContain('undefined');
    assertNoPII(body);
  });
});

describe('wholeYearsSince', () => {
  it('counts calendar years, stepping back before the anniversary day', () => {
    expect(wholeYearsSince('2024-06-10T00:00:00.000Z', '2026-06-10T00:00:00.000Z')).toBe(2);
    expect(wholeYearsSince('2024-06-10T00:00:00.000Z', '2026-06-09T00:00:00.000Z')).toBe(1);
    expect(wholeYearsSince('2025-12-01T00:00:00.000Z', '2026-06-10T00:00:00.000Z')).toBe(0);
  });
});

describe('anniversaryYearDue — idempotency, one per year', () => {
  const CLAIM = '2024-06-10T00:00:00.000Z';

  function annLetter(createdAt: string): AtlasLetter {
    return { id: `ltr-${createdAt}`, recipientKey: 'UL-1:0', kind: 'anniversary', createdAt, body: 'x' };
  }

  it('returns null before the first anniversary', () => {
    expect(anniversaryYearDue(CLAIM, [], '2024-12-01T00:00:00.000Z')).toBeNull();
  });

  it('returns year 1 at the first anniversary, then null once written', () => {
    const now = '2025-06-10T00:00:00.000Z';
    expect(anniversaryYearDue(CLAIM, [], now)).toBe(1);
    // After the year-1 letter exists, the same anniversary yields nothing.
    expect(anniversaryYearDue(CLAIM, [annLetter('2025-06-10T00:00:00.000Z')], now)).toBeNull();
  });

  it('advances one year per call when a steward returns after a gap', () => {
    const now = '2026-06-10T00:00:00.000Z'; // two anniversaries have passed
    // No letters yet → catch up year 1 first (one per open).
    expect(anniversaryYearDue(CLAIM, [], now)).toBe(1);
    // Year 1 written → next call yields year 2.
    expect(anniversaryYearDue(CLAIM, [annLetter('2025-06-10T00:00:00.000Z')], now)).toBe(2);
    // Both written → nothing more this far in.
    expect(
      anniversaryYearDue(
        CLAIM,
        [annLetter('2025-06-10T00:00:00.000Z'), annLetter('2026-06-10T00:00:00.000Z')],
        now,
      ),
    ).toBeNull();
  });
});

describe('composeAnniversaryBody + composeTransferBody', () => {
  it('anniversary body omits the place when the piece is private (cityLabel null)', () => {
    const body = composeAnniversaryBody({ years: 1, cityLabel: null, seed: 'UL-1:0' });
    assertNoPII(body);
    // No " in " place clause leaks when there is no public city.
    expect(body).not.toMatch(/ in null/);
  });

  it('anniversary body includes a public city when present', () => {
    const body = composeAnniversaryBody({ years: 1, cityLabel: 'Lisbon', seed: 'UL-1:0' });
    expect(body).toContain('Lisbon');
    assertNoPII(body);
  });

  it('anniversary prose varies across years for the same piece', () => {
    const bodies = new Set<string>();
    for (let y = 1; y <= 5; y++) {
      bodies.add(composeAnniversaryBody({ years: y, cityLabel: 'Lisbon', seed: 'UL-1:0' }));
    }
    expect(bodies.size).toBeGreaterThan(1);
  });

  it('transfer body names no previous steward and carries no PII', () => {
    const bodies = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const body = composeTransferBody({ seed: `UL-${i}:0` });
      assertNoPII(body);
      bodies.add(body);
    }
    expect(bodies.size).toBeGreaterThan(1);
  });
});

/**
 * Words-anniversary letters (Phase 2 item D, "shall I keep carrying these
 * words?") — the yearly reconfirmation ask for a steward who let an
 * intention ride publicly on the map. `wordsAnniversaryYearDue` is a
 * faithful thin twin of `anniversaryYearDue`, keyed off a shared
 * intention's `sharedAt` instead of the piece's claim date; the twin cases
 * below pin the identical due/idempotent/catch-up behavior.
 */
describe('wordsAnniversaryYearDue — idempotency, one per year (twin of anniversaryYearDue)', () => {
  const SHARED_AT = '2024-06-10T00:00:00.000Z';

  function wordsLetter(createdAt: string): AtlasLetter {
    return {
      id: `ltr-${createdAt}`,
      recipientKey: 'UL-1:0',
      kind: 'words-anniversary',
      createdAt,
      body: 'x',
    };
  }

  it('is not due before the first anniversary of sharing', () => {
    expect(wordsAnniversaryYearDue(SHARED_AT, [], '2024-12-01T00:00:00.000Z')).toBeNull();
  });

  it('is due at exactly one year, then not due again once the letter is written', () => {
    const now = '2025-06-10T00:00:00.000Z';
    expect(wordsAnniversaryYearDue(SHARED_AT, [], now)).toBe(1);
    // Idempotent: once the year-1 letter exists, the same call yields nothing.
    expect(
      wordsAnniversaryYearDue(SHARED_AT, [wordsLetter('2025-06-10T00:00:00.000Z')], now),
    ).toBeNull();
  });

  it('catches up exactly one year per call after a gap', () => {
    const now = '2026-06-10T00:00:00.000Z'; // two anniversaries have passed
    // No letters yet → catch up year 1 first (one per open, not both at once).
    expect(wordsAnniversaryYearDue(SHARED_AT, [], now)).toBe(1);
    // Year 1 written → next call yields year 2.
    expect(
      wordsAnniversaryYearDue(SHARED_AT, [wordsLetter('2025-06-10T00:00:00.000Z')], now),
    ).toBe(2);
    // Both written → nothing more this far in (idempotent after write).
    expect(
      wordsAnniversaryYearDue(
        SHARED_AT,
        [wordsLetter('2025-06-10T00:00:00.000Z'), wordsLetter('2026-06-10T00:00:00.000Z')],
        now,
      ),
    ).toBeNull();
  });
});

describe('wordsExcerpt', () => {
  it('returns short text unchanged', () => {
    expect(wordsExcerpt('a short dream')).toBe('a short dream');
  });

  it('cuts long text to the max length with a trailing marker, never mid-setup PII', () => {
    const long = 'x'.repeat(200);
    const excerpt = wordsExcerpt(long, 60);
    expect(excerpt.length).toBeLessThanOrEqual(64);
    expect(excerpt.startsWith('x'.repeat(60))).toBe(true);
  });
});

describe('composeWordsAnniversaryBody', () => {
  it('quotes the excerpt and asks whether to keep carrying the words', () => {
    const body = composeWordsAnniversaryBody({
      years: 1,
      excerpt: 'a dream about open water',
      seed: 'UL-1:0',
    });
    expect(body).toContain('a dream about open water');
    assertNoPII(body);
  });

  it('never contains an em dash, across every template', () => {
    for (let i = 0; i < 20; i++) {
      const body = composeWordsAnniversaryBody({
        years: 1,
        excerpt: 'a dream',
        seed: `UL-${i}:0`,
      });
      expect(body).not.toMatch(/—/);
    }
  });

  it('varies the prose by seed and by year (not one canned string)', () => {
    const bodies = new Set<string>();
    for (let i = 0; i < 20; i++) {
      bodies.add(
        composeWordsAnniversaryBody({ years: 1, excerpt: 'a dream', seed: `UL-${i}:0` }),
      );
    }
    expect(bodies.size).toBeGreaterThan(1);
  });

  it('reads correctly for a multi-year gap catch-up (e.g. year 2)', () => {
    const body = composeWordsAnniversaryBody({ years: 2, excerpt: 'a dream', seed: 'UL-1:0' });
    expect(body).toContain('2 years');
    assertNoPII(body);
  });
});

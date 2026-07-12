/**
 * Unit tests for lib/atlas/homecoming.ts, the pure request-shaping logic for
 * the Homecoming (Phase 2.5): validating a submission and building the pending
 * record while enforcing the per-requester open-count ceiling.
 */
import { describe, expect, it } from 'vitest';
import {
  parseHomecomingInput,
  planHomecomingRequest,
  HOMECOMING_MAX_PHOTOS,
  HOMECOMING_MAX_OPEN_PER_REQUESTER,
  type HomecomingRequest,
} from '../../lib/atlas/homecoming';

const goodBody = {
  photoUrls: ['https://example.com/a.jpg', ' https://example.com/b.jpg '],
  provenance: 'Bought from a gallery in Santa Cruz around 2016.',
  cityId: 'santa-cruz',
  note: 'It has a small chip on the frame.',
};

describe('parseHomecomingInput', () => {
  it('accepts and trims a well-formed submission', () => {
    const res = parseHomecomingInput(goodBody);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.photoUrls).toEqual([
      'https://example.com/a.jpg',
      'https://example.com/b.jpg',
    ]);
    expect(res.value.provenance).toBe(goodBody.provenance);
    expect(res.value.cityId).toBe('santa-cruz');
    expect(res.value.note).toBe(goodBody.note);
  });

  it('drops the note when it is blank', () => {
    const res = parseHomecomingInput({ ...goodBody, note: '   ' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.note).toBeUndefined();
  });

  it('rejects an empty photo list', () => {
    const res = parseHomecomingInput({ ...goodBody, photoUrls: [] });
    expect(res.ok).toBe(false);
  });

  it('rejects when photos are not http links', () => {
    const res = parseHomecomingInput({
      ...goodBody,
      photoUrls: ['just some text'],
    });
    expect(res.ok).toBe(false);
  });

  it(`rejects more than ${HOMECOMING_MAX_PHOTOS} photos`, () => {
    const res = parseHomecomingInput({
      ...goodBody,
      photoUrls: Array(HOMECOMING_MAX_PHOTOS + 1).fill('https://example.com/x.jpg'),
    });
    expect(res.ok).toBe(false);
  });

  it('rejects a missing provenance', () => {
    const res = parseHomecomingInput({ ...goodBody, provenance: '   ' });
    expect(res.ok).toBe(false);
  });

  it('rejects a missing city', () => {
    const res = parseHomecomingInput({ ...goodBody, cityId: '' });
    expect(res.ok).toBe(false);
  });

  it('rejects non-object bodies', () => {
    expect(parseHomecomingInput(null).ok).toBe(false);
    expect(parseHomecomingInput('nope').ok).toBe(false);
    expect(parseHomecomingInput([]).ok).toBe(false);
  });
});

describe('planHomecomingRequest', () => {
  const input = {
    photoUrls: ['https://example.com/a.jpg'],
    provenance: 'came to me in Bali',
    cityId: 'bali',
  };
  const args = {
    input,
    requesterRef: 'user-1',
    requesterEmail: 'keeper@example.com',
    id: 'req-1',
    now: '2026-07-12T00:00:00.000Z',
  };

  it('builds a pending record stamped server-side', () => {
    const res = planHomecomingRequest([], args);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toMatchObject({
      id: 'req-1',
      requesterRef: 'user-1',
      requesterEmail: 'keeper@example.com',
      cityId: 'bali',
      status: 'pending',
      createdAt: '2026-07-12T00:00:00.000Z',
    });
    expect(res.value.note).toBeUndefined();
  });

  it('counts only this requester\'s pending requests against the ceiling', () => {
    const others: HomecomingRequest[] = Array.from(
      { length: HOMECOMING_MAX_OPEN_PER_REQUESTER },
      (_, i) => ({
        id: `other-${i}`,
        requesterRef: 'someone-else',
        requesterEmail: 'other@example.com',
        photoUrls: ['https://example.com/o.jpg'],
        provenance: 'x',
        cityId: 'bali',
        createdAt: '2026-07-01T00:00:00.000Z',
        status: 'pending' as const,
      }),
    );
    expect(planHomecomingRequest(others, args).ok).toBe(true);
  });

  it('refuses once the requester is at the open ceiling', () => {
    const mine: HomecomingRequest[] = Array.from(
      { length: HOMECOMING_MAX_OPEN_PER_REQUESTER },
      (_, i) => ({
        id: `mine-${i}`,
        requesterRef: 'user-1',
        requesterEmail: 'keeper@example.com',
        photoUrls: ['https://example.com/m.jpg'],
        provenance: 'x',
        cityId: 'bali',
        createdAt: '2026-07-01T00:00:00.000Z',
        status: 'pending' as const,
      }),
    );
    const res = planHomecomingRequest(mine, args);
    expect(res.ok).toBe(false);
  });

  it('does not count resolved requests against the ceiling', () => {
    const resolved: HomecomingRequest[] = Array.from(
      { length: HOMECOMING_MAX_OPEN_PER_REQUESTER + 2 },
      (_, i) => ({
        id: `done-${i}`,
        requesterRef: 'user-1',
        requesterEmail: 'keeper@example.com',
        photoUrls: ['https://example.com/d.jpg'],
        provenance: 'x',
        cityId: 'bali',
        createdAt: '2026-07-01T00:00:00.000Z',
        status: (i % 2 === 0 ? 'bound' : 'declined') as 'bound' | 'declined',
      }),
    );
    expect(planHomecomingRequest(resolved, args).ok).toBe(true);
  });
});

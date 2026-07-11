import React from 'react';
import { AccountContext, AccountState } from '../../lib/account/useAccount';
import StewardEdit from '../atlas/StewardEdit';

/**
 * TEMPORARY visual-QA harness for phase-2h (shared typeahead picker).
 * Not part of the app; mounts the real StewardEdit page with a mocked
 * signed-in session and mocked claim/update responses so the "Where it
 * rests" picker can be screenshotted without a real Better Auth session.
 * Delete before merge.
 */
const mockClaim = {
  ok: true,
  claimed: [
    {
      steward: {
        pieceId: 'UL-100',
        editionNumber: 1,
        email: 'qa@example.com',
        issuedAt: new Date().toISOString(),
        outreachStatus: 'claimed' as const,
        consent: {
          version: 1,
          capturedAt: new Date().toISOString(),
          capturedBy: 'qa-user',
          ring2MapPresence: true,
          ring3ChartPresence: 'deferred' as const,
          ring4: 'deferred' as const,
        },
      },
      piece: {
        pieceId: 'UL-100',
        editionNumber: 1,
        currentCityId: 'berlin-de',
        status: 'placed' as const,
        history: [],
        isPublic: true,
      },
    },
  ],
};

const mockAccount: AccountState = {
  available: true,
  isSignedIn: true,
  isLoaded: true,
  userId: 'qa-user',
  email: 'qa@example.com',
  fetchAuthed: async (input: string, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : String(input);
    if (url.includes('/api/atlas/steward/claim')) {
      return new Response(JSON.stringify(mockClaim), { status: 200 });
    }
    if (url.includes('/api/atlas/steward/update')) {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      const piece = {
        ...mockClaim.claimed[0].piece,
        ...(body.cityId !== undefined ? { currentCityId: body.cityId || null } : {}),
        ...(body.isPublic !== undefined ? { isPublic: body.isPublic } : {}),
      };
      return new Response(JSON.stringify({ ok: true, piece }), { status: 200 });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  },
};

const StewardQA: React.FC = () => (
  <AccountContext.Provider value={mockAccount}>
    <StewardEdit />
  </AccountContext.Provider>
);

export default StewardQA;

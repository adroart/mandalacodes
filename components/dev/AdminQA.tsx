import React from 'react';
import { AccountContext, AccountState } from '../../lib/account/useAccount';
import AdminAtlas from '../AdminAtlas';
import AdminPieceContent from '../AdminPieceContent';

/**
 * TEMPORARY visual-QA harness for phase-2h (shared typeahead picker).
 * Not part of the app; mounts the real admin pages with a mocked
 * signed-in + admin-verified session so AdminLayout's gate passes without
 * a real Better Auth session. Delete before merge.
 */
const mockAccount: AccountState = {
  available: true,
  isSignedIn: true,
  isLoaded: true,
  userId: 'qa-admin',
  email: 'qa-admin@example.com',
  fetchAuthed: async () =>
    new Response(JSON.stringify({ ok: true, stewards: [] }), { status: 200 }),
};

export const AdminAtlasQA: React.FC = () => (
  <AccountContext.Provider value={mockAccount}>
    <AdminAtlas />
  </AccountContext.Provider>
);

export const AdminPieceContentQA: React.FC = () => (
  <AccountContext.Provider value={mockAccount}>
    <AdminPieceContent />
  </AccountContext.Provider>
);

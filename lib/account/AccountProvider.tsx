import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ClerkProvider,
  useAuth,
  useUser,
} from '@clerk/clerk-react';
import { AccountContext, AccountState } from './useAccount';
import { LAUNCH_FLAGS } from '../../launchFlags';

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as
  | string
  | undefined;

export const isClerkConfigured: boolean = Boolean(CLERK_PUBLISHABLE_KEY);

/**
 * Shared accounts, NOT shared session. adrianrasmussen.com and mandalacodes.com
 * use ONE Clerk app (enabling-oyster-2) and ONE D1 user database, so it is the
 * same account, same password, same saved collections on both sites. A collector
 * signs in independently on each domain (one sign-in per domain), but it is the
 * same identity behind both.
 *
 * We deliberately do NOT use Clerk satellite domains here: that feature is a
 * paid plan in production. Free tier still gives a shared user pool from one app
 * across two domains — it only omits the automatic cross-domain session bridge,
 * which is the paid part. If a seamless single sign-in across both domains is
 * ever wanted, upgrade the Clerk plan and add satellite config (isSatellite /
 * domain / signInUrl) here. Until then, independent-login-shared-account is the
 * free, correct shape.
 */

/**
 * `AccountProvider` is the single place where the rest of the app reads
 * its sign-in state from. When Clerk has been provisioned (publishable key
 * set at build time) it mounts ClerkProvider and bridges Clerk's hooks into
 * AccountContext. Otherwise it provides stub values so the site keeps working
 * in guest mode and the code never has to special-case "Clerk not loaded".
 *
 * Mounting is gated only on the key being present — NOT on the accounts launch
 * flag — because the admin sign-in (/admin/*) and the atlas steward surfaces
 * (/atlas/claim, /atlas/edit) call Clerk hooks directly and would throw
 * "must be wrapped in <ClerkProvider>" if the provider were withheld. The
 * accounts flag instead gates the public /account surface via `available`
 * on the context (see ClerkAccountBridge below).
 */
export const AccountProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  if (!isClerkConfigured || !CLERK_PUBLISHABLE_KEY) return <>{children}</>;

  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      appearance={{
        variables: {
          colorPrimary: '#8c6b3f',         // bronze-600
          colorText: '#3a2e1f',            // wood-900
          colorBackground: '#fbf8f1',      // paper-50
          colorInputBackground: '#fbf8f1',
          colorInputText: '#3a2e1f',
          fontFamily: 'Lato, Helvetica, sans-serif',
          borderRadius: '4px',
        },
      }}
    >
      <ClerkAccountBridge>{children}</ClerkAccountBridge>
    </ClerkProvider>
  );
};

/**
 * Sits inside ClerkProvider, reads the real Clerk hooks, and publishes
 * the resulting state onto AccountContext. When the accounts launch flag is
 * on, it also runs the one-time sync-user request the first time it sees a
 * signed-in user, so the server upserts the corresponding row in D1. (No
 * Stripe — sales live on adrianrasmussen.com; this site only needs identity.)
 */
const ClerkAccountBridge: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const auth = useAuth();
  const user = useUser();
  const syncedFor = useRef<string | null>(null);

  const fetchAuthed = useCallback(
    async (input: string, init: RequestInit = {}) => {
      const token = await auth.getToken();
      const headers = new Headers(init.headers ?? {});
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return fetch(input, { ...init, headers });
    },
    [auth.getToken],
  );

  // First time we observe a signed-in user in this tab, ping the sync-user
  // endpoint so the server upserts the D1 users row. Idempotent server-side;
  // safe to retry. Gated on the accounts flag: while accounts are off, the
  // provider still mounts for admin/steward sign-in, but we don't write user
  // rows to D1 until the public accounts surface is live.
  useEffect(() => {
    if (!LAUNCH_FLAGS.accounts) return;
    if (!auth.isLoaded || !auth.isSignedIn || !auth.userId) return;
    if (syncedFor.current === auth.userId) return;
    syncedFor.current = auth.userId;
    fetchAuthed('/api/auth/sync-user', { method: 'POST' }).catch((err) => {
      // Non-fatal — Functions might not be deployed yet. Log to console
      // so a curious developer can spot it; users get a fully functional
      // signed-in state regardless.
      // eslint-disable-next-line no-console
      console.warn('[account] sync-user failed:', err);
    });
  }, [auth.isLoaded, auth.isSignedIn, auth.userId, fetchAuthed]);

  const value = useMemo<AccountState>(
    () => ({
      // `available` is the master switch for the public account features
      // (AuthButton, collections, profile sync, /account routes). It stays
      // gated on the launch flag even though the provider itself is mounted
      // for admin/steward sign-in.
      available: LAUNCH_FLAGS.accounts,
      isSignedIn: !!auth.isSignedIn,
      isLoaded: !!auth.isLoaded,
      userId: auth.userId ?? null,
      email: user.user?.primaryEmailAddress?.emailAddress ?? null,
      fetchAuthed,
    }),
    [auth.isLoaded, auth.isSignedIn, auth.userId, user.user, fetchAuthed],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
};

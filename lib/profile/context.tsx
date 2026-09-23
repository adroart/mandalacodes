import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAccount, type AccountState } from '../account/useAccount';
import { claimGuestProfile, loadProfile, saveProfile, clearProfile, type ProfileInputs, type StoredProfile } from './storage';
import { buildHologeneticProfile } from '../astrology/profile';
import { placeToUtc } from '../astrology/places';

interface ProfileContextValue {
  profile: StoredProfile | null;
  isLoading: boolean;
  syncError: string | null;
  save: (inputs: ProfileInputs) => Promise<void>;
  clear: () => Promise<void>;
  retrySync: () => void;
}

const ProfileContext = createContext<ProfileContextValue>({
  profile: null, isLoading: false, syncError: null,
  save: async () => undefined, clear: async () => undefined, retrySync: () => undefined,
});

const REMOTE_SYNC_ERROR = 'Your profile is saved on this device, but could not sync to your account.';
const REMOTE_DELETE_ERROR = 'Your profile could not be deleted from your account. Your device copy has been kept.';

function newerThan(left: StoredProfile, right: StoredProfile): boolean {
  return Date.parse(left.updatedAt) > Date.parse(right.updatedAt);
}

async function readRemote(account: Pick<AccountState, 'fetchAuthed'>, signal: AbortSignal) {
  const response = await account.fetchAuthed('/api/profile/get', { signal });
  if (response.status === 204) return null;
  if (!response.ok) throw new Error(`Profile download failed (${response.status})`);
  return (await response.json()) as StoredProfile;
}

async function putRemote(account: Pick<AccountState, 'fetchAuthed'>, profile: StoredProfile, signal?: AbortSignal) {
  const response = await account.fetchAuthed('/api/profile/put', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs: profile.inputs, computed: profile.computed }), signal,
  });
  if (!response.ok) throw new Error(`Profile upload failed (${response.status})`);
}

/** Status-checking delete boundary, exported for provider-mocked regressions. */
export async function deleteRemoteProfile(
  account: Pick<AccountState, 'fetchAuthed'>,
  signal?: AbortSignal,
): Promise<void> {
  const response = await account.fetchAuthed('/api/profile/delete', { method: 'DELETE', signal });
  if (!response.ok) throw new Error(`Profile deletion failed (${response.status})`);
}

/** Exported for focused lifecycle tests with a mocked account provider. */
export async function syncProfileForOwner(
  account: Pick<AccountState, 'fetchAuthed'>,
  ownerId: string,
  signal: AbortSignal,
): Promise<StoredProfile | null> {
  let local = loadProfile(ownerId);
  const remote = await readRemote(account, signal);
  if (signal.aborted) return null;
  // An existing account wins without consuming an unrelated guest profile.
  // A guest is claimed only when this account has no local or remote chart.
  if (!local && !remote) local = claimGuestProfile(ownerId);
  if (remote && (!local || newerThan(remote, local))) {
    if (signal.aborted) return null;
    saveProfile(remote, ownerId);
    return remote;
  }
  if (local && (!remote || newerThan(local, remote))) {
    if (signal.aborted) return null;
    await putRemote(account, local, signal);
    if (signal.aborted) return null;
  }
  return local ?? remote;
}

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const account = useAccount();
  const [profile, setProfile] = useState<StoredProfile | null>(() => loadProfile(null));
  const [profileOwner, setProfileOwner] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const operationRef = useRef(0);
  const syncControllerRef = useRef<AbortController | null>(null);
  const ownerId = account.available && account.isSignedIn ? account.userId : null;

  useEffect(() => {
    const operation = ++operationRef.current;
    const controller = new AbortController();
    syncControllerRef.current?.abort();
    syncControllerRef.current = controller;
    if (!account.isLoaded) {
      setLoading(true);
      return () => controller.abort();
    }
    if (!ownerId) {
      setProfile(loadProfile(null));
      setProfileOwner(null);
      setLoading(false);
      setSyncError(null);
      return () => controller.abort();
    }

    setProfile(loadProfile(ownerId));
    setProfileOwner(ownerId);
    setLoading(true);
    setSyncError(null);
    void syncProfileForOwner(account, ownerId, controller.signal)
      .then((next) => {
        if (operation === operationRef.current && !controller.signal.aborted) {
          setProfile(next);
          setProfileOwner(ownerId);
        }
      })
      .catch((error: unknown) => {
        if (operation === operationRef.current && !controller.signal.aborted) {
          setProfile(loadProfile(ownerId));
          setSyncError(loadProfile(ownerId) ? REMOTE_SYNC_ERROR : 'Your account profile could not be loaded. Try again.');
        }
      })
      .finally(() => {
        if (operation === operationRef.current && !controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [account.available, account.isLoaded, account.isSignedIn, account.userId, account.fetchAuthed, ownerId, retry]);

  const save = useCallback(async (inputs: ProfileInputs) => {
    const saveOwner = ownerId;
    const operation = ++operationRef.current;
    syncControllerRef.current?.abort();
    const controller = new AbortController();
    syncControllerRef.current = controller;
    const stored: StoredProfile = {
      inputs,
      computed: buildHologeneticProfile({ utcBirth: placeToUtc(inputs.date, inputs.time, inputs.place.tzId) }),
      updatedAt: new Date().toISOString(),
    };
    saveProfile(stored, saveOwner);
    setProfile(stored);
    setProfileOwner(saveOwner);
    setLoading(false);
    setSyncError(null);
    if (saveOwner) {
      try {
        await putRemote(account, stored, controller.signal);
      } catch {
        if (operation === operationRef.current) setSyncError(REMOTE_SYNC_ERROR);
        throw new Error(REMOTE_SYNC_ERROR);
      }
    }
  }, [account, ownerId]);

  const clear = useCallback(async () => {
    const clearOwner = ownerId;
    const operation = ++operationRef.current;
    syncControllerRef.current?.abort();
    const controller = new AbortController();
    syncControllerRef.current = controller;
    setSyncError(null);
    if (clearOwner) {
      try {
        await deleteRemoteProfile(account, controller.signal);
      } catch {
        if (operation === operationRef.current) setSyncError(REMOTE_DELETE_ERROR);
        throw new Error(REMOTE_DELETE_ERROR);
      }
    }
    if (operation !== operationRef.current || controller.signal.aborted) return;
    clearProfile(clearOwner);
    if (operation === operationRef.current) {
      setProfile(null);
      setProfileOwner(clearOwner);
      setLoading(false);
    }
  }, [account, ownerId]);

  const retrySync = useCallback(() => setRetry((value) => value + 1), []);
  const visibleProfile = profileOwner === ownerId ? profile : null;
  const value = useMemo(
    () => ({ profile: visibleProfile, isLoading, syncError, save, clear, retrySync }),
    [visibleProfile, isLoading, syncError, save, clear, retrySync],
  );
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
};

export function useProfile() {
  return useContext(ProfileContext);
}

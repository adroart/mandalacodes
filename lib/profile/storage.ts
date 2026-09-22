import type { HologeneticProfile } from '../astrology/types';

export interface ProfilePlace {
  label: string;     // "Denpasar, Bali, Indonesia"
  lat: number;
  lng: number;
  tzId: string;      // IANA, e.g. "Asia/Denpasar"
}

export interface ProfileInputs {
  date: string;      // YYYY-MM-DD local
  time: string;      // HH:MM 24h local
  place: ProfilePlace;
}

export interface StoredProfile {
  inputs: ProfileInputs;
  computed: HologeneticProfile;
  updatedAt: string; // ISO 8601
}

const GUEST_KEY = 'ul.profile.v1';
const USER_KEY_PREFIX = 'ul.profile.v1.user.';

function keyFor(ownerId: string | null): string {
  return ownerId ? `${USER_KEY_PREFIX}${encodeURIComponent(ownerId)}` : GUEST_KEY;
}

function parseProfile(raw: string | null): StoredProfile | null {
  if (!raw) return null;
  const parsed = JSON.parse(raw) as StoredProfile;
  // Minimal shape check so a stale schema doesn't crash the UI. We require
  // the chart itself so an older or partial profile is discarded and rebuilt.
  if (!parsed?.inputs?.place?.tzId || !parsed?.computed?.lifesWork) return null;
  return parsed;
}

/**
 * Read the saved profile from localStorage. Returns null if no profile is
 * saved or the stored shape can't be parsed.
 */
export function loadProfile(ownerId: string | null = null): StoredProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    return parseProfile(window.localStorage.getItem(keyFor(ownerId)));
  } catch {
    return null;
  }
}

export function saveProfile(profile: StoredProfile, ownerId: string | null = null): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(keyFor(ownerId), JSON.stringify(profile));
}

export function clearProfile(ownerId: string | null = null): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(keyFor(ownerId));
}

/** Move a real guest profile into an account slot when that guest signs in. */
export function claimGuestProfile(ownerId: string): StoredProfile | null {
  const guest = loadProfile(null);
  if (!guest) return null;
  saveProfile(guest, ownerId);
  clearProfile(null);
  return guest;
}

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { claimGuestProfile, loadProfile, saveProfile, type StoredProfile } from '../../lib/profile/storage';
import { deleteRemoteProfile, syncProfileForOwner } from '../../lib/profile/context';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

function profile(label: string, updatedAt: string): StoredProfile {
  return {
    inputs: { date: '1990-06-15', time: '14:30', place: { label, lat: 1, lng: 2, tzId: 'Asia/Makassar' } },
    computed: { lifesWork: { gate: 1, line: 1 } } as StoredProfile['computed'],
    updatedAt,
  };
}

function response(status: number, body?: StoredProfile): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn(async () => body),
  } as unknown as Response;
}

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: new MemoryStorage() });
});

describe('profile owner continuity', () => {
  it('preserves a legitimate guest profile across reload reads', () => {
    const guest = profile('Guest', '2026-09-20T00:00:00.000Z');
    saveProfile(guest);
    expect(loadProfile()).toEqual(guest);
    expect(loadProfile('account-a')).toBeNull();
  });

  it('claims a guest once without exposing account A to account B', () => {
    const guest = profile('Guest', '2026-09-20T00:00:00.000Z');
    saveProfile(guest);
    expect(claimGuestProfile('account-a')).toEqual(guest);
    expect(loadProfile()).toBeNull();
    expect(loadProfile('account-a')).toEqual(guest);
    expect(loadProfile('account-b')).toBeNull();
  });

  it('treats a first 204 as an empty remote and uploads the local profile', async () => {
    const local = profile('Account A', '2026-09-20T00:00:00.000Z');
    saveProfile(local, 'account-a');
    const empty = response(204);
    const fetchAuthed = vi.fn()
      .mockResolvedValueOnce(empty)
      .mockResolvedValueOnce(response(200));

    await expect(syncProfileForOwner({ fetchAuthed }, 'account-a', new AbortController().signal)).resolves.toEqual(local);
    expect(empty.json).not.toHaveBeenCalled();
    expect(fetchAuthed).toHaveBeenNthCalledWith(2, '/api/profile/put', expect.objectContaining({ method: 'PUT' }));
  });

  it('keeps a guest separate when an existing account profile is downloaded', async () => {
    const guest = profile('Guest', '2026-09-22T00:00:00.000Z');
    const remote = profile('Account A', '2026-09-20T00:00:00.000Z');
    saveProfile(guest);
    const fetchAuthed = vi.fn().mockResolvedValue(response(200, remote));
    await expect(syncProfileForOwner({ fetchAuthed }, 'account-a', new AbortController().signal)).resolves.toEqual(remote);
    expect(loadProfile()).toEqual(guest);
    expect(loadProfile('account-a')).toEqual(remote);
  });

  it('rejects a failed upload instead of reporting a completed sync', async () => {
    saveProfile(profile('Account A', '2026-09-20T00:00:00.000Z'), 'account-a');
    const fetchAuthed = vi.fn()
      .mockResolvedValueOnce(response(204))
      .mockResolvedValueOnce(response(503));
    await expect(syncProfileForOwner({ fetchAuthed }, 'account-a', new AbortController().signal))
      .rejects.toThrow('Profile upload failed (503)');
  });

  it('rejects a non-success DELETE response', async () => {
    const fetchAuthed = vi.fn().mockResolvedValue(response(500));
    await expect(deleteRemoteProfile({ fetchAuthed })).rejects.toThrow('Profile deletion failed (500)');
  });

  it('does not apply a stale remote read after logout or an account switch', async () => {
    const controller = new AbortController();
    let finish!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => { finish = resolve; });
    const fetchAuthed = vi.fn(async () => pending);
    const syncing = syncProfileForOwner({ fetchAuthed }, 'account-a', controller.signal);
    controller.abort();
    const newerLocal = profile('New save for A', '2026-09-22T00:00:00.000Z');
    saveProfile(newerLocal, 'account-a');
    finish(response(200, profile('Remote A', '2026-09-21T00:00:00.000Z')));
    await expect(syncing).resolves.toBeNull();
    expect(loadProfile('account-a')).toEqual(newerLocal);
    expect(loadProfile('account-b')).toBeNull();
  });
});

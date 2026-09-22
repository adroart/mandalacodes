import { afterEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();
vi.mock('../../lib/account/auth.server.js', () => ({
  createAuth: () => ({ api: { getSession } }),
}));

const { isAuthResponse, requireAdmin } = await import('../../functions/api/_lib/auth.ts');

function request() {
  return new Request('https://mandalacodes.com/api/atlas/catalog/admin');
}

function session(email: string, emailVerified: boolean) {
  getSession.mockResolvedValue({
    user: { id: 'admin-1', email, emailVerified },
    session: { id: 'session-1' },
  });
}

afterEach(() => vi.clearAllMocks());

describe('requireAdmin', () => {
  it('accepts a verified allowlisted session', async () => {
    session('Admin@Example.com', true);
    const result = await requireAdmin(request(), { DB: {}, ADMIN_EMAILS: ' admin@example.com ' });
    expect(isAuthResponse(result)).toBe(false);
    if (!isAuthResponse(result)) expect(result.emailVerified).toBe(true);
  });

  it('returns 403 for an unverified allowlisted session', async () => {
    session('admin@example.com', false);
    const result = await requireAdmin(request(), { DB: {}, ADMIN_EMAILS: 'admin@example.com' });
    expect(isAuthResponse(result)).toBe(true);
    if (isAuthResponse(result)) expect(result.status).toBe(403);
  });

  it('returns 401 for an absent session', async () => {
    getSession.mockResolvedValue(null);
    const result = await requireAdmin(request(), { DB: {}, ADMIN_EMAILS: 'admin@example.com' });
    expect(isAuthResponse(result)).toBe(true);
    if (isAuthResponse(result)) {
      expect(result.status).toBe(401);
      await expect(result.json()).resolves.toEqual({ ok: false, error: 'unauthorized' });
    }
  });

  it('returns 403 for a signed-in email outside the allowlist', async () => {
    session('other@example.com', true);
    const result = await requireAdmin(request(), { DB: {}, ADMIN_EMAILS: 'admin@example.com' });
    expect(isAuthResponse(result)).toBe(true);
    if (isAuthResponse(result)) expect(result.status).toBe(403);
  });

  it('fails closed when the allowlist is empty', async () => {
    session('admin@example.com', true);
    const result = await requireAdmin(request(), { DB: {}, ADMIN_EMAILS: ' , ' });
    expect(isAuthResponse(result)).toBe(true);
    if (isAuthResponse(result)) expect(result.status).toBe(403);
  });
});

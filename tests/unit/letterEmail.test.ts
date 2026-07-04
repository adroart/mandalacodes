/**
 * Courtesy email copy for atlas letters (functions/api/atlas/_email.ts) —
 * the ratified notification-channel decision, GO-LIVE-RUNBOOK.md "Decision
 * records (2026-07-02)": wire atlas letters to Resend, addressed to the
 * steward's own bound email, fire-and-forget.
 *
 * The HTTP-layer hook points (functions/api/atlas/_letters.ts,
 * functions/api/atlas/steward/letters.ts) need a Workers runtime (R2) this
 * suite deliberately does not stand up — same split as tests/unit/letters.test.ts
 * versus its HTTP callers. What IS pure and unit-testable, and covered here:
 *
 *   - letterEmailSubject / letterEmailBody: the pure formatting, in the
 *     site's voice (no em dashes, a middle-dot separator, one line back to
 *     the steward's own page).
 *   - sendLetterEmail: the no-key no-op (RESEND_API_KEY unset), the no-op on
 *     an empty recipient, the Resend request shape when a key IS set, and
 *     that every failure mode (non-2xx response, thrown network error) is
 *     swallowed rather than propagated — a send must never fail or delay
 *     the letter write or the API response that triggered it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  letterEmailBody,
  letterEmailSubject,
  sendLetterEmail,
} from '../../functions/api/atlas/_email';

describe('letterEmailSubject', () => {
  it('reads like the letter category, in the site voice (no em dashes)', () => {
    expect(letterEmailSubject('kin-claim')).toBe(
      'A letter from your piece · a kin has come to light',
    );
    expect(letterEmailSubject('anniversary')).toBe(
      'A letter from your piece · an anniversary',
    );
    expect(letterEmailSubject('transfer')).toBe(
      'A letter from your piece · new hands',
    );
  });

  it('never contains an em dash', () => {
    for (const kind of ['kin-claim', 'anniversary', 'transfer'] as const) {
      expect(letterEmailSubject(kind)).not.toMatch(/—/);
    }
  });
});

describe('letterEmailBody', () => {
  it('contains the letter body verbatim plus one line to the steward page', () => {
    const body = letterEmailBody('Tonight a piece sharing my Water trigram came to light.');
    expect(body).toContain('Tonight a piece sharing my Water trigram came to light.');
    expect(body).toContain('https://mandalacodes.com/atlas/edit');
  });

  it('never contains an em dash', () => {
    const body = letterEmailBody('A year ago today you set me alight.');
    expect(body).not.toMatch(/—/);
  });
});

describe('sendLetterEmail', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('is a silent no-op when RESEND_API_KEY is unset — never calls fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await sendLetterEmail(
      {},
      { to: 'steward@example.com', subject: 'A letter from your piece', body: 'Hello.' },
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is a silent no-op when the recipient is empty, even with a key set', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await sendLetterEmail(
      { RESEND_API_KEY: 'rk_test' },
      { to: '', subject: 'A letter from your piece', body: 'Hello.' },
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts to Resend with the same shape as the sign-in-code sender when a key is set', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await sendLetterEmail(
      { RESEND_API_KEY: 'rk_test', RESEND_FROM_EMAIL: 'noreply@mandalacodes.com' },
      {
        to: 'steward@example.com',
        subject: 'A letter from your piece · an anniversary',
        body: 'A year ago today you set me alight.',
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer rk_test');
    const sentBody = JSON.parse(init.body as string);
    expect(sentBody.to).toEqual(['steward@example.com']);
    expect(sentBody.from).toContain('noreply@mandalacodes.com');
    expect(sentBody.subject).toBe('A letter from your piece · an anniversary');
    expect(sentBody.text).toBe('A year ago today you set me alight.');
  });

  it('falls back to the default sender when RESEND_FROM_EMAIL is unset', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await sendLetterEmail(
      { RESEND_API_KEY: 'rk_test' },
      { to: 'steward@example.com', subject: 'A letter from your piece', body: 'Hello.' },
    );

    const [, init] = fetchMock.mock.calls[0];
    const sentBody = JSON.parse(init.body as string);
    expect(sentBody.from).toContain('noreply@mandalacodes.com');
  });

  it('swallows a non-2xx Resend response instead of throwing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetchMock = vi.fn().mockResolvedValue(new Response('bad request', { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      sendLetterEmail(
        { RESEND_API_KEY: 'rk_test' },
        { to: 'steward@example.com', subject: 'A letter from your piece', body: 'Hello.' },
      ),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalled();
  });

  it('swallows a thrown network error instead of throwing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      sendLetterEmail(
        { RESEND_API_KEY: 'rk_test' },
        { to: 'steward@example.com', subject: 'A letter from your piece', body: 'Hello.' },
      ),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalled();
  });
});

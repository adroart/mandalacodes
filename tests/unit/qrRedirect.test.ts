import { describe, expect, it } from 'vitest';
import { onRequest as cardQr } from '../../functions/qr/[number].js';
import { onRequest as oracleQr } from '../../functions/qr/oracle.js';
import { onRequest as pieceQr } from '../../functions/qr/piece/[[path]].js';

describe('permanent QR redirects', () => {
  it('preserves every card destination from 1 through 64', () => {
    for (let n = 1; n <= 64; n++) {
      const response = cardQr({ params: { number: String(n) } });
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe(
        `https://mandalacodes.com/universal-language/${n}?ref=qr`,
      );
    }
  });

  it.each(['01', '064'])('preserves the digit-only legacy alias %s', (number) => {
    const response = cardQr({ params: { number } });
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      `https://mandalacodes.com/universal-language/${Number(number)}?ref=qr`,
    );
  });

  it.each([
    '1junk', '64junk', '1.5', '1e1', '0x10', '+1', '-1', ' 1', '1 ',
    '1\n', '1/2', '', '0', '65', '9999999999999999999999999',
  ])('rejects invalid card input %j without a redirect', async (number) => {
    const response = cardQr({ params: { number } });
    expect(response.status).toBe(404);
    expect(response.headers.get('location')).toBeNull();
    expect(await response.text()).toBe('Not found');
  });

  it('preserves both oracle gateway handlers', () => {
    for (const response of [cardQr({ params: { number: 'oracle' } }), oracleQr()]) {
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toBe('https://mandalacodes.com/?ref=qr');
    }
  });

  it.each([
    { path: ['synthetic-piece'], destination: '/piece/synthetic-piece' },
    { path: ['synthetic-piece', '2'], destination: '/piece/synthetic-piece/2' },
  ])('preserves physical piece routes $destination', ({ path, destination }) => {
    const response = pieceQr({ params: { path } });
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(`https://mandalacodes.com${destination}?ref=qr`);
  });
});

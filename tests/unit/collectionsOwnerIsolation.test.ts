import { describe, expect, it } from 'vitest';
import { collectionsForActiveUser, type Collection } from '../../lib/collections/context';

const saved: Collection[] = [{
  id: 1, name: 'Account A', createdAt: '2026-09-22T00:00:00.000Z', items: [],
}];

describe('collection owner isolation', () => {
  it('retains successful data while refreshing the same account', () => {
    expect(collectionsForActiveUser(saved, 'account-a', 'account-a')).toEqual(saved);
  });

  it('hides account A records in the first render for account B', () => {
    expect(collectionsForActiveUser(saved, 'account-a', 'account-b')).toEqual([]);
  });

  it('hides records immediately after logout', () => {
    expect(collectionsForActiveUser(saved, 'account-a', null)).toEqual([]);
  });
});

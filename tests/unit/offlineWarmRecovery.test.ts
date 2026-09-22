import { afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ fail: true, calls: [] as number[] }));
vi.mock('../../data/synthesisData', () => ({ getSynthesis: async (n: number) => {
  state.calls.push(n);
  if (n === 7 && state.fail) throw new Error('offline');
  return {};
} }));
vi.mock('../../data/cardMarkdown', () => ({ getParsedCard: async () => ({}) }));
import { warmOracleForOffline } from '../../lib/oracle/offlineWarm';
afterEach(() => vi.unstubAllGlobals());
it('retries only failed prose after connectivity recovery without trusting storage', async () => {
  const queue: Array<() => void> = [];
  let online = () => {};
  vi.stubGlobal('window', {
    setTimeout: (fn: () => void) => queue.push(fn),
    addEventListener: (_: string, fn: () => void) => { online = fn; },
    localStorage: { getItem: () => { throw new Error('blocked'); } },
  });
  vi.stubGlobal('navigator', { onLine: true, serviceWorker: {} });
  const drain = async () => {
    for (let i = 0; i < 70; i++) { queue.shift()?.(); await new Promise(r => setTimeout(r, 0)); }
  };
  warmOracleForOffline({ startAt: 7 });
  warmOracleForOffline({ startAt: 8 });
  await drain();
  expect(state.calls).toHaveLength(64);
  state.fail = false;
  online();
  await drain();
  expect(state.calls).toHaveLength(65);
  expect(state.calls.at(-1)).toBe(7);
  warmOracleForOffline();
  await drain();
  expect(state.calls).toHaveLength(65);
});

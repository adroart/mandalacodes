import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * The site is a PWA, so a returning visitor is served by a service worker
 * rather than by Cloudflare. Workbox's default worker calls skipWaiting only
 * in response to a SKIP_WAITING message, and nothing in this app sends one:
 * injectRegister 'script-defer' writes a registration and no messaging. With
 * that default a freshly deployed worker installs, sits in "waiting", and does
 * not take over until every tab of the site is closed, while the browser keeps
 * serving the previous build's index.html out of the precache.
 *
 * Measured on the live site on 2026-09-03: a new worker was still waiting after
 * a full navigation, and the page showed the previous release. Anyone who
 * leaves a tab open, or has the app installed, is frozen on the version they
 * first arrived on. These two flags are what make a deploy reach people, so
 * they are guarded rather than left to be quietly dropped in a later edit.
 */
describe('the service worker hands over to a new build', () => {
  it('activates at once instead of waiting for every tab to close', async () => {
    const config = await readFile(resolve('vite.config.ts'), 'utf8');
    expect(config).toContain('skipWaiting: true');
  });

  it('claims the pages that are already open', async () => {
    const config = await readFile(resolve('vite.config.ts'), 'utf8');
    expect(config).toContain('clientsClaim: true');
  });

  it('registers the worker at all, which is what makes the above load-bearing', async () => {
    const config = await readFile(resolve('vite.config.ts'), 'utf8');
    expect(config).toContain('injectRegister');
    expect(config).toContain("registerType: 'autoUpdate'");
  });
});

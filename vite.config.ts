import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Serve the static /learn library during dev. In production Cloudflare Pages
 * serves public/learn/... as real files (they win over the SPA fallback), but
 * the dev server doesn't resolve directory indexes, so /learn and
 * /learn/some-article would 404 locally and the seam between the two surfaces
 * could never be checked in dev. Requires public/learn to exist — run
 * `npm run build:content` once (the root build always regenerates it).
 */
const learnStatic = (): Plugin => ({
  name: 'serve-learn-static',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = (req.url ?? '').split('?')[0];
      if (!url.startsWith('/learn')) return next();
      const learnRoot = path.resolve(__dirname, 'public');
      const file = path.join(learnRoot, decodeURIComponent(url));
      // Files with extensions (css, xml, images) are served by Vite's own
      // public-dir handling; only directory-style URLs need help.
      if (path.extname(file)) return next();
      const index = path.join(file, 'index.html');
      if (fs.existsSync(index)) {
        res.setHeader('Content-Type', 'text/html');
        res.end(fs.readFileSync(index));
        return;
      }
      if (!fs.existsSync(path.join(learnRoot, 'learn'))) {
        res.statusCode = 503;
        res.end('The /learn library is not built yet — run: npm run build:content');
        return;
      }
      next();
    });
  },
});

// Offline support for the oracle (reading deck + Hologenetic Profile), scoped
// by what gets cached rather than by route — see docs/offline-oracle.md.
// Precache is deliberately narrow (the always-needed shell + the birth-place
// index); everything else — the 64 cards' text/art, and anything from
// Atlas/admin/account a visitor happens to open — is cached at runtime the
// first time it's actually fetched, so a device that never visits those
// surfaces never downloads their (much larger) chunks.
const vitePWA = VitePWA({
  registerType: 'autoUpdate',
  manifest: false, // public/site.webmanifest is hand-maintained and already linked from index.html
  injectRegister: 'script-defer',
  workbox: {
    globDirectory: 'dist',
    // Default limit is 2 MiB; the bundled cities index (for offline
    // birth-place search) is ~4.1 MB and is exactly the kind of static,
    // essentially-never-changing file precaching exists for.
    maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
    globPatterns: [
      '*.html',
      'assets/index-*.{js,css}',
      'assets/*.woff2',
      'favicon.svg',
      'site.webmanifest',
      'data/cities-index.json',
    ],
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [/^\/api\//, /^\/qr\//],
    cleanupOutdatedCaches: true,
    /* Without these two the worker installs and then SITS in "waiting" until
       every tab of the site is closed, because the only skipWaiting workbox
       writes by default is one that fires on a SKIP_WAITING message nobody
       sends (injectRegister: 'script-defer' registers the worker and nothing
       else). Measured on the live site: a new worker stayed waiting through a
       full navigation and the browser kept serving the previous build's
       index.html out of the precache, so anyone who leaves a tab open, or has
       the app installed, is frozen on whatever version they first arrived on.
       skipWaiting activates the new worker at once, clientsClaim hands it the
       pages already open, and the next navigation serves the new build. Safe
       here because every chunk filename is content-hashed: a page mid-session
       that asks for an old chunk still finds it in the runtime cache. */
    skipWaiting: true,
    clientsClaim: true,
    runtimeCaching: [
      {
        // Every other same-origin JS/CSS chunk (the 64 card readings, the
        // deck index, Atlas, admin, …) — cached the first time a visit
        // actually loads it. Content-hashed filenames never change under a
        // given URL, so CacheFirst never needs to revalidate.
        urlPattern: ({ url, sameOrigin }) =>
          sameOrigin && url.pathname.startsWith('/assets/') && /\.(?:js|css)$/.test(url.pathname),
        handler: 'CacheFirst',
        options: {
          cacheName: 'oracle-app-chunks',
          expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 180 },
        },
      },
      // The artwork is deliberately NOT cached by the worker.
      //
      // It was, under CacheFirst, and the rule rested on a premise that is not
      // true: the comment said every <img> rendering a piece sets
      // crossOrigin="anonymous", so every cached response would be a real one.
      // Seven img tags fetch the same host without it (AdminAtlas,
      // AdminPieceContent, PiecePage, ArtworkPlate, StewardClaim), so opaque
      // and CORS responses shared one cache under the same keys, and a return
      // visit replayed an entry the request could not accept.
      //
      // Measured on the live site, twice, before and after the skipWaiting
      // change landed: a first visit loaded the card artwork and lost 37 to 57
      // of the prefetched images, and the return visit rendered 0 of 2, both
      // of them broken. Firefox reported it as the worker rejecting the fetch
      // and then the image failing CORS; Chrome as a bare ERR_FAILED.
      //
      // The browser's own cache already holds these immutable, far-future
      // Cloudinary URLs, so nothing is lost on a normal repeat visit. What is
      // given up is artwork while fully offline, which was not working anyway.
    ],
  },
});

export default defineConfig({
  plugins: [react(), learnStatic(), vitePWA],
  resolve: {
    alias: {
      '@': '/',
    },
  },
  server: {
    port: 2222,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
});

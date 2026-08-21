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
      {
        // Card artwork. Every <img> that renders one already sets
        // crossOrigin="anonymous" so the cached response is a real (not
        // opaque) one — opaque entries can't be size-checked and would
        // pad the storage quota by tens of MB apiece.
        urlPattern: ({ url }) => url.hostname === 'res.cloudinary.com',
        handler: 'CacheFirst',
        options: {
          cacheName: 'oracle-artwork',
          expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 180 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
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

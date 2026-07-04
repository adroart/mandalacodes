import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
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

export default defineConfig({
  plugins: [react(), learnStatic()],
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

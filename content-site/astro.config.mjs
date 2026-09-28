import { defineConfig } from 'astro/config'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react from '@astrojs/react'
import markdoc from '@astrojs/markdoc'
import sitemap from '@astrojs/sitemap'
import keystatic from '@keystatic/astro'
import tailwindcss from '@tailwindcss/vite'

// Keystatic's admin UI needs server routes, which only exist in `astro dev`.
// Production builds stay fully static (no adapter needed), so the editor is
// available through `npm run write` at 127.0.0.1:4322/keystatic, never shipped
// to Cloudflare. The writer overrides base to `/` for Keystatic's root routes.
const isDev = process.argv.includes('dev')

// Use the rendered robots directive as the source of truth: notes and empty
// categories keep their URLs but must not be advertised as indexable pages.
let outputDirectory = new URL('./dist/', import.meta.url)
const sitemapOutput = {
  name: 'learn-sitemap-output',
  hooks: {
    'astro:config:done': ({ config }) => { outputDirectory = config.outDir },
  },
}
const indexablePage = (page) => {
  const pathname = new URL(page).pathname.replace(/^\/learn\/?/, '').replace(/\/$/, '')
  const file = new URL(pathname ? `${pathname}/index.html` : 'index.html', outputDirectory)
  const html = readFileSync(file, 'utf8')
  return !/<meta\b(?=[^>]*\bname=["']robots["'])(?=[^>]*\bcontent=["'][^"']*\bnoindex\b)[^>]*>/i.test(html)
}

export default defineConfig({
  site: 'https://mandalacodes.com',
  base: '/learn',
  integrations: [react(), markdoc(), sitemapOutput, sitemap({ filter: indexablePage }), ...(isDev ? [keystatic()] : [])],
  vite: {
    // The site bar is the app's own component (../components/NavigationCore.tsx
    // via NavigationStatic), rendered here so the two surfaces can never drift.
    // Tailwind compiles its classes from the shared theme contract — see
    // src/styles/site-bar.css.
    plugins: [tailwindcss(), {
      name: 'writing-preview-shared-assets',
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          const pathname = (request.url || '').split('?')[0]
          // The writer is a separate server; share only these public assets.
          if (!/^\/fonts\/[a-zA-Z0-9_.-]+\.woff2?$/.test(pathname) && pathname !== '/favicon.svg') return next()
          const asset = fileURLToPath(new URL(`../public${pathname}`, import.meta.url))
          if (!existsSync(asset)) return next()
          response.setHeader('Content-Type', pathname.endsWith('.svg') ? 'image/svg+xml' : pathname.endsWith('.woff2') ? 'font/woff2' : 'font/woff')
          response.end(readFileSync(asset))
        })
      },
    }, {
      name: 'writer-upload-preview',
      configureServer(server) {
        if (server.config.base !== '/') return
        // Upload paths retain the published prefix; map only this directory
        // to the writer's public files without changing saved article URLs.
        server.middlewares.use((request, _response, next) => {
          if (request.url?.startsWith('/learn/images/articles/')) {
            request.url = request.url.slice('/learn'.length)
          }
          next()
        })
      },
    }],
    // ONE React rule. The bar's source lives in the ROOT repo, whose own
    // node_modules carries react 18; this package renders with react 19. Any
    // react resolution that leaks to the root copy (or gets bundled as a second
    // instance) kills prerender — either "Objects are not valid as a React
    // child" (18 elements into a 19 renderer) or "Cannot read useState of null"
    // (bundled react beside the renderer's external react). So:
    //   - ssr.external keeps every react import a bare specifier, resolved by
    //     node at prerender time from THIS package: one CJS instance shared
    //     with @astrojs/react's renderer.
    //   - noExternal bundles lucide-react so its react import goes through the
    //     same rule. This package carries its own lucide-react built for react
    //     19; the root repo carries a different major built for react 18.
    //   - dedupe covers the browser bundle, pinning root-file imports to this
    //     package's react AND lucide-react. lucide-react is load-bearing here:
    //     without the dedupe the SSR pass renders this package's icons (react 19)
    //     while the client bundle resolves the root's older icons, whose SVG
    //     geometry differs (e.g. Menu: <path> vs <line>) — an irreconcilable
    //     hydration mismatch that tears the whole site bar down on every /learn
    //     page. Deduping lucide-react pins both passes to this one copy.
    resolve: { dedupe: ['react', 'react-dom', 'lucide-react'] },
    ssr: { external: ['react', 'react-dom'], noExternal: ['lucide-react'] },
    server: {
      fs: { allow: ['..'] },
      proxy: { '/media/': { target: 'https://mandalacodes.com', changeOrigin: true } },
    },
  },
})

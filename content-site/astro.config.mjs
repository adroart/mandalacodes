import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import markdoc from '@astrojs/markdoc'
import sitemap from '@astrojs/sitemap'
import keystatic from '@keystatic/astro'
import tailwindcss from '@tailwindcss/vite'

// Keystatic's admin UI needs server routes, which only exist in `astro dev`.
// Production builds stay fully static (no adapter needed), so the editor is
// available at localhost:4321/learn/keystatic but never shipped to Cloudflare.
const isDev = process.argv.includes('dev')

export default defineConfig({
  site: 'https://mandalacodes.com',
  base: '/learn',
  integrations: [react(), markdoc(), sitemap(), ...(isDev ? [keystatic()] : [])],
  vite: {
    // The site bar is the app's own component (../components/NavigationCore.tsx
    // via NavigationStatic), rendered here so the two surfaces can never drift.
    // Tailwind compiles its classes from the shared theme contract — see
    // src/styles/site-bar.css.
    plugins: [tailwindcss()],
    // ONE React rule. The bar's source lives in the ROOT repo, whose own
    // node_modules carries react 18; this package renders with react 19. Any
    // react resolution that leaks to the root copy (or gets bundled as a second
    // instance) kills prerender — either "Objects are not valid as a React
    // child" (18 elements into a 19 renderer) or "Cannot read useState of null"
    // (bundled react beside the renderer's external react). So:
    //   - ssr.external keeps every react import a bare specifier, resolved by
    //     node at prerender time from THIS package: one CJS instance shared
    //     with @astrojs/react's renderer.
    //   - noExternal bundles lucide-react (it only exists in the root
    //     node_modules) so its react import goes through the same rule.
    //   - dedupe covers the browser bundle, pinning root-file imports to this
    //     package's react for hydration.
    resolve: { dedupe: ['react', 'react-dom'] },
    ssr: { external: ['react', 'react-dom'], noExternal: ['lucide-react'] },
    server: { fs: { allow: ['..'] } },
  },
})

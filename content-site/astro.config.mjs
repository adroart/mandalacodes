import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import markdoc from '@astrojs/markdoc'
import sitemap from '@astrojs/sitemap'
import keystatic from '@keystatic/astro'

// Keystatic's admin UI needs server routes, which only exist in `astro dev`.
// Production builds stay fully static (no adapter needed), so the editor is
// available at localhost:4321/learn/keystatic but never shipped to Cloudflare.
const isDev = process.argv.includes('dev')

export default defineConfig({
  site: 'https://mandalacodes.com',
  base: '/learn',
  integrations: [react(), markdoc(), sitemap(), ...(isDev ? [keystatic()] : [])],
})

import type { APIContext } from 'astro'
import { getIndexableArticles } from '../lib/articles'

// llms.txt: a markdown index of this site's content for AI systems.
// Spec: https://llmstxt.org. Served at /learn/llms.txt; the root
// /llms.txt (in the main repo's public/) points here.
export async function GET(context: APIContext) {
  const articles = await getIndexableArticles()
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  const origin = context.site!.origin

  const lines = [
    '# Mandala Codes · Learn',
    '',
    '> Articles on mandala art, its creation, geometry, history, and traditions.',
    '> This index includes completed articles. Research notes remain accessible',
    '> in the library while their full articles are developed.',
    '',
    `The interactive deck lives at ${origin}/universal-language (cards 1–64).`,
    '',
    '## Articles',
    '',
    ...articles.map(
      article =>
        `- [${article.data.title}](${origin}${base}/${article.id}/): ${article.data.description.replace(/\s+/g, ' ').trim()}`
    ),
    '',
    '## Optional',
    '',
    `- [RSS feed](${origin}${base}/rss.xml)`,
    `- [Sitemap](${origin}${base}/sitemap-index.xml)`,
    '',
  ]

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

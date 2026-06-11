import type { APIContext } from 'astro'
import { getPublishedArticles } from '../lib/articles'

// llms.txt — a markdown index of this site's content for AI systems.
// Spec: https://llmstxt.org. Served at /learn/llms.txt; the root
// /llms.txt (in the main repo's public/) points here.
export async function GET(context: APIContext) {
  const articles = await getPublishedArticles()
  const base = import.meta.env.BASE_URL
  const origin = context.site!.origin

  const lines = [
    '# Mandala Codes · Learn',
    '',
    '> Essays and reference articles on mandalas, the I Ching, Gene Keys, and',
    '> Human Design — the living library behind the Universal Language oracle,',
    '> a reading deck of 64 mandala paintings by Adrian Rasmussen.',
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

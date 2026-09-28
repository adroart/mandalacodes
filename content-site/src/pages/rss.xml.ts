import rss from '@astrojs/rss'
import type { APIContext } from 'astro'
import { getPublishedArticles } from '../lib/articles'

export async function GET(context: APIContext) {
  const articles = await getPublishedArticles()
  const base = import.meta.env.BASE_URL

  return rss({
    title: 'Mandala Codes · Learn',
    description:
      'Essays and reference articles on mandalas, the I Ching, Gene Keys, and Human Design.',
    site: context.site!,
    items: articles.map(article => ({
      title: article.data.title,
      description: article.data.description,
      pubDate: article.data.pubDate,
      link: `${base}/${article.id}/`,
      categories: article.data.tags,
    })),
  })
}

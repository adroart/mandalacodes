import rss from '@astrojs/rss'
import type { APIContext } from 'astro'
import { getIndexableArticles } from '../lib/articles'

export async function GET(context: APIContext) {
  const articles = await getIndexableArticles()
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')

  return rss({
    title: 'Mandala Codes · Learn',
    description:
      'Articles on mandala art, its creation, geometry, history, and traditions.',
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

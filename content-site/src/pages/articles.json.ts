import { getPublishedArticles, toView } from '../lib/articles'

export const prerender = true

/** Small public index for the deck's reciprocal links into the library. */
export async function GET() {
  const articles = await getPublishedArticles()
  const linked = articles.flatMap((article, index) => {
    const relatedCard = article.data.relatedCard
    if (article.data.draft || typeof relatedCard !== 'number' || !Number.isInteger(relatedCard) || relatedCard < 1 || relatedCard > 64) return []
    const view = toView(article, index)
    return [{
      id: article.id,
      title: article.data.title,
      description: article.data.description,
      relatedCard,
      cover: view.cover,
    }]
  })

  return new Response(JSON.stringify(linked), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

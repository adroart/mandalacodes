import { getCollection, type CollectionEntry } from 'astro:content'

export type Article = CollectionEntry<'articles'>

/** Published articles, newest first. Drafts never leave the build machine. */
export async function getPublishedArticles(): Promise<Article[]> {
  const articles = await getCollection('articles', ({ data }) => !data.draft)
  return articles.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
}

import type { Article } from './articles'

export const SITE_URL = 'https://mandalacodes.com'

/** Public metadata must resolve independently of the current page URL. */
export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).href
}

/** Prevent editorial text from terminating an inline JSON-LD script. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}

export function articleMetadata(article: Article, image: string): Record<string, unknown>[] {
  const { data } = article
  const canonical = absoluteUrl(`/learn/${article.id}/`)
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: data.title,
      description: data.description,
      datePublished: data.pubDate.toISOString(),
      ...(data.updatedDate && { dateModified: data.updatedDate.toISOString() }),
      ...(data.tags.length && { keywords: data.tags.join(', ') }),
      mainEntityOfPage: canonical,
      image: absoluteUrl(image),
      ...(data.author && {
        author: {
          '@type': 'Person',
          name: data.author,
          ...(data.authorUrl && { url: data.authorUrl }),
        },
      }),
      publisher: { '@type': 'Organization', name: 'Mandala Codes', url: SITE_URL },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Learn', item: absoluteUrl('/learn/') },
        { '@type': 'ListItem', position: 2, name: data.title, item: canonical },
      ],
    },
  ]
}

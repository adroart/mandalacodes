import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const optionalWebUrl = z.union([
  z.literal(''),
  z.string().url().regex(/^https?:\/\//i, 'Use an http:// or https:// URL'),
]).optional()

const articles = defineCollection({
  loader: glob({ pattern: '**/*.mdoc', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.string().optional(),
    authorUrl: optionalWebUrl,
    editorialStatus: z.enum(['article', 'research-note']).default('article'),
    sources: z.array(z.object({
      title: z.string().min(1),
      url: optionalWebUrl,
    })).default([]),
    tags: z.array(z.string()).default([]),
    relatedCard: z.number().int().min(1).max(64).optional(),
    draft: z.boolean().default(false),

    // ── Learn-library presentation (all optional; sensible fallbacks apply) ──
    /** Known library category; older entries may omit it or leave it blank. */
    field: z.enum(['', 'Creation Stories', 'Foundations', 'Traditions', 'Symbolism & Geometry', 'History']).optional(),
    /** Cultural origin shown beside the field, e.g. "Tibet", "Universal". */
    culture: z.string().optional(),
    /** Media object ID of the cover artwork, e.g. "1_o8tafh". Falls back to a deck plate when omitted. */
    cover: z.string().optional(),
    /** Uploaded artwork takes priority over the existing media ID. */
    coverImage: z.string().optional(),
    coverAlt: z.string().optional(),
    coverCaption: z.string().optional(),
    coverCredit: z.string().optional(),
    /** Legacy value retained for compatibility; published reading time is always computed from the body. */
    readTime: z.string().optional(),
    /** Lift this article into the Library spotlight band. At most one should be true. */
    spotlight: z.boolean().default(false),
  }).refine(data => !data.updatedDate || data.updatedDate >= data.pubDate, {
    message: 'Last updated must be on or after the publish date.',
    path: ['updatedDate'],
  }),
})

export const collections = { articles }

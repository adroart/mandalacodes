import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const articles = defineCollection({
  loader: glob({ pattern: '**/*.mdoc', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    relatedCard: z.number().int().min(1).max(64).optional(),
    draft: z.boolean().default(false),

    // ── Learn-library presentation (all optional; sensible fallbacks apply) ──
    /** Field of study, e.g. "Foundations", "Traditions", "Symbolism & Geometry", "History". Drives the filter tabs and per-field accent tint. */
    field: z.string().optional(),
    /** Cultural origin shown beside the field, e.g. "Tibet", "Universal". */
    culture: z.string().optional(),
    /** Media object ID of the cover artwork, e.g. "1_o8tafh". Falls back to a deck plate when omitted. */
    cover: z.string().optional(),
    /** Estimated reading time, e.g. "9 min". Computed from body length when omitted. */
    readTime: z.string().optional(),
    /** Lift this article into the Library spotlight band. At most one should be true. */
    spotlight: z.boolean().default(false),
  }),
})

export const collections = { articles }

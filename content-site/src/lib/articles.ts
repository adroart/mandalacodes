import { getCollection, type CollectionEntry } from 'astro:content'

export type Article = CollectionEntry<'articles'>

/** Published articles, newest first. Drafts never leave the build machine. */
export async function getPublishedArticles(): Promise<Article[]> {
  const articles = await getCollection('articles', ({ data }) => !data.draft)
  return articles.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
}

// ───────────────────────── presentation layer ─────────────────────────
// Recreates the design's `renderVals()` logic so the Library landing and the
// Reading Room share one source of truth for covers, tints, plates and meta.

/** Project-owned Cloudflare media URL at a given size (square by default). */
export function cloud(id: string, w: number, h?: number): string {
  return `/media/image/${id.split('/').map(encodeURIComponent).join('/')}?w=${w}&h=${h ?? w}&gravity=center`
}

/** Deck plates used as elegant fallbacks when an article has no cover set. */
const FALLBACK_COVERS = [
  '1_o8tafh', '29_lhj3ug', '11_rtesiu', '46_hqh9va', '45_xjnohi',
  '5_egctcj', '2_kvndyq', '60_eoiule', '30_fp8gza', '56_boey2k',
]

export const FIELDS = [
  'Foundations',
  'Traditions',
  'Symbolism & Geometry',
  'History',
] as const

/** Tab definitions: short label, the field value it filters to, and the URL slug. */
export const TABS: { label: string; value: string; slug: string }[] = [
  { label: 'All', value: 'All', slug: '' },
  { label: 'Foundations', value: 'Foundations', slug: 'foundations' },
  { label: 'Traditions', value: 'Traditions', slug: 'traditions' },
  { label: 'Geometry', value: 'Symbolism & Geometry', slug: 'geometry' },
  { label: 'History', value: 'History', slug: 'history' },
]

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

// Quiet per-field hue, blended ~22% toward the base accent so it stays bronze-family.
const HUE: Record<string, string> = {
  Foundations: '#caa14a',
  Traditions: '#c2742f',
  'Symbolism & Geometry': '#5f9a86',
  History: '#b85c3c',
}

/** Blend two hex colors. t = amount toward b. Concrete hex, no color-mix dependency. */
export function mix(a: string, b: string, t: number): string {
  const p = (h: string) => {
    h = h.replace('#', '')
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
  }
  const [r1, g1, b1] = p(a)
  const [r2, g2, b2] = p(b)
  const m = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0')
  return `#${m(r1, r2)}${m(g1, g2)}${m(b1, b2)}`
}

const ACCENT = '#c4a878'

/** Per-field accent tint, robust real hex (theme-independent). */
export function fieldTint(field: string): string {
  return mix(ACCENT, HUE[field] || ACCENT, 0.22)
}

/** Slug for a field's category page, e.g. "Symbolism & Geometry" -> "geometry". */
export function fieldSlug(field: string): string {
  return (TABS.find(t => t.value === field) || { slug: '' }).slug
}

/** ~200 wpm reading estimate from the rendered body length. */
export function estimateRead(body: string): string {
  const words = body.trim().split(/\s+/).filter(Boolean).length
  return `${Math.max(1, Math.round(words / 200))} min`
}

export interface ArticleView {
  id: string
  title: string
  description: string
  field: string
  culture: string
  cover: string // square cover for rows/medallions/related
  coverWide: string // landscape cover for spotlight/figure
  heroWide: string // large landscape for hero
  read: string
  date: string
  dateShort: string
  roman: string
  plate: string
  tint: string
  spotlight: boolean
}

const DATE_LONG = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

/** Decorate a raw article entry into the view-model the design templates expect. */
export function toView(article: Article, index: number): ArticleView {
  const d = article.data
  const field = d.field || 'Foundations'
  const coverId = d.cover || FALLBACK_COVERS[index % FALLBACK_COVERS.length]
  const read = d.readTime || estimateRead(article.body ?? '')
  return {
    id: article.id,
    title: d.title,
    description: d.description,
    field,
    culture: d.culture || 'Universal',
    cover: cloud(coverId, 460),
    coverWide: cloud(coverId, 900, 680),
    heroWide: cloud(coverId, 1700, 1050),
    read,
    date: DATE_LONG.format(d.pubDate),
    dateShort: DATE_LONG.format(d.pubDate),
    roman: ROMAN[index] || String(index + 1),
    plate: String(coverId.split('_')[0]).padStart(2, '0'),
    tint: fieldTint(field),
    spotlight: d.spotlight,
  }
}

import { config, collection, fields } from '@keystatic/core'

// Local mode: run `npm run dev` in content-site/, open
// http://localhost:4321/learn/keystatic and every save writes a .mdoc file to
// src/content/articles/ — commit and push to publish.
//
// To edit from the browser in production later, switch to GitHub mode:
//   storage: { kind: 'github', repo: { owner: 'adroart', name: 'mandalacodes' } }
// and change each collection path to 'content-site/src/content/articles/*'
// (GitHub mode resolves paths from the repo root, local mode from this folder).
// That also requires creating the Keystatic GitHub App — see
// https://keystatic.com/docs/github-mode

export default config({
  storage: { kind: 'local' },

  ui: {
    brand: { name: 'Mandala Codes · Learn' },
  },

  collections: {
    articles: collection({
      label: 'Articles',
      slugField: 'title',
      path: 'src/content/articles/*',
      entryLayout: 'content',
      format: { contentField: 'body' },
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),

        description: fields.text({
          label: 'Description',
          description: 'Meta description for search engines and link previews (~155 characters).',
          multiline: true,
          validation: { isRequired: true },
        }),

        pubDate: fields.date({
          label: 'Publish date',
          validation: { isRequired: true },
        }),

        updatedDate: fields.date({
          label: 'Last updated',
          validation: { isRequired: false },
        }),

        tags: fields.array(
          fields.text({ label: 'Tag' }),
          { label: 'Tags', itemLabel: props => props.value ?? 'Tag' }
        ),

        relatedCard: fields.number({
          label: 'Related card (1–64)',
          description: 'Optional. Links the article to a Universal Language card page.',
          validation: { isRequired: false, min: 1, max: 64 },
        }),

        field: fields.select({
          label: 'Field of study',
          description: 'Drives the Library filter tabs and the per-field accent tint.',
          options: [
            { label: 'Foundations', value: 'Foundations' },
            { label: 'Traditions', value: 'Traditions' },
            { label: 'Symbolism & Geometry', value: 'Symbolism & Geometry' },
            { label: 'History', value: 'History' },
          ],
          defaultValue: 'Foundations',
        }),

        culture: fields.text({
          label: 'Culture / origin',
          description: 'Shown beside the field, e.g. "Tibet", "Universal". Optional.',
        }),

        cover: fields.text({
          label: 'Cover image (media ID)',
          description: 'Public id of the cover artwork, e.g. "1_o8tafh". Falls back to a deck plate when blank.',
        }),

        readTime: fields.text({
          label: 'Reading time',
          description: 'e.g. "9 min". Computed from the body when blank.',
        }),

        spotlight: fields.checkbox({
          label: 'Spotlight',
          description: 'Lift this article into the Library spotlight band. Use on at most one article.',
          defaultValue: false,
        }),

        draft: fields.checkbox({
          label: 'Draft',
          description: 'Drafts are excluded from the published site, RSS, sitemap, and llms.txt.',
          defaultValue: false,
        }),

        body: fields.markdoc({
          label: 'Content',
        }),
      },
    }),
  },
})

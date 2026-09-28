import { config, collection, fields } from '@keystatic/core'

const optionalWebUrl = {
  pattern: {
    regex: /^(?:https?:\/\/[^\s]+)?$/i,
    message: 'Use a complete http:// or https:// URL, or leave blank.',
  },
}

// Local mode: run `npm run write` in content-site/, open
// http://127.0.0.1:4322/keystatic and every save writes a .mdoc file to
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
      previewUrl: '/{slug}',
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
          description: 'Optional. Must be on or after the publish date.',
          validation: { isRequired: false },
        }),

        author: fields.text({
          label: 'Author',
          description: 'The person who wrote this article. Leave blank until attribution is confirmed.',
        }),

        authorUrl: fields.text({
          label: 'Author website',
          validation: optionalWebUrl,
        }),

        editorialStatus: fields.select({
          label: 'Editorial status',
          description: 'Mark unfinished research as a research note. Use Draft to keep an entry unpublished.',
          options: [
            { label: 'Article', value: 'article' },
            { label: 'Research note', value: 'research-note' },
          ],
          defaultValue: 'article',
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
            { label: 'Creation Stories', value: 'Creation Stories' },
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

        coverImage: fields.image({
          label: 'Cover image upload',
          description: 'Upload the artwork or process photograph featured in this article. Takes priority over the media ID.',
          directory: 'public/images/articles',
          publicPath: '/learn/images/articles/',
        }),

        coverAlt: fields.text({
          label: 'Cover alternative text',
          description: 'Describe what is visible for readers who cannot see the image.',
        }),

        coverCaption: fields.text({
          label: 'Cover caption',
          description: 'Identify the actual artwork, detail, or process shown. Do not infer its cultural origin from the article topic.',
          multiline: true,
        }),

        coverCredit: fields.text({
          label: 'Cover credit',
          description: 'Confirmed artist or photographer attribution and any required licence credit.',
        }),

        sources: fields.array(
          fields.object({
            title: fields.text({
              label: 'Reference',
              description: 'Author, title, publication, date, and page numbers where relevant.',
              validation: { isRequired: true },
            }),
            url: fields.text({
              label: 'Source URL',
              description: 'Optional for print books or other offline sources.',
              validation: optionalWebUrl,
            }),
          }),
          { label: 'Sources and further reading', itemLabel: props => props.fields.title.value || 'Source' },
        ),

        readTime: fields.text({
          label: 'Reading time (legacy)',
          description: 'Retained for older articles and ignored when publishing. Reading time is always computed from the body.',
        }),

        spotlight: fields.checkbox({
          label: 'Spotlight',
          description: 'Lift this article into the Library spotlight band. Use on at most one article.',
          defaultValue: false,
        }),

        draft: fields.checkbox({
          label: 'Draft',
          description: 'Drafts are excluded from the published site, RSS, sitemap, and llms.txt.',
          defaultValue: true,
        }),

        body: fields.markdoc({
          label: 'Content',
          options: {
            heading: [2, 3, 4],
            image: {
              directory: 'public/images/articles',
              publicPath: '/learn/images/articles/',
              schema: {
                alt: fields.text({
                  label: 'Alternative text',
                  description: 'Describe the visible artwork or process.',
                }),
                title: fields.text({
                  label: 'Caption and credit',
                  description: 'Displayed below an image placed on its own line. Include confirmed artwork or photographer credits.',
                }),
              },
            },
          },
        }),
      },
    }),
  },
})

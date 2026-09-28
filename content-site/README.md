# content-site — the Learn library

Astro + Keystatic content engine for `mandalacodes.com/learn`. Every article
is a plain `.mdoc` (Markdoc) file in `src/content/articles/` — versioned in
git, readable by humans and AI alike.

## Writing workflow

```bash
npm run write        # from the repo root or this directory
```

Then open <http://127.0.0.1:4322/keystatic> for the writing editor.
The main area supports headings, paragraphs, lists, quotations, links, tables,
and images. The sidebar holds dates, author attribution, artwork details,
sources, and publication settings. Every save writes to `src/content/articles/`.

The writer uses a separate local server because Keystatic's editor and API
expect root-level paths. Its `--base /` option applies only to this command;
published articles retain their `/learn/` URLs. For the normal site preview,
run `npm run dev` in this directory and open <http://127.0.0.1:4321/learn/>.
Both servers read the same article files. Image upload paths stay suitable for
publication; the writer also serves those paths for local image previews.
After saving an article, use the editor's Preview link to review it locally.
Draft previews are available only during development and remain unpublished.

Prefer a text editor? Just create a `.mdoc` file by hand — Keystatic is a UI
over the files, not a database. Copy `_TEMPLATE.mdoc` to a new descriptive
filename for the current frontmatter shape and writing prompts.

Articles with `draft: true` are excluded from the site, RSS, sitemap, and
llms.txt until you flip the flag.

New entries created in the editor start as drafts. Existing articles keep
their current publication state. A **Research note** label identifies an
unfinished or exploratory piece; it does not hide it. Use **Draft** when the
piece should remain unpublished. There is no minimum article length: publish
when the piece delivers its purpose and its claims are supported.

## Writing about a creation

Select **Creation Stories** as the field for an account of a particular work
or creative process. Give the article a specific title and a description that
accurately introduces it. Useful sections include:

- The work: its confirmed title, medium, dimensions, date, and present context.
- The starting point: the question, observation, or experience behind it.
- The making: materials, sketches, decisions, changes, and process photographs.
- Looking closely: details readers can see, and what those choices mean to the creator.
- Reflection: what changed during the process and what remains open.

These are prompts, not mandatory sections. Distinguish personal interpretation
from historical claims, and add sources for the latter. Enter an author or
artwork credit only when confirmed; blank attribution stays blank.

## Artwork and photographs

**Cover image upload** accepts an image of the actual work or process. It takes
priority over the existing **Cover image (media ID)** field, which remains
available for the site's media library. The alternative text describes what
is visible. The caption identifies the image; the credit records the confirmed
artist or photographer and any required licence wording. A research article's
subject does not establish the origin of its cover image.

Use the image control in the body editor to upload process shots or artwork
details. Place an image in its own paragraph and fill in **Caption and credit**
to display a caption below it. In a text editor, the equivalent is:

```markdown
![Description of what is visible](/learn/images/articles/your-article/detail.jpg "Confirmed caption and credit")
```

Replace the example path with the path from a real upload. Uploaded files are
stored under `content-site/public/images/articles/` and published under
`/learn/images/articles/`; commit those image files with the article. Keep
images at a reasonable size for the web. Inline images within prose remain
ordinary images rather than figures.

## Sources and publication

Use **Sources and further reading** for a reference list. Include an author,
title, publication, date, and relevant page numbers in **Reference**. Add a
complete HTTP(S) URL for online sources; leave the URL blank for print sources.
Link supporting evidence close to the corresponding claim in the body as well.
Author website URLs also require HTTP(S).

Choose one of the listed library fields; unrecognised categories fail content
validation. A last-updated date must be on or after the publish date. Published
reading time is always calculated from the body; the legacy reading-time field
is retained for older files and has no effect on the displayed estimate.

Before publishing, preview the article, check its images and links, confirm
author and artwork attribution, and check factual claims against their sources.
Keep unfinished work marked as a draft. When ready, set the publish date and
turn off **Draft**, then commit the article and its images. Pushing to `main`
triggers the configured Cloudflare Pages build. Saving in the editor alone
does not publish the article.

## How it ships

The deck's related-article links read the static `/learn/articles.json` index.
Its focused test stays inside this Astro project so the main app's TypeScript
check does not import Astro-only modules. Run it from the repository root:

```bash
./node_modules/.bin/vitest run --root content-site --config ../vitest.config.ts tests/unit/related-articles-index.test.ts
```

The root `npm run build` (via `prebuild` → `build:content`) builds this site
and copies `content-site/dist/` into `public/learn/`, which Vite then carries
into the deployed `dist/`. Cloudflare Pages serves these as real static HTML
files — they win over the SPA fallback, so crawlers and AI bots get full
content with zero JavaScript.

## SEO / AI surface (all generated per build)

- `/learn/sitemap-index.xml` — sitemap (also listed in `public/robots.txt`)
- `/learn/rss.xml` — RSS feed
- `/learn/llms.txt` — markdown index of all articles for AI systems
  (referenced from the root `/llms.txt` in `public/`)
- Per-article: canonical URL, Open Graph/Twitter meta, `Article` +
  `BreadcrumbList` JSON-LD

## Editing from the browser in production (later, optional)

Keystatic currently runs in **local mode** (dev server only — nothing admin
ships to production). To write from any browser at a hosted URL, switch
`keystatic.config.ts` to GitHub mode and create the Keystatic GitHub App:
<https://keystatic.com/docs/github-mode>. GitHub mode resolves paths from the
repo root, so the collection path becomes `content-site/src/content/articles/*`.
The admin would then need a host with server routes (e.g. a small separate
Pages/Workers project) — the published articles stay fully static either way.

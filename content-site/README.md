# content-site — the Learn library

Astro + Keystatic content engine for `mandalacodes.com/learn`. Every article
is a plain `.mdoc` (Markdoc) file in `src/content/articles/` — versioned in
git, readable by humans and AI alike.

## Writing workflow

```bash
npm run write        # from the repo root (or this directory)
```

Then open <http://127.0.0.1:4322/keystatic> — a full editing UI with
rich text, tags, dates, artwork uploads, author attribution, and a draft toggle. Every save writes a markdown file
to `src/content/articles/`. Commit on a working branch and merge its reviewed
PR to publish through Cloudflare Pages.

Prefer a text editor? Just create a `.mdoc` file by hand — Keystatic is a UI
over the files, not a database. See `what-is-a-mandala.mdoc` for the
frontmatter shape.

New articles start as drafts. The editor preview opens a private local page for
drafts; only articles with `draft: false` appear in the published site, RSS,
sitemap, and llms.txt. Uploaded artwork lives in
`content-site/public/images/articles/` and is published under
`/learn/images/articles/`. Save the image file with the article.

## How it ships

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

## Hosted browser writer pilot

The optional writer build serves `/keystatic` and `/api/keystatic` through
Netlify Functions. It uses Keystatic Cloud authentication and GitHub storage,
while the normal `npm run build` remains the static Cloudflare Pages build.
The build uses these **Netlify Free** settings:

| Netlify setting | Value |
| --- | --- |
| Base directory | `content-site` |
| Plan | Free ($0, hard monthly limit) |
| Build command | `npm ci && npm run build:writer` |
| Publish directory | `dist` (relative to the base directory) |
| Environment | `NODE_VERSION=22.22.3`, `PUBLIC_KEYSTATIC_CLOUD_PROJECT=mandalacodes-editor/editor-pilot` |

The existing pilot is <https://mandalacodes-editor-pilot.netlify.app/keystatic>
(Netlify site `c23f82b6-864e-4cb6-b164-ea15a91fc89c`). The public Cloud
project identifier is `mandalacodes-editor/editor-pilot`; its Primary URL is
the pilot's `netlify.app` URL. The Cloud project is connected only to
`adroart/mandalacodes`. The pilot was built with Node 22.22.3 and verified
on Netlify Free ($0, hard monthly credit limit), without a payment method.

Cloud mode scopes the article and image paths to `content-site/` in GitHub.
Use a fresh working branch from protected `main`, save the article and artwork,
then open and review a GitHub PR. The editor does not create that PR.
`branchPrefix` remains unset; select and verify the working branch in the
hosted editor before each save. The live pilot verified branch selection and
saves on a disposable branch. Published
article URLs and image paths stay under `/learn/` after merge and Pages rebuild.
The hosted editor has no branch-aware draft preview; use local `npm run write`
for private draft preview. Production article routes still exclude drafts.

The deployed pilot uses source commit
`977d8fbd9c648e74e525652df3f270dce1367c24`, deploy
`6afab25db39969828bd6ac38`. Live testing signed in through Cloud, created
and saved a synthetic draft on disposable branch
`learn/editor-pilot-synthetic-20261116`, reopened and edited it, and uploaded
cover and body images that matched the GitHub blobs byte for byte. An
anonymous browser saw the login gate, and an unauthenticated upload returned
401. The disposable article and images remain off `main`. These results prove
that deployed revision; a new revision requires its own verification.

### Repeat an exact-source direct deploy

Use an existing authenticated Netlify CLI session. In a clean checkout of the
approved revision, from `content-site/`, run:

```bash
npm ci
PUBLIC_KEYSTATIC_CLOUD_PROJECT=mandalacodes-editor/editor-pilot npm run build:writer
npx --yes --package netlify-cli@27.19.0 netlify deploy --prod --no-build --dir dist --functions .netlify/v1/functions --site c23f82b6-864e-4cb6-b164-ea15a91fc89c --message "writer source $(git rev-parse HEAD)" --json
```

Record the checkout SHA, generated function, Netlify deploy ID, and live URL
together. `--functions` is required: the first pilot upload omitted it and
served static files without the editor's server route. The corrected upload
included one SSR function and returned 200 at `/keystatic`. A direct CLI upload
does not require Netlify access to the GitHub repository. Keep the site on
Netlify Free with no card or upgrade. Production editor shell visibility is
Public; Cloud sign-in gates editing. Deploy Previews are Private and do not
provide branch-aware draft previews.

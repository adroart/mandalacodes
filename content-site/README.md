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

The optional writer build serves `/keystatic` and `/api/keystatic` from a
separate Astro Node service. It uses Keystatic Cloud authentication and GitHub
storage, while the normal `npm run build` remains the static Pages build.
Configure a **free Render web service** against a reviewed pilot branch:

| Render setting | Value |
| --- | --- |
| Root directory | `content-site` |
| Runtime / plan | Node / Free |
| Build command | `npm ci && npm run build:writer` |
| Start command | `node dist/server/entry.mjs` |
| Environment | `HOST=0.0.0.0`, `NODE_VERSION=22.22.3`, `PUBLIC_KEYSTATIC_CLOUD_PROJECT=<team>/<project>` |

The project identifier is public. Create it in a dedicated Keystatic Cloud
team, connect only `adroart/mandalacodes`, and grant the intended editor account.
Test on Render's `onrender.com` URL before adding a domain. The build was
tested with Node 22.22.3. Do not turn on a paid plan for this pilot.

Cloud mode scopes the article and image paths to `content-site/` in GitHub.
Use a fresh working branch from protected `main`, save the article and artwork,
then open and review a GitHub PR. The editor does not create that PR.
`branchPrefix` remains unset pending a real branch selection test. Published
article URLs and image paths stay under `/learn/` after merge and Pages rebuild.
The hosted editor has no branch-aware draft preview; use local `npm run write`
for private draft preview. Production article routes still exclude drafts.

Local pilot checks: a fresh `npm ci` in `content-site/` followed by
`PUBLIC_KEYSTATIC_CLOUD_PROJECT=pilot/example npm run build:writer` succeeded
without root dependencies. The generated browser config contains Cloud storage,
the `content-site` prefix, the article path, and `/learn/images/articles/`.
The normal static build succeeded with no server or editor artifact. An
anonymous local request received the editor HTML shell; sampled local Cloud
API URLs returned 404. These responses do not establish live Cloud permissions.

Before calling the pilot operational, sign in through the hosted URL, save and
reopen a draft on a disposable branch, upload a cover and body image, inspect
the resulting `.mdoc` and image paths in GitHub, and verify an unauthenticated
visitor cannot save or upload. Repository content is public, so article reads
need not be private. Keep test content off `main`.

# content-site — the Learn library

Astro + Keystatic content engine for `mandalacodes.com/learn`. Every article
is a plain `.mdoc` (Markdoc) file in `src/content/articles/` — versioned in
git, readable by humans and AI alike.

## Writing workflow

```bash
npm run write        # from the repo root (or `npm run dev` in here)
```

Then open <http://localhost:4321/learn/keystatic> — a full editing UI with
rich text, tags, dates, and a draft toggle. Every save writes a markdown file
to `src/content/articles/`. Commit and push to `main` and Cloudflare Pages
publishes it.

Prefer a text editor? Just create a `.mdoc` file by hand — Keystatic is a UI
over the files, not a database. See `what-is-a-mandala.mdoc` for the
frontmatter shape.

Articles with `draft: true` are excluded from the site, RSS, sitemap, and
llms.txt until you flip the flag.

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

## Editing from the browser in production (later, optional)

Keystatic currently runs in **local mode** (dev server only — nothing admin
ships to production). To write from any browser at a hosted URL, switch
`keystatic.config.ts` to GitHub mode and create the Keystatic GitHub App:
<https://keystatic.com/docs/github-mode>. GitHub mode resolves paths from the
repo root, so the collection path becomes `content-site/src/content/articles/*`.
The admin would then need a host with server routes (e.g. a small separate
Pages/Workers project) — the published articles stay fully static either way.

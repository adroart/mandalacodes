# Mandala Codes

The Universal Language oracle — a reading deck of 64 mandalas connecting the I Ching, Gene Keys, and Human Design. Lives at [mandalacodes.com](https://mandalacodes.com).

## Stack

- Vite + React 18 + TypeScript + Tailwind CSS 4 + React Router v7
- Cloudflare Pages (auto-deploys from `main`)
- Cloudflare Functions for `/qr/:n` redirects + per-card OG meta injection
- Source of truth for the 64 cards: `oracle/oracle_cards_complete.json`

## Run locally

```bash
npm install
npm run dev      # http://localhost:2222
npm run build    # production build to dist/
```

## Writing (Learn library)

Articles live in `content-site/` (Astro + Keystatic) and publish as static
HTML under `/learn/*`. Run `npm run write` and open
http://localhost:4321/learn/keystatic to write in a CMS UI; every save is a
markdown file in `content-site/src/content/articles/`. Commit + push to
publish. See `content-site/README.md`.

## Routes

- `/` — redirects to `/universal-language` (the QR-arrival gateway lives at `/gateway`, still reachable directly)
- `/learn` — the Learn library (static articles, RSS, llms.txt, sitemap)
- `/the-systems` — explainer for I Ching / Gene Keys / Human Design
- `/universal-language` — deck index, all 64 cards
- `/universal-language/:n` — individual card reader (1–64)
- `/qr/:n` — Cloudflare Function redirect for printed plaques → `/universal-language/:n?ref=qr`

## QR plaque contract

Physical plaques encode `mandalacodes.com/qr/:n` (and legacy plaques on adrianrasmussen.com/qr/:n redirect here). Both URLs resolve. **Never delete `functions/qr/[number].js` on either domain** — the plaques are printed and in the wild.

## Relationship to adrianrasmussen.com

The 64 paintings exist on both sites. mandalacodes.com is the oracle reader; adrianrasmussen.com is where the paintings are sold. "View the original" CTAs on card pages link out to the art site. One Stripe account, one inventory, no checkout on mandalacodes.

# SEO And AI Search Research — mandalacodes.com

Last updated: 2026-05-28

This folder governs the SEO and AI-citation strategy for **mandalacodes.com**.

## Editorial Mission

mandalacodes.com is **a resource for understanding mandalas** — their symbolism, history, sacred geometry, oracle traditions, and contemporary practice. Edited by Adrian Rasmussen.

The site is **value-first, not promotional**. No commerce, no shop, no buy buttons. Articles are written *about* mandalas, not by Adrian as a salesperson. When Adrian's perspective appears in essays, it is named and contextualized ("As an artist working in layered laser-cut wood, I have found…"). His personal first-person essays live on adrianrasmussen.com.

The site provides three things:

1. **The Universal Language oracle** — 64 cards connecting the I Ching, Gene Keys, and Human Design. Already live.
2. **Editorial mandala content** — long-form articles on mandala art, history, sacred geometry, and traditions. To be built.
3. **Featured mandala artists** — Adrian as the first featured artist, with the directory broadening over time. To be built.

## Two-Domain Strategy (2026-05-28)

The mandala authority strategy spans two domains with deliberate role separation:

- **mandalacodes.com (this site)** — **category and topic** authority. Targets keywords like `mandala art`, `sacred geometry mandala art`, `mandala meaning`, `mandala symbolism`, `mandala artists`, `commission a mandala`. Owns the editorial four-article cluster, the oracle, and the Featured Artists section.
- **adrianrasmussen.com** — **artist entity** authority. Targets `Adrian Rasmussen artist`, `Adrian Rasmussen mandala`, `Bali mandala artist`. Owns Adrian's portfolio, individual artwork pages, his first-person essays about his practice, his Mandala hub focused on his specific work.

### How the two sites work together without cannibalizing each other

1. **Canonical tags resolve duplication**. Individual mandala artwork pieces have their canonical URL on **adrianrasmussen.com** (artworks live there as the primary record). If mandalacodes features the same piece in a Featured Artist context, that page uses `<link rel="canonical" href="https://adrianrasmussen.com/...">`.
2. **Hub pages target different intent**. mandalacodes.com/mandalas would target the category (informational, exploratory). adrianrasmussen.com/creations/mandala targets Adrian's specific practice (biographical, portfolio).
3. **Articles live on one site only**. Mandala-category articles (the four-article cluster + deeper editorial) canonicalize to mandalacodes. Adrian's first-person essays canonicalize to adrianrasmussen.
4. **`sameAs` schema links connect the two as one entity**. mandalacodes' Person schema for Adrian uses `sameAs: ["https://adrianrasmussen.com/about"]`. Adrian's Person schema on adrianrasmussen.com uses `sameAs: ["https://mandalacodes.com/about-adrian"]`. Google reads them as the same entity, not competing.

## Files In This Folder

- `2026-05-28-page-targets.md` — Which pages on mandalacodes target which keywords. The route plan.
- `2026-05-28-featured-artist-page-spec.md` — Spec for the Featured Mandala Artists section and the page template per artist.
- `2026-05-28-article-cluster-plan.md` — The four-article editorial cluster + the deeper editorial pieces to follow.

## Companion Files Outside This Folder

These live elsewhere because they are too large for the repo or because they govern both domains:

- **Master plan** — `~/Documents/Obsidian Vault/4 Outputs/mandalas/_master-plan.md`. The cross-domain strategy.
- **Outreach intelligence** — `~/Documents/Obsidian Vault/4 Outputs/mandalas/_outreach-intelligence.md`. Six tiers of outreach including Tier 0 collaborations.
- **Top sources for writing** — `~/Documents/Obsidian Vault/4 Outputs/mandalas/_top-sources-for-writing.md`. Curated five-best-source picks per article.
- **Collaboration outreach templates** — `~/Documents/Obsidian Vault/4 Outputs/mandalas/_collaboration-outreach-templates.md`. DM and email templates per collaboration shape.
- **Research corpus** — `~/Documents/Obsidian Vault/5 Sources/mandalas/`. 482 markdown files across 20 working subtopics, master index at `_README.md`. Reproducible via `~/builds/mandala-research.sh`.
- **adrianrasmussen.com SEO docs** — `Adrian-Website/docs/research/seo/`. The artist-portfolio SEO strategy. The two strategies are designed to complement each other.

## Canonical Domain

`https://mandalacodes.com` is the canonical domain for this site. All canonicals, sitemap URLs, structured data references, and outreach destination links use this exact form (HTTPS, no www, no trailing slash on the root).

## Current Strategic Thesis

mandalacodes.com has a structural SEO advantage adrianrasmussen.com can never have: **the domain name is the keyword**. Owning a domain that semantically matches the topic gives the site a built-in ranking signal for category searches.

The strategy is to compound that advantage with:

1. **Substantive editorial content** that AI models (Google AI Overviews, ChatGPT, Perplexity, Gemini) cite when answering mandala questions.
2. **A Featured Mandala Artists directory** that establishes mandalacodes as the destination people land on when looking for contemporary mandala artists. Adrian first; others over time.
3. **The Universal Language oracle** as the site's signature interactive experience and the reason people stay and explore.
4. **Cross-linking with adrianrasmussen.com** that reinforces both entities without competing.

The 12-month target: appear in AI answers for category prompts like "who are contemporary mandala artists making original artwork?", "what is sacred geometry mandala art?", "where can I learn about mandalas?", and "who creates wooden mandala sculptures?".

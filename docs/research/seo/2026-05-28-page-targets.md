# mandalacodes.com — Page Targets

Last updated: 2026-05-28

The route plan and SEO targets for mandalacodes.com. Maps each page to its primary keywords, supporting keywords, intent, and authority strategy.

## Current Routes (live)

| Route | Purpose | Primary Keywords | SEO Status |
|---|---|---|---|
| `/` | Gateway / deck entrance | `mandala oracle`, `universal language oracle` | Live, needs editorial mission stated |
| `/the-systems` | Explainer for I Ching / Gene Keys / Human Design | `i ching gene keys human design`, `64 archetypes` | Live |
| `/universal-language` | Deck index — all 64 cards | `mandala deck`, `64 mandalas` | Live |
| `/universal-language/:n` | Individual card reader | `mandala card [n]`, card-specific symbolic terms | Live, per-card OG meta via Cloudflare Function |
| `/qr/:n` | Plaque redirect | n/a (functional route, not SEO) | Live |

## New Routes To Build

### Phase 1 — Mandala Authority Foundation

| Route | Purpose | Primary Keywords | Supporting Keywords | Priority |
|---|---|---|---|---|
| `/about` | Editorial mission, Adrian as editor, the project's purpose | `mandalacodes`, `mandala authority site`, entity | Very High — needed first |
| `/articles` | Editorial article index (hub page) | `mandala articles`, `learn about mandalas` | Very High |
| `/articles/what-is-mandala-art` | Definitive explainer | `mandala art` (49,500), `what is mandala art`, `original mandala art` | `mandala meaning`, `mandala symbolism`, `mandala definition` | Very High |
| `/articles/sacred-geometry-mandala-art` | Sacred geometry and mandala intersection | `sacred geometry mandala art` (1,300), `sacred geometry art` (18,100) | `flower of life`, `metatron's cube`, `vesica piscis` | Very High |
| `/articles/commissioning-a-mandala` | How to commission a mandala artwork | `mandala art commission` (140), `custom mandala artwork` (210) | `commission a mandala`, `custom mandala` | Very High |
| `/artists` | Featured Mandala Artists directory (hub) | `mandala artists`, `contemporary mandala artists` | `mandala artist directory`, `mandala painters and sculptors` | High |
| `/artists/adrian-rasmussen` | Adrian as first featured artist | `Adrian Rasmussen mandala`, `Bali mandala artist` | `wooden mandala sculpture`, `laser cut mandala` | High |

### Phase 2 — Editorial Depth (after Phase 1 published)

| Route | Purpose | Primary Keywords | Priority |
|---|---|---|---|
| `/articles/tibetan-mandalas` | Tibetan Buddhist mandalas history and iconography | `Tibetan mandala`, `Kalachakra mandala`, `Buddhist mandala` | Medium |
| `/articles/hindu-yantra-and-mandala` | Hindu yantra traditions | `Hindu mandala`, `yantra`, `Sri Yantra` | Medium |
| `/articles/jung-and-the-mandala` | Carl Jung's psychological view | `Jung mandala`, `mandala psychology` | Medium |
| `/articles/sand-mandalas` | Tibetan sand mandalas and impermanence | `Tibetan sand mandala`, `sand mandala ritual` | Medium |
| `/articles/mandala-history` | Origins and global spread | `mandala history`, `origins of mandala` | Medium |
| `/articles/sacred-geometry-history` | Sacred geometry across traditions | `sacred geometry history`, `Pythagorean sacred geometry` | Medium |
| `/articles/flower-of-life` | Flower of Life symbolism and history | `flower of life meaning`, `flower of life symbolism` | Medium |
| `/articles/mandala-meditation` | Mandala as meditation practice | `mandala meditation`, `mandala visualization` | Lower |
| `/symbolism` | Glossary / reference (mandala symbolism quick reference) | `mandala symbolism guide`, `mandala colors meaning` | Lower |

### Phase 3 — Featured Artists Expansion

| Route | Purpose | Authority Strategy |
|---|---|---|
| `/artists/[name]` (one per featured artist) | Page per artist, same template, different content | Each addition increases topical authority and creates outbound links to peer artists' sites |
| `/artists/by-medium/painting` | Filtered subset | Long-tail filter pages, lower priority |
| `/artists/by-medium/sculpture` | Filtered subset | Long-tail filter pages, lower priority |
| `/artists/by-region/bali` | Filtered subset | Long-tail filter pages, lower priority |

## Outreach Destination Mapping

When pitching outlets (per `~/Documents/Obsidian Vault/4 Outputs/mandalas/_outreach-intelligence.md`), the destination URL depends on the pitch type:

| Pitch type | Destination URL pattern |
|---|---|
| Mandala history / category authority | `mandalacodes.com/articles/[relevant-piece]` |
| Sacred geometry editorial | `mandalacodes.com/articles/sacred-geometry-mandala-art` |
| Adrian as mandala artist | `mandalacodes.com/artists/adrian-rasmussen` + cross-link to adrianrasmussen.com |
| Adrian as Bali artist | adrianrasmussen.com (artist portfolio) |
| Commission inquiry | `mandalacodes.com/articles/commissioning-a-mandala` → routes to Adrian by default |
| Oracle deck press | `mandalacodes.com/` (gateway) + `/universal-language` |

## High-Volume Terms Worth Owning (eventually)

Long-term targets where mandalacodes can plausibly compete because the domain name reinforces topical authority:

| Term | Est. US Monthly Searches | Difficulty | Strategic Reading |
|---|---:|---:|---|
| `mandala art` | 49,500 | 68 | Hardest, biggest. Win it via the four-article cluster + featured artists + sustained editorial pace over 12-18 months. |
| `sacred geometry art` | 18,100 | 52 | Adjacent territory. Win via the sacred geometry article cluster + Adrian as positioned artist. |
| `mandala meaning` | (varies) | medium | Definitional searches. The What-Is article and the symbolism glossary should compound here. |
| `mandala artists` | (varies) | medium | The Featured Artists directory is the right answer to this. |
| `sacred geometry mandala art` | 1,300 | 38 | Mid-difficulty, very high fit. Should rank top 5 within 6 months of publishing the article. |
| `mandala art commission` | 140 | 22 | Low volume, very high intent. Win this fast, it's a real lead source. |

## Terms To Avoid Targeting On mandalacodes

The site's value-first editorial posture is undermined by these terms — they attract the wrong audience:

- `laser cut svg`, `laser cut files`, `laser cut template`, `mandala svg free` — file-marketplace intent
- `mandala coloring`, `mandala art easy`, `mandala art for kids` — tutorial/coloring intent
- `mandala tattoo`, `mandala tattoo design` — tattoo industry, different lane
- `wall art`, `mandala wall art`, `mandala decor` — generic-decor intent that dilutes "art" framing

## Routing Notes For Implementation

- All article routes use the `/articles/<slug>` pattern, not `/blog/`. "Articles" reads as editorial, "blog" reads as personal/casual.
- All artist routes use `/artists/<slug>` — explicit hierarchy, not `/featured-artists/<slug>` (verbose) or `/artist/<slug>` (ambiguous).
- Glossary at `/symbolism` rather than `/glossary` — "symbolism" matches user intent better.
- The Featured Mandala Artists hub at `/artists` should not be confused with an artist directory in the commercial sense. It is an editorial selection.

## Schema Requirements Per Page Type

| Page type | Required schema blocks |
|---|---|
| `/about` | `WebSite`, `Person` (Adrian as editor with `sameAs` to adrianrasmussen.com), `Organization` (the mandalacodes editorial project) |
| `/articles/*` | `Article` with author Adrian Rasmussen, `BreadcrumbList`, `ImageObject` per inline image |
| `/articles` (hub) | `Blog` or `CollectionPage` listing articles |
| `/artists/*` (each artist) | `Person` (the artist with `sameAs` to their own site), `CreativeWork` per featured piece |
| `/artists` (hub) | `CollectionPage` listing artists |
| `/universal-language/*` | `CreativeWork` per card (already implemented for OG meta) |
| `/symbolism` | `DefinedTermSet` for the glossary, `DefinedTerm` per entry |

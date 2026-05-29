# Featured Mandala Artists — Page Spec

Last updated: 2026-05-28

How the Featured Mandala Artists section on mandalacodes.com is structured. Adrian is the first featured artist. The structure must work the same way for every artist added later, so the section can scale without rewrites.

## Editorial Stance

The Featured Mandala Artists section is an **editorial selection**, not a directory or marketplace. Inclusion is curated. Each featured artist is presented with depth — not a thumbnail and a link, but a real page with their story, their work, their voice, and their place in the broader mandala lineage.

This stance matters for SEO and AI citations: AI models cite editorial-quality artist features. They do not meaningfully cite directory thumbnails.

## Routes

```
/artists                           — hub / index page listing all featured artists
/artists/adrian-rasmussen          — first featured artist
/artists/[future-artist-slug]      — same template, future additions
```

Optional filter routes (lower priority, build only if the directory grows past 6-8 artists):
```
/artists/by-medium/painting
/artists/by-medium/sculpture
/artists/by-region/bali
```

## Hub Page (`/artists`)

### Layout

1. **Header**: "Featured Mandala Artists" — h1
2. **Mission paragraph**: 2-3 sentences on what this section is and how inclusion works.
   > Example: "These are contemporary artists working in the broad mandala lineage — painting, sculpture, digital, ritual practice. Each is featured because their work expands what a mandala can be in 2026. Editorial selection by Adrian Rasmussen."
3. **Grid of artist cards** — each card shows:
   - Hero image (one of the artist's pieces)
   - Artist name
   - Medium (e.g. "Layered laser-cut wood, Bali")
   - One-line editorial framing (e.g. "Adrian Rasmussen creates wooden mandala sculptures from his Bali studio, layering laser-cut wood into multi-dimensional pieces.")
4. **Order**: by feature date (newest first) initially. Later, optional sort by medium or region.

### Schema

```json
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": "Featured Mandala Artists",
  "url": "https://mandalacodes.com/artists",
  "description": "Editorial selection of contemporary artists working in the mandala lineage.",
  "hasPart": [
    { "@type": "Person", "name": "Adrian Rasmussen", "url": "https://mandalacodes.com/artists/adrian-rasmussen" }
    /* one Person per featured artist */
  ]
}
```

## Artist Page (`/artists/[slug]`)

### Layout

1. **Hero**: full-width hero image (one of the artist's strongest pieces). Artist name as h1. Optional one-line subtitle (medium + location).
2. **Editorial intro**: 200-400 words. Written in editorial voice (third person for the artist, "we" or "this section" when referring to the editorial role). Frames why this artist matters in the mandala lineage. Cites their distinctive contribution.
3. **Bio block**: 150-250 word artist biography. Photo of the artist (small, optional).
4. **Selected works**: 3-6 representative pieces with:
   - Image (medium-large)
   - Title
   - Year
   - Medium
   - 2-3 sentence description (editorial, not sales copy)
   - "View on the artist's site" link
5. **In conversation** (optional, when one exists): an "in conversation with Adrian Rasmussen" interview transcript or excerpt. Strongest type of content for AI citation.
6. **Practice and process**: 200-400 word section on how the artist works — materials, method, location, philosophy. Cite their statements where possible.
7. **Find their work**:
   - Link to artist's main website
   - Link to artist's primary social (one, not all)
   - Link to galleries representing them (if any)
   - Optional: "Inquire about commissioning [name]" → links to artist's commission path
8. **Related artists**: 2-3 cards linking to other featured artists with related medium or symbolic territory.
9. **Footer**: editorial credit ("Featured by mandalacodes.com, [date]") and a soft CTA back to `/artists` and `/articles`.

### Required SEO Metadata

```html
<title>[Artist Name] — Featured Mandala Artist · mandalacodes.com</title>
<meta name="description" content="[1-sentence editorial framing of the artist, 150-160 chars]" />

<link rel="canonical" href="https://mandalacodes.com/artists/[slug]" />

<meta property="og:title" content="[Artist Name] — Featured Mandala Artist" />
<meta property="og:description" content="..." />
<meta property="og:image" content="[hero image at 1200x630, Cloudinary]" />
<meta property="og:type" content="profile" />
<meta property="og:url" content="https://mandalacodes.com/artists/[slug]" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="..." />
<meta name="twitter:description" content="..." />
<meta name="twitter:image" content="..." />
```

### Required Schema Blocks

**Block 1 — `Person` schema for the artist:**

```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "[Artist Name]",
  "url": "[their primary website]",
  "image": "[their hero image]",
  "description": "[bio sentence]",
  "jobTitle": "Artist",
  "worksFor": { "@type": "Organization", "name": "Independent" },
  "knowsAbout": [
    "Mandala art",
    "[their specific medium]",
    "Sacred geometry"
  ],
  "sameAs": [
    "[their Instagram URL]",
    "[their other social profiles]"
  ]
}
```

**Block 2 — `Article` schema for the feature (treating the page as an editorial piece):**

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "[Artist Name] — Featured Mandala Artist",
  "author": {
    "@type": "Person",
    "name": "Adrian Rasmussen",
    "url": "https://mandalacodes.com/about"
  },
  "publisher": {
    "@type": "Organization",
    "name": "mandalacodes.com",
    "url": "https://mandalacodes.com"
  },
  "datePublished": "[feature date]",
  "dateModified": "[last update]",
  "image": "[hero image URL]",
  "about": {
    "@type": "Person",
    "name": "[Artist Name]",
    "url": "[their site]"
  }
}
```

**Block 3 — `CreativeWork` schema for each Selected Work piece (one block per piece):**

```json
{
  "@context": "https://schema.org",
  "@type": "CreativeWork",
  "name": "[piece title]",
  "creator": {
    "@type": "Person",
    "name": "[Artist Name]",
    "url": "[their site]"
  },
  "dateCreated": "[year]",
  "image": "[piece image URL]",
  "artMedium": "[medium]",
  "about": ["Mandala", "[other relevant tags]"]
}
```

## Data Model

Add to `data/featuredArtists.ts` (new file):

```ts
export interface FeaturedArtist {
  slug: string;
  name: string;
  oneLine: string;                      // "Layered laser-cut wood, Bali"
  primarySite: string;                  // URL
  instagram?: string;
  galleries?: { name: string; url: string }[];

  hero: {
    image: string;                      // Cloudinary public ID
    alt: string;
  };

  editorialIntro: string;               // 200-400 word framing
  bio: string;                          // 150-250 word artist bio
  practice: string;                     // 200-400 word process/practice section

  selectedWorks: {
    title: string;
    year: string;
    medium: string;
    image: string;
    description: string;
    artistSiteUrl?: string;             // link to the piece on artist's site
  }[];

  conversationExcerpt?: {
    intro: string;
    transcript: string;
    fullConversationUrl?: string;       // if there's a longer version elsewhere
  };

  knowsAbout: string[];                 // schema.org Person.knowsAbout entries
  relatedArtistSlugs: string[];         // for the "Related artists" footer block

  featureDate: string;                  // ISO YYYY-MM-DD
  lastUpdated: string;                  // ISO YYYY-MM-DD
}
```

## The First Featured Artist — Adrian Rasmussen

Adrian is the first featured artist. His page (`/artists/adrian-rasmussen`) sets the template the rest of the section follows. To build it:

1. Take Adrian's existing About content and his mandala portfolio from adrianrasmussen.com
2. Rewrite into the featured-artist template — third person, editorial voice
3. Select 5-6 representative mandala pieces with images from Cloudinary (canonical artwork pages stay on adrianrasmussen.com)
4. Add `sameAs` link from Adrian's schema here pointing to `https://adrianrasmussen.com/about`
5. The "Find their work" section links out to adrianrasmussen.com/creations/mandala

This is the test of the template. If Adrian's page reads as an editorial feature (not Adrian's self-promotion), the template works. If it reads as promotional, the editorial voice needs another pass.

## Value Capture Checklist (per artist feature)

When adding a new featured artist:

- [ ] Add `FeaturedArtist` entry to `data/featuredArtists.ts`
- [ ] Upload hero image and selected-work images to Cloudinary with descriptive public IDs (`artist-[slug]-hero`, `artist-[slug]-work-01`, etc.)
- [ ] Verify all three schema blocks render correctly on the page
- [ ] Confirm canonical tag is set to mandalacodes.com URL
- [ ] Add `sameAs` link from artist's `Person` schema to their primary website
- [ ] Update `/artists` hub page schema to include the new Person
- [ ] Add the artist to `relatedArtistSlugs` of 1-3 existing featured artists (mutual linking)
- [ ] Regenerate sitemap to include the new page with image entries
- [ ] If their feature includes an "in conversation" excerpt, link to the full conversation transcript
- [ ] Send the artist a heads-up with the published URL — gives them an opportunity to share, and starts the cross-link conversation
- [ ] Update `_outreach-intelligence.md` collaboration target list with the new artist as `Status: Featured`

## When To Build This

Phase 1, after `/about` and at least one of the four core articles ships. The Featured Artist section gives mandalacodes immediate authority depth — without it, the site looks like a single editor's vanity project. With even one featured artist (Adrian), it reads as a curated editorial site.

Recommend building order:

1. `/about` page first (states the editorial mission)
2. `/articles/what-is-mandala-art` (the foundational explainer)
3. `/artists` hub and `/artists/adrian-rasmussen` (first featured artist — proves the template)
4. Remaining three core articles
5. Outreach to potential second and third featured artists

## Estimated Build Time

- Hub page + data type + first artist page: 4-6 hours
- Schema and SEO metadata: 1-2 hours
- Sitemap and static HTML integration: 1 hour
- Playwright route tests: 1 hour
- **Total**: ~1 working day from start to first featured artist live.

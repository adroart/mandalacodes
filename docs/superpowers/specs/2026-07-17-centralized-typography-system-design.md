# Centralized Typography System Design

## Purpose

Mandala Codes will establish one shared typography source so future font changes are made centrally rather than repeated across components and pages. Large Mandala Codes headings retain Cormorant Garamond during the normalization.

The production system self-hosts the licensed Iowan Old Style family for reading and interface text. Large display headings remain independently controlled so the Mandala Codes title treatment does not change with the body face.

## Design Direction

The hierarchy has three primary voices:

1. **Display:** Cormorant Garamond preserves the existing Mandala Codes character in hero titles, page titles, article titles, and other major headings.
2. **Reading:** Iowan Old Style carries prose, oracle readings, descriptions, quotations, supporting editorial text, and smaller editorial headings.
3. **Interface:** Iowan Old Style also carries navigation, controls, buttons, filters, form labels, metadata, dates, captions, and compact data.

Specialized text keeps its purpose-specific typeface:

- IBM Plex Mono remains available for technical or monospaced content.
- Noto Serif SC and Ma Shan Zheng remain available for Chinese and calligraphic content.
- Cinzel remains limited to established brand marks and symbolic ornament where replacing it would erase intentional identity.

## Central Architecture

`src/theme.css` is the sole typography contract for both the React application and the Astro `/learn` surface. It owns:

- All `@font-face` declarations.
- Semantic font-family tokens.
- Semantic type-size tokens.
- Font weights, line heights, and letter spacing by role.
- Fallback stacks and font-loading behavior.

The shared family contract is:

```css
--font-display: "Cormorant Garamond", Georgia, "Times New Roman", serif;
--font-reading: "Iowan Old Style Web", "Iowan Old Style", Georgia, "Times New Roman", serif;
--font-ui: "Iowan Old Style Web", "Iowan Old Style", Georgia, "Times New Roman", serif;
--font-technical: "IBM Plex Mono", "SFMono-Regular", Consolas, monospace;
--font-cjk: "Noto Serif SC", "Songti SC", serif;
--font-calligraphic: "Ma Shan Zheng", "Noto Serif SC", cursive;
```

Components consume these roles rather than naming font families directly. Direct declarations such as `font-family: 'Lora'`, `font-family: 'Karla'`, and `font-family: 'Lato'` are removed from production components and stylesheets.

## Type Roles and Scale

Large display headings keep their existing responsive sizes unless visual verification reveals a specific wrapping defect.

| Role | Family | Size | Weight | Line height | Tracking |
|---|---|---:|---:|---:|---:|
| Display hero | Cormorant Garamond | Existing responsive scale | 500 | Existing | Existing |
| Display page title | Cormorant Garamond | Existing responsive scale | 500 | Existing | Existing |
| Editorial section | Reading role | 1.45rem | 600 | 1.4 | Normal |
| Editorial subheading | Reading role italic | 1.35rem | 400 | 1.4 | Normal |
| Reading body | Reading role | 1.0625rem | 400 | 1.6 | Normal |
| Supporting body | Reading role | 0.9375rem | 400 | 1.5 | Normal |
| Interface body | Interface role | 0.9375rem | 400 | 1.4 | -0.01em |
| Metadata and captions | Interface role | 0.8125rem | 400 | 1.4 | Normal |
| Compact uppercase label | Interface role | 0.75rem minimum | 500 | 1.2 | 0.08em to 0.12em |

Existing compact labels below 0.75rem are increased when layout permits. Exceptions must be visually verified and remain legible at 200% zoom.

## Display Boundary

Cormorant Garamond is retained when text functions as a major identity-bearing heading. This includes:

- Primary hero titles.
- Page-level H1 titles.
- Article titles.
- Major feature or collection titles that currently function at display scale.

Smaller Cormorant Garamond text that functions as prose, description, supporting copy, or a minor heading moves to the reading role. The boundary is semantic, not only numeric, but 1.75rem is the normal lower threshold for display use.

## Surface Coverage

The typography contract applies to:

- The React application.
- Oracle entry, reading, reflection, profile, and invocation surfaces.
- Account, collection, navigation, and form interfaces.
- The Astro `/learn` library index, article pages, related content, and shared navigation.
- First-paint HTML elements such as the skip link and loading state.

Prototype files, generated artifacts, and archived mockups are not migrated unless they are included in a production build. Production sources that generate CSS must emit semantic font tokens rather than direct family names.

## Font Assets and Loading

The production setup will:

- Self-host WOFF2 files under `public/fonts/`.
- Use `font-display: swap`.
- Preload only the critical regular reading weight used above the fold.
- Retain metric-appropriate fallback stacks.
- Load only weights and styles used by the final role system.
- Record applicable font license notices with the existing font notices.

The licensed Iowan collection is subset into four self-hosted WOFF2 assets: regular, italic, bold, and bold italic. The `@font-face` registrations and both non-display role values remain owned by `src/theme.css`.

## Migration Principle

The migration is a one-time normalization. It may touch multiple existing components because the current codebase contains direct family declarations, but future typography changes occur in `src/theme.css` only.

After migration:

- No production component names Iowan, GT America, Cormorant Garamond, Lora, Karla, Lato, or Plus Jakarta Sans directly.
- Production components use only semantic variables or utilities derived from them.
- `/learn` inherits the same contract as the React application.
- A guard test rejects new hardcoded production font families outside the theme contract and approved specialized exceptions.

## Readability and Accessibility

- Long-form prose remains within approximately 60 to 70 characters per line.
- Body text remains at least 1rem, with 1.0625rem as the primary reading size.
- Text remains usable at 200% browser zoom.
- Font replacement must not reduce existing WCAG AA contrast.
- Controls preserve usable touch targets when text metrics change.
- Heading balance is retained where appropriate, while prose uses normal wrapping.
- Light text on dark surfaces receives sufficient line height and weight to remain clear.

## Verification

Visual verification covers representative routes in desktop and mobile layouts, in both light and dark themes:

- Main landing and navigation.
- Oracle entry and reading.
- Profile and profile graph.
- Reflection and invocation interfaces.
- Account and collection controls.
- `/learn` library index.
- `/learn` article page.

Verification checks:

- Major display headings still render in Cormorant Garamond.
- Reading and supporting editorial text resolve through `--font-reading`.
- Navigation and interface text resolve through `--font-ui`.
- Chinese and technical content retain their specialized fonts.
- Font requests succeed without console or network errors.
- Navigation, buttons, fields, cards, and diagrams do not clip or overflow.
- Article and oracle line wrapping remains comfortable.
- Font loading does not create disruptive layout shift.
- The full build, focused typography tests, and relevant visual tests pass.

## Non-goals

- Redesigning colors, layout, navigation, motion, or component structure.
- Reducing the large Mandala Codes title scale to match Thinking Machines Lab.
- Replacing Chinese, calligraphic, or monospaced typography.
- Copying font files or proprietary assets from another website.
- Preserving obsolete font declarations solely because they exist in older components.

## Success Criteria

The change succeeds when all production typography is controlled through one shared theme contract. A future global font change should require editing semantic values in `src/theme.css`, not revisiting individual pages.

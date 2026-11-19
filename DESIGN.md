---
name: Mandala Codes
description: A quiet editorial oracle for studying the 64 codes.
source: src/theme.css (MASTER PAGE COLOURS, TYPE SCALE, ROLES, SPACING, CONTROLS, SURFACE PALETTES)
colors:
  ground-dark: "#171310"
  ground-light: "#f3efe7"
  ink-dark: "#f3ecde"
  ink-light: "#272219"
  action-dark: "#debc7e"
  action-light: "#a37b38"
  action-ink: "#211c16"
  atlas-gold: "#c4aa7c"
typography:
  page-title:
    fontFamily: "Cormorant Garamond, serif"
    fontSize: "40px"
    lineHeight: 1.1
  section-heading:
    fontFamily: "Cormorant Garamond, serif"
    fontSize: "28px"
    lineHeight: 1.15
  card-title:
    fontFamily: "Cormorant Garamond, serif"
    fontSize: "22px"
    lineHeight: 1.2
  body:
    fontFamily: "Iowan Old Style, serif"
    fontSize: "17px"
    lineHeight: 1.5
  caption:
    fontFamily: "Iowan Old Style, serif"
    fontSize: "14px"
    lineHeight: 1.4
  label:
    fontFamily: "Iowan Old Style, serif"
    fontSize: "12px"
    lineHeight: 1.33
    letterSpacing: "0.16em"
  nav:
    fontSize: "12px"
  button:
    fontSize: "12px"
  field:
    fontSize: "14px"
  admin-table:
    fontSize: "14px"
rounded:
  none: "0px"
  control: "3px"
  dialog: "6px"
spacing:
  space-1: "4px"
  space-2: "8px"
  space-3: "12px"
  space-4: "16px"
  space-5: "24px"
  space-6: "32px"
  space-7: "48px"
controls:
  height-sm: "28px"
  height: "32px"
  height-touch: "44px"
components:
  btn-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.action-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    height: "{controls.height}"
    padding: "0 12px"
  btn-secondary:
    borderColor: "{colors.action} at 55%"
    textColor: "{colors.action}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    height: "{controls.height}"
    padding: "0 12px"
  btn-quiet:
    textColor: "wood-600, action on hover"
    typography: "{typography.button}"
    height: "{controls.height}"
    padding: "0 4px"
  btn-icon:
    size: "{controls.height} square"
  btn-tab:
    typography: "{typography.label}"
    height: "{controls.height-sm}"
    indicator: "1px action underline when current"
  btn-chip:
    typography: "{typography.caption}"
    rounded: "{rounded.control}"
    height: "{controls.height-sm}"
    padding: "0 8px"
  field:
    typography: "{typography.field}"
    rounded: "{rounded.control}"
    height: "{controls.height}"
    padding: "0 12px"
---

# Design System: Mandala Codes

The values above are a mirror. The source is `src/theme.css`: change a value there and every page, the admin and the sign-in follow. This file is updated by hand to match it.

## Change this, and this changes

| Change in `src/theme.css` | What follows |
|---|---|
| `--page-day` | The Day Book background of every page: home, card reading, about, account, admin, body (the piece page sits on the band colour, `--color-band`) |
| `--page-night` / `--page-paper-night` / `--page-card-night` | The Nightfall background of body and home / paper pages and admin / the card reading |
| `--type-3` | Every role on step 3: body text everywhere that uses `text-body` |
| `--text-card-title: var(--type-4)` | Repoint one role: every card and panel title moves to the new step |
| `--color-ink` (and `-soft`, `-muted`, `-faint`) | Main, secondary, muted and faint text in every migrated section |
| `--color-link`, `--color-accent`, `--color-danger` | Gold links and gold text, accents, error text |
| `--color-band`, `--color-card`, `--color-panel`, `--color-admin` | Section bands, cards and bars, raised panels and dialogs, the admin background |
| `--color-line` (and `-strong`, `-faint`) | Borders and rules; field and chip borders |
| `--color-action` | Every filled button, outlined button line, focus ring |
| `--control-h`, `--control-h-sm` | Every button, field, tab and chip height |
| `--space-1` ... `--space-7`, `--page-gutter` | Spacing and the page edge |
| `--font-display`, `--font-reading`, `--font-ui` | Every heading, reading and interface font |
| `--ease-glide`, `--duration-*` | Reveals, hovers and the day/night crossfade |
| `--home-*`, `--shell-*`, `--reading-*` | The home page and card reading's own tuned tones (SURFACE PALETTES) |

## Overview

**Creative North Star: "The Quiet Oracle Table"**

A carefully arranged study surface: dark, warm and precise. The oracle object carries the visual weight; supporting information sits at the margins in restrained editorial rails. It rejects generic dashboard chrome, floating card stacks and decorative spiritual effects.

**Density:** slim and well spaced, never spacious. Show more on screen. Buttons 32px on a desktop, sections 32 to 48px apart, cards padded 16 to 24px. Touch screens raise every control to 44px; desktop stays slim.

## Colors

Every page background is set once in MASTER PAGE COLOURS. Text and surfaces use roles: ink, ink-soft, ink-muted, ink-faint, ink-inverse, link, accent, danger; page, page-paper, admin, band, card, panel, line. Warm paper, wood and bronze neutrals, with a nightfall (dark, the default) and a day book (light) palette. One action gold fills every primary control and lines every secondary one. The atlas stage keeps its own gold (`atlas-gold`) by the two-bronze ruling. Sequence colours carry data meaning only.

## Typography

Six steps (`--type-1` to `--type-6`): 12, 14, 17, 22, 28, 40. Sections never use a step or a raw size; they use a role: page title 40, section heading 28, card title 22, body 17, caption 14, label 12, nav 12, button 12, field 14, admin table 14. 12px is the floor for anything new; some older files still set 10 and 11px and move up as they are migrated. Cormorant Garamond for page titles, section headings and card titles. Iowan Old Style for reading, controls and metadata. Cinzel only for the brand mark. Uppercase labels always track at 0.16em.

## Spacing and size

One scale: 4, 8, 12, 16, 24, 32, 48. Page gutter 48px on a desktop, 16px on a phone. Controls are 28px (small) or 32px (default) tall on a desktop and 44px on touch screens; buttons, fields, tabs and chips share these heights so they line up in a row.

## Elevation

Flat by default. Structure comes from whitespace, fine rules, tonal contrast and hierarchy. One shadow (`--shadow-overlay`) for dialogs and sheets.

## Components

Seven control variants, all in `src/theme.css`:

- **btn-primary**: the one main action on a surface. Gold fill.
- **btn-secondary**: equal-weight second actions. Gold hairline.
- **btn-quiet**: inline actions, back links, retries, log out. No frame.
- **btn-icon**: square, no label (theme toggle, close, menu).
- **btn-tab**: text with an underline when current.
- **btn-chip**: small framed filter, gold when pressed.
- **field**: inputs, selects, textareas; `field-label` above them.

Add `btn-sm` for the 28px size and `btn-block` for full width.

## Do's and Don'ts

### Do:

- **Do** use a role (text-body, text-ink, bg-card), a master control class, or a theme token. A new hard-coded colour, control size, font size or font family fails the style guard test.
- **Do** keep the profile graph on the true horizontal center axis.
- **Do** use equal-width supporting rails when information flanks the chart.
- **Do** provide visible keyboard focus and mobile reflow.

### Don't:

- **Don't** add a new button look. Pick one of the seven.
- **Don't** use pill shapes, or radii other than 0, 3 and 6px.
- **Don't** turn supporting information into floating dashboard cards.
- **Don't** use hover as the only way to reveal meaning.
- **Don't** introduce gradients, glassmorphism or decorative motion.

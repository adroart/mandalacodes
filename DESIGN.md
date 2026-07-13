---
name: Mandala Codes
description: A quiet editorial oracle for studying the 64 codes.
colors:
  paper: "#f5f4f0"
  deep-wood: "#262321"
  muted-wood: "#736046"
  bronze: "#8a744e"
  bronze-light: "#c4aa7c"
typography:
  display:
    fontFamily: "Cormorant Garamond, serif"
    fontSize: "36px"
    fontWeight: 400
    lineHeight: 1.1
  body:
    fontFamily: "Cormorant Garamond, serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Lato, Helvetica, sans-serif"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.18em"
rounded:
  subtle: "5px"
  control: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  filter-control:
    backgroundColor: "{colors.deep-wood}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "5px 7px"
---

# Design System: Mandala Codes

## Overview

**Creative North Star: “The Quiet Oracle Table”**

The interface feels like a carefully arranged study surface: dark, warm, spacious, and precise. The central oracle object carries the visual weight while supporting information sits at the margins in restrained editorial rails. It rejects generic dashboard chrome, floating card stacks, and decorative spiritual effects.

## Colors

The palette uses warm paper, wood, and bronze neutrals. Bronze is reserved for links, selection, and quiet orientation; sequence colors carry data meaning only.

## Typography

Cormorant Garamond carries titles, teaching text, and the chart’s editorial voice. Lato carries compact controls, numbers, metadata, and uppercase system labels. Cinzel is limited to rare navigational labels.

## Elevation

The system is flat by default. Structure comes from whitespace, fine rules, tonal contrast, and hierarchy. Shadows are limited to interactive overlays or focused chart spheres.

## Components

Controls are compact, restrained, and consistent. Filter pills use small uppercase sans labels. Path rows are borderless editorial lines with a subtle tinted hover or selected state. Supporting rails remain visually open rather than becoming cards.

## Do's and Don'ts

### Do:

- **Do** keep the profile graph on the true horizontal center axis.
- **Do** use equal-width supporting rails when information flanks the chart.
- **Do** preserve warm wood and bronze tokens and the existing type pairing.
- **Do** provide visible keyboard focus and mobile reflow.

### Don't:

- **Don't** turn supporting information into floating dashboard cards.
- **Don't** use hover as the only way to reveal meaning.
- **Don't** let filters or utilities visually outrank the chart.
- **Don't** introduce gradients, glassmorphism, or decorative motion.

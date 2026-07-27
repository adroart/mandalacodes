# Warm Daybook Light Mode

**Approved direction:** bring the material depth, tonal variance, and antique-bronze character of Nightfall into a genuinely light daytime palette. Preserve the existing typography, layout, artwork treatment, navigation, and interaction model.

## Experience goal

Light mode should feel like the same oracle table in daylight: warm paper instead of white UI chrome, deep brown ink instead of black, sandstone recesses instead of flat gray panels, and antique bronze instead of bright yellow. It must not read as a separate product or as a simplified accessibility skin.

## Palette and material hierarchy

Use the existing shared theme contract as the source of truth:

- Canvas: Daybook paper (`paper-50`, `#f3efe7`).
- Raised surfaces: pale warm paper (`wood-50`, `#faf7f0`) with subtle bronze/ink rules.
- Soft sections: aged paper (`paper-100`, `#eae4d7`).
- Recessed sections: sandstone (`recess`, `#e6ddc9`) and its deeper companion.
- Primary ink: `wood-900` (`#272219`), with `wood-600` and `wood-400` for secondary and quiet text.
- Accent: antique bronze (`bronze-500`, `#a37b38`) with its existing hover and dark-mode remaps.
- Texture: fine paper grain and restrained warm shadows. Texture should remain perceptible but never reduce reading contrast.

Dark mode remains Nightfall and keeps its current warmth and contrast. The mode switch changes atmosphere, not information architecture.

## Surface rules

1. Page shells, navigation, drawers, forms, dialogs, and account surfaces follow the active shared tokens.
2. Reading chapters use Daybook palette values in light mode and Nightfall values in dark mode. No reading stylesheet may pin both palettes to espresso.
3. Reading chapters retain tonal variance. The primary chapter uses the canvas, analytical chapters use soft paper, and contemplative chapters use sandstone recesses.
4. Atlas is a mixed-surface exception: the globe stage, phone HUD, illuminated markers, and artwork plates remain deliberately dark. The ledger and surrounding page chrome follow the active site theme.
5. Artwork mats, share/export compositions, and print layouts are controlled presentation surfaces and are not recolored merely because the application theme changes.
6. The static `/learn` site consumes the same shared tokens as the React application.

## Accessibility and behavior

- Meet WCAG AA contrast for body copy and controls.
- Theme selection continues to persist through the existing context and local storage behavior.
- Theme changes must not flash a mismatched page background on oracle routes.
- Focus, hover, selected, error, and disabled states remain visually distinct in both modes.
- Mobile and desktop keep their existing structure and typography.
- Reduced-motion behavior is unchanged.

## Acceptance criteria

- Light mode visibly renders warm light canvas, raised paper, sandstone recess, deep ink, and bronze accents across public Oracle pages, readings, profile/account shells, and the Atlas ledger.
- Dark mode remains visually unchanged except where a semantic token replaces an equivalent literal.
- Atlas globe stage and artwork plates remain dark in both modes while surrounding ledger chrome adapts.
- No font family, font role, type size system, copy, route, or layout is changed.
- Focused browser checks cover representative public, reading, profile/account, and Atlas routes at desktop and mobile widths in both themes.

## Self-review

The design is deliberately systemic rather than a route-by-route inversion. It establishes one warm material hierarchy and names the intentional dark exceptions, which prevents both the current dark-pinning regression and indiscriminate recoloring of artwork/globe surfaces. The scope is limited to the user-approved color and material change; typography and structure are explicitly frozen.

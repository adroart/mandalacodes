# Birth Profile Entry Usability Design

## Goal

Make birth date, time, and birthplace entry reliable on phones and desktops without changing the familiar single-form structure. The experience must have one predictable scrolling surface and must not reduce the available birthplace matches.

## Current problem

The birth profile form appears inside a small modal whose body scrolls. The birthplace autocomplete then opens a second tall, independently scrolling list inside that modal. The page behind the modal is a third scroll context. On phones, the software keyboard further reduces the visible area. Users can lose the input, lose their position in the results, or scroll the wrong surface.

The current modal also spends too much of its limited height on decorative spacing and large typography. The result rows expose technical timezone identifiers that add visual weight without helping users choose their city.

## Approved interaction

The existing field order and single-form structure remain:

1. Birth date
2. Birth time
3. Birth place
4. Build my profile

The overlay becomes a focused responsive workspace rather than a small universal modal.

### Mobile

- The overlay panel fills the visual viewport.
- The panel provides the only vertical scrolling surface.
- The underlying page remains locked while the overlay is open.
- Safe-area insets and the software keyboard are accounted for.
- The birthplace field remains visible while its results are being reviewed, using a sticky search area within the panel when results are open.
- The result list does not have its own `overflow` or independent scroll behavior.

### Desktop

- The overlay remains centered, but expands into a substantially larger workspace with a comfortable maximum width and height.
- The panel is the only vertical scrolling surface.
- Birth details may use available width more efficiently, while preserving the current reading order and accessible tab order.
- Birthplace results flow as normal content below the search field and scroll with the panel.

## Birthplace search

- Continue requesting and displaying up to 24 matches. Do not cap the interface to a smaller result set.
- Results remain available until the user chooses a place or refines the query.
- The result container must not scroll independently.
- Keyboard support remains: Arrow Up, Arrow Down, Enter, and Escape.
- The active keyboard result must remain visible by scrolling the single panel surface, not a nested list.
- Each row emphasizes the human-readable place label.
- Timezone identifiers are removed from result rows because they are implementation detail, not selection criteria.
- After selection, show a short confirmation that the timezone was resolved. Do not repeat the full city label and timezone identifier beneath the field.
- Empty-result guidance remains available.

## Visual refinement

- Use Karla for interface labels, helper text, buttons, and result metadata. Do not reference unavailable Lato assets.
- Keep Cormorant Garamond for the editorial heading and primary input text.
- Reduce heading size, decorative spacing, field gaps, and long helper copy so the form feels sleek and focused.
- Retain the existing warm paper, wood, and bronze palette.
- Keep touch targets at least 44 pixels high.
- Preserve clear focus states and sufficient contrast in light and dark modes.

## Accessibility and behavior

- The overlay uses dialog semantics, has an accessible name, and communicates its modal state.
- Focus moves into the overlay when it opens and returns to the invoking control when it closes.
- Focus remains trapped within the open overlay.
- Escape first closes an open birthplace result set; when results are closed, Escape closes the overlay.
- Clicking outside may close the desktop overlay. The full-screen mobile panel uses an explicit close control.
- Existing date, time formatting, profile calculation, persistence, login, and confirmation behavior remain unchanged.

## Responsive implementation boundary

This change is confined to `BirthTimeModal` and `ProfileForm`, plus focused tests. It does not replace the city index, alter place ranking, change profile mathematics, or redesign the confirmation step.

## Verification

- Component or browser tests cover opening, searching, keyboard selection, pointer selection, empty results, and submission.
- Mobile browser verification confirms there is only one usable vertical scroll surface with the software-keyboard-sized viewport.
- Desktop browser verification confirms the larger workspace, persistent access to the birthplace field, and all 24 matches flowing within the panel.
- Light and dark modes are visually checked.
- Typecheck and the relevant automated test suite pass.

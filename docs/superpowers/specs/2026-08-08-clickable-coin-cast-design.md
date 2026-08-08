# Clickable Coin Cast

## Goal

Make the Oracle coin cast feel immediate and make the coins themselves an obvious, accessible casting control.

## Interaction

- The group of three coins is one semantic button with the accessible name “Cast the coins.”
- Pointer, touch, Enter, and Space all start the same cast.
- The existing text button remains as a quieter secondary trigger and accessibility cue.
- A cast cannot be triggered again while its animation is running.
- Reduced-motion users receive the result immediately.

## Motion

- The focal motion is one crisp edge-on coin flip, not an airborne tumble.
- Total wait before the result is approximately 380 ms.
- Coins stagger by 35 ms, keeping the full sequence below 500 ms.
- Animation uses only compositor-friendly transforms and opacity on HTML wrappers.
- The coin button gives immediate press feedback and a restrained hover/focus indication.

## State and implementation

- The host owns a `casting` guard so both triggers share identical behavior.
- Coin wrappers receive the flip animation; the SVG artwork remains static inside them.
- The result replaces the invitation only after the short flip completes.
- Existing cast probability and moving-line logic do not change.

## Verification

- Mouse/touch click on the coins casts.
- Keyboard activation on the coin group casts.
- The text button still casts.
- Repeated input during the animation produces only one cast.
- Reduced motion skips the wait.
- Typecheck and focused browser verification pass on desktop and mobile widths.

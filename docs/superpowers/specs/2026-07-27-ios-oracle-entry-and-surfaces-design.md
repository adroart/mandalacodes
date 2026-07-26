# iOS Oracle Entry and Reading Surfaces

## Goal

Make the physical-card QR journey and direct Safari journey render the intended Oracle experience on iPhone: a full-screen textured warm-black entrance, followed by a readable dark-mode reading whose system sections shift subtly between warm dark tones without ever becoming gray.

## Confirmed visual behavior

- The entrance covers the entire website viewport, including the Mandala Codes header and the reading footer.
- iOS QR preview chrome and Safari chrome remain outside the website and are not styled by the page.
- The entrance keeps its restrained paper texture on Safari.
- The opening ground is the Oracle warm black (`#14100b`).
- Reading systems retain subtle tonal distinctions using the existing warm-dark palette.
- No reading surface uses a neutral gray ground.
- The website header, chapter rail, and reading footer return only after the entrance has completed.

## Architecture

### Page-level entrance layer

Keep entrance state and choreography in `EBReadingHost`, but render the entrance through a React portal attached to `document.body`. A portal preserves the current React state, events, animation timing, and theme variables while removing the entrance from the nested mobile scroll container and its WebKit stacking context.

The portal root will carry the Oracle palette variables explicitly because it no longer inherits them from the reading wrapper. While the entrance is active or exiting, the page will expose an entrance-active state that hides the website header and reading footer and prevents the underlying reading from becoming interactive.

### Texture

Give the generated grain element an explicit stable hook instead of locating it through DOM ancestry or inline-style matching. The source-owned Oracle stylesheet will use that hook to apply the intended low-opacity texture and blend mode. This keeps the texture on Safari while avoiding the current full-strength `42%` gray veil.

The entrance portal will use the same controlled texture treatment, so the opening and reading feel related without relying on WebKit compositing inside a momentum scroller.

### Reading surfaces

Preserve the existing warm-dark section palette:

- Universal Language: `#14100b`
- I Ching: `#110e0a`
- Gene Keys: `#17120c`
- Human Design: `#120f0b`
- Body: `#18130d`
- Relations: `#100d09`

The mobile shell, scroll floor, entrance, and section backgrounds will share these source-owned tokens. Shell fallbacks remain warm black or warm near-black, never gray. The section differences remain subtle orientation cues rather than separate visual themes.

## Generated-source discipline

The generated Oracle markup will not be edited as the source of truth. Changes to hooks or entrance rendering will be made in the appropriate source template or host adapter and regenerated with the repository's converter when required. Hand-written integration behavior will stay in the host and source-owned CSS.

## Interaction and accessibility

- The entrance remains a full-viewport, keyboard-accessible dialog.
- Tap, click, Enter, and Space dismiss it through the existing choreography.
- Focus cannot move into the obscured reading while the entrance is present.
- Reduced-motion mode removes decorative entrance transitions while preserving the full-screen state change.
- Safe-area insets keep the title and prompt clear of iPhone hardware and browser controls.

## Failure behavior

If a portal cannot mount during server rendering, the entrance is omitted until a browser document exists; the normal reading remains available. Unmounting the card route removes the portal state and restores all shell visibility and interaction state.

## Verification

Automated regression coverage will verify:

1. The entrance is mounted under `document.body`, outside the mobile reading scroller.
2. Website and reading chrome are hidden or inert while the entrance is active and restored after dismissal.
3. The grain hook receives the restrained texture treatment instead of the inline `42%` fallback.
4. Every system chapter resolves to its intended warm-dark background.
5. The QR route and direct Oracle route share the same entrance behavior.
6. The behavior passes in Chromium and WebKit at representative iPhone portrait sizes, including reduced motion.

Manual verification will compare the QR preview and Safari on an actual iPhone, since browser emulation cannot reproduce the surrounding QR scanner sheet.

## Scope boundaries

This work does not modify iOS scanner or Safari browser chrome, redesign the Oracle content, change card data, or alter desktop information architecture. It fixes the website layers, texture, and backgrounds responsible for the reported mobile experience.

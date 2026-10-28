# Personal Oracle iPhone app

The app uses its own iOS identity, `com.adrian.oracle`, and bundles the existing
Oracle reader rather than loading the website on launch. The website's normal
build and navigation are separate.

## Included

- All 64 cards and their reading lenses, with 1100-pixel artwork plates.
- Coin casting and trigram selection.
- Birthday date/time/place entry, calculated Hologenetic profile, Today and Year.
- A locally saved profile and reading history.
- Oracle, Birthday and Explore navigation; native sharing of public reading and
  profile links. Other website destinations open through an explicit website link.

The native build is `oracle-app.html` + `src/mobile/`, configured by
`vite.oracle.config.ts`. It reuses canonical manuscripts and existing calculation
code. It does not use the website service worker. The personal build excludes
website sign-in, account synchronization and the admin reflection recorder.
Live published invocations remain a website feature. Artwork/text updates reach
this app through a new app build. There is no iCloud profile sync in this version.

## Build and check

Install root dependencies normally, then `npm --prefix mobile ci`. Run
`npm run build:oracle`; its first run downloads 64 artwork plates from the owner's
site into a reusable `.oracle-public` cache. It checks that all 64 are present and
rejects failed or non-image responses. Subsequent builds reuse unchanged sources.
The resulting `dist-oracle` contains card text, artwork, fonts and the city index.
No account data or personal Birthday profile is baked into the app.

Run `npm run test:oracle-app` for the focused WebKit phone tests. They block all
external HTTPS requests and check casting, reading, artwork, local place search,
profile calculation and persistence. This is a local asset test, not a claim of
physical iPhone airplane-mode verification.

See `mobile/README.md` for native compilation and device installation. This is a
personal development-signed app, not an App Store or TestFlight release. Its
provisioning profile governs when rebuilding/reinstalling is required. Build and
installation receipts live in `mobile/build/` and are not committed.

Verification on 28 October 2026: all three focused mobile WebKit tests passed,
as did the repository TypeScript check and 27 relevant profile/reflection/API
unit checks. Native simulator/device compilation and signature verification also
passed. Installation and visual launch proof are recorded separately in the
native build status; a successful compile alone is not an installed-app claim.

# Offline oracle

The reading deck's text and Hologenetic Profile work with no connection after
the app shell and required prose have been cached. A quiet warm pass prepares
the whole deck while a visitor stays online; an interrupted pass or evicted
cache can still require a connection. This is a service worker
(via `vite-plugin-pwa`, configured in `vite.config.ts`) plus a few small
changes to the app itself — no native wrapper, no install prompts.

## Why this was straightforward

The oracle's core mechanics were already offline-capable before any of this:
birth-chart math runs client-side (`lib/astrology/`), birth-place search is a
bundled JSON lookup (`public/data/cities-index.json`, not a live geocoding
API), the 64 cards' content is bundled at build time, and profiles save to
`localStorage` first, syncing to the server only as a bonus when signed in.
The service worker is the one piece that was missing.

## What's cached, and how

Scoped by *what gets cached*, not by route — one service worker covers the
whole origin, so there's no such thing as "only register it for the oracle
paths."

- **Precached at install** (`vite.config.ts` → `workbox.globPatterns`): the
  app shell (`index.html`, the main JS/CSS entry), fonts, the manifest, the
  favicon, and `data/cities-index.json`. This is deliberately narrow — it's
  everything needed to boot the app and search for a birth place, and
  nothing else.
- **Cached at runtime, the first time it's actually fetched**
  (`workbox.runtimeCaching`, `CacheFirst`): every other same-origin JS/CSS
  chunk — the 64 per-card reading chunks, the deck index, Atlas, admin,
  account, whatever a visitor happens to open. Card artwork is not cached or
  prefetched: it needs a connection. Vite's filenames are content-hashed, so `CacheFirst`
  never needs to revalidate: a given URL's bytes never change.
- **Quietly prefetched in the background**
  (`lib/oracle/offlineWarm.ts`): opening the deck index (`/universal-language`)
  or arriving straight on a card triggers an idle-scheduled pass that fetches
  all 64 cards' text, starting with the card on screen. Completion is tracked
  per document, not with a persistent `localStorage` flag. Failed cards can
  retry after connectivity returns, and a new document rechecks the deck.
  No UI — this doesn't announce itself.

After the warm pass completes, a device can read any of the 64 cards' text
and use a saved or freshly entered birth chart with the radio off. Artwork
and remotely stored account data are outside that offline guarantee.

## Deliberately excluded

Page navigations are network-first (the `oracle-pages` rule in
`workbox.runtimeCaching`): online, every page load gets the deployed HTML, so
the first load after a deploy is the new build. Only when the network fails,
or gives no answer within 3 seconds, does the precached `index.html` stand in.
There is deliberately no `navigateFallback`: it answered every navigation from
the precache, online or not, which made the first load after each deploy show
the previous build. `/api/*`, `/qr/*`, `/learn/*` and `/design/*` are left out
of that rule entirely — Functions and independently built static apps that
must never be answered by the cached app shell. Everything else — Atlas,
admin, account, piece pages, the LED product — has no special handling: it
simply isn't fetched (and so never cached) unless a visitor actually opens
it, which keeps the precache small without needing an exclusion list.
Opening one of those routes offline before its chunk was ever cached lands
on the quiet fallback in `components/ChunkErrorBoundary.tsx` ("this part of
the oracle needs a connection…") rather than a blank crash.

## Install prompts

There are none, on purpose. The manifest (`public/site.webmanifest`) is
fixed to be oracle-specific (name, icons, `start_url`) so an install *looks*
right if a visitor chooses one from the browser's own menu, but nothing in
the app calls `beforeinstallprompt` or asks to be installed. Offline-on-
repeat-visit is the feature; installability is a side effect the browser
already offers.

## Updates

`registerType: 'autoUpdate'` — a new deploy's service worker takes over
silently (`skipWaiting` + `clientsClaim`), no "update available" toast, and
because pages are network-first the very first load after a deploy already
renders the new build (`tests/pwa-navigation.spec.ts` guards this). The one safety net:
`components/ChunkErrorBoundary.tsx` reloads the tab once (session-guarded)
if a lazy route import fails while online, which is what happens when a tab
has been open since before a deploy purged the old chunk hashes.

## Gotchas

- **`/sw.js`, `/registerSW.js`, `/index.html` must not be cached upstream**
  (`public/_headers` sets `Cache-Control: no-cache` on all three) — otherwise
  Cloudflare's own edge cache can serve a stale service worker or shell after
  a deploy, independent of anything the service worker itself does.
- **Browser storage can be evicted.** Recheck offline readiness on the actual
  device after long inactivity or storage pressure; do not promise that an
  installed gallery device keeps every cached chunk indefinitely.
- **Card artwork remains network-only.** Do not restore artwork prefetch or
  caching to satisfy an old checklist. That is a separate product, bandwidth
  and storage decision; the prose warm pass must not issue media requests.
- **`data/cities-index.json` is regenerated by `scripts/build-cities-index.ts`**
  — if that script's row ordering ever becomes nondeterministic, every deploy
  reships the full ~4 MB to every visitor even when the data didn't change,
  so keep its output stable.

## Testing locally

```bash
npm run build
npx vite preview --port 4173
```

The automated production-worker checks run with `npm run test:pwa` after the
build. `tests/offline-qr-reading.spec.ts` checks that a direct card arrival
warms all 64 prose chunks in the actual worker cache, then opens an untouched
card offline with worker network fetches blocked and requires its real prose.
Separate cases check the calm missing-chunk notice and recovery through Retry.

For manual checking, open `http://localhost:4173/universal-language` or a card
URL and allow the warm pass to finish. Simulate offline and open a different
card. Verify text rather than artwork, and also check interrupted warming and
recovery. A worker registered without a controlled navigation does not prove
that prose was stored; neither does a test that permits a connection notice.

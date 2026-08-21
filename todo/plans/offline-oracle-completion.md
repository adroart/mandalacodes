# Finishing the offline oracle

> What shipped 2026-08-21 is the first half: the site's shell and every card's
> text and artwork can be cached, and a reader who has opened the deck once gets
> all 64 cards warmed quietly in the background. What has **not** happened is
> anyone confirming that on a real phone with the network genuinely off. That
> gap, plus four smaller pieces, is what this plan covers.
>
> Design and mechanics live in [docs/offline-oracle.md](../../docs/offline-oracle.md).
> This file is the remaining work only.

## The honest status

| Piece | State |
|---|---|
| Offline app shell (site loads with no connection) | Built, verified in a headless browser |
| Card text and data cached | Built, verified — a card never opened rendered after the background warm |
| Card artwork cached from Cloudinary | **Configured only.** The machine that built it could not reach Cloudinary, so this was never seen working |
| Background warm of all 64 cards | Built |
| Noticing a new deploy on a long-open tab | Not built |
| Asking the browser to keep the cache | Not built |
| Any automated test that the offline path works | Does not exist |

The single most important line above is the artwork one. Everything else is
polish; that one is the difference between "the oracle works offline" and "the
oracle works offline except you can't see the art."

---

## 1. Prove it on a real device — yours to do, nobody else can

**Why it needs you:** an agent's sandbox cannot reach the image CDN, which is
exactly the path in question. A headless browser proved the text; only a real
phone can prove the art.

**The test:**

1. On your phone, open the oracle and let one or two cards load.
2. Wait ten seconds without navigating away — that is the background warm running.
3. Turn on airplane mode.
4. Reload the page, then open a card you never touched.

**It passes if** both the words and the artwork appear. **It fails if** the text
appears and the art is blank or broken — that means the Cloudinary caching path
is wrong, and nothing below matters until it is fixed.

**If it fails,** the likely cause is the `crossOrigin="anonymous"` attribute on a
card-art image tag somewhere that was missed. Every call site was audited when
this was built, and the attribute is now also recorded in the design source file
so re-generating the entry page cannot silently drop it. A new call site added
since would be the thing to look for.

## 2. Notice a new deploy on a tab left open for days

A device that keeps the oracle open — a gallery iPad, a phone that never closes
tabs — will keep serving the version it cached until something forces a check.
Call `registration.update()` when the tab regains focus so it looks for a new
release on return rather than only on a cold start.

There is already a safety net for the related case: if a lazy-loaded part of the
app fails to arrive while online, the app reloads itself once. This is the
missing half — checking *before* something breaks rather than recovering after.

## 3. Ask the browser to keep the cache

Call `navigator.storage.persist()` once the 64-card warm finishes. Without it the
cache is "best effort" and the browser may clear it under storage pressure. With
it, the browser is asked to treat the oracle's cache as worth keeping.

This does not solve the iOS limit below, but it is the one lever the web gives.

## 4. The iOS seven-day fact — a decision, not a bug

iOS clears cached storage after roughly seven days with no visit, unless the site
has been added to the home screen. So on iPhone and iPad, "works offline" honestly
means "works offline if visited at least weekly, or if installed."

There are deliberately **no install prompts** — the app never asks to be added to
the home screen, on the grounds that offline-on-return is the feature and
installing is something the browser already offers in its own menu.

**Your call:** for a gallery iPad that sits unvisited between shows, that default
means the oracle will be online-only when it matters. If that surface is real,
the answer is a one-time manual "add to home screen" on that device, not a prompt
added to the site for every visitor.

## 5. The sentence that was left out

The first pass considered, and deliberately omitted, one quiet line telling the
reader the oracle works without a connection. Nothing says so today. The argument
for leaving it out is that the feature should be felt, not announced; the argument
for adding it is that a reader in a place with no signal will not try.

**Your call, and it is a voice question, not a technical one.**

## 6. Write one automated test so this cannot rot

No test anywhere covers the offline path — this feature ships on the strength of
its design, not on anything that fails loudly when broken. The right shape is a
Playwright test that navigates for real, then takes the browser context offline
and reloads, asserting a card renders with its art.

Note before starting: the mobile suite is currently red in bulk on main
(see the separate to-do item), so a new test there needs its own honest baseline
rather than being dropped into a suite nobody trusts.

---

## Things to not break

- `/sw.js`, `/registerSW.js` and `/index.html` must keep their no-cache headers,
  or the edge can serve a stale service worker after a deploy and no amount of
  client-side correctness will help.
- Any new card-art image tag needs `crossOrigin="anonymous"`. Without it the
  browser makes an opaque request the service worker cannot safely cache, and
  Chrome charges several megabytes of quota per opaque entry.
- `/api/*` and `/qr/*` are deliberately excluded from the offline fallback —
  they are live endpoints and the printed-plaque redirects, and must never be
  answered from cache.
- Atlas, admin, account, piece pages and the LED product are not cached by
  design. Opening one offline lands on a quiet "this part needs a connection"
  message rather than a crash. If any of those should work offline, that is new
  scope, not a fix.

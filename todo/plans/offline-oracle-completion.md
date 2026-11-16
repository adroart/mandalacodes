# Finishing the offline oracle

> Half of this shipped on 2026-08-21 and it is a better half than "unfinished"
> suggests — most of the oracle turns out to be computed on the device already.
> But nobody has ever watched it work with a phone genuinely offline, and the
> parts that do need a connection have never been thought through as an
> experience. That is what is left.
>
> Mechanics live in [docs/offline-oracle.md](../../docs/offline-oracle.md).
> This file is the remaining work and the open questions.

---

## Current contract and evidence

The current offline contract is **card prose and core reading/profile
functionality**, not artwork. Artwork is intentionally network-only to avoid
large downloads and storage costs. Do not treat a missing picture as a bug or
restore image prefetch without a separate product decision.

Automated production-worker coverage verifies a direct card arrival warms all
64 prose chunks into the actual service-worker cache, then opens an untouched
card with network fetches blocked and requires its real text. Separate cases
cover the calm missing-chunk notice and retry recovery. See
`tests/offline-qr-reading.spec.ts` and
[docs/offline-oracle.md](../../docs/offline-oracle.md). This is local automated
evidence, not proof from Adrian’s phone or production.

The application code computes coin casts, uses a bundled city lookup, and
computes profile data locally. Those behaviors are not asserted by
`tests/offline-qr-reading.spec.ts`. Remote account data, Atlas surfaces, live
invocation publishing, and reflection delivery still need connectivity. Reflection recording has an offline queue; its user-facing behavior and
drain/recovery expectations remain product and acceptance questions, not a
general-purpose guarantee.

## Owner-required phone acceptance

On the phone, open the oracle from a current production build, allow the prose
warm pass to finish, switch to airplane mode, reload, and open a different
card. Confirm its actual reading text renders without the connection notice.
Also interrupt warming and verify recovery after connectivity returns. Record
the device/browser and outcome. Artwork is outside this check by design.

## Owner decisions — 2026-11-16

Adrian approved these choices:

- **“Add the brief help text (Recommended)”**: place “Downloaded card text can be read offline. Artwork needs an internet connection” in existing reader help.
- **“Use action-specific guidance (Recommended)”**: Atlas needs a connection; a queued reflection is saved on this device and waiting to send.
- **“Show pending recordings (Recommended)”**: expose queued reflections with their pending status in the existing recordings view.

Implemented locally and reviewed on desktop and 320 px mobile. The existing Systems overlay carries the brief note; Atlas explains the connection requirement when its request fails offline. The existing private reflection Journal shows this card’s finished device recordings, audio controls, pending state and Try sending action. Failed delivery preserves the row; manual or automatic server acknowledgement refreshes the Journal. Pending recordings do not enter invocation composition before upload.

An expired administrator session closes private playback and exposes the existing session-ended message and Dismiss action without a React hook-order crash. Dismiss restores usable reading navigation. This required keeping the recorder’s hook order stable and separating unmount cleanup from retry-handler changes.

Verification: 13 focused queue/Journal unit tests, eight desktop/320 px browser cases covering guidance, delivery failure, retry, automatic acknowledgement and expired access. The affected delivery/401 cases passed again after review repairs. TypeScript and diff checks pass. Screens are retained in `/Users/adrianrasmussen/.codex/visualizations/2026/11/16/01a1e212-dadb-7803-a55d-c5f13a9968f9/offline-oracle/`.

These choices do not change artwork caching, promise permanent browser storage, or authorize a gallery iPad feature. A new reflection still needs a server session before capture; retries occur on administrator startup, connectivity return or user action, with no guaranteed background delivery. Existing queue data has no added account schema. Physical-phone acceptance and publication of this local change remain outstanding.

## Earlier product questions


**1. What is the promise?** Decide whether the interface should state that
card text can be available offline, and if so, where and in what voice.

**2. What should a reader see when an action needs a connection?** Decide
whether Atlas and queued reflection actions need different guidance.

**3. Is the gallery iPad real?** A gallery device needs its own acceptance
check after inactivity and storage pressure. Adding the site to the home screen
does not establish that every cached chunk will remain available indefinitely.
There is no install prompt, on purpose; decide the gallery use case before
changing the general visitor experience.

**4. Should a reflection recorded offline be a first-class thing?** The recorder
already holds recordings on the device rather than dropping them. Nobody has
decided whether a reader should be told that, or shown it, or whether it should
just quietly send later. This is the piece with the most room in it.

---

## Remaining product decisions and build work

The reader help, action-specific connectivity guidance and pending-recording visibility were approved above. Implement them within the current reader and reflection UI. Whether a gallery iPad is an actual use case remains Adrian’s decision; do not add that feature by guessing.

The proposals for a focus-time update check and a persistent-storage request
remain possible enhancements; audit the current implementation and device
behavior before deciding whether they are needed. A first offline browser test
is no longer missing: the focused production-worker coverage above exists. The
current contract is documented in `docs/offline-oracle.md`.

## Things that will silently break this

- The three files that bootstrap the offline layer must keep their no-cache
  headers, or the network edge can serve a stale copy after a deploy and no
  amount of correctness on the device will help.
- The live endpoints and the printed-plaque redirects are deliberately excluded
  from the offline fallback. They must never be answered from cache.
- The city list is regenerated by a script. If that script's output order ever
  stops being stable, every deploy re-ships four megabytes to every visitor even
  when nothing changed.

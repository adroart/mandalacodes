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

## What is actually true today

Audited 2026-08-21 by reading the code, not by trusting the notes.

**Works with no connection, once the device has visited once:**

- The site itself loads — shell, fonts, styles.
- All 64 card readings: their words and their artwork. A background pass pulls
  the whole deck quietly after the first visit, so a reading can land on any
  card, not only ones already opened.
- Casting coins, and the Today and Year energy panels. All computed locally.
- A personal profile from a birth moment — the astrology runs on the device, and
  the birth-place search reads a city list that ships with the site rather than
  calling out.

That last point matters more than it looks: **a complete personal reading is
possible with no connection at all.** That was not a stated goal; it fell out of
how the oracle was already built.

**Needs a connection:**

- The live invocation composer.
- Sending a recorded reflection. Recordings are held on the device in a queue
  and are not lost, but nothing has been tested about what happens when that
  queue tries to drain on a bad connection.
- Atlas, the account pages, admin, and individual piece pages. None are cached
  on purpose. Opening one offline shows a quiet line saying that part needs a
  connection, rather than crashing.

**Never verified anywhere:** all of it, on a real device.

---

## The one thing that must happen first — yours

Nobody has confirmed the artwork actually caches. The machine that built this
could not reach the image host, so that path was configured and reasoned about
but never seen working. Everything else here is wasted effort if it is wrong.

On your phone: open the oracle, let a card load, wait ten seconds without
navigating away, then turn on airplane mode, reload, and open a card you never
touched. **Both the words and the picture should be there.**

If the words appear and the picture does not, stop and say so — the cause is
almost certainly a card-art image tag missing its cross-origin attribute, and it
is a small fix, but nothing below is worth doing until it is made.

---

## The open questions — these are yours, and they are why this is not just a build

**1. What is the promise?** Right now the site says nothing about working
offline. A reader in a place with no signal has no reason to try. The first pass
deliberately left the sentence out on the grounds that the feature should be
felt rather than announced. That was a real argument, not an oversight — but it
means the feature only ever helps someone who happens to try. Decide whether the
oracle says it, and if so, where and in what voice.

**2. What should a reader see when they reach for something that needs a
connection?** Today they get one quiet sentence. That is honest and unobtrusive,
and it is also the same response whether they tapped Atlas out of curiosity or
tried to send a reflection they had just spoken. Those probably deserve
different answers.

**3. Is the gallery iPad real?** iPhones and iPads clear cached sites after
about a week unused, unless the site has been added to the home screen. So for a
tablet that sits between shows, offline will have quietly expired by the time it
matters. There is no install prompt, on purpose. If a gallery device is a real
plan, the answer is adding it to the home screen once on that device — not
adding a prompt every visitor sees.

**4. Should a reflection recorded offline be a first-class thing?** The recorder
already holds recordings on the device rather than dropping them. Nobody has
decided whether a reader should be told that, or shown it, or whether it should
just quietly send later. This is the piece with the most room in it.

---

## The build work, once the above is settled

**Notice a new release on a tab left open.** A device that never closes the tab
keeps serving the version it cached. Check for a new release when the tab comes
back into focus. There is already a recovery path if something breaks; this is
the missing half that checks before it breaks.

**Ask the browser to keep the cache.** One call once the 64-card pass finishes,
asking the browser to treat this cache as worth keeping rather than clearing it
under pressure. It is the only lever the web offers, and it does not solve the
iPhone limit above.

**Write one test that fails loudly.** Nothing anywhere tests the offline path, so
it can break silently on any deploy. The right shape drives a real browser,
takes it offline, and checks a card renders with its picture. Note before
starting: the phone test suite is currently red in bulk on main (separate to-do
item), so this needs its own honest baseline rather than being dropped into a
suite nobody trusts.

**Decide about the reflection queue.** Whatever question 4 settles, the draining
behaviour on a poor connection has never been exercised.

---

## Things that will silently break this

- The three files that bootstrap the offline layer must keep their no-cache
  headers, or the network edge can serve a stale copy after a deploy and no
  amount of correctness on the device will help.
- Any new card-art image needs its cross-origin attribute. Without it the
  browser makes a request the offline layer cannot safely store, and the browser
  charges several megabytes of quota for each one. The attribute is now recorded
  in the design source too, so re-generating the entry page should keep it.
- The live endpoints and the printed-plaque redirects are deliberately excluded
  from the offline fallback. They must never be answered from cache.
- The city list is regenerated by a script. If that script's output order ever
  stops being stable, every deploy re-ships four megabytes to every visitor even
  when nothing changed.

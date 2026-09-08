# The overarching plan

Written 2026-09-08 from seven fresh survey agents across both repos (routes, backend and security, content and status, writing quality, writing pipeline, collector journey across both sites, atlas against the intention statement). Every claim below traces to a file or a live probe. This sits above [launch-readiness.md](launch-readiness.md) (2026-09-01) and does not repeat it: where that plan already names the move, this one points at it.

## The shape of it

Three things, in this order, because each one is the ground the next stands on:

1. **The writing is the product and nothing in it is finished.** All 64 cards, all six lenses, still carry `status: scaffold`. The one artifact marked `final` breaks both absolute house rules. No machine checks any voice rule. Until the writing has a working loop, everything else is a frame around an empty room.
2. **The collector journey is built and switched off, and the wire between the sites is cut.** Buy, register, claim, place, inscribe: every step exists on the art site behind `livingLegacy: false`. The sale hand-off from the art site posts to an address on this site that now refuses it. No "all my pieces" view exists anywhere. One login does not carry across the two domains.
3. **The site around the oracle has three measurable gaps** (phones without 3D see only a footer, search engines cannot find any of the 64 card pages, nine pages reachable only by URL) and everything else has been audited since June.

## Track A: the writing. Owner: you, with the loop built by agents first.

The measured state, 2026-09-08:

- Every lens on every card is scaffold. Not one CODE reading is final. Two Gene Keys, three Human Design, two Relations sections are final. Changing-line texts: 0 of 384.
- The one finished reference piece, `oracle/readings/UL-122.md`, uses italics twice and sentence-internal em-dashes twice. The house style is documented, not enforced.
- Card 64 ships an editorial flag inside the Relations prose a reader meets, in italics, with an em-dash.
- The Design lens carries the generic-wellness vocabulary your voice profile bans: five "alignment", one "vibration", two "sacred", two "invited". The other five lenses are nearly clean.
- Openings: zero repeated first-six-words across 64 cards. The anti-formula pass held. But every CODE opening is the same shape: "You [verb]" declarative in second person. Clean in phrase, formulaic in structure.
- Your own diagnosis in [reading-rewrite.md](reading-rewrite.md) ("approaches everything as if it were a problem") is unresolved on all 64 CODE sections.
- Pipeline: source is markdown, build is fail-closed on presence (all six lenses, 17 required fields) and blind on quality. No prose lint, no repetition detector, no preview, no per-card brief, no progress tracker beyond hand-edited `oracle/TODO.md`, no in-app editor. WordForge is named as the writing room in the docs; the hand-off is not in this repo.

The moves, in order:

### A1. Build the enforcement before writing another sentence _(agent-runnable, moderate)_
A prose lint over `oracle/cards/*.md` and `oracle/readings/*.md` that fails the build on: italics in prose, sentence-internal em-dash, the banned-vocabulary list from the voice profile, an editorial flag left in shipped text, and repeated opening stems per lens. Wire it into `npm run build` beside the corpus validator. Run it once and fix what it catches (UL-122, card 64, the Design lens words). Done when the build goes red on a planted violation and green on the deck.

### A2. Decide the reading rewrite from the live page _(you, one hour)_
Already scoped as Decision two in launch-readiness. Read the five pilot cards on the live site. Whole, or one tradition wearing four names. That decision sets whether the CODE lens is a trim pass or a rewrite inside WordForge.

### A3. A per-card brief and a tracker _(agent-runnable, moderate)_
For each of 64 cards, one short brief: the four-question synthesis answers, the anchor image, the one thing this card is not. Generated from the frontmatter and the I Ching lens, reviewed by you in batches of eight. A tracker that reads frontmatter status and shows 64 rows by lens, so "how far along am I" is a glance and not a grep.

### A4. Your voice passes, lens by lens _(you, weeks)_
The long pole. Order: CODE (your rejected shape), then Design (the leaky lens), then Keys, Relations, Body, I Ching. Changing lines last, migrated from scaffold as drafts. Invocations for cards 2 to 64 are non-delegable and sit in their own lane.

## Track B: the collection and the intention. Owner: agents on the wiring, you on two switches.

The measured state, 2026-09-08:

- The art site's sale hand-off posts to `mandalacodes.com/api/atlas/sale`. This site's atlas middleware refuses every non-read request with a 410 since the 2026-08-09 move of the canonical record to the art site. Probed live today: 410. The sender retries three times and gives up silently. **The art site's TODO still tells you to set a shared secret to switch this chain on. Setting it will do nothing. That item is stale.**
- Registration, claim, intention ritual, and steward binding are all built on the art site and mount only when `livingLegacy` is on. It is off. The public reaches none of it.
- `adrianrasmussen.com/atlas` hard-redirects to `mandalacodes.com/atlas`. The record lives on the art site, the globe lives here, and the visitor is bounced from the canonical site to the read-only one. Backwards from your stated intent.
- No endpoint on either site answers "every piece this person holds." Collections on this site hold local saves of cards and artworks; the card kind no longer links. No oracle reading is tied to an owned piece anywhere.
- Both sites share one database, so the same email resolves to one account row, but each site runs its own login and the two domains cannot share a cookie. A collector signs in twice.
- The five invented placements are gone from the public globe. The globe shows one control at rest. Good.
- Against your intention statement, the atlas contradicts itself in three places: the filter panel reads as software, dreams float on the globe and then again in the card (your rule 47 says the card is the dream's only home), and the page carries engagement mechanics (once-per-visitor glosses, dream drift, lens toggles) you said the atlas should not have.

The moves, in order:

### B1. Repoint the sale hand-off, or retire it _(agent-runnable, quick)_
The receiver is on the art site now. Either the art site records the sale locally and this site reads it through the existing proxy, or the sender is deleted. One session in the art-site repo. Done when a test sale lands as a pending row somewhere that is not a 410. Fix the art-site TODO in the same commit.

### B2. One "my pieces" surface _(agent-runnable, deep)_
One endpoint on the canonical site returning every piece a steward holds, with the card number of each. One page on this site under the account that lists them and opens the card reading for each piece. This is the missing spine of "the collection of all these art pieces." Plan file when started.

### B3. Turn the atlas redirect around _(you decide, agent runs, quick)_
Either the globe moves to the art site, or the art site's atlas page stays and reads the record it owns instead of bouncing. Recommendation: keep the globe here, remove the bounce, and give the art site a quiet "see it on the atlas" link. The record stays canonical where it is.

### B4. The intention layer, reachable _(you decide, then agents)_
The intention ritual exists and mounts nowhere public. Decide where a collector anchors intention: at claim on the art site (built), or on the card here. Then it gets one entrance from live navigation. Not two.

### B5. Bring the atlas back to the intention statement _(you, then agents, moderate)_
Three cuts to review from your own words: the filter panel, the on-globe dream text, the drift and gloss mechanics. Each is one deletion. You decide which of the three survive; agents remove the rest. See [atlas-interface-redesign.md](atlas-interface-redesign.md) for prior thinking; do not reopen it from scratch.

### B6. One login across both sites _(park until B2 ships)_
Genuinely new architecture, and worthless until there is a collection view worth signing in for.

### The two switches only you can flip
- `livingLegacy` on the art site. Nothing in Track B is visible to a collector until it is on. Flip it after B1 lands and the journey is walked once behind the flag.
- `shopEnabled` on the art site. Your own note says logistics, not code. That stays your call.

## Track C: the site around the oracle. Owner: agents.

Already audited and fixed since June: security (2026-06-16), registration and legacy (2026-07-02), the nine launch-readiness audits (2026-09-01). Do not re-run those. What remains measurable:

### C1. Phones without 3D see only a footer _(agent-runnable, moderate)_
The fallback globe and side panel exist and are imported but never mounted when WebGL is absent. Mount them. Done when an iPhone with WebGL disabled shows the globe.

### C2. Search engines cannot find any of the 64 card pages _(agent-runnable, moderate)_
Card routes are client-rendered only and absent from every sitemap. A prerender step or a generated sitemap plus per-card meta gives the oracle a public face in search. The learn section already does this through Astro; copy the shape.

### C3. Nine pages reachable only by URL _(you decide, agent runs, quick)_
`/family`, `/atlas/claim`, `/atlas/homecoming`, `/atlas/registry`, `/atlas/edit`, `/profile`, `/profile/shared`, plus 2,200 lines of orphaned reading code. Each is keep-and-link, or delete. One list, one pass.

### C4. The launch-readiness "do first" five
Still the right five. [launch-readiness.md](launch-readiness.md) owns them. Item one (invented pieces) is done.

## What I would do first, this week

1. A1, the prose lint. It is the cheapest thing on this page and it makes every later writing hour count.
2. B1, the sale hand-off. It is the one place the plan and the other repo's TODO actively disagree, and the wrong one is telling you to do work.
3. A2, your one hour on the five pilot cards. Everything in Track A after it waits on that answer.

Then C1 and C2 in the background while you write.

## What this plan does not do

- It does not restate the launch-readiness five or its three decisions. They stand.
- It does not propose an in-app editor. The lint, the brief, and the tracker are enough loop for markdown. WordForge is the room if the rewrite is chosen.
- It does not propose the cross-domain login before there is something to log in for.

## The build plan (added 2026-09-08)

Fable directs: writes each brief, reviews every branch against this plan and the intention statement, does the final read. Fable does not write code. Model rule: Opus for hard implementation, Sonnet for mechanical work, Fable for taste and review. Each agent works in its own worktree on its own files; nothing overlapping runs in parallel.

**Wave 1, parallel, four worktrees, about a day**
- Opus, i64os: survey WordForge as it stands, then finish it to "Adrian can open a card, read the brief, write, and save back to markdown". Survey report to Fable first; build only after Fable signs the scope.
- Sonnet, mandalacodes: the prose lint (A1), wired into the build, run once, violations fixed.
- Sonnet, Adrian-Website: the sale hand-off (B1), repointed or retired, stale TODO corrected.
- Sonnet, mandalacodes: mount the non-3D globe fallback (C1).

**Wave 2, after wave 1 lands, three worktrees, two to three days**
- Opus, both repos: the "my pieces" endpoint and page (B2).
- Sonnet, mandalacodes: search visibility for the 64 card pages (C2).
- Sonnet, mandalacodes: per-card briefs and the lens tracker (A3), briefs reviewed by Fable in batches of eight before Adrian sees them.

**Wave 3, after Adrian's vetoes, one to two days**
- Sonnet: atlas redirect turned around (B3), the three atlas cuts (B5), the orphan sweep (C3), one entrance for intention (B4).

**Adrian's slots, in order**
1. The five pilot cards, one hour, after wave 1 (WordForge is the room).
2. Veto pass on wave 2 and 3 defaults, thirty minutes.
3. The two art-site switches, when B1 is proven.
4. The voice passes, weeks, in WordForge.

**Gate on every branch**: Fable reads the diff against the brief, runs the checks CI runs, and merges only what proves itself on the live page.

## Wave 1 log

- 2026-09-08 · WordForge survey measured: 776 core and 265 web unit tests pass; the save path writes the card into a throwaway copy and stops (push and draft-PR functions exist, tested, never called); no brief, no preview. Two oracle write systems exist inside WordForge: the series tab with the publish pipeline (wired) and the Oracle Editorial Desk (dry-run only, no UI, wrong target path). Decision: build on the wired one, leave the desk untouched this pass, reconcile later as its own item. Phase two scope signed: land the save as a draft PR, brief above the editor, rendered preview beside it, status reflected in the grid.
- 2026-09-08 · B1 landed (Adrian-Website PR 132, merged). A Stripe sale now writes its pending row straight into the art site's own database; the dead HTTP hand-off and its secret are gone. Verified in code and live: the table is the art site's, and the old receiver still answers 410. New fact surfaced: nothing displays the pending queue anywhere, because the mandalacodes admin list is behind the same 410. That viewer folds into B2. The art-site TODO now says so.
- 2026-09-08 · C1 landed (PR 172, merged). The status doc's claim was wrong in detail: the fallback was mounted, but it drew through a library that itself needs 3D, so phones without it got a blank black box. Now a flat constellation on a thin sphere line, warm bronze, clickable. Proven by a Playwright spec with 3D forced off that went red on a one-line mutation. Seen in the screenshots: the status buttons clip off the right edge on desktop; pre-existing, folds into B5.
- 2026-09-08 · A1 in review (PR 171, open). 28 violations found, not 2. Sent back once: sourcing asides must be hidden comments, not plain parentheses a reader meets. Revision running.
- 2026-09-08 · A1 landed (PR 171, merged). The build now fails on italics in prose, a mid-sentence em-dash, or an editorial note left where a reader meets it. Found and fixed: 28 house-rule breaks, then 21 cards carrying visible sourcing notes in plain parentheses. Vocabulary and repeated openings are warnings for now: 47 banned-word hits, Design lens heaviest; 42 repeated six-word openings, Design and Body. Those are Adrian's voice passes (A4), not lint fixes. Left open: card 57's two Gene Keys nature headings render a dangling dash because the source is empty.
- 2026-09-08 · C2 landed (PR 173, merged). A sitemap of 68 pages and a real static page per card with title, description, canonical, share tags, and structured data; the edge function now serves those files instead of rewriting the shell. Proven: card 33 served with its own head and the reading still hydrates, no CSP errors. Surfaced, pre-existing, not fixed: pages served by an edge function (every card page, every piece page) carry none of the security headers in public/_headers, because Pages applies that file to static assets only. Measured live: no CSP or HSTS on /universal-language/33. Follow-up for Track C: set the headers inside the functions or a shared middleware.
- 2026-09-08 · B2 landed (mandalacodes PR 174 and Adrian-Website PR 133, both merged). A signed-in steward now has "Your pieces" under the account on mandalacodes: plate, title, edition, where it rests, the inscribed intention as plain text, and one link to the card. Read straight from the shared database; no atlas endpoint touched. The art site has an admin page listing pending sales with one Confirm. **Default chosen for Adrian's veto:** Confirm registers a plate row with a fresh recovery code and does not bind the buyer's identity; binding stays the claim flow's job, because a Stripe sale cannot supply the printed code and verified backup that binding requires. The retired handler bound against the old ledger file, which is history only now.
- 2026-09-08 · C2 merged after a one-line rebase. WordForge loop is PR 144 on i64os, CI red on three unit tests that i64os main also fails on its latest run (vault router, command palette; measured, not this PR's files). Merge waits only on seeing the writing surface. Wave 3 started with defaults: B3 atlas link page on the art site, C3 close the four dead collector screens and delete orphaned reading code, C5 security headers on function-served pages. Held for Adrian's eyes: B4 where intention is anchored, B5 the three atlas cuts.
- 2026-09-08 · B3 landed (Adrian-Website PR 134, merged). The art site's /atlas no longer bounces; it is one quiet page with a sentence, an honest count of pieces at rest, and a single link to the globe. Sub-paths still forward. Behind the living-legacy flag the collector field page takes over, as before.
- 2026-09-08 · C5 landed (PR 175, merged): every page a function serves now carries the same security headers as the static shell, with the script hashes generated at build so the two cannot drift. C3 landed (PR 176, merged): the collector screens were already closed on main since 2026-09-01; this added the live proof and removed 889 lines nothing imported, including the empty 384-slot changing-lines placeholder (the six lines per hexagram already live in each card's I Ching section, which the build requires). The registry page stays: it reads the surviving public record and was wrongly grouped with the dead screens. Left: the cast-content command still points at the deleted placeholder; it should point writers at the I Ching lens in oracle/cards.

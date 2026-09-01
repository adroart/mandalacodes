# Handoff to fresh chat — the launch blocker, then three decided jobs

The overnight audit is merged and live. This carries the one thing standing
between an empty map and a working one, plus the three jobs Adrian decided on
2026-09-02.

Open a new chat and paste the block below.

```
Four jobs on the Mandala Codes oracle. Adrian decided all of them on 2026-09-02, so none needs re-litigating. Job one is the launch blocker and lives in a different project. Do them in order.

Read first, in this order:
1. todo/OVERNIGHT-STATE.md in mandalacodes, for what an overnight session changed and what it deliberately left.
2. oracle/INDEX.md, whose opening gate is the writing doctrine and is now correct.
3. todo/plans/reading-rewrite.md, especially the 2026-09-02 section carrying Adrian's own diagnosis in his words.

You do not need to re-survey the site or re-audit the writing. An eight lane audit ran on 2026-09-01 and its first tier shipped and is live. Typecheck is clean and the unit tests are 726 of 726. One unit test fails only inside an agent sandbox because it spawns a subprocess that cannot bind a socket there; ignore it. The mobile browser suite never starts the app before running, so it fails wholesale on a cold checkout; separate known to-do, not a gate.

JOB ONE, THE LAUNCH BLOCKER. The collector journey is live on neither site, and nothing else on the oracle matters as much.

Here is the actual situation, measured on 2026-09-01. The ownership record moved from mandalacodes to the artist site on 2026-08-09. Mandalacodes retired its own collector write path deliberately and correctly at that point: everything under its atlas API answers gone-for-good except three public reads, and its remaining read is a live proxy to the artist site. That side is right and must not be reverted.

The replacement was fully built on the artist site and never switched on. In the Adrian-Website project, launchFlags.ts line 108 reads livingLegacy false, and while it is false the collector field page and contributor access do not render at all; the atlas route redirects away instead. Line 30 reads shopEnabled false, which is why acquiring ends at an inquiry form rather than a checkout, and therefore why no sale event is ever produced for the hand-off that mandalacodes is waiting to receive.

So the map is empty because both halves of the hand-off are switched off, not because anything is broken and not because of database tables or secrets. The secrets are provisioned. Earlier notes blaming an operations gate are wrong and a correction banner now says so.

What is already built on the artist site, so do not rebuild any of it: the collector dreams, ritual, onboarding, privacy and letters endpoints; the keeper bind, claim-refusal, certificate-ledger, contributors, intention, message and piece endpoints; records, registry, lineage and certificates by public code; and the checkout, orders, invoices and viewings paths. On the interface side, the collector shell, the collector field page, the collector flow, the keeper panel, the registry views and the collector sales admin. Tests exist for the dream tiers, the registry rollout and the piece record triggers.

Your job is to find out whether it actually works, and to say so plainly.

Work in the Adrian-Website project, not in mandalacodes. Turn the flag on locally only, and walk the whole journey as a collector would: reach a piece, claim it, have the claim recognised, inscribe a dream, and see the record and the light that should follow. Then check the seam, because that is where this most likely breaks: mandalacodes reads the artist site's public atlas feed through a proxy and adapts its shape, so confirm a piece claimed on the artist site actually surfaces on the mandalacodes map.

Report what works and what does not, step by step, naming the step. Do not flip the flag on the live site in the same motion. A collector journey that is switched on and then fails partway is worse than one that is honestly closed, and Adrian has to see your findings before that goes live. If every step passes, say so and say you are ready to flip, and wait for him.

JOB TWO. Cut "the lineage calls this" from the card prose in mandalacodes. It is on 43 cards. One permitting sentence in one writing brief produced all of them, while the master writing guide bans naming sources in card prose, so the two documents contradict each other. Adrian ruled: cut it. Fix the brief first, or the phrase writes itself back on the next pass. Then sweep the 43 cards, replacing it with the deck speaking plainly and never with another stock construction. Three cards also carry literal source names, cards 60, 12 and 26, and those go regardless. Rebuild the card data afterwards, confirm it writes 64 cards, confirm the tests still pass.

JOB THREE. Sweep the Design section for repeated openings. One opening sits on 51 of the 64 cards across three near-identical variants. This is the same fault a four pass sweep just cleared from the other three sections, and the method that worked is written down in oracle/sections/_DIVERSIFY_PASS_THREE.md and _DIVERSIFY_PASS_FOUR.md. Read both first. The three rules that matter most: ban the sentence stem and not the exact phrase, because banning a phrase merely produces the same sentence with one word changed; give every writing agent the test "would this sentence work unchanged on another card"; and never vary a reference entry, because a reference that varies is broken. Split agents by card file so none share a file, and never run a tree wide git command while several are writing.

JOB FOUR. Set the 64 opening readings up in WordForge. Do NOT write or rewrite any reading prose. Adrian writes them himself, inside that interface, and the point of this job is that the interface carries the process. Open WordForge and see what it already holds for this series rather than reading about it; it already indexes all 64 cards and their six lenses. Put Adrian's diagnosis into the series' guiding template in his words, quoted at the top of todo/plans/reading-rewrite.md. In short: the readings approach every card as a problem to solve rather than as an energy to meet, and he wants balance between the positive and the negative, not the negative removed. Set the 64 readings up so he can work them one at a time. Then stop and hand him the way in.

Hard rails:
- Never the em dash character in anything a reader meets. The em dashes inside the card headings are structural separators the parser splits on; removing those breaks the deck.
- No italics and no underscore emphasis in anything a reader meets.
- Warm earth tones only on globe and map visuals, never blue or cold grey.
- No file paths or identifiers in the sentences Adrian reads. Those belong in commands.
- Report only what you measured, and label anything you did not.
- Never turn something on for real collectors without showing Adrian the walkthrough first.

When the four jobs land, stop and report. Do not start follow ups.
```

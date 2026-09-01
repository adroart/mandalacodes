# Handoff to fresh chat — three decided jobs on the oracle

The overnight audit branch is merged and live. This handoff carries the three
things Adrian decided on 2026-09-02, in the order they should be done.

Open a new chat in the mandalacodes project and paste the block below.

```
Three decided jobs on the Mandala Codes oracle. Adrian ruled on all three on 2026-09-02, so none of them needs re-litigating. Do them in this order and stop after the third.

Read first, in this order:
1. todo/OVERNIGHT-STATE.md, for what a long overnight session changed and what it deliberately left.
2. oracle/INDEX.md, whose opening gate is the writing doctrine and is now correct.
3. todo/plans/reading-rewrite.md, especially the 2026-09-02 section at the top carrying Adrian's own diagnosis in his words.

You do not need to re-survey the site or re-audit the writing. An eight lane audit ran on 2026-09-01 and its first tier shipped and is live. Typecheck is clean and the unit tests are 726 of 726. One unit test fails only inside an agent sandbox because it spawns a subprocess that cannot bind a socket there; ignore it. The mobile browser suite never starts the app before running, so it fails wholesale on a cold checkout; that is a separate known to-do and not a gate.

JOB ONE. Cut "the lineage calls this" from the card prose. It is on 43 cards. One permitting sentence in one writing brief produced all of them, while the master writing guide bans naming sources in card prose, so the two documents contradict each other. Adrian ruled: cut it.
- Fix the brief FIRST, or the phrase writes itself back on the next pass.
- Then sweep the 43 cards. Replace it with the deck speaking plainly, never with another stock construction.
- Three cards also carry literal source names, cards 60, 12 and 26. Those go regardless.
- Rebuild the card data afterwards, confirm it writes 64 cards, and confirm the tests still pass.

JOB TWO. Sweep the Design section for repeated openings. One opening sits on 51 of the 64 cards across three near-identical variants. This is the same fault a four pass sweep just cleared from the other three sections, and the method that worked is written down in oracle/sections/_DIVERSIFY_PASS_THREE.md and _DIVERSIFY_PASS_FOUR.md. Read both before starting. The three rules that matter most: ban the sentence stem and not the exact phrase, because banning a phrase merely produces the same sentence with one word changed; give every writing agent the test "would this sentence work unchanged on another card"; and never vary a reference entry, because a reference that varies is broken. Split agents by card file so none share a file, and never run a tree wide git command while several are writing.

JOB THREE. Set the 64 opening readings up in WordForge. Do NOT write or rewrite any reading prose. Adrian will write them himself, inside that interface, and the point of this job is that the interface carries the process.
- Open WordForge and see what it already holds for this series rather than reading about it. It already indexes all 64 cards and their six lenses.
- Put Adrian's diagnosis into the series' guiding template, in his words. It is quoted at the top of todo/plans/reading-rewrite.md. In short: the readings approach every card as a problem to solve rather than as an energy to meet, and he wants balance between the positive and the negative, not the negative removed.
- Set the 64 readings up so he can work them one at a time there.
- Stop. Hand him the way in and let him write.

Hard rails:
- Never the em dash character in anything a reader meets. The em dashes already inside the card headings are structural separators the parser splits on; removing those breaks the deck.
- No italics and no underscore emphasis in anything a reader meets.
- Warm earth tones only on globe and map visuals, never blue or cold grey.
- No file paths or identifiers in the sentences Adrian reads. Those belong in commands.
- Report only what you measured, and label anything you did not.

When the three jobs land, stop and report. Do not start follow ups.
```

---

## Context for after (Adrian's reference, not for the fresh chat)

The collector journey is still live on neither site. This project retired its collector path on purpose when the record moved, and the replacement on the artist site is built but switched off behind a flag there. That is one switch in the other project, and it is the only thing standing between an empty map and a working one.

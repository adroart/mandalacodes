---
description: Guided pass to fill the 384 I Ching changing-line texts in Adrian's voice, hexagram by hexagram
---

Help Adrian fill the changing-line statements for the I Ching coin-casting
feature, one hexagram (six lines) at a time, in his site voice. The lines
live in the `### Moving lines` subsection of the `## ICHING` section inside
each card's manuscript, `oracle/cards/<NN>.md` (zero-padded, e.g.
`oracle/cards/23.md` for hexagram 23). Each of the 64 hexagrams has six
lines (line 1 = bottom, line 6 = top); the casting panel on each Universal
Language card surfaces these line texts when a coin-cast produces moving
lines. (`data/ichingLines.ts`, the old 384-slot placeholder this command
used to point at, was deleted 2026-09-08 as dead weight — nothing in the
app ever read it; `tests/unit/oracleBrowserSource.test.ts` now asserts the
browser source never references it.)

## Invocations

- `/cast-content` — report whether any hexagram is missing its six lines
  and name the recommended next one, or confirm all 384 are already
  written. Do not start drafting.
- `/cast-content <n>` — work on hexagram N (1-64). Draft all six lines,
  present them for Adrian's approval, write the approved ones into the
  card's manuscript, report what's left.
- `/cast-content <n>-<m>` — work on hexagrams N through M in sequence. After
  each hexagram, pause for Adrian to approve or redirect before moving on.
- `/cast-content next` — same as `/cast-content N` where N is the next
  hexagram that has any unfilled lines.

## Read these first, every run

1. `oracle/cards/<NN>.md`, the `### Moving lines` subsection under
   `## ICHING` — the current state of that hexagram's six lines. As of
   2026-09-08 all 64 cards have all 384 lines written; this command is now
   for revising a line, not filling a blank, unless a future card is added
   without them.
2. For each hexagram you draft, read:
   - The card's record in `data/oracleData.ts` (via `CARD_BY_NUMBER`) for
     the hexagram name, the two trigrams and their natures, the essence.
   - The card's synthesis at `oracle/synthesis/key_<N>.json` if it exists,
     for `synthesis.iching.reading`, `judgement_lines`, `image_lines`. The
     line texts should echo this synthesis's voice, not invent in isolation.
   - The card's expanded data in `data/expandedOracleData.ts` for the
     trigram dynamics and image of the situation, if present.
3. The "Voice rules — strict" section below is the authoritative voice
   guidance. There is no separate CLAUDE.md on mandalacodes; the rules
   here ARE the rules.

## Voice rules — strict

- Mystical and grounded, never prescriptive. No "you should", no
  instructions to the reader. Name what is happening, not what to do.
- **No em dashes.** Use commas, periods, semicolons, colons, or "to" for
  ranges. Also no `--`.
- Personal but quiet. The line speaks; it does not lecture.
- Echo the language already in the card's synthesis and trigram data. If
  the card uses "yielding" and "the dragon", the line texts should feel
  born from the same vocabulary.
- Short. Two sentences max per line, often one. The line is a glimpse, not
  a paragraph.
- The six lines of one hexagram form a progression bottom to top — line 1
  is the seed of the situation, line 6 the overripe edge. Draft the set
  together so the arc reads as a whole.
- Never paste or paraphrase Wilhelm, Legge, or any other published
  translation. These are Adrian's original lines, not a copy of someone
  else's. The card's synthesis (already in the repo) is fair game to echo.

## Per-line classical context to honour

The traditional I Ching gives each of the six positions a character. Use
these as scaffolding, not formula:

- Line 1 (bottom): the beginning, the seed, the hidden start.
- Line 2: emergence into form, the inner ally, mid-trigram strength.
- Line 3: transition, the threshold between inner and outer, often tense.
- Line 4: arrival in the outer world, the position closest to the leader.
- Line 5: the place of right action, the ruler's seat, the realised gift.
- Line 6 (top): the overflow, the ending, often retreat or excess.

## Flow for a single hexagram

1. Read the current state of hexagram N's six lines in the `### Moving
   lines` subsection of `oracle/cards/<NN>.md`. Do not overwrite a filled
   line unless Adrian asks.
2. Gather the card's context (step 2 above).
3. Draft all six lines as one set, position 1 to 6, so the arc holds
   together. Present them to Adrian in this format:

   ```
   Hexagram <N>: <name> (<chinese>)
   <one-line essence from the card>

   Line 1 — <draft>
   Line 2 — <draft>
   Line 3 — <draft>
   Line 4 — <draft>
   Line 5 — <draft>
   Line 6 — <draft>
   ```

4. Ask: "Approve as-is, edit any line, or redraft?" Wait.
5. On approval (or after edits), update `oracle/cards/<NN>.md`:
   - Use the Edit tool against the exact marker line for that position,
     `**Line <n>** · _image:_ ... → becomes Hexagram ..., ...`, and the
     prose paragraph that follows it.
   - Keep the marker's image phrase and `becomes` target unchanged unless
     Adrian asks for those too; only the prose paragraph is the "line text".
   - Make six edits, one per line, in a single message when possible.
6. Confirm the write by re-reading the six lines back from the file and
   reporting the hexagram as updated (e.g. "Hexagram 23's six lines
   revised.").

## Flow for a range or `next`

Same as single, but after each hexagram pause briefly: "Continue to
hexagram N+1, or stop here?" Default to continue if Adrian gives a short
affirmative. Stop the run cleanly on any redirect.

## Progress reporting (no-args mode)

When invoked with no arguments, report ONLY:

- Scan `oracle/cards/*.md` for any card whose `### Moving lines`
  subsection is missing or has fewer than six `**Line N**` entries.
- If none are found, say so plainly: all 64 hexagrams already carry their
  six lines, and `next` has nothing to fill; the command is available for
  a deliberate revision only ("`/cast-content <n>` to revise hexagram N").
- If any are found, name the lowest-numbered one as the recommended next.

Do not start drafting in no-args mode.

## Safety rules

- Never rewrite an existing line's prose without explicit approval.
- Never edit a marker's `becomes` target or the card's other sections
  (CODE, KEYS, DESIGN, BODY, RELATIONS) from this command.
- If a hexagram's `### Moving lines` subsection or a `**Line N**` marker
  is missing or malformed, STOP and report it. Do not guess where to write.
- Each card should have exactly six `**Line N**` markers. If a count check
  disagrees with that, STOP and report.

## When done

Tell Adrian: which hexagram(s) were touched this session, the file
path(s) (`oracle/cards/<NN>.md`), and remind him that the casting panel on
every Universal Language card reads these lines live, straight from the
card manuscript, with no code change or rebuild step needed.

`$ARGUMENTS`

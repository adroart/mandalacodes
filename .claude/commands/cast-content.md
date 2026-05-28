---
description: Guided pass to fill the 384 I Ching changing-line texts in Adrian's voice, hexagram by hexagram
---

Help Adrian fill the changing-line statements for the I Ching coin-casting
feature, one hexagram (six lines) at a time, in his site voice. The data
file is `data/ichingLines.ts`. Each of the 64 hexagrams has six lines (line
1 = bottom, line 6 = top); the casting panel on each Universal Language
card surfaces these line texts when a coin-cast produces moving lines.

## Invocations

- `/cast-content` — show progress (filled / 384), name the recommended next
  hexagram, and stop. Do not start drafting.
- `/cast-content <n>` — work on hexagram N (1-64). Draft all six lines,
  present them for Adrian's approval, write the approved ones into the data
  file, report what's left.
- `/cast-content <n>-<m>` — work on hexagrams N through M in sequence. After
  each hexagram, pause for Adrian to approve or redirect before moving on.
- `/cast-content next` — same as `/cast-content N` where N is the next
  hexagram that has any unfilled lines.

## Read these first, every run

1. `data/ichingLines.ts` — the current state of the 384 fields. Count
   non-empty `lines` entries to report progress.
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

1. Read the current state of hexagram N's six lines in
   `data/ichingLines.ts`. Note which are already filled. Do not overwrite
   filled lines unless Adrian asks.
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
5. On approval (or after edits), update `data/ichingLines.ts`:
   - Use the Edit tool with the exact anchor string for that line: the
     TODO comment is unique per line, e.g.
     `'', // TODO: Adrian — hexagram 23, line 4`
   - Replace with `'Adrian's line text here.', // hexagram 23, line 4`
     (drop the TODO once filled, keep the position comment for searchability).
   - Make six edits, one per line, in a single message when possible.
6. Confirm the write by re-counting filled lines in the file. Report the
   new total ("Hexagram 23 filled. 12 of 64 hexagrams complete, 72 of 384
   lines.").

## Flow for a range or `next`

Same as single, but after each hexagram pause briefly: "Continue to
hexagram N+1, or stop here?" Default to continue if Adrian gives a short
affirmative. Stop the run cleanly on any redirect.

## Progress reporting (no-args mode)

When invoked with no arguments, report ONLY:

- How many of 384 lines are filled, how many empty.
- How many of 64 hexagrams are fully complete, partial, untouched.
- The lowest-numbered hexagram with any unfilled lines (recommended next).
- One line on the suggested approach: "Run `/cast-content next` to
  continue, or `/cast-content <range>` to batch."

Do not start drafting in no-args mode.

## Safety rules

- Never delete or rewrite a non-empty line without explicit approval.
- Never edit the file's structure (the interface, the export, the helper
  function). Only the six string entries per hexagram.
- If a line's TODO comment anchor is missing or has been edited away,
  STOP and report it. Do not guess where to write.
- The file has exactly 64 hexagram blocks and 384 line entries. If a
  count check disagrees with that, STOP and report.

## When done

Tell Adrian: how many lines were filled this session, the file path
[data/ichingLines.ts](data/ichingLines.ts), and remind him that the
casting panel on every Universal Language card will pick the new texts up
automatically with no code change.

`$ARGUMENTS`

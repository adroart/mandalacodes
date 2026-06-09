# Code panel — Reading + Invocation typography

**Status:** LOCKED. Variant A.

## The locked layout

```
═══ CODE 1 — EARTH'S BREATH ══════════════════════════════════════

      Pure beginning. The force that arrives before the
      thing it will make. You carry it already. It is
      what wants to start, to make, to put something
      into the world that was not there an hour ago.
      When it is awake in you, it feels like appetite.
      You begin things. You want to.

      [extra space between clusters — full breath]

      It has another face, and most people never learn
      it is the same force. The flat weeks. The mornings
      when nothing pulls at you, when the days run
      together and you cannot remember the last time you
      wanted to make anything. That is not the fire
      failing. That is the fire low, and low is one of
      its two seasons.

      [extra space]

      What this asks of you is small, and it takes a
      long life to learn. You carry the fire. You do
      not make it. It rises on its own schedule and
      sinks on its own schedule, and the work is to
      stop arguing with which one is happening...



      ─────────────────────────────────────────


                  ──── INVOCATION ────



        I recognize where I have let my fire
                       go quiet,

       and I am ready to learn what this would
                        teach me.

         I set down the weight of what is
                    already done.

        I set down the proof I keep gathering
              that I am the one who makes it.

         I am not the one who makes it. I am
       the one who carries it the way a riverbed
       carries water, shaped by what moves through.

        [...continues with extra space between lines...]

       The fire was never mine to make. Only to
              carry, and only for the time it stays.

                            ·

      ─────────────────────────────────────────


                  [ Next: I Ching → ]
```

## Specifications

### Reading
- No h2 header. The prose teaches itself.
- Three paragraph clusters.
- Inter-cluster gap: significantly larger than inter-paragraph margin within a
  cluster. Probably `margin-bottom: 2em` or equivalent vs `margin-bottom: 1em`
  within. The reader feels the empty line as a real beat.
- Font: serif (Cormorant Garamond), size 17-18px on mobile, line-height 1.7-1.75.
- Centered or left-aligned: TBD per visual rhythm (current implementation is
  centered; could go left-aligned for easier reading on long paragraphs).

### Transition between Reading and Invocation
- A single horizontal hairline rule. `border-bronze-600/25` or similar quiet color.
- Comfortable vertical breathing room above and below the rule.

### Invocation label
- "INVOCATION" in small caps, font-label or similar.
- Flanked by short rule-fragments on either side (`──── INVOCATION ────`).
- Centered.
- No "to be read aloud" instruction line. Per Adrian's call: the invocation
  does not have to be read aloud.

### Invocation lines
- Font: serif (same as reading).
- Size: same as reading or slightly larger (17-19px).
- Centered.
- **Significantly more leading between lines than the reading has.** Each line
  is a separate breath. Probably `line-height: 2.0` or use `margin-bottom`
  on each `<p>` for ~1.5em of space.
- No italic. Plain serif.
- Each line of the invocation text on its own `<p>` (already the implementation).

### Closing
- After the last invocation line, a single centered `·` (middle dot).
- Comfortable padding before the closing horizontal rule.
- Closing horizontal rule mirrors the opening one.

### Below the closing rule
- Generous vertical space.
- The "Next: I Ching →" button or link (existing pattern). The reader should
  feel the invocation has fully landed before the navigation pull arrives.

## What this variant explicitly drops

- The "to be read aloud" framing line (Adrian: not required).
- The "The Reading" h2 (decorative throat-clearing).
- The "Invocation" h2 in the same styling as Reading h2 (parallel-styled but
  not parallel content).
- Any italic treatment of the invocation (kept as plain serif — distinction
  comes from leading and label, not italics).

## Why this won over Variants B and C

- **Vs Variant B** (italic invocation, no frame): the italic was a subtle but
  real shift; Variant A's small-caps INVOCATION label is more honest about
  the mode change without italicizing the prose.
- **Vs Variant C** (bordered container for invocation): the container felt
  decorative / web-2.0 callout-box-ish. The deck's typographic identity
  doesn't use containers like that.

## Build notes

- Existing component is at `components/UniversalLanguageCard.tsx` lines 1794-1852.
- Changes needed:
  - Remove "The Reading" h2 (line 1806).
  - Replace "Invocation" h2 (line 1821) with the small-caps label + rule-fragments treatment.
  - Add the horizontal hairline rule between Reading and Invocation.
  - Add increased leading on invocation lines.
  - Add the centered `·` after the closing line.
  - Add the closing horizontal rule.
  - Increase vertical buffer between invocation close and "Next" button.
- The empty-state for cards without an invocation should be redesigned at
  the same time (problem #15 in the audit).

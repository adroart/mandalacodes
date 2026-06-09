# Markdown card parser — build spec

> The task: make the live card render from `oracle/cards/NN.md` (one Markdown
> file per card, all six sections) instead of the per-section JSON overlays.
> Markdown becomes the single source of truth; Adrian edits the `.md`, the app
> reflects it. No generated JSON intermediate.

## The format (locked — `oracle/cards/03.md` is the reference)

One file per card: `oracle/cards/NN.md` (zero-padded, e.g. `03.md`).
- **Frontmatter (YAML)**: number, card_name, hexagram_name, per-section `status`
  map, trigrams, gene_keys (shadow/gift/siddhi names), human_design
  (gate_number/keyword/centre/channel), body (organ/amino_acid/codon_ring),
  relations_data (pair, partner, ring + siblings, tarot_ring_arcana,
  tarot_upper_trigram {trigram,cards[]}, tarot_lower_trigram, immortals, sky,
  hebrew_letter), line_change_targets[], iching_lines[] (line→becomes).
- **Body**: `## ICHING`, `## KEYS`, `## DESIGN`, `## BODY`, `## RELATIONS`
  (and later `## CODE`). Each has `###` subheadings with prose underneath.
  - ICHING: Combination, Upper trigram, Lower trigram, Reading, Judgement
    (bullets), Image (bullets), Moving lines (six `**Line N** · _image:_ … →
    becomes … ` then prose).
  - KEYS: Shadow — <name>, Repressive nature — <name>, Reactive nature — <name>,
    Gift — <name>, Siddhi — <name>.
  - DESIGN: The drive — Gate N, <kw> / Where it lives — the <Centre> / What
    completes it — the <Channel> (N–M).
  - BODY: Physiology, Amino acid.
  - RELATIONS: Pair, Programming partner, Codon ring, Tarot (intro + bullets),
    Immortals, Deeper correlation.

## What to build

1. **A frontmatter + section parser** (`data/cardMarkdown.ts` or similar). NO new
   npm dependency — write a small frontmatter parser (the YAML used is simple:
   key: value, nested maps, inline `{a: b}` objects, and `[1,2,3]` arrays).
   Vite 5 supports `import.meta.glob('../oracle/cards/*.md', { query: '?raw',
   import: 'default' })` for raw text — use that, no build step.
2. **Map parsed Markdown → the EXISTING section types** that `getSynthesis()`
   already merges: `IchingSection`, `KeysSection`, `DesignSection`,
   `BodySection`, and the RELATIONS shape. Do NOT change the merge/overlay/cache
   logic or the card components — only change what FEEDS them. The parser
   produces the same objects the JSON loaders did.
3. **DUAL-PATH SAFETY:** keep the JSON loaders in place. Prefer `oracle/cards/NN.md`
   when it exists; fall back to the JSON overlays when it does not. This means
   card 3 renders from Markdown, the other 63 keep rendering from JSON until
   their `.md` exists. Nothing breaks mid-migration.
4. Field mapping notes (match the current overlay code in `data/synthesisData.ts`):
   - KEYS → gene_keys {shadow, repressive, reactive, gift, siddhi}
   - DESIGN bridge: gate→plate1, centre→plate2 (`channel` slot), channel→plate3
     (`circuit` slot). (See the existing design overlay ~line 212.)
   - ICHING → {combination→trigram_combination, reading, judgement_lines,
     image_lines, plus the full extended object incl. moving lines}.
   - BODY → {physiology, amino_acid}.

## Verification (MANDATORY before reporting done)

- Run the dev server, load UL 3's card, and confirm ALL SIX panels render with
  the Markdown content (the Zhun ideogram in ICHING combination, "Repressive
  nature — Anal" in KEYS, "Gate 3, Ordering" in DESIGN, the Tarot 3-axis web in
  RELATIONS). Take a screenshot to `test-results/`.
- Confirm a card WITHOUT a `.md` (e.g. UL 7) still renders from JSON (dual-path
  works).
- Report: files changed, the screenshot path, and any field that did not map
  cleanly.

Do NOT mark done on a typecheck pass alone — the card must visibly render from
Markdown. A blank panel = not done.

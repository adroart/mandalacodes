# Mandala Codes — Vector graphics brief

For Adrian to generate as a vector artist. Each entry: what it is, how many
to make, where it lives on the card, approximate display size, and a short
description of what the mark should hold.

All marks are **vector** (SVG). All must read cleanly from 24px to 80px.
Style across the set is consistent: clean line weight, no fussy detail at
small sizes, harmonizes with the deck's typographic identity (Cormorant
Garamond serif, Lato sans, bronze/wood/stone/paper palette).

---

## Tier 1 — needed for the locked design

These either don't exist or render poorly. Highest priority.

### G1 · Trigram element marks · 8 marks

Small iconic mark per trigram, beyond the abstract line pattern that already
exists. The line pattern shows the *structure* (broken vs unbroken lines);
this mark shows the *element*.

The 8 trigrams:
- **Heaven (Qian, ☰)** — sky, upward radiance, rising sun over earth
- **Earth (Kun, ☷)** — receptive ground, the field, the open
- **Water (Kan, ☵)** — the gorge, flowing, the abyss
- **Fire (Li, ☲)** — clinging flame, brightness, the sun
- **Thunder (Zhen, ☳)** — the arousing, the shock, lightning-strike
- **Wind (Xun, ☴)** — the gentle, the penetrating, breath
- **Mountain (Gen, ☶)** — keeping still, the standing form
- **Lake (Dui, ☱)** — the joyous, the open pool, mist rising

**Placement:** ICHING panel, alongside the trigram name in the upper/lower
nature section, and possibly in the trigram selector.

**Display size:** 16–24px (small companion to text).

**Style:** very simple. Two or three strokes each. Should feel like ancient
brush ideogram, not modern infographic. Color: bronze or wood-700 (currentColor).

---

### G2 · Tarot Arcana glyphs · 22 marks

Small typographic + symbolic mark per Major Arcana. Roman numeral plus a
simple sigil or symbol associated with the card.

The 22 Major Arcana: 0 The Fool · I The Magician · II The High Priestess ·
III The Empress · IV The Emperor · V The Hierophant · VI The Lovers ·
VII The Chariot · VIII Strength · IX The Hermit · X Wheel of Fortune ·
XI Justice · XII The Hanged Man · XIII Death · XIV Temperance · XV The Devil ·
XVI The Tower · XVII The Star · XVIII The Moon · XIX The Sun · XX Judgement ·
XXI The World.

**Placement:**
- Card chrome identity row, beneath the chapter wordmark (the smaller version)
- Tap-to-trace bottom sheet (the larger version)
- Master reference page at `/oracle/lineages`

**Display size:** 16–20px (chrome), 48–64px (bottom sheet hero).

**Style:** typographic with a single symbolic mark. Could be the Roman
numeral set in deck-serif with a small line-drawn symbol beside it.
Not full Tarot illustrations — these are *references* to the card, not
the cards themselves.

---

### G3 · Replacement dragonfly · 1 mark

The current Gene Keys section dragonfly (in `UniversalLanguageCard.tsx`
lines 164–194) is a generic four-ellipse silhouette and doesn't read well.
Needs replacement.

**Placement:** Gene Keys / KEYS section header (the hero glyph at the top
of that panel).

**Display size:** 64–80px.

**Style:** heraldic dragonfly in the spirit of Japanese kamon "tombo"
crests. Should have real character at small sizes. Symmetrical but not
sterile. Could carry a subtle reference to gene strands or genetic
heritage (paired wings as paired chromosomes, the abdomen as a strand),
but only if it doesn't fight the dragonfly's own form.

Color: bronze, single fill. Solid silhouette.

---

## Tier 2 — needed for richer visual rhythm

These add visual character but the deck can ship without them. In rough
priority order:

### G4 · Codon ring sigils · 22 marks

Small distinctive sigil per codon ring. Each ring carries a thematic name
(Fire, Water, Light, Alchemy, Trials, Gaia, Origin, Union, Purification,
Divinity, Humanity, Illumination, Illusion, Life-Death, Matter, Miracles,
No Return, Prosperity, Secrets, Seeking, The Whirlwind, Destiny).

**Placement:** Relations panel, alongside the ring name in the codon
ring header. Tap-to-trace bottom sheet for the ring.

**Display size:** 20–28px (header), 48–64px (bottom sheet).

**Style:** each sigil should feel related to the others (consistent
weight, scale, line-quality) but each carries its own character.
Probably a small abstract mark — not a literal picture, not a
typographic letter. Think alchemical sigils, simplified.

Scope note: 22 unique marks is a substantial body of work. Could be
deferred or done in batches.

---

### G5 · Human Design center shapes · 9 marks

Standard HD iconography. Each center has a distinct geometric shape:

- **Head Center** — triangle pointing up (apex at top)
- **Ajna Center** — inverted triangle
- **Throat Center** — square (sometimes shown as a parallelogram)
- **G Center (Identity)** — diamond (rotated square)
- **Heart / Will Center** — small triangle
- **Sacral Center** — square (often differentiated from Throat by position)
- **Spleen Center** — triangle pointing left
- **Solar Plexus Center** — triangle pointing right
- **Root Center** — square at the bottom of the graph

These are industry-standard and used across all Human Design material.
Reproducing them cleanly is the work; the shapes themselves are well-defined.

**Placement:** DESIGN panel, alongside the center name in the *center*
field. Tap-to-trace bottom sheet.

**Display size:** 20–28px (inline), 48–64px (bottom sheet hero).

**Style:** clean geometric outlines, single stroke weight. Could be filled
when "defined" and outline-only when "undefined" (future feature; for now,
single style is enough).

---

### G6 · Eight Immortals marks · 8 marks

Each Immortal has a ritual tool. Could be rendered as the tool itself
(more elegant) or as a portrait silhouette (more on-the-nose).

The 8 Immortals and their tools:
- **Han Xiangzi (韓湘子)** — flute (Heaven/Qian)
- **Zhongli Quan (鍾離權)** — fan (Earth/Kun)
- **Lü Dongbin (呂洞賓)** — sword (?)
- **Zhang Guolao (張果老)** — fish-drum (Water/Kan)
- **Cao Guojiu (曹國舅)** — castanets (Mountain/Gen)
- **Lan Caihe (藍采和)** — flower basket (Wind/Xun)
- **He Xian Gu (何仙姑)** — lotus flower (Lake/Dui)
- **Li Tieguai (李鐵拐)** — iron crutch + gourd (Fire/Li)

**Placement:** Relations panel deeper-correspondences layer, when the
Immortal is named. Tap-to-trace bottom sheet.

**Display size:** 16–24px (inline mention), 48–64px (bottom sheet).

**Style:** the ritual tool, rendered as a single iconic mark. Avoid
portraiture — the tool reads better at small sizes.

Lowest reader-engagement priority. Could defer entirely if scope is tight.

---

## Tier 3 — quality review of existing assets

Currently exist but should be reviewed for rendering quality.

### G7 · Hexagram glyphs · existing, review

The current `HexagramSVG` renders 6 lines correctly but is purely
bar-pattern. Review:
- Does it read clearly at 28px (sticky nav)?
- Does it read at 56px (kin door thumbnail)?
- Does it read at 80px+ (panel hero)?
- Is the line weight right across sizes?
- Should there be a small frame or border around it to anchor it visually?

Existing component is at `components/UniversalLanguageCard.tsx` line 132+.

If the answer is "renders fine, just review weight at small sizes" — keep
it. If the answer is "needs a custom hand-drawn version" — that's a much
bigger commitment (64 unique hexagram glyphs).

---

### G8 · Trigram line patterns · existing, review

Same question — review at 24px (the smallest size used in the trigram
selector). Existing `TrigramSVG` at `UniversalLanguageCard.tsx` line 101.

---

## Tier 4 — optional, low priority

### G9 · Zodiac sign glyphs · 12 marks (optional)

Standard zodiac symbols (♈♉♊♋♌♍♎♏♐♑♒♓) render fine as Unicode in most
typefaces. Custom-drawn versions in the deck's style would feel more
cohesive but aren't needed for ship.

**If made:** 16–20px chrome, 48–64px bottom sheet. Same style as the
Tarot Arcana glyphs so they harmonize.

---

### G10 · Hebrew letter glyphs · 22 marks (optional)

Unicode Hebrew (אבגדהוזחטיכלמנסעפצקרשת) renders cleanly. Custom not
required.

---

### G11 · Chapter wordmark glyphs · 6 marks (optional)

Small per-chapter glyph alongside each tab in the sticky chapter wordmark:
Code, ICHING, KEYS, DESIGN, BODY, RELATIONS.

**Placement:** beside or above each chapter label in the sticky tab row.

**Display size:** 16–20px (very small, sits inside the tab).

**Style:** very minimal. Maybe just a small typographic mark or single
symbol. Optional — the text labels work fine alone.

---

## Color / palette reference

For all marks unless specified otherwise:

- **Default fill / stroke:** `currentColor` (inherits from parent)
- **On paper backgrounds:** bronze-700 (#a07a3d-ish) or wood-700
- **On dark backgrounds:** stone-100
- **Hover/active:** bronze-500
- **Disabled / quiet:** wood-500 or stone-400

Stroke weight: aim for 1.5–2px at 24px, scale proportionally for larger
display.

---

## Delivery format

- **SVG**, viewBox standardized (e.g., 0 0 100 100 for square marks)
- Single `<path>` or small set of paths preferred for clean inline use
- `currentColor` for fill/stroke so React components can color them
- No embedded styles, no IDs that might collide across instances
- Optimized (SVGO or hand-cleaned)

When ready, drop into `mandalacodes/components/oracle/glyphs/` (folder
to be created) and they'll be wired into the React components.

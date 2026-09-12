# How oracle card writing reaches a reader: render survey

Repo root (worktree): /Users/adrianrasmussen/Documents/Files/2 Areas/Coding/mandalacodes/.claude/worktrees/fresh-chat-handoff-a8e5cd

No dev server was running on port 2222 (checked with lsof) and none was started, per instructions. Everything below comes from reading the parser, compiler, the live card-reading component tree, and the generated markup it renders. No screenshots were taken.

## 0. The pipeline, file by file

- Parser (runtime neutral): lib/oracle/card-markdown.ts. Splits oracle/cards/NN.md frontmatter (hand written YAML subset) from the body, then splits the body on `## SECTION` and `### Subheading — Tail` into sections/subheadings/paragraphs/bullets.
- Compiler: lib/oracle/compiler.ts, function compileParsedCard (line 129) and buildSearchText (line 253). Turns the parsed sections into the public CanonicalCard object, validates required fields (throws if missing), and builds `card.searchText` (a different, larger blob than the web search index below, used only inside the compiled card object itself, not by the ranker).
- Card page component chain (the only place a visitor reads a card's prose):
  - components/UniversalLanguageCard.tsx, the route component for `/universal-language/:number`. Builds an `EBData` bag from the compiled card + `data/synthesisData.ts` (`getSynthesis`) and hands it to the generated "Earth's Breath" reading template.
  - components/oracle/eb/generated/EBReading.host.tsx, hand written host/controller (verbatim ported from the design file's own controller) wrapping the fully generated markup.
  - components/oracle/eb/generated/EBReading.generated.tsx (1063 lines), the actual JSX every visitor sees. Never hand edited; regenerated from a Claude-Design `.dc.html` file.
  - components/oracle/reading/CardReadingData.tsx / CardReading.tsx / generated/CardReadingBody.host.tsx, a SECOND, separate generated design (the "designed header": kicker, card name, hexagram divider, keywords) that wraps the EBReading content. Only its header shows; the rest of this second design is hidden by CSS (see §1).
- Search index builder: scripts/build-search-index.ts calls `loadCorpus()` (mcp/oracle-server/src/corpus.ts) then `toSearchDoc()` (lib/oracle/transform.ts), writing `data/oracle-search-index.json`. `data/oracle-corpus.json` (the full compiled cards) is built separately and consumed by the hosted MCP/REST for `get_card`/`get_voice`/etc.
- Ranker: lib/oracle/ranker.ts, shared by the client-side search helper (lib/oracle/search.ts, currently imported by no UI component, see §3), the hosted `/api/oracle/search` endpoint (functions/api/oracle/search.ts), and the hosted MCP tool `search_oracle`.
- Hosted MCP: functions/api/oracle/mcp.ts dispatches to lib/oracle/hosted.ts (`dispatch`), which implements `get_card`, `get_voice`, `get_line` (lib/oracle/tool-results.ts), `list_cards`, `find_artworks`, `cast_hexagram` (lib/oracle/cast.ts), `search_oracle`.

## 1. The card page: order, labels, what's collapsed, above the fold

The live reading is NOT a single scrolling column. It is a horizontally swipeable, scroll-snapped set of six full-viewport panels (`display:flex; scrollSnapType: x mandatory`), navigated by a sticky pill bar and a thin progress rail at the very top. A visitor swipes/taps between "chapters"; only one system is on screen at a time.

Visible order (both mobile and desktop use the same EBReading markup; CardReading.tsx only forks the surrounding chrome above ~820px):

1. Entrance animation (only on first arrival from the deck index or a QR scan; see §3), full-screen ring of all 64 hexagram glyphs, card name, keywords, dismissed by tap/Enter/Escape.
2. Site top navigation (mobile only; desktop uses its own header nav from the second "designed" shell).
3. The "designed header" (components/oracle/reading/generated/CardReadingBody.*): kicker line "No. N · Universal Language" then the card name as an H1, a hexagram-line divider, and the keywords line (`syn.keywords.join(' · ')`). This is frontmatter-derived structured data, not prose, see §2. (card-reading-fullbleed.css lines 265, 278-341 hide everything else this second design would otherwise show, it exists only to supply this header band.)
4. A chart-relevance row: "Is this code in your chart?" (YourPositionCallout) + a "Save this code" button (UniversalLanguageCard.tsx lines 243-250).
5. Sticky pill nav, labels: "Universal" / "I Ching" / "Gene Keys" / "Human Design" / "Body" / "Relations" (EBReading.generated.tsx lines 138-165). These are the SAME six systems as the `LENSES` array used by the other (mostly inert) CardReading.tsx rail (`ul`, `iching`, `genekeys`, `humandesign`, `body`, `relations`), just re-labelled per surface, see the label-renaming table below.
6. The six scroll-snap panels themselves, in this fixed order:
   1. **Universal Language**, eyebrow "Universal Language", H2 "The Reading", then the CODE prose: first paragraph with a drop-cap, remaining paragraphs plain. This is the first and only prose a visitor reads before any other system. An "Invocation" sub-block (H3 "Invocation") appears below it only if a live invocation has been authored (components/oracle/invocation), empty otherwise, no placeholder.
   2. **I Ching**, header glyph + "I Ching · about" (opens an overlay with fixed boilerplate about the I Ching itself, not this card). Three clickable rows: "Guà N / [Hexagram name] / [Upper over Lower]" tagged "Hexagram", then "Upper" and "Lower" rows tagged "Trigram", each swapping a "Combination / Upper nature / Lower nature" text block below (tab-like, not simultaneous, only one of the three combination texts is visible at a time, default "Combination"). Then "The Reading" (eyebrow) + iching.reading paragraphs. Then a two-column "The Judgement" / "The Image" block. Then a boxed "Cast the coins" interactive widget, see §3, this IS the moving-line reading surface, embedded directly in the card page.
   3. **Gene Keys**, header glyph, "About the Gene Keys" overlay trigger. A three-way tab strip: Shadow / Gift / Siddhi (each showing that frequency's *name*, e.g. "Immaturity"). Below, three full blocks in order Shadow → Gift → Siddhi, each: bold eyebrow label, the frequency name, an empty subtitle line (`gkShadowSub` etc. are hard-coded `''` in UniversalLanguageCard.tsx, dead field), then prose paragraphs. Only the Shadow block carries a `<details>` "Repressive · Reactive · go deeper" disclosure, collapsed by default, expand-on-click. **This disclosure's content is NOT the card's authored repressive/reactive prose**, see the defect noted in §2/§6.
   4. **Human Design**, header "Gate N" + "Human Design · about" overlay trigger. Three blocks: "The Drive" (name + prose), "Where It Lives" (name + prose), "What Completes It" (name + prose), these are the DESIGN section's three subheadings (`gate`, `centre_field`, `channel` in the compiled card) renamed. Then three static chip tags.
   5. **Body**, eyebrow "Body", H2 "The Body of the Code", three static tag chips, then two blocks "Physiology · The Liver" and "Amino Acid · Lysine" with prose paragraphs under each.
   6. **Relations**, eyebrow "Relations", H2 "Its Kin", the unity_line prose centered below the heading, an interactive orbit diagram (kin nodes: pair / codon ring / sky / tarot / hebrew letter / immortal), then a single selected relationship's teaching prose below the diagram (only one relation's text is visible at a time; clicking a node swaps it, default "pair").
7. Bottom tab bar (mobile): Family / For Me / The 64 / Piece / Share.

Above the fold on mobile (before any scrolling or swiping): the designed header (card name + hexagram glyph + keywords), the chart-relevance row, the pill nav, and the top of the Universal Language panel, i.e. the drop-cap opening line of the CODE reading is the first prose a visitor's eye reaches, exactly as the parser/compiler pipeline treats it (`card.essence` = the CODE reading's first paragraph).

## 2. Structured fields vs. prose-only: what the writer should not repeat

Shown as structured chips/labels/glyphs (frontmatter or derived, never prose, appears with or without any prose loaded):

| Displayed as a field | Source |
|---|---|
| Card name, "No. N · Universal Language" | frontmatter `card_name`, `number` |
| Keywords line ("a · b · c") | `## CODE` intro's `_Keywords:_` line (frontmatter-adjacent, structured, parsed out of prose) |
| Hexagram glyph + name + "Upper over Lower" | frontmatter `hexagram_name`, `trigrams` |
| "Gate N" | frontmatter `human_design.gate_number` |
| Gate/Centre/Channel tag chips ("Gate 1", "Identity Center", "Channel of Inspiration 1–8") | **hard-coded literal strings in the generated markup for Card 1, see §6, not per-card data** |
| Shadow / Gift / Siddhi names | frontmatter `gene_keys.{shadow,gift,siddhi}` |
| "Physiology · The Liver", "Amino Acid · Lysine", "Ring of Fire" tags | **also hard-coded Card-1 literals, see §6** |
| Kin diagram labels (pair number, ring, sky sign, tarot card, hebrew letter) | `relations_data` frontmatter, resolved through `RELATIONS` subheadings |

Because the name, keywords, hexagram name/formula, gate number/keyword, and gene-keys frequency names are ALL displayed as their own chip/label/glyph before any prose is read, the guideline should tell writers: don't open a paragraph by restating "this is Gate 1" or "your shadow is Immaturity", the UI has already said it a few lines above. Prose should begin doing the work the label can't (image, consequence, movement), not re-announce the label.

Everything else, CODE reading, ICHING reading/judgement/image/moving-line text, KEYS shadow/gift/siddhi/repressive/reactive prose, DESIGN gate/centre/channel prose, BODY physiology/amino-acid prose, RELATIONS unity-line/pair/inverse/programming-partner/codon-ring/tarot/sky/immortals/hebrew-letter teaching, exists ONLY as prose; the UI never surfaces a structured/short-form version of it (except where noted broken in §6).

## 3. Every other surface that shows card prose

- **In-card-page cast (the moving-line reading)**: there is no separate "cast result" page. The I Ching panel of the SAME card page (§1.6.ii) contains the whole cast-the-coins flow: three coin icons → on click, the app throws six lines against THIS card's own binary (never a fresh random hexagram, see cast.ts), then shows "Your cast" with a rendered bar-line hexagram glyph, a "Hexagram N · Name" label for what was thrown, and if any lines are moving, a second labelled hexagram ("Moving toward → Hexagram N · Name") the reader can tap to jump straight to that card's own page. Below that, if lines moved, "Your Moving Lines" (else "The Six Moving Lines" is never shown at all when no cast has happened) lists ONLY the moving line(s): "Line N" + the line's `image` (a short italic-styled image phrase, e.g. "a soapnut tree…") + the line's full prose `reading`, and a caption "Flipped → Hexagram X · Name" (or "This line alone →" when more than one line moved). No truncation on this text; the full moving-line prose from the manuscript renders.
- **Deck index / "The 64" list**: not read in depth this pass, but it consumes the same compiled card + `synthesis.keywords`; the search box mentioned in build-search-index.ts is NOT wired to any UI, `lib/oracle/search.ts`'s `loadOracleIndex()` has zero importers anywhere in `components/`. On-site free-text search over card prose does not currently exist as a visible feature; only the hosted `/api/oracle/search` REST endpoint and the `search_oracle` MCP tool expose it.
- **Search results (hosted API + MCP `search_oracle`)**: `lib/oracle/ranker.ts` `bestSnippet()` (lines ~185-195) returns ONE sentence, truncated to 220 characters if it contains a matched query term (searched in order: iching → essence → glance → gene_keys fields, wait, actual order tried is glance, essence, iching, gene_keys), else falls back to the first 160 characters of essence or glance with no sentence boundary respected (can cut mid-sentence). Label: `card_name`, `ring_name`, `keywords`, plus the snippet, no section label is attached to the snippet, so a writer can't assume the reader will know which lens the sentence came from.
- **MCP `get_card`**: returns the FULL compiled `CanonicalCard`, every section, untruncated, including `gene_keys.repressive`/`reactive` (present in the data even though the live UI doesn't render it, see §6).
- **MCP `get_voice`**: returns one lens's full object untruncated (`glance`, `iching`, `gene_keys`, `human_design`, `tarot`, `body`, note `relations` is NOT a selectable voice), plus `anchor: card.essence` (the CODE opening paragraph) attached to every voice regardless of which lens was asked for.
- **MCP `get_line`**: returns one ICHING moving line's full `{image, reading, becomes}` untruncated, or `{note: "This line is not yet authored for this code."}` if missing.
- **MCP `cast_hexagram`**: full `CastResult` (all 6 lines, primary/resulting binaries) plus `primary_card`/`resulting_card` objects that carry only `{number, card_name, essence}`, i.e. the CODE opening paragraph only, not the full reading, for both the cast-into and cast-toward card.
- **QR / printed-card arrival**: `functions/qr/[number].js` is a pure 302 redirect to `/universal-language/N?ref=qr`, there is no separate physical-card-back or arrival-page prose surface in this codebase; a QR scan lands on the exact same card page described in §1, just with the entrance animation forced on and (on Apple mobile) a Safari-handoff prompt. Any printed card-back copy is off-repo (physical print asset).
- **Share cards**: `generateStory()` in EBReading.host.tsx draws a canvas image (Instagram-story sized) using only `cardName`, `code`, and the first three keywords, no prose at all.

## 4. App-composed prose and hard-coded length limits

- `card.essence` (compiler.ts line 186): the app-generated "summary" is simply `code.reading.split('\n\n')[0]`, the CODE section's first paragraph, verbatim, reused as: the search-ranking anchor field, the MCP `anchor`/`primary_card.essence`/`resulting_card.essence` fields, and the drop-cap opening line on the card page. Nowhere is it independently authored, whatever the first paragraph of CODE is, IS the card's one-line identity everywhere else in the system. This is the single most load-bearing paragraph in a card.
- `card.searchText` (compiler.ts `buildSearchText`, line 253): a giant concatenation of nearly every field for a DIFFERENT, unused-by-the-live-ranker full-text blob living on the compiled card object itself (not what `rank()` actually searches, that uses the separate, narrower `SearchDoc.fields` built by `lib/oracle/transform.ts`, which excludes relations and repressive/reactive text, see §6).
- Hard truncation: `bestSnippet()`, 220 chars for a matched sentence, 160 chars (raw slice, can cut mid-word) as fallback. No other hard character caps found in the render path; the card-page prose panels render full paragraphs with no truncation or "read more" (the Gene Keys `<details>` is a manual authorial disclosure choice, not a length-based truncation).
- `buildKinLines`/kin diagram labels truncate nothing textual, glyphs and short names only.

## 5. Typography: what markdown survives

The parser (card-markdown.ts) does almost no markdown-to-rich-text conversion, and the renderer does none:

- Paragraphs: plain text only. `parseBody()` joins prose lines with spaces into a paragraph string; nothing downstream converts `**bold**`, `_italic_`, or inline markdown to HTML. Every prose panel renders `<p>{text}</p>` with the raw string, so if an author typed `**word**` inside a paragraph it would show literal asterisks to the reader (no `react-markdown`/`dangerouslySetInnerHTML` found anywhere in the oracle render path, checked).
- Top-level bullets (lines starting with `- ` or `* `) ARE parsed out into a separate `bullets[]` array (not folded into paragraphs), but the only place bullets are used (ICHING Judgement/Image lines) joins them back with `\n` (`(judgementSub?.bullets ?? []).join('\n')` in UniversalLanguageCard.tsx) and renders the result inside a single `<p>` with no `white-space: pre-line` set anywhere in the stylesheets checked. Multiple bullet lines therefore collapse into one run-together block with no visible line break, bulleted lists never render as an actual `<ul>` anywhere in the live reading.
- The ONE emphasis markdown the parser actively strips: `_Keywords:_ a · b · c` (underscores removed, split on `·`), and RELATIONS prose passed through `withoutOuterEmphasis()` which strips a single matching pair of `_..._` or `**...**` wrapping the ENTIRE string (not inline emphasis), plus strips inline editorial markers `_[FLAG: ...]_` and trailing `(Derived ... see note.)` notes.
- Moving-line markers (`**Line 1** · _image:_ … → becomes Hexagram 8, Holding Together.`) are a special-cased regex format, not general markdown, the bold/italic syntax there is a structural delimiter the parser consumes, not styling that survives to the reader (the reader sees "Line 1" as a designed numeral in its own styled span, and the italic `_image:_` text is extracted into a separate styled field, not shown with an underscore).
- Blockquotes: no `>` blockquote handling found in the parser at all; a `>` line would fall through as ordinary prose text (including the `>` character itself).

**Guideline implication: write plain, single-idea paragraphs. Do not rely on bold/italic/lists/blockquotes for emphasis inside prose, none of it survives to the page.** The only structural markdown that does anything are: the top-level `## SECTION` / `### Sub — Tail` headings themselves, the `_Keywords:_` line, and the `**Line N** · _image:_ … →` moving-line marker line.

## 6. Parser/writing constraints, and verified defects worth flagging separately

Constraints enforced by the compiler (compileParsedCard, lines 141-175), a card FAILS TO BUILD without these:
- All six sections present: CODE, ICHING, KEYS, DESIGN, BODY, RELATIONS.
- Non-empty: CODE reading, ICHING hexagram_name/combination/reading, KEYS shadow/repressive/reactive/gift/siddhi, DESIGN drive/centre/channel prose, BODY physiology/amino_acid, RELATIONS unity_line/pair/inverse/programming_partner/codon_ring teaching.
- CODE must have a non-empty `_Keywords:_` line.
- ICHING must have Judgement and Image bullet lists (non-empty).
- ICHING must have EXACTLY 6 moving lines, numbered 1 through 6 in order (`iching.lines.length !== 6 || ...line !== index+1` fails the build).
- Each `## SECTION` heading may appear only once (duplicate throws).
- Subheading matching is prefix-based and case-insensitive (`findSub` matches "Shadow", "Repressive", "Reactive", "Gift", "Siddhi" under KEYS; "The drive", "Where it lives", "What completes it" under DESIGN; "Physiology", "Amino acid" under BODY; "Combination", "Upper trigram", "Lower trigram", "Reading", "Judgement", "Image", "Moving lines" under ICHING), a subheading must start with the expected phrase or its content is silently treated as absent (build then fails on the missing-required-text check).
- The em-dash/hyphen tail convention (`### Repressive nature — Anal`) is how the parser extracts a named face (`repressive_name`, `reactive_name`, `drive_label`); the text after the LAST `—`/`–`/`-` separator becomes that name, required for KEYS/DESIGN subheadings that want a name to be picked up.

**Verified defect, out of scope for a writing guideline but affects what a reader actually sees, so flagging it rather than silently working around it in the guideline:** the live card page (components/oracle/eb/generated/EBReading.generated.tsx) has several strings that are still the literal Card 1 ("Earth's Breath") content, unbound to `vals`, and therefore identical on all 64 cards regardless of what's authored:
- Gene Keys "Repressive · Reactive" disclosure body (lines ~601-614): the two paragraphs under "Repressive · Depressive" / "Reactive · Frenetic" are hard-coded Card-1 text, not `card.gene_keys.repressive`/`reactive` (which DOES exist in the compiled data and IS required at build time, it's authored, just never wired to the reader).
- Human Design tag chips (lines ~748-756): "Gate 1", "Identity Center", "Channel of Inspiration 1–8" are literal, not the per-card gate/centre/channel.
- Body section labels (lines ~790, 795, 809): "Ring of Fire", "Physiology · The Liver", "Amino Acid · Lysine" are literal, not the per-card organ/amino-acid/codon-ring.

Because this affects every card except card 1, and it means authored KEYS repressive/reactive prose is invisible to readers on the live site today (though present in the manuscript, the compiled corpus, and every MCP tool), I'm flagging it as a candidate for a separate fix rather than folding it into the writing guideline itself.

## 7. What was NOT rendered live

No dev server was running on port 2222 (`lsof -i :2222` returned nothing) and none was started per the instructions given. No screenshots exist for this pass; everything above is derived from source, including exact JSX/CSS line references, which should be reliable but has not been visually confirmed against a running instance.

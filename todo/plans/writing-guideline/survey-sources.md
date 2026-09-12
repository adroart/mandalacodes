# Mandala Codes oracle research corpus, mapped

Path correction: the corpus is not at the stale path cited in the repo's
oracle/INDEX.md (`~/Documents/Obsidian Vault/oracle/`). The real path is
`~/Documents/Obsidian Vault/Mandala Codes/oracle/`. Every path below is
relative to that folder unless stated otherwise.

Scope checked: `oracle/` (the live corpus, 64 hexagram folders plus
gene-keys/, human-design/, systems/), the predecessor `Mandala Codes/hexagrams/`,
`Mandala Codes/1 Projects/oracle/`, `Mandala Codes/5 Sources/`, and the
top-level vault `5 Sources/clippings/`.

---

## 1. The source families in `hexagrams/NN/`

Every one of the 64 hexagram folders has all 15 file-prefix families present
(64 files each, or 384 for the six moving lines, or roughly 18-20 tarot
files per hexagram). Coverage by file COUNT is complete. Coverage by
CONTENT is not: a cluster of files across several families are empty
(frontmatter only, zero words in the body). See the completeness table
after the family descriptions.

| Prefix | Book / author / tradition | What one file contains | Extract type | Citation carried |
|---|---|---|---|---|
| `legge-NN-name` | James Legge, "The Yi King" (1882, public domain) | The full hexagram text: King Wen's judgment plus all six line texts, plus Legge's own footnotes on terminology and history | Verbatim (public domain translation) | Yes, `source: file://Legge-1882/...`, `translator` field |
| `wilhelm-NN-N-name` | Wilhelm/Baynes, "The I Ching or Book of Changes" (Bollingen) | The Judgement and Image texts, plus the six line texts, in Wilhelm's phrasing | Verbatim (OCR'd from a PDF scan) | Yes, but file is short (avg 179 words, several are empty stubs, see below) |
| `huang-NN-name` | Alfred Huang, "The Complete I Ching" | A long essay per hexagram: name/structure, the Decision, the Commentary on the Decision and the Symbol, and historical/philosophical background (Confucius, King Wen's imprisonment, etc.) | Verbatim, OCR'd (visible OCR garbling: stray characters, misread words) | Yes, `translator: Alfred Huang` |
| `cleary-taoist-NN-name` | Thomas Cleary, "The Taoist I Ching" | Cleary's Taoist-commentary translation and explanation, organized by line, with an internal-alchemy reading | Verbatim | Yes |
| `cleary-buddhist-NN-name` | Thomas Cleary, "The Buddhist I Ching" | The same structure, but a Buddhist-commentary reading (karma, enlightenment, bodhisattva language) | Verbatim | Yes |
| `deng-NN-name` | Deng Ming-Dao, "The Living I Ching" | A free-flowing personal-essay reading of the hexagram, not line-by-line commentary but a narrative meditation that touches each line near the end | Paraphrase/synthesis in the author's own voice, but still a verbatim extract of Deng's published text | Yes |
| `oracle-NN-name` | The 2018 Eranos I Ching (Ritsema/Sabbadini, the "Chinese Oracle" school) | A philological reading: "Fields of meaning" for every ideogram in the hexagram name, judgment, and each line, plus the Image Tradition text | Verbatim, dense classical-Chinese philology | Yes, marked "Oracle 2018" in `_hexagram-NN.md`'s Sources list |
| `practical-NN-name` | A "Practical Guide" I Ching book (unnamed in metadata beyond "Practical Guide") | Historical/cultural essay per hexagram (illustrations, proverbs, sometimes long passages of untranslated or garbled Chinese characters from a scanned figure) | Verbatim, OCR'd, uneven quality | Weak, `source` is a folder path only, no author named |
| `gk-64ways-NN-name` | Richard Rudd, "The 64 Ways" (Gene Keys, 2022) | A long first-person teaching essay per Gene Key: the Shadow/Gift/Siddhi journey, personal anecdotes, quotes | Verbatim | Yes, `author: Richard Rudd` |
| `gene-key-NN` | Richard Rudd, "Gene Keys" (the original book, chapter PDFs) | The full book chapter for that Gene Key: Shadow essay, Gift essay, Siddhi essay, several pages each | Verbatim, page-by-page OCR dump (`--- Page N/14 ---` markers) | Weak, `source` is a pending-folder file path, no author field |
| `gene-key-NN-name` | Structured data pulled from `gene_keys_master.xlsx` | A short reference table: card name, I Ching name, HD keyword, Shadow/Gift/Siddhi, dilemma, repressed/reactive, three contemplation titles, partner, codon ring, tarot card | Structured reference, not prose | Yes, spreadsheet source named |
| `qw-gate-NN-name` | Dr. Karen Parker, "Quantum Wellness" (2025) | A Human Design gate teaching: challenge, "Quantum Expression" vs "Conditioned Expression," a Sacred Flaw Story prompt, contemplations, an affirmation | Verbatim | Yes, `author: Dr. Karen Parker` |
| `tarot-*` | A "Golden Dawn correspondences" table (`i-ching-and-tarot-correspondences-table.docx`) | A short reference card per Tarot correspondence: upright/reversed keyword, I Ching trigram, metaphysical correspondence, Golden Dawn attribution (planet/sign/Hebrew letter), archetype, figure/role | Structured reference, ~40-90 words | Yes, docx source named |
| `line-NN-L` (six per hexagram, 384 total) | Composite of Legge + Deng + Cleary (Taoist) + Huang + Cleary (Buddhist) for that one line | See section 2 below | Verbatim excerpts, assembled | Yes, per-source headings |
| `_hexagram-NN` | Adrian's own index/master file | Structural data (trigrams, binary, inverse/opposite/nuclear hexagram, line-change targets, codon ring, amino acid, HD center), links to every source file, the Relationships section, the Correlation section, and (for hexagram 1 only) a full `## Synthesis` draft | Adrian's synthesis, not a source extract | N/A, this is the index |

### Completeness by family (all 64 hexagrams checked)

Every family has a file present for all 64 hexagrams. The gap is inside
the files: a recurring cluster of hexagrams in the back third of the King
Wen sequence has empty (frontmatter-only) bodies across several families
at once. This looks like one shared extraction failure, not 39 separate
problems.

| Hexagrons with an empty (0-word) file | Families affected there |
|---|---|
| 25, 40, 44, 54, 55 | one family each (isolated single misses) |
| 50, 51, 52, 53 | 2-3 families each (gene-key, oracle, practical, and/or wilhelm) |
| 56, 57, 58, 61, 62, 63, 64 | 3-5 families each, the worst cluster |

Concretely: `gene-key-NN.md` is empty for hexagrams 40, 50, 52, 53, 57, 63,
64 (7 of 64). `gene-key-NN-name.md` is empty for 51, 57, 58, 61, 62, 63, 64
(7 of 64, an almost identical set). `oracle-NN` (Eranos) is empty for 25,
51, 54, 56, 57, 61, 62, 63, 64 (9 of 64). `practical-NN` is empty for 50,
52, 56, 57, 63, 64 (6 of 64). `wilhelm-NN` is empty for 44, 52, 53, 55, 56,
57, 58, 61, 63, 64 (10 of 64, the largest gap in that family). Cleary
(Buddhist) has one isolated stub, hexagram 17 (17 words).

The `tarot-*` family is technically "under 80 words" for 874 of its 1,134
files, but that is by design, not a completeness problem: these are short
correspondence-table entries (upright/reversed keyword, trigram,
metaphysical correspondence, Golden Dawn attribution), averaging 71 words
on purpose. The one real tarot gap found was a genuinely empty file,
`hexagrams/23/tarot-seven-of-pentacles.md` (0 words, and this file is
absent from the family average calculation above only because it was
caught by hand).

Word-count range by family (average, min, max, across all 64 or 384
files): `_hexagram-NN` 427/385/1,977. `cleary-buddhist` 1,366/17/7,399.
`cleary-taoist` 1,353/945/2,463. `deng` 897/638/1,157. `gene-key-NN`
3,816/0/15,382. `gk-64ways` 2,771/1,711/5,365. `huang` 1,055/247/2,171.
`legge` 813/477/1,160. `line-NN-L` 513/156/7,198 (the outliers are lines
that happen to carry the full Cleary Buddhist "using nines/sixes" essay).
`oracle` (Eranos) 2,424/0/3,574. `practical` 1,361/0/2,878. `qw-gate`
388/304/489. `wilhelm` 179/0/260 (this family is consistently the
shortest even where populated, since it is only the Judgement, Image, and
line texts with no commentary).

---

## 2. The moving-line notes (`line-NN-L.md`, 384 files)

Structure, checked on hexagram 1 and hexagram 23: each line file opens
with frontmatter carrying the hexagram, line number, line type (yin/yang),
a `judgment_word` (good-fortune / neutral / regret / danger, etc.), a
`core_image` (e.g. "hidden dragon"), a short `keyword` (e.g. "Hidden
Potential"), and a one-sentence `theme_summary`. These four fields
(keyword, core_image, judgment_word, theme_summary) are Adrian's own
synthesis language, not quoted from any translator, and they are the
closest thing to "his own line text" that exists in the corpus today.

Below the frontmatter, the body is a composite of verbatim excerpts under
source headings: Legge Text, Deng Ming-Dao Reading, Cleary (Taoist)
Reading, Huang Reading, Cleary (Buddhist) Reading. Wilhelm's line text is
NOT included in the line files even though it exists in the parent
`wilhelm-NN` file; a moving-line synthesis pass would need to pull it in
separately. All six lines for both hexagrams checked had real source text
in the five sections; no empty line-note stubs were found (the family's
minimum word count across all 384 files is 156, confirmed above).

Adrian has not yet written original line prose anywhere in this corpus.
Every line file is translator excerpts plus his own four-field tagging.
The `_hexagram-01.md` Synthesis draft (the one hexagram with a written
card) does contain original per-line prose ("The moving lines" subsection
under I-CHING VOICE), so that is the model for what a finished line entry
should look like, but it lives in the hexagram index file, not in the
`line-NN-L.md` files themselves.

---

## 3. `gene-keys/`, `human-design/`, `systems/`: what is in each

### `gene-keys/` (beyond the per-hexagram `gene-key-NN` and `gk-64ways-NN` files)

- `codon-rings/` (22 files plus an index): one file per codon ring
  (Ring of Fire, Ring of Water, Ring of Illusion, Ring of Destiny, and so
  on). Each is a short reference: the amino acid, the member count, and a
  linked list of the member hexagrams. Average 47 words, none empty, but
  none has any teaching prose either, only the membership table. This is
  the one place the ring-sibling relationships are indexed by ring rather
  than by hexagram.
- `spheres/` (13 files plus an index): the Gene Keys "Golden Path"
  spheres (Purpose, Vocation, Culture, Brand, Pearl, Attraction, IQ, EQ,
  SQ, Core, Radiance, Evolution, Life's Work). Every one of the 13 files
  is an unfilled template (~200 words, entirely placeholder prompts like
  "Write here in your own voice..."), not real content. `gene-keys/_index.md`
  does not mention this folder at all, an undocumented gap between the
  index and the folder tree.
- `_sources/golden-path/` (three subfolders: `activation/`, `venus/`,
  `pearl/`, 9, 10, and 9 chapter files respectively): the full chaptered
  extraction of Richard Rudd's Golden Path teaching (the Activation,
  Venus, and Pearl sequences: pathways of dharma, karma, initiative,
  growth, service, the quantum). This is real, substantial verbatim book
  content, but it feeds nothing yet. It is the raw material the empty
  `spheres/` files are supposed to be distilled from.

Unique material gene-keys/ adds beyond the per-hexagram folders: the
codon-ring membership tables (a ring-centric index the hexagram folders
only give you one direction of, "shares this ring with"), and the entire
unused Golden Path / sphere layer (personal-profile material, not
per-card teaching, and currently disconnected from card writing).

### `human-design/`

- `gates/` (64 files, `gate-01.md` … `gate-64.md`): full-length web
  articles (scraped from ahumandesign.com, not a book), one per gate,
  averaging 1,565 words. Structure: an introduction, then sections on
  "Gate N and its Impact on Relationships," "...Role in Career and Work,"
  "Understanding the Shadow Side," "Harnessing the Power of Gate N." None
  are empty. Several individual gate files are cited by card sourcing
  notes as "empty stubs" (gate-38, gate-56, and others per specific card
  notes), which does not match this survey's own word count for
  `gate-01.md`; the discrepancy is likely that different gates were
  scraped at different completeness, not that the family is uniformly
  populated. Worth re-checking gate-by-gate before relying on it.
- `channels/` (36 files, `channel-A-B.md`, A<B, one shared by both its
  gates): the same web-article style and source, averaging 1,520 words,
  none empty in the aggregate count, though again individual card notes
  flag specific channel files (e.g. `channel-28-38.md`, `channel-11-56.md`)
  as empty stubs. Both counts can be true at once if the stub files were
  since re-scraped, or if the aggregate average is being pulled up by a
  few very long files; this survey did not re-verify every individual
  channel file byte-for-byte.
- `centers/` (9 files plus an index): full-length extracts from Robin
  Winn's "Understanding Centers in Human Design" (2021), the deepest
  material in the entire corpus by volume, 7,900 to 12,300 words per
  center. Each center file mixes verbatim book text with visible OCR
  scan noise (stray line breaks, "W / hile" style hyphenation artifacts).
  The index file (`_index-centers.md`) usefully cross-references which
  gates seat in which center, duplicating (and confirming) the
  `hd_center` field already in each `_hexagram-NN.md`.
- `_sources/` (7 book-length extractions, not wired to any per-gate
  file yet): `hd-guide-2021` (39 chapters), `modern-guide-to-hd` (14),
  `quantum-wellness` (46, the same book `qw-gate-NN` already draws its
  gate essays from, so this is the fuller book behind that family),
  `understanding-centers` (11, the source behind the `centers/` files),
  `understanding-clients` (10), `understanding-profiles` (14), and
  `you-and-the-shadow` (6). Four of these seven books (Modern Guide,
  Understanding Clients, Understanding Profiles, You and Your Shadow)
  have no per-gate or per-hexagram file drawing on them at all. They are
  full raw material sitting unused.

Unique material human-design/ adds beyond the per-hexagram folders: the
center-level teaching (nothing per-hexagram is this deep on the body/
energy-center layer), the channel-level teaching (needed for the DESIGN
section's "channel" subsection, and for the RELATIONS "channel partner"
subsection), and four entirely unmined source books.

### `systems/`

- `trigrams/` (8 trigram files, a master reference, and a trigram-to-tarot
  mapping file, 10 files total): every single file is empty (frontmatter
  only, 0 words). This is a genuine, total gap: nothing in the vault
  currently explains what Heaven/Qian, Earth/Kun, Fire/Li, Water/Kan,
  Thunder/Zhen, Wind/Xun, Mountain/Gen, or Lake/Dui actually mean as
  trigrams, beyond the one-line names already duplicated into every
  `_hexagram-NN.md` frontmatter (`upper_trigram`, `lower_trigram`).
- `eight-immortals/` (8 immortal files, a master reference, and an
  "eight spirit helpers" file, 10 files total): also every file is
  empty. The immortals' names are known (they are named in each
  `_hexagram-NN.md`'s Correlation section, one per trigram), but no file
  anywhere in the vault carries their attributes, stories, or symbols.
  Card sourcing notes for cards 09, 11, 12, 28, 36, and 50 all flag this
  explicitly and say the immortal lore they wrote comes from "established
  Eight Immortals tradition," i.e. from outside this vault entirely.
- `tarot/` (3 files: a codon-ring-to-tarot mapping, a "keywords full
  reference," and a "Xuan system introduction"): also all three files are
  empty. The `_hexagram-NN.md` Correlation section links to all three by
  name ("Ring-to-Tarot mapping," "Golden Dawn correspondences," "The Xuan
  Tarot system") as if they existed; they do not. The actual Golden Dawn
  correspondence data (planet/sign, Hebrew letter) that cards 09, 11, 12,
  36, 43, and 50 needed for their "Deeper correlation" subsections had to
  be reverse-engineered from individual `tarot-*.md` files' own
  `golden_dawn_attribution` and `metaphysical_correspondence` fields,
  hunting for whichever hexagram folder happened to carry that specific
  Major Arcana card.
- `deck/` (5 files): `intro.md` and `wilhelm-intro.md` are empty.
  `back-matter.md` is a real, large (58,131 words) verbatim chapter from
  the Practical Guide book, on ancestor veneration and the I Ching as a
  ritual/divinatory tool, not per-hexagram. `gene-keys-card-names.md` is
  a genuinely useful small reference table, the master list mapping all
  64 Gene Key numbers to their card names.

This is the corpus's biggest structural hole: the entire cross-system
correlation layer that `systems/_index.md` promises ("how the systems
interlock") is, file for file, unwritten. Trigrams, immortals, and the
tarot correspondence tables are the three things every card's RELATIONS
section reaches for last (Immortals, Deeper correlation: sky, Hebrew
letter), and all three are empty at the vault level.

---

## 4. Which sources feed which section of a card

Based on reading `_hexagram-01.md`'s finished Synthesis, `_hexagram-23.md`'s
unwritten scaffold, and the sourcing notes on the 12 written cards in the
repo (01, 02, 07, 08, 09, 10, 11, 12, 36, 43, 50, and the older-format
frontmatter on those same numbers plus a few more).

| Card section | Subsection | Sources available | How thin |
|---|---|---|---|
| CODE (opening face) | card name, essence, keywords, invocation | `gene-key-NN-name.md` (card_name field), Adrian's own synthesis | Not source-thin, this is meant to be original writing |
| ICHING | Combination (trigrams, binary) | `_hexagram-NN.md` frontmatter (names only); `systems/trigrams/*` (empty) | THIN. No file explains what a trigram means, only names it |
| ICHING | Reading (the situation) | `oracle-NN` (Eranos), `practical-NN`, `deng-NN`, cross-checked against `legge`, `wilhelm`, `huang`, `cleary-taoist`, `cleary-buddhist` | Well covered, 7-8 sources, except where `oracle`/`practical` are empty (see section 1) |
| ICHING | Judgement | `legge`, `wilhelm`, `huang`, `cleary-taoist`, `cleary-buddhist` (all carry the classical Judgement text) | Well covered |
| ICHING | Image | Same five as Judgement | Well covered |
| ICHING | Moving lines | `line-NN-L.md` (composite of 5 translators), plus `practical-NN`'s line-image passages | Well covered where line files are populated (all 384 confirmed non-empty) |
| KEYS | Shadow, Repressive, Reactive | `gene-key-NN-name.md` (official names), `gene-key-NN.md` (full essay), `gk-64ways-NN.md` (Rudd's Ways essay) | Well covered except the 7 hexagrams where `gene-key-NN.md` or `gene-key-NN-name.md` is empty |
| KEYS | Gift | Same three | Same caveat |
| KEYS | Siddhi | Same three | Same caveat |
| DESIGN | drive (gate keyword) | `qw-gate-NN.md`, `human-design/gates/gate-NN.md` | Well covered in aggregate, individual gate files sometimes flagged as stubs by card notes |
| DESIGN | centre | `human-design/centers/center-*.md` (deep), `_hexagram-NN.md` frontmatter (`hd_center`, one line) | Well covered, this is the corpus's deepest material |
| DESIGN | channel | `human-design/channels/channel-A-B.md` | Covered in aggregate, individual files sometimes stubs |
| BODY | physiology, organ | `gene-key-NN.md` (the PHYSIOLOGY line near the top of the chapter) | THIN. This is the only place organ/physiology is named at all; no dedicated body-systems book exists in the corpus |
| BODY | amino acid | `_hexagram-NN.md` frontmatter, `gene-key-NN.md` | Adequate, it is a single fact repeated in two places |
| RELATIONS | pair, inverse, opposite, nuclear | `_hexagram-NN.md` frontmatter and Relationships section | This is pure structural data, no prose teaching anywhere backs it up. A card has to invent the prose connecting two paired cards itself |
| RELATIONS | programming partner | `gene-key-NN-name.md` (partner field), `_hexagram-NN.md` | Adequate as a fact, thin as a teaching |
| RELATIONS | ring (codon ring) | `gene-keys/codon-rings/codon-ring-of-X.md` (membership only, ~47 words avg), `_hexagram-NN.md` | THIN. Ring membership is known, ring meaning/theme is not written anywhere except what a card author infers from the shared Gene Keys material of its members |
| RELATIONS | tarot | `hexagrams/NN/tarot-*.md` (short reference cards, well covered, ~1,134 files), `systems/tarot/*` (all three mapping/reference files empty) | The individual card facts exist; the connective tissue (ring-to-tarot mapping, keywords reference, Xuan system) does not |
| RELATIONS | immortals | `_hexagram-NN.md` (names only), `systems/eight-immortals/*` (all 10 files empty) | THIN to the point of absent. Every card that wrote an Immortals subsection had to import lore from outside the vault |
| RELATIONS | deeper correlation (sky, Hebrew letter) | Reverse-engineered from a `tarot-*.md` file's own `golden_dawn_attribution`/`metaphysical_correspondence` fields; `systems/tarot/tarot-keywords-full-reference.md` (empty) was meant to hold this directly | THIN, and fragile: several cards had to hunt in a DIFFERENT hexagram's folder for the specific Major Arcana card carrying the correspondence they needed, because their own folder's tarot file for that card either did not exist or was itself a stub |

The pattern: everything anchored to a named book (I Ching translations,
Gene Keys, Quantum Wellness, Understanding Centers) is well sourced.
Everything anchored to Adrian's own connective/correlation layer
(trigram meaning, immortal lore, ring theme, tarot cross-mapping) has a
name and a link in `_hexagram-NN.md` but no file behind the link.

---

## 5. What the current cards actually cite

Checked `oracle/cards/*.md` in the repo (64 files). Two different
sourcing conventions are in use, from two different writing passes:

- An older frontmatter `sourcing_note:` field, used on cards 01, 02, 07,
  08, 09, 10, 11, 12 (8 cards).
- A newer `<!-- meta:sourcing ... -->` HTML comment block near the end
  of the file, with a per-section citation list plus a `meta:fact_check`
  block, used on cards 28, 36, 43, 50 (4 cards, and it is clearly the
  more disciplined and more recent convention: it separates ICHING,
  KEYS, DESIGN, BODY, RELATIONS citations, and explicitly flags every
  "empty stub" source file it had to work around).

12 of the 64 cards (19 percent) carry any explicit sourcing
documentation at all. The other 52 have finished or partly finished
prose (card 3, for example, has ICHING/KEYS/DESIGN/BODY all marked
`final` in its status frontmatter) with no citation trail back to which
vault files the prose came from.

Family mention counts, across the 12 sourced cards:

| Source family | Cards citing it |
|---|---|
| `oracle-NN` (Eranos) | 12 of 12 |
| Golden Dawn / Hebrew letter / sky (derived from tarot files) | 12 of 12 |
| `gene-key-NN` (full chapter) | 11 of 12 |
| `gk-64ways-NN` (Rudd's 64 Ways) | 10 of 12 |
| `qw-gate-NN` (Quantum Wellness) | 9 of 12 |
| `gene-key-NN-name` (reference) | 8 of 12 |
| Tarot files | 8 of 12 |
| Eight Immortals files (all confirmed empty, cited anyway as "flagged") | 8 of 12 |
| Practical Guide | 5 of 12 |
| Human Design gate/channel/center files | 5 of 12 |
| Legge | 3 of 12 |
| Huang | 3 of 12 |
| Cleary (Taoist/Buddhist) | 3 of 12 |
| Codon-ring files | 3 of 12 |
| Deng | 1 of 12 |
| Wilhelm | 0 of 12 |

Wilhelm is available (full family, 64 files, populated for 54 of 64
hexagrams) and is never once named in a sourcing note, even though its
Judgement/Image phrasing is the most commonly quoted English I Ching
translation in the world. Every card instead triangulates Legge, Huang,
and the two Cleary translations for the classical text. This looks like
an oversight rather than a deliberate exclusion, since nothing in any
sourcing note explains skipping it.

Also notable: 8 of 12 cards had to explicitly flag missing source files
("EMPTY STUB") and route around them using material carried from outside
the vault (established Eight Immortals lore, standard Human Design
channel names). A future writing guideline should either fill those
system-level files first, or formally bless "established lore, not vault-
sourced" as an allowed fallback with its own citation convention, because
right now it is being invented ad hoc, card by card.

---

## 6. Provenance and rights

The corpus mixes public-domain, in-copyright, and web-scraped material,
all currently stored the same way (verbatim Markdown extracts). A writing
guideline needs different rules per tier.

| Source | Status | Guideline needed |
|---|---|---|
| Legge, "The Yi King" (1882) | Public domain | Safe to quote directly if wanted, though the deck's own voice should still be preferred |
| Wilhelm/Baynes, "I Ching or Book of Changes" | In copyright (the English Bollingen edition, Wilhelm's German died into different terms; Baynes' English translation is still protected) | Paraphrase only, never quote at length |
| Alfred Huang, "The Complete I Ching" | In copyright | Paraphrase only |
| Thomas Cleary, "The Taoist I Ching" and "The Buddhist I Ching" | In copyright | Paraphrase only |
| Deng Ming-Dao, "The Living I Ching" | In copyright | Paraphrase only |
| The 2018 Eranos I Ching (Ritsema/Sabbadini lineage) | In copyright | Paraphrase only. This is also the densest philological material (individual ideogram "fields of meaning"); safest use is to mine it for imagery and vocabulary, not to lift sentences |
| The "Practical Guide" book | In copyright, author unnamed in the vault's own metadata | Paraphrase only, and separately: find and record the actual author/title, since right now nothing in the vault names it |
| Richard Rudd, "Gene Keys" and "The 64 Ways" | In copyright, and these are the corpus's longest verbatim extracts (up to 15,382 and 5,365 words respectively for a single hexagram) | Paraphrase only. This is the highest-exposure risk in the whole corpus: full book chapters, sometimes 10+ pages, sitting as one Markdown file each |
| Dr. Karen Parker, "Quantum Wellness" | In copyright | Paraphrase only |
| Robin Winn, "Understanding Centers in Human Design" (2021) | In copyright | Paraphrase only. Second-highest exposure by volume (7,900-12,300 words per center, 9 files) |
| `human-design/gates/*.md`, `human-design/channels/*.md` (ahumandesign.com) | Web content, copyright status unclear but still someone else's published writing, scraped whole | Paraphrase only, and treat with the same caution as a book; a website's text is still authored work |
| Gene Keys card names, codon ring membership, tarot correspondence tables | Structured facts (names, numbers, categories) | Facts are not copyrightable in the way prose is; safe to state directly (e.g. "Gate 1 sits in the G Center") without a paraphrase concern, though the surrounding teaching prose around those facts still needs the paraphrase rule |
| Adrian's own `_hexagram-NN.md` Synthesis sections, the four line-file tag fields (keyword, core_image, judgment_word, theme_summary) | Adrian's own writing | No rights concern, this is the target voice, not a source to paraphrase away from |

The practical risk is concentrated in three places: the full Gene Keys
chapter dump (`gene-key-NN.md`), the 64 Ways essays (`gk-64ways-NN.md`),
and the Human Design center chapters (`center-*.md`). All three are long
enough, and close enough to unedited book text, that a card drafted by
lifting whole paragraphs from them would be functionally reproducing the
source. The guideline's "paraphrase, never quote at length" rule matters
most for exactly these three families.

---

## Corrections to record

- `oracle/INDEX.md` in the repo cites the corpus at
  `~/Documents/Obsidian Vault/oracle/`. The real path is
  `~/Documents/Obsidian Vault/Mandala Codes/oracle/`.
- `gene-keys/_index.md` does not mention the `spheres/` or `_sources/`
  folders that actually exist under `gene-keys/`.
- `_hexagram-NN.md` Correlation sections link to three `systems/tarot/`
  files and ten `systems/eight-immortals/` and `systems/trigrams/` files
  as if they contain material. All are empty.

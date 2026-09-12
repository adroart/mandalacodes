# Universal Language Oracle — Working Index

> **Start here before writing, researching, publishing, or changing Oracle infrastructure.**
>
> This is the human-and-agent map of the 64-card Universal Language Oracle:
> where the material lives, what is authoritative, how writing should develop,
> and how Mandala Codes and i64 OS connect to it.

Last locally verified infrastructure update: **2026-07-26**

Deployment status: the Markdown single-source runtime and the expanded i64 OS
integration described below are built and tested in local branches. They have
not been deployed to production in this work session.

## The short version

There are four distinct layers:

1. **Research truth** lives in the operational Obsidian vault at
   `~/Documents/Obsidian Vault/Mandala Codes/oracle/`.
2. **Authored card truth** lives in this repository at `oracle/cards/01.md`
   through `oracle/cards/64.md`.
3. **Reader and Oracle transports** live in Mandala Codes: browser, REST,
   search, hosted MCP, and local MCP all derive card prose from those Markdown
   manuscripts.
4. **Working intelligence and coordination** live in i64 OS: recall, Temple,
   Study, capture, pillars, publishing, development, and the emerging
   WordForge production workflow.

The central rule is:

> **Research in the vault. Write each card once in `oracle/cards/`. Generate,
> do not hand-edit, hosted artifacts. Use i64 OS to remember, study, compose,
> and coordinate.**

## Before you write any card prose

**Read [`GUIDELINE.md`](GUIDELINE.md). It is the one writing document
(2026-09-12).** It replaces `CONCEPT.md`'s method sections, the master guide,
guides `01` to `06`, `WRITING_METHOD.md`, `WRITE.md`, the section template, the
deep-pass addendum, the diversify briefs and `todo/plans/reading-rewrite.md`.
Each of those now carries a supersession line; they stay for history and for
the reasoning behind a rule, never as the rule. Where any of them disagrees
with the guideline, the guideline wins.

The survey that produced it, the Fable pass, the source-file map and the
measurement script are at `todo/plans/writing-guideline.md` and the folder
beside it.

Two house rules that apply to every word, restated because they are the ones
most often broken:

- **Never the em dash character in prose.** Comma, period, colon, or a new
  sentence. The em dashes in `oracle/cards/*.md` headings are STRUCTURAL
  DELIMITERS the parser splits on, as in `### The drive — Gate 24`. Removing
  those breaks the deck.
- **No italics, and no underscore emphasis, in anything a reader meets.**

## What is authoritative

| Material | Authoritative location | How to use it |
| --- | --- | --- |
| The 64 current card manuscripts | `oracle/cards/NN.md` | Make every new card-prose edit here. |
| Writing method, voice, structure, sources | `GUIDELINE.md` | The one writing document. Read before drafting or rewriting anything. |
| Deck measurements | `../todo/plans/writing-guideline/measure.mjs` | Re-run after any pass that touches many cards. |
| I Ching, Gene Keys, Human Design, Tarot, body, and moving-line research | `~/Documents/Obsidian Vault/Mandala Codes/oracle/` | Verify claims and preserve source lineage. |
| Personal voice and early Oracle conception | Adrian's identity vault | Sovereign reference material; do not auto-edit. |
| Artwork linkage | `data/mockData.ts` | Linked artwork metadata, not authored Oracle prose. |
| Hosted card/search JSON | `data/oracle-corpus.json`, `data/oracle-search-index.json` | Deterministic deployment artifacts; regenerate, never author. |
| Spoken reflections and live invocations | Mandala Codes composer, D1 metadata/live pointer, private R2 Markdown | A separate versioned personal-transmission layer. |
| Project memory and coordination | i64 OS | Use recall, Temple, Study, capture, pillars, MCP, and WordForge. |

There is one card-prose path. Older aggregate, synthesis, section, generated,
and archive JSON may remain for history or unrelated compatibility, but browser,
REST/search artifacts, hosted MCP, and local MCP do not use them to refill
authored card prose.

## The 64 card manuscripts

```text
oracle/cards/01.md
oracle/cards/02.md
...
oracle/cards/64.md
```

Each manuscript contains six lenses:

1. `CODE` — the shared reading of the code itself.
2. `ICHING` — the hexagram as an archetypal situation and changing field.
3. `KEYS` — the Gene Keys movement through Shadow, Gift, and Siddhi.
4. `DESIGN` — the Human Design gate and its mechanical context.
5. `BODY` — embodied, biological, and codon-ring correspondences.
6. `RELATIONS` — pairs, inverses, partners, rings, and transformations.

Frontmatter records structural facts, source provenance, moving-line
destinations, and the editorial status of every lens.

### Editorial status is not runtime visibility

- All 64 manuscripts exist and contain all six lenses.
- The corpus contains substantial source-grounded prose, but much remains
  intentionally marked `scaffold`.
- `status: scaffold` means the writing still awaits Adrian's personal
  refinement; it does not mean the prose is absent or should be hidden.
- Never promote a lens to `final` merely because it reads smoothly. Final is an
  editorial decision, not an automated quality score.

## How the writing is meant to be made

[`GUIDELINE.md`](GUIDELINE.md), start to finish. Its section 15 gives the order
of passes on a card: the five teaching sections from the sources, then the
centre distilled from them, then the reading from the centre, then keywords,
then the tests and the sheet, then Adrian's pass on the live page. The code
itself is the spine; the traditions are lenses on it; none becomes a
compressed paraphrase of another.

## Research corpus and sovereign voice

Operational-vault front door:

```text
/Users/adrianrasmussen/Documents/Obsidian Vault/Mandala Codes/oracle/_INDEX.md
```

For card `NN`, begin with:

```text
/Users/adrianrasmussen/Documents/Obsidian Vault/Mandala Codes/oracle/hexagrams/NN/_hexagram-NN.md
```

The operational corpus contains all 64 hexagram dossiers, 384 moving-line
notes, translations, Gene Keys material, Human Design gates/channels, Tarot
correspondences, codon rings, body associations, and system references. The
complete source is the vault's `oracle/hexagrams/`, not its smaller root-level
`hexagrams/` predecessor or the older `1 Projects/oracle/wiki/` collection.

The identity vault contains the project's personal origin and voice, not a
second production copy of the cards. Important references include:

```text
~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Adrian-obsidian/
  0 Brand voice/Adrian Rasmussen/Oracle/Oracle deck.md
  0 Brand voice/Adrian Rasmussen/Oracle/Oracle.md
  0 Brand voice/Adrian Rasmussen/Universal Language.md
  0 Brand voice/Adrian Rasmussen/Universal - How to Use.md
  1 Working/Philosophy/About UL.md
  1 Working/Philosophy/Philosophy & Cosmology.md
```

Treat these as sovereign, reference-only material. Quote or interpret them
carefully; never auto-edit them during ordinary card work.

## How one manuscript reaches every card surface

```text
Operational Obsidian corpus
        ↓ research and verification
oracle/cards/NN.md
        ├── shared Markdown parser ──> browser reader
        └── fail-closed 64-card corpus
                ├── local stdio Oracle MCP
                ├── data/oracle-corpus.json ──> REST + hosted MCP card tools
                └── data/oracle-search-index.json ──> browser/REST/hosted search
```

The browser reads raw Markdown through the Vite adapter. The Node corpus loader
validates every numbered manuscript, all required lenses, six moving lines,
card numbering, and structural trigram/binary uniqueness. Missing or malformed
Markdown is an error; it does not authorize a legacy prose fallback.

After a manuscript or artwork-link change, regenerate both hosted artifacts:

```bash
npm run build:oracle-corpus
npm run build:search-index
```

Then verify REST, hosted MCP, and local MCP parity. The tests compare all 64
hosted cards and every complete generated search document to the local
Markdown-derived corpus.

### Invocations remain a separate living layer

```text
Private reflection recording
        ↓ transcription and journal
Invocation composer
        ↓ reviewed immutable version
D1 version metadata/live pointer + private R2 Markdown artifact
        ↓
Live invocation on the card page
```

Do not put a new personal invocation in `oracle/generated/` or merge it into
the static canonical corpus. The separate publication model preserves review,
version history, rollback, and privacy.

## Oracle MCP surfaces

The Mandala Codes hosted endpoint is:

```text
https://mandalacodes.com/api/oracle/mcp
```

Its public tools are `search_oracle`, `get_card`, `get_voice`, `get_line`,
`list_cards`, `find_artworks`, and `cast_hexagram`. The local stdio MCP adds
reading-composition helpers. Tool names and input schemas are stable across the
single-source change.

The endpoint existed before this local branch. Do not assume the deployed site
contains the new Markdown-aligned artifacts until this work is committed and
deployed; verify production separately.

## i64 OS integration

i64 OS repository:

```text
/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/i64os
```

Stable identifiers:

- Project slug: `mandalacodes`
- Temple ID: `mandala-codes`
- Oracle wing: `mc-oracle-cards`
- Card-room seam: `mc-gate-1` through `mc-gate-64`

These identifiers are related but are not interchangeable.

### Built and verified locally

- The Temple seed creates one Oracle wing and 64 stable Gate rooms in numeric
  order without copying card names or prose into i64 OS.
- Gate 23's existing Invocation and I Ching altars, sources, drafts, items, and
  linked Study material are preserved. Other Gate rooms are anchors only until
  their own systems are deliberately developed.
- The `mandalacodes` project configuration registers the hosted Oracle MCP and
  allowlists its seven public read tools.
- An i64 OS core Oracle client and authenticated proxy route forward calls with
  timeout/error handling and safe audit metadata.
- The unified i64 OS MCP exposes the same seven Oracle tools through that core
  route.

This integration is currently local branch work. It has not been deployed or
seeded into the live i64 OS environment during this session.

### WordForge and publication now built locally

- WordForge indexes one production series, 64 articles, and 384 passages with
  deterministic manuscript and section bindings.
- Three-way hashes distinguish clean, file-only, WordForge-only, divergent,
  invalid, and protected-AI-block states without silently choosing a winner.
- The real WordForge Series view loads all 64 cards and their six lenses; the
  earlier illustrative sample has been removed.
- “Propose card update” prepares exactly one selected manuscript in a
  disposable Mandala worktree, validates the complete corpus/build, and
  creates a local branch and commit while leaving the shared checkout intact.
- Preparation stops before push or draft PR and returns an explicit
  human-approval handoff. Final prose remains editorially protected.
- The i64 OS operating map is `i64os/docs/ORACLE_SYSTEM_INDEX.md`.

### Deliberately deferred operational work

- Library-to-Study/altar/recall passage joins and wider altar formulas remain
  separate future work.
- Deployment, production Temple seeding, and live end-to-end MCP verification
  require an explicit operational step after local branches are reviewed.

## Working on a card: human and agent checklist

For card `NN`:

1. Read this index and [`GUIDELINE.md`](GUIDELINE.md).
2. Open `oracle/cards/NN.md`; note every lens's editorial status.
3. Open the operational-vault dossier at
   `oracle/hexagrams/NN/_hexagram-NN.md`.
4. Read the actual sources for the lens; do not rely only on an older synthesis.
5. Follow the guideline: the section chapter, then section 4 (how one energy crosses six sections), then the one-minute test.
6. Distinguish sourced fact, inherited interpretation, and new synthesis.
7. Preserve attribution, YAML provenance, and the distinct purpose of each
   tradition.
8. Edit authored card prose only in `oracle/cards/NN.md`.
9. Do not mark scaffold prose final without editorial approval.
10. Regenerate both hosted JSON artifacts.
11. Run focused parser, corpus, artifact, REST, search, and MCP tests.
12. For visual changes, inspect the real reader on desktop and mobile.
13. Report sources used, prose changed, status decisions, generated outputs,
   and what was verified locally versus in production.

### Invocation workflow

For a new personal invocation:

1. Record or enter the reflection privately.
2. Review the transcription in the journal.
3. Compose and edit the invocation.
4. Publish a version only after review.
5. Let D1 hold version metadata/live state and private R2 hold the Markdown
   artifact.

## Instructions for AI agents

1. Treat this file as the infrastructure front door.
2. Treat `GUIDELINE.md` as the method and `CONCEPT.md` as the intent behind it.
3. Treat `oracle/cards/NN.md` as the only authored card manuscript.
4. Treat the operational vault as research, not a deployment copy.
5. Treat identity-vault material as sovereign and reference-only.
6. Keep each tradition faithful to its own language and purpose.
7. Preserve provenance; never invent citations.
8. Never promote scaffold prose to final without approval.
9. Never edit generated JSON to change a card.
10. Preserve the separate versioned invocation layer.
11. Distinguish `mandalacodes`, `mandala-codes`, `mc-oracle-cards`, and
    `mc-gate-N` when working in i64 OS.
12. Preserve public interfaces and verify browser, REST/search, hosted MCP, and
    local MCP in proportion to the change.
13. State clearly whether a result is local, committed, deployed, and/or
    verified against live services.

Copyable starting instruction:

```text
Begin by reading mandalacodes/oracle/INDEX.md and oracle/GUIDELINE.md.
For card NN, inspect oracle/cards/NN.md and the operational-vault dossier
oracle/hexagrams/NN/_hexagram-NN.md. Follow the guideline, section by section, and run its one-minute test.
Make authored prose changes only in oracle/cards/NN.md. Preserve citations and
editorial status; do not edit sovereign identity-vault material or generated
JSON. Regenerate the hosted artifacts and verify browser, REST/search, hosted
MCP, and local MCP outputs appropriate to the change. Report local and deployed
verification separately.
```

## Legacy and duplicate material

These locations can help with history or research, but they are not current
card-prose authoring or runtime fallback sources:

| Location | Meaning |
| --- | --- |
| `oracle/synthesis/key_N.json` | Older rich synthesis; reference/history only for current card runtime. |
| `oracle/sections/{iching,keys,design,body,relations}/NN.json` | Older per-lens representations; not prose fallbacks. |
| `oracle/oracle_cards_complete.json` | Older aggregate/short-form structure; not the card authority. |
| `oracle/generated/01.json` | Early static invocation pilot; not the living invocation workflow. |
| `oracle/_archive/` | Historical batches and prior manuscripts, including the per-lens `manuscripts-2026-07/` and `editorial-receipts-2026-07/` snapshots from the JSON-to-Markdown migration. |
| Adrian-Website Oracle routes | Compatibility redirects and artwork registry, not a second reader authority. |
| Workspace `_archive/light-codes/` | Separate archived 68-card Light Codes deck. |
| Vault root `hexagrams/` | Incomplete predecessor, not the complete research corpus. |
| Vault `1 Projects/oracle/wiki/` | Structured predecessor material. |
| i64 OS `vault-seed/oracle/i-ching/` | Generated starter notes, not authoritative research. |

Git worktrees and agent copies are working environments, never editorial
authorities.

## Highest-value unfinished joins

1. Review, integrate, deploy, and live-verify the local Mandala Codes and i64 OS
   branches.
2. Seed the 64-room Temple expansion and WordForge production series in the
   intended i64 OS environment after operational approval.
3. Inspect and approve the first one-card draft PR before merging any canonical
   publication.
4. Connect Library passages to Study, altars, recall, and WordForge with
   verbatim attribution intact.
5. Preserve the invocation composer as a separate reviewed personal layer as
   the static corpus evolves.

These are infrastructure tasks, not permission to rewrite the card corpus.

## Where to begin

- **Write or revise a card:** `oracle/cards/NN.md` plus its vault dossier.
- **Research a correspondence:** `~/Documents/Obsidian Vault/Mandala Codes/oracle/`.
- **Refine purpose or voice:** `CONCEPT.md` plus sovereign voice references.
- **Create a spoken invocation:** the private reflection/invocation composer.
- **Regenerate hosted data:** `npm run build:oracle-corpus` and
  `npm run build:search-index`.
- **Use locally through MCP:** `mcp/oracle-server/README.md`.
- **Coordinate in i64 OS:** Temple `mandala-codes`, wing `mc-oracle-cards`, and
  room `mc-gate-N`.
- **Operate WordForge:** read `i64os/docs/ORACLE_SYSTEM_INDEX.md`, sync the real
  series, edit one passage, and prepare one approval-gated card update.
- **Advance the remaining system:** review and deploy the local integration
  branches, then run the production seed and live verification steps.

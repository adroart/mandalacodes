# Oracle Editorial Lifecycle

Date: 2026-08-10
Status: Approved design
Scope: Obsidian research, WordForge production and review, Mandala Markdown publication, and website compilation

## Goal

Create a durable, Markdown-centered system for producing all 64 Universal Language Oracle cards without beginning a new writing pass yet.

The system must make deep research possible, keep source traditions distinguishable, give WordForge a safe automation boundary, preserve human editorial authority, and compile the accepted Markdown into the existing website, REST, search, and MCP surfaces.

The governing principle is:

> Spend depth upstream on evidence, provenance, contradictions, and the human-approved center. Use one disciplined writing pass, one constrained humanization pass, one independent critique cycle, and then human editing.

More research may improve the interpretation. Repeated AI rewriting is not treated as a quality mechanism.

## Non-goals

- Do not begin rewriting the 64 cards as part of the framework work.
- Do not make WordForge or its database the canonical research or prose store.
- Do not let discovered web material flow directly into card prose.
- Do not replace the current public Oracle interfaces unless a later implementation requires a compatible migration.
- Do not automatically declare writing final, publish it, push a branch, open a pull request, merge, or deploy.
- Do not reorganize the entire Obsidian corpus in one destructive migration.

## Authority model

There are three libraries with distinct authority:

1. **Obsidian is research truth.** It owns source records, immutable source versions, evidence atoms, gaps, tensions, and human-ratified research interpretations.
2. **WordForge is the production and review desk.** It coordinates research readiness, synthesis, writing, humanization, critique, editing, synchronization, and proposals. Its database is an active-work index and cache, not the only durable record.
3. **Mandala is publication truth.** It owns the accepted per-lens manuscripts, durable editorial receipts, deterministic generated artifacts, and the website compiler.

No layer may silently promote content into the authority owned by the next layer.

## Current-state conclusions

The existing Mandala publication path is strong: numbered Markdown manuscripts are parsed into a canonical corpus and feed the browser, REST API, search, hosted MCP, and local MCP. Focused tests and a live/local corpus comparison showed all 64 cards in parity.

The upstream system is not ready for automated writing:

- The Obsidian Oracle contains approximately 2,718 Markdown files, including 261 without usable bodies.
- Source provenance is incomplete and inconsistent, with stale paths and mixed source/routing metadata.
- Tarot material is heavily duplicated.
- Several plausible predecessor collections remain visible without a clear authority boundary.
- Research notes, synthesized interpretations, routing metadata, and publication candidates are not separated reliably.
- Most Mandala lens statuses remain scaffolded, and templated sentence frames recur across the deck.
- Internal status can leak into runtime data, and a noncanonical example manuscript is included by an overly broad browser glob.
- WordForge has strong sync, approval, and proposal mechanics, but accepted editorial judgment is not yet fully reconstructable from Markdown.

The architecture therefore preserves the publication compiler and introduces a normalized research-to-editorial seam ahead of it.

## Physical organization

### Obsidian research library

The target organization is:

```text
oracle/
  00-system/
    README.md
    source-schema.md
    evidence-schema.md
    workflow.md
    readiness-report.md

  10-intake/
    web-candidates/
    quarantined/
    imports/

  20-sources/
    iching/
    gene-keys/
    human-design/
    tarot/
    biology/
    relationships/
    shared-systems/

  30-cards/
    23/
      dossier.md
      gaps.md
      source-map.md

  40-work/
    23/
      CODE/
        evidence.md
        assimilation.md
        decisions.md
      ICHING/
      KEYS/
      DESIGN/
      BODY/
      RELATIONS/

  90-archive/
    predecessor-vaults/
    obsolete-syntheses/
    duplicates/
```

Rules:

- `20-sources` stores source records and permitted source material, never reader-facing Oracle prose.
- `30-cards` stores navigation, structural facts, source maps, explicit gaps, and conflict summaries.
- `40-work` stores lens-specific evidence packets and research judgments.
- Automated discovery can create records only under `10-intake`.
- `90-archive` is visibly noncanonical but remains available for historical search.
- Routing metadata is kept separate from bibliographic and evidentiary metadata.
- Migration happens in measured source-family batches with link checking and aliases where required.

### Mandala publication library

The target organization is:

```text
oracle/
  manuscripts/
    23/
      _card.md
      code.md
      iching.md
      keys.md
      design.md
      body.md
      relations.md

  editorial/
    23/
      CODE.md
      ICHING.md
      KEYS.md
      DESIGN.md
      BODY.md
      RELATIONS.md
      CARD.md
```

The six lens files are the only editable publication manuscripts. Moving lines remain inside `iching.md` unless later evidence demonstrates that line-level files materially improve editing.

`_card.md` contains shared structural data and normalized identifiers. Lens manuscripts contain reader prose and minimal internal frontmatter. The compiler strips all internal editorial fields from public output.

Editorial sidecars preserve the accepted human center, source-bundle hash, constitution hash, candidate hash, model and plugin identities, critique results, sameness findings, finality decision, and proposal result. They may include an immutable snapshot of the accepted Obsidian interpretation, but they are never an editable second copy and can never refill manuscript prose.

## Knowledge stack

There are four meaningful content layers:

1. **Source version:** the original item identity, retrieval or edition information, rights basis, locator, and immutable digest.
2. **Evidence atom:** one fact, source interpretation, tension, or unresolved question linked to one or more source versions.
3. **Human-ratified center:** a compact interpretive brief accepted before prose generation.
4. **Candidate manuscript:** prose generated from the approved center and evidence map.

No layer cites an AI summary as if it were a source. Important claims must remain traceable to source versions. A source change marks dependent evidence and interpretations for reverification rather than silently updating them.

The six lenses retain distinct source roles:

- ICHING, KEYS, DESIGN, and BODY preserve their own evidence traditions.
- RELATIONS expresses outward structural relationships.
- CODE synthesizes the center across approved lens interpretations.
- Cross-tradition combination occurs at the approved interpretation layer, not by blending raw sources into undifferentiated context.

## Research depth versus writing depth

Research is allowed to become deeper when the material warrants it. Writing is deliberately bounded.

### Research may expand through

- additional primary or authoritative sources;
- edition and translation comparison;
- contradiction and uncertainty analysis;
- source-rights and provenance verification;
- missing-evidence discovery;
- stronger locators and claim-to-source mapping; and
- human revision of the interpretive center.

### Writing remains bounded to

- one compare-first writer pass from the approved center;
- one constrained humanizer pass;
- deterministic fact and structure verification;
- one independent critic and sameness pass;
- no automatic rewrite loop; one bounded revision suggestion only when the human editor requests it; and
- human editing and exact final approval.

After a human edit, automated checks report findings. They do not rewrite or re-humanize the text unless the editor explicitly requests a suggestion.

## Adaptive operating lanes

WordForge derives the lane from evidence and workflow state rather than asking the editor to understand the state machine.

### Standard lane

The standard lane is required for the foundational edition of every card:

1. Prepare evidence and the proposed center automatically.
2. Human reviews and approves the center.
3. Run writer, humanizer, verification, critic, and sameness analysis automatically.
4. Human edits and approves the exact manuscript.
5. Human separately authorizes a Mandala proposal.

The six proposed lens centers for one card may be reviewed together, with conflicts and uncertainty expanded in place. This reduces interaction cost without removing human judgment.

### Deep lane

The deep lane is entered when readiness checks find missing sources, provenance or rights uncertainty, conflicting interpretations, weak evidence, or serious cross-card similarity. The added time is spent on research and the center. It does not authorize unlimited rewriting.

### Fast lane

The fast lane is earned only by mature material. It may skip re-approval of the center when all of the following remain true:

- required evidence is present and current;
- the center was previously approved by a named human;
- source, evidence, constitution, and center hashes are unchanged;
- no conflicts, rights concerns, or blocking findings remain; and
- the manuscript still receives the complete writing, humanizer, verification, critic, sameness, human-edit, and final-approval sequence.

The fast lane is intended mainly for later maintenance. It is not the default for creating the foundational edition.

## WordForge editorial desk

WordForge should expose one resumable work item for a card or lens. The normal interface shows a server-derived primary action such as:

- Prepare this lens.
- Review the evidence center.
- Generate the candidate.
- Check my edit.
- Approve final.
- Propose to Mandala.

The editor does not coordinate source paths, hashes, database transition names, model routing, worktrees, generated artifacts, or build commands.

Internally, the desk performs:

1. Resolve canonical identity and reconcile the selected card.
2. Verify digest-bound source context.
3. Build evidence atoms and explicit gaps.
4. Synthesize the proposed center without writing card prose.
5. Stop at the center-approval gate when required.
6. Generate or compare-first revise the candidate.
7. Apply the humanizer to the candidate only.
8. Run mechanical, factual, and provenance checks.
9. Run an independent critic.
10. Run whole-card and deck-wide sameness checks.
11. Return exact findings and permit one bounded revision suggestion only when the human editor requests it; never enter an automatic rewrite loop.
12. Preserve the human edit without automatic replacement.
13. Require explicit finality approval.
14. Prepare one isolated, local Mandala proposal only after separate authorization.

Every action is revision-bound. Stale actions fail safely and preserve the last known-good candidate and human text.

## Humanizer boundary

The humanizer is a replaceable plugin adapter, not a synonym for another writer prompt.

It receives the candidate, lens, constitution, approved claim identifiers, protected spans and terms, and exact input digest. It returns text patches, warnings, plugin identity and version, and output digest.

Invariants:

- It operates on a candidate, never canonical Markdown.
- It cannot edit frontmatter, headings, quotations, numbers, proper nouns, source identity, or protected structural terms.
- It cannot add factual claims.
- It cannot promote editorial status.
- Invalid or stale output is discarded as a unit.
- Failure preserves the pre-humanized candidate.
- Finality requires a passed humanizer result or an explicit human bypass with a reason.
- It does not run automatically after a human edit.

The writer, humanizer, and critic have distinct roles. The critic must resolve to a different provider/model family from the writer. Configuration fails closed if the required independence is unavailable.

## Humanization and sameness quality

Humanization is not measured by a generic detector score. It is evaluated through observable editorial properties:

- sentence-shape variation;
- specificity to the card and lens;
- restrained metaphor reuse;
- absence of stock openings and repeated teaching frames;
- preservation of factual and structural meaning;
- appropriate uncertainty rather than false certainty; and
- natural rhythm under human review.

Whole-card analysis finds repeated teachings across lenses, tradition leakage, repeated images, and lenses behaving as compressions of one another.

Deck analysis finds fixed sentence frames, near-duplicate openings, reused metaphors, suspicious n-gram reuse, and semantic similarity against the corresponding lens and the full 64-card corpus. It returns exact spans and nearest matching cards. Hard duplicates block; legitimate thematic kinship warns.

Cheap deterministic checks run immediately. Expensive deck analysis is cached by candidate and corpus digests and must be current before final approval.

## Web discovery and ingestion

Web discovery starts only from a named evidence gap. Search results, catalogues, and sitemaps are leads, not evidence.

The ingestion system is fail-closed and requires two independent permissions:

1. The crawler is allowed to fetch the resource.
2. The project is allowed to persist and use the content in the proposed way.

Every discovered record begins with:

```yaml
research_only: true
publishable: false
editorial_state: evidence
```

The discovery identity can write only to the intake zone and has no capability to write Mandala manuscripts. WordForge can prepare evidence packets and protected proposals but cannot promote them to canonical prose.

Required provenance includes stable source/version identity, authorship and publisher, requested/final/canonical URLs, edition or date, retrieval time, rights basis, robots and terms decisions, immutable digests, extraction tool and normalization version, evidence locators, claim class, AI activity identity, and human disposition.

Paywalls, authentication, CAPTCHA or access-control circumvention, robots prohibitions, incompatible terms, and unresolved rights risk stop the automated process. Unknown/default copyright permits only metadata and the minimum human-reviewed research excerpt by default. No discovered source flows directly to prose.

The detailed policy and primary-source citations live in `docs/research/2026-08-10-oracle-web-ingestion-provenance.md`.

## Status model

The system preserves independent dimensions and derives a simple phase and next action for the interface:

- `sources`: unknown, discovering, incomplete, ready, conflicted, stale, unavailable, invalid
- `judgment`: absent, synthesizing, awaiting-human, approved, stale
- `draft`: absent, writing, generated, humanized, human-edited
- `humanizer`: unrun, running, passed, failed, unavailable, bypassed, stale
- `critique`: unrun, running, pass, fail, unverified, stale
- `card_sameness`: unrun, pass, warn, block, stale
- `deck_sameness`: unrun, pass, warn, block, stale
- `editorial`: scaffold, in-progress, final
- `sync`: clean, wordforge-newer, file-newer, conflict, invalid
- `proposal`: unavailable, ready, preparing, prepared, stale

Clean synchronization never implies research readiness, prose quality, finality, or publication approval.

Changes invalidate only dependent dimensions. For example, a human punctuation edit need not invalidate source readiness, but it does invalidate candidate-bound critique and sameness results.

## Publication compiler

A single pure compiler reads the per-lens manuscripts and emits the current canonical card contract. Browser, REST, search, hosted MCP, and local MCP use adapters around that same compiler or its deterministic artifact.

The compiler:

- accepts only the expected 64 numbered manuscript directories and six lens files;
- validates known frontmatter and section shapes;
- uses a real YAML parser or a deliberately constrained syntax that rejects unsupported forms;
- strips internal status, sourcing, and editorial fields from reader output;
- normalizes system identifiers such as the 22 codon rings;
- treats unknown or duplicate structural fields as errors;
- displays actionable authoring failures instead of silently rendering blanks;
- produces deterministic corpus and search artifacts; and
- preserves existing public card, website, REST, search, and MCP behavior.

Development and production must not mix live Markdown prose with stale generated structural data. One compiled card representation serves both.

## Human gates

There are three distinct human decisions:

1. **Center approval:** accepts the evidence-backed interpretation that may be used for writing.
2. **Finality approval:** accepts the exact human-edited manuscript revision.
3. **Mandala proposal authorization:** permits preparation of an isolated local repository proposal.

The first gate may be skipped only by the earned fast lane. The second and third are never automated.

## Pilot

The system is proved with a bounded pilot before any deck-wide writing program.

### Pilot 1: Card 23, CODE

Prove source readiness, ratified center, one writer pass, humanizer patches, independent critique, sameness checks, human edit, finality, durable sidecar, resume behavior, and isolated local proposal.

### Pilot 2: Card 52, BODY and CODE

Prove explicit gap detection, targeted discovery, provenance and rights gates, conflict handling, body-led interpretation, cross-lens synthesis, and failure recovery.

Card 3 remains a read-only quality baseline. Card 24 becomes a later inverse/pair similarity test once the core pipeline works.

Pilot acceptance criteria:

- No manual source-path selection is required for a normal lens.
- One preparation action reaches the first human gate.
- One approval runs the complete automated writing and checking sequence.
- Reopening resumes the exact work item.
- Every accepted judgment is reconstructable from Markdown and immutable hashes.
- No canonical manuscript changes before proposal authorization.
- A proposal changes only the selected card, permitted sidecars, and deterministic artifacts.
- All 64 cards and every public consumer still validate.
- No push, pull request, merge, or deployment occurs.

## Preflight repairs

Before enabling content production:

1. Restrict the current browser manuscript glob to canonical numbered files and archive noncanonical examples.
2. Remove internal editorial status from public output and validate every status transition.
3. Convert visible source flags and conflict annotations into structured editorial findings.
4. Establish one typed provenance and evidence schema with parser support.
5. Normalize shared identifiers, including codon-ring identity.
6. Replace contradictory Oracle authority documents with one short constitution and per-lens rubrics; archive superseded instructions.
7. Add a readiness report that distinguishes missing bodies, duplicates, stale paths, incomplete provenance, and unresolved conflicts.

These repairs prevent the new workflow from automating existing ambiguity.

## Migration shape

The migration is staged:

1. Protect the existing runtime and clarify authority.
2. Introduce schemas, readiness reports, and intake permissions.
3. Create per-lens manuscript and editorial-sidecar support behind the canonical compiler.
4. Build the resumable WordForge editorial desk.
5. Add humanizer, critic separation, and sameness analysis.
6. Run the two-card pilot.
7. Migrate source families and manuscript cards in audited batches.
8. Scale the editorial program only after the pilot is reconstructable and the rendered website is manually reviewed.

The implementation plan will decompose these stages into independently verifiable changes. No stage authorizes Oracle prose generation until the framework and pilot readiness checks are approved.

## Risks and mitigations

- **Overprocessing flattens the voice.** Do not run automatic rewrite loops; spend additional effort on evidence and the center.
- **Humanizer introduces factual drift.** Use patch-only output, protected spans, claim prohibition, and post-humanizer verification.
- **Database history becomes unrecoverable.** Persist accepted judgments and hashes in Markdown sidecars; treat the database as an index/cache.
- **File splitting creates editing friction.** Split by lens, not every subsection; keep moving lines together initially.
- **Vault migration breaks links.** Move by source family with inventories, link checks, aliases, and an explicit archive.
- **Fast routing hides weak foundations.** Require immutable fast-lane eligibility and automatically fall back to standard or deep work.
- **Deck analysis adds cost and delay.** Run cheap checks first and cache full analysis by manuscript and corpus digests.
- **Source permission is mistaken for publication permission.** Preserve research-only capability boundaries and require exact human prose approval.
- **WordForge becomes a second canon.** Keep research truth in Obsidian, publication truth in Mandala, and expose WordForge as a desk rather than an authority.

## Design decisions

- Foundational production uses the standard lane; mature unchanged material may earn the fast lane.
- Deeper effort expands research, not the number of writing passes.
- Critique reports before it rewrites; any bounded AI revision requires an explicit human request.
- Humanization is one constrained, replaceable transformation followed by independent verification.
- Per-lens Markdown is the long-term publication source shape.
- Human editorial decisions must survive outside WordForge's database.
- The existing public Oracle compiler contract is preserved behind a new canonical manuscript compiler.
- Web discovery is gap-driven, provenance-bound, research-only, and incapable of writing publication files.

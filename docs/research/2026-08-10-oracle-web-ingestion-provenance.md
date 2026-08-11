# Oracle web discovery, ingestion, and provenance policy

Date: 2026-08-10
Status: research recommendation; not legal advice
Scope: automated discovery and research ingestion for the Universal Language Oracle

## Recommendation

Adopt a **fail-closed, two-permission pipeline**:

1. A source must be allowed to be **fetched by this crawler**.
2. Its content must separately be allowed to be **persisted and used in the proposed way**.

Passing `robots.txt` answers only the first question. RFC 9309 says robots rules are requests to crawlers and explicitly says they are not access authorization; the RFC also warns that robots is not a content-security mechanism ([RFC 9309, §§1 and 3](https://www.rfc-editor.org/rfc/rfc9309.html)). A public page with no `Disallow` therefore does not imply a licence to copy, adapt, train on, or publish it.

The safest operational rule for this project is:

> Automatic discovery may create a candidate record. Automatic ingestion may create only a non-publishable research record under an evidenced rights basis. No discovered source, extracted passage, summary, or AI output may write to or become publishable prose in `oracle/cards/` without an explicit human editorial decision.

Enforce that rule with capabilities, not only prompts:

- The discovery/ingestion identity can write only below `/Users/adrianrasmussen/Documents/Obsidian Vault/oracle/_web_sources/` and cannot write to `/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/mandalacodes/oracle/cards/`.
- Every vault record is born with `research_only: true`, `publishable: false`, and `editorial_state: evidence`.
- WordForge may read approved evidence and prepare a claim/source packet or a protected proposal. It must preserve the existing protected-AI/human-approval boundary and cannot promote a proposal to canonical prose.
- Only a named human editor may approve a change to `oracle/cards/NN.md`; approval identifies the evidence records used and the exact reviewed revision. Smooth prose or a passing automated quality score is never publication approval.

This mirrors the Oracle's existing authority boundary: raw research in the Obsidian vault, evidence preparation in WordForge, and authored truth only in `oracle/cards/`.

## Decision policy

### 1. Discovery

Discovery may use only:

- human-approved seed URLs and domains;
- links from already approved source pages;
- publisher-provided feeds and sitemaps; and
- search or catalogue results as **leads**, never as evidence.

Prefer the originating publisher, standards body, author, institution, or official repository over mirrors and aggregators. A sitemap is a discovery hint, not permission to fetch or reuse; the Sitemap protocol describes URL enumeration and optional modification metadata, while RFC 9309 treats `Sitemap` as an optional non-robots record ([Sitemaps protocol](https://www.sitemaps.org/protocol.html); [RFC 9309, §2.2.4](https://www.rfc-editor.org/rfc/rfc9309.html#section-2.2.4)).

Discovery stores the candidate URL and how it was found but does not store the page body until preflight passes.

### 2. Fetch preflight and robots

Use a stable, truthful user-agent token with a public contact/policy URL. Rate-limit per authority, avoid concurrency bursts, honor `Retry-After`, use conditional requests, and never evade blocking by changing identities or IP addresses.

For each scheme/host/port authority:

1. Fetch `/robots.txt` before any content request.
2. Follow the RFC 9309 matching rules for this crawler's product token. A successfully fetched file must be followed; parseable rules remain effective even if other lines are malformed ([RFC 9309, §§2.2–2.3](https://www.rfc-editor.org/rfc/rfc9309.html#section-2)).
3. Cache the robots decision for no more than 24 hours unless the file is unreachable, matching RFC 9309's cache guidance ([RFC 9309, §2.4](https://www.rfc-editor.org/rfc/rfc9309.html#section-2.4)). Re-check before every scheduled crawl whose last decision is older than that.
4. Treat a network error or 5xx response as complete disallow. RFC 9309 requires that result for an unreachable robots file ([RFC 9309, §2.3.1.4](https://www.rfc-editor.org/rfc/rfc9309.html#section-2.3.1.4)).
5. RFC 9309 permits crawling when `/robots.txt` returns an unavailable 4xx response. This policy is stricter: record `robots_state: unavailable`; permit only public, unauthenticated pages that also pass the terms/licence gate, and send the candidate to manual review if persistence beyond metadata is proposed ([RFC 9309, §2.3.1.3](https://www.rfc-editor.org/rfc/rfc9309.html#section-2.3.1.3)).
6. Do not request a disallowed URL even if a search result, sitemap, cached copy, or canonical link reveals it.

Never automate login, paywall bypass, CAPTCHA defeat, token replay, or circumvention of access controls. In the United States, 17 U.S.C. §1201 separately regulates circumvention; the Copyright Office summarizes that rule and its limited exemption process ([U.S. Copyright Office §1201 study](https://www.copyright.gov/policy/1201/)).

### 3. Terms and rights gate

Record and evaluate the most specific rights statement that applies to the item. Check, in order: item-level licence, page-level licence, collection/feed licence, site terms, and copyright notice. Machine-readable claims are evidence, not unquestionable fact; retain the page/selector from which each claim came.

Copyright can exist automatically when original expression is fixed, so the absence of a notice is not an “open” signal ([U.S. Copyright Office, Copyright in General](https://www.copyright.gov/help/faq/faq-general.html)). Creative Commons licences grant standardized permissions but impose licence-specific conditions; all six main CC licences require attribution, while NC, ND, and SA add restrictions that must be evaluated for the intended use ([Creative Commons licence summary](https://creativecommons.org/share-your-work/cclicenses/)).

Use these lanes:

| Lane | Evidence | Automatic persistence | Publication consequence |
| --- | --- | --- | --- |
| Open | Verifiable public-domain mark, CC0, or licence permitting the intended copying/adaptation | Full response snapshot and extracted text, subject to licence conditions | Still evidence only; attribution and any SA/other conditions remain attached |
| Permission | Written permission or first-party terms expressly covering the intended automated research storage/use | Only the scope and duration granted | Still requires human editorial approval and citation |
| Unknown/default copyright | No reliable licence or permission; public unauthenticated access only | Metadata, hashes, bibliographic facts, and the minimum excerpt necessary for research; no durable full-page body by default | Any quotation or close paraphrase requires item-level review |
| Restricted | Robots disallow, terms prohibit automation, authentication/paywall, technical access control, unclear leaked/private material, or rights objection | URL-level rejection/audit record only | Not eligible until the restriction is resolved by a human |

For CC BY-ND, CC BY-NC, and ShareAlike material, require manual review before any adapted or commercially published use. Preserve title, author, source and licence (TASL) data. Creative Commons' guidance emphasizes that reusers must follow the actual licence conditions and mark/attribute shared material ([Creative Commons reuse guidance](https://creativecommons.org/reusing-cc-licensed-content/)).

Do not turn “fair use likely” into an automated permission flag. In U.S. law, fair use is a case-specific balancing of purpose/character, nature of the work, amount/substantiality, and market effect; there is no safe word count or percentage ([U.S. Copyright Office fair-use guidance](https://www.copyright.gov/fair-use/more-info.html); [17 U.S.C. §107](https://www.copyright.gov/title17/92chap1.html#107)). Use those factors only as risk signals:

- lower-risk signals: factual or officially published material; a genuinely analytical, teaching, or research purpose; a short, necessary excerpt; no substitute for the source; prominent citation; access-controlled research storage;
- higher-risk signals: creative or unpublished expression; the “heart” of a work; substantial or systematic copying; a use that substitutes for the source or its licence market; commercial publication; unclear ownership; or repeated extraction that reconstructs the work.

Any high-risk signal, conflict between licence and intended use, non-U.S. publication question, or request to retain a complete unlicensed work requires human/legal review. This note is a conservative engineering policy, not a legal opinion.

### 4. Retrieval, fixity, and snapshots

Fetch only with `GET`/`HEAD`, bounded redirects, byte/time limits, accepted media-type limits, and SSRF protections. Store the originally requested URL, every redirect, final URL, request headers that affect representation, status, response headers, and UTC retrieval time. Preserve the publisher-declared canonical URL separately rather than replacing the requested/final URL; `rel="canonical"` identifies the author's preferred duplicate or superset, not necessarily what was actually fetched ([RFC 6596](https://www.rfc-editor.org/rfc/rfc6596.html)).

When durable storage is authorized:

- preserve the exact response bytes as an immutable version, preferably as WARC 1.1 plus a readable extraction;
- never overwrite a prior version; link the new entity as a revision/specialization;
- compute SHA-256 over the exact stored bytes and separately over the normalized extracted text;
- record the algorithm, encoding, byte length, extraction tool/version, and normalization recipe;
- validate a server-provided `Content-Digest` or `Repr-Digest` when present, but retain the local digest regardless.

The Library of Congress describes WARC as an archival container that carries harvested resources with request/response and record metadata and lists it as the preferred web-archive format ([Library of Congress WARC format description](https://www.loc.gov/preservation/digital/formats/fdd/fdd000236.shtml)). SHA-256 is specified by NIST's Secure Hash Standard ([FIPS 180-4](https://csrc.nist.gov/pubs/fips/180-4/upd1/final)). RFC 9530 defines HTTP `Content-Digest` and `Repr-Digest`, but warns that digest fields protect content/representation integrity, not all metadata and not general authenticity without another mechanism such as signatures ([RFC 9530](https://www.rfc-editor.org/rfc/rfc9530.html)). Therefore a matching hash proves “these bytes are unchanged from the recorded version,” not “the claim is true” or “the publisher is trustworthy.”

Use `ETag` and `Last-Modified` for conditional retrieval where available; they are HTTP validators, not local preservation hashes ([RFC 9110, §§8.8 and 13](https://www.rfc-editor.org/rfc/rfc9110.html)).

For the unknown/default-copyright lane, discard the full response body after extracting the approved minimal record unless a human records a time-bounded fair-use/permission rationale. A durable metadata record and hash may remain. If a publisher or archive exposes a stable prior-state URI, record it as a temporal locator; Memento defines `Memento-Datetime`, original-resource links, and time maps for prior web states ([RFC 7089](https://www.rfc-editor.org/rfc/rfc7089.html)). An external archive URL does not expand reuse rights.

### 5. Evidence and citations

Every factual claim sent to WordForge must reference at least one immutable source-version ID, not merely a live URL. Prefer a persistent identifier such as DOI/ISBN/official document number when available, while retaining the resolved URL and retrieval version.

A citation/evidence object must contain:

- source-version ID, author/organization, title, publisher/site, publication/update date when evidenced, canonical URL, retrieval UTC time, and snapshot/hash;
- the claim it supports and whether the note is `fact`, `source_interpretation`, or `new_synthesis`;
- a locator: heading/page/paragraph plus a text selector;
- exact excerpt only when rights policy permits, clearly marked as quotation; and
- citation author and creation time.

Use W3C Web Annotation selectors as the interoperable shape. `TextQuoteSelector` records exact text with prefix/suffix context, while `TextPositionSelector` records offsets and avoids copying the target text; the Recommendation specifically notes the copyright risk of quote selectors and suggests position selectors for restricted static texts ([Web Annotation Data Model, §§4.2.4–4.2.5](https://www.w3.org/TR/annotation-model/#text-quote-selector)). Pair brittle locators with the immutable snapshot/hash. A `TimeState` can record the source date and cached version ([Web Annotation Data Model, §4.3.1](https://www.w3.org/TR/annotation-model/#time-state)).

Do not cite search-result snippets, AI summaries, or a mirror when the originating source is available. AI may propose candidate claims and locators; it may not manufacture quotations, fill missing bibliographic facts, or declare a source verified without a matching stored version.

### 6. Provenance through WordForge and editorial review

Represent the lineage as a small PROV-compatible graph even if the implementation is YAML/JSON rather than RDF:

- **Entities:** discovered URL, fetched representation, snapshot, extraction, evidence passage, AI draft, reviewed proposal, and canonical card revision.
- **Activities:** discover, fetch, verify, extract, annotate, summarize, draft, human review, edit, and publish.
- **Agents:** publisher/author, crawler, extraction software, AI model/provider, WordForge, and named human editor.
- **Relations:** `prov:used`, `prov:wasGeneratedBy`, `prov:wasDerivedFrom`, `prov:wasQuotedFrom`, `prov:wasAttributedTo`, and `prov:wasAssociatedWith`.

PROV-O defines Entity, Activity and Agent as its starting point and includes specific relations for derivation, quotation, attribution and activity responsibility ([W3C PROV-O](https://www.w3.org/TR/prov-o/)). This allows the system to distinguish “publisher authored this page,” “crawler fetched this version,” “model generated this proposal from these evidence entities,” and “editor approved this exact revision.”

For each AI-assisted activity, record provider, model identifier/version if exposed, tool version, UTC time, run/request ID if available, prompt-template hash, input evidence IDs and hashes, output hash, declared operation, and human disposition. Do not store secrets, hidden reasoning, or unnecessary personal data. A model name alone is insufficient provenance.

C2PA Content Credentials are a useful **optional export and asset-ingest layer**, not the Oracle's primary editorial ledger. The current C2PA 2.4 specification defines signed manifests, content bindings, assertions, validation, AI disclosure, and bindings for documents, HTML, structured text, and unstructured text ([C2PA 2.4 technical specification](https://spec.c2pa.org/specifications/specifications/2.4/specs/C2PA_Specification.html)). If an ingested image/document has a credential, preserve the original file, manifest, validation result, signer identity/trust result, and validation time. Treat “credential absent” as unknown and a valid credential as a tamper-evident signer assertion, not proof that the content is true; C2PA itself says it should validate association/form/tamper evidence rather than make “good” or “bad” value judgments. Consider adding a project-signed credential to exported artwork/PDF/HTML later, after the internal human approval chain is reliable.

## Required metadata contract

All fields below are required unless marked conditional. Unknown values must be explicit (`unknown` plus reason), never silently omitted or inferred.

| Group | Required fields |
| --- | --- |
| Record identity | `source_id` (stable UUID/URI), `source_version_id`, `record_schema_version`, `research_only: true`, `publishable: false`, `editorial_state`, `created_at`, `updated_at` |
| Discovery | `discovered_url`, `discovered_at`, `discovery_method`, `discovered_from` (seed/source/query ID), `candidate_topic_or_card`, `source_tier`, `source_tier_rationale` |
| Resource identity | `requested_url`, `final_url`, `redirect_chain`, `declared_canonical_url` (or `none`), `canonical_evidence`, `persistent_ids` (DOI/ISBN/document number if present), `title`, `authors_or_org`, `publisher_or_site`, `language`, `published_at`, `modified_at`; every unknown carries an evidence/reason code |
| Robots | `robots_url`, `robots_fetched_at`, `robots_http_status`, `robots_sha256` when received, `crawler_product_token`, `matched_group`, `matched_rule`, `robots_decision` (`allow`/`disallow`/`unavailable`/`unreachable`), `decision_expires_at` |
| Request/response | `fetch_activity_id`, `fetch_started_at`, `fetch_completed_at`, `fetch_agent_version`, representation-affecting request headers, `http_status`, `content_type`, `content_language`, `content_encoding`, `content_length`, `date`, `etag`, `last_modified`, `content_digest`, `repr_digest`, `retry_after`; absent headers are recorded as `none` |
| Rights | `rights_lane`, `copyright_holder_or_unknown`, `copyright_notice_or_none`, `license_uri_or_none`, `license_version`, `license_scope`, `license_evidence_url`, `license_evidence_selector`, `terms_url_or_none`, `terms_version_fetched_at`, `terms_sha256`, `permitted_actions`, `prohibited_actions`, `rights_basis`, `rights_review_state`, `reviewer`, `reviewed_at`, `retention_rule`, `deletion_or_review_due_at` |
| Fair-use risk screen | `jurisdiction`, four separate factor notes, `amount_and_substantiality`, `market_substitution_risk`, `creative_or_unpublished`, `commercial_context`, `risk_flags`, `screen_result` (`not_relied_on`/`manual_review`/`approved_exception`), `reviewer_and_date`; required whenever licence/permission is not the rights basis |
| Snapshot/fixity | `snapshot_mode` (`none`/`metadata_only`/`minimal_excerpt`/`full_authorized`/`approved_exception`), `snapshot_path_or_uri`, `snapshot_format`, `snapshot_created_at`, `raw_sha256`, `raw_byte_length`, `extracted_text_sha256`, `normalization_profile`, `extractor_name_version`, `server_digest_validation`; values are conditional on the chosen mode |
| Evidence/citation | `evidence_id`, `source_version_id`, `claim_id`, `claim_class` (`fact`/`source_interpretation`/`new_synthesis`), `locator_type`, `locator`, `selector_exact_prefix_suffix` or `selector_start_end`, `quoted_text` only when permitted, `quote_length`, `citation_created_by`, `citation_created_at` |
| Provenance | `entity_type`, `generated_by_activity`, `used_entity_ids`, `derived_from_ids`, `quoted_from_id` when applicable, `attributed_to_agent`, `associated_agents_and_roles`, `activity_started_at`, `activity_ended_at`, `tool_versions` |
| AI assistance | `ai_used`, and when true: `provider`, `model_id`, `model_version_or_unknown`, `run_id_or_unknown`, `prompt_template_sha256`, `input_evidence_ids_and_hashes`, `operation`, `output_sha256`, `generated_at`, `human_disposition`, `human_reviewer`, `reviewed_at` |
| Editorial handoff | `wordforge_packet_id`, `target_card_and_lens`, `evidence_matrix_hash`, `proposal_revision_hash`, `protected_ai_block`, `editorial_decision` (`pending`/`reject`/`revise`/`approve`), `editor`, `decision_at`, `canonical_commit` only after approval |
| Content Credentials (conditional) | `c2pa_present`, and when present: original asset hash, manifest/claim ID, manifest hash/location, signer, trust-list/result, assertions/actions, AI disclosure, ingredient references, validation tool/version/time/status |

## Minimum automated gates

A run must stop before body retrieval when any of these is true:

- robots decision is `disallow`, `unreachable`, expired without successful refresh, or cannot be evaluated safely;
- the URL requires authentication, a paywall, CAPTCHA, session theft, or access-control circumvention;
- applicable terms prohibit the crawler or intended storage/use;
- the target resolves to a private/local network, disallowed media type, or exceeds configured limits; or
- a takedown/rights objection is active.

A run must stop before durable persistence when:

- rights lane is `restricted`;
- rights lane is `unknown/default copyright` and the proposed snapshot exceeds metadata/minimum excerpt;
- licence evidence is missing, conflicting, item-inapplicable, or incompatible with the intended use; or
- a high-risk fair-use signal is present without named human approval.

A run must stop before WordForge drafting when evidence lacks a source-version hash and usable locator. It must stop before canonical prose under all circumstances until a named human editor explicitly approves the exact proposal revision.

## Audit and remediation

- Keep an append-only event log for decisions and transformations. Corrections create new versions; they do not rewrite old evidence silently.
- Revalidate licence/terms and live availability when evidence is reused for a new publication, because the intended use may differ from the original research use.
- Support source-owner contact, takedown, suppression from future discovery, deletion where required, and preservation of a minimal tombstone/audit record when lawful.
- Periodically verify stored hashes and record the verification activity/result. A mismatch quarantines the entity and every downstream proposal derived from it.
- If a source changes materially, keep the old authorized snapshot immutable, ingest a new version, and mark dependent claims `needs_reverification`; never silently update the evidence behind approved prose.

## Primary sources consulted (exact URLs)

- IETF, Robots Exclusion Protocol, RFC 9309: https://www.rfc-editor.org/rfc/rfc9309.html
- Sitemaps protocol: https://www.sitemaps.org/protocol.html
- IETF, The Canonical Link Relation, RFC 6596: https://www.rfc-editor.org/rfc/rfc6596.html
- IETF, HTTP Semantics, RFC 9110: https://www.rfc-editor.org/rfc/rfc9110.html
- IETF, Digest Fields, RFC 9530: https://www.rfc-editor.org/rfc/rfc9530.html
- NIST, Secure Hash Standard, FIPS 180-4: https://csrc.nist.gov/pubs/fips/180-4/upd1/final
- Library of Congress, WARC format description: https://www.loc.gov/preservation/digital/formats/fdd/fdd000236.shtml
- IETF, Memento, RFC 7089: https://www.rfc-editor.org/rfc/rfc7089.html
- W3C, PROV-O: https://www.w3.org/TR/prov-o/
- W3C, Web Annotation Data Model: https://www.w3.org/TR/annotation-model/
- U.S. Copyright Office, Copyright in General: https://www.copyright.gov/help/faq/faq-general.html
- U.S. Copyright Office, More Information on Fair Use: https://www.copyright.gov/fair-use/more-info.html
- U.S. Copyright Office, Title 17 Chapter 1 including §107: https://www.copyright.gov/title17/92chap1.html#107
- U.S. Copyright Office, Section 1201 Study: https://www.copyright.gov/policy/1201/
- Creative Commons, About CC Licenses: https://creativecommons.org/share-your-work/cclicenses/
- Creative Commons, Reusing CC-Licensed Content: https://creativecommons.org/reusing-cc-licensed-content/
- C2PA, Content Credentials Technical Specification 2.4: https://spec.c2pa.org/specifications/specifications/2.4/specs/C2PA_Specification.html

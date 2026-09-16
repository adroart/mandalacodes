# Codex review of the writing guideline and the 64-card process (2026-09-12)

Independent adversarial review by Codex (GPT), run against oracle/GUIDELINE.md, oracle/cards/03.md and the four process plans. Saved verbatim; the reflection on it is in the session and in the guideline changes that followed.

The guideline is not yet a production specification. It is a valuable record of editorial discoveries, but it contains incompatible instructions, obsolete measurements and requirements the current manuscript format cannot satisfy. A strong writer could produce a persuasive card 14 by choosing which rules to ignore. They could not produce an unambiguously compliant one without making editorial decisions the guideline presents as settled.

Card 3 is evidence that the author-on-page process works. It is not evidence that all the resulting rules work together.

Question 1. Can a writer apply the guideline without asking a question?

Sections 1, 2, 4, 5 and 14 give the essence three different locations and two different meanings. Section 2 puts three sentences in `meta.centre`. Sections 1 and 5 call CODE’s first paragraph the essence. Section 14 says it is “living in CODE’s third paragraph.” The implementation reflects part of this split: `data/synthesisData.ts` reads `meta.centre` into the page’s summary, while `lib/oracle/compiler.ts` derives the canonical essence from CODE’s first paragraph. Decide whether these are intentionally different presentations. Do not call them one text while instructing writers to make them different.

Sections 0, 1 and 3 prohibit system vocabulary and repeated labels. Section 9 requires gate, centre and channel names in prose, explanations of their mechanics, and defined/open distinctions. It even says of a mechanical statement and its embodied translation, “Both sentences are needed.” This is a substantive exception, not something a writer can reconcile with “No system word in prose.” Section 3 also first permits “hexagram” inside I Ching and “gate” inside Human Design, then prohibits those terms in prose.

Sections 0 and 3 prohibit naming where material came from. Sections 11 and 14 permit lineage attribution in Relations. Section 7 permits “the traditional character draws.” These exceptions need to appear in the standing rule itself. Otherwise the document’s advertised ten-rule shortcut produces the wrong result.

Section 3 says “No metaphor explained after it is used,” then says to give a picture and “let the next sentence explain the picture.” Section 0 requires complete sentences, while section 3 explicitly recommends “a fragment.” Section 3 permits two claims joined when the second follows from the first, while check 3a.12 says comma-separated halves carrying their own ideas must become separate sentences. Section 5 applies another, stricter comma rule. These need one precedence rule.

Sections 3 and 3a simultaneously forbid examples and require writing “from one concrete instance.” The praised tower in card 64 and the child at play in card 3 are examples. The useful distinction is between an illuminating instance and a scenario that assigns the reader a biography. The current wording bans both.

Sections 0, 3 and 8 disagree over address. “Every section speaks to you” supposedly has only the classical-text exception, but section 8 requires the two natures to be pictures of other people. “Never narrate the reader failing” also cannot govern the entire card if Shadow and moving lines describe mishandling. Restrict the balanced-stance prohibition to CODE and specify the recognition register elsewhere.

Sections 3, 7, 9 and 10 prescribe shapes that section 12 prohibits. Trigrams must proceed through world, person and risk. DESIGN must proceed through gift, operation and misnaming. BODY must contain exactly two paragraphs per subsection. Yet section 12 says, “if the paragraph order could be described identically for another card, vary it.” That would fail every compliant trigram and Body subsection. Required information is defensible. Mandatory rhetorical order needs a much narrower scope.

Section 3’s rhythm rule is too absolute. “Three consecutive sentences within five words of each other is a fail” will penalise perfectly natural passages and encourage conspicuous alternation. “Long” and “short” are undefined. The document also switches between section and subsection as the measurement unit. Sentence-length similarity should prompt an ear check, not compel surgery.

Sections 4, 5 and 13 make synthesis logically impossible as written. The essence is distilled from the five sections, and CODE is written from that essence, yet section 5 says, “Not one sentence and not one piece of content comes from the five sections behind it.” It then requires a sourcing entry tracing the reading to vault files. Indirect derivation is still derivation. Ban repeated teaching and borrowed sentences, not shared meaning or honest provenance.

Section 4’s requirement that each opening and closing become false on the nearest cards is also impossible for shared facts. An essential amino acid remains essential on every sibling. A trigram retains its nature. Sections 7 and 11 explicitly require reference entries to repeat, while section 4 forbids “the same sentence on two cards.” Exempt approved reference material and test the card-specific interpretation.

Section 4 does not explain how to choose the governing scene when the sources contain several. Its claim that the traditions share the I Ching scene is an editorial premise, not a demonstrated identity. The guideline should permit the sources to disagree. Otherwise “assimilate first” becomes “make everything support the selected picture.” Its mechanism examples also retain the card 64 refrain that the preceding passage retires.

Sections 4 and 7 disagree about the I Ching hand-off. Section 4 says ICHING “owes KEYS a hand-off”; section 7 says the last paragraph “may hand” to the Gene Key. Mandatory or optional needs an answer.

Sections 7 and 14 specify different Reading lengths: 180 to 260 words versus 200 to 300. Section 6 calls keynotes “seven words,” then permits five to seven phrases of one to three words. Its approved “The Pull to Hurry” contains four words. Decide whether these are targets or rejection thresholds.

Section 7 requires retaining every agreed scene element, cutting unusable details, and finding every original element in the rewrite. All three cannot govern the same detail. Its explicit example retains “the ten years,” while card 3 replaces that with an unspecified cycle. The instruction also needs a procedure for disagreement among translations. Record the chosen reading and material omissions rather than pretending complete preservation is possible.

Sections 1 and 7 misdescribe the manuscript contract. There are not simply twenty-seven fixed required subsections: the symbol is optional, Pair and Inverse may merge, and Channel partner is not yet supported. The compiler validates mapped content, not that blanket heading count. Structural Tarot and Deeper correlation bullets, Gene Keys labels and the Relations outer wrapper also need explicit exemptions from the Markdown prohibition.

Section 11 bans totalling Relations, but the compiler currently requires a nonempty Relations unity line. Card 3 retains exactly such an introduction. Section 11’s channel paragraph is conditional on future compiler support. A writer needs an instruction for today’s format, not an instruction to wait for an unspecified implementation.

Section 9 omits the plan’s selection rule for gates with multiple channels. Human Design Part 3 includes all relevant channel material, but the card discusses its frontmatter-selected channel. Restore that distinction and define the partner used by packet assembly and neighbour checks. Otherwise “what completes it” can falsely imply a unique completion.

Section 9 prohibits teaching authority while requiring operational guidance that can function as authority. The plan itself identifies that risk. Explain where description ends and a decision instruction begins. Also define what “open” means in the selected references rather than silently collapsing terminology.

Section 10 contains the clearest direct contradiction. It prohibits saying the energy is in the organ, but its approved opening says “the energy of beginning sits at the navel.” It requires opening on the thing itself, then requires opening on the energy through the lens. It demands a mechanism happening now that the reader can notice within a minute, although its reference describes historical umbilical changes and molecular processes the reader cannot directly observe.

Section 10’s amino-acid requirements also conflict. A standalone paragraph must explain several shared facts, while the ring rule permits those facts in “one clause at most.” Its requirement for “the one thing true of it alone” will invite false uniqueness. Ask for a relevant, distinctive fact instead.

Section 11 has a production dependency cycle. Relations must use the kin cards’ finished sections, but its packet contains their CODE, and section 15 writes CODE after Relations. Paired cards cannot both wait for each other. The packet also lacks an explicit separate inverse when needed and an explicit inclusion of the Immortal references. CODE alone cannot reliably supply the two low faces the programming-partner paragraph requires.

Sections 9, 10 and 13 do not fully resolve source precedence. “Read every source file the section may draw on” conflicts with the packet-only economy unless the packet is explicitly the complete production source set. Human Design’s plan gives precedence to particular book material over scraped articles, but the guideline does not carry that rule forward. The sheet needs source versions and claim locations, not just filenames, if another person is to verify it cheaply.

Sections 0 and 15 say Relations has not completed the loop, while card 3 marks it final and the Relations plan records a rewrite. The Gene Keys plan describes an earlier three-paragraph Shadow and reports measurements that no longer describe the manuscript. The Body measurements in the guideline are obsolete too. Date and version each approval and measurement.

Finally, section 15 gives no policy for approved exceptions, revision limits, changed reference files or reopening earlier approvals. “Fable writes card copy and reviews it” does not say whether review is self-checking within the draft call or an independent call. Those omissions materially affect both quality and cost.

Question 2. Does card 3 follow its own rules?

It follows the desired voice substantially better than it follows the written specification.

Its `meta.centre` contains the required three sentences, but neither CODE paragraph identified elsewhere as the essence matches them. Its CODE sourcing list spans I Ching, Gene Keys and Human Design, precisely the pattern section 5 calls a tell. That list may be honest provenance. Deleting it to pass the rule would conceal history.

CODE includes “The challenge of this stretch,” despite section 3 retiring that filler. Its first paragraph ends by summarising what a beginning feels like. Its content about fullness without visible form returns in the I Ching Reading. Its small-moves counsel returns there too. These violate a literal pre-emption rule, although some shared meaning is necessary.

“The Pull to Hurry” exceeds section 6’s three-word maximum. “Root Before Shoot” is arguably an instruction as well as a naming. “Starting Again” is not uniquely identifying. These are good reasons to soften the keynote rule, not automatically reasons to discard the approved keynotes.

The Combination contains 37 whitespace-delimited words against section 7’s minimum of 40. The lower trigram includes the fragment “The surge that says go before anything is ready.” Both trigram entries use “In a person,” contrary to section 3’s supposedly universal address rule, but consistent with section 7’s required shape.

Moving-line prose measures 63, 78, 54, 73, 71 and 55 words, excluding markers and destinations. Lines 2, 4 and 5 exceed the 70-word maximum. Line 4’s standalone marker says “the same horse,” and its first sentence repeats that dependence. A reader receiving only this line has no earlier horse. Line 2 drops the specified ten years. Several lines end in interpretation rather than the explicit final-sentence counsel section 7 requires.

KEYS uses four sentences for the repressive nature and five for the reactive nature, against section 8’s “three sentences.” “Nothing in there has been allowed to change for years” attributes a history to the person. “It is the best feeling you know” assigns the reader an experience. These exceed recognition into assertion.

The Gift sentence “You try things, and most of them fail, and the failing is how the new shape is found” carries three claims. It illustrates exactly why numerical punctuation compliance does not establish conceptual simplicity.

The Gene Keys plan says the Gift must preserve the warning to give the energy to something larger than oneself. The current paragraph gives direction toward the best version of the work, but does not clearly preserve that warning. Its claims about what the rewrite carries need updating. The sheet’s sprout-based mechanism also does not accurately describe the current hands, grip, tremor and play imagery.

DESIGN re-announces “Gate 3 is called Ordering.” It repeatedly names the Sacral and explains defined/open mechanics. These comply with section 9 and violate sections 0, 1 and 3. The channel paragraph uses the retired Alone-then-Joined construction: “On its own,” followed by the other half and “Joined they make.”

“If it is defined in you, that response is the most trustworthy thing you have” functions as a decision-authority statement. It needs source-specific qualification and reconciliation with section 9’s prohibition, rather than approval merely because it avoids the technical word.

BODY fails all three current punctuation thresholds. Running the supplied script produced 16.4 words per sentence, 4.4 commas per hundred words and one sentence with at least three commas. The guideline’s quoted 21-word measurement is stale.

BODY’s opening locates the energy at the navel despite section 10’s prohibition. Its account of birth supplies the emotional join by metaphor, not evidence that a present beginning has a corresponding navel mechanism. “Press a finger into it and you meet something firm at once” promises a universal physical observation without a cited anatomical source.

The vessel description also compresses away a relevant distinction: distal umbilical artery segments become ligaments while proximal portions remain patent. A reference should preserve that qualification before the writer simplifies it. [Elsevier’s anatomical entry](https://www.elsevier.com/resources/anatomy/cardiovascular-system/arteries/medial-umbilical-ligament/16878) makes that distinction.

“The strongest signal a cell gets,” “in every whole protein,” and “Between meals it falls and the order stops” require direct support for their scope. The manuscript’s biology provenance is a general-lore note, not the clinical reference required by section 10. I would hold these claims for verification rather than classify them all as established facts.

The amino-acid paragraph spends multiple sentences on shared leucine facts, contrary to the one-clause rule. Its final cord callback crosses the supposed boundary against repeating the scene. Again, part of the problem is the rule.

RELATIONS retains the unity introduction, repeatedly says “this card,” totals the pair and family, and uses a Tarot lead referring to “five faces.” Those violate sections 3 and 11. The programming partner does not clearly show the two low faces feeding each other. The ring paragraph offers themes without identifying which named sibling the reader should open.

The Tarot bullets repeat counsel already given in I Ching. The High Priestess repeats gathering, listening and not setting out. The Hanged Man repeats the pause. The Immortals paragraph is 78 words against a maximum of 70 and ends by summarising the pair. Its opening and closing describe the two figures without speaking to “you.”

The Relations underscore wrapper and structural bullet delimiters are not automatically visible-emphasis violations. The parser removes those wrappers. The guideline and measurement script need to distinguish structural syntax from reader-facing prose.

The rhythm rule fails on approved passages too. CODE has three consecutive sentences of similar length beginning “Something new is already alive,” “You can feel how real it is,” and “That mix of fullness.” Relations opens with another qualifying triple. These are reasons to question the rule’s predictive value.

Question 3. What is the cheapest process that preserves quality?

Keep the author’s editorial decisions. Remove repeated source discovery, mechanical orchestration and unnecessary review calls.

Prepare the nine centre references and the principles reference once. Keep their source evidence separate from their polished wording. The Human Design plan assigns these distillations to Fable, not Sonnet. Its existing sacral and principles drafts need reconciliation with the final vocabulary and authority rules before reuse.

Prepare biological references by substance and anatomical structure. Twenty amino acids, a start role and a stop role are not twenty-two distinct amino acids: methionine already belongs to the twenty. Keep the twenty-two symbolic ring mappings separate. NHGRI identifies AUG as encoding methionine and initiating translation, with three separate termination codons. [NHGRI’s genetic-code explanation](https://www.genome.gov/25520300/online-education-kit-1966-genetic-code-cracked) supports that distinction.

Make about thirty-five organ entries after deduplicating the actual labels. Sonnet can assemble source-grounded drafts in small batches. An independent check must inspect the cited passages. Opus without evidence is not an anatomy authority. Adrian approves the voice; that is a different job from checking chemistry.

Prepare eight trigram references, eight Immortal references and twenty-two ring readings. Each trigram should have one approved reusable definition plus separately sourced body, Tarot and Immortal associations. Each Immortal needs sourced lore and a separately identified deck mapping. Fable writes ring themes from the member sources; Adrian approves them as interpretations.

Break the Relations cycle with sixty-four compact, source-checked kin briefs. Each needs the energy, scene, low and high faces, drive and relevant relational distinctions. Do not generate these by compressing scaffold CODE and then call them verified. Finished cards can later supplement the brief, and changed kin material should trigger only the Relations paragraphs that depend on it.

Build packet assembly as a script. Exact gate IDs must join to exact channel and centre IDs. Filename substring matching can confuse gate 3 with 13, 23 or 30. Extracting arbitrary windows around “Gate NN” can miss a qualification or the channel paragraph filed under its partner. Verified section boundaries, source spans, hashes and coverage assertions are worth the one-time tooling.

Human Design packets should retain all relevant channels as context and clearly mark the frontmatter-selected one for prose. Body packets contain the two labels, their references and accepted KEYS and DESIGN. Relations packets contain the distinct kin briefs, applicable references and structural data. I Ching packets retain the complete required translations and line sources. Gene Keys packets retain the full chapter, essay and reference row. Do not buy cheaper tokens by silently replacing required source reading with an unreliable summary.

Use Fable for the five teaching-section drafts, essence, reading, keynotes and editorial review. Use Sonnet or below for extraction, reference assembly and tooling. Use Opus once to resolve the production contract, then only for an unresolved problem that merits escalation. There is no reason for an Opus planning call per card.

Budget eight routine generation calls per remaining card. Five calls draft the five teaching sections, one per major section. A sixth distils the essence for Adrian’s ratification. A seventh writes CODE and then keynotes from the approved essence and finished card. An eighth independently reviews the assembled card. Internal checking belongs inside each draft call. Do not allocate separate calls to every height, moving line, Tarot bullet or diagnostic question.

That is 504 routine calls for 63 cards. Each teaching section costs one initial call plus any necessary correction, not one draft call and an automatic second reviewer call. The final independent review checks cross-panel repetition and missed requirements. Source-heavy sections must still produce a compact evidence record during drafting.

The scripts should run with zero model calls: extract validation, packet assembly, punctuation measurement, word counts, duplicate detection, metadata checks, line-target verification, corpus generation, search generation and test execution. A Sonnet conversation is not needed merely to launch a deterministic command and report its output.

The punctuation script currently reports rather than enforces. It pools major sections, excludes bullet prose, and does not test conceptual complexity or the rhythm rule. The measurement script writes a JSON report; it does not certify compliance. It counts structural emphasis and bullet delimiters, flags the optional symbol as a deviation, and treats card 3’s valid merged Pair differently from the current rule. Its opening detector misses paraphrased formulas and repetitions appearing on only two cards.

Retain the existing prose linter for actual build failures on prohibited punctuation, emphasis and editorial leaks. Extend automated checks around parser-extracted visible units, with explicit exemptions for approved reusable reference text. Structural and measurable failures can block. Semantic similarity, stock endings and cadence should produce review candidates.

The content pins in `tests/unit/cardMarkdown.test.ts`, `oracleCorpus.test.ts` and `oracleRelationsSource.test.ts` verify mapping and preservation, not literary quality or factual truth. Repoint a changed prose pin only after confirming its replacement remains distinctive to the expected field. Keep structural assertions intact. A passing pin on the navel sentence does not validate its anatomy.

Repair the five pilots first: card 3’s exceptions, then 14, 47, 52 and 64. They already provide useful differences and a close-neighbour comparison between 47 and 64. Preserve the full major-section page loop during this calibration.

Then process the remaining fifty-nine in batches of four, with a final batch of three. Mix centres and rings within each batch. Writing all leucine siblings consecutively saves little once references are cached and strongly encourages imitation. Compare completed siblings together, but do not necessarily draft them together.

Compress the mechanics of the page loop. Prepare sources before the sitting. Put the section on the preview page with automated findings already resolved. Collect Adrian’s feedback on that section together and use one focused correction call. Keep BODY downstream of accepted KEYS and DESIGN, and CODE downstream of the ratified essence. Reading several accepted panels in one sitting is compatible with this; writing the entire card before anyone sees it is not.

After calibration, change the guideline only for a recurring problem or a substantive decision. Do not turn every local wording preference into another global prohibition.

For planning, allow roughly seventy-four preparation calls, including source checks, kin briefs, reference drafting and tooling. This is an allowance, not a measured minimum. Add sixteen batch comparisons across the sixty-three cards and roughly three focused repairs to card 3. With 504 routine calls, the baseline is about 597 calls. Reserve one to two correction calls per remaining card, giving approximately 660 to 725 calls overall.

These are generation calls, excluding tool invocations. They are not a dollar estimate. A full Gene Keys read and a short correction have radically different costs. Record input tokens, cached input, output tokens and revisions on the five pilots, then extrapolate by section. Cache the stable guideline prefix and reusable references. The Human Design plan’s own workload estimate needs correction: its nine Winn chapters total 94,985 words, which cannot fit inside the later claim of “about 25,000 once.”

Question 4. Where will this process fail anyway?

It will drift into formula through its required emotional sequence. A different noun in the same progression is still a template. Three heights, one thread word, two paragraphs, a recognition ending and a carefully shortened final sentence can create sixty-four versions of the same performance.

Catch that in batch review by comparing the argument and emotional movement, not only strings. Read openings and endings without names, then compare whole paragraph functions. Ask whether the neighbouring card makes a different claim. Exempt reusable reference definitions. Never invent a different biological fact merely to pass the uniqueness test.

Reference errors will spread faster than prose errors because reuse makes them look settled. The dangerous points are OCR, heading extraction, omitted qualifications, the conflation of a symbolic assignment with biology, and lore used to authenticate an unrelated correspondence. A source list does not catch those failures.

Each factual reference needs claim-level locations, source version, verification status and a record of disagreement. Each packet needs a dependency manifest. If a reference changes, a script should identify every affected card and paragraph. Approval of wording and verification of evidence must remain separate records.

The reference files also need enough evidence behind their short summaries. An eighty-word ring theme cannot serve as the complete evidence for six member placements. The writer should receive the short approved reference; the verifier must be able to retrieve its supporting passages.

The four older pilots should become migration cases, not discarded work and not untouchable exemplars. All four currently carry scaffold statuses. Preserve their useful sentences and source work, replace incompatible structures, and retain their previous versions in Git.

Card 14’s “Some weeks” and its belly-led decision advice conflict directly with the new CODE rules. Its Body describes a disliked job causing specific digestive changes and needs source review. Card 52 begins with a phone-and-room scenario and later turns the reader into an engine in a garage. Card 64 narrates the reader’s failure through the fox and repeats its old centre. Cards 47 and 64 remain essential comparison cases because their shared channel and amino acid make disguised repetition especially likely.

A pilot is successfully migrated when Adrian accepts its new form and the source and runtime checks pass. Merely changing its essence to three sentences does not finish the migration.

Question 5. Three changes to make before production, with exact wording.

First, replace the competing essence, repetition and uniqueness rules with this wording:

“The essence is the three-sentence text stored in meta.centre: energy, challenge, way. CODE’s first paragraph is a standalone introduction, not a second essence, and CODE’s third paragraph carries the way in different words. Record the current use of each text on the page, in search and after a throw; do not assume those surfaces use the same field. CODE is distilled from the teaching sections through the essence and keeps honest provenance. It may share their central meaning, but it must not repeat their explanations, distinctive sentences or detailed counsel. Approved trigram definitions, Immortal placing sentences, ring-theme sentences and necessary factual statements may repeat. Test the card-specific interpretation against its neighbours; a shared fact does not fail because it remains true elsewhere.”

Second, replace the conflicting voice hierarchy and numerical pass rules with this wording:

“The general voice rules apply unless this paragraph names an exception. Human Design may name and explain its gate, centre, channel and defined or open states in plain language; it must not infer the reader’s chart or prescribe a decision authority. Relations may name lineages. I Ching may describe the symbol inside its popup and use the approved character attribution. The two Gene Keys natures may describe another person; elsewhere address the reader without assigning them a history. Complete sentences are the default, with an occasional deliberate fragment allowed when it improves the spoken rhythm. Length and punctuation targets identify passages to review, not passages to pad or chop. Similar sentence lengths prompt an aloud check. Required content does not require identical paragraph order. Record Adrian’s approved exceptions with the manuscript version and reason.”

Third, replace the production and reference contract with this wording:

“Before scaling, approve the reusable centre, principles, biology, trigram, Immortal and ring references, and prepare a source-checked kin brief for every card. A reference distinguishes sourced fact, inherited interpretation and this deck’s synthesis. Biological claims require evidence for the actual claim, not a neighbouring fact or an oracle metaphor. Do not assert that an energy occupies an organ or causes a physiological change without evidence. Each reference records source locations, version and verification; scripts assemble complete packets and track their dependants. Relations may use verified kin briefs until the corresponding cards are finished. Write the five teaching sections separately, with Adrian reading each on the page before dependent work proceeds. Then ratify the essence, write CODE and keynotes, and review the assembled card once. Repair the five pilots before batches of four. Automated checks validate structure and measurable defects; Adrian judges recognition, rhythm, distinction and final status. A changed reference reopens only the dependent claims and their approvals.”

Codex session ID: 01a0959a-3847-77f3-baac-71000a01e825
Resume in Codex: codex resume 01a0959a-3847-77f3-baac-71000a01e825

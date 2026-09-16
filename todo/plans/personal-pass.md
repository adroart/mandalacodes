# The personal pass: two phases, then the book

Written 2026-09-16 by Fable as coach and editor, from Adrian's request in his own words ("this is my time to personalize it and make it my own even though the AI started the process"), his correction the same day (two phases, the second his alone), the 147 messages in todo/plans/writing-guideline/adrian-said.md, the locked writer's brief, the guideline, the outside research on AI tells, the two earlier Fable passes, cards 1 to 3 as they stand, the vault packet for card 3, the reflection recorder and invocation code, his own oracle notes in his identity vault, and a measured baseline of the 64 cards taken today. Nothing here is a rule for an agent writing a card; that is oracle/WRITERS-BRIEF.md.

The shape, in one paragraph. Phase 1 is the last thing the AI does to the prose: one bounded pass over all 64 cards that removes every tell a machine can find and records every sentence it suspects but may not touch, ending with a measured "clean". Phase 2 is his alone: a printed workbook of the 64, read with a pen, crossed out, written over and rewritten by hand, with no AI beside him, and the coaching printed into the book. Between the two there is a typist step where his handwriting is carried back into oracle/cards/NN.md verbatim, and a script, not a model, does the patching. The book comes after, from what he wrote.

One fact governs the whole plan, and it is not about the community. In the United States (the Copyright Office's 2023 guidance, upheld in Thaler v. Perlmutter in 2025) and in Australia (Telstra v Phone Directories), text a machine wrote has no copyright. Nobody owns it, so anybody may copy it. The 64 cards as they sit on disk today are, legally, unowned prose. Phase 2 is not polish. It is the act that creates an author, and with it a book that can be sold, registered and defended.

---

## Phase 1: the cleanest AI possible

Where the deck stands, measured today on the 64 cards without Relations (9,308 sentences): no sentence starts with And; 17 sentences carry two ands; one "Not X. It is Y"; two stock height openers left; no card talks about itself; nine system words in prose outside Human Design. The prose lint (scripts/lint-oracle-prose.ts) reports zero errors, 39 banned-vocabulary hits, and 39 pairs of cards opening a lens on the same six words, 37 of them in Body ("in you this energy is given", "the adrenals are where this energy"). The measure script finds no subsection opener shared by three or more cards, but the CODE section's closing paragraph opens "The way is to..." 38 times across the deck and "This is the energy of" seven times. Twelve percent of sentences carry three or more commas; nine percent run past thirty words. So the hard never-dos are nearly gone and the formula has moved to two places the checks were not looking: the Body entry sentence, which every agent copied from the brief's liver model, and the reading's third paragraph, which every agent closed the same way.

What the pass is. One Opus agent per pair of cards, paired as the autorun was (shared organ or amino acid), under the writer's brief plus a one-page pass appendix, with a fixed edit budget and a required report. It does five things and nothing else.

1. The measurable tells to zero: two ands in a sentence, a stock height opener, a shared Body or Design entry stem, a shared CODE paragraph opener, a system word outside Human Design, a "Not X. It is Y" beyond the card's one hinge, a banned word. Each is rewritten in place as one finished thought; the fix for a shared stem is a different entry, never a synonym in the same slot.
2. The side-by-side test from the brief: the reading beside the I Ching Reading, compared by meaning. A proposition carried in both is cut from the reading, and the duplicated proposition is recorded on the sheet under meta.mechanism. Card 2 failed this on the page; the 61 unread cards have never had it run.
3. Sentences with three or more commas and sentences over thirty words: split only where two thoughts share a sentence and the second does not follow from the first. A long sentence that is one thought keeps its commas; the fable pass already showed what the comma gate did to card 1's Siddhi.
4. The two-minute check's eye tests (the picture that must be decoded, the life assigned to the reader, the list of examples, the matched pair, the paragraph that ends by saying what it meant): fixed where the fix is a cut. A cut is safe; a new sentence is not.
5. The report, which is the point: a per-card list at todo/plans/personal-pass/phase1/NN.md of every sentence the agent suspects says nothing (fails "can I say it in other words and check it against a life") and every sentence it was unsure of, with the sentence quoted and the source line it thinks the sentence should have carried. These are not rewritten. A machine writing for meaning is what produced the prose in the first place; the meaning is his job, and the list is what the workbook prints in the margin so he does not have to find them cold.

What clean means, measured, before Phase 1 is declared done: the tells count (a committed script, scripts/oracle-tells.mjs, promoted from today's scratch check and run beside lint:prose in CI) reads zero for two-ands, height openers, system words outside Design and "Not X. It is Y" beyond one per card; no CODE paragraph opener and no lens entry stem shared by more than two cards; three-comma sentences under five percent and thirty-word sentences under five percent, deck-wide; lint:prose green with zero repeated-stem pairs; the side-by-side test recorded on every card's sheet; unit tests green on the full deck; and a Fable read, not a rewrite, of four cards drawn at random after the pass, with the seven checks of Phase 2 run on them, reporting how many sentences still fail check 4. That last number is the honest measure of what Phase 2 inherits, and it is written at the top of the workbook's front matter.

Cost and time. Thirty-two agent runs in eight waves of four, the way the autorun ran, one working day. The tells script and the CI wiring, two hours before the first wave. The Fable read, one call. The workbook is not printed until the four-card read is done.

What Phase 1 is not. It is not a rewrite, not a chance to improve the reading, not a place to try a new picture. An agent that finds a paragraph it dislikes and cannot fix by cutting puts it in the report and leaves it. The status of every lens stays scaffold. This phase ends the AI's involvement in the prose.

---

## Phase 2: his alone

### 1. The printed workbook

One workbook, 64 cards, printed in eight booklets of eight cards so a booklet is a fortnight and fits a bag. A4, portrait, one card is about ten pages. Everything below is produced by one script, scripts/oracle-workbook.mjs, which reads oracle/cards/NN.md after Phase 1, strips frontmatter and parser markup, and emits HTML with print CSS, then a PDF per booklet through the Playwright already installed in the project. About three hours of agent work. It runs once, after Phase 1, and its output is the last thing the AI touches before he does.

The cover page of a card: the artwork (the same Cloudinary crop the share card already uses), full width; his card name; the Chinese name of the hexagram in transliteration with a blank line beside it headed "my gloss"; the keynotes on one line with a blank line under them headed "mine"; the essence in three lines with three ruled lines beside it headed "in my words". Nothing else. He made the piece and named it years before any of this text existed; the cover puts that first.

The lens pages, in the order he reads them on the live page: Universal, I Ching, Gene Keys, Human Design, Body. Relations is left out while it is paused. Every sentence carries a small number in the margin, per lens (U1, I14, K7, D3, B2), so a handwritten note can point at a sentence without copying it and the typist step can find it without reading his hand. Wide line spacing, a 50 mm outer margin for the pen, and a facing blank page after each lens headed with the lens name and "rewrite", for a paragraph that will not fit in a margin. Under each of the three Gene Keys heights, one ruled line headed "my name for this height". The Phase 1 report for the card is printed as a small mark in the margin beside each suspected sentence, so the hunt for empty sentences starts where the machine left off and never ends there.

The fixed strip at the top of every page, small, in two lines: the seven checks from section 2, one phrase each; and the five marks from section 4. The strip is the coach when nobody is beside him; it is on every page because the page he is on is the only one open.

The front matter of every booklet, six pages, printed once per booklet so it is always at hand: the sitting (section 3, one page); the seven checks with his own corrections beside them (section 2, two pages); the source shelf, which two texts to open per lens and which to leave shut (section 3, one page); the marks and what happens to them afterwards (section 4, one page); and a page headed "what done means for a card" with the six things from section 5 as boxes to tick. The Phase 1 number (how many sentences the Fable read still found empty in four cards) is printed at the top of the first page, so he knows what he inherited.

Options that were considered and lose. The same PDF on an iPad with a pencil is the fallback when there is no print shop within reach; it is the same script, and the marks export as an annotated PDF, but a screen has notifications and the app has a pull. Obsidian mobile is for reading the sources on the phone, never for editing the card files (frontmatter, parser markers and em-dash headings that one stray touch breaks). The card page with the existing reflection recorder is not for this: the recorder is admin-only, has been force-hidden on the reading page since the July fullbleed redesign, and feeds the invocation composer, which is the personal transmission layer and deliberately not card prose. Voice Memos on the phone is the only screen tool in Phase 2, and only for the "in my life" memo (section 3); the rewrites are pen work.

What it costs him per card: reading 4,500 words at a marking pace is 35 to 45 minutes; the quick pass (read, mark, one memo) is 45 to 60 minutes; the deep pass (sources open for the lens that failed, his own rewrite) is about two hours. Section 5 says which cards get which.

### 2. The lens, printed in the front matter

Seven checks, each a yes or no on paper, each with one of his own corrections beside it. They fall into three families because the three failures need three different fixes: an AI tell is cut or broken; an empty sentence is rewritten from the source; a sentence that is not his is rewritten by him. The family-two check runs first on every paragraph, because it outranks the rest.

The one test that outranks the others (check 4): cover everything but this sentence. Can I say what it means in other words, and does it tell me something true that I could check against my own life? A sentence that fails this is rewritten from the source no matter how well it scores elsewhere. A sentence that passes it gets, at most, a light edit. His words: "Most of these words say nothing." "Mastering the art of saying a lot without saying actually anything."

Family one, reads as AI. Fix: cut, or break the sentence.

1. Does a sentence start with And, carry two ands, or rope three thoughts together? "It is the push in you to make something that was not there before, and to make it your own way, and it keeps no schedule." His verdict: very bad English. One thought, one sentence, finished.
2. Does the section open the way the same section opens on another card, or does a paragraph end by stepping back to say what it meant? "At its lowest, this energy is" on cards 1 and 2: "I do not want that a part of the template." Cut the opener or the closer and let the first real sentence stand first.
3. Is there a list of examples, or a matched pair built to the same shape? "Reach for the phone, the fridge, someone to ring, the next thing to do." His fix: "I wouldn't do four examples." One example carries a sentence; two is the limit.

Family two, no meaning. Fix: go to the source, find the nugget, say it plainly.

4. The outranking test above. "It is the oldest thing in you. Held well, it is light." His verdict: "This becomes more of a riddle once again." Also "It comes when it comes," which the source beside it answered with: creativity cannot be controlled, so when it is absent there is nothing to do but wait.
5. Does the first sentence of the section name what it is talking about? "What begins things in you rises on its own." His verdict: "Are you talking about making bread?" Name the thing in the opening words, then say what it is.

Family three, not my voice. Fix: he writes it.

6. Would I use this word? Nondescript verbs, one country's word, wellness words, a life assigned to the reader. "Is up in you" became "is alive in you"; "ring" became "call"; "anyone who has started a piece of work or a family knows this hour" was cut because it tells the reader what their life contains. The test is the word's fit with his own speech, not a banned list.
7. Is this about what the energy is when it is held well, or only about the trouble? "You're so focused on the wave coming in and out. You've missed the whole aspect. We're looking at what this energy is, not what it is when you're having a hard time with it." A challenge is a sentence or two inside the balance, never the paragraph, never a verdict.

Two minutes a section is enough because the checks are read once at the front and then run by eye from the strip. After the first booklet the checks themselves get re-read: if one has never fired, it goes; if he keeps marking something none of them names, he writes the eighth in the front matter by hand and it is printed into the next booklet.

### 3. Going deeper, printed in the front matter

The sitting. A card is one sitting and never half of two, in this order, so a sitting can start anywhere with no run-up.

1. The artwork first, two minutes, before any prose. The question is what he saw when he named the piece; that is the one source no packet holds.
2. The card with the seven checks, 30 to 40 minutes. Mark; do not yet rewrite.
3. For each lens that failed check 4 or 5, the one or two source texts below, in full, 15 to 25 minutes a lens. Read until he could shut the book and tell a friend what this energy is at its lowest and its highest in his own words. If he cannot say it simply he does not have it yet.
4. Then rewrite: on the line for a sentence, on the facing page for a paragraph. Never with the card text in view; cover it with a hand and write from the sources and the piece. What comes from polishing the AI sentence keeps its shape; what comes from the source and the piece is his.
5. One memo on the phone, three to five minutes, headed "card NN in my life": what this energy is when he has lived it, one concrete instance. This is the seed of the book paragraph and the only material in the whole system that is unambiguously his.

The source shelf, per lens: what repays reading whole, and what stays shut.

Universal (the reading) has no source of its own; it is the whole card distilled. When it fails, the fix is downstream: read the Gene Keys chapter and the Eranos fields, then write the reading fresh.

I Ching: the Eranos fields of meaning (oracle-NN in the vault, about 3,400 words, the text card 3's scene came from) and Legge (about 950 words, public domain, the counsel in a Victorian voice he is free to keep or strip). Wilhelm's judgement and image take two minutes. Shut on the first pass: Huang, both Cleary translations, Deng. The six line files only when a moving line failed.

Gene Keys: the Rudd chapter (about 4,000 words) in full, every time, whichever lens failed. His words: "There's a lot of nuggets of truth and wisdom in this. There's massive references, especially in the Gene Keys." The 64 Ways essay second, when the chapter's picture does not land. The reference row only for the two nature names.

Human Design: the gate file and the centre reference (about 450 words). The channel file only when "What completes it" failed. He has no life-test in this lens yet ("I have no human design experience"), so here the reading is learning as much as editing; expect it to take longer and yield fewer rewrites, and let it.

Body: the organ entry, five minutes. Not the amino acid sources: the brief established that the source is silent about the molecule and every invented reason failed on the page. If the amino paragraph fails check 4, the fix is shorter and more honest, not deeper.

The travel kit is three books: the workbook, the Gene Keys, and an I Ching (the Eranos, which the deck's scenes came from, or Wilhelm). If the two books stay home, the script's `--sources NN` flag emits a screen PDF per card of the texts above for the phone; it is the backup, never the print.

Coaching when the coach is not AI. Four things stand in for it, and each is already half in place.

- A reading list, five books, read before or during booklet 1: Verlyn Klinkenborg, Several Short Sentences About Writing (the one-thought-one-sentence craft as a discipline, closer to his rule than anything else in print); William Zinsser, On Writing Well (cutting as the craft); Ursula K. Le Guin, Steering the Craft (the ear, read aloud); Rachel Pollack, Seventy-Eight Degrees of Wisdom (the model of a deck book that is literature and not a reference); and the Eranos I Ching's introduction (how a three-thousand-year-old text speaks plainly). Nothing on AI writing; the research pass is done and its findings are the seven checks.
- Readers. Card 3 is good because one reader had to understand it, and that reader is now the writer, which is the one seat he cannot also fill. Three people, each reading one finished card aloud with him watching their face: someone who knows none of the systems (the stranger test in a person); someone who loves English (the literature test); someone inside the Gene Keys world (the "is this yours" test, and the early warning on the book). One card each per booklet is enough. Their faces are the check no script runs.
- The read-aloud. Every rewritten paragraph is read aloud once before the sitting ends. The ear cuts what the eye kept.
- The cold re-read. At the start of each booklet, the last card of the previous booklet is re-read against the strip, ten minutes, before the new card is opened. A sentence that passed warm and fails cold is the lesson for the fortnight, written by hand on the front matter's blank line.

### 4. The loop: handwriting back into oracle/cards/NN.md, with the AI as typist

The five marks on paper. A line through: cut. A word circled with the word above: swap. A caret with a number: insert here, and the text is on the facing page under that number. A star in the margin: true, keep, fixed from now on. A question mark in the margin: I need to go to the source, not done; a resume marker for the next sitting, never for anyone else. Five marks, nothing else. A mark system he has to remember is one he stops using on day three.

Intake. At the end of a booklet (or a card, if he prefers), he photographs the marked pages in order and shares them to one folder per card in the vault, Mandala Codes/oracle/pass/NN/, with the "in my life" memo. The vault already syncs.

The typist step, in two halves, so no model ever patches a card.

- First half, a model as typist. An Opus agent reads the photos and writes one file, pass/NN/transcript.md, in a fixed shape: one line per mark, with the sentence number and the operation, and his handwritten text verbatim (K7: cut. U3: swap "push" for "force". I12: insert after, "..." . B2: replace with, "..."). Spelling may be corrected. Punctuation follows the page. Nothing is tidied, nothing is completed, nothing is smoothed. Where a word cannot be read it writes [unclear] and stops at that mark. The brief for this is one page, oracle/PASS-BRIEF.md, and its only rule is that every word in the transcript that is not an operation code must be a word on the page.
- Second half, a script as patcher. He reads the transcript (on the phone is fine; it is short) and says "apply". scripts/oracle-pass-apply.mjs NN reads the transcript and patches the card by sentence number: cuts, swaps, inserts, replacements, byte-identical everywhere else, and prints the diff. No model runs. If a sentence number does not resolve, it stops and says which.

The rules that keep the AI off his lines, made mechanical.

- A starred sentence, and every sentence he inserted or replaced, is appended to oracle/approved/NN.md with the date. A unit test (the content-pin pattern already in tests/unit) asserts every approved sentence is present byte for byte in its card. Any agent on any future task that alters one turns the suite red. This is the rule already in memory for the essence and keynotes, extended to every line that is his.
- Status flips to final only when he says "final" for that lens on the page after the patch. The apply script never flips; a person does, in a one-line commit that quotes his word.
- No sentence in the deck is ever generated again. If a mark says "cut" and the paragraph no longer reads, that is his to fix at the next sitting, not the typist's. The question mark exists so he can leave it.

What has to be built, in hours: the workbook script (3), the pass brief (1), the apply script (2), the approved-lines file and test (1), a dry run on card 3 with fake marks that proves the diff is clean and the test goes red when an approved line is changed (1). Eight hours of agent work, one session, after Phase 1 and before booklet 1 prints.

---

## 5. The plan, both phases in order

Phase 1, one week. Day 1: the tells script committed and wired beside lint:prose, the baseline recorded. Days 2 and 3: the 32 paired runs in eight waves. Day 4: the measured clean checked against the list above; anything short goes back for one more bounded wave, never a rewrite. Day 5: the Fable read of four random cards, the number recorded, the phase closed with the AI out of the prose.

The build week. The workbook script, the pass brief, the apply script, the approved test, the dry run. Booklet 1 printed at the end of it.

Phase 2, sixteen weeks at four cards a week, or twenty-one at three. Both are fine; the rhythm that survives travel is one card per sitting and a booklet per fortnight. Pace, from the record: card 3 took a seven-hour session with the template being built underneath it; card 1's reading alone took an hour on 2026-09-14; card 2's reading and heights took eleven minutes on 2026-09-16 with two corrections. The 61 unread cards were written under the locked brief and cleaned in Phase 1, so expect them nearer card 2 than card 3, with booklet 1 slowest while the lens settles. Assume half the cards need the deep pass on one or two lenses: about 90 hours across the 64.

Order, and why. Booklet 1: the cards in his own Hologenetic profile, up to eight; the outranking test is "can I check this against my life", and on the energies he lives that test is fastest and hardest to fool, and the memos will be richest. Booklet 2: the kin of what he has read: 14 (card 1's ring sibling), 20, 23, 24, 27, 42 (card 3's ring siblings), and 4 (card 3's pair); a ring read in one fortnight is where a shared Body paragraph shows its repeats, and a pair read side by side is the fastest way to see whether two cards say one thing. Booklets 3 to 8: the rest in codon ring order, for the same reason.

Milestones. Booklet 1 done: re-read the seven checks and adjust them. Booklet 2 done: the typist loop has run twice; if he had to correct a transcript twice for the same fault, the pass brief is fixed before booklet 3. Booklet 4 done: the first four book spreads (section 6) written from the memos, to prove the book method on real material before the second half. Booklet 8 done: every card carries his three height names, his gloss, his essence, his keynotes; the book draft starts from the memos, not from the cards.

What done means for a card, the six boxes on the front matter page: every lens read on paper; every mark applied and re-read on the page; no question mark left; the essence, keynotes and gloss in his words; the three heights carry his own names; five lenses at final on his say (Relations stays paused); one "in my life" memo in the card's folder. A card with five of the six is not done; it is a card with a resume note.

---

## 6. The book

The legal question first, plainly.

What is his: the 64 artworks and their titles; every sentence he has written or rewritten himself; his three-height framing (seed under the earth, plant, flower, in his own words on 2026-09-12); his glosses, essences and keynotes once he has passed them; the selection and order of the whole.

What is free: the I Ching itself (the Chinese text, the 64 figures, the King Wen sequence, the judgements and images); Legge's 1882 translation; the Shuogua's body mapping; the Eight Immortals; Chinese medicine's account of the organs; every fact of anatomy and biochemistry; the fact that 64 hexagrams and 64 codons share a number.

What is not: Wilhelm and Baynes (the 1950 English is under copyright in the US, and it is the source of the hexagram names the cards carry, such as Difficulty at the Beginning); Huang, both Cleary translations, Deng, and the Eranos I Ching; the Gene Keys (Richard Rudd's chapters, the 64 Shadow, Gift and Siddhi names as a set, the repressive and reactive names, the codon ring names, and the name Gene Keys itself, which is treated as a trademark); Human Design (Jovian Archive holds Ra Uru Hu's copyrights and the trademarks; the gate keynotes, the channel names and the nine-centre map are their material, and Jovian is known for defending it). Single words are not copyrightable, but 192 words selected and arranged into a system are a compilation, and adopting them wholesale in a sold book is the one thing here a lawyer would tell him not to do.

What "inspired by" has to mean, structurally, for the book to be his and publishable:

- The spine is the I Ching, named as tradition, and his 64 pieces. Each spread carries his card name, the hexagram's Chinese name in transliteration, and his own one-line gloss of it (Zhun, the sprout under hard ground), never the Wilhelm title. The glosses are written on the workbook's cover lines during Phase 2.
- The three heights carry his own names, one per card, from the workbook's ruled lines. The book's front matter explains his three-height view once, in his words. Rudd's names, the natures and the ring names do not appear in the book. The prose already describes each height without its label; that was the brief's rule, and it turns out to be the legal rule too.
- Human Design does not appear in the book. It is the most chart-dependent lens (the your-chart line, the partner link, the sign-in) and the most trademark-tangled, and it belongs on the page where those things live.
- Body appears as the organ paragraph only, which stands on Chinese medicine and anatomy, both free. The amino acid stays on the page: its assignment is Rudd's table and it is, by his own reading, the weakest section.
- The traditions are named and credited once, in the front matter, as the sources the book grew from, with Rudd's and Ra's books listed under further reading. Naming a book is not copying it; that is where attribution goes, and it is the honest thing as well as the safe one.

What a lawyer would still need to check, in one read for the book and the site together, because the site today prints Rudd's 192 names and Human Design's keynotes as labels: whether the organ-to-hexagram assignment (Rudd's physiology line, from Human Design) is a protectable compilation or a fact set; whether the site's labelled reference use is fine as commentary with attribution; and whether the I Ching numbers are enough of a bridge that a Gene Keys reader recognising the arc counts as inspiration rather than derivation. Only the first could change the book's shape.

The disclosure question. The community's stance is real, and it is the same as the law's: text a machine wrote is not anyone's, and a book of it is not a book by him. Once he has rewritten every line himself in the way section 3 requires (the AI text covered, the sources and his life open), what he can truthfully say is this: every sentence in this book was written by me, from the source texts and my own life, over a period of months. I used AI tools during the research and drafting the way I use an editor and a reference shelf: to gather sources, to draft scaffolds I then rewrote, and to check my sentences against my own rules. No sentence in this book stands as a machine wrote it. What he cannot say: that no AI was used, that the book is written without AI, or anything with "100 percent" in it. The US Copyright Office asks registrants to disclose AI-generated material beyond the trivial, so the honest line and the registrable line are the same line. The test that makes it true is the brief's own: can he say each sentence in other words, and did he choose these ones. A pass that changes a fifth of the words is not that; a pass that writes the paragraph fresh with the card covered is. The typist loop makes this auditable: oracle/approved/NN.md is, card by card, the record of which sentences are his and when.

The book's shape. One spread a card, 64 spreads, 600 to 800 words a card, about 50,000 words with front and back matter.

- Left page: the artwork, the card name, the Chinese name and his gloss, his keynotes, his essence.
- Right page, in order: the reading (three paragraphs, the whole card for someone who reads nothing else); the situation (the I Ching scene and counsel in his words, under his own subhead, no moving lines: the coins belong to the app); the three heights under his three names; one body paragraph.
- Front matter: how to draw a card; the traditions this grew from, credited; how this book was made, in the words above.
- Back matter: a table of his 64 names against the King Wen numbers and Chinese names for readers who know the I Ching; further reading.

What stays on the page and not in the book: the moving lines and the coins, Human Design, the amino acid, Relations. The page is the place that knows the reader's chart and links the kin; the book is the place that is only his voice. That split also means the book cannot be lifted from the site by copying, which is worth something on its own.

The book is written from the memos and the passed cards, in that order: the "in my life" memo is the seed, the passed reading is the check, and the AI card is study material and never the draft. Four spreads at the booklet-4 milestone prove whether that holds before it is 64.

---

## 7. Do now

The first Phase 1 action, under ten minutes, agent-runnable: promote today's scratch check into scripts/oracle-tells.mjs, add it to package.json beside lint:prose, run it once on main and paste the baseline line (two-ands 17, height openers 2, system words 9, "The way is" 38, three-comma sentences 1,107 of 9,308, thirty-word sentences 850) into the top of the Phase 1 report folder. Everything in Phase 1 is measured against that line, and nothing in Phase 2 prints until it has moved to the numbers in the clean list.

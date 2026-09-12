# What people actually found, last 30 days: making AI-assisted prose not read as AI

Research run 2026-09-12 via last30days (Reddit, X, YouTube, Hacker News, Digg) plus firecrawl-search
web supplements, because X returned zero results this run (bird backend down) and the social
engine's keyword search on Reddit/HN surfaced mostly noise for these concept queries. The richest
material came from three long-form pieces: claudisms.ai (a living, maintained banned-tell list),
a Substack piece arguing the defense of eight "banned" AI patterns with a diagnostic test for each,
and Sean Goedecke's essay on why models over-use the em dash. This file is a source, not a
conclusion. It feeds into the deck's writing-guideline work; it does not decide it.

## 1. The recurring AI tells, ranked by how often they came up

1. **The em dash, used as connective tissue for almost any relationship between two clauses.**
   Sean Goedecke opens his essay with the plainest statement of it: "If you asked most people to
   name a defining feature of AI-generated writing, they'd probably say the em dash, like this."
   Claudisms bans it outright as a formatting rule, not a taste call: "Em dashes, banned outright.
   This style uses dashes heavily, but they're regular hyphens with spaces, not em dashes." The fix
   nearly everyone converges on is mechanical: replace with a period, a comma, or a hyphen with
   spaces on both sides, and if the sentence goes flat once the dash is gone, that means the dash
   was doing real rhythmic work and the fix is to rebuild the sentence, not just delete the
   punctuation. Mia Kiraki's piece adds the sharpest caveat here: a Claude Project instruction
   apparently flagged that banning the dash without replacing its job just makes the sentence lose
   a beat you won't notice is missing.

2. **"Not X. It's Y" and "it's not just X, it's Y."** Named directly by a circulating Facebook post
   ("The new em dash to recognise ChatGPT instantly: 1. That's not X...") and analyzed at length by
   Mia Kiraki, who quotes the on-autopilot version: "The problem isn't speed. It's direction." Her
   point is that the construction only works if the reader currently believes X; otherwise you are
   negating a strawman nobody held. Fix: ask whether the reader was actually assuming the thing
   being negated. If not, cut the whole sentence and state Y plainly.

3. **The rule of three, used to complete a pattern rather than to add information.** On-autopilot
   example from the same piece: "Speed, efficiency, and innovation," where innovation is pure
   filler added to hit three. Fix, stated as a test: does the third item surprise, or does it just
   complete what the first two already promised? If you can delete it and lose nothing, it was
   statistical comfort, not rhetoric.

4. **The tidy bow ending and the parallel kicker.** Claudisms bans "the whole game," "that changes
   everything," and "that's the entire point" as "totalizing-superlative filler" that "collapses a
   real point into a single all-or-nothing claim." Mia Kiraki frames the mechanism as habituation:
   "The first kicker lands because the reader didn't see it coming. The second lands softer. By the
   third, they've already written your ending in their head." Fix: let only one section in a piece
   end on a punch; let the others end flat, mid-thought, or trail off.

5. **Elevated default vocabulary: delve, tapestry, resonate, journey, embrace, navigate, profound,
   leverage.** Goedecke traces this to a specific mechanism, not just taste: RLHF raters in African
   English-speaking countries use "delve" and "tapestry" more liberally than American or British
   English, and that dialect got baked into the reward model. Jordan Gibbs' word-frequency study
   puts a number on the distortion: "Reimagined" appeared 1,033 times more often in AI output than
   in a human web corpus; an invented fantasy name, "Elara," appeared 3,504 times more often. Fix:
   for each flagged word, ask whether you would say it out loud to the person across the table. If
   not, swap it for the plain word. The counter-argument (below) matters here too: some writers
   report these words are simply part of their real vocabulary, so the test is the word's fit with
   your own speech, not a blanket ban.

6. **Manufactured depth and discovery-arc framing: "worth sitting with," "the question I keep
   coming back to," "the thread I didn't plan but can't unsee," "here's the thing that landed."**
   This is the single largest family in the Claudisms list. Its own description is precise: "sit
   with / worth sitting with, reflective-pose filler. Sounds thoughtful; doesn't say anything," and
   the discovery-arc entry: "stages a little narrative of stumbling onto an insight... to lend the
   observation weight it should carry on its own." Fix: state the thing directly and cut the
   staging. "Every one of these turns on the same pivot," not "the thread I didn't plan but can't
   unsee: every one of these..."

7. **Value-claim filler that tells the reader what to think before showing them: "this matters,"
   "worth talking about," "the right way," "because it matters."** Claudisms names the underlying
   rule bluntly: "never tell people what to think of something, cool people don't need to tell
   people they are cool." Fix: delete the announcement and let the substance carry the weight on
   its own; if the sentence collapses without the announcement, the substance wasn't there yet.

8. **Uniform sentence length and uniform paragraph length (low "burstiness").** Mia Kiraki names
   this the most visible tell of all: "AI and bad writing cluster toward the average. Every
   sentence is medium. Every paragraph is 3-4 lines... Scroll any AI-generated essay and you'll see
   it: identical bricks, identical height, forever." Microsoft's own writing guidance independently
   converges on the same diagnosis: "AI models tend to produce sentences of similar length and
   structure, which runs counter to people's natural preference for variation." Fix: deliberately
   mix a long sentence, a short one, and a medium one in sequence, the way Joan Didion's prose
   reads; vary paragraph length so the page looks like a landscape, not a wall.

9. **Colon-reveal and lecture-hall signposting: "here's the thing," "here's where it gets
   interesting," "here's what nobody talks about."** Example given as failing: "Here's what nobody
   talks about: consistency matters," which promises surprise and delivers a truism. Fix, stated as
   a test: delete everything before the colon or the "here's" and check whether the sentence loses
   meaning or only loses runway. If only runway, cut the setup.

10. **Wh-cleft openers used to delay a short subject: "what makes this interesting is..."** Failing
    example: "What makes this interesting is the constraint," which spends eight words delaying a
    two-word subject. Fix, same delete-and-check test: if removing everything before "is" costs
    nothing, the cleft was padding, not emphasis.

11. **Inanimate subjects stacked with human-sounding verbs: "the data demonstrates," "the framework
    reveals," "the analysis confirms."** One inanimate subject doing its natural job (a thermometer
    measures temperature) is normal English and not a tell on its own; four in a row with no person
    anywhere in the paragraph is. The fix given is a single question: should a person be in this
    sentence, and if so, put one back in.

## 2. What people report actually works

1. **Specificity over category.** Microsoft's guidance gives the clearest concrete instance:
   replace "achieve growth" with "expand regional sales by 15 percent," and "make a decision" with
   "decide." The general move is naming the one real thing instead of the class it belongs to.

2. **Uneven rhythm, deliberately built, not just avoided.** Mia Kiraki's model is Joan Didion: "a
   long winding sentence, then a short one that hits like a slap, then a medium one that lets you
   breathe." The point isn't randomness, it's contrast placed on purpose, the way a musician accents
   the one beat the listener's body wasn't ready for.

3. **Ending on the interesting part instead of resolving it.** Directly opposite the tidy-bow tell:
   "ONE section ends with a punch. The next two end flat, or mid-thought, or trail off." A real
   conversation often ends on the uncomfortable or open part; a manufactured one resolves itself
   for you.

4. **Letting a claim stand without a justifying clause.** The flip side of the "this matters"
   filler: state the thing and stop. If it needs a sentence explaining why it deserves attention,
   the observation itself probably isn't sharp enough yet.

5. **First-hand sensory and personal detail.** Microsoft's guidance: "share personal or real-world
   examples... use sensory language to convey what something feels, looks, or sounds like." This is
   also the mechanism behind why Mia Kiraki's own multilingual background reads as voice rather than
   flaw: "It took me years to realize that was my voice, not a flaw."

6. **The "would a stranger say this" test, applied as a delete-and-check.** Every one of the eight
   patterns in the robotsatemyhomework piece is paired with the same underlying test in different
   words: delete the suspect clause and ask whether meaning is lost or only runway. That single test
   covers colons, wh-clefts, negations, and triads at once, which is why it belongs at the top of
   any working checklist.

7. **Read it aloud.** Microsoft's guidance states this plainly: "Reading AI text out loud is a
   simple, straightforward way to pinpoint places where the rhythm sounds stilted." Nobody in this
   research window disputed it; it is the closest thing to a universal recommendation found.

8. **Building from a real writing sample instead of describing style in the abstract.** Two YouTube
   creators converged on this independently within the same week (both published 2026-09-09). Kyle
   Balmer's approach feeds an AI system a large body of a person's actual writing (email, messages,
   files) and has it derive the voice from that corpus rather than from adjectives describing the
   voice. Elizabeth Anne West's stylometry approach is more explicit: measure real quantitative
   features of your own prose (dialogue length as a percentage of total word count, ratio of lyrical
   to non-lyrical sentences, number of unique words per 50,000-word stretch) and give the AI those
   numbers as a target, not a description like "witty" or "warm."

## 3. Giving many short entries one distinct voice without formula

Claudisms itself is the most direct answer found to this question, even though it was built for a
single AI system's output rather than tarot or oracle copy. Its structure is the useful part: it is
a living, continuously updated list, organized into named families of related tics rather than a
flat alphabetical banlist ("sit with," "the question I keep coming back to," and "coming back to"
are grouped as one family; "shape," "lives," "the engine," and "hits hardest" are grouped as another
placement-metaphor family). The list states its own limitation directly, which is the load-bearing
insight for any house style guide meant to survive contact with new writing: "A text search only
catches the literal phrases listed here. The same move with a novel noun or verb in the slot reads
exactly the same and has to be caught by eye." A banned-word list catches the words already caught;
a banned-construction list, organized by family and paired with the reasoning for the ban, catches
the next word that fills the same slot.

The robotsatemyhomework piece adds the corrective the pure word-list approach is missing: a
vocabulary guide alone will not produce a distinct voice across many entries, because voice is not
only word choice. "Your Voice DNA won't fix this on its own. You can give AI your vocabulary, your
tone, your favorite metaphors, and still get 4/4 time... Your voice is the words you use and the
rhythm underneath them." For a project writing 64 or more short entries that all need to sound like
one voice without sounding like a formula, this suggests a style guide needs two layers, not one: a
banned or preferred word list (the vocabulary layer, which Claudisms demonstrates well) and an
explicit rhythm rule (sentence-length variation per entry, where the one short or one long sentence
goes, which section is allowed to land a punch), because the second layer is what a plain word list
cannot capture and what most published AI-writing-tell guides skip entirely.

Ordinary publishing house style guides (Erin Wright's guidance for small businesses, and Collective
Ink Books' author-facing chapter) independently confirm the same tool, prohibited or preferred word
and phrase lists plus explicit register decisions (formal versus casual, contractions allowed or
not), predates AI by decades and is standard practice for keeping many pieces of writing consistent
under one house identity. Nothing found in this window described a "write the plainest version,
then cut" practice as a named technique, but it is the implicit method behind every delete-and-check
test above: write the sentence without the flourish first, then decide deliberately whether a device
earns its way back in, rather than writing with the flourish by default and hoping it survives
editing.

## 4. A one-page checklist, phrased as tests that fail

Run this on one paragraph at a time. Each line is a test, not advice; if the paragraph fails a line,
that is the fix, applied on the spot.

1. Delete every em dash. Does anything become unclear? If not, the dash was padding, replace it
   with a period, a comma, or a plain hyphen with spaces.
2. Find every "not X, it's Y" or "it's not just X, it's Y." Was the reader actually assuming X
   before this sentence? If not, cut the whole construction.
3. Count the items in every list of three. Does the third item add information the first two
   didn't already promise? If not, cut it and leave two.
4. Read the last sentence of each paragraph. Could its shape have been predicted before reading it,
   a summary clause or a "that changes everything" beat? If yes, cut it or let the paragraph trail
   off instead.
5. Circle delve, tapestry, resonate, journey, embrace, navigate, profound, leverage, unpack. Would
   you say this word out loud to the person across the table? If not, replace it with the plain
   word.
6. Find any sentence that announces significance instead of showing it (worth sitting with, worth
   talking about, the question I keep coming back to). Delete the announcement. Does the sentence
   still stand on its own?
7. Measure the length of three consecutive sentences. Are they all within five words of each other?
   If yes, cut one down hard or let one run long.
8. Find every "here's the thing," "here's where it gets interesting," or colon setup. Delete
   everything before the colon or the "here's." Did the sentence lose meaning, or only lose runway?
9. Find every "what makes this interesting is" or similar wh-cleft opener. Delete everything before
   "is." Did meaning survive?
10. Count inanimate subjects paired with human verbs in a row (the data shows, the framework
    reveals, the analysis confirms). Three or more in a row: put a person back into at least one
    sentence.
11. Read the paragraph aloud. Does it sound like something you would actually say to a person across
    a table? If it sounds like a memo, say the worst sentence out loud in your own words first, then
    tighten the grammar without losing what you just said.
12. Check the ending. Does the paragraph resolve its own tension in one tidy closing sentence? If a
    real conversation on this subject would end on the open or uncomfortable part, cut the resolving
    sentence.

## 5. Sources

1. Sean Goedecke, "Why do AI models use so many em-dashes?", seangoedecke.com. Undated post, cited
   and cross-linked by multiple 2026 sources in this research window.
2. Tim O'Brien, "AI Ruined the Em Dash," Medium, April 10, 2026.
   https://medium.com/@tobrien/ai-ruined-the-em-dash-856992b2486b
3. Claudisms, "Claudisms, a living banlist of AI-writing tells," claudisms.ai. Surfaced on Hacker
   News September 8, 2026. https://claudisms.ai/
4. Mia Kiraki, "The internet made a ban list for AI writing. I'm making a case for the defense,"
   Robots Ate My Homework (Substack), March 25, 2026.
   https://robotsatemyhomework.substack.com/p/ai-writing-patterns
5. Jordan Gibbs, "Every AI Writing Tell You Know Is Already Dead," Medium, July 15, 2026.
   https://medium.com/@jordan_gibbs/every-ai-writing-tell-you-know-is-already-dead-762cadf46f6b
6. Microsoft 365 Copilot, "How to humanize AI text for natural writing," microsoft.com. Support and
   guidance page, undated.
   https://www.microsoft.com/en-us/microsoft-copilot/copilot-101/humanize-ai-text
7. Kyle Balmer (AI with Kyle), "Make ChatGPT Sound Like You: 6 Methods," YouTube, published
   September 9, 2026. https://www.youtube.com/watch?v=1OmRxol201U
8. Elizabeth Anne West (Future Fiction Academy), "Stop Telling AI to 'Write Like Me': Use Stylometry
   Instead," YouTube, published September 9, 2026. https://www.youtube.com/watch?v=I8cgjEOllI4
9. Caelan Conrad, "AI Slop is Obvious," YouTube, published August 29, 2026.
   https://www.youtube.com/watch?v=N-tME9IHBlU
10. Hacker News discussion, "It is rational to prefer human-writing over AI content of superior
    quality," posted September 8, 2026.
    https://samuelfitoussi.com/posts/it-is-rational-to-prefer-human-content-over-AI-content
11. Hacker News discussion, "Writing with AI Is Stupid," posted to HN September 9, 2026, original
    post dated August 7, 2026. https://lambdaland.org/posts/2026-08-07-ai-writing-stupid/
12. Hacker News discussion, "What We Tell AI," posted August 30, 2026. https://www.whatwetellai.com/
13. Reddit r/sideprojects, "Humanize AI text without losing the personality of the original writer,"
    posted August 22, 2026.
    https://www.reddit.com/r/sideprojects/comments/1vv6vvn/humanize_ai_text_without_losing_the_personality/
14. Erin Wright, "What Should Be in a House Style Guide?", erinwrightwriting.com. Reference article,
    undated. https://erinwrightwriting.com/in-house-style-guides-for-small-businesses-selecting-topics/
15. Collective Ink Books, "House Style," Publishing Guide chapter 8, collectiveinkbooks.com.
    Undated. https://www.collectiveinkbooks.com/publishing-guide/chapter-8-editorial/house-style/

Raw last30days engine output for the three social-source queries run this session is saved
alongside this file's session scratchpad, not in this folder, since it is intermediate evidence
rather than the synthesis. Ask if the raw social data (Reddit threads, YouTube transcripts, HN
comment counts) is needed for a specific claim above.

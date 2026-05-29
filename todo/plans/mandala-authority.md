# Make Mandala Codes the go-to mandala authority site

Mandala Codes is becoming the editorial mandala-authority destination: the place people and AI assistants cite when they want to understand mandala art. This is a long, multi-phase campaign of articles, artist features, outreach, and press work.

Full strategy in [`docs/research/seo/`](../../docs/research/seo/) (4 docs committed 2026-05-29). Companion strategy in `~/Documents/Obsidian Vault/4 Outputs/mandalas/` (master plan, outreach intelligence, source picks, collaboration templates). Research corpus (482 files) at `~/Documents/Obsidian Vault/5 Sources/mandalas/`.

## Phase 1: Foundation (blocks everything else)

- [ ] Build an About page stating the editorial mission. Establishes editorial-not-promotional before any content ships. Claude drafts, Adrian voice-passes. Roughly a day. Spec: [`page-targets.md`](../../docs/research/seo/2026-05-28-page-targets.md) row `/about`.
- [ ] Adrian reads the 5 curated sources for "What Is Mandala Art?" Unblocks everything. 2-3 hours focused reading. The picks: [`_top-sources-for-writing.md § Article 1`](../../../../../Documents/Obsidian%20Vault/4%20Outputs/mandalas/_top-sources-for-writing.md).
- [ ] Draft and ship the "What is mandala art?" article (targets a 49,500/month search). Foundational explainer. Claude drafts from Adrian's notes, Adrian voice-passes. Blocked on the reading above. Source corpus: `5 Sources/mandalas/what-is-mandala-art/` (23 files). Spec: [`article-cluster-plan.md § Article 1`](../../docs/research/seo/2026-05-28-article-cluster-plan.md).
- [ ] Build the artists hub and Adrian's featured-artist page. First Featured Artist proves the template. Roughly a day. Blocked on About plus the first article. Spec: [`featured-artist-page-spec.md`](../../docs/research/seo/2026-05-28-featured-artist-page-spec.md).

## Phase 2: Editorial cluster

All blocked on Phase 1 complete. Full list and specs: [`article-cluster-plan.md`](../../docs/research/seo/2026-05-28-article-cluster-plan.md).

- [ ] Ship the "sacred geometry mandala art" article (bridges to a 18,100/month term over time).
- [ ] Ship the "commissioning a mandala" article (low volume, very high buyer intent). Adrian's own process stays on his featured-artist page.
- [ ] Ship the "laser-cut wooden mandalas" article. Cross-links to Adrian's first-person essay on adrianrasmussen.com.
- [ ] Write the depth articles after the core four are live: Tibetan, Hindu, Jung, sand mandalas, mandala history, sacred geometry history, flower of life, mandala meditation.

## Phase 3: Collaboration outreach (parallel, kick off anytime)

- [ ] Adrian drops 5-15 collaboration names in chat (mandala / sacred-geometry artists, IG handle plus one-line context). Roughly 15 min. Framework: [`_outreach-intelligence.md § Tier 0`](../../../../../Documents/Obsidian%20Vault/4%20Outputs/mandalas/_outreach-intelligence.md).
- [ ] Claude scores each candidate and drafts a tailored DM. Blocked on names. Templates: [`_collaboration-outreach-templates.md`](../../../../../Documents/Obsidian%20Vault/4%20Outputs/mandalas/_collaboration-outreach-templates.md).
- [ ] Adrian sends the first wave (3-5 DMs), personalized, no template-blasting.
- [ ] Build the first collaborator's featured-artist page when one says yes. Roughly a day. Spec: [`featured-artist-page-spec.md`](../../docs/research/seo/2026-05-28-featured-artist-page-spec.md).

## Phase 4: Press kit and Tier 3 outreach

- [ ] Draft press bios (250 / 500 / 1000 word). Claude drafts, Adrian voice-passes. Roughly an hour.
- [ ] Adrian compiles a high-res image library (10-15 hero images, 3000px+, Cloudinary IDs marked "press hero").
- [ ] Adrian provides CV plus exhibition history. Required for Tier 1 pitches.
- [ ] Adrian compiles process documentation (10-15 photos plus a 60-90s studio video). Highest-value asset for Tier 2 editorial pitches.
- [ ] Draft Tier 3 pitch templates for 5 outlets (invaluable, dailyartmagazine, artzolo, gaia/buddhagroove, rareearthgallerycc). Source: [`_outreach-intelligence.md § Tier 3`](../../../../../Documents/Obsidian%20Vault/4%20Outputs/mandalas/_outreach-intelligence.md).
- [ ] Adrian sends the Tier 3 wave (5 personalized pitches). Blocked on the items above.
- [ ] Build a pitch tracking sheet at `~/Documents/Obsidian Vault/4 Outputs/mandalas/press-kit/pitch-tracker.md`.

## Phase 5: Authority participation (always-on, starts month 3)

- [ ] Build the Reddit and Quora playbook (specific subreddits, Quora question targets, response templates). Source: AI citation playbook on Adrian-Website.
- [ ] Adrian Reddit warmup: 2-4 weeks of genuine participation in r/Art, r/SacredGeometry, r/woodworking, r/buddhism, r/Bali before any self-mention.
- [ ] Adrian Quora, first 5 answers (400-800 words each, one link).
- [ ] First YouTube video, "How I Create Laser-Cut Wooden Mandalas." Script reuses Adrian's first-person essay. Adrian films, Claude transcribes.

## Phase 6: Corpus maintenance (agent-runnable on trigger)

Top-up research runs, roughly 5 min each via `~/builds/mandala-research.sh`:

- [ ] Kalachakra mandala, before the Phase 2 Tibetan article: `~/builds/mandala-research.sh "Tibetan Kalachakra mandala iconography construction"`.
- [ ] Islamic geometric patterns, before the Sacred Geometry article: `~/builds/mandala-research.sh "Islamic geometric patterns sacred art history"`.
- [ ] Jung's Red Book, before the Phase 2 Jung article: `~/builds/mandala-research.sh "Carl Jung Red Book mandala individuation imagery"`.
- [ ] Rerun the 5 empty subtopics when Firecrawl credits reset (wood-sculpture-artists, crystal-art-illuminated-sculpture, ye-ming-zhu-luminous-pearl, i-ching-art, gene-keys-archetypes). Failed during the 2026-05-22 overnight run on a rate limit.

## Phase 7: AI citation tracking (monthly, starts month 4)

- [ ] Build an AI citation tracking sheet at `~/Documents/Obsidian Vault/4 Outputs/mandalas/_ai-citation-tracker.md`. Columns: month, prompt, platform, Adrian-appeared, domain cited, competitors, accuracy.
- [ ] Run the 12-prompt tracking set monthly across Google AI Mode, ChatGPT Search, Perplexity, Gemini, Bing Copilot. The 12 prompts live in Adrian-Website's AI citation playbook. Adrian runs, Claude logs.

## Phase 8: Adrian-Website cross-linking (lower priority)

- [ ] Add a two-domain note to Adrian-Website SEO docs (`docs/research/seo/` on main) so anyone reading cold sees the split. Roughly 30 min. Blocked on switching to a branch with those docs.
- [ ] Add cross-links from Adrian-Website's mandala pages to mandalacodes articles. After mandalacodes Phase 1-2 articles are live.
- [ ] Add `sameAs` schema in Adrian-Website's Person schema pointing to `https://mandalacodes.com/about`. Roughly 15 min. Blocked on the About page being live here.

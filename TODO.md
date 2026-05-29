# TODO: Mandala Codes

Living list of what's outstanding on the oracle. Loose priority order, top items block more than bottom items.

## Soon

- [ ] **Smoke-test Clerk auth on production.** _(band: you-required)_ PR #5 merged 2026-05-28. Create the Clerk app at clerk.com (name: `mandalacodes`, enable Google + email), copy the publishable + secret keys, add three env vars to Cloudflare Pages → mandalacodes → Settings → Environment variables → Production: `VITE_CLERK_PUBLISHABLE_KEY` (plaintext), `CLERK_SECRET_KEY` (encrypted), `ADMIN_EMAILS=sccsclothing@gmail.com` (plaintext). Then trigger a redeploy and sign in at `/admin/login`. Until the env vars are saved, `/admin/atlas` and `/atlas/claim` show broken Clerk widgets; `/atlas` itself keeps working.
- PR: [#5](https://github.com/technicianofthesacred/mandalacodes/pull/5)

- [ ] **Delete obsolete env vars after Clerk smoke test passes.** _(band: you-required)_ Once Clerk auth is verified working, remove `ATLAS_ADMIN_PASSWORD_HASH` and `ATLAS_STEWARD_SECRET` from Cloudflare Pages → mandalacodes → Settings → Environment variables. They're no longer referenced anywhere in the code. `ATLAS_PUBLIC_ONLY_IN_DEV=false` stays (reserved for future use).

- [ ] **Reprint physical cards with `mandalacodes.com/qr/:n` QR codes.** _(band: you-required)_ New plaques should encode the new domain directly (one redirect hop instead of two). The old plaques (encoded `adrianrasmussen.com/qr/:n`) keep working forever via the art-site redirect, so this is an upgrade for new print runs, not a fix. Regenerate via `npm run generate:qr` (BASE_URL is already set to mandalacodes.com).
- Generator: [scripts/generate-ul-qr.ts](scripts/generate-ul-qr.ts)

- [ ] **Close Adrian-Website PR #110 in favour of PR #113.** _(band: you-required)_ Trigger: when reviewing the open Adrian-Website PRs. PR #110 was the original narrow QR-redirect PR. PR #113 supersedes it: same QR redirect plus removes the entire oracle deck plus rewrites every oracle URL pattern to redirect to mandalacodes. Close #110 with a comment pointing at #113, then merge #113.
- PRs: [#110](https://github.com/technicianofthesacred/Adrian-Website/pull/110) (superseded), [#113](https://github.com/technicianofthesacred/Adrian-Website/pull/113) (the replacement)

- [ ] *(optional polish)* **Set up apex-canonical redirect** _(band: you-required)_ for `www.mandalacodes.com` → `mandalacodes.com` via a Cloudflare Bulk Redirect rule. Both URLs work today; this just picks one canonical form for SEO.

- [ ] **Resolve the local `claude/atlas-clerk-auth` branch and its untracked siblings.** _(band: you-required)_ Trigger: any session that opens mandalacodes. The branch is local-only and carries WIP atlas/Clerk work. The working tree also has untracked oracle/design files (`components/oracle/CorrespondenceSheet.tsx`, `oracle/_design/`, `oracle/sections/_TEMPLATE_01_CODE_N.md`, `mandalacodes.code-workspace`) never committed. Decide: continue the atlas-clerk work, abandon the branch, or graduate the untracked files into a focused commit.

- [ ] **Start filling the 384 changing-line texts via `/cast-content`.** _(band: you-required)_ Trigger: any quiet authoring session. The `/cast-content` slash command was added 2026-05-29 (PR #6, still open). Run `/cast-content next` to draft hexagram 1's six lines, then approve/edit/write; or `/cast-content 1-8` for a batched pass with checkpoints. Until any are filled, the casting panel on every Universal Language card shows a quiet "Line text to be added." placeholder.
- PR: [#6](https://github.com/technicianofthesacred/mandalacodes/pull/6) (open)

### ✅ Done

- ~~Activate `www.mandalacodes.com` as a second custom domain~~, done 2026-05-23, serves correctly.
- ~~Connect GitHub to Cloudflare Pages for auto-deploy~~, done 2026-05-23, every push to `main` auto-builds and deploys.

## Phase 1b: Accounts

- [ ] **Merge the accounts/birthdate-energy branch** _(band: you-required)_ from Adrian-Website (`origin/claude/oracle-energy-birthdate-4HS3f`) into mandalacodes. Brings Clerk sign-up, hologenetic profile, today/year energy panels. Needs a fresh Clerk instance for the mandalacodes domain (publishable keys are domain-locked). D1 database is already provisioned (`mandalacodes-oracle`, APAC region) and wired in `wrangler.toml`, awaiting the schema.

### ✅ Done

- ~~Remove dead oracle code from Adrian-Website~~, Adrian-Website PR #113 ([link](https://github.com/technicianofthesacred/Adrian-Website/pull/113)), 2026-05-29. Deletes all oracle components / data / scripts / assets, replaces `/oracle` with a directory page that links to mandalacodes, 301-redirects every old card URL via `_redirects`. Awaiting merge.

## Future ("home for all things mandala")

- [ ] **Light Codes deck.** _(band: agent-runnable)_ Route shape is already reserved (`/light-codes/*`). Content lives in `Coding/_archive/light-codes/` and needs integration work.

- [ ] **Additional decks beyond Universal Language + Light Codes** _(band: you-required)_ as they emerge.

## Mandala Authority Strategy

Mandalacodes is becoming the editorial mandala-authority destination. Full strategy in [`docs/research/seo/`](docs/research/seo/) (4 docs committed 2026-05-29). Companion strategy in `~/Documents/Obsidian Vault/4 Outputs/mandalas/` (master plan, outreach intelligence, source picks, collaboration templates). Research corpus (482 files) at `~/Documents/Obsidian Vault/5 Sources/mandalas/`.

### Phase 1: Foundation (blocks everything else)

- [ ] **Build `/about` page** _(band: agent-runnable)_ stating editorial mission. Establishes mandalacodes as editorial-not-promotional before any content ships. Claude drafts, Adrian voice-passes. ~1 day.
- Spec: [`page-targets.md`](docs/research/seo/2026-05-28-page-targets.md) row `/about`

- [ ] **Adrian reads 5 curated sources for "What Is Mandala Art?"** _(band: you-required)_ Unblocks everything. 2-3 hours focused reading.
- The 5 picks: [`_top-sources-for-writing.md § Article 1`](../../../../Documents/Obsidian%20Vault/4%20Outputs/mandalas/_top-sources-for-writing.md)

- [ ] **Draft & ship `/articles/what-is-mandala-art`** _(band: agent-runnable)_. Targets `mandala art` (49,500/mo). Foundational explainer. Claude drafts from Adrian's notes, Adrian voice-passes. Blocked on the reading item above.
- Source corpus: `5 Sources/mandalas/what-is-mandala-art/` (23 files). Spec: [`article-cluster-plan.md § Article 1`](docs/research/seo/2026-05-28-article-cluster-plan.md)

- [ ] **Build `/artists` hub + `/artists/adrian-rasmussen`** _(band: agent-runnable)_. First Featured Artist proves the template. ~1 day. Blocked on `/about` + first article.
- Spec: [`featured-artist-page-spec.md`](docs/research/seo/2026-05-28-featured-artist-page-spec.md)

### Phase 2: Editorial cluster

- [ ] **Ship `/articles/sacred-geometry-mandala-art`** _(band: agent-runnable)_. Targets `sacred geometry mandala art` (1,300/mo) + bridges to `sacred geometry art` (18,100/mo) over time. Blocked on Phase 1 complete.
- Spec: [`article-cluster-plan.md § Article 2`](docs/research/seo/2026-05-28-article-cluster-plan.md)

- [ ] **Ship `/articles/commissioning-a-mandala`** _(band: agent-runnable)_. Targets `mandala art commission` (140/mo, very high intent). Editorial guide; Adrian's specific process stays on his Featured Artist page.
- Spec: [`article-cluster-plan.md § Article 3`](docs/research/seo/2026-05-28-article-cluster-plan.md)

- [ ] **Ship `/articles/laser-cut-wooden-mandalas` (Part A)** _(band: agent-runnable)_. Targets `laser cut mandala art` (1,600/mo). Editorial medium overview. Cross-links to Adrian's first-person essay on adrianrasmussen.com.
- Spec: [`article-cluster-plan.md § Article 4`](docs/research/seo/2026-05-28-article-cluster-plan.md)

- [ ] **Phase 2 depth articles** _(band: agent-runnable)_ (Tibetan, Hindu, Jung, sand mandalas, mandala history, sacred geometry history, flower of life, mandala meditation). Run after the core 4 are live.
- Full list: [`article-cluster-plan.md § Phase 2`](docs/research/seo/2026-05-28-article-cluster-plan.md)

### Phase 3: Collaboration outreach (parallel, kick off anytime)

- [ ] **Adrian drops collaboration names** _(band: you-required)_ in chat. 5-15 mandala/sacred-geometry artists with IG handle + one-line context. ~15 min.
- Framework: [`_outreach-intelligence.md § Tier 0`](../../../../Documents/Obsidian%20Vault/4%20Outputs/mandalas/_outreach-intelligence.md)

- [ ] **Score candidates + draft tailored DMs.** _(band: agent-runnable)_ Claude scores on 5 criteria, assigns collaboration shape (1-5), drafts a DM per artist. Blocked on names.
- Templates: [`_collaboration-outreach-templates.md`](../../../../Documents/Obsidian%20Vault/4%20Outputs/mandalas/_collaboration-outreach-templates.md)

- [ ] **Adrian sends first wave (3-5 DMs).** _(band: you-required)_ Personalize each, no template-blasting.

- [ ] **Build first collaborator's Featured Artist page** _(band: agent-runnable)_ when one says yes. Reuses the featured-artist template. ~1 day.
- Spec: [`featured-artist-page-spec.md`](docs/research/seo/2026-05-28-featured-artist-page-spec.md)

### Phase 4: Press kit & Tier 3 outreach

- [ ] **Draft press bios (250/500/1000 word).** _(band: agent-runnable)_ Claude drafts from existing About content; Adrian voice-passes. ~1 hour.
- [ ] **Adrian compiles high-res image library** _(band: you-required)_ (10-15 hero images, 3000px+, Cloudinary IDs marked "press hero").
- [ ] **Adrian provides CV + exhibition history.** _(band: you-required)_ Required for Tier 1 pitches.
- [ ] **Adrian compiles process documentation** _(band: you-required)_ (10-15 photos + 60-90s studio video). Highest-value asset for Tier 2 editorial pitches.
- [ ] **Draft Tier 3 pitch templates** _(band: agent-runnable)_ for 5 outlets (invaluable, dailyartmagazine, artzolo, gaia/buddhagroove, rareearthgallerycc).
- Source: [`_outreach-intelligence.md § Tier 3`](../../../../Documents/Obsidian%20Vault/4%20Outputs/mandalas/_outreach-intelligence.md)
- [ ] **Adrian sends Tier 3 wave** _(band: you-required)_ (5 personalized pitches). Blocked on previous items.
- [ ] **Build pitch tracking sheet** _(band: agent-runnable)_ in `~/Documents/Obsidian Vault/4 Outputs/mandalas/press-kit/pitch-tracker.md`.

### Phase 5: Authority participation (always-on, starts month 3)

- [ ] **Reddit & Quora playbook** _(band: agent-runnable)_. Specific subreddits, Quora question targets, response templates. Source: AI citation playbook on Adrian-Website.
- [ ] **Adrian Reddit warmup** _(band: you-required)_. 2-4 weeks genuine participation in r/Art, r/SacredGeometry, r/woodworking, r/buddhism, r/Bali before any self-mention.
- [ ] **Adrian Quora, first 5 answers** _(band: you-required)_ (400-800 words each, one link).
- [ ] **First YouTube video** _(band: you-required)_, "How I Create Laser-Cut Wooden Mandalas." Script reuses Adrian's first-person essay. Adrian films, Claude transcribes.

### Phase 6: Corpus maintenance (agent-runnable on trigger)

- [ ] **Top-up: Kalachakra mandala.** _(band: agent-runnable)_ Before writing the Phase 2 Tibetan article. Command: `~/builds/mandala-research.sh "Tibetan Kalachakra mandala iconography construction"`. ~5 min.
- [ ] **Top-up: Islamic geometric patterns.** _(band: agent-runnable)_ Before the Sacred Geometry article. Command: `~/builds/mandala-research.sh "Islamic geometric patterns sacred art history"`. ~5 min.
- [ ] **Top-up: Jung's Red Book.** _(band: agent-runnable)_ Before the Phase 2 Jung article. Command: `~/builds/mandala-research.sh "Carl Jung Red Book mandala individuation imagery"`. ~5 min.
- [ ] **Rerun 5 empty subtopics** _(band: agent-runnable)_ when Firecrawl credits reset (wood-sculpture-artists, crystal-art-illuminated-sculpture, ye-ming-zhu-luminous-pearl, i-ching-art, gene-keys-archetypes). Failed during the 2026-05-22 overnight run due to rate limit.

### Phase 7: AI citation tracking (monthly, starts month 4)

- [ ] **Build AI citation tracking sheet** _(band: agent-runnable)_ at `~/Documents/Obsidian Vault/4 Outputs/mandalas/_ai-citation-tracker.md`. Columns: month, prompt, platform, Adrian-appeared, domain cited, competitors, accuracy.
- [ ] **Run the 12-prompt tracking set monthly** _(band: you-required)_ across Google AI Mode, ChatGPT Search, Perplexity, Gemini, Bing Copilot. The 12 prompts live in Adrian-Website's AI citation playbook. Adrian runs, Claude logs.

### Phase 8: Adrian-Website cross-linking (lower priority)

- [ ] **Add two-domain note** _(band: agent-runnable)_ to Adrian-Website SEO docs (`docs/research/seo/` on main) so anyone reading cold sees the split. ~30 min. Blocked on switching to a branch with those docs.
- [ ] **Add cross-links** _(band: agent-runnable)_ from Adrian-Website's mandala pages → mandalacodes articles. After mandalacodes Phase 1-2 articles are live.
- [ ] **Add `sameAs` schema** _(band: agent-runnable)_ in Adrian-Website's Person schema → `https://mandalacodes.com/about`. ~15 min. Blocked on `/about` being live here.

## Operational notes (not TODOs: context for future-you)

- The QR Function on adrianrasmussen.com (`functions/qr/[number].js`) must live forever, printed plaques depend on it. Treat the old domain's QR Function as permanent infrastructure even after every other oracle thing is stripped from the art site.

- All physical-piece sales process through adrianrasmussen.com (one Stripe account, one inventory). "View the original" CTAs on mandalacodes card pages link out, no checkout flow lives here. This is intentional cross-pollination.

# TODO — Mandala Codes

Living list of what's outstanding on the oracle. Loose priority order — top items block more than bottom items.

## Soon

- [ ] **Smoke-test Clerk auth on production.** PR #5 merged 2026-05-28. Need to create the Clerk app at clerk.com (name: `mandalacodes`, enable Google + email), copy the publishable + secret keys, add three env vars to Cloudflare Pages → mandalacodes → Settings → Environment variables → Production: `VITE_CLERK_PUBLISHABLE_KEY` (plaintext), `CLERK_SECRET_KEY` (encrypted), `ADMIN_EMAILS=sccsclothing@gmail.com` (plaintext). Then trigger a redeploy and sign in at `/admin/login`. Until the env vars are saved, `/admin/atlas` and `/atlas/claim` show broken Clerk widgets; `/atlas` itself keeps working.

- [ ] **Delete obsolete env vars after Clerk smoke test passes.** Once Clerk auth is verified working, remove `ATLAS_ADMIN_PASSWORD_HASH` and `ATLAS_STEWARD_SECRET` from Cloudflare Pages → mandalacodes → Settings → Environment variables. They're no longer referenced anywhere in the code. `ATLAS_PUBLIC_ONLY_IN_DEV=false` stays (reserved for future use).

- [ ] **Reprint physical cards with `mandalacodes.com/qr/:n` QR codes.** New plaques should encode the new domain directly (one redirect hop instead of two). The old plaques (encoded `adrianrasmussen.com/qr/:n`) keep working forever via the redirect on the art site — so this is an upgrade for new print runs, not a fix. Regenerate via `npm run generate:qr` (BASE_URL is already set to mandalacodes.com in `scripts/generate-ul-qr.ts`).

- [ ] **Merge PR #110 on Adrian-Website** ([link](https://github.com/technicianofthesacred/Adrian-Website/pull/110)) — adds the redirect from `adrianrasmussen.com/qr/:n` (printed plaques) → `mandalacodes.com/universal-language/:n`. Until this merges, scanned plaques still land on the old oracle inside the art site (which works, just goes to the old home). PR is open, mergeable, Cloudflare preview build passed.

- [ ] *(optional polish)* **Set up apex-canonical redirect** for `www.mandalacodes.com` → `mandalacodes.com` via a Cloudflare Bulk Redirect rule. Both URLs work today; this just picks one canonical form for SEO.

### ✅ Done

- ~~Activate `www.mandalacodes.com` as a second custom domain~~ — done 2026-05-23, serves correctly.
- ~~Connect GitHub to Cloudflare Pages for auto-deploy~~ — done 2026-05-23, every push to `main` auto-builds and deploys.

## Phase 1b — Accounts

- [ ] **Merge the accounts/birthdate-energy branch** from Adrian-Website (`origin/claude/oracle-energy-birthdate-4HS3f`) into mandalacodes. Brings Clerk sign-up, hologenetic profile, today/year energy panels. Needs a fresh Clerk instance for the mandalacodes domain (publishable keys are domain-locked). D1 database is already provisioned (`mandalacodes-oracle`, APAC region) and wired in `wrangler.toml`, awaiting the schema.

## Cleanup on the art site (separate PR, not urgent)

- [ ] **Remove dead oracle code from Adrian-Website** after the redirect PR (#110) lands. Components (`OracleGateway`, `UniversalLanguageCard`, etc.), the oracle data files, the `vite.config.ts` OG-page generation plugin, the oracle entry in the Creations grid, the launch flag entry. Touches the route table and nav — worth its own review window.

## Future ("home for all things mandala")

- [ ] **Light Codes deck.** Route shape is already reserved (`/light-codes/*`). Content lives in `Coding/_archive/light-codes/` and needs integration work.

- [ ] **Additional decks beyond Universal Language + Light Codes** as they emerge.

## Mandala Authority Strategy

Mandalacodes is becoming the editorial mandala-authority destination. Full strategy in [`docs/research/seo/`](docs/research/seo/) (4 docs committed 2026-05-29). Companion strategy in `~/Documents/Obsidian Vault/4 Outputs/mandalas/` (master plan, outreach intelligence, source picks, collaboration templates). Research corpus (482 files) at `~/Documents/Obsidian Vault/5 Sources/mandalas/`.

### Phase 1 — Foundation (blocks everything else)

- [ ] **Build `/about` page** stating editorial mission. Establishes mandalacodes as editorial-not-promotional before any content ships. Spec: [`page-targets.md`](docs/research/seo/2026-05-28-page-targets.md) row `/about`. Owner: Claude drafts + Adrian voice-passes. ~1 day.

- [ ] **Adrian reads 5 curated sources for "What Is Mandala Art?"** Unblocks everything. The 5 picks: [`_top-sources-for-writing.md § Article 1`](../../../../Documents/Obsidian%20Vault/4%20Outputs/mandalas/_top-sources-for-writing.md). 2-3 hours focused reading. Owner: Adrian only.

- [ ] **Draft & ship `/articles/what-is-mandala-art`** — targets `mandala art` (49,500/mo). Foundational explainer. Source corpus: `5 Sources/mandalas/what-is-mandala-art/` (23 files). Spec: [`article-cluster-plan.md § Article 1`](docs/research/seo/2026-05-28-article-cluster-plan.md). Owner: Claude drafts from Adrian's notes + Adrian voice-pass. Blocked on previous item.

- [ ] **Build `/artists` hub + `/artists/adrian-rasmussen`** — first Featured Artist proves the template. Spec: [`featured-artist-page-spec.md`](docs/research/seo/2026-05-28-featured-artist-page-spec.md). Owner: Claude. ~1 day. Blocked on `/about` + first article.

### Phase 2 — Editorial cluster

- [ ] **Ship `/articles/sacred-geometry-mandala-art`** — targets `sacred geometry mandala art` (1,300/mo) + bridges to `sacred geometry art` (18,100/mo) over time. Spec: [`article-cluster-plan.md § Article 2`](docs/research/seo/2026-05-28-article-cluster-plan.md). Blocked on Phase 1 complete.

- [ ] **Ship `/articles/commissioning-a-mandala`** — targets `mandala art commission` (140/mo, very high intent). Editorial guide; Adrian's specific process stays on his Featured Artist page. Spec: [`article-cluster-plan.md § Article 3`](docs/research/seo/2026-05-28-article-cluster-plan.md).

- [ ] **Ship `/articles/laser-cut-wooden-mandalas` (Part A)** — targets `laser cut mandala art` (1,600/mo). Editorial medium overview. Cross-links to Adrian's first-person essay on adrianrasmussen.com. Spec: [`article-cluster-plan.md § Article 4`](docs/research/seo/2026-05-28-article-cluster-plan.md).

- [ ] **Phase 2 depth articles** (Tibetan, Hindu, Jung, sand mandalas, mandala history, sacred geometry history, flower of life, mandala meditation). Full list: [`article-cluster-plan.md § Phase 2`](docs/research/seo/2026-05-28-article-cluster-plan.md). Run after the core 4 are live.

### Phase 3 — Collaboration outreach (parallel, kick off anytime)

- [ ] **Adrian drops collaboration names** in chat. 5-15 mandala/sacred-geometry artists with IG handle + one-line context. Framework: [`_outreach-intelligence.md § Tier 0`](../../../../Documents/Obsidian%20Vault/4%20Outputs/mandalas/_outreach-intelligence.md). Owner: Adrian only. ~15 min.

- [ ] **Score candidates + draft tailored DMs.** Claude scores on 5 criteria, assigns collaboration shape (1-5), drafts DM per artist. Templates: [`_collaboration-outreach-templates.md`](../../../../Documents/Obsidian%20Vault/4%20Outputs/mandalas/_collaboration-outreach-templates.md). Owner: Claude. Blocked on names.

- [ ] **Adrian sends first wave (3-5 DMs).** Personalize each, no template-blasting. Owner: Adrian.

- [ ] **Build first collaborator's Featured Artist page** when one says yes. Reuses [`featured-artist-page-spec.md`](docs/research/seo/2026-05-28-featured-artist-page-spec.md) template. Owner: Claude. ~1 day.

### Phase 4 — Press kit & Tier 3 outreach

- [ ] **Draft press bios (250/500/1000 word).** Claude drafts from existing About content; Adrian voice-passes. ~1 hour.
- [ ] **Adrian compiles high-res image library** (10-15 hero images, 3000px+, Cloudinary IDs marked "press hero"). Owner: Adrian.
- [ ] **Adrian provides CV + exhibition history.** Required for Tier 1 pitches. Owner: Adrian.
- [ ] **Adrian compiles process documentation** (10-15 photos + 60-90s studio video). Highest-value asset for Tier 2 editorial pitches. Owner: Adrian.
- [ ] **Draft Tier 3 pitch templates** for 5 outlets (invaluable, dailyartmagazine, artzolo, gaia/buddhagroove, rareearthgallerycc). Source: [`_outreach-intelligence.md § Tier 3`](../../../../Documents/Obsidian%20Vault/4%20Outputs/mandalas/_outreach-intelligence.md). Owner: Claude.
- [ ] **Adrian sends Tier 3 wave** (5 personalized pitches). Owner: Adrian. Blocked on previous items.
- [ ] **Build pitch tracking sheet** in `~/Documents/Obsidian Vault/4 Outputs/mandalas/press-kit/pitch-tracker.md`. Owner: Claude.

### Phase 5 — Authority participation (always-on, starts month 3)

- [ ] **Reddit & Quora playbook** — specific subreddits, Quora question targets, response templates. Owner: Claude. Source: AI citation playbook on Adrian-Website.
- [ ] **Adrian Reddit warmup** — 2-4 weeks genuine participation in r/Art, r/SacredGeometry, r/woodworking, r/buddhism, r/Bali before any self-mention. Owner: Adrian.
- [ ] **Adrian Quora — first 5 answers** (400-800 words each, one link). Owner: Adrian.
- [ ] **First YouTube video** — "How I Create Laser-Cut Wooden Mandalas." Script reuses Adrian's first-person essay. Owner: Adrian films, Claude transcribes.

### Phase 6 — Corpus maintenance (agent-runnable on trigger)

- [ ] **Top-up: Kalachakra mandala.** Before writing Phase 2 Tibetan article. Command: `~/builds/mandala-research.sh "Tibetan Kalachakra mandala iconography construction"`. ~5 min.
- [ ] **Top-up: Islamic geometric patterns.** Before Sacred Geometry article. Command: `~/builds/mandala-research.sh "Islamic geometric patterns sacred art history"`. ~5 min.
- [ ] **Top-up: Jung's Red Book.** Before Phase 2 Jung article. Command: `~/builds/mandala-research.sh "Carl Jung Red Book mandala individuation imagery"`. ~5 min.
- [ ] **Rerun 5 empty subtopics** when Firecrawl credits reset (wood-sculpture-artists, crystal-art-illuminated-sculpture, ye-ming-zhu-luminous-pearl, i-ching-art, gene-keys-archetypes). Failed during overnight run on 2026-05-22 due to rate limit.

### Phase 7 — AI citation tracking (monthly, starts month 4)

- [ ] **Build AI citation tracking sheet** at `~/Documents/Obsidian Vault/4 Outputs/mandalas/_ai-citation-tracker.md`. Columns: month, prompt, platform, Adrian-appeared, domain cited, competitors, accuracy. Owner: Claude.
- [ ] **Run 12-prompt tracking set monthly** across Google AI Mode, ChatGPT Search, Perplexity, Gemini, Bing Copilot. The 12 prompts are listed in Adrian-Website's AI citation playbook. Owner: Adrian runs + Claude logs.

### Phase 8 — Adrian-Website cross-linking (lower priority)

- [ ] **Add two-domain note** to Adrian-Website SEO docs (`docs/research/seo/` on main) so anyone reading those docs cold sees the split. ~30 min. Blocked on switching to a branch with those docs.
- [ ] **Add cross-links** from Adrian-Website's mandala pages → mandalacodes articles. After mandalacodes Phase 1-2 articles are live.
- [ ] **Add `sameAs` schema** in Adrian-Website's Person schema → `https://mandalacodes.com/about`. ~15 min. Blocked on `/about` being live here.


## Operational notes (not TODOs — context for future-you)

- The QR Function on adrianrasmussen.com (`functions/qr/[number].js`) must live forever — printed plaques depend on it. Treat the old domain's QR Function as permanent infrastructure even after every other oracle thing is stripped from the art site.

- All physical-piece sales process through adrianrasmussen.com (one Stripe account, one inventory). "View the original" CTAs on mandalacodes card pages link out — no checkout flow lives here. This is intentional cross-pollination.

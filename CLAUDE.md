# Mandala Codes

Oracle deck reader and site at mandalacodes.com (Universal Language cards, readings, atlas, learn pages).

- Stack: React 18 + Vite 5 + TypeScript, react-router-dom 7, three.js, Tailwind 4; Cloudflare Pages Functions in `functions/`, workers in `workers/`, better-auth login.
- Dev: `npm run dev` (vite, port 2222). `npm run dev:full` builds then runs `wrangler pages dev dist` on 2222.
- Deploy: Cloudflare Pages (`wrangler.toml`, `pages_build_output_dir = "dist"`; R2 media bucket). `npm run build` also runs content/search/oracle-corpus prebuild steps. `.github/workflows/test.yml` is CI only (no deploy step).
- Shared words: transcription is primed and corrected from AR Create's shared word library. The committed copy is `shared/words.snapshot.json` (versioned, refreshed one way by `words-sync` on Adrian's Mac; never read AR Create's data folder), read through `shared/words.ts`; the oracle's word choices are in `shared/oracleWords.ts`. Both Groq calls (`functions/api/oracle/reflections/_shared.ts`, `functions/api/oracle/authoring/process.ts`) use it, and the raw words are kept next to the fixed ones.
- Phone pickup: recordings made on the phone oracle get a better transcript from AR Create on Adrian's Mac. The Mac pulls (never push): `functions/api/oracle/pickup/` lists recordings waiting, serves their audio and takes the result back, behind the dedicated `AR_PICKUP_TOKEN` Pages secret (refuses everything while unset). The phone's Groq draft is never overwritten (kept in the segment metadata as `draft`); text Adrian already edited gets a comparison (accept, keep or decide later) instead of a replacement. Logic in `utils/oracleBetterTranscript.ts`; tests in `tests/unit/pickupApi.test.ts`. Nothing polls this endpoint on a timer.
- Tests: `npm run test:unit` (vitest, `tests/unit`), `npm run test:allowance` (node test runner, `tests/node`), `npm test` (Playwright specs in `tests/`, config `playwright.config.ts`; `test:pwa`, `test:oracle-app`, `test:oracle-account` use their own configs). `npm run typecheck` before PRs.

@AGENTS.md

@./THINKING.md

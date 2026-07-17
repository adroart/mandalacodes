# Centralized Typography System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Mandala Codes one shared typography contract, preserving Cormorant Garamond for large display headings while using Iowan Old Style BT for reading text and GT America for interface text across the React app and `/learn`.

**Architecture:** `src/theme.css` owns every deployable font face, semantic family, and semantic type role. All production consumers reference `--font-display`, `--font-reading`, `--font-ui`, `--font-technical`, `--font-cjk`, or an explicit approved brand role; a static contract test prevents future hardcoded family drift. The React and Astro surfaces continue sharing the same theme import and `/fonts/` asset URLs.

**Tech Stack:** Vite, React 18, TypeScript, Tailwind CSS 4, Astro, Vitest, Playwright, Cloudflare Pages

---

### Task 1: Add a failing centralized typography contract

**Files:**
- Create: `tests/unit/typographyContract.test.ts`
- Read: `src/theme.css`
- Read: `content-site/src/styles/site-bar.css`

- [ ] **Step 1: Write a Vitest contract that requires canonical font roles and rejects production hardcodes**

The test must recursively inspect active production sources while excluding `generated`, `_mockups`, `_src`, `dist`, `node_modules`, SVG assets, and the font-registration portion of `src/theme.css`. It must require the canonical variables below and reject direct production declarations for Iowan Old Style BT, GT America, Cormorant Garamond, Karla, Lora, Lato, Plus Jakarta Sans, Cinzel, and IBM Plex Mono outside the theme contract.

```ts
const requiredRoles = [
  '--font-display',
  '--font-reading',
  '--font-ui',
  '--font-technical',
  '--font-cjk',
  '--font-calligraphic',
  '--font-brand',
];

const productionRoots = [
  'src',
  'components',
  'content-site/src',
  'shared',
];
```

The theme file is allowed to contain family literals because `@font-face` and canonical token definitions must name the fonts. Standalone assets that cannot inherit CSS custom properties remain excluded.

- [ ] **Step 2: Run the focused test and verify the expected failure**

Run:

```bash
npm run test:unit -- tests/unit/typographyContract.test.ts
```

Expected: FAIL because production components and `/learn` still contain direct `font-family` values and `--font-brand` is not yet canonical.

- [ ] **Step 3: Commit the red test without staging `INDEX.md`**

```bash
git add tests/unit/typographyContract.test.ts
git commit --no-verify -m "test: define centralized typography contract"
```

### Task 2: Install the licensed font assets and canonical shared contract

**Files:**
- Create: `public/fonts/iowan-old-style-regular.woff2`
- Create: `public/fonts/iowan-old-style-italic.woff2`
- Create: `public/fonts/iowan-old-style-bold.woff2`
- Create: `public/fonts/gt-america-standard-regular.woff2`
- Create: `public/fonts/gt-america-standard-medium.woff2`
- Modify: `src/theme.css`
- Modify: `src/index.css`
- Modify: `index.html`
- Modify: `index.tsx`
- Modify: `public/fonts/licenses/NOTICES.md`
- Test: `tests/unit/typographyContract.test.ts`

- [ ] **Step 1: Place the licensed WOFF2 binaries in `public/fonts/`**

Use the user-confirmed licensed copies corresponding to the reference page’s Iowan Roman, Italic, Bold and GT America Standard Regular, Medium files. Verify each file is a WOFF2 font and non-empty:

```bash
file public/fonts/iowan-old-style-*.woff2 public/fonts/gt-america-standard-*.woff2
```

Expected: all five files report Web Open Font Format.

- [ ] **Step 2: Register only the five required weights in `src/theme.css`**

Add `@font-face` declarations using `font-display: swap`, mapping Iowan Regular/Italic to 400, Iowan Bold to 700, GT America Regular to 400, and GT America Medium to 500.

```css
@font-face {
  font-family: "Iowan Old Style BT";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/iowan-old-style-regular.woff2') format('woff2');
}

@font-face {
  font-family: "GT America";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/gt-america-standard-regular.woff2') format('woff2');
}
```

Repeat the same complete declaration pattern for the remaining three files.

- [ ] **Step 3: Define the canonical roles and compatibility aliases**

```css
:root {
  --font-display: "Cormorant Garamond", Georgia, "Times New Roman", serif;
  --font-reading: "Iowan Old Style BT", Georgia, "Times New Roman", serif;
  --font-ui: "GT America", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  --font-technical: "IBM Plex Mono", "SFMono-Regular", Consolas, monospace;
  --font-cjk: "Noto Serif TC", "Noto Serif SC", "Songti SC", serif;
  --font-calligraphic: "Ma Shan Zheng", "Noto Serif SC", cursive;
  --font-brand: "Cinzel", Palatino, serif;

  --type-reading-size: 1.0625rem;
  --type-reading-leading: 1.6;
  --type-supporting-size: 0.9375rem;
  --type-ui-size: 0.9375rem;
  --type-meta-size: 0.8125rem;
  --type-label-size: 0.75rem;
}
```

Map Tailwind’s `--font-serif`, `--font-sans`, `--font-mono`, `--font-label`, and legacy `--serif`, `--sans`, `--mono`, `--cjk` aliases to these canonical roles. `--font-serif` remains the display role for existing large heading utilities; prose consumers migrate explicitly to `--font-reading`.

- [ ] **Step 4: Move global direct declarations to semantic roles**

Update `src/index.css`, the skip link and initial loader in `index.html`, and the fatal-render error style in `index.tsx`. Preserve CJK priority and use `--font-brand` for the existing Cinzel drop cap.

- [ ] **Step 5: Replace the reading font preload and document the commercial assets**

Keep the Cormorant display preload, replace the Lora preload with Iowan Regular, and record Iowan Old Style BT and GT America as separately licensed commercial assets in `public/fonts/licenses/NOTICES.md` without representing them as OFL fonts.

- [ ] **Step 6: Run the focused contract test**

```bash
npm run test:unit -- tests/unit/typographyContract.test.ts
```

Expected: the theme-role assertions pass; remaining failures list only unmigrated React or `/learn` hardcodes.

- [ ] **Step 7: Commit the shared contract without staging `INDEX.md`**

```bash
git add src/theme.css src/index.css index.html index.tsx public/fonts public/fonts/licenses/NOTICES.md
git commit --no-verify -m "feat: centralize the typography contract"
```

### Task 3: Migrate the React and Oracle production consumers

**Files:**
- Modify: active production files under `components/` identified by `tests/unit/typographyContract.test.ts`
- Modify: `shared/nav-shared.css` only if confirmed as a production import
- Test: `tests/unit/typographyContract.test.ts`

- [ ] **Step 1: Convert interface declarations to `var(--font-ui)`**

Replace hardcoded Karla, Lato, and Plus Jakarta Sans declarations in account, navigation, profile, atlas, form, and oracle controls. Preserve existing sizes initially so the family change can be evaluated independently.

- [ ] **Step 2: Convert reading and supporting prose to `var(--font-reading)`**

Use Iowan for oracle prose, descriptions, reflective copy, invocation content, and supporting text below the display threshold. Keep CJK and technical text on their specialized roles.

- [ ] **Step 3: Keep major headings on `var(--font-display)` and brand marks on `var(--font-brand)`**

Large page, article, and feature titles stay Cormorant. Existing Cinzel brand and symbolic uses move to `--font-brand` rather than becoming interface text.

- [ ] **Step 4: Keep generated and archived sources out of the migration**

Do not mass-edit `components/oracle/eb/generated/`, `components/oracle/entry/generated/`, `_mockups/`, or `_src/`. Their active wrappers must supply semantic aliases when generated content is used.

- [ ] **Step 5: Run the contract test and typecheck**

```bash
npm run test:unit -- tests/unit/typographyContract.test.ts
npm run typecheck
```

Expected: no React/oracle hardcode failures and TypeScript exits 0.

- [ ] **Step 6: Commit the React and Oracle migration without staging `INDEX.md`**

```bash
git add components shared
git commit --no-verify -m "refactor: use semantic typography roles in the app"
```

### Task 4: Migrate `/learn` to the same contract

**Files:**
- Modify: `content-site/src/styles/global.css`
- Verify: `content-site/src/styles/site-bar.css`
- Test: `tests/unit/typographyContract.test.ts`

- [ ] **Step 1: Replace direct `/learn` families**

Map Lora to `var(--font-reading)`, Karla to `var(--font-ui)`, Cormorant Garamond to `var(--font-display)`, and Cinzel to `var(--font-brand)`. Keep the existing large article and library title sizes.

- [ ] **Step 2: Apply the approved reading scale**

Set long-form article paragraphs and lists to `var(--type-reading-size)` with `var(--type-reading-leading)`. Keep compact metadata and labels on their semantic sizes where the existing composition permits.

- [ ] **Step 3: Verify shared theme inheritance**

Confirm `content-site/src/styles/site-bar.css` still imports `../../../src/theme.css` and that `global.css` contains no direct production family literals.

- [ ] **Step 4: Run the focused contract and content build**

```bash
npm run test:unit -- tests/unit/typographyContract.test.ts
npm run build:content
```

Expected: the contract test passes and Astro builds `/learn` successfully.

- [ ] **Step 5: Commit the `/learn` migration without staging `INDEX.md`**

```bash
git add content-site/src/styles/global.css
git commit --no-verify -m "refactor: share typography roles with learn"
```

### Task 5: Add computed-style cross-surface verification

**Files:**
- Create: `tests/typography-contract.spec.ts`
- Test: React app and `/learn` production builds

- [ ] **Step 1: Write Playwright assertions for representative roles**

The test must wait for `document.fonts.ready`, then check:

- `/universal-language/22`: reading prose resolves to Iowan Old Style BT; a major title resolves to Cormorant Garamond; shared navigation resolves to GT America.
- `/learn/what-is-a-mandala/`: article body resolves to Iowan Old Style BT; article title and H2 resolve to Cormorant Garamond; shared navigation resolves to GT America.
- Each route’s computed `--font-reading`, `--font-display`, and `--font-ui` values agree with its rendered elements.

- [ ] **Step 2: Run the focused browser test against the production build**

Start the local production server in one terminal:

```bash
npm run dev:full
```

Run in another terminal:

```bash
npx playwright test tests/typography-contract.spec.ts --project='Desktop Chrome' --reporter=list
```

Expected: both cross-surface typography cases pass.

- [ ] **Step 3: Commit the browser contract without staging `INDEX.md`**

```bash
git add tests/typography-contract.spec.ts
git commit --no-verify -m "test: verify typography across app and learn"
```

### Task 6: Verify visually, integrate, and deploy

**Files:**
- Verify: all modified files
- Preserve: `INDEX.md`

- [ ] **Step 1: Run the full relevant verification**

```bash
npm run typecheck
npm run test:unit
npm run build
```

Expected: every command exits 0.

- [ ] **Step 2: Inspect actual screens**

Check desktop and mobile rendering for `/universal-language/22`, the profile graph, an account surface, `/learn`, and `/learn/what-is-a-mandala/`. Confirm headings remain distinct, prose is comfortable, controls do not clip, and both themes retain readable contrast.

- [ ] **Step 3: Verify the final working tree and diff**

```bash
git status --short
git diff --check
git diff origin/main...HEAD -- src/theme.css src/index.css index.html index.tsx components content-site tests public/fonts
```

Expected: no whitespace errors, no accidental generated/mockup edits, and `INDEX.md` remains the pre-existing user-owned modification.

- [ ] **Step 4: Push the completed feature branch**

```bash
git push origin codex/groq-reflection-recorder
```

- [ ] **Step 5: Integrate the verified commits into `main` and push**

Integrate only after confirming the branch contains the intended existing oracle fixes plus the typography work. Push `main` to trigger Cloudflare Pages auto-deployment.

- [ ] **Step 6: Verify production**

Open `https://mandalacodes.com/universal-language/22` and `https://mandalacodes.com/learn/what-is-a-mandala/`, wait for fonts, and verify computed families plus key visual wrapping. Confirm the deployed font files return HTTP 200.
